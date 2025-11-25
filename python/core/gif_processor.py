"""
GIF Processing Module
Handles animated GIF conversion to ASCII
"""

from PIL import Image
import imageio
from .image_processor import ImageProcessor
import numpy as np


class GifProcessor:
    def __init__(self):
        self.frames = []
        self.processor = ImageProcessor()
    
    def load_gif(self, path):
        """Load GIF frames"""
        gif = Image.open(path)
        
        self.frames = []
        try:
            while True:
                frame = gif.copy()
                if frame.mode != 'RGB':
                    frame = frame.convert('RGB')
                self.frames.append(frame)
                gif.seek(gif.tell() + 1)
        except EOFError:
            pass
        
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
            
            # For now, return first frame as ASCII
            # Full animation support can be added later
            ascii_frames = self.convert_frames_to_ascii(options)
            
            return {
                'type': 'gif',
                'frames': ascii_frames,
                'frame_count': frame_count,
                'preview': ascii_frames[0] if ascii_frames else ''
            }
            
        except Exception as e:
            raise Exception(f"GIF processing error: {str(e)}")
