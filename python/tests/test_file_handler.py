import json
import os

import pytest

from core.file_handler import (
    LEGACY_THUMB_ROWS,
    MAX_HISTORY_ENTRIES,
    FileHandler,
    legacy_thumb,
)


def test_uses_data_dir_from_environment(data_dir):
    handler = FileHandler()
    assert handler.output_dir == str(data_dir)
    assert (data_dir / 'history').is_dir()


def test_entries_get_unique_ids(tmp_path):
    handler = FileHandler(str(tmp_path))
    first = handler.save_history_entry('a', {})
    second = handler.save_history_entry('b', {})
    assert first != second
    assert [entry['id'] for entry in handler.get_history()] == [first, second]


class TestIndexAndEntries:
    def test_the_index_has_no_art(self, tmp_path):
        handler = FileHandler(str(tmp_path))
        handler.save_history_entry('<span>art</span>', {'width': 5}, thumb='tiny')

        entry = handler.get_history()[0]
        assert entry['thumb'] == 'tiny'
        assert entry['options'] == {'width': 5}
        assert 'ascii' not in entry and 'frames' not in entry

    def test_the_full_entry_has_the_art(self, tmp_path):
        handler = FileHandler(str(tmp_path))
        entry_id = handler.save_history_entry('<span>art</span>', {'width': 5}, thumb='tiny')

        entry = handler.get_history_entry(entry_id)
        assert entry['ascii'] == '<span>art</span>'
        assert entry['options'] == {'width': 5}
        assert entry['id'] == entry_id

    def test_gif_entries_keep_frames(self, tmp_path):
        handler = FileHandler(str(tmp_path))
        entry_id = handler.save_history_entry(
            'f1', {}, is_gif=True, frames=['f1', 'f2'], delays=[50, 60])

        entry = handler.get_history_entry(entry_id)
        assert entry['isGif'] and entry['frames'] == ['f1', 'f2'] and entry['delays'] == [50, 60]

        # ...but the list the gallery loads stays small
        assert 'frames' not in handler.get_history()[0]

    def test_unknown_id_gives_none(self, tmp_path):
        assert FileHandler(str(tmp_path)).get_history_entry('0' * 32) is None

    def test_ids_cannot_escape_the_history_folder(self, tmp_path):
        handler = FileHandler(str(tmp_path))
        handler.save_history_entry('a', {})

        # a file next to (not inside) the history folder
        decoy = tmp_path / 'secret.json'
        decoy.write_text('{"ascii": "do not read"}')

        assert handler.get_history_entry('../secret') is None
        assert handler.delete_history_entries(['../secret']) == 0
        assert decoy.exists()

    def test_the_path_helper_rejects_anything_but_a_hex_id(self, tmp_path):
        handler = FileHandler(str(tmp_path))
        for bad in ('../x', 'a/b', '', 'G' * 32, 'a' * 31):
            with pytest.raises(ValueError):
                handler._entry_path(bad)


class TestLimitsAndDeleting:
    def test_history_is_capped_and_old_files_removed(self, tmp_path):
        handler = FileHandler(str(tmp_path))
        ids = [handler.save_history_entry(str(i), {}) for i in range(MAX_HISTORY_ENTRIES + 5)]

        history = handler.get_history()
        assert len(history) == MAX_HISTORY_ENTRIES
        assert [entry['id'] for entry in history] == ids[5:]

        # the dropped entries don't leave files behind
        files = {name for name in os.listdir(handler.history_dir) if name != 'index.json'}
        assert files == {f'{entry_id}.json' for entry_id in ids[5:]}

    def test_delete_by_id_removes_only_those(self, tmp_path):
        handler = FileHandler(str(tmp_path))
        first, second, third = (handler.save_history_entry(name, {}) for name in 'abc')

        assert handler.delete_history_entries([first, third]) == 2
        assert [entry['id'] for entry in handler.get_history()] == [second]
        assert handler.get_history_entry(first) is None
        assert not os.path.exists(os.path.join(handler.history_dir, f'{first}.json'))

    def test_delete_unknown_id_changes_nothing(self, tmp_path):
        handler = FileHandler(str(tmp_path))
        handler.save_history_entry('a', {})
        assert handler.delete_history_entries(['0' * 32]) == 0
        assert len(handler.get_history()) == 1


