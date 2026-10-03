import { kokoroRuntime, SpeechBusy } from "@/lib/kokoro-runtime";
import { isApiRequestAllowed } from "@/lib/request-security";
import { parseSpeechRequest } from "@/lib/speech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return Response.json({ error: "Untrusted API request" }, { status: 403 });
  const speech = parseSpeechRequest(new URL(request.url).searchParams);
  if (!speech) return Response.json({ error: "Invalid speech text, voice or speed" }, { status: 400 });
  try {
    const data = await kokoroRuntime().generate(speech);
    const headers = new Headers({
      "Content-Type": "audio/wav", "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff",
    });
    let start = 0, end = data.length - 1;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, data.length - Number(match[2]));
        end = match[1] && match[2] ? Math.min(end, Number(match[2])) : end;
      }
      if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
        || start > end || start >= data.length) {
        headers.set("Content-Range", `bytes */${data.length}`);
        return new Response(null, { status: 416, headers });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${data.length}`);
    }
    const body = new Uint8Array(data.subarray(start, end + 1));
    headers.set("Content-Length", String(body.length));
    return new Response(body, { status: range ? 206 : 200, headers });
  } catch (error) {
    return Response.json({ error: error instanceof SpeechBusy ? "Speech queue is busy. Try again shortly." : "Kokoro is unavailable. Check the local speech installation." },
      { status: error instanceof SpeechBusy ? 429 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
