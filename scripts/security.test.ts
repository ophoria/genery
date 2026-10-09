import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import sharp from 'sharp';
import express from 'express';
import { SecurityStore } from '../server/security/store.js';
import { AccessControl, isPrivatePeer, type Channel } from '../server/security/access.js';
import { DEFAULT_AI_SETTINGS } from '../src/types/ai.js';
import { setTimeout as delay } from 'node:timers/promises';
import { authorizePath, type Principal } from '../server/security/paths.js';

const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'genery-security-')));
process.env.GENERY_AI_HOME = path.join(temporary, 'ai');
process.env.GENERY_METADATA_PATH = path.join(temporary, 'metadata.json');
process.env.GENERY_LAST_FOLDERS_PATH = path.join(temporary, 'last-folders.json');
const { createApp } = await import('../server/app.js');
const root = path.join(temporary, 'allowed');
const other = path.join(temporary, 'allowed-other');
fs.mkdirSync(root); fs.mkdirSync(other); fs.mkdirSync(path.join(root, 'sub'));
const image = path.join(root, 'a.png');
const outside = path.join(other, 'secret.png');
const nested = path.join(root, 'sub', 'nested.png');
// A valid tiny PNG, so both scanners and thumbnail decoders exercise real file IO.
const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ffffff' } }).png().toBuffer();
for (const file of [image, outside, nested]) fs.writeFileSync(file, png);
fs.writeFileSync(path.join(root, 'credentials.txt'), 'secret');
fs.symlinkSync(outside, path.join(root, 'escape.png'));
fs.symlinkSync(other, path.join(root, 'escape-dir'));
const store = new SecurityStore(path.join(temporary, 'access.json'));
const password = 'correct horse galaxy stapler 472!';
const admin = await store.createUser({ username: 'administrator', password, role: 'admin' });
const normal = await store.createUser({ username: 'reader', password, role: 'normal', grants: [{ path: root, recursive: false }] });
const moderator = await store.createUser({ username: 'moderator', password, role: 'moderator', grants: [{ path: root, recursive: true }] });
const servers: http.Server[] = [];
const access = new AccessControl(store);
store.saveSettings({ lanEnabled: true, lanPassword: true, internetEnabled: true, publicOrigin: 'https://public.example:3443', guestRole: 'normal', guestGrants: [{ path: root, recursive: true }] });
async function surface(channel: Channel) {
  const wrapper = express();
  // Only this test harness supplies TLS metadata; production derives it from a TLS socket.
  if (channel !== 'local') wrapper.use((req, _res, next) => { Object.defineProperty(req, 'secure', { value: true }); next(); });
  wrapper.use(access.boundary(channel)); wrapper.use(createApp(access));
  const server = http.createServer(wrapper); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as any).port}`;
}
const localURL = await surface('local');
const lanURL = await surface('lan');
const publicURL = await surface('internet');
async function request(base: string, endpoint: string, method = 'GET', body?: unknown, cookie?: string, overrides: Record<string, string> = {}) {
  const publicAccess = base === publicURL;
  const origin = publicAccess ? store.settings().publicOrigin : base === lanURL ? base.replace('http:', 'https:') : base;
  return new Promise<{ status: number; data: any; headers: Headers }>((resolve, reject) => {
    const wire = http.request(base + endpoint, { method, headers: { Host: new URL(origin).host, Origin: origin, 'Content-Type': 'application/json', ...(body !== undefined ? { 'Content-Length': String(Buffer.byteLength(JSON.stringify(body))) } : {}), ...(cookie ? { Cookie: cookie } : {}), ...overrides } }, response => {
      const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString(); let data: any;
        try { data = JSON.parse(text); } catch { data = text; }
        const headers = new Headers(); for (const [key, value] of Object.entries(response.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        resolve({ status: response.statusCode!, data, headers });
      });
    });
    wire.on('error', reject); if (body !== undefined) wire.write(JSON.stringify(body)); wire.end();
  });
}
async function login(base: string, username: string) {
  const result = await request(base, '/api/access/login', 'POST', { username, password });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.headers.get('set-cookie')!.split(';')[0];
}
let readerCookie = await login(lanURL, 'reader');
let modCookie = await login(lanURL, 'moderator');
let adminCookie = await login(publicURL, 'administrator');
after(async () => { await Promise.all(servers.map(server => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }))); fs.rmSync(temporary, { recursive: true, force: true }); });

test('an archive stops when its owner becomes read-only even if directory grants remain', async context => {
  const source = path.join(root, 'downgraded.png');
  context.after(() => {
    fs.rmSync(source, { force: true });
    fs.rmSync(path.join(root, 'downgraded.zip'), { force: true });
  });
  fs.writeFileSync(source, Buffer.alloc(1024 * 1024, 7));
  const wrapper = express();
  wrapper.use(access.boundary('local'));
  let checks = 0;
  wrapper.use((req, _res, next) => {
    req.access.user = moderator;
    req.access.currentUser = () => ++checks >= 6 ? { ...moderator, role: 'normal' } : moderator;
    next();
  });
  wrapper.use(createApp(access));
  const server = http.createServer(wrapper); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const result = await request(base, '/api/batch', 'POST', { action: 'zip', imagePaths: [source], zipFileName: 'downgraded.zip' });
  assert.equal(result.data.success, false);
  assert.equal(result.data.affectedCount, 0);
  assert.ok(checks >= 4);
  assert.equal(fs.statSync(source).size, 1024 * 1024);
});

test('local administrators retain file deletion access', async () => {
  const source = path.join(root, 'admin-delete.png'); fs.writeFileSync(source, png);
  const result = await request(localURL, '/api/batch', 'POST', { action: 'delete', imagePaths: [source] });
  assert.equal(result.status, 200); assert.equal(result.data.success, true);
  assert.equal(fs.existsSync(source), false);
});

test('oversized login bodies and thumbnail inputs are rejected before expensive work', async context => {
  const result = await request(publicURL, '/api/access/login', 'POST', { username: 'reader', password: 'x'.repeat(2048) });
  assert.equal(result.status, 413);
  const large = path.join(root, 'large.png');
  context.after(() => fs.rmSync(large, { force: true }));
  fs.writeFileSync(large, png); fs.truncateSync(large, 65 * 1024 * 1024);
  const thumbnail = await request(lanURL, `/api/thumbnail?path=${encodeURIComponent(large)}`, 'GET', undefined, readerCookie);
  assert.equal(thumbnail.status, 413);
  assert.equal(fs.statSync(large).size, 65 * 1024 * 1024);
  assert.equal((await request(lanURL, `/api/thumbnail?path=${encodeURIComponent(image)}`, 'GET', undefined, readerCookie)).status, 200);
});

test('private peers are recognized conservatively, without trusting forwarded headers', () => {
  for (const ip of ['10.1.2.3', '192.168.1.2', '172.16.1.1', '172.31.255.255', '::ffff:192.168.1.1', 'fd12::1']) assert.equal(isPrivatePeer(ip), true, ip);
  for (const ip of ['172.15.1.1', '172.32.1.1', '8.8.8.8', '100.64.1.1', '169.254.1.1', '::', 'fe80::1', 'bad']) assert.equal(isPrivatePeer(ip), false, ip);
});
test('stored passwords are salted scrypt hashes and access configuration is private', async () => {
  const raw = fs.readFileSync(path.join(temporary, 'access.json'), 'utf8');
  assert.equal(raw.includes(password), false);
  assert.equal(fs.statSync(path.join(temporary, 'access.json')).mode & 0o777, 0o600);
  assert.notEqual(store.state.users[0].salt, store.state.users[1].salt);
  assert.ok(await store.authenticate('READER', password));
  assert.equal(await store.authenticate('reader', 'incorrect'), null);
  assert.equal(await store.authenticate('missing', password), null);
  await assert.rejects(store.createUser({ username: 'weak', password: 'passwordpassword', role: 'admin' }));
});
test('internet requires login, never receives local-owner authority, and binds cookies to channel', async () => {
  assert.equal((await request(publicURL, '/api/scan', 'GET', undefined, undefined, { 'X-Forwarded-For': '127.0.0.1' })).status, 401);
  assert.equal((await request(publicURL, '/api/scan', 'GET', undefined, readerCookie)).status, 401);
  const session = await request(publicURL, '/api/access/session');
  assert.equal(session.data.user, null);
  const signedIn = await request(publicURL, '/api/access/session', 'GET', undefined, adminCookie);
  assert.equal(signedIn.data.user.role, 'admin'); assert.equal(signedIn.data.canManageUsers, false);
});
test('internet administrators cannot create, update, delete, or enumerate accounts', async () => {
  for (const [route, method, body] of [
    ['/api/access/users', 'GET', undefined], ['/api/access/users', 'POST', { username: 'intruder', password, role: 'admin' }],
    [`/api/access/users/${normal.id}`, 'PATCH', { role: 'admin' }], [`/api/access/users/${normal.id}`, 'DELETE', {}], ['/api/access/settings', 'GET', undefined],
  ] as const) assert.equal((await request(publicURL, route, method, body, adminCookie)).status, 403, route);
  assert.equal(store.users().length, 3);
});
test('CSRF, DNS rebinding, and unsupported routes are denied', async () => {
  assert.equal((await request(localURL, '/api/access/users', 'POST', {}, undefined, { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await request(localURL, '/api/access/session', 'GET', undefined, undefined, { Host: 'attacker.example' })).status, 403);
  assert.equal((await request(localURL, '/api/access/session', 'GET', undefined, undefined, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await request(localURL, '/api/access/users', 'POST', {}, undefined, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await request(lanURL, '/api/unknown', 'GET', undefined, readerCookie)).status, 404);
});
test('normal users can read only granted images, never secrets, descendants, sibling prefixes, or symlinks', async () => {
  assert.equal((await request(lanURL, `/api/image?path=${encodeURIComponent(image)}`, 'GET', undefined, readerCookie)).status, 200);
  for (const file of [outside, nested, path.join(root, 'escape.png'), path.join(root, 'escape-dir', 'secret.png'), path.join(root, '../allowed-other/secret.png'), path.join(root, 'credentials.txt')]) {
    for (const endpoint of ['image', 'thumbnail']) assert.notEqual((await request(lanURL, `/api/${endpoint}?path=${encodeURIComponent(file)}`, 'GET', undefined, readerCookie)).status, 200, file);
    assert.notEqual((await request(lanURL, '/api/ai/results', 'POST', { paths: [file] }, readerCookie)).status, 200);
  }
  const response = await request(lanURL, `/api/image?path=${encodeURIComponent(image)}`, 'GET', undefined, readerCookie);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await request(lanURL, `/api/thumbnail?path=${encodeURIComponent(image)}&width=999999`, 'GET', undefined, readerCookie)).status, 400);
});
test('malformed thumbnails and metadata do not crash or partially mutate the server', async () => {
  const thumbnail = await request(lanURL, `/api/thumbnail?path=${encodeURIComponent(image)}`, 'GET', undefined, readerCookie);
  assert.equal(thumbnail.status, 200); assert.equal(thumbnail.headers.get('content-type'), 'image/webp');
  const corrupt = path.join(root, 'corrupt.png'); fs.writeFileSync(corrupt, 'invalid image');
  try {
    assert.equal((await request(lanURL, `/api/thumbnail?path=${encodeURIComponent(corrupt)}`, 'GET', undefined, readerCookie)).status, 400);
    assert.equal((await request(lanURL, `/api/thumbnail?path=${encodeURIComponent(image)}&width=32oops`, 'GET', undefined, readerCookie)).status, 400);
    assert.equal((await request(lanURL, '/api/access/session', 'GET', undefined, readerCookie)).status, 200);
    const initial = (await request(lanURL, `/api/scan?dir=${encodeURIComponent(root)}`, 'GET', undefined, readerCookie)).data.images.find((item: any) => item.path === image).score;
    const failed = await request(lanURL, '/api/metadata', 'POST', { path: image, score: 5, hashtags: [123] }, modCookie);
    assert.notEqual(failed.status, 200);
    const after = (await request(lanURL, `/api/scan?dir=${encodeURIComponent(root)}`, 'GET', undefined, readerCookie)).data.images.find((item: any) => item.path === image).score;
    assert.equal(after, initial);
  } finally { fs.unlinkSync(corrupt); }
});

test('scan and browse respect nonrecursive grants and suppress navigation outside roots', async () => {
  const scan = await request(lanURL, `/api/scan?dir=${encodeURIComponent(root)}&subdirs=true`, 'GET', undefined, readerCookie);
  assert.equal(scan.status, 200); assert.deepEqual(scan.data.images.map((item: any) => item.path), [image]);
  const browse = await request(lanURL, `/api/browse?path=${encodeURIComponent(root)}`, 'GET', undefined, readerCookie);
  assert.equal(browse.status, 200); assert.equal(browse.data.parentPath, null); assert.deepEqual(browse.data.directories, []);
  assert.equal((await request(lanURL, `/api/scan?dir=${encodeURIComponent(other)}`, 'GET', undefined, readerCookie)).status, 403);
  const recursive = await request(lanURL, `/api/scan?dir=${encodeURIComponent(root)}&subdirs=true`, 'GET', undefined, modCookie);
  assert.equal(recursive.status, 200); assert.deepEqual(new Set(recursive.data.images.map((item: any) => item.path)), new Set([image, nested]));
});
test('normal users cannot invoke mutations, including POST-based AI actions and account changes', async () => {
  for (const route of ['/api/metadata', '/api/metadata/import', '/api/batch', '/api/ai/analyze', '/api/ai/clear', '/api/ai/install', '/api/ai/settings', '/api/ai/cancel', '/api/access/users']) assert.equal((await request(lanURL, route, 'POST', { path: image, action: 'copy', imagePaths: [image], paths: [image] }, readerCookie)).status, 403, route);
});
test('moderators cannot delete files, escape destinations, overwrite archives, or traverse rename/archive names', async () => {
  assert.equal((await request(lanURL, '/api/batch', 'POST', { action: 'delete', imagePaths: [image] }, modCookie)).status, 403);
  for (const body of [
    { action: 'copy', targetDirectory: other }, { action: 'copy', targetDirectory: path.join(root, 'escape-dir') },
    { action: 'rename', renamePattern: '../allowed-other/stolen' }, { action: 'rename', renamePattern: 'sub/stolen' },
    { action: 'zip', zipFileName: '../secret.zip' }, { action: 'zip', targetDirectory: other },
  ]) assert.notEqual((await request(lanURL, '/api/batch', 'POST', { ...body, imagePaths: [image] }, modCookie)).status, 200, JSON.stringify(body));
  const archive = path.join(root, 'existing.zip'); fs.writeFileSync(archive, 'keep me');
  const zip = await request(lanURL, '/api/batch', 'POST', { action: 'zip', imagePaths: [image], zipFileName: 'existing.zip' }, modCookie);
  assert.equal(zip.data.success, false); assert.equal(fs.readFileSync(archive, 'utf8'), 'keep me');
  assert.ok(fs.existsSync(image)); assert.deepEqual(fs.readFileSync(outside), png);
});
test('restricted AI status hides unrelated jobs and global configuration, and cancel cannot target others', async () => {
  const response = await request(lanURL, '/api/ai/status', 'GET', undefined, readerCookie);
  assert.equal(response.status, 200); assert.equal(response.data.job, null);
  assert.equal((await request(lanURL, '/api/ai/cancel', 'POST', { id: 'someone-elses-job' }, modCookie)).status, 403);
});
test('moderators can cancel their own AI jobs and revoked jobs cannot publish results', async () => {
  const service = await import('../server/ai/service.js');
  const aiStore = await import('../server/ai/store.js');
  const aiHome = process.env.GENERY_AI_HOME!;
  const bin = path.join(aiHome, 'venv', 'bin'); fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'python'), `#!${process.execPath}
