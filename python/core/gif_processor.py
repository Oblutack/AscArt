"""
GIF Processing Module
Handles animated GIF conversion to ASCII
"""

from PIL import Image
from .cancel import Cancelled
from .image_processor import ImageProcessor


class GifProcessor:
    def __init__(self):
        self.frames = []
        self.delays = []
        self.processor = ImageProcessor()

    def load_gif(self, path, should_cancel=None):
        """Load GIF frames and delays"""
        with Image.open(path) as gif:
            self.frames = []
            self.delays = []

            # Count total frames
            total_frames = 0
            try:
                while True:
                    gif.seek(total_frames)
                    total_frames += 1
            except EOFError:
                pass

            gif.seek(0)  # Reset to first frame

            # Extract frames and delays
            for frame_index in range(total_frames):
                if should_cancel:
                    should_cancel()
                gif.seek(frame_index)

                # Get frame delay in milliseconds (default 100ms)
                delay = gif.info.get('duration', 100)
                self.delays.append(delay)

                # Convert frame to RGB
                frame = gif.copy()
                if frame.mode != 'RGB':
                    frame = frame.convert('RGB')
                self.frames.append(frame)

        return len(self.frames)

    def convert_frames_to_grids(self, options, progress=None, should_cancel=None):
        """
        Run every loaded frame through the same pipeline as a still image.
        should_cancel is called before each frame and may raise Cancelled.
        """
        grids = []
        total = len(self.frames)

        for index, frame in enumerate(self.frames):
            if should_cancel:
                should_cancel()
            self.processor.image = frame
            self.processor.original_image = frame.copy()
            grids.append(self.processor.process_image(options))

            if progress:
                progress(index + 1, total)

        return grids

    def process_to_grids(self, path, options, progress=None, should_cancel=None):
        """Complete GIF pipeline, keeping the Grid of every frame"""
        try:
            frame_count = self.load_gif(path, should_cancel)
            return {
                'grids': self.convert_frames_to_grids(options, progress, should_cancel),
                'delays': self.delays,
                'frame_count': frame_count,
            }
        except Cancelled:
            raise
        except Exception as e:
            raise Exception(f"GIF processing error: {str(e)}")

    def convert_frames_to_ascii(self, options, progress=None):
        """Convert all loaded frames to HTML strings"""
        return [grid.to_html() for grid in self.convert_frames_to_grids(options, progress)]

    def process_and_convert(self, path, options, progress=None):
        """Complete GIF pipeline, frames as HTML strings"""
        result = self.process_to_grids(path, options, progress)
        frames = [grid.to_html() for grid in result['grids']]
        return {
            'type': 'gif',
            'frames': frames,
            'delays': result['delays'],
            'frame_count': result['frame_count'],
            'preview': frames[0] if frames else ''
        }
