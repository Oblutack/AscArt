import json
import os
import queue
import subprocess
import sys
import threading
import time

import pytest
from PIL import Image

import main as backend_main
from core.cancel import Cancelled, CancelRegistry
from core.gif_processor import GifProcessor

PYTHON_DIR = os.path.join(os.path.dirname(__file__), '..')


@pytest.fixture
def gif_path(tmp_path):
    frames = [Image.new('RGB', (30, 30), (i * 40, 40, 40)) for i in range(6)]
    path = tmp_path / 'anim.gif'
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=50, loop=0)
    return str(path)


class TestRegistry:
    def test_contains_and_discard(self):
        registry = CancelRegistry()
        registry.add(3)
        assert 3 in registry
        registry.discard(3)
        assert 3 not in registry

    def test_check_raises_only_for_cancelled_ids(self):
        registry = CancelRegistry()
        registry.add(1)
        with pytest.raises(Cancelled):
            registry.check(1)
        registry.check(2)
        registry.check(None)

    def test_none_is_ignored(self):
        registry = CancelRegistry()
        registry.add(None)
        assert None not in registry

    def test_does_not_grow_without_bound(self):
        registry = CancelRegistry()
        for i in range(CancelRegistry.MAX_REMEMBERED + 10):
            registry.add(i)
        assert len(registry._ids) <= CancelRegistry.MAX_REMEMBERED


class TestGifProcessor:
    def test_stops_between_frames(self, gif_path):
        seen = []

        def checkpoint():
            if len(seen) == 2:
                raise Cancelled()

        with pytest.raises(Cancelled):
            GifProcessor().process_to_grids(
                gif_path, {'width': 10}, lambda done, total: seen.append(done), checkpoint)
        assert seen == [1, 2]

    def test_stops_while_loading(self, gif_path):
        def checkpoint():
            raise Cancelled()

        with pytest.raises(Cancelled):
            GifProcessor().process_to_grids(gif_path, {'width': 10}, None, checkpoint)


class TestBackend:
    def test_cancel_before_start_skips_the_work(self, data_dir, gif_path):
        backend = backend_main.Backend()
        backend.cancelled.add(4)

        result = backend.handle_convert({'path': gif_path, 'requestId': 4, 'options': {'width': 10}})

        assert result['type'] == 'cancelled'
        assert backend.handle_get_history({})['history'] == []

    def test_a_cancelled_id_is_forgotten_afterwards(self, data_dir, gif_path):
        backend = backend_main.Backend()
        backend.cancelled.add(4)
        backend.handle_convert({'path': gif_path, 'requestId': 4, 'options': {'width': 10}})
        assert 4 not in backend.cancelled

    def test_cancel_arrives_while_converting(self, data_dir, gif_path, monkeypatch, capsys):
        read_end, write_end = os.pipe()
        monkeypatch.setattr(sys, 'stdin', os.fdopen(read_end, 'r', encoding='utf-8'))

        backend = backend_main.Backend()

        class SlowGifProcessor:
            """Takes about two seconds unless it is cancelled"""

            def process_to_grids(self, path, options, progress=None, should_cancel=None):
                for frame in range(100):
                    should_cancel()
                    time.sleep(0.02)
                    progress(frame + 1, 100)

        backend.gif_processor = SlowGifProcessor()

        commands = queue.Queue()
        threading.Thread(
            target=backend_main.read_commands, args=(backend, commands), daemon=True).start()

        convert = {'command': 'convert', 'requestId': 1, 'path': gif_path, 'options': {}}
        os.write(write_end, (json.dumps(convert) + '\n').encode())
        data = json.loads(commands.get(timeout=5))

        outcome = []
        worker = threading.Thread(target=lambda: outcome.append(backend.handle_convert(data)))
        started = time.monotonic()
        worker.start()

        time.sleep(0.15)
        os.write(write_end, b'{"command": "cancel", "requestId": 1}\n')
        worker.join(timeout=5)

        assert not worker.is_alive()
        assert outcome[0]['type'] == 'cancelled'
        assert time.monotonic() - started < 1.5  # it did not run to the end
        os.close(write_end)

        # The cancel itself is not queued as a command
        assert commands.get(timeout=5) is None


def run_backend(lines, env_dir):
    """Send lines to a real backend process and return its JSON replies"""
    env = dict(os.environ, ASCART_DATA_DIR=str(env_dir), PYTHONIOENCODING='utf-8')
    process = subprocess.run(
        [sys.executable, 'main.py'],
        input='\n'.join(lines) + '\n',
        capture_output=True, text=True, cwd=PYTHON_DIR, env=env, timeout=60,
    )
    return [json.loads(line) for line in process.stdout.splitlines()]


def test_cancel_command_gets_no_reply_and_does_not_block(tmp_path):
    replies = run_backend([
        '{"command": "cancel", "requestId": 99}',
        '{"command": "ping", "requestId": 1}',
    ], tmp_path)

    assert [reply['type'] for reply in replies] == ['pong']
    assert replies[0]['requestId'] == 1
