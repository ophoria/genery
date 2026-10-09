import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { Request, Response } from 'express';
import { authorizePath, AccessError, type Principal } from '../server/security/paths.js';
import { openImage, streamImage } from '../server/security/media.js';

const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'genery-streams-')));
process.env.GENERY_AI_HOME = path.join(temporary, 'ai');
process.env.GENERY_METADATA_PATH = path.join(temporary, 'metadata.json');
process.env.GENERY_LAST_FOLDERS_PATH = path.join(temporary, 'last-folders.json');
const { executeBatchOperation } = await import('../server/operations.js');
const images = path.join(temporary, 'images'); fs.mkdirSync(images);
const user: Principal = { id: 'moderator', username: 'moderator', role: 'moderator', grants: [{ path: images, recursive: true }] };
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

test('a destination appearing after rename preflight is never overwritten', async () => {
  const source = path.join(images, 'source.png'); const target = path.join(images, 'target.png');
  fs.writeFileSync(source, 'original source');
  let destinationChecks = 0;
  const result = await executeBatchOperation({ action: 'rename', imagePaths: [source], renamePattern: 'target' }, (file, kind) => {
    const allowed = authorizePath(user, file, kind);
    if (kind === 'destination' && ++destinationChecks === 2) fs.writeFileSync(target, 'concurrent destination');
    return allowed;
  });
  assert.equal(result.success, false);
  assert.equal(fs.readFileSync(source, 'utf8'), 'original source'); assert.equal(fs.readFileSync(target, 'utf8'), 'concurrent destination');
});
test('archive sources are reauthorized on consumption and do not report success after revocation', async () => {
  const source = path.join(images, 'archive-source.png'); fs.writeFileSync(source, Buffer.alloc(1024 * 1024, 1));
  let reads = 0;
  const result = await executeBatchOperation({ action: 'zip', imagePaths: [source], zipFileName: 'revoked.zip' }, (file, kind) => {
    if (kind === 'image' && ++reads >= 4) throw new AccessError('Grant revoked.');
    return authorizePath(user, file, kind);
  });
  assert.equal(result.success, false); assert.equal(result.affectedCount, 0);
  assert.ok(reads >= 4); assert.equal(fs.statSync(source).size, 1024 * 1024);
});
test('image streams stop after grant revocation and close their checked descriptor', async () => {
  const source = path.join(images, 'stream.png'); fs.writeFileSync(source, Buffer.alloc(2 * 1024 * 1024, 2));
  let current: Principal = user; let delivered = 0;
  const req = { query: { path: source }, access: { user, currentUser: () => current } } as unknown as Request;
  const opened = openImage(req);
  const destination = new Writable({ write(chunk, _encoding, callback) {
    delivered += chunk.length; current = { ...user, grants: [] }; callback();
  } });
  const closed = new Promise<void>(resolve => destination.on('close', resolve));
  destination.on('error', () => {});
  const completed = streamImage(req, destination as unknown as Response, source, opened.fd);
  await closed; await completed;
  assert.ok(delivered > 0 && delivered < fs.statSync(source).size);
  assert.throws(() => fs.fstatSync(opened.fd), /bad file descriptor|EBADF/i);
});
