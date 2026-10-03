// Shared, browser-safe request validation. Only local Kokoro speech links qualify.
export const SPEECH_VOICES = ["af_heart", "af_bella", "am_michael", "bf_emma", "bm_george"] as const;
export type SpeechVoice = typeof SPEECH_VOICES[number];
export interface SpeechRequest { text: string; voice: SpeechVoice; speed: number }

export function parseSpeechRequest(params: URLSearchParams): SpeechRequest | null {
  for (const key of params.keys()) {
    if (!["text", "voice", "speed"].includes(key) || params.getAll(key).length !== 1) return null;
  }
  const text = params.get("text")?.trim() ?? "";
  const voice = params.get("voice") ?? "af_heart";
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
