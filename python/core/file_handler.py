"""
File Handler Module
Keeps the conversion history on disk.

Layout, inside the output folder:

    history/index.json    small: id, time, options, thumbnail of every entry
    history/<id>.json     the full art (and GIF frames) of one entry

The gallery only needs the index, so opening it stays fast however many GIFs
are stored. The full art is read when an entry is actually opened.
"""

import json
import os
import re
import uuid
from datetime import datetime

MAX_HISTORY_ENTRIES = 50

# Entries migrated from the old single-file history get the first rows of
# their art as a thumbnail (whole rows, so no <span> is cut in half)
LEGACY_THUMB_ROWS = 24

LEGACY_FILE = 'history.json'
INDEX_FILE = 'index.json'

# Stored per entry in its own file; everything else lives in the index
ART_FIELDS = ('ascii', 'frames', 'delays')

_SAFE_ID = re.compile(r'^[0-9a-f]{32}$')


class FileHandler:
    def __init__(self, output_dir=None):
        # Electron passes the per-user data folder; plain 'output' is the
        # fallback when the backend is run by hand.
        self.output_dir = output_dir or os.environ.get('ASCART_DATA_DIR') or 'output'
        self.history_dir = os.path.join(self.output_dir, 'history')
        self.ensure_output_dir()
        self._migrate_legacy_history()

    def ensure_output_dir(self):
        """Create the output and history directories if they don't exist"""
        os.makedirs(self.history_dir, exist_ok=True)

    # ---- low level -------------------------------------------------------

    def _index_path(self):
        return os.path.join(self.history_dir, INDEX_FILE)

    def _entry_path(self, entry_id):
        # ids come from the UI: never let one point outside the history folder
        if not _SAFE_ID.match(str(entry_id)):
            raise ValueError(f"Invalid history id: {entry_id!r}")
        return os.path.join(self.history_dir, f'{entry_id}.json')

    @staticmethod
    def _write_json(path, data):
        """Write via a temp file so a crash can't leave half a file behind"""
        temp_path = path + '.tmp'
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        os.replace(temp_path, path)

    def _read_index(self):
        try:
            with open(self._index_path(), 'r', encoding='utf-8') as f:
                index = json.load(f)
        except (OSError, ValueError):
            return []
        return index if isinstance(index, list) else []

    def _write_index(self, index):
        self._write_json(self._index_path(), index)

    # ---- migration -------------------------------------------------------

    def _migrate_legacy_history(self):
        """Convert the old single history.json once, keeping it as a backup"""
        legacy_path = os.path.join(self.output_dir, LEGACY_FILE)
        if not os.path.exists(legacy_path) or os.path.exists(self._index_path()):
            return

        try:
            with open(legacy_path, 'r', encoding='utf-8') as f:
                entries = json.load(f)
        except (OSError, ValueError):
            return  # leave it alone rather than lose it

        index = []
        for entry in entries[-MAX_HISTORY_ENTRIES:]:
            entry_id = entry.get('id') or uuid.uuid4().hex
            art = {field: entry[field] for field in ART_FIELDS if field in entry}
            meta = {key: value for key, value in entry.items()
                    if key not in ART_FIELDS and key != 'preview'}
            meta['id'] = entry_id
            meta['thumb'] = entry.get('thumb') or legacy_thumb(entry.get('ascii', ''))

            self._write_json(self._entry_path(entry_id), art)
            index.append(meta)

        self._write_index(index)
        os.replace(legacy_path, legacy_path + '.migrated')

    # ---- public API ------------------------------------------------------

    def get_history(self):
        """The index: every entry without its full art"""
        return self._read_index()

    def get_history_entry(self, entry_id):
        """One entry including its art, or None if it doesn't exist"""
        meta = next((e for e in self._read_index() if e.get('id') == entry_id), None)
        if meta is None:
            return None

        try:
            with open(self._entry_path(entry_id), 'r', encoding='utf-8') as f:
                art = json.load(f)
        except (OSError, ValueError):
            return None

        return {**meta, **art}

    def save_history_entry(self, ascii_art, options, is_gif=False, frames=None, delays=None, thumb=None):
        """Add an entry and drop the oldest ones beyond the limit"""
        entry_id = uuid.uuid4().hex

        art = {'ascii': ascii_art}  # the whole art, or the first frame of a GIF
        if is_gif and frames and delays:
            art['frames'] = frames
            art['delays'] = delays
        self._write_json(self._entry_path(entry_id), art)

        index = self._read_index()
        index.append({
            'id': entry_id,
            'timestamp': datetime.now().isoformat(),
            'options': options,
            'isGif': is_gif,
            'thumb': thumb,
        })

        for old in index[:-MAX_HISTORY_ENTRIES]:
            self._remove_entry_file(old.get('id'))
        self._write_index(index[-MAX_HISTORY_ENTRIES:])

        return entry_id

    def delete_history_entries(self, ids):
        """Delete entries by id. Returns how many were removed."""
        ids = set(ids)
        index = self._read_index()
        kept = [entry for entry in index if entry.get('id') not in ids]
        removed = len(index) - len(kept)

        if removed:
            for entry_id in ids:
                self._remove_entry_file(entry_id)
            self._write_index(kept)

        return removed

    def _remove_entry_file(self, entry_id):
        try:
            os.remove(self._entry_path(entry_id))
        except (OSError, ValueError):
            pass


def legacy_thumb(ascii_art):
    """First rows of a piece of art, for entries that predate thumbnails"""
    return '\n'.join(ascii_art.split('\n')[:LEGACY_THUMB_ROWS])
