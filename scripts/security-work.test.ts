import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkPool } from '../server/security/work.js';

test('expensive work has bounded active capacity and a bounded FIFO queue', async () => {
  const pool = new WorkPool(1, 2);
  const signal = new AbortController().signal;
  const release = await pool.acquire(signal);
  const order: number[] = [];
  const first = pool.acquire(signal).then(release => { order.push(1); return release; });
  const second = pool.acquire(signal).then(release => { order.push(2); return release; });
  await assert.rejects(pool.acquire(signal), { status: 503 });
  assert.deepEqual(order, []);
  release(); release(); // Repeated release cannot increase capacity.
  const finishFirst = await first;
  assert.deepEqual(order, [1]);
  finishFirst(); (await second)();
  assert.deepEqual(order, [1, 2]);
  (await pool.acquire(signal))();
});
test('disconnected waiting requests free queue capacity without starting work', async () => {
  const pool = new WorkPool(1, 1);
  const release = await pool.acquire(new AbortController().signal);
  const disconnected = new AbortController();
  const pending = pool.acquire(disconnected.signal);
  const rejected = assert.rejects(pending, { status: 408 });
  disconnected.abort(); await rejected;
  const next = pool.acquire(new AbortController().signal);
  release(); (await next)();
  await assert.rejects(pool.acquire(disconnected.signal), { status: 408 });
});
test('waiting work times out and leaves capacity usable', async () => {
  const pool = new WorkPool(1, 1, 10);
  const signal = new AbortController().signal;
  const release = await pool.acquire(signal);
  await assert.rejects(pool.acquire(signal), { status: 503 });
  const next = pool.acquire(signal);
  release(); (await next)();
});
