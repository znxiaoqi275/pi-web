import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);
const { resolveSpeechHref, parseSpeechRequest, SPEECH_VOICES } = await jiti.import("./speech.ts");

test("speech links round-trip English punctuation without accepting external origins or files", () => {
  const text = "Could you say 'A & B' again, please?";
  const href = resolveSpeechHref(`/api/tts?${new URLSearchParams({ text, voice: "bf_emma", speed: "0.8" })}`);
  assert.deepEqual(parseSpeechRequest(new URL(href, "http://localhost").searchParams), { text, voice: "bf_emma", speed: 0.8 });
  for (const invalid of ["https://example.com/api/tts?text=Hello", "//example.com/api/tts?text=Hello", "/api/tts?text=Hello#file", "/api/tts?text=Hello&voice=../../file", "/api/tts?text=Hello&speed=NaN", "/api/tts?text=Hello&speed=1e0", "/api/tts?text=Hello&text=Other", "/api/tts?text=%00", `/api/tts?text=${"x".repeat(501)}`]) {
    assert.equal(resolveSpeechHref(invalid), null, invalid);
  }
});

test("accepts shipped multilingual voices and preserves each script through canonical links", () => {
  assert.equal(SPEECH_VOICES.length, 54);
  for (const [voice, text] of [["zf_xiaobei", "你好，今天一起学习吧。"], ["jf_alpha", "こんにちは。日本語を勉強しています。"], ["ef_dora", "Buenos días."], ["ff_siwis", "Bonjour, je parle français."], ["hf_alpha", "नमस्ते।"], ["if_sara", "Buongiorno."], ["pf_dora", "Olá, bom dia."], ["am_puck", "Good morning."]]) {
    const href = resolveSpeechHref(`/api/tts?${new URLSearchParams({ text, voice, speed: "0.8" })}`);
    assert.deepEqual(parseSpeechRequest(new URL(href, "http://localhost").searchParams), { text, voice, speed: 0.8 });
  }
  for (const [text, voice] of [["你好。", "zf_xiaobei"], ["こんにちは。", "jf_alpha"], ["नमस्ते।", "hf_alpha"], ["Hello.", "af_heart"]]) {
    assert.equal(parseSpeechRequest(new URLSearchParams({ text })).voice, voice);
  }
  assert.equal(resolveSpeechHref("/api/tts?text=Hello&voice=de_unknown"), null);
});
