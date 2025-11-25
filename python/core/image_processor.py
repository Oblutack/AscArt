"""
Image Processing Module
Handles image loading, background removal, adjustments, and conversion to ASCII
"""

from PIL import Image, ImageEnhance, ImageOps
import numpy as np
import os

# Lazy import for rembg (only when background removal is needed)
_rembg_remove = None

def _get_rembg():
    global _rembg_remove
    if _rembg_remove is None:
        try:
            from rembg import remove
            _rembg_remove = remove
        except ImportError:
            raise ImportError("rembg is not installed. Background removal is not available.")
    return _rembg_remove


class ImageProcessor:
    # Character sets for different detail levels (from dark to light)
    CHARSETS = {
        'detailed': '@%#*+=-:. ',
        'standard': '@%#*+=-:. ',
        'simple': '█▓▒░ '
    }
    
    def __init__(self):
        self.image = None
        self.original_image = None
        
    def load_image(self, path):
        """Load image from file path"""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Image not found: {path}")
        
        self.original_image = Image.open(path)
        self.image = self.original_image.copy()
        
        # Convert to RGB if needed
        if self.image.mode != 'RGB':
            self.image = self.image.convert('RGB')
            
        return True
    
    def remove_background(self):
        """Remove background using rembg"""
        if self.image is None:
            raise ValueError("No image loaded")
        
        # Get rembg remove function
        remove_func = _get_rembg()
        
        # Remove background
        output = remove_func(self.image)
        
        # Create white background
        background = Image.new('RGB', output.size, (255, 255, 255))
        background.paste(output, mask=output.split()[3] if output.mode == 'RGBA' else None)
        
        self.image = background
        return True
    
    def adjust_brightness(self, value):
        """Adjust brightness (-100 to 100)"""
        if self.image is None:
            raise ValueError("No image loaded")
        
        # Convert to factor (0.0 to 2.0)
        factor = 1.0 + (value / 100.0)
        enhancer = ImageEnhance.Brightness(self.image)
        self.image = enhancer.enhance(factor)
        
    def adjust_contrast(self, value):
        """Adjust contrast (0 to 200)"""
        if self.image is None:
            raise ValueError("No image loaded")
        
        # Convert to factor (0.0 to 2.0)
        factor = value / 100.0
        enhancer = ImageEnhance.Contrast(self.image)
        self.image = enhancer.enhance(factor)
    
    def invert_colors(self):
        """Invert image colors"""
        if self.image is None:
            raise ValueError("No image loaded")
        
        self.image = ImageOps.invert(self.image)
    
    def resize_image(self, width, ratio=None, keep_original=False):
        """Resize image to target width while maintaining aspect ratio"""
        if self.image is None:
            raise ValueError("No image loaded")
        
        if keep_original:
            return
        
        orig_width, orig_height = self.image.size
        
        if ratio:
            # Parse ratio like "16:9"
            try:
                ratio_w, ratio_h = map(int, ratio.split(':'))
                aspect_ratio = ratio_w / ratio_h
                height = int(width / aspect_ratio * 0.55)  # 0.55 compensates for char height
            except:
                # Fall back to original aspect ratio
                aspect_ratio = orig_width / orig_height
                height = int(width / aspect_ratio * 0.55)
        else:
            # Maintain original aspect ratio
            aspect_ratio = orig_width / orig_height
            height = int(width / aspect_ratio * 0.55)
        
        self.image = self.image.resize((width, height), Image.Resampling.LANCZOS)
    
    def convert_to_ascii(self, charset='detailed'):
        """Convert image to ASCII art"""
        if self.image is None:
            raise ValueError("No image loaded")
        
        # Get character set (from dark to light: @ to space)
        chars = self.CHARSETS.get(charset, self.CHARSETS['detailed'])
        
        # Convert to grayscale
        gray_image = self.image.convert('L')
        
        # Get pixels as numpy array
        pixels = np.array(gray_image)
        
        # Map pixel brightness (0-255) directly to character index
        # Dark pixels (0) -> dark chars (@), Bright pixels (255) -> light chars (space)
        char_count = len(chars) - 1
        char_indices = ((pixels / 255) * char_count).astype(int)
        
        # Map pixels to characters
        ascii_art = []
        for row in char_indices:
            ascii_row = ''.join([chars[i] for i in row])
            ascii_art.append(ascii_row)
        
        return '\n'.join(ascii_art)
    
    def reset(self):
        """Reset to original image"""
        if self.original_image:
            self.image = self.original_image.copy()
            if self.image.mode != 'RGB':
                self.image = self.image.convert('RGB')
    
    def process_and_convert(self, path, options):
        """Complete pipeline: load, process, and convert to ASCII"""
        try:
            # Load image
            self.load_image(path)
            
            # Remove background if requested
            if options.get('removeBackground', False):
                self.remove_background()
            
            # Apply adjustments
            brightness = options.get('brightness', 0)
            if brightness != 0:
                self.adjust_brightness(brightness)
            
            contrast = options.get('contrast', 100)
            if contrast != 100:
                self.adjust_contrast(contrast)
            
            if options.get('invert', False):
                self.invert_colors()
            
            # Resize
            width = options.get('width', 120)
            ratio = options.get('ratio')
            keep_original = options.get('keepOriginal', False)
            self.resize_image(width, ratio, keep_original)
            
            # Convert to ASCII
            charset = options.get('charset', 'detailed')
            ascii_art = self.convert_to_ascii(charset)
            
            return ascii_art
            
        except Exception as e:
            raise Exception(f"Processing error: {str(e)}")
