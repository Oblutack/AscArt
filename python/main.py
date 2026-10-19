import sys
import json
import os
import traceback
from core.image_processor import ImageProcessor
from core.gif_processor import GifProcessor
from core.file_handler import FileHandler


def log_error(message):
    """Send error message to stderr for debugging"""
    sys.stderr.write(f"[PYTHON ERROR] {message}\n")
    sys.stderr.flush()


def log_info(message):
    """Send info message to stderr for debugging"""
    sys.stderr.write(f"[PYTHON INFO] {message}\n")
    sys.stderr.flush()


def send(message):
    """Write one JSON line for Electron"""
    print(json.dumps(message))
    sys.stdout.flush()


def error_response(message):
    return {"status": "error", "error": message}


class Backend:
    def __init__(self):
        self.image_processor = ImageProcessor()
        self.gif_processor = GifProcessor()
        self.file_handler = FileHandler()

    def handle_ping(self, data):
        return {"status": "success", "type": "pong", "message": "Pong from Python!"}

    def handle_convert(self, data):
        path = data.get('path')
        options = data.get('options', {})
        request_id = data.get('requestId')

        if not path:
            return error_response("No file path provided")
        if not os.path.exists(path):
            return error_response(f"File not found: {path}")

        log_info(f"Convert: {os.path.basename(path)}")

        try:
            if os.path.splitext(path)[1].lower() == '.gif':
                def report_progress(current, total):
                    send({
                        "status": "success",
                        "type": "progress",
                        "current": current,
                        "total": total,
                        "requestId": request_id,
                    })

                result = self.gif_processor.process_and_convert(path, options, report_progress)

                if result['frames']:
                    self.file_handler.save_history_entry(
                        result['frames'][0],  # First frame as preview
                        options,
                        is_gif=True,
                        frames=result['frames'],
                        delays=result['delays']
                    )

                log_info(f"GIF processed, {result['frame_count']} frames")
                return {
                    "status": "success",
                    "type": "gif-result",
                    "frames": result['frames'],
                    "delays": result['delays'],
                    "frameCount": result['frame_count']
                }

            ascii_art = self.image_processor.process_and_convert(path, options)
            log_info(f"ASCII art generated, length: {len(ascii_art) if ascii_art else 0}")

            if ascii_art:
                self.file_handler.save_history_entry(ascii_art, options)

            return {
                "status": "success",
                "type": "ascii-result",
                "ascii": ascii_art,
                "isGif": False
            }

        except Exception as e:
            log_error(f"Conversion failed: {e}")
            log_error(traceback.format_exc())
            return error_response(f"Conversion failed: {e}")

    def handle_get_history(self, data):
        try:
            history = self.file_handler.get_history()
            log_info(f"History loaded: {len(history)} entries")
            return {"status": "success", "type": "history", "history": history}
        except Exception as e:
            log_error(f"History load failed: {e}")
            return error_response(f"History load failed: {e}")

    def handle_delete_history(self, data):
        ids = data.get('ids')
        if not ids:
            return error_response("No history ids provided")

        try:
            removed = self.file_handler.delete_history_entries(ids)
            log_info(f"Deleted {removed} history entries")
            return {
                "status": "success",
                "type": "deleted",
                "removed": removed,
            }
        except Exception as e:
            log_error(f"Delete failed: {e}")
            return error_response(f"Delete failed: {e}")


def main():
    log_info("Python backend started")

    try:
        backend = Backend()
        log_info("Processors initialized successfully")
    except Exception as e:
        log_error(f"Failed to initialize processors: {e}")
        log_error(traceback.format_exc())
        send(error_response(f"Backend failed to start: {e}"))
        sys.exit(1)

    handlers = {
        'ping': backend.handle_ping,
        'convert': backend.handle_convert,
        'get_history': backend.handle_get_history,
        'delete_history': backend.handle_delete_history,
    }

    while True:
        request_id = None
        try:
            line = sys.stdin.readline()
            if not line:
                log_info("EOF received, exiting")
                break

            data = json.loads(line)
            command = data.get('command')
            request_id = data.get('requestId')
            log_info(f"Command: {command} ({len(line)} bytes)")

            handler = handlers.get(command)
            if handler is None:
                log_error(f"Unknown command: {command}")
                response = error_response(f"Unknown command: {command}")
            else:
                response = handler(data)

        except json.JSONDecodeError as e:
            log_error(f"Invalid JSON: {e}")
            response = error_response(f"Invalid JSON: {e}")

        except Exception as e:
            log_error(f"Unexpected error: {e}")
            log_error(traceback.format_exc())
            response = error_response(f"Unexpected error: {e}")

        # Lets the UI ignore answers to requests it has already given up on
        if request_id is not None:
            response["requestId"] = request_id
        send(response)


if __name__ == '__main__':
    main()
