import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import type { Express } from 'express';
import { createApp } from './app.js';
import { AccessControl, Channel } from './security/access.js';
import { AccessError } from './security/paths.js';
import { SecurityStore, NetworkSettings } from './security/store.js';

const store = new SecurityStore();
type ServerGroup = http.Server[];
let lan: ServerGroup | undefined;
let internet: ServerGroup | undefined;
let lanTLS = false;
function tls() {
  if (!process.env.GENERY_TLS_CERT || !process.env.GENERY_TLS_KEY) throw new AccessError('Configure GENERY_TLS_CERT and GENERY_TLS_KEY locally before enabling HTTPS access.', 400);
  return { cert: fs.readFileSync(process.env.GENERY_TLS_CERT), key: fs.readFileSync(process.env.GENERY_TLS_KEY), minVersion: 'TLSv1.2' as const };
}
function listen(server: http.Server, port: number, host: string, ipv6Only = false): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new AccessError('Listener ports must be between 1 and 65535.', 400);
  server.maxConnections = 128;
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.setTimeout(120_000, socket => socket.destroy());
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen({ port, host, ipv6Only }, () => { server.off('error', reject); resolve(); }); });
}
function closeGroup(group: ServerGroup) {
  for (const server of group) { server.close(); server.closeAllConnections(); }
}
async function listenRemote(create: () => http.Server, port: number): Promise<ServerGroup> {
  const group: ServerGroup = [];
  try {
    const ipv4 = create(); await listen(ipv4, port, '0.0.0.0'); group.push(ipv4);
    const ipv6 = create();
    try { await listen(ipv6, port, '::', true); group.push(ipv6); }
    catch (error) { if (!['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes((error as NodeJS.ErrnoException).code || '')) throw error; }
    return group;
  } catch (error) { closeGroup(group); throw error; }
}
function surface(channel: Channel): Express {
  const entry = createApp(access);
  // Boundary checks also cover static content and run before JSON parsing.
  const wrapper = createAppWrapper(entry, channel);
  return wrapper;
}
import express from 'express';
function createAppWrapper(entry: Express, channel: Channel) {
  const wrapper = express(); wrapper.disable('x-powered-by'); wrapper.set('trust proxy', false);
  wrapper.use(access.boundary(channel)); wrapper.use(entry); return wrapper;
}
async function applySettings(settings: NetworkSettings) {
  if (settings.lanEnabled && lan && lanTLS !== settings.lanPassword) throw new AccessError('Disable LAN access before changing password mode, then enable it again.', 409);
  const started: http.Server[] = [];
  let newLan: ServerGroup | undefined;
  let newInternet: ServerGroup | undefined;
  try {
    if (settings.lanEnabled && !lan) {
      const options = settings.lanPassword ? tls() : undefined;
      newLan = await listenRemote(() => options ? https.createServer(options, surface('lan')) : http.createServer(surface('lan')), Number(process.env.GENERY_LAN_PORT || 3002));
      started.push(...newLan);
    }
    if (settings.internetEnabled && !internet) {
      const options = tls();
      newInternet = await listenRemote(() => https.createServer(options, surface('internet')), Number(process.env.GENERY_INTERNET_PORT || 3443));
      started.push(...newInternet);
    }
  } catch (error) { for (const server of started) { server.close(); server.closeAllConnections(); } throw error; }
  return {
    commit() {
      if (newLan) { lan = newLan; lanTLS = settings.lanPassword; }
      if (newInternet) internet = newInternet;
      if (!settings.lanEnabled && lan) { closeGroup(lan); lan = undefined; }
      if (!settings.internetEnabled && internet) { closeGroup(internet); internet = undefined; }
    },
    async rollback() {
      await Promise.all(started.map(server => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); })));
    },
  };
}

const access = new AccessControl(store, applySettings);
(await applySettings(store.settings())).commit();
const local = http.createServer(surface('local'));
await listen(local, Number(process.env.PORT || 3001), '127.0.0.1');
console.log(`Genery local control: http://127.0.0.1:${process.env.PORT || 3001}`);
