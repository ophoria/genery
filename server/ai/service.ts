import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createInterface } from 'node:readline';
import { AI_MODELS, AIFamily, AIJob, AIResult, AISettings, AIVariant } from '../../src/types/ai.js';
import { familyFor, validateSettings } from './config.js';
import { AI_HOME, fingerprint, getAIResults, readAISettings, readJSON, saveAIResult, saveAISettings, settingsKey } from './store.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PYTHON = path.join(AI_HOME, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const RAM_REVISION = '7cb804a8609e9f4b1a50b7f31436d2df40bb9481';
export const RUNTIME_SIGNATURE = createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'requirements.txt'))).digest('hex');
function runtimeReady() {
  try { return fs.existsSync(PYTHON) && fs.readFileSync(path.join(AI_HOME, 'runtime-ready'), 'utf8') === RUNTIME_SIGNATURE; } catch { return false; }
}
function modelReady(variant: AIVariant) {
  const manifest = readJSON<{ path?: string }>(path.join(AI_HOME, 'models', `${variant}.json`), {});
  return runtimeReady() && Boolean(manifest.path && fs.existsSync(manifest.path));
}
let job: AIJob | null = null;
let activeChild: ChildProcessWithoutNullStreams | null = null;
let cancelling = false;

function update(message?: string) {
  if (!job) return;
  job.updatedAt = new Date().toISOString();
  if (message) job.message = message;
}
export function aiStatus() {
  return {
    models: (Object.keys(AI_MODELS) as AIVariant[]).map(variant => ({ variant, installed: modelReady(variant) })),
    job, settings: readAISettings(),
  };
}
function begin(kind: AIJob['kind'], variant: AIVariant, total: number) {
  if (job?.state === 'running') throw new Error('An AI task is already running. Cancel it or wait for it to finish.');
  cancelling = false;
  const now = new Date().toISOString();
  job = { id: randomUUID(), kind, variant, state: 'running', total, completed: 0, skipped: 0, failed: 0, errors: [], message: kind === 'install' ? 'Preparing local runtime…' : 'Preparing analysis…', startedAt: now, updatedAt: now };
  return { ...job };
}
function finish(error?: unknown) {
  if (!job) return;
  job.state = cancelling ? 'cancelled' : error ? 'failed' : 'completed';
  if (error && !cancelling) job.errors.push(error instanceof Error ? error.message : String(error));
  update(cancelling ? 'Cancelled. Finished results have been saved.' : error ? job.errors.at(-1) : job.kind === 'install' ? 'Model installed and checked. Ready for local analysis.' : `Finished: ${job.completed} analyzed, ${job.skipped} cached, ${job.failed} failed.`);
  activeChild = null;
}
export function cancelAIJob(id: string) {
  if (!job || job.id !== id || job.state !== 'running') throw new Error('This task is no longer running.');
  cancelling = true;
  update('Cancelling…');
  activeChild?.kill('SIGTERM');
  return job;
}
function checkCancelled() { if (cancelling) throw new Error('Cancelled'); }

function command(executable: string, args: string[], message: string) {
  checkCancelled();
  update(message);
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { stdio: 'pipe', env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' } });
    activeChild = child;
    let tail = '';
    child.stdout.on('data', data => { tail = (tail + data).slice(-2000); });
    child.stderr.on('data', data => { tail = (tail + data).slice(-2000); });
    child.on('error', reject);
    child.on('close', code => {
      activeChild = null;
      if (code === 0 && !cancelling) resolve();
      else reject(new Error(cancelling ? 'Cancelled' : `${message} failed. ${tail.trim() || 'Check that Python 3.10+ and git are available.'}`));
    });
  });
}

