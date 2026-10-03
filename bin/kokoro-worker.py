"""JSON-lines stdin/stdout worker; speech never leaves this computer."""
import contextlib
import json
from pathlib import Path
import re
import sys
import time
import traceback
import wave

VOICE_LANGUAGES = {
    voice: language
    for language, voices in json.loads(Path(__file__).with_name("kokoro-voices.json").read_text()).items()
    for voice in voices
}


def phonemize(text, language, kokoro, converters):
    if language == "cmn":
        if language not in converters:
            from misaki.zh import ZHG2P
            converters[language] = ZHG2P()
        # The v1.0 Chinese G2P returns IPA directly; Latin words need English IPA.
        parts = re.split(r"([A-Za-z]+(?:[ '\-][A-Za-z]+)*)", text)
        phonemes = "".join(kokoro.tokenizer.phonemize(part, lang="en-us") if i % 2
                           else converters[language](part) for i, part in enumerate(parts) if part)
        return phonemes.translate(str.maketrans({"，": ",", "。": ".", "！": "!", "？": "?", "；": ";", "：": ":", "、": ","}))
    if language == "ja":
        if language not in converters:
            from misaki.ja import JAG2P
            converters[language] = JAG2P()
        return converters[language](text)
    return kokoro.tokenizer.phonemize(text, lang=language)


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
        if not set(VOICE_LANGUAGES).issubset(kokoro.voices.files):
            raise ValueError("Voice catalog does not match installed voices")
    converters = {}
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        try:
            request = json.loads(line)
            text, voice, speed = request["text"], request["voice"], request["speed"]
            if (not isinstance(text, str) or not 1 <= len(text.strip()) <= 500
                    or voice not in VOICE_LANGUAGES or not 0.5 <= speed <= 1.5):
                raise ValueError("Invalid speech request")
            start = time.monotonic()
            with contextlib.redirect_stdout(sys.stderr):
                language = VOICE_LANGUAGES[voice]
                phonemes = phonemize(text, language, kokoro, converters)
                if not phonemes.strip():
                    raise ValueError("No pronounceable text")
                samples, sample_rate = kokoro.create(phonemes, voice=voice, speed=speed,
                                                    lang=language, is_phonemes=True)
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
