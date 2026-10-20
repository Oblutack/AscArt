import json

from PIL import Image

import main as backend_main


def test_ping(data_dir):
    assert backend_main.Backend().handle_ping({})['type'] == 'pong'


def test_convert_requires_a_path(data_dir):
    response = backend_main.Backend().handle_convert({})
    assert response['status'] == 'error'


def test_convert_reports_missing_file(data_dir, tmp_path):
    response = backend_main.Backend().handle_convert({'path': str(tmp_path / 'nope.png')})
    assert response['status'] == 'error' and 'not found' in response['error'].lower()


def test_convert_image_and_history_round_trip(data_dir, make_image):
    backend = backend_main.Backend()
    result = backend.handle_convert({'path': make_image(), 'options': {'width': 10}})
    assert result['type'] == 'ascii-result' and result['ascii']

    history = backend.handle_get_history({})
    assert history['type'] == 'history' and len(history['history']) == 1

    entry_id = history['history'][0]['id']
    deleted = backend.handle_delete_history({'ids': [entry_id]})
    assert deleted['type'] == 'deleted' and deleted['removed'] == 1
    assert backend.handle_get_history({})['history'] == []


def test_delete_needs_ids(data_dir):
    assert backend_main.Backend().handle_delete_history({})['status'] == 'error'


def test_gif_convert_streams_progress(data_dir, tmp_path, capsys):
    frames = [Image.new('RGB', (20, 20), (i * 90, 0, 0)) for i in range(3)]
    path = tmp_path / 'a.gif'
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=50, loop=0)

    result = backend_main.Backend().handle_convert(
        {'path': str(path), 'requestId': 7, 'options': {'width': 10}})

    assert result['type'] == 'gif-result' and result['frameCount'] == 3
    lines = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert [m['current'] for m in lines] == [1, 2, 3]
    assert all(m['type'] == 'progress' and m['requestId'] == 7 for m in lines)


def test_history_entries_get_a_small_thumbnail(data_dir, make_image):
    backend = backend_main.Backend()
    backend.handle_convert({'path': make_image(size=(400, 200)), 'options': {'width': 200}})

    entry = backend.handle_get_history({})['history'][0]
    assert entry['thumb']
    assert len(entry['thumb'].split('\n')) <= backend_main.THUMB_ROWS
    assert len(entry['ascii'].split('\n')) > len(entry['thumb'].split('\n'))


def test_live_previews_stay_out_of_history(data_dir, make_image):
    backend = backend_main.Backend()
    result = backend.handle_convert(
        {'path': make_image(), 'options': {'width': 10}, 'saveHistory': False})

    assert result['type'] == 'ascii-result'
    assert backend.handle_get_history({})['history'] == []
