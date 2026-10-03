// Shared, browser-safe request validation. Only local Kokoro speech links qualify.
import voiceLanguages from "../bin/kokoro-voices.json";

// The worker reads the same catalog; only voices shipped with the model qualify.
export const SPEECH_VOICES = Object.values(voiceLanguages).flat();
export type SpeechVoice = typeof SPEECH_VOICES[number];
export interface SpeechRequest { text: string; voice: SpeechVoice; speed: number }

export function parseSpeechRequest(params: URLSearchParams): SpeechRequest | null {
  for (const key of params.keys()) {
    if (!["text", "voice", "speed"].includes(key) || params.getAll(key).length !== 1) return null;
  }
  const text = params.get("text")?.trim() ?? "";
  // Script detection covers unambiguous scripts; Latin languages need an explicit voice.
  const defaultVoice = /[\u3040-\u30ff]/.test(text) ? "jf_alpha"
    : /[\u3400-\u9fff]/.test(text) ? "zf_xiaobei"
    : /[\u0900-\u097f]/.test(text) ? "hf_alpha" : "af_heart";
  const voice = params.get("voice") ?? defaultVoice;
  const speedText = params.get("speed") ?? "1";
  const speed = Number(speedText);
  if (!text || text.length > 500 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(text)
    || !SPEECH_VOICES.includes(voice as SpeechVoice)
    || !/^\d+(?:\.\d{1,3})?$/.test(speedText) || speed < 0.5 || speed > 1.5) return null;
  return { text, voice: voice as SpeechVoice, speed };
}

export function resolveSpeechHref(href?: string): string | null {
  if (!href?.startsWith("/api/tts?")) return null;
  try {
    const url = new URL(href, "http://pi-web.local");
    if (url.pathname !== "/api/tts" || url.hash) return null;
    const speech = parseSpeechRequest(url.searchParams);
    if (!speech) return null;
    return `/api/tts?${new URLSearchParams({ text: speech.text, voice: speech.voice, speed: String(speech.speed) })}`;
  } catch { return null; }
}
