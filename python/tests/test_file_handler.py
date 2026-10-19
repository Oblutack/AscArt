import json

from core.file_handler import FileHandler, MAX_HISTORY_ENTRIES


def test_uses_data_dir_from_environment(data_dir):
    handler = FileHandler()
    assert handler.output_dir == str(data_dir)
    assert data_dir.is_dir()


def test_entries_get_unique_ids(tmp_path):
    handler = FileHandler(str(tmp_path))
    handler.save_history_entry('a', {})
    handler.save_history_entry('b', {})
    ids = [entry['id'] for entry in handler.get_history()]
    assert len(set(ids)) == 2


def test_history_is_capped(tmp_path):
    handler = FileHandler(str(tmp_path))
    for i in range(MAX_HISTORY_ENTRIES + 5):
        handler.save_history_entry(str(i), {})

    history = handler.get_history()
    assert len(history) == MAX_HISTORY_ENTRIES
    assert history[0]['ascii'] == '5'  # oldest five were dropped
    assert history[-1]['ascii'] == str(MAX_HISTORY_ENTRIES + 4)


def test_delete_by_id_removes_only_those(tmp_path):
    handler = FileHandler(str(tmp_path))
    for name in 'abc':
        handler.save_history_entry(name, {})
    first, second, third = handler.get_history()

    assert handler.delete_history_entries([first['id'], third['id']]) == 2
    assert [entry['ascii'] for entry in handler.get_history()] == ['b']


def test_delete_unknown_id_changes_nothing(tmp_path):
    handler = FileHandler(str(tmp_path))
    handler.save_history_entry('a', {})
    assert handler.delete_history_entries(['missing']) == 0
    assert len(handler.get_history()) == 1


def test_old_entries_without_id_get_one(tmp_path):
    (tmp_path / 'history.json').write_text(
        json.dumps([{'timestamp': 't', 'ascii': 'old', 'options': {}}]))

    handler = FileHandler(str(tmp_path))
    entry = handler.get_history()[0]
    assert entry['id']

    # ...and the id is stable on the next read
    assert handler.get_history()[0]['id'] == entry['id']


def test_gif_entries_keep_frames(tmp_path):
    handler = FileHandler(str(tmp_path))
    handler.save_history_entry('f1', {}, is_gif=True, frames=['f1', 'f2'], delays=[50, 60])
    entry = handler.get_history()[0]
    assert entry['isGif'] and entry['frames'] == ['f1', 'f2'] and entry['delays'] == [50, 60]


def test_corrupt_history_reads_as_empty(tmp_path):
    (tmp_path / 'history.json').write_text('{not json')
    assert FileHandler(str(tmp_path)).get_history() == []