const readline = require('node:readline');
let ready = false;
readline.createInterface({ input: process.stdin }).on('line', line => {
 const message = JSON.parse(line);
 if (!ready) { ready = true; console.log('@@GENERY@@' + JSON.stringify({ type: 'ready', device: 'cpu' })); return; }
 setTimeout(() => console.log('@@GENERY@@' + JSON.stringify({ type: 'result', id: message.id, tags: [{ label: 'test', group: 'general', score: .9 }], durationMs: 1 })), 200);
});
`, { mode: 0o755 });
  fs.writeFileSync(path.join(aiHome, 'runtime-ready'), service.RUNTIME_SIGNATURE);
  fs.mkdirSync(path.join(aiHome, 'models'), { recursive: true });
  fs.writeFileSync(path.join(aiHome, 'models', 'wd-swinv2.json'), JSON.stringify({ path: aiHome }));
  async function settled() {
    const deadline = Date.now() + 3000;
    while (service.aiStatus().job?.state === 'running') { assert.ok(Date.now() < deadline, 'AI task did not settle'); await delay(10); }
    await delay(30);
  }
  const ownSettings = { ...DEFAULT_AI_SETTINGS.wd, threshold: .73 };
  assert.equal((await request(lanURL, '/api/ai/settings', 'POST', { settings: ownSettings }, modCookie)).status, 200);
  assert.equal((await request(lanURL, '/api/ai/status', 'GET', undefined, modCookie)).data.settings.wd.threshold, .73);
  assert.equal((await request(lanURL, '/api/ai/status', 'GET', undefined, readerCookie)).data.settings.wd.threshold, DEFAULT_AI_SETTINGS.wd.threshold);
  assert.equal(aiStore.readAISettings().wd.threshold, DEFAULT_AI_SETTINGS.wd.threshold);
  const install = await request(lanURL, '/api/ai/install', 'POST', { variant: 'wd-swinv2' }, modCookie);
  assert.equal(install.status, 202);
  assert.equal((await request(lanURL, '/api/ai/cancel', 'POST', { id: install.data.id }, modCookie)).status, 200);
  await settled();
  const revokedInstall = await request(lanURL, '/api/ai/install', 'POST', { variant: 'wd-swinv2' }, modCookie);
  assert.equal(revokedInstall.status, 202);
  await request(lanURL, '/api/access/logout', 'POST', {}, modCookie);
  await settled(); assert.equal(service.aiStatus().job?.state, 'failed');
  assert.ok(service.aiStatus().job?.errors.some(error => /expired|sign in/i.test(error)));
  modCookie = await login(lanURL, 'moderator');
  let started = await request(lanURL, '/api/ai/analyze', 'POST', { paths: [image], settings: DEFAULT_AI_SETTINGS.wd }, modCookie);
  assert.equal(started.status, 202);
  assert.equal((await request(lanURL, '/api/ai/status', 'GET', undefined, readerCookie)).data.job, null);
  assert.equal((await request(lanURL, '/api/ai/cancel', 'POST', { id: started.data.id }, modCookie)).status, 200);
  await settled(); assert.equal(service.aiStatus().job?.state, 'cancelled');
  started = await request(lanURL, '/api/ai/analyze', 'POST', { paths: [image], settings: DEFAULT_AI_SETTINGS.wd }, modCookie);
  assert.equal(started.status, 202);
  await request(lanURL, '/api/access/logout', 'POST', {}, modCookie);
  await settled(); assert.equal(service.aiStatus().job?.state, 'failed'); assert.deepEqual(aiStore.getAIResults(image), {});
  modCookie = await login(lanURL, 'moderator');
});

test('directory permission checks reject replaced grant roots and strict subdirectory access', () => {
  const restricted: Principal = { ...normal, grants: [{ path: root, recursive: false }] };
  assert.equal(authorizePath(restricted, image), image);
  assert.throws(() => authorizePath(restricted, nested));
  const moved = root + '-saved'; fs.renameSync(root, moved); fs.symlinkSync(other, root);
  try { assert.throws(() => authorizePath(restricted, path.join(root, 'secret.png'))); }
  finally { fs.unlinkSync(root); fs.renameSync(moved, root); }
});
test('guest LAN access is explicitly scoped and never grants user or network management', async () => {
  store.saveSettings({ ...store.settings(), lanPassword: false });
  const session = await request(lanURL, '/api/access/session');
  assert.equal(session.data.user.role, 'normal'); assert.equal(session.data.canManageUsers, false);
  assert.equal((await request(lanURL, `/api/image?path=${encodeURIComponent(outside)}`)).status, 403);
  assert.equal((await request(lanURL, '/api/access/users', 'POST', { username: 'guest-admin', password, role: 'admin' })).status, 403);
  store.saveSettings({ ...store.settings(), lanPassword: true });
});
test('moderator can copy, rename, archive, and edit only authorized metadata', async () => {
  const importResult = await request(localURL, '/api/metadata/import', 'POST', { [image]: { score: 3 }, [outside]: { comment: 'secret metadata' } });
  assert.equal(importResult.status, 200);
  const exported = await request(lanURL, '/api/metadata/export', 'GET', undefined, modCookie);
  assert.equal(exported.status, 200); assert.ok(exported.data[image]); assert.equal(exported.data[outside], undefined);
  assert.equal((await request(lanURL, '/api/metadata/import', 'POST', { [image]: { score: 4 }, [outside]: { score: 1 } }, modCookie)).status, 403);
  const imported = await request(lanURL, '/api/metadata/import', 'POST', { [image]: { score: 4 } }, modCookie);
  assert.equal(imported.status, 200); assert.equal(imported.data.backupPath, null);
  const copy = await request(lanURL, '/api/batch', 'POST', { action: 'copy', imagePaths: [image], targetDirectory: path.join(root, 'copies') }, modCookie);
  assert.equal(copy.data.success, true);
  const source = path.join(root, 'copies', 'a.png');
  const rename = await request(lanURL, '/api/batch', 'POST', { action: 'rename', imagePaths: [source], renamePattern: 'renamed_{n}' }, modCookie);
  assert.equal(rename.data.success, true);
  const renamed = path.join(root, 'copies', 'renamed_1.png'); assert.ok(fs.existsSync(renamed));
  const archive = await request(lanURL, '/api/batch', 'POST', { action: 'zip', imagePaths: [renamed], zipFileName: 'export.zip' }, modCookie);
  assert.equal(archive.data.success, true); assert.ok(fs.existsSync(path.join(root, 'copies', 'export.zip')));
});

test('logout revokes sessions and account updates revoke all active sessions', async () => {
  await request(lanURL, '/api/access/logout', 'POST', {}, readerCookie);
  assert.equal((await request(lanURL, '/api/scan', 'GET', undefined, readerCookie)).status, 401);
  readerCookie = await login(lanURL, 'reader');
  const changed = await request(localURL, `/api/access/users/${moderator.id}`, 'PATCH', { role: 'moderator', grants: [{ path: root, recursive: false }] });
  assert.equal(changed.status, 200);
  for (const cookie of [readerCookie, modCookie]) assert.equal((await request(lanURL, '/api/scan', 'GET', undefined, cookie)).status, 401);
  assert.equal((await request(publicURL, '/api/scan', 'GET', undefined, adminCookie)).status, 401);
});
test('network configuration fails closed without admin, guest grants, or HTTPS origin', () => {
  const settings = store.settings();
  assert.throws(() => store.validateSettings({ ...settings, internetEnabled: true, publicOrigin: 'http://example.com' }));
  assert.throws(() => store.validateSettings({ ...settings, internetEnabled: true, publicOrigin: 'https://example.com/path' }));
  assert.throws(() => store.validateSettings({ ...settings, lanPassword: false, guestGrants: [] }));
  assert.throws(() => store.deleteUser(admin.id));
});

test('login rate limiting blocks repeated attempts before expensive hashing', async () => {
  for (let index = 0; index < 12; index++) await request(publicURL, '/api/access/login', 'POST', { username: 'missing', password: 'invalid' });
  const blocked = await request(publicURL, '/api/access/login', 'POST', { username: 'administrator', password });
  assert.equal(blocked.status, 429);
});
