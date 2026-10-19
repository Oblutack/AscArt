import pytest
from PIL import Image

from core.gif_processor import GifProcessor


@pytest.fixture
def gif_path(tmp_path):
    frames = [Image.new('RGB', (30, 30), (i * 70, 40, 40)) for i in range(4)]
    path = tmp_path / 'anim.gif'
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=[40, 50, 60, 70], loop=0)
    return str(path)


def test_converts_every_frame(gif_path):
    result = GifProcessor().process_and_convert(gif_path, {'width': 10})
    assert result['frame_count'] == 4
    assert len(result['frames']) == 4
    assert len(result['delays']) == 4


def test_reports_progress_per_frame(gif_path):
    calls = []
    GifProcessor().process_and_convert(
        gif_path, {'width': 10}, lambda done, total: calls.append((done, total)))
    assert calls == [(1, 4), (2, 4), (3, 4), (4, 4)]


def test_dither_frames_are_halftone(gif_path):
    result = GifProcessor().process_and_convert(gif_path, {'width': 10, 'dither': True})
    for frame in result['frames']:
        assert set(frame) <= {'█', ' ', '\n'}
