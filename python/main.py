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


def main():
    log_info("Python backend started")
    
    # Initialize processors
    try:
        image_processor = ImageProcessor()
        gif_processor = GifProcessor()
        file_handler = FileHandler()
        log_info("Processors initialized successfully")
    except Exception as e:
        log_error(f"Failed to initialize processors: {str(e)}")
        log_error(traceback.format_exc())
    
    while True:
        try:
            # Read input from Electron
            line = sys.stdin.readline()
            if not line:
                log_info("EOF received, exiting")
                break
            
            log_info(f"Received input: {line.strip()}")
            data = json.loads(line)
            command = data.get('command')
            log_info(f"Command: {command}")
            
            response = {}
            
            # Ping test
            if command == 'ping':
                response = {"status": "success", "message": "Pong from Python!"}
                log_info("Ping command executed")
            
            # Convert image/GIF to ASCII
            elif command == 'convert':
                try:
                    path = data.get('path')
                    options = data.get('options', {})
                    
                    log_info(f"Convert command - Path: {path}")
                    log_info(f"Options: {options}")
                    
                    if not path:
                        log_error("No path provided")
                        response = {"status": "error", "error": "No file path provided"}
                    elif not os.path.exists(path):
                        log_error(f"File does not exist: {path}")
                        response = {"status": "error", "error": f"File not found: {path}"}
                    else:
                        # Check if GIF or image
                        file_ext = os.path.splitext(path)[1].lower()
                        log_info(f"File extension: {file_ext}")
                        
                        if file_ext == '.gif':
                            log_info("Processing as GIF")
                            result = gif_processor.process_and_convert(path, options)
                            response = {
                                "status": "success",
                                "type": "gif-result",
                                "frames": result['frames'],
                                "delays": result['delays'],
                                "frameCount": result['frame_count']
                            }
                            log_info(f"GIF processed successfully, {result['frame_count']} frames")
                        else:
                            log_info("Processing as image")
                            ascii_art = image_processor.process_and_convert(path, options)
                            log_info(f"ASCII art generated, length: {len(ascii_art) if ascii_art else 0}")
                            response = {
                                "status": "success",
                                "type": "ascii-result",
                                "ascii": ascii_art,
                                "isGif": False
                            }
                    
                except Exception as e:
                    error_msg = f"Conversion failed: {str(e)}"
                    log_error(error_msg)
                    log_error(traceback.format_exc())
                    response = {
                        "status": "error",
                        "error": error_msg
                    }
            
            # Save ASCII art
            elif command == 'save':
                try:
                    ascii_art = data.get('ascii')
                    filename = data.get('filename')
                    save_format = data.get('format', 'txt')  # 'txt' or 'html'
                    
                    log_info(f"Saving ASCII art to {filename} as {save_format}")
                    
                    if save_format == 'html':
                        filepath = file_handler.save_ascii_html(ascii_art, filename)
                    else:
                        filepath = file_handler.save_ascii_text(ascii_art, filename)
                    
                    response = {
                        "status": "success",
                        "message": f"Saved to {filepath}",
                        "filepath": filepath
                    }
                    log_info(f"Saved successfully to {filepath}")
                    
                except Exception as e:
                    error_msg = f"Save failed: {str(e)}"
                    log_error(error_msg)
                    log_error(traceback.format_exc())
                    response = {
                        "status": "error",
                        "error": error_msg
                    }
            
            # Get history
            elif command == 'get_history':
                try:
                    history_file = os.path.join(file_handler.output_dir, 'history.json')
                    log_info(f"Loading history from {history_file}")
                    
                    if os.path.exists(history_file):
                        with open(history_file, 'r', encoding='utf-8') as f:
                            history = json.load(f)
                        response = {
                            "status": "success",
                            "history": history
                        }
                        log_info(f"History loaded: {len(history)} entries")
                    else:
                        response = {
                            "status": "success",
                            "history": []
                        }
                        log_info("No history file found, returning empty array")
                        
                except Exception as e:
                    error_msg = f"History load failed: {str(e)}"
                    log_error(error_msg)
                    response = {
                        "status": "error",
                        "error": error_msg
                    }
            
            else:
                log_error(f"Unknown command: {command}")
                response = {"status": "error", "error": f"Unknown command: {command}"}

            # Send JSON back to Electron
            log_info(f"Sending response: {response.get('status', 'unknown')}")
            print(json.dumps(response))
            sys.stdout.flush()

        except json.JSONDecodeError as e:
            error_msg = f"Invalid JSON: {str(e)}"
            log_error(error_msg)
            error_response = {"status": "error", "error": error_msg}
            print(json.dumps(error_response))
            sys.stdout.flush()
            
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            log_error(error_msg)
            log_error(traceback.format_exc())
            error_response = {"status": "error", "error": error_msg}
            print(json.dumps(error_response))
            sys.stdout.flush()


if __name__ == '__main__':
    main()