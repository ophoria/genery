import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_AI_SETTINGS } from '../src/types/ai.js';
import { filterImages, evaluateSingleRule } from '../src/utils/filterEngine.js';
import type { ImageItem } from '../src/types/gallery.js';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'genery-ai-test-'));
process.env.GENERY_AI_HOME = home;
const { validateSettings } = await import('../server/ai/config.js');
const store = await import('../server/ai/store.js');
const service = await import('../server/ai/service.js');
after(() => { service.shutdownAI(); fs.rmSync(home, { recursive: true, force: true }); });
const settings = structuredClone(DEFAULT_AI_SETTINGS.wd);

test('invalid settings are rejected before creating any job', () => {
  assert.throws(() => validateSettings({ ...settings, threshold: -0.1 }), /Threshold/);
  assert.throws(() => validateSettings({ ...settings, maxTags: 0 }), /Maximum/);
  assert.throws(() => validateSettings({ ...settings, device: 'mps' }), /device/);
  assert.throws(() => validateSettings({ ...settings, variant: '__proto__' }), /supported/);
  assert.throws(() => validateSettings({ ...DEFAULT_AI_SETTINGS.siglip, siglipLabels: [] }), /labels/);
  assert.throws(() => validateSettings({ ...DEFAULT_AI_SETTINGS.siglip, siglipTemplate: '{} {}' }), /placeholder/);
  const row = DEFAULT_AI_SETTINGS.siglip.siglipLabels[0];
  assert.throws(() => validateSettings({ ...DEFAULT_AI_SETTINGS.siglip, siglipLabels: [row, row] }), /unique/);
  assert.throws(() => service.analyzeImages([], settings), /Choose/);
});

test('results are invalidated when source images change and retained when copied', () => {
  const file = path.join(home, 'source.png');
  fs.writeFileSync(file, 'original');
  store.saveAIResult(file, { family: 'wd', variant: 'wd-swinv2', fingerprint: store.fingerprint(file), settingsKey: 'a', analyzedAt: new Date().toISOString(), device: 'cpu', tags: [], durationMs: 1 });
  const target = path.join(home, 'copy.png');
  fs.copyFileSync(file, target);
  store.copyAIResults(file, target);
  assert.ok(store.getAIResults(target).wd);
  fs.writeFileSync(file, 'changed image');
  assert.deepEqual(store.getAIResults(file), {});
  store.deleteAIResult(target, 'wd');
  assert.deepEqual(store.getAIResults(target), {});
});

test('AI suggestions are searchable and independently filterable', () => {
  const image = { name: 'image.png', hashtags: [], comment: '', extension: 'png', aspectRatio: 1, score: 0, ai: { siglip: { variant: 'siglip-base', tags: [{ label: 'pixel art', group: 'style', score: .8 }] } } } as unknown as ImageItem;
  const filters = { directoryPath: '', includeSubdirs: true, selectedTypes: [], aspectRatio: 'any' as const, hashtags: [], hashtagOperator: 'AND' as const, searchQuery: 'pixel' };
  assert.equal(filterImages([image], filters).length, 1);
  assert.equal(filterImages([image], { ...filters, hashtags: ['pixel art'] }).length, 0);
  assert.equal(evaluateSingleRule(image, { id: 'a', field: 'aiTag', operator: 'equals', value: 'pixel art' }), true);
  assert.equal(evaluateSingleRule(image, { id: 'a', field: 'aiGroup', operator: 'equals', value: 'style' }), true);
  assert.equal(evaluateSingleRule(image, { id: 'a', field: 'aiModel', operator: 'in', value: 'ram-plus,siglip-base' }), true);
});

test('queue saves partial successes, skips cache, reanalyzes changed settings and cancels', async () => {
  // Exercise the process protocol without downloading weights; real model checks use ai:smoke.
  const bin = path.join(home, 'venv', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const fakePython = path.join(bin, 'python');
  fs.writeFileSync(fakePython, `#!${process.execPath}
const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin });
let settings;
const send = value => console.log('@@GENERY@@' + JSON.stringify(value));
rl.on('line', line => {
 const message = JSON.parse(line);
 if (!settings) { settings = message; send({ type: 'ready', device: 'cpu' }); return; }
 setTimeout(() => send(message.path.includes('bad') ? { type: 'error', id: message.id, error: 'Cannot decode image' } : { type: 'result', id: message.id, device: 'cpu', durationMs: 1, tags: [{ label: 'forest', group: 'general', score: .8 }] }), message.path.includes('slow') ? 1000 : 20);
});
`, { mode: 0o755 });
  fs.writeFileSync(path.join(home, 'runtime-ready'), service.RUNTIME_SIGNATURE);
  fs.mkdirSync(path.join(home, 'models'));
  fs.writeFileSync(path.join(home, 'models', 'wd-swinv2.json'), JSON.stringify({ path: home }));
  const good = path.join(home, 'good.png');
  const bad = path.join(home, 'bad.png');
  const slow = path.join(home, 'slow.png');
  for (const file of [good, bad, slow]) fs.writeFileSync(file, 'image');
  async function settle() {
    const deadline = Date.now() + 5000;
    while (service.aiStatus().job?.state === 'running') {
      if (Date.now() > deadline) throw new Error('Task did not settle');
      await delay(20);
    }
    // The state settles before the worker's final cleanup.
    await delay(40);
    return service.aiStatus().job!;
  }
  service.analyzeImages([good, bad, good], settings);
  assert.throws(() => service.analyzeImages([good], settings), /already running/);
  let job = await settle();
  assert.equal(job.total, 2); assert.equal(job.completed, 1); assert.equal(job.failed, 1);
  assert.equal(store.getAIResults(good).wd?.tags[0].label, 'forest');
  service.analyzeImages([good], settings);
  job = await settle(); assert.equal(job.skipped, 1); assert.equal(job.completed, 0);
  service.analyzeImages([good], { ...settings, threshold: .7 });
  job = await settle(); assert.equal(job.completed, 1);
  const current = service.analyzeImages([slow], settings);
  await delay(80);
  service.cancelAIJob(current.id);
  job = await settle(); assert.equal(job.state, 'cancelled'); assert.deepEqual(store.getAIResults(slow), {});
  service.analyzeImages([bad], settings);
  job = await settle(); assert.equal(job.state, 'failed'); assert.ok(job.errors.some(error => error.includes('decode')));
});
