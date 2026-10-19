import os
import sys

import pytest
from PIL import Image

# Make `core` importable when pytest runs from the repo root or from python/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture
def make_image(tmp_path):
    """Write a plain-colour PNG and return its path"""
    def _make(size=(40, 40), color=(200, 60, 60), name='img.png'):
        path = tmp_path / name
        Image.new('RGB', size, color).save(path)
        return str(path)
    return _make


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    """Point the backend's history at a temporary folder"""
    folder = tmp_path / 'data'
    monkeypatch.setenv('ASCART_DATA_DIR', str(folder))
    return folder
