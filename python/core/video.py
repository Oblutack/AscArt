"""
Video input: ffmpeg cuts a short clip into frames, which then go through the
same pipeline as the frames of a GIF.

ffmpeg is not bundled (it is large and has its own license); if it isn't
installed the user is told how to get it.
"""

import os
import shutil
import subprocess
import tempfile

from PIL import Image

VIDEO_EXTENSIONS = {'.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi'}

# A clip longer than this is cut off: every frame becomes a page of text
MAX_SECONDS = 10
FPS = 10
# Frames are shrunk before conversion; art is never anywhere near this wide
MAX_FRAME_WIDTH = 640


def is_video(path):
    return os.path.splitext(path)[1].lower() in VIDEO_EXTENSIONS


def find_ffmpeg():
    """The ffmpeg executable: ASCART_FFMPEG, or whatever is on the PATH"""
    return os.environ.get('ASCART_FFMPEG') or shutil.which('ffmpeg')


def load_video_frames(path, should_cancel=None, max_seconds=MAX_SECONDS, fps=FPS):
    """
    Frames of the first few seconds of a video, as RGB images, plus the delay
    between them in milliseconds. should_cancel is called regularly and may
    raise Cancelled.
    """
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise RuntimeError(
            "Video needs ffmpeg. Install it (https://ffmpeg.org/download.html) "
            "and make sure it is on your PATH.")

    with tempfile.TemporaryDirectory(prefix='ascart_video_') as folder:
        command = [
            ffmpeg, '-v', 'error', '-nostdin',
            '-t', str(max_seconds),
            '-i', path,
            '-vf', f"fps={fps},scale='min({MAX_FRAME_WIDTH},iw)':-2",
            os.path.join(folder, 'frame_%04d.png'),
        ]
        try:
            process = subprocess.Popen(
                command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except OSError as e:
            raise RuntimeError(f"Could not start ffmpeg ({ffmpeg}): {e}") from e

        try:
            while process.poll() is None:
                if should_cancel:
                    should_cancel()
                try:
                    process.wait(timeout=0.1)
                except subprocess.TimeoutExpired:
                    pass
        except BaseException:
            process.kill()
            process.wait()
            raise

        errors = process.stderr.read().decode('utf-8', 'replace').strip()
        process.stderr.close()
        if process.returncode != 0:
            last_line = errors.splitlines()[-1] if errors else 'unknown error'
            raise RuntimeError(f"ffmpeg could not read this video: {last_line}")

        frames = []
        for name in sorted(os.listdir(folder)):
            if should_cancel:
                should_cancel()
            with Image.open(os.path.join(folder, name)) as frame:
                frames.append(frame.convert('RGB'))

    if not frames:
        raise RuntimeError("That video has no frames to convert")

    return frames, [round(1000 / fps)] * len(frames)