type WorkerEvent = { type: string; id?: string; error?: string; message?: string; tags?: AIResult['tags']; durationMs?: number; device?: string };
class Worker {
  child: ChildProcessWithoutNullStreams;
  ready: Promise<WorkerEvent>;
  closed: Promise<void>;
  private waiters = new Map<string, { resolve: (event: WorkerEvent) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private tail = '';
  private exited = false;
  constructor(variant: AIVariant, settings: AISettings, prepare = false) {
    checkCancelled();
    this.child = spawn(PYTHON, ['-u', path.join(ROOT, 'worker.py'), prepare ? '--prepare' : '--serve', variant], {
      stdio: 'pipe', env: { ...process.env, GENERY_AI_HOME: AI_HOME, PYTORCH_ENABLE_MPS_FALLBACK: '1', TOKENIZERS_PARALLELISM: 'false', HF_HUB_OFFLINE: prepare ? '0' : '1', TRANSFORMERS_OFFLINE: prepare ? '0' : '1' },
    });
    activeChild = this.child;
    this.ready = this.wait('ready', prepare ? 60 * 60_000 : 5 * 60_000);
    this.closed = new Promise(resolve => this.child.once('close', () => resolve()));
    this.child.stderr.on('data', data => { this.tail = (this.tail + data).slice(-1800); });
    this.child.on('error', error => this.fail(error));
    this.child.on('close', code => {
      this.exited = true;
      if (this.waiters.size) this.fail(new Error(cancelling ? 'Cancelled' : `Local model stopped (${code}). ${this.tail}`));
    });
    const lines = createInterface({ input: this.child.stdout });
    lines.on('line', line => {
      if (!line.startsWith('@@GENERY@@')) return;
      try {
        const event = JSON.parse(line.slice(10)) as WorkerEvent;
        if (event.type === 'progress') update(event.message);
        else if (event.type === 'fatal') this.fail(new Error(event.error || 'Model failed to load.'));
        else {
          const key = event.id || 'ready';
          const waiter = this.waiters.get(key);
          if (!waiter) return;
          clearTimeout(waiter.timer);
          this.waiters.delete(key);
          event.type === 'error' ? waiter.reject(new Error(event.error || 'Analysis failed.')) : waiter.resolve(event);
        }
      } catch (error) { this.fail(new Error('Invalid response from the local model.')); }
    });
    this.child.stdin.on('error', () => { /* close/error handler rejects outstanding requests */ });
    this.child.stdin.write(`${JSON.stringify(settings)}\n`);
  }
  private wait(id: string, timeout: number) {
    return new Promise<WorkerEvent>((resolve, reject) => {
      if (this.exited) return reject(new Error('Local model is no longer running.'));
      const timer = setTimeout(() => { this.waiters.delete(id); this.child.kill(); reject(new Error('The local model timed out. Retry or select CPU.')); }, timeout);
      this.waiters.set(id, { resolve, reject, timer });
    });
  }
  private fail(error: Error) {
    for (const waiter of this.waiters.values()) { clearTimeout(waiter.timer); waiter.reject(error); }
    this.waiters.clear();
    this.child.kill();
  }
  infer(file: string) {
    checkCancelled();
    const id = randomUUID();
    const result = this.wait(id, 5 * 60_000);
    this.child.stdin.write(`${JSON.stringify({ id, path: file })}\n`);
    return result;
  }
  async stop() {
    this.child.stdin.end();
    if (!this.exited) this.child.kill();
    await this.closed;
    if (activeChild === this.child) activeChild = null;
  }
}

export function installAIModel(variant: AIVariant, authorized: () => void = () => {}) {
  familyFor(variant);
  authorized();
  const started = begin('install', variant, 1);
  void (async () => {
    let worker: Worker | undefined;
    let failure: unknown;
    let authorizationFailure: unknown;
    // Installation may spend minutes in pip/model preparation. Stop its child
    // when the originating session expires, is revoked, or loses write access.
    const monitor = setInterval(() => {
      try { authorized(); }
      catch (error) { authorizationFailure = error; activeChild?.kill('SIGTERM'); }
    }, 250);
    const checkAccess = () => { if (authorizationFailure) throw authorizationFailure; authorized(); checkCancelled(); };
    try {
      checkAccess();
      fs.mkdirSync(AI_HOME, { recursive: true });
      if (!fs.existsSync(PYTHON)) await command(process.env.GENERY_AI_PYTHON || 'python3', ['-m', 'venv', path.join(AI_HOME, 'venv')], 'Creating isolated Python environment…');
      checkAccess();
      if (!runtimeReady()) {
        await command(PYTHON, ['-m', 'pip', 'install', '-r', path.join(ROOT, 'requirements.txt')], 'Installing local inference libraries…');
        checkAccess();
        fs.writeFileSync(path.join(AI_HOME, 'runtime-ready'), RUNTIME_SIGNATURE);
      }
      if (familyFor(variant) === 'ram') {
        const source = path.join(AI_HOME, 'ram-source');
        if (!fs.existsSync(path.join(source, '.git'))) await command('git', ['clone', '--no-checkout', 'https://github.com/xinyu1205/recognize-anything.git', source], 'Downloading RAM implementation…');
        await command('git', ['-C', source, 'checkout', '--detach', RAM_REVISION], 'Preparing pinned RAM implementation…');
      }
      checkAccess();
      const settings = { ...readAISettings()[familyFor(variant)], variant, device: 'cpu' as const };
      worker = new Worker(variant, settings, true);
      await worker.ready;
      await worker.closed;
      checkAccess();
      job!.completed = 1;
    } catch (error) { failure = authorizationFailure || error; }
    finally {
      clearInterval(monitor);
      if (worker) await worker.stop();
      finish(failure);
    }
  })();
  return started;
}

export function analyzeImages(paths: unknown, inputSettings: unknown, force = false, permitted: (file: string) => void = () => {}, persistSettings = true) {
  const settings = validateSettings(inputSettings);
  if (!Array.isArray(paths) || !paths.length || paths.length > 5000 || paths.some(p => typeof p !== 'string')) throw new Error('Choose between 1 and 5000 images.');
  const files = [...new Set((paths as string[]).map(file => path.resolve(file)))];
  const installed = aiStatus().models.find(m => m.variant === settings.variant)?.installed;
  if (!installed) throw new Error('Install this model in AI settings before starting analysis.');
  if (job?.state === 'running') throw new Error('An AI task is already running. Cancel it or wait for it to finish.');
  if (persistSettings) saveAISettings(familyFor(settings.variant), settings);
  const started = begin('analyze', settings.variant, files.length);
  void (async () => {
    let worker: Worker | undefined;
    let failure: unknown;
    let scratch: string | undefined;
    try {
      const key = settingsKey(settings);
      const family = familyFor(settings.variant);
      for (const file of files) {
        checkCancelled();
        update(`Analyzing ${path.basename(file)}…`);
        try {
          permitted(file);
          const version = fingerprint(file);
          const existing = getAIResults(file)[family];
          if (!force && existing?.variant === settings.variant && existing.settingsKey === key) {
            job!.skipped++;
            update();
            continue;
          }
          if (!worker) { worker = new Worker(settings.variant, settings); await worker.ready; }
          let inferenceFile = file;
          if (path.extname(file).toLowerCase() === '.svg') {
            if (!scratch) scratch = fs.mkdtempSync(path.join(AI_HOME, 'raster-'));
            inferenceFile = path.join(scratch, 'image.png');
            await sharp(file).resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).png().toFile(inferenceFile);
            checkCancelled();
          }
          permitted(file);
          const result = await worker.infer(inferenceFile);
          checkCancelled();
          permitted(file);
          if (fingerprint(file) !== version) throw new Error('The image changed during analysis. Retry this image.');
          saveAIResult(file, { family, variant: settings.variant, fingerprint: version, settingsKey: key, analyzedAt: new Date().toISOString(), tags: result.tags || [], device: result.device || 'cpu', durationMs: result.durationMs || 0 });
          job!.completed++;
        } catch (error) {
          checkCancelled();
          job!.failed++;
          if (job!.errors.length < 50) job!.errors.push(`${path.basename(file)}: ${error instanceof Error ? error.message : String(error)}`);
          if (worker && !worker.child.exitCode && !worker.child.killed) { /* keep the loaded model after an image decode error */ }
          else if (worker) throw error;
        }
        update();
      }
      if (job!.failed === files.length) throw new Error('No images could be analyzed. See the task errors and retry.');
    } catch (error) { failure = error; }
    finally {
      if (worker) await worker.stop();
      if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
      finish(failure);
    }
  })();
  return started;
}

export function shutdownAI() { activeChild?.kill('SIGTERM'); }
process.once('exit', shutdownAI);
process.once('SIGTERM', () => { shutdownAI(); process.exit(0); });
process.once('SIGINT', () => { shutdownAI(); process.exit(0); });
