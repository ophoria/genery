import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import http from 'node:http';
import { SecurityStore, hashPassword } from '../server/security/store.js';
import { AccessControl, type Channel, type NetworkChange } from '../server/security/access.js';

const password = 'a secure galaxy horse stapler 472!';
async function fixture(channel: Channel = 'lan', prepare: () => Promise<NetworkChange | void> = async () => {}) {
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'genery-lifecycle-')));
  const store = new SecurityStore(path.join(temporary, 'access.json'));
  const admin = await store.createUser({ username: 'admin', role: 'admin', password });
  const reader = await store.createUser({ username: 'reader', role: 'normal', password, grants: [{ path: temporary, recursive: true }] });
  store.saveSettings({ lanEnabled: true, lanPassword: true, internetEnabled: false, publicOrigin: '', guestRole: 'normal', guestGrants: [] });
  let now = 1000000;
  const access = new AccessControl(store, prepare, () => now);
  const app = express();
  app.use((req, _res, next) => { if (typeof req.headers['x-test-peer'] === 'string') Object.defineProperty(req.socket, 'remoteAddress', { value: req.headers['x-test-peer'], configurable: true }); next(); });
  app.use((req, _res, next) => { Object.defineProperty(req, 'secure', { value: true }); next(); });
  app.use(access.boundary(channel)); app.use(express.json()); app.use(access.authRoutes);
  app.get('/probe', (req, res) => res.json({ user: req.access.user, current: req.access.user ? req.access.currentUser() : null }));
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 400).json({ error: error.message }));
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  async function request(route: string, method = 'GET', body?: unknown, cookie?: string, headers: Record<string, string> = {}) {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    return new Promise<{ status: number; data: any; cookie: string }>((resolve, reject) => {
      const wire = http.request(`http://127.0.0.1:${port}${route}`, { method, headers: { Origin: `https://127.0.0.1:${port}`, 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': String(Buffer.byteLength(payload)) } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers } }, response => {
        let text = ''; response.setEncoding('utf8'); response.on('data', data => { text += data; });
        response.on('end', () => resolve({ status: response.statusCode!, data: JSON.parse(text), cookie: response.headers['set-cookie']?.[0].split(';')[0] || '' }));
      }); wire.on('error', reject); if (payload) wire.write(payload); wire.end();
    });
  }
  async function login(username = 'reader') {
    const response = await request('/api/access/login', 'POST', { username, password }); assert.equal(response.status, 200); return response.cookie;
  }
  return { store, access, admin, reader, request, login, advance: (ms: number) => { now += ms; }, close: async () => { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); fs.rmSync(temporary, { recursive: true, force: true }); } };
}
test('idle expiration and absolute expiration cannot be prolonged by continued activity', async () => {
  const f = await fixture();
  try {
    let cookie = await f.login();
    f.advance(30 * 60_000 - 1); assert.equal((await f.request('/probe', 'GET', undefined, cookie)).data.user.role, 'normal');
    f.advance(30 * 60_000); assert.equal((await f.request('/probe', 'GET', undefined, cookie)).data.user, null);
    cookie = await f.login();
    for (let index = 0; index < 35; index++) { f.advance(20 * 60_000); assert.equal((await f.request('/probe', 'GET', undefined, cookie)).data.user.role, 'normal'); }
    f.advance(20 * 60_000); assert.equal((await f.request('/probe', 'GET', undefined, cookie)).data.user, null);
  } finally { await f.close(); }
});
test('login rotates the token, logout revokes it, and user management works on passworded LAN', async () => {
  const f = await fixture();
  try {
    const oldCookie = await f.login();
    const next = await f.request('/api/access/login', 'POST', { username: 'reader', password }, oldCookie);
    assert.equal(next.status, 200); assert.notEqual(next.cookie, oldCookie);
    assert.equal((await f.request('/probe', 'GET', undefined, oldCookie)).data.user, null);
    assert.equal((await f.request('/probe', 'GET', undefined, next.cookie)).data.user.role, 'normal');
    assert.equal((await f.request('/api/access/users', 'POST', { username: 'bad', password, role: 'admin' }, next.cookie)).status, 403);
    const adminCookie = await f.login('admin');
    const created = await f.request('/api/access/users', 'POST', { username: 'new-admin', password, role: 'admin' }, adminCookie);
    assert.equal(created.status, 201); assert.equal(created.data.user.hash, undefined); assert.equal(created.data.user.salt, undefined);
    const deleted = await f.request(`/api/access/users/${created.data.user.id}`, 'DELETE', {}, adminCookie);
    assert.equal(deleted.status, 200); assert.equal((await f.request('/probe', 'GET', undefined, adminCookie)).data.user, null);
  } finally { await f.close(); }
});
test('password and role changes during hashing cannot mint a session from stale credentials', async () => {
  const f = await fixture();
  try {
    const pending = f.store.authenticate('reader', password);
    await f.store.updateUser(f.reader.id, { role: 'normal', grants: f.reader.grants, password: 'a brand new unique planet password 689!' });
    assert.equal(await pending, null);
    assert.equal(await f.store.authenticate('reader', password), null);
    const newPassword = 'a brand new unique planet password 689!';
    const roleRace = f.store.authenticate('reader', newPassword);
    await f.store.updateUser(f.reader.id, { role: 'moderator', grants: f.reader.grants });
    assert.equal(await roleRace, null);
  } finally { await f.close(); }
});
test('revocation during an in-flight login rejects its result', async () => {
  const f = await fixture();
  try {
    const realAuthenticate = f.store.authenticate.bind(f.store);
    let release!: () => void; let entered!: () => void;
    const reached = new Promise<void>(resolve => { entered = resolve; });
    f.store.authenticate = async (username, candidate) => { const user = await realAuthenticate(username, candidate); entered(); await new Promise<void>(resolve => { release = resolve; }); return user; };
    const pending = f.request('/api/access/login', 'POST', { username: 'reader', password });
    await reached; f.access.revoke(); release();
    const result = await pending; assert.equal(result.status, 401); assert.equal(result.cookie, '');
  } finally { await f.close(); }
});
test('corrupt persisted security configuration fails closed, including missing LAN password mode', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'genery-corrupt-'));
  const filename = path.join(temporary, 'access.json');
  try {
    for (const corrupt of [null, {}, { version: 1, users: [], settings: { lanEnabled: true, internetEnabled: false } }, { version: 1, users: [], settings: { lanEnabled: true, lanPassword: false, internetEnabled: false, publicOrigin: '', guestRole: 'admin', guestGrants: [] } }]) {
      fs.writeFileSync(filename, JSON.stringify(corrupt)); assert.throws(() => new SecurityStore(filename));
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('legacy hashes are verified and upgraded to the current cost on successful login', async () => {
  const f = await fixture();
  try {
    const stored = f.store.state.users.find(user => user.id === f.reader.id)!;
    stored.hash = await hashPassword(password, stored.salt, 32768); delete stored.hashVersion;
    assert.equal((await f.store.authenticate('reader', password))?.id, f.reader.id);
    const upgraded = f.store.state.users.find(user => user.id === f.reader.id)!;
    assert.equal(upgraded.hashVersion, 2); assert.notEqual(upgraded.hash, stored.hash);
    assert.ok(await f.store.authenticate('reader', password));
  } finally { await f.close(); }
});

test('network changes prepare listeners, roll them back on persistence failure, and commit only after saving', async () => {
  const events: string[] = [];
  const f = await fixture('local', async () => { events.push('prepare'); return { commit: () => { events.push('commit'); }, rollback: async () => { events.push('rollback'); } }; });
  try {
    const previous = f.store.settings();
    const realSave = f.store.saveSettings.bind(f.store);
    f.store.saveSettings = () => { events.push('save-failed'); throw new Error('Simulated disk error'); };
    assert.equal((await f.request('/api/access/settings', 'POST', { ...previous, lanEnabled: false })).status, 400);
    assert.deepEqual(events, ['prepare', 'save-failed', 'rollback']); assert.deepEqual(f.store.settings(), previous);
    events.length = 0;
    f.store.saveSettings = value => { events.push('save'); realSave(value); };
    assert.equal((await f.request('/api/access/settings', 'POST', { ...previous, lanEnabled: false })).status, 200);
    assert.deepEqual(events, ['prepare', 'save', 'commit']); assert.equal(f.store.settings().lanEnabled, false);
  } finally { await f.close(); }
});

test('per-account throttling survives different peers and expires with its bounded window', async () => {
  const f = await fixture();
  try {
    for (let index = 0; index < 10; index++) {
      const result = await f.request('/api/access/login', 'POST', { username: 'reader', password: 'wrong' }, undefined, { 'x-test-peer': `10.0.0.${index + 1}` });
      assert.equal(result.status, 401);
    }
    assert.equal((await f.request('/api/access/login', 'POST', { username: 'reader', password }, undefined, { 'x-test-peer': '10.0.0.99' })).status, 429);
    f.advance(15 * 60_000);
    assert.equal((await f.request('/api/access/login', 'POST', { username: 'reader', password }, undefined, { 'x-test-peer': '10.0.0.99' })).status, 200);
  } finally { await f.close(); }
});

test('automatic session and AI status polling do not refresh the idle deadline', async () => {
  const f = await fixture();
  try {
    const cookie = await f.login();
    for (let minute = 1; minute < 30; minute++) { f.advance(60_000); assert.equal((await f.request('/api/access/session', 'GET', undefined, cookie)).data.user.role, 'normal'); }
    f.advance(60_000); assert.equal((await f.request('/api/access/session', 'GET', undefined, cookie)).data.user, null);
  } finally { await f.close(); }
});

test('LAN account changes cannot commit after the requesting administrator signs out', async () => {
  const f = await fixture();
  try {
    let entered!: () => void;
    let reached = new Promise<void>(resolve => { entered = resolve; });
    const create = f.store.createUser.bind(f.store);
    f.store.createUser = (body, authorized) => { entered(); return create(body, authorized); };
    let cookie = await f.login('admin');
    const pendingCreate = f.request('/api/access/users', 'POST', { username: 'revoked-admin', password, role: 'admin' }, cookie);
    await reached; await f.request('/api/access/logout', 'POST', {}, cookie);
    assert.equal((await pendingCreate).status, 401);
    assert.equal(f.store.users().some(user => user.username === 'revoked-admin'), false);
    const update = f.store.updateUser.bind(f.store);
    reached = new Promise<void>(resolve => { entered = resolve; });
    f.store.updateUser = (id, body, authorized) => { entered(); return update(id, body, authorized); };
    cookie = await f.login('admin');
    const pendingUpdate = f.request(`/api/access/users/${f.reader.id}`, 'PATCH', { role: 'moderator', grants: f.reader.grants, password: 'replacement galaxy horse stapler 893!' }, cookie);
    await reached; await f.request('/api/access/logout', 'POST', {}, cookie);
    assert.equal((await pendingUpdate).status, 401);
    assert.equal(f.store.users().find(user => user.id === f.reader.id)?.role, 'normal');
    assert.ok(await f.store.authenticate('reader', password));
  } finally { await f.close(); }
});
