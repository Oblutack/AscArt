import json
import os
import subprocess
import tempfile

import pytest

import main as backend_main
from core import video
from core.cancel import Cancelled
from core.gif_processor import GifProcessor, is_animated
from core.video import find_ffmpeg, is_video, load_video_frames

needs_ffmpeg = pytest.mark.skipif(find_ffmpeg() is None, reason='ffmpeg is not installed')


def make_video(path, seconds=1, size='160x120', rate=10):
    subprocess.run(
        [find_ffmpeg(), '-v', 'error', '-y', '-f', 'lavfi',
         '-i', f'testsrc=duration={seconds}:size={size}:rate={rate}',
         '-pix_fmt', 'yuv420p', str(path)],
        check=True)
    return str(path)


@pytest.fixture
def clip(tmp_path):
    return make_video(tmp_path / 'clip.mp4')


def leftover_temp_folders():
    return [name for name in os.listdir(tempfile.gettempdir()) if name.startswith('ascart_video_')]


class TestDetection:
    @pytest.mark.parametrize('name', ['a.mp4', 'a.MOV', 'a.webm', 'a.mkv', 'a.avi', 'a.m4v'])
    def test_video_extensions(self, name):
        assert is_video(name)
        assert is_animated(name)

    def test_gifs_are_animated_but_not_videos(self):
        assert is_animated('a.GIF')
        assert not is_video('a.gif')

    @pytest.mark.parametrize('name', ['a.png', 'a.jpg', 'a.txt', 'video'])
    def test_everything_else_is_a_still(self, name):
        assert not is_animated(name)


@needs_ffmpeg
class TestLoading:
    def test_cuts_a_clip_into_frames_with_even_delays(self, clip):
        frames, delays = load_video_frames(clip)

        assert len(frames) == 10  # 1 second at 10 frames per second
        assert delays == [100] * 10
        assert all(frame.mode == 'RGB' for frame in frames)
        assert frames[0].size == (160, 120)

    def test_stops_after_the_maximum_length(self, tmp_path):
        long_clip = make_video(tmp_path / 'long.mp4', seconds=3)
        frames, _ = load_video_frames(long_clip, max_seconds=1)
        assert len(frames) == 10

    def test_shrinks_wide_videos(self, tmp_path):
        wide = make_video(tmp_path / 'wide.mp4', size='1280x720')
        frames, _ = load_video_frames(wide)
        assert frames[0].size == (video.MAX_FRAME_WIDTH, 360)

    def test_leaves_no_temp_files_behind(self, clip):
        before = leftover_temp_folders()
        load_video_frames(clip)
        assert leftover_temp_folders() == before

    def test_can_be_cancelled_and_still_cleans_up(self, clip):
        before = leftover_temp_folders()

        def checkpoint():
            raise Cancelled()

        with pytest.raises(Cancelled):
            load_video_frames(clip, should_cancel=checkpoint)
        assert leftover_temp_folders() == before

    def test_a_file_that_is_not_a_video_is_explained(self, tmp_path):
        broken = tmp_path / 'broken.mp4'
        broken.write_bytes(b'this is not a video at all')

        with pytest.raises(RuntimeError, match='could not read this video'):
            load_video_frames(str(broken))


class TestWithoutFfmpeg:
    def test_says_what_to_do(self, monkeypatch):
        monkeypatch.delenv('ASCART_FFMPEG', raising=False)
        monkeypatch.setattr(video.shutil, 'which', lambda name: None)

        with pytest.raises(RuntimeError, match='needs ffmpeg'):
            load_video_frames('anything.mp4')

    def test_an_ffmpeg_that_cannot_start_is_explained(self, monkeypatch, tmp_path):
        monkeypatch.setenv('ASCART_FFMPEG', str(tmp_path / 'no-such-ffmpeg'))

        with pytest.raises(RuntimeError, match='Could not start ffmpeg'):
            load_video_frames('anything.mp4')

    def test_ascart_ffmpeg_overrides_the_path(self, monkeypatch):
        monkeypatch.setenv('ASCART_FFMPEG', 'C:/tools/ffmpeg.exe')
        assert find_ffmpeg() == 'C:/tools/ffmpeg.exe'


@needs_ffmpeg
class TestThroughThePipeline:
    def test_a_video_is_converted_like_a_gif(self, clip):
        result = GifProcessor().process_to_grids(clip, {'width': 20})

        assert result['frame_count'] == 10
        assert result['delays'] == [100] * 10
        assert len(result['grids']) == 10
        assert result['grids'][0].cols == 20

    def test_options_apply_to_every_frame(self, clip):
        result = GifProcessor().process_to_grids(clip, {'width': 10, 'dither': True})
        assert result['grids'][0].cols == 30  # halftone renders at 3x

    def test_progress_is_reported_per_frame(self, clip):
        seen = []
        GifProcessor().process_to_grids(
            clip, {'width': 10}, lambda done, total: seen.append((done, total)))
        assert seen == [(i, 10) for i in range(1, 11)]

    def test_the_backend_answers_with_a_gif_result_and_saves_history(self, data_dir, clip, capsys):
        backend = backend_main.Backend()

        result = backend.handle_convert(
            {'path': clip, 'requestId': 4, 'options': {'width': 15}})

        assert result['type'] == 'gif-result'
        assert result['frameCount'] == 10
        assert len(result['frames']) == 10

        progress = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
        assert [message['current'] for message in progress] == list(range(1, 11))

        entry = backend.handle_get_history({})['history'][0]
        assert entry['isGif'] is True

    def test_cancelling_a_video_conversion(self, data_dir, clip):
        backend = backend_main.Backend()
        backend.cancelled.add(9)

        result = backend.handle_convert({'path': clip, 'requestId': 9, 'options': {'width': 10}})

        assert result['type'] == 'cancelled'


def test_the_backend_reports_a_missing_ffmpeg_to_the_user(data_dir, tmp_path, monkeypatch):
    monkeypatch.delenv('ASCART_FFMPEG', raising=False)
    monkeypatch.setattr(video.shutil, 'which', lambda name: None)
    fake_clip = tmp_path / 'clip.mp4'
    fake_clip.write_bytes(b'x')

    result = backend_main.Backend().handle_convert(
        {'path': str(fake_clip), 'options': {'width': 10}})

    assert result['status'] == 'error'
    assert 'needs ffmpeg' in result['error']
