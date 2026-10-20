"""
File Handler Module
Keeps the conversion history on disk
"""

import os
import json
import uuid
from datetime import datetime

MAX_HISTORY_ENTRIES = 50


class FileHandler:
    def __init__(self, output_dir=None):
        # Electron passes the per-user data folder; plain 'output' is the
        # fallback when the backend is run by hand.
        self.output_dir = output_dir or os.environ.get('ASCART_DATA_DIR') or 'output'
        self.ensure_output_dir()

    def ensure_output_dir(self):
        """Create output directory if it doesn't exist"""
        os.makedirs(self.output_dir, exist_ok=True)

    def _history_path(self, history_file):
        return os.path.join(self.output_dir, history_file)

    def _write_history(self, history, history_file):
        with open(self._history_path(history_file), 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2)

    def get_history(self, history_file='history.json'):
        """Load the history, giving older entries an id on the way"""
        history_path = self._history_path(history_file)
        if not os.path.exists(history_path):
            return []

        try:
            with open(history_path, 'r', encoding='utf-8') as f:
                history = json.load(f)
        except (OSError, ValueError):
            return []

        needs_ids = False
        for entry in history:
            if 'id' not in entry:
                entry['id'] = uuid.uuid4().hex
                needs_ids = True
        if needs_ids:
            self._write_history(history, history_file)

        return history

    def save_history_entry(self, ascii_art, options, history_file='history.json', is_gif=False, frames=None, delays=None, thumb=None):
        """Save entry to history"""
        history = self.get_history(history_file)

        entry = {
            'id': uuid.uuid4().hex,
            'timestamp': datetime.now().isoformat(),
            'ascii': ascii_art,  # Full ASCII art (or first frame for GIFs)
            'thumb': thumb,  # Small version for the gallery grid
            'options': options,
            'isGif': is_gif
        }

        if is_gif and frames and delays:
            entry['frames'] = frames
            entry['delays'] = delays

        history.append(entry)
        history = history[-MAX_HISTORY_ENTRIES:]

        self._write_history(history, history_file)
        return self._history_path(history_file)

    def delete_history_entries(self, ids, history_file='history.json'):
        """Delete entries by id. Returns how many were removed."""
        ids = set(ids)
        history = self.get_history(history_file)
        kept = [entry for entry in history if entry['id'] not in ids]
        removed = len(history) - len(kept)

        if removed:
            self._write_history(kept, history_file)

        return removed
