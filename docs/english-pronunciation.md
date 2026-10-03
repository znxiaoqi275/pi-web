# English pronunciation in chat

Pi Web can play local audio directly in a message. Keep the sentence and its translation above ordinary Markdown audio links:

```markdown
**I am learning English.**

我正在学习英语。

[正常朗读](audio/lesson-01/sentence-01.mp3) [慢速跟读](audio/lesson-01/sentence-01-slow.mp3)
```

Each link becomes a play/pause button. Switching clips pauses the previous clip; a finished clip can be played again. Audio loads only after clicking. `![Listen](audio/clip.mp3)` also works. Links must point to real files; this UI does not generate speech itself. Remote audio links stay ordinary links.

## Using edge-tts

Install `aahl/skills@edge-tts` in Settings → Skills. Ask the agent to generate audio for each sentence, save it beneath the learning session's working directory, and return the relative links below the sentence and explanation. For example:

> 使用 edge-tts 帮我练英语。每次给我三句初级日常英语，附中文解释。每句生成正常速度和慢速两份美式发音，放在当前目录 audio 的新子文件夹里。把实际生成的正常朗读、慢速跟读 Markdown 音频链接放在对应句子下面。

For a TTS skill, use `en-US-JennyNeural` for American English or `en-GB-SoniaNeural` for British English; generate the slow version with `--rate=-25%`. Verify successful synthesis before emitting links. Use a new lesson folder rather than replacing previous files or using a temporary directory, so earlier lessons remain playable.

Use forward slashes in Markdown paths and wrap paths containing spaces in angle brackets. An absolute Windows path can be written as a `file:///C:/...` URL. Files still follow Pi Web's existing file-access rules, including exact file references in the current session; adding a link does not allow directory browsing.
