import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MetadataStore, validateMetadataImport } from '../server/metadataStore';

test('import merges fields, preserves other images, and backs up the previous file', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'genery-import-'));
  try {
    const storePath = path.join(directory, 'metadata.json');
    const previous = { '/images/a.png': { score: 2, hashtags: ['keep'], comment: 'keep' }, '/images/b.png': { score: 4 } };
    fs.writeFileSync(storePath, JSON.stringify(previous));
    const store = new MetadataStore(storePath);
    const result = store.importMetadata({ '/images/a.png': { score: 5 }, '/images/c.png': { score: 1, hashtags: ['new'], comment: 'new' } });
    assert.equal(result.importedCount, 2);
    assert.deepEqual(JSON.parse(fs.readFileSync(result.backupPath!, 'utf8')), previous);
    assert.deepEqual(store.get('/images/a.png'), { score: 5, hashtags: ['keep'], comment: 'keep' });
    assert.deepEqual(store.get('/images/b.png'), { score: 4 });
    assert.deepEqual(new MetadataStore(storePath).getAll(), store.getAll());
    const saved = fs.readFileSync(storePath, 'utf8');
    assert.throws(() => store.importMetadata({ '/images/a.png': { score: 3 }, '/images/b.png': { score: 9 } }));
    assert.equal(fs.readFileSync(storePath, 'utf8'), saved);
    assert.equal(store.get('/images/a.png').score, 5);
    assert.deepEqual(store.importMetadata({}), { importedCount: 0, backupPath: null });
    assert.equal(fs.readFileSync(storePath, 'utf8'), saved);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('import rejects malformed metadata and accepts exported fields', () => {
  for (const invalid of [null, [], 'text', { relative: { score: 1 } }, { '/a': null }, { '/a': {} }, { '/a': { score: 1.5 } }, { '/a': { score: '5' } }, { '/a': { hashtags: [1] } }, { '/a': { comment: false } }, { '/a': { ai: {} } }]) {
    assert.throws(() => validateMetadataImport(invalid));
  }
  assert.deepEqual(validateMetadataImport({ '/a': { score: 0, hashtags: [], comment: '' } }), { '/a': { score: 0, hashtags: [], comment: '' } });
});

test('failed disk write does not change the loaded metadata', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'genery-import-'));
  try {
    const storePath = path.join(directory, 'metadata.json');
    fs.writeFileSync(storePath, JSON.stringify({ '/a': { score: 2 } }));
    const store = new MetadataStore(storePath);
    fs.mkdirSync(storePath + '.import-tmp');
    assert.throws(() => store.importMetadata({ '/a': { score: 5 } }));
    assert.equal(store.get('/a').score, 2);
    assert.deepEqual(JSON.parse(fs.readFileSync(storePath, 'utf8')), { '/a': { score: 2 } });
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
