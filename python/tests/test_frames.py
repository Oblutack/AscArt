import base64
import io

from PIL import Image

import main as backend_main
from core.image_processor import ImageProcessor


def encoded(color=(200, 60, 60), size=(40, 40), fmt='JPEG'):
    buffer = io.BytesIO()
    Image.new('RGB', size, color).save(buffer, format=fmt)
    return base64.b64encode(buffer.getvalue()).decode('ascii')


class TestProcessor:
    def test_loads_an_image_from_bytes(self):
        processor = ImageProcessor()
        processor.load_image_bytes(base64.b64decode(encoded(size=(30, 20), fmt='PNG')))
        assert processor.image.size == (30, 20)
        assert processor.image.mode == 'RGB'

    def test_png_with_transparency_is_flattened_on_white(self):
        buffer = io.BytesIO()
        Image.new('RGBA', (10, 10), (0, 0, 0, 0)).save(buffer, format='PNG')

        processor = ImageProcessor()
        processor.load_image_bytes(buffer.getvalue())

        assert processor.image.getpixel((0, 0)) == (255, 255, 255)

    def test_same_art_as_the_same_picture_from_a_file(self, tmp_path):
        path = tmp_path / 'same.png'
        Image.new('RGB', (40, 40), (10, 200, 30)).save(path)
        options = {'width': 12}

        from_file = ImageProcessor().process_to_grid(str(path), options).to_html()
        from_bytes = ImageProcessor().process_bytes_to_grid(path.read_bytes(), options).to_html()

        assert from_bytes == from_file

    def test_a_loaded_mask_does_not_leak_between_pictures(self):
        processor = ImageProcessor()
        processor.load_image_bytes(base64.b64decode(encoded()))
        processor.alpha_mask = Image.new('L', (40, 40), 0)

        processor.load_image_bytes(base64.b64decode(encoded()))

        assert processor.alpha_mask is None


class TestBackend:
    def convert(self, data_dir, **fields):
        return backend_main.Backend().handle_convert({'options': {'width': 10}, **fields})

    def test_answers_with_art(self, data_dir):
        result = self.convert(data_dir, imageData=encoded(), requestId=3)

        assert result['status'] == 'success'
        assert result['type'] == 'ascii-result'
        assert result['ascii'].count('\n') >= 1

    def test_options_apply(self, data_dir):
        result = self.convert(
            data_dir, imageData=encoded(color=(0, 0, 0)),
            options={'width': 10, 'dither': True})
        assert set(result['ascii']) == {'█', '\n'}

    def test_frames_never_go_to_history(self, data_dir):
        backend = backend_main.Backend()
        backend.handle_convert({'imageData': encoded(), 'options': {'width': 10}})
        backend.handle_convert({'imageData': encoded(), 'options': {'width': 10}, 'saveHistory': True})
        assert backend.handle_get_history({})['history'] == []

    def test_a_path_is_not_needed(self, data_dir):
        assert 'error' not in self.convert(data_dir, imageData=encoded())

    def test_rejects_text_that_is_not_base64(self, data_dir):
        result = self.convert(data_dir, imageData='this is %% not base64')
        assert result['status'] == 'error'
        assert 'base64' in result['error']

    def test_rejects_data_that_is_not_a_picture(self, data_dir):
        result = self.convert(data_dir, imageData=base64.b64encode(b'not a picture').decode())
        assert result['status'] == 'error'
        assert 'Conversion failed' in result['error']

    def test_rejects_things_that_are_not_text(self, data_dir):
        for bad in (123, ['x'], {'a': 1}):
            assert self.convert(data_dir, imageData=bad)['status'] == 'error'

    def test_rejects_oversized_data(self, data_dir):
        too_big = 'A' * (backend_main.MAX_FRAME_BASE64_CHARS + 1)
        result = self.convert(data_dir, imageData=too_big)
        assert result['status'] == 'error'
        assert 'too large' in result['error']

    def test_the_request_id_still_comes_back(self, data_dir):
        """main() adds it; the handler must not disturb the response shape"""
        result = self.convert(data_dir, imageData=encoded())
        assert set(result) == {'status', 'type', 'ascii', 'isGif'}
