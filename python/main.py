import json
import os
import queue
import sys
import threading
import traceback

from core.cancel import Cancelled, CancelRegistry
from core.file_handler import FileHandler
from core.gif_processor import GifProcessor
from core.image_processor import ImageProcessor


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


# The gallery shows thumbnails at most this many characters across / down
THUMB_COLS = 48
THUMB_ROWS = 24


def make_thumb(grid):
    return grid.downscale(THUMB_COLS, THUMB_ROWS).to_html()


def error_response(message):
    return {"status": "error", "error": message}


class Backend:
    def __init__(self):
        self.image_processor = ImageProcessor()
        self.gif_processor = GifProcessor()
        self.file_handler = FileHandler()
        self.cancelled = CancelRegistry()

    def handle_ping(self, data):
        return {"status": "success", "type": "pong", "message": "Pong from Python!"}

    def handle_convert(self, data):
        path = data.get('path')
        options = data.get('options', {})
        request_id = data.get('requestId')
        # Live previews are throwaway; only deliberate conversions go to history
        save_history = data.get('saveHistory', True)

        if not path:
            return error_response("No file path provided")
        if not os.path.exists(path):
            return error_response(f"File not found: {path}")

        log_info(f"Convert: {os.path.basename(path)}")

        def checkpoint():
            self.cancelled.check(request_id)

        try:
            checkpoint()  # cancelled while it was still waiting in the queue
            if os.path.splitext(path)[1].lower() == '.gif':
                def report_progress(current, total):
                    send({
                        "status": "success",
                        "type": "progress",
                        "current": current,
                        "total": total,
                        "requestId": request_id,
                    })

                result = self.gif_processor.process_to_grids(
                    path, options, report_progress, checkpoint)
                grids = result['grids']
                frames = [grid.to_html() for grid in grids]

                if frames and save_history:
                    self.file_handler.save_history_entry(
                        frames[0],  # First frame stands in for the whole GIF
                        options,
                        is_gif=True,
                        frames=frames,
                        delays=result['delays'],
                        thumb=make_thumb(grids[0]),
                    )

                log_info(f"GIF processed, {result['frame_count']} frames")
                return {
                    "status": "success",
                    "type": "gif-result",
                    "frames": frames,
                    "delays": result['delays'],
                    "frameCount": result['frame_count']
                }

            grid = self.image_processor.process_to_grid(path, options)
            ascii_art = grid.to_html()
            log_info(f"ASCII art generated, length: {len(ascii_art)}")

            if ascii_art and save_history:
                self.file_handler.save_history_entry(ascii_art, options, thumb=make_thumb(grid))

            return {
                "status": "success",
                "type": "ascii-result",
                "ascii": ascii_art,
                "isGif": False
            }

        except Cancelled:
            log_info(f"Conversion {request_id} cancelled")
            return {"status": "success", "type": "cancelled"}

        except Exception as e:
            log_error(f"Conversion failed: {e}")
            log_error(traceback.format_exc())
            return error_response(f"Conversion failed: {e}")

        finally:
            self.cancelled.discard(request_id)

    def handle_get_history(self, data):
        try:
            history = self.file_handler.get_history()
            log_info(f"History loaded: {len(history)} entries")
            return {"status": "success", "type": "history", "history": history}
        except Exception as e:
            log_error(f"History load failed: {e}")
            return error_response(f"History load failed: {e}")

    def handle_get_history_entry(self, data):
        entry_id = data.get('id')
        if not entry_id:
            return error_response("No history id provided")

        try:
            entry = self.file_handler.get_history_entry(entry_id)
        except ValueError as e:
            return error_response(str(e))

        if entry is None:
            return error_response("That history entry no longer exists")
        return {"status": "success", "type": "history-entry", "entry": entry}

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


def read_commands(backend, commands):
    """
    Read stdin on its own thread. "cancel" is acted on right away, even while
    the main thread is busy converting; everything else is queued in order.
    """
    for line in sys.stdin:
        try:
            data = json.loads(line)
        except ValueError:
            data = None  # the main loop reports the bad line

        if isinstance(data, dict) and data.get('command') == 'cancel':
            backend.cancelled.add(data.get('requestId'))
            continue

        commands.put(line)

    commands.put(None)  # stdin closed


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
        'get_history_entry': backend.handle_get_history_entry,
        'delete_history': backend.handle_delete_history,
    }

    commands = queue.Queue()
    threading.Thread(target=read_commands, args=(backend, commands), daemon=True).start()

    while True:
        request_id = None
        try:
            line = commands.get()
            if line is None:
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
