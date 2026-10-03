# English pronunciation in chat

Pi Web can play local audio directly in a message. Keep the sentence and its translation above ordinary Markdown audio links:

```markdown
**I am learning English.**

我正在学习英语。

[正常朗读](audio/lesson-01/sentence-01.mp3) [慢速跟读](audio/lesson-01/sentence-01-slow.mp3)
```

Each link becomes a play/pause button. Switching clips pauses the previous clip; a finished clip can be played again. Audio loads only after clicking. `![Listen](audio/clip.mp3)` also works. File links must point to real files. Remote audio links stay ordinary links.

## Local Kokoro pronunciation

Install the optional CPU runtime once with Python 3.10–3.13:

```sh
npm run setup:kokoro
```

Alternatively run `python bin/setup-kokoro.py` with the desired Python executable. This creates an isolated environment in `~/.pi/agent/tts/kokoro`, installs `kokoro-onnx==0.6.1`, and downloads the full precision English model (326 MB) and voices (28 MB). Downloads are checked against SHA-256 digests. No GPU, Docker, or API key is needed. The installer uses official PyPI; `--index-url` selects another package index. Set `PI_WEB_KOKORO_DIR` for both installation and the server to choose a different data directory.

Copy the bundled `skills/kokoro-english` folder into `~/.pi/agent/skills/`, then ask a new conversation to use `kokoro-english` for English practice. For example:

```markdown
**I am learning English.**

我正在学习英语。

[正常朗读](/api/tts?text=I%20am%20learning%20English.&voice=af_heart&speed=1)
[慢速跟读](/api/tts?text=I%20am%20learning%20English.&voice=af_heart&speed=0.8)
```

Kokoro generates the WAV on the first click; repeated playback uses a local cache. The first uncached sentence also loads the model. The CPU worker uses two inference threads, serializes generation, accepts at most eight queued requests, and exits after 60 seconds idle to release memory. The cache keeps at most 256 recordings; evicted recordings are generated again when requested. Playback errors allow retry. Older file-based clips remain playable.

Only root-relative `/api/tts` links with valid `text`, `voice`, and `speed` parameters become controls. Each request is limited to 500 characters and speed 0.5–1.5. Supported voices: `af_heart`, `af_bella`, `am_michael`, `bf_emma`, `bm_george`; the last two use British English. The endpoint generates only speech from these parameters, accepts no file path or external service URL, and uses the existing API host/origin/password checks.

## Using edge-tts

Install `aahl/skills@edge-tts` in Settings → Skills. Ask the agent to generate audio for each sentence, save it beneath the learning session's working directory, and return the relative links below the sentence and explanation. For example:

> 使用 edge-tts 帮我练英语。每次给我三句初级日常英语，附中文解释。每句生成正常速度和慢速两份美式发音，放在当前目录 audio 的新子文件夹里。把实际生成的正常朗读、慢速跟读 Markdown 音频链接放在对应句子下面。

For a TTS skill, use `en-US-JennyNeural` for American English or `en-GB-SoniaNeural` for British English; generate the slow version with `--rate=-25%`. Verify successful synthesis before emitting links. Use a new lesson folder rather than replacing previous files or using a temporary directory, so earlier lessons remain playable.

Use forward slashes in Markdown paths and wrap paths containing spaces in angle brackets. An absolute Windows path can be written as a `file:///C:/...` URL. Files still follow Pi Web's existing file-access rules, including exact file references in the current session; adding a link does not allow directory browsing.
