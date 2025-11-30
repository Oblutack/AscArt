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
        self.alpha_mask = None
        
    def load_image(self, path):
        """Load image from file path"""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Image not found: {path}")
        
        self.original_image = Image.open(path)
        self.image = self.original_image.copy()
        
        # Handle transparency: convert RGBA to RGB with white background
        if self.image.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            background = Image.new('RGB', self.image.size, (255, 255, 255))
            # If has alpha channel, use it for compositing
            if self.image.mode == 'RGBA':
                background.paste(self.image, mask=self.image.split()[3])
            elif self.image.mode == 'LA':
                background.paste(self.image.convert('RGB'), mask=self.image.split()[1])
            else:  # Palette mode
                self.image = self.image.convert('RGBA')
                background.paste(self.image, mask=self.image.split()[3])
            self.image = background
        elif self.image.mode != 'RGB':
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
        
        # Store alpha mask for transparency detection
        if output.mode == 'RGBA':
            self.alpha_mask = output.split()[3]
        else:
            self.alpha_mask = None
        
        # Create white background for processing
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
    
    def convert_to_ascii(self, charset='detailed', colored=True):
        """Convert image to ASCII art (colored or monochrome)"""
        if self.image is None:
            raise ValueError("No image loaded")
        
        # Get character set (from dark to light: @ to space)
        chars = self.CHARSETS.get(charset, self.CHARSETS['detailed'])
        
        # Convert to grayscale for brightness
        gray_image = self.image.convert('L')
        gray_pixels = np.array(gray_image)
        
        # Get color pixels
        color_pixels = np.array(self.image)
        
        # Get alpha mask if background was removed
        alpha_array = None
        if hasattr(self, 'alpha_mask') and self.alpha_mask is not None:
            # Resize alpha mask to match current image size
            alpha_resized = self.alpha_mask.resize(gray_image.size, Image.Resampling.LANCZOS)
            alpha_array = np.array(alpha_resized)
        
        # Map pixel brightness (0-255) directly to character index
        # Dark pixels (0) -> dark chars (@), Bright pixels (255) -> light chars (space)
        char_count = len(chars) - 1
        char_indices = ((gray_pixels / 255) * char_count).astype(int)
        
        if colored:
            # Generate colored HTML with optimized string building
            html_lines = []
            for row_idx, row in enumerate(char_indices):
                line_spans = []
                for col_idx, char_idx in enumerate(row):
                    # If alpha mask exists and this pixel is transparent, use space
                    if alpha_array is not None and alpha_array[row_idx, col_idx] < 10:
                        line_spans.append(' ')
                    else:
                        char = chars[char_idx]
                        r, g, b = color_pixels[row_idx, col_idx]
                        # Faster string concatenation without f-string overhead
                        line_spans.append(f'<span style="color:rgb({r},{g},{b})">{char}</span>')
                html_lines.append(''.join(line_spans))
            
            return '\n'.join(html_lines)
        else:
            # Generate monochrome ASCII
            ascii_art = []
            for row_idx, row in enumerate(char_indices):
                ascii_row = ''
                for col_idx, char_idx in enumerate(row):
                    # If alpha mask exists and this pixel is transparent, use space
                    if alpha_array is not None and alpha_array[row_idx, col_idx] < 10:
                        ascii_row += ' '
                    else:
                        ascii_row += chars[char_idx]
                ascii_art.append(ascii_row)
            
            return '\n'.join(ascii_art)
    
    def reset(self):
        """Reset to original image"""
        if self.original_image:
            self.image = self.original_image.copy()
            if self.image.mode != 'RGB':
                self.image = self.image.convert('RGB')
            self.alpha_mask = None
    
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
