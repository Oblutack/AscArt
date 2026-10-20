# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, copy_metadata

datas = []
binaries = []
hiddenimports = []
tmp_ret = collect_all('rembg')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('onnxruntime')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
# pymatting (used by rembg) reads its own version from the package metadata
tmp_ret = collect_all('pymatting')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
datas += copy_metadata('pymatting')


a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # ML Frameworks (biggest savings - torch not needed at runtime)
        'torch', 'torch.nn', 'torch.optim', 'torch.cuda', 'torch.distributed',
        'torchvision', 'torchvision.models', 'torchvision.transforms',
        'torchaudio',
        'kornia',
        'transformers', 'transformers.models',
        'tokenizers',
        'huggingface_hub',
        'safetensors',
        
        # GUI Frameworks (never used)
        'PyQt6', 'PyQt6.QtCore', 'PyQt6.QtGui', 'PyQt6.QtWidgets',
        'tkinter',
        'wx',
        
        # Data Science (not needed)
        'pandas',
        'matplotlib', 'matplotlib.pyplot',
        
        # Web Frameworks (not needed)
        'fastapi',
        'uvicorn',
        'starlette',
        'httpx',
        'aiohttp',
        'discord',
        
        # Dev Tools
        'IPython',
        'jupyter',
        'pytest',
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='engine',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
