"""
GIF Processing Module
Handles animated GIF conversion to ASCII
"""

from PIL import Image
from .image_processor import ImageProcessor


class GifProcessor:
    def __init__(self):
        self.frames = []
        self.delays = []
        self.processor = ImageProcessor()
    
    def load_gif(self, path):
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
    
    def convert_frames_to_ascii(self, options):
        """Convert all frames to ASCII"""
        ascii_frames = []
        
        for frame in self.frames:
            # Set frame as processor's image
            self.processor.image = frame
            self.processor.original_image = frame.copy()
            
            # Apply same processing as images
            if options.get('removeBackground', False):
                self.processor.remove_background()
            
            brightness = options.get('brightness', 0)
            if brightness != 0:
                self.processor.adjust_brightness(brightness)
            
            contrast = options.get('contrast', 100)
            if contrast != 100:
                self.processor.adjust_contrast(contrast)
            
            if options.get('invert', False):
                self.processor.invert_colors()
            
            width = options.get('width', 120)
            ratio = options.get('ratio')
            keep_original = options.get('keepOriginal', False)
            self.processor.resize_image(width, ratio, keep_original)
            
            charset = options.get('charset', 'detailed')
            ascii_frame = self.processor.convert_to_ascii(charset)
            ascii_frames.append(ascii_frame)
        
        return ascii_frames
    
    def process_and_convert(self, path, options):
        """Complete GIF processing pipeline"""
        try:
            frame_count = self.load_gif(path)
            ascii_frames = self.convert_frames_to_ascii(options)
            
            return {
                'type': 'gif',
                'frames': ascii_frames,
                'delays': self.delays,
                'frame_count': frame_count,
                'preview': ascii_frames[0] if ascii_frames else ''
            }
            
        except Exception as e:
            raise Exception(f"GIF processing error: {str(e)}")
