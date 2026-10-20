// Freezes the Python backend into python/dist/engine(.exe) with PyInstaller.
// Uses the same interpreter the dev app does: ASCART_PYTHON, then python/venv,
// then whatever is on PATH. Build from a clean venv with requirements.txt
// installed: a global Python with other versions of onnxruntime/scipy/opencv
// can produce an engine whose background removal is broken.
const { existsSync } = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const pythonDir = path.join(__dirname, "..", "python");
const isWindows = process.platform === "win32";

function findPython() {
  if (process.env.ASCART_PYTHON) return process.env.ASCART_PYTHON;

  const venvPython = isWindows
    ? path.join(pythonDir, "venv", "Scripts", "python.exe")
    : path.join(pythonDir, "venv", "bin", "python");
  if (existsSync(venvPython)) return venvPython;

  return isWindows ? "python" : "python3";
}

const python = findPython();
console.log(`Building the engine with ${python}`);

const result = spawnSync(
  python,
  ["-m", "PyInstaller", "engine.spec", "--clean", "--noconfirm"],
  { cwd: pythonDir, stdio: "inherit" },
);

if (result.error) {
  console.error(`Could not run ${python}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
