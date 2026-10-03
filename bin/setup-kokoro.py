"""Install the optional, local CPU speech runtime without changing system Python."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

ASSETS = {
    "kokoro-v1.0.onnx": "beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a",
    "voices-v1.0.bin": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
}


def download(directory, name, expected):
    target = directory / name
    if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == expected:
        print(f"Already installed: {name}", flush=True)
        return
    partial = directory / (name + ".download")
    print(f"Downloading {name}...", flush=True)
    url = f"https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/{name}"
    digest = hashlib.sha256()
    with urllib.request.urlopen(url, timeout=60) as response, partial.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            output.write(chunk)
    if digest.hexdigest() != expected:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Checksum mismatch: {name}")
    partial.replace(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", default=os.environ.get("PI_WEB_KOKORO_DIR"))
    parser.add_argument("--index-url", default="https://pypi.org/simple")
    args = parser.parse_args()
    directory = Path(args.dir).expanduser().resolve() if args.dir else Path.home() / ".pi/agent/tts/kokoro"
    directory.mkdir(parents=True, exist_ok=True)
    venv = directory / "venv"
    python = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.is_file():
        subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True)
    subprocess.run([str(python), "-m", "pip", "install", "--index-url", args.index_url,
                    "kokoro-onnx==0.6.1"], check=True)
    for name, checksum in ASSETS.items():
        download(directory, name, checksum)
    shutil.copyfile(Path(__file__).with_name("kokoro-worker.py"), directory / "worker.py")
    print(f"Kokoro CPU runtime installed in {directory}", flush=True)


if __name__ == "__main__":
    main()
