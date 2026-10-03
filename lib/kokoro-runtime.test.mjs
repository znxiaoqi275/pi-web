import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { KokoroRuntime, SpeechUnavailable, SpeechBusy } = await jiti.import("./kokoro-runtime.ts");
const { GET } = await jiti.import("../app/api/tts/route.ts");

async function fixture(t, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "pi-web-kokoro-"));
  const worker = join(directory, "worker.mjs");
  await writeFile(worker, `
import { createInterface } from 'node:readline';
import { writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
const directory = dirname(process.argv[1]);
appendFileSync(join(directory, 'starts'), '1');
console.log(JSON.stringify({ready:true}));
for await (const line of createInterface({input:process.stdin})) {
  const request = JSON.parse(line);
  appendFileSync(join(directory, 'requests'), request.text + '\\n');
  if (request.text === 'hang') continue;
  if (request.text === 'crash') process.exit(1);
  if (request.text === 'fail') {console.log(JSON.stringify({ok:false}));continue;}
  await new Promise(resolve => setTimeout(resolve, 15));
  const data = Buffer.alloc(96); data.write('RIFF');data.write('WAVE', 8);
  writeFileSync(request.output, data);
  console.log(JSON.stringify({ok:true}));
}
`);
  const runtime = new KokoroRuntime({ directory, worker, executable: process.execPath, timeoutMs: 2000, idleMs: 5000, ...overrides });
  t.after(async () => {
    runtime.close();
    if (globalThis.__piKokoro === runtime) delete globalThis.__piKokoro;
    // Windows may still hold the worker script momentarily after kill().
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  return { directory, runtime };
}

const speech = (text = "Hello.", speed = 1) => ({ text, speed, voice: "af_heart" });

test("deduplicates concurrent speech and replays disk cache without restarting the worker", async (t) => {
  const { directory, runtime } = await fixture(t);
  const [a, b] = await Promise.all([runtime.generate(speech()), runtime.generate(speech())]);
  assert.deepEqual(a, b);
  assert.equal(await readFile(join(directory, "requests"), "utf8"), "Hello.\n");
  runtime.close();
  assert.deepEqual(await runtime.generate(speech()), a);
  assert.equal(await readFile(join(directory, "starts"), "utf8"), "1");
  await runtime.generate(speech("Hello.", 0.8));
  assert.equal(await readFile(join(directory, "starts"), "utf8"), "11");
});

test("failed synthesis, crashes and timeouts do not block later speech", async (t) => {
  const { runtime } = await fixture(t, { timeoutMs: 1000 });
  await assert.rejects(runtime.generate(speech("fail")), SpeechUnavailable);
  await assert.rejects(runtime.generate(speech("crash")), SpeechUnavailable);
  await assert.rejects(runtime.generate(speech("hang")), SpeechUnavailable);
  assert.equal((await runtime.generate(speech())).length, 96);
});

test("bounds the queue and retains FIFO processing", async (t) => {
  const { directory, runtime } = await fixture(t);
  const requests = Array.from({ length: 9 }, (_, i) => runtime.generate(speech(`Sentence ${i}`)));
  const results = await Promise.allSettled(requests);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 8);
  assert.ok(results[8].reason instanceof SpeechBusy);
  assert.equal(await readFile(join(directory, "requests"), "utf8"), Array.from({ length: 8 }, (_, i) => `Sentence ${i}\n`).join(""));
});

test("worker releases memory after idle and starts again for uncached speech", async (t) => {
  const { directory, runtime } = await fixture(t, { idleMs: 30 });
  await runtime.generate(speech());
  await new Promise(resolve => setTimeout(resolve, 80));
  await runtime.generate(speech("Another sentence."));
  assert.equal(await readFile(join(directory, "starts"), "utf8"), "11");
});

test("speech endpoint validates origin/parameters and serves playable byte ranges", async (t) => {
  const { runtime } = await fixture(t);
  globalThis.__piKokoro = runtime;
  const get = (query, headers = {}) => GET(new Request(`http://localhost/api/tts?${query}`, { headers: { host: "localhost", ...headers } }));
  assert.equal((await get("text=Hello", { "sec-fetch-site": "cross-site" })).status, 403);
  for (const query of ["text=", "text=Hello&voice=unknown", "text=Hello&speed=0", "text=Hello&output=private", "text=Hello&text=Other"]) {
    assert.equal((await get(query)).status, 400);
  }
  const full = await get("text=Hello");
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-type"), "audio/wav");
  assert.equal((await full.arrayBuffer()).byteLength, 96);
  for (const [range, expectedRange, length] of [["bytes=0-15", "bytes 0-15/96", 16], ["bytes=-10", "bytes 86-95/96", 10], ["bytes=90-", "bytes 90-95/96", 6]]) {
    const response = await get("text=Hello", { range });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), expectedRange);
    assert.equal((await response.arrayBuffer()).byteLength, length);
  }
  for (const range of ["bytes=-0", "bytes=", "bytes=999-", "bytes=10-9", "bytes=0-1,5-6"]) {
    assert.equal((await get("text=Hello", { range })).status, 416);
  }
});
