---
name: kokoro-speech
description: Add local Kokoro playback buttons for English, Mandarin Chinese, Japanese, Spanish, French, Hindi, Italian, and Brazilian Portuguese sentences in Pi Web.
---

# Multilingual pronunciation in Pi Web

Keep the original sentence visible and put its playback links beneath it. Add translations or teaching explanations when requested. Speech is generated when the user clicks; no audio file or shell command is required.

Choose a voice matching the sentence's language:

| Language | Suggested voice | Other voices |
| --- | --- | --- |
| American English | `af_heart` | `af_bella`, `am_michael`, `am_puck` |
| British English | `bf_emma` | `bm_george`, `bf_alice`, `bm_fable` |
| Mandarin Chinese | `zf_xiaobei` | `zf_xiaoni`, `zf_xiaoxiao`, `zf_xiaoyi`, `zm_yunjian`, `zm_yunxi`, `zm_yunxia`, `zm_yunyang` |
| Japanese | `jf_alpha` | `jf_gongitsune`, `jf_nezumi`, `jf_tebukuro`, `jm_kumo` |
| Spanish | `ef_dora` | `em_alex`, `em_santa` |
| French | `ff_siwis` | |
| Hindi | `hf_alpha` | `hf_beta`, `hm_omega`, `hm_psi` |
| Italian | `if_sara` | `im_nicola` |
| Brazilian Portuguese | `pf_dora` | `pm_alex`, `pm_santa` |

All 54 bundled v1.0 voices are available. The voice selects the pronunciation language; this does not translate text. For bilingual lessons, give each sentence or translation its own link with the appropriate voice. Do not send Chinese text using an English voice. Kokoro does not support every language; do not promise Korean, German, Arabic, or other unsupported languages.

Build links as `/api/tts?text=ENCODED_SENTENCE&voice=VOICE&speed=1`, using `encodeURIComponent` for the complete sentence including punctuation. Use literal `&` separators. Each sentence is limited to 500 characters. Speed supports 0.5–1.5; 1 and 0.8 are useful normal/slow values.

Example:

```markdown
**你好，很高兴认识你。**

[正常朗读](/api/tts?text=%E4%BD%A0%E5%A5%BD%EF%BC%8C%E5%BE%88%E9%AB%98%E5%85%B4%E8%AE%A4%E8%AF%86%E4%BD%A0%E3%80%82&voice=zf_xiaobei&speed=1)
[慢速跟读](/api/tts?text=%E4%BD%A0%E5%A5%BD%EF%BC%8C%E5%BE%88%E9%AB%98%E5%85%B4%E8%AE%A4%E8%AF%86%E4%BD%A0%E3%80%82&voice=zf_xiaobei&speed=0.8)
```

These links require Pi Web's optional Kokoro runtime. Emitting a link is not proof that synthesis succeeded. On playback failure, check the installation instead of claiming an audio file exists.
