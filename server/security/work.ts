import type { RequestHandler } from 'express';
import { AccessError } from './paths.js';

// Bound active filesystem/decoder work and waiting requests independently.
// Queued browser thumbnails wait for capacity; overload fails without allocating
// image descriptors or decoded buffers. Abandoned requests leave the queue.
export class WorkPool {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private capacity: number, private queueLimit: number, private waitMs = 20_000) {}
  acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) return Promise.reject(new AccessError('Request ended.', 408));
    if (this.active < this.capacity) {
      this.active++;
      return Promise.resolve(this.release());
    }
    if (this.waiting.length >= this.queueLimit) return Promise.reject(new AccessError('Server is busy. Try again shortly.', 503));
    return new Promise((resolve, reject) => {
      const remove = () => {
        const index = this.waiting.indexOf(start);
        if (index >= 0) this.waiting.splice(index, 1);
        clearTimeout(timer); signal.removeEventListener('abort', abort);
      };
      const abort = () => { remove(); reject(new AccessError('Request ended.', 408)); };
      const start = () => { remove(); this.active++; resolve(this.release()); };
      const timer = setTimeout(() => { remove(); reject(new AccessError('Server is busy. Try again shortly.', 503)); }, this.waitMs);
      this.waiting.push(start); signal.addEventListener('abort', abort, { once: true });
    });
  }
  private release() {
    let done = false;
    return () => {
      if (done) return;
      done = true; this.active--;
      this.waiting.shift()?.();
    };
  }
}

export function limited(pool: WorkPool, handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    const controller = new AbortController();
    const stop = () => controller.abort();
    res.once('close', stop);
    let release: (() => void) | undefined;
    try {
      release = await pool.acquire(controller.signal);
      const currentUser = req.access.currentUser;
      req.access.currentUser = () => {
        if (controller.signal.aborted) throw new AccessError('Request ended.', 408);
        return currentUser();
      };
      req.access.user = req.access.currentUser();
      await handler(req, res, next);
    } catch (error) {
      if (!res.destroyed) {
        if (error instanceof AccessError && error.status === 503) res.setHeader('Retry-After', '1');
        next(error);
      }
    } finally { release?.(); res.off('close', stop); }
  };
}
