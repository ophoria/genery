import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisProgress, analysisSummary, shouldNotifyAnalysisDone } from '../src/utils/aiProgress';
import { collectAIStatistics, sortTagStatistics } from '../src/utils/aiStatistics';
import { filterImages } from '../src/utils/filterEngine';
import type { AIJob, AIResult } from '../src/types/ai';
import type { ImageItem, BasicFilterOptions } from '../src/types/gallery';
const start = Date.parse('2026-10-03T10:00:00Z');
const job: AIJob = { id: 'test', kind: 'analyze', variant: 'ram', state: 'running', total: 10, completed: 2, skipped: 1, failed: 1, message: '', errors: [], startedAt: new Date(start).toISOString(), updatedAt: new Date(start + 90000).toISOString() };
test('progress includes completed, cached, failed; ETA waits for actual attempts', () => {
  const stats = analysisProgress(job, start + 90000);
  assert.equal(stats.percent, 40);
  assert.equal(stats.remainingMs, 180000);
  assert.equal(stats.estimatedFinish, start + 270000);
  assert.equal(analysisProgress({ ...job, completed: 0, failed: 0 }, start + 90000).remainingMs, null);
});
test('completion timing is frozen and cached-only runs have no average', () => {
  const done = { ...job, state: 'completed' as const, completed: 8, failed: 1 };
  assert.equal(analysisProgress(done, start + 999999).elapsedMs, 90000);
  assert.match(analysisSummary(done), /1 min 30 sec.*11.3 sec/);
  assert.match(analysisSummary({ ...done, completed: 0, skipped: 10 }), /N\/A/);
  assert.equal(analysisProgress(done).percent, 100);
});
test('only new completion of a running analysis while closed sends toast', () => {
  const done = { ...job, state: 'completed' as const };
  assert.equal(shouldNotifyAnalysisDone(job, done, false), true);
  assert.equal(shouldNotifyAnalysisDone(job, done, true), false);
  assert.equal(shouldNotifyAnalysisDone(null, done, false), false);
  assert.equal(shouldNotifyAnalysisDone(done, done, false), false);
  assert.equal(shouldNotifyAnalysisDone(job, { ...done, state: 'failed' }, false), false);
  assert.equal(shouldNotifyAnalysisDone(job, { ...done, kind: 'install' }, false), false);
});
const result = (variant: AIResult['variant'], labels: [string, number][]): AIResult => ({ variant, family: variant === 'ram' ? 'ram' : 'wd', analyzedAt: '', fingerprint: '', settingsKey: '', device: 'cpu', durationMs: 1, tags: labels.map(([label, score]) => ({ label, score, group: 'general' })) });
const images = [
  { id: 'a', name: 'one.png', extension: 'png', comment: '', hashtags: ['Nature'], ai: { ram: result('ram', [['Forest', .8], ['tree', .4]]), wd: result('wd-swinv2', [['forest', .9]]) } },
  { id: 'b', name: 'two.png', extension: 'png', comment: '', hashtags: [], ai: { wd: result('wd-swinv2', [['forest', .5], ['portrait', .7]]) } },
  { id: 'c', name: 'three.png', extension: 'png', comment: '', hashtags: [], ai: { ram: result('ram', []) } },
] as unknown as ImageItem[];
const filters: BasicFilterOptions = { directoryPath: '', includeSubdirs: true, selectedTypes: [], aspectRatio: 'any', hashtags: [], hashtagOperator: 'AND', searchQuery: '' };
test('search and simultaneous include/exclude use AI and manual tags', () => {
  assert.equal(filterImages(images, { ...filters, searchQuery: ' #FOREST ' }).length, 2);
  assert.equal(filterImages(images, { ...filters, includedTags: ['forest'], excludedTags: ['portrait'] }).length, 1);
  assert.equal(filterImages(images, { ...filters, includedTags: ['nature', '#forest'] }).length, 1);
  assert.equal(filterImages(images, { ...filters, excludedTags: ['forest'] }).length, 1);
  assert.equal(filterImages(images, { ...filters, includedTags: ['  ', ''] }).length, 3);
});
test('statistics deduplicate image tags across models and handle empty analyses', () => {
  const stats = collectAIStatistics(images);
  assert.equal(stats.analyzedImages, 3);
  assert.equal(stats.taggedImages, 2);
  assert.equal(stats.tags.length, 3);
  const forest = stats.tags.find(row => row.label === 'forest')!;
  assert.equal(forest.count, 2);
  assert.equal(forest.averageScore, .7);
  assert.equal(stats.modelCounts.get('ram'), 2);
  assert.equal(collectAIStatistics(images, 'ram').tags.find(row => row.label === 'forest')?.count, 1);
  assert.equal(collectAIStatistics([]).tags.length, 0);
  for (const field of ['label', 'count', 'averageScore'] as const) {
    const asc = sortTagStatistics(stats.tags, field, 'asc');
    const desc = sortTagStatistics(stats.tags, field, 'desc');
    assert.ok(asc[0][field] <= asc.at(-1)![field]);
    assert.ok(desc[0][field] >= desc.at(-1)![field]);
  }
});
