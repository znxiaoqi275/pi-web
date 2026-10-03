---
name: kokoro-english
description: Provide English practice sentences with Chinese explanations and local Kokoro pronunciation buttons in Pi Web.
---

# English pronunciation with Kokoro

Pi Web supports local Kokoro speech links. Keep the English sentence and its Chinese explanation visible, then add normal and slow pronunciation links below that sentence. Speech is generated on the user's first click and cached locally; no shell command or pre-generated audio file is needed.

Use this Markdown format:

```markdown
**Could you speak a little more slowly, please?**

你能说慢一点吗？

[正常朗读](/api/tts?text=Could%20you%20speak%20a%20little%20more%20slowly%2C%20please%3F&voice=af_heart&speed=1)
[慢速跟读](/api/tts?text=Could%20you%20speak%20a%20little%20more%20slowly%2C%20please%3F&voice=af_heart&speed=0.8)
```

Encode the complete English sentence as the `text` query parameter (equivalent to `encodeURIComponent`), including punctuation. Use a literal `&` between query parameters. Keep each speech request within 500 characters; break longer passages at sentence boundaries.

Available voices: `af_heart` (default US female), `af_bella` (US female), `am_michael` (US male), `bf_emma` (UK female), `bm_george` (UK male). Use the same voice for normal and slow versions. The supported speed range is 0.5–1.5; 1 and 0.8 are useful defaults.

Use the learner's requested level and topic. These links work in Pi Web with the optional Kokoro runtime installed; do not claim a recording was generated or tested merely because you emitted a link. If playback fails, check the local Kokoro installation rather than silently replacing it with another provider.