class TestRobustness:
    def test_corrupt_index_reads_as_empty(self, tmp_path):
        handler = FileHandler(str(tmp_path))
        handler.save_history_entry('a', {})
        (tmp_path / 'history' / 'index.json').write_text('{not json')
        assert handler.get_history() == []

    def test_missing_entry_file_reads_as_none(self, tmp_path):
        handler = FileHandler(str(tmp_path))
        entry_id = handler.save_history_entry('a', {})
        os.remove(os.path.join(handler.history_dir, f'{entry_id}.json'))
        assert handler.get_history_entry(entry_id) is None

    def test_no_temp_files_left_behind(self, tmp_path):
        handler = FileHandler(str(tmp_path))
        handler.save_history_entry('a', {})
        assert not [n for n in os.listdir(handler.history_dir) if n.endswith('.tmp')]


class TestMigration:
    def write_legacy(self, tmp_path, entries):
        (tmp_path / 'history.json').write_text(json.dumps(entries), encoding='utf-8')

    def test_old_single_file_history_is_converted(self, tmp_path):
        rows = '\n'.join(f'row{i}' for i in range(40))
        self.write_legacy(tmp_path, [
            {'timestamp': 't1', 'ascii': rows, 'preview': 'broken', 'options': {'width': 9}, 'isGif': False},
            {'id': 'a' * 32, 'timestamp': 't2', 'ascii': 'f1', 'options': {}, 'isGif': True,
             'frames': ['f1', 'f2'], 'delays': [10, 20]},
        ])

        handler = FileHandler(str(tmp_path))
        history = handler.get_history()

        assert [entry['timestamp'] for entry in history] == ['t1', 't2']
        assert all(entry['id'] for entry in history)
        assert history[1]['id'] == 'a' * 32  # existing ids survive

        # thumbnails are made from the first rows, the broken 'preview' is dropped
        assert history[0]['thumb'] == legacy_thumb(rows)
        assert len(history[0]['thumb'].split('\n')) == LEGACY_THUMB_ROWS
        assert 'preview' not in history[0]
        assert 'ascii' not in history[0]

        # the art is still all there
        assert handler.get_history_entry(history[0]['id'])['ascii'] == rows
        gif = handler.get_history_entry('a' * 32)
        assert gif['frames'] == ['f1', 'f2'] and gif['delays'] == [10, 20]

    def test_the_old_file_is_kept_as_a_backup(self, tmp_path):
        self.write_legacy(tmp_path, [{'ascii': 'x', 'options': {}}])
        FileHandler(str(tmp_path))
        assert not (tmp_path / 'history.json').exists()
        assert (tmp_path / 'history.json.migrated').exists()

    def test_migration_runs_once(self, tmp_path):
        self.write_legacy(tmp_path, [{'ascii': 'x', 'options': {}}])
        FileHandler(str(tmp_path))
        # a new old-style file appearing later must not overwrite the new history
        self.write_legacy(tmp_path, [{'ascii': 'other', 'options': {}}])
        handler = FileHandler(str(tmp_path))
        assert len(handler.get_history()) == 1
        assert handler.get_history_entry(handler.get_history()[0]['id'])['ascii'] == 'x'

    def test_an_unreadable_old_file_is_left_alone(self, tmp_path):
        (tmp_path / 'history.json').write_text('{broken')
        handler = FileHandler(str(tmp_path))
        assert handler.get_history() == []
        assert (tmp_path / 'history.json').exists()

    def test_only_the_newest_entries_are_migrated(self, tmp_path):
        self.write_legacy(tmp_path, [
            {'timestamp': str(i), 'ascii': str(i), 'options': {}}
            for i in range(MAX_HISTORY_ENTRIES + 7)
        ])
        history = FileHandler(str(tmp_path)).get_history()
        assert len(history) == MAX_HISTORY_ENTRIES
        assert history[0]['timestamp'] == '7'
