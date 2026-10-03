import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { SpeechRequest } from "./speech";

export class SpeechUnavailable extends Error {}
export class SpeechBusy extends Error {}

interface RuntimeOptions {
  directory: string;
  executable: string;
  worker: string;
  timeoutMs?: number;
  idleMs?: number;
}

// One worker, one inference at a time; queue and timeout bound CPU/RAM usage.
export class KokoroRuntime {
  private child: ChildProcessWithoutNullStreams | null = null;
  private waiter: { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void } | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private tail: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, Promise<Buffer>>();

  constructor(private options: RuntimeOptions) {}

  async generate(request: SpeechRequest): Promise<Buffer> {
    const key = createHash("sha256").update(JSON.stringify(["kokoro-0.6.1-fp32-v1.1", request.text, request.voice, request.speed])).digest("hex");
    const cache = join(this.options.directory, "cache");
    const output = join(cache, `${key}.wav`);
    const existing = this.pending.get(key);
    if (existing) return existing;
    if (this.pending.size >= 8) throw new SpeechBusy("Speech queue is full");
    const task = this.tail.catch(() => {}).then(async () => {
      // Check cache inside the queue so asynchronous filesystem reads cannot
      // reorder newly requested sentences or race the in-flight registration.
      try {
        const data = await readFile(output);
        if (data.length > 44 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WAVE") return data;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await mkdir(cache, { recursive: true });
      await this.ensureWorker();
      clearTimeout(this.idleTimer);
      try {
        const result = await this.exchange(() => this.child!.stdin.write(JSON.stringify({ ...request, output }) + "\n"));
        if (result.ok !== true) throw new SpeechUnavailable("Kokoro could not generate this sentence");
        const data = await readFile(output);
        if (data.length <= 44 || data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WAVE") throw new SpeechUnavailable("Invalid speech output");
        await this.trimCache(cache).catch(() => {});
        return data;
      } finally {
        this.idleTimer = setTimeout(() => this.close(), this.options.idleMs ?? 60_000);
        this.idleTimer.unref();
      }
    });
    this.pending.set(key, task);
    this.tail = task;
    try { return await task; }
    finally { this.pending.delete(key); }
  }

  private async trimCache(directory: string) {
    const names = (await readdir(directory)).filter((name) => /^[a-f0-9]{64}\.wav$/.test(name));
    if (names.length <= 256) return;
    const entries = await Promise.all(names.map(async (name) => ({ name, mtime: (await stat(join(directory, name))).mtimeMs })));
    entries.sort((a, b) => a.mtime - b.mtime);
    await Promise.all(entries.slice(0, entries.length - 256).map(({ name }) => unlink(join(directory, name))));
  }

  private async ensureWorker() {
    if (this.child) return;
    try { await Promise.all([access(this.options.executable), access(this.options.worker)]); }
    catch { throw new SpeechUnavailable("Kokoro is not installed. Run python bin/setup-kokoro.py first."); }
    const child = spawn(this.options.executable, [this.options.worker], {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1", OMP_NUM_THREADS: "2" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    child.stdin.on("error", () => this.stop(child, new SpeechUnavailable("Speech worker input failed")));
    // Drain diagnostics; do not expose local paths or the spoken text to clients.
    child.stderr.on("data", () => {});
    child.on("error", () => this.stop(child, new SpeechUnavailable("Could not start Kokoro")));
    child.on("exit", () => this.stop(child, new SpeechUnavailable("Kokoro stopped unexpectedly")));
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      if (this.child !== child) return;
      try {
        const value = JSON.parse(line);
        if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid worker response");
        this.waiter?.resolve(value);
      } catch { this.stop(child, new SpeechUnavailable("Invalid speech worker response")); }
    });
    child.on("close", () => lines.close());
    const result = await this.exchange();
    if (result.ready !== true) {
      this.close();
      throw new SpeechUnavailable("Kokoro did not initialize");
    }
  }

  private exchange(send?: () => void): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.close();
        reject(new SpeechUnavailable("Speech generation timed out"));
      }, this.options.timeoutMs ?? 60_000);
      this.waiter = {
        resolve: (value) => { clearTimeout(timer); this.waiter = null; resolve(value); },
        reject: (error) => { clearTimeout(timer); this.waiter = null; reject(error); },
      };
      try { send?.(); }
      catch { this.close(); }
    });
  }

  private stop(child: ChildProcessWithoutNullStreams, error: Error) {
    if (this.child !== child) return;
    this.child = null;
    this.waiter?.reject(error);
    child.kill();
  }

  close() {
    clearTimeout(this.idleTimer);
    if (this.child) this.stop(this.child, new SpeechUnavailable("Speech worker closed"));
  }
}

const globalRuntime = globalThis as typeof globalThis & { __piKokoro?: KokoroRuntime };
export function kokoroRuntime() {
  if (!globalRuntime.__piKokoro) {
    const directory = process.env.PI_WEB_KOKORO_DIR || join(homedir(), ".pi", "agent", "tts", "kokoro");
    globalRuntime.__piKokoro = new KokoroRuntime({
      directory,
      executable: join(directory, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"),
      worker: join(directory, "worker.py"),
    });
  }
  return globalRuntime.__piKokoro;
}
