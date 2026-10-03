"""JSON-lines stdin/stdout worker; speech never leaves this computer."""
import contextlib
import json
from pathlib import Path
import sys
import time
import traceback
import wave

VOICES = {"af_heart", "af_bella", "am_michael", "bf_emma", "bm_george"}


def main():
    directory = Path(__file__).resolve().parent
    # Third-party startup output must not interfere with the JSON protocol.
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import onnxruntime as rt
        from kokoro_onnx import Kokoro
        options = rt.SessionOptions()
        options.intra_op_num_threads = 2
        options.inter_op_num_threads = 1
        session = rt.InferenceSession(str(directory / "kokoro-v1.0.onnx"), options,
                                      providers=["CPUExecutionProvider"])
        kokoro = Kokoro.from_session(session, str(directory / "voices-v1.0.bin"))
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        try:
            request = json.loads(line)
            text, voice, speed = request["text"], request["voice"], request["speed"]
            if (not isinstance(text, str) or not 1 <= len(text.strip()) <= 500
                    or voice not in VOICES or not 0.5 <= speed <= 1.5):
                raise ValueError("Invalid speech request")
            start = time.monotonic()
            with contextlib.redirect_stdout(sys.stderr):
                samples, sample_rate = kokoro.create(text, voice=voice, speed=speed,
                    lang="en-gb" if voice.startswith("b") else "en-us")
            pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
            target = Path(request["output"])
            partial = target.with_suffix(".partial")
            with wave.open(str(partial), "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(sample_rate)
                output.writeframes(pcm.tobytes())
            partial.replace(target)
            print(json.dumps({"ok": True, "seconds": len(samples) / sample_rate,
                              "elapsed": time.monotonic() - start}), flush=True)
        except Exception:
            traceback.print_exc(file=sys.stderr)
            print(json.dumps({"ok": False}), flush=True)


if __name__ == "__main__":
    main()
