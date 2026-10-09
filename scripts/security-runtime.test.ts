import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { spawn, execFileSync } from 'node:child_process';

async function reservePort() {
  const server = http.createServer();
  await new Promise<void>(resolve => server.listen(0, '0.0.0.0', resolve));
  const port = (server.address() as any).port as number;
  await new Promise<void>(resolve => server.close(() => resolve())); return port;
}
test('actual listeners enforce TLS, roles, origin checks, and dynamic enable/disable', { timeout: 20000 }, async () => {
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'genery-runtime-')));
  const certFile = path.join(temporary, 'cert.pem'); const keyFile = path.join(temporary, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
  const ca = fs.readFileSync(certFile);
  const [localPort, lanPort, publicPort] = await Promise.all([reservePort(), reservePort(), reservePort()]);
  const local = `http://127.0.0.1:${localPort}`; const lan = `https://127.0.0.1:${lanPort}`; const internet = `https://127.0.0.1:${publicPort}`;
  const root = path.join(temporary, 'images'); fs.mkdirSync(root);
  const image = path.join(root, 'image.png'); fs.writeFileSync(image, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(localPort), GENERY_LAN_PORT: String(lanPort), GENERY_INTERNET_PORT: String(publicPort), GENERY_ACCESS_PATH: path.join(temporary, 'access.json'), GENERY_AI_HOME: path.join(temporary, 'ai'), GENERY_METADATA_PATH: path.join(temporary, 'metadata.json'), GENERY_LAST_FOLDERS_PATH: path.join(temporary, 'last-folders.json'), GENERY_TLS_CERT: certFile, GENERY_TLS_KEY: keyFile },
  });
  let diagnostics = ''; child.stderr.on('data', data => { diagnostics += data.toString(); });
  async function request(base: string, endpoint: string, method = 'GET', body?: unknown, cookie?: string, overrides: Record<string, string> = {}) {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    return new Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
      const url = new URL(base + endpoint);
      const transport = url.protocol === 'https:' ? https : http;
      const wire = transport.request(url, { ca, servername: 'localhost', method, timeout: 3000, headers: { Origin: base, 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': String(Buffer.byteLength(payload)) } : {}), ...(cookie ? { Cookie: cookie } : {}), ...overrides } }, response => {
        const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => { const text = Buffer.concat(chunks).toString(); let data: any; try { data = JSON.parse(text); } catch { data = text; } resolve({ status: response.statusCode!, data, headers: response.headers }); });
      });
      wire.on('error', reject); wire.on('timeout', () => wire.destroy(new Error('Request timed out.')));
      if (payload) wire.write(payload); wire.end();
    });
  }
  async function signIn(base: string, username: string) {
    const response = await request(base, '/api/access/login', 'POST', { username, password: 'a secure galaxy horse stapler 472!' });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    const cookie = response.headers['set-cookie']![0];
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Strict/);
    return cookie.split(';')[0];
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${diagnostics}`)), 7000);
      child.stdout.on('data', data => { if (data.toString().includes('Genery local control')) { clearTimeout(timer); resolve(); } });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${diagnostics}`)); });
    });
    assert.equal((await request(local, '/api/access/session')).data.user.id, 'local-owner');
    await assert.rejects(request(lan, '/api/access/session')); await assert.rejects(request(internet, '/api/access/session'));
    const external = Object.values(os.networkInterfaces()).flat().find(item => item?.family === 'IPv4' && !item.internal)?.address;
    if (external) await assert.rejects(request(`http://${external}:${localPort}`, '/api/access/session'));
    assert.equal((await request(local, '/api/access/session', 'GET', undefined, undefined, { Host: 'attacker.example' })).status, 403);
    const create = (username: string, role: string) => request(local, '/api/access/users', 'POST', { username, role, password: 'a secure galaxy horse stapler 472!', grants: [{ path: root, recursive: true }] });
    assert.equal((await create('admin', 'admin')).status, 201); assert.equal((await create('reader', 'normal')).status, 201);
    const settings = { lanEnabled: true, lanPassword: true, internetEnabled: true, publicOrigin: internet, guestRole: 'normal', guestGrants: [{ path: root, recursive: true }] };
    const occupied = http.createServer();
    await new Promise<void>(resolve => occupied.listen(publicPort, '0.0.0.0', resolve));
    try {
      assert.notEqual((await request(local, '/api/access/settings', 'POST', settings)).status, 200);
      await assert.rejects(request(lan, '/api/access/session'));
      assert.equal((await request(local, '/api/access/settings')).data.settings.lanEnabled, false);
    } finally { await new Promise<void>(resolve => occupied.close(() => resolve())); }
    assert.equal((await request(local, '/api/access/settings', 'POST', settings)).status, 200);
    assert.equal((await request(lan, '/api/scan')).status, 401);
    if (Object.values(os.networkInterfaces()).flat().some(item => item?.address === '::1')) assert.equal((await request(`https://[::1]:${lanPort}`, '/api/access/session')).data.user, null); assert.equal((await request(internet, '/api/scan')).status, 401);
    const remote = await request(internet, '/'); assert.equal(remote.status, 200); assert.match(remote.data, /Genery/);
    assert.equal(remote.headers['strict-transport-security'], 'max-age=31536000');
    await assert.rejects(request(lan.replace('https:', 'http:'), '/api/access/login', 'POST', { username: 'admin', password: 'secret' }));
    const adminCookie = await signIn(internet, 'admin'); const readerCookie = await signIn(lan, 'reader');
    assert.equal((await request(internet, '/api/access/users', 'POST', { username: 'bad', role: 'admin', password: 'a secure galaxy horse stapler 472!' }, adminCookie)).status, 403);
    assert.equal((await request(internet, '/api/scan', 'GET', undefined, readerCookie)).status, 401);
    assert.equal((await request(internet, '/api/access/session', 'GET', undefined, adminCookie, { 'X-Forwarded-For': '127.0.0.1' })).data.canManageUsers, false);
    assert.equal((await request(internet, '/api/access/session', 'GET', undefined, adminCookie, { Host: 'other.example' })).status, 403);
    const imageRoute = `/api/image?path=${encodeURIComponent(image)}`;
    assert.equal((await request(lan, imageRoute, 'GET', undefined, readerCookie)).status, 200);
    assert.equal((await request(lan, '/api/batch', 'POST', { action: 'delete', imagePaths: [image] }, readerCookie)).status, 403);
    assert.equal((await request(local, '/api/access/settings', 'POST', { ...settings, lanPassword: false })).status, 409);
    assert.equal((await request(local, '/api/access/settings', 'POST', { ...settings, lanEnabled: false, internetEnabled: false })).status, 200);
    await assert.rejects(request(lan, '/api/access/session')); await assert.rejects(request(internet, '/api/access/session'));
    assert.equal((await request(local, '/api/access/settings', 'POST', { ...settings, lanPassword: false, internetEnabled: false })).status, 200);
    const guest = lan.replace('https:', 'http:');
    assert.equal((await request(guest, '/api/access/session')).data.user.role, 'normal');
    assert.equal((await request(guest, imageRoute)).status, 200);
    assert.equal((await request(guest, '/api/access/login', 'POST', { username: 'admin', password: 'a secure galaxy horse stapler 472!' })).status, 403);
    assert.equal((await request(guest, '/api/access/users', 'POST', { username: 'bad' })).status, 403);
    // A certificate failure leaves the existing guest listener running and settings intact.
    fs.renameSync(certFile, certFile + '.moved');
    const failed = await request(local, '/api/access/settings', 'POST', { ...settings, lanPassword: false });
    assert.notEqual(failed.status, 200);
    assert.equal((await request(guest, '/api/access/session')).status, 200);
    assert.equal((await request(local, '/api/access/settings')).data.settings.internetEnabled, false);
    fs.renameSync(certFile + '.moved', certFile);
    assert.equal((await request(local, '/api/access/settings', 'POST', { ...settings, lanEnabled: false, internetEnabled: false })).status, 200);
  } finally {
    if (child.exitCode === null && child.signalCode === null) await new Promise<void>(resolve => { child.once('exit', () => resolve()); child.kill('SIGTERM'); });
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
