"""
Image Processing Module
Handles image loading, background removal, adjustments, and conversion to ASCII
"""

import io
import os

import numpy as np
from PIL import Image, ImageEnhance, ImageOps

from .art import Grid
from .charsets import CHARSET_ALIASES, CHARSETS, resolve_charset

# Lazy import for rembg (only when background removal is needed)
_rembg_remove = None
_rembg_session = None

def _get_rembg():
    global _rembg_remove, _rembg_session
    if _rembg_remove is None:
        try:
            from rembg import new_session, remove
            # Use u2netp model: 4.7MB vs 176MB for u2net
            # 95% accuracy is perfect for ASCII art preprocessing
            _rembg_session = new_session("u2netp")
            _rembg_remove = remove
        except ImportError as e:
            # Keep the reason: "not installed" and "a DLL failed to load"
            # need very different fixes
            raise ImportError(f"Background removal is not available: {e}") from e
    return _rembg_remove, _rembg_session


class ImageProcessor:
    # Kept here too, so callers and tests can say ImageProcessor.CHARSETS
    CHARSETS = CHARSETS
    CHARSET_ALIASES = CHARSET_ALIASES

    # Widest output "Keep Original" will produce, in characters
    MAX_KEEP_ORIGINAL_WIDTH = 400

    def __init__(self):
        self.image = None
        self.original_image = None
        self.alpha_mask = None

    def load_image(self, path):
        """Load image from file path"""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Image not found: {path}")

        return self._use_image(Image.open(path))

    def load_image_bytes(self, data):
        """Load an image from its encoded bytes (a camera frame, for example)"""
        return self._use_image(Image.open(io.BytesIO(data)))

    def _use_image(self, image):
        """Make `image` the working image, flattened to RGB on white"""
        self.original_image = image
        self.image = self.original_image.copy()
        # A mask from a previous image must not leak into this one
        self.alpha_mask = None

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
        """Remove background using rembg with optimized u2netp model"""
        if self.image is None:
            raise ValueError("No image loaded")

        # Get rembg remove function and session
        remove_func, session = _get_rembg()

        # Remove background using the optimized session
        output = remove_func(self.image, session=session)

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

        orig_width, orig_height = self.image.size

        if keep_original:
            # Native size, but capped: one span per character on a 4000px photo
            # would freeze the app. Height still gets the character correction.
            width = min(orig_width, self.MAX_KEEP_ORIGINAL_WIDTH)
            ratio = None

        # Height of a character cell is about twice its width, hence 0.55
        aspect_ratio = orig_width / orig_height
        if ratio:
            try:
                ratio_w, ratio_h = map(int, ratio.split(':'))
                aspect_ratio = ratio_w / ratio_h
            except (ValueError, ZeroDivisionError):
                pass  # fall back to the image's own aspect ratio

        height = max(1, int(width / aspect_ratio * 0.55))

        self.image = self.image.resize((width, height), Image.Resampling.LANCZOS)

    # Colour schemes that tint the luminance: divisors for (r, g, b)
    TINT_DIVISORS = {
        'blue': (3, 2, 1),
        'green': (3, 1, 2),
        'red': (1, 3, 3),
        'purple': (1, 3, 1),
        'cyan': (3, 1, 1),
    }

    # Colours are rounded to multiples of this so neighbouring characters share
    # a <span>. 8 is invisible at the font sizes the app uses.
    COLOR_STEP = 8

    def _alpha_array(self, size):
        """Background-removal mask resized to the working image, or None"""
        if self.alpha_mask is None:
            return None
        return np.array(self.alpha_mask.resize(size, Image.Resampling.LANCZOS))

    @classmethod
    def _apply_color_scheme(cls, rgb, color_scheme):
        """Recolour an (H, W, 3) uint8 array according to the scheme"""
        rgb = rgb.astype(np.int32)
        if color_scheme == 'original' or (
                color_scheme not in ('grayscale', 'sepia') and color_scheme not in cls.TINT_DIVISORS):
            return rgb

        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

        if color_scheme == 'sepia':
            return np.minimum(255, np.stack([
                (0.393 * r + 0.769 * g + 0.189 * b).astype(np.int32),
                (0.349 * r + 0.686 * g + 0.168 * b).astype(np.int32),
                (0.272 * r + 0.534 * g + 0.131 * b).astype(np.int32),
            ], axis=-1))

        gray = (0.299 * r + 0.587 * g + 0.114 * b).astype(np.int32)
        if color_scheme == 'grayscale':
            return np.stack([gray, gray, gray], axis=-1)

        return gray[..., None] // np.array(cls.TINT_DIVISORS[color_scheme])

    @classmethod
    def _quantize(cls, rgb):
        """Round colours to COLOR_STEP so runs of similar cells merge"""
        step = cls.COLOR_STEP
        return np.minimum(255, (rgb + step // 2) // step * step)

    def build_grid(self, charset='detailed', colored=True, color_scheme='original', custom_chars=None):
        """Turn the working image into a Grid of characters (and colours)"""
        if self.image is None:
            raise ValueError("No image loaded")

        # The ramp, from dark to light (@ to space)
        chars = np.array(resolve_charset(charset, custom_chars))

        gray_pixels = np.array(self.image.convert('L'))
        height, width = gray_pixels.shape

        # Map pixel brightness (0-255) directly to character index
        # Dark pixels (0) -> dark chars (@), Bright pixels (255) -> light chars (space)
        char_indices = ((gray_pixels / 255) * (len(chars) - 1)).astype(int)
        glyphs = chars[char_indices]

        # Cells the background removal made transparent are plain spaces
        alpha_array = self._alpha_array(self.image.size)
        if alpha_array is not None:
            glyphs = np.where(alpha_array < 10, ' ', glyphs)

        if not colored:
            return Grid(glyphs)

        rgb = self._apply_color_scheme(np.array(self.image), color_scheme)
        rgb = self._quantize(rgb)

        # A space shows no colour, so let it take the colour of the cell before
        # it. That keeps runs of text and blanks inside one <span>.
        columns = np.arange(width)
        last_visible = np.maximum.accumulate(
            np.where(glyphs != ' ', columns, 0), axis=1)
        rgb = np.take_along_axis(rgb, last_visible[..., None], axis=1)

        return Grid(glyphs, rgb.astype(np.uint8))

    def halftone_grid(self):
        """Pure black & white halftone (dithering only) as a Grid"""
        if self.image is None:
            raise ValueError("No image loaded")

        gray_image = self.image.convert('L')

        # Floyd-Steinberg, done by Pillow in C
        dithered = np.array(
            gray_image.convert('1', dither=Image.Dither.FLOYDSTEINBERG).convert('L'))

        # Black pixels = █ (solid block), white pixels = space
        glyphs = np.where(dithered < 128, '█', ' ')

        alpha_array = self._alpha_array(gray_image.size)
        if alpha_array is not None:
            glyphs = np.where(alpha_array < 10, ' ', glyphs)

        return Grid(glyphs)

    def convert_to_ascii(self, charset='detailed', colored=True, color_scheme='original', custom_chars=None):
        """ASCII art as an HTML string (colored) or plain text"""
        grid = self.build_grid(charset, colored, color_scheme, custom_chars)
        return grid.to_html() if colored else grid.to_text()

    def convert_to_halftone(self):
        """Halftone as plain text"""
        return self.halftone_grid().to_text()

    def reset(self):
        """Reset to original image"""
        if self.original_image:
            self.image = self.original_image.copy()
            if self.image.mode != 'RGB':
                self.image = self.image.convert('RGB')
            self.alpha_mask = None

    def process_image(self, options):
        """
        Everything between "an image is loaded" and "here is the art":
        background removal, adjustments, resizing and conversion.
        """
        self.alpha_mask = None

        if options.get('removeBackground', False):
            self.remove_background()

        brightness = options.get('brightness', 0)
        if brightness != 0:
            self.adjust_brightness(brightness)

        contrast = options.get('contrast', 100)
        if contrast != 100:
            self.adjust_contrast(contrast)

        if options.get('invert', False):
            self.invert_colors()

        width = options.get('width', 120)
        ratio = options.get('ratio')
        keep_original = options.get('keepOriginal', False)

        if options.get('dither', False):
            # Halftone cells are single dots, so render at 3x the width
            self.resize_image(width * 3, ratio, keep_original)
            return self.halftone_grid()

        self.resize_image(width, ratio, keep_original)
        return self.build_grid(
            options.get('charset', 'detailed'),
            colored=True,
            color_scheme=options.get('colorScheme', 'original'),
            custom_chars=options.get('customChars'),
        )

    def process_to_grid(self, path, options):
        """Complete pipeline for a file: load, process, return the Grid"""
        try:
            self.load_image(path)
            return self.process_image(options)
        except Exception as e:
            raise Exception(f"Processing error: {str(e)}") from e

    def process_bytes_to_grid(self, data, options):
        """Complete pipeline for an encoded image held in memory"""
        try:
            self.load_image_bytes(data)
            return self.process_image(options)
        except Exception as e:
            raise Exception(f"Processing error: {str(e)}") from e

    def process_and_convert(self, path, options):
        """Complete pipeline for a file, as an HTML string"""
        return self.process_to_grid(path, options).to_html()
