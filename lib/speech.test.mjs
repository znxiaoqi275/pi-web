import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);
const { resolveSpeechHref, parseSpeechRequest } = await jiti.import("./speech.ts");

test("speech links round-trip English punctuation without accepting external origins or files", () => {
  const text = "Could you say 'A & B' again, please?";
  const href = resolveSpeechHref(`/api/tts?${new URLSearchParams({ text, voice: "bf_emma", speed: "0.8" })}`);
  assert.deepEqual(parseSpeechRequest(new URL(href, "http://localhost").searchParams), { text, voice: "bf_emma", speed: 0.8 });
  for (const invalid of ["https://example.com/api/tts?text=Hello", "//example.com/api/tts?text=Hello", "/api/tts?text=Hello#file", "/api/tts?text=Hello&voice=../../file", "/api/tts?text=Hello&speed=NaN", "/api/tts?text=Hello&speed=1e0", "/api/tts?text=Hello&text=Other", "/api/tts?text=%00", `/api/tts?text=${"x".repeat(501)}`]) {
    assert.equal(resolveSpeechHref(invalid), null, invalid);
  }
});
