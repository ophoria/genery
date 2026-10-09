import type { Request, Response, NextFunction } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import net from 'node:net';
import { isPrivatePeer } from './peers.js';
export { isPrivatePeer } from './peers.js';
import { connectionInfo, lanHosts } from './connections.js';
import { AccessError, Principal, authorizePath, safeBasename } from './paths.js';
import { SecurityStore, publicUser, NetworkSettings } from './store.js';

export interface NetworkChange { commit: () => void; rollback: () => Promise<void> }
export type Channel = 'local' | 'lan' | 'internet';
export interface AccessContext { channel: Channel; user: Principal | null; currentUser: () => Principal }
declare global { namespace Express { interface Request { access: AccessContext } } }
const owner: Principal = { id: 'local-owner', username: 'Local owner', role: 'admin', grants: [] };

interface Session { userId: string; channel: Channel; created: number; touched: number }
export class AccessControl {
  private sessions = new Map<string, Session>();
  private attempts = new Map<string, { count: number; until: number }>();
  private loginBusy = 0;
  private settingsBusy = false;
  private generation = 0;
  private accountAttempts = new Map<string, { count: number; until: number }>();
  constructor(public store: SecurityStore, private prepareSettings: (settings: NetworkSettings) => Promise<NetworkChange | void> = async () => {}, private now: () => number = Date.now) {}
  revoke() { this.generation++; this.sessions.clear(); }
  private cookieName(channel: Channel) { return channel === 'internet' ? '__Host-genery-session' : channel === 'lan' ? 'genery-lan-session' : 'genery-local-session'; }
  private sessionKey(req: Request) {
    const value = req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith(`${this.cookieName(req.access.channel)}=`))?.split('=')[1];
    return value && /^[a-f0-9]{64}$/.test(value) ? createHash('sha256').update(value).digest('hex') : '';
  }
  private cleanup(now: number) {
    for (const [key, value] of this.sessions) if (now - value.touched >= 30 * 60_000 || now - value.created >= 12 * 3600_000) this.sessions.delete(key);
    for (const [key, value] of this.accountAttempts) if (value.until <= now) this.accountAttempts.delete(key);
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
  }
  boundary(channel: Channel) {
    return (req: Request, res: Response, next: NextFunction) => {
      req.access = { channel, user: null, currentUser: () => { throw new AccessError('Sign in to continue.', 401); } };
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      if (channel === 'internet' && req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      const settings = this.store.settings();
      if (channel === 'lan' && (!settings.lanEnabled || !isPrivatePeer(req.socket.remoteAddress))) return res.status(403).json({ error: 'LAN access is disabled or the connection is outside the local network.' });
      if (channel === 'internet' && (!settings.internetEnabled || !req.secure)) return res.status(403).json({ error: 'Internet access requires HTTPS and must be enabled locally.' });
      let host: URL;
      try { host = new URL(`${req.secure ? 'https' : 'http'}://${req.headers.host}`); } catch { return res.status(400).json({ error: 'Invalid host.' }); }
      const hostname = host.hostname.replace(/^\[|\]$/g, '');
      if (channel === 'local' && (!['localhost', '127.0.0.1', '::1'].includes(hostname) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || ''))) return res.status(403).json({ error: 'Local access requires loopback.' });
      if (channel === 'lan' && !(net.isIP(hostname) && isPrivatePeer(hostname)) && hostname !== 'localhost') return res.status(403).json({ error: 'Use the LAN IP address.' });
      if (channel === 'internet' && host.origin !== settings.publicOrigin) return res.status(403).json({ error: 'Unrecognized public origin.' });
      if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Cross-site requests are forbidden.' });
      if (!['GET', 'HEAD'].includes(req.method)) {
        const origin = req.headers.origin;
        const permitted = channel === 'local' ? [host.origin, 'http://localhost:5173', 'http://127.0.0.1:5173'] : [host.origin];
        if (!origin || !permitted.includes(origin)) return res.status(403).json({ error: 'A same-origin request is required.' });
        if (!req.is('application/json')) return res.status(415).json({ error: 'Use application/json.' });
      }
      const now = this.now();
      this.cleanup(now);
      const session = this.sessions.get(this.sessionKey(req));
      if (session && session.channel === channel) {
        const user = this.store.state.users.find(user => user.id === session.userId);
        if (user) {
          req.access.user = publicUser(user);
          // Background status/session polling must not keep an unattended login alive.
          if (!['/api/access/session', '/api/ai/status', '/api/ai/results'].includes(req.path)) session.touched = now;
        }
      }
      if (channel === 'local' && !req.access.user) req.access.user = owner;
      if (channel === 'lan' && !settings.lanPassword && !req.access.user) req.access.user = { id: 'lan-guest', username: 'LAN guest', role: settings.guestRole, grants: settings.guestGrants };
      const initial = req.access.user;
      const sessionKey = this.sessionKey(req);
      req.access.currentUser = () => {
        if (!initial) throw new AccessError('Sign in to continue.', 401);
        if (initial.id === owner.id) return owner;
        if (initial.id === 'lan-guest') {
          const latest = this.store.settings();
          if (!latest.lanEnabled || latest.lanPassword) throw new AccessError('Access was changed. Sign in again.', 401);
          return { ...initial, role: latest.guestRole, grants: latest.guestGrants };
        }
        this.cleanup(this.now());
        if (!this.sessions.has(sessionKey)) throw new AccessError('Your session expired. Sign in again.', 401);
        const latest = this.store.state.users.find(account => account.id === initial.id);
        if (!latest) throw new AccessError('Your session expired. Sign in again.', 401);
        return publicUser(latest);
      };
      next();
    };
  }
  authRoutes = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/access/')) return next();
    try {
      const { channel, user } = req.access;
      if (req.path === '/api/access/session' && req.method === 'GET') return res.json({ channel, user, connections: user ? { ...connectionInfo(this.store.settings()), ...(channel === 'internet' ? { lan: [] } : {}) } : { lan: [], internet: null }, canManageUsers: user?.role === 'admin' && channel !== 'internet', canManageNetwork: user?.id === owner.id, loginRequired: !user });
      if (req.path === '/api/access/login' && req.method === 'POST') {
        if (channel !== 'local' && !req.secure) throw new AccessError('Account login requires HTTPS.');
        const now = this.now();
        const key = req.socket.remoteAddress || 'unknown';
        const bucket = this.attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
        const accountKey = createHash('sha256').update(typeof req.body?.username === 'string' ? req.body.username.toLowerCase().slice(0, 64) : '').digest('hex');
        const accountBucket = this.accountAttempts.get(accountKey) || { count: 0, until: now + 15 * 60_000 };
        if (bucket.count >= 10 || accountBucket.count >= 10 || this.accountAttempts.size >= 10000 || this.loginBusy >= 4 || this.attempts.size >= 10000 || this.sessions.size >= 10000) throw new AccessError('Too many login attempts. Try again later.', 429);
        bucket.count++; this.attempts.set(key, bucket);
        accountBucket.count++; this.accountAttempts.set(accountKey, accountBucket);
        const generation = this.generation;
        this.loginBusy++;
        let authenticated: Principal | null;
        try { authenticated = await this.store.authenticate(req.body?.username, req.body?.password); } finally { this.loginBusy--; }
        if (generation !== this.generation) throw new AccessError('Access changed while signing in. Try again.', 401);
        if (!authenticated) throw new AccessError('Invalid username or password.', 401);
        this.sessions.delete(this.sessionKey(req));
        const token = randomBytes(32).toString('hex');
        this.sessions.set(createHash('sha256').update(token).digest('hex'), { userId: authenticated.id, channel, created: now, touched: now });
        res.cookie(this.cookieName(channel), token, { httpOnly: true, secure: req.secure, sameSite: 'strict', path: '/', maxAge: 12 * 3600_000 });
        return res.json({ user: authenticated });
      }
      if (req.path === '/api/access/logout' && req.method === 'POST') {
        this.sessions.delete(this.sessionKey(req));
        res.clearCookie(this.cookieName(channel), { httpOnly: true, secure: req.secure, sameSite: 'strict', path: '/' });
        return res.json({ success: true });
      }
      if (!user) throw new AccessError('Sign in to continue.', 401);
      if (user.role !== 'admin' || channel === 'internet') throw new AccessError('Account management requires a local or LAN administrator.');
      const authorizeAccountChange = () => {
        if (req.access.currentUser().role !== 'admin') throw new AccessError('Administrator access was changed.');
      };
      if (req.path === '/api/access/users' && req.method === 'GET') return res.json({ users: this.store.users() });
      if (req.path === '/api/access/users' && req.method === 'POST') { const account = await this.store.createUser(req.body, authorizeAccountChange); return res.status(201).json({ user: account }); }
      const match = req.path.match(/^\/api\/access\/users\/([a-f0-9-]+)$/);
      if (match && req.method === 'PATCH') { const account = await this.store.updateUser(match[1], req.body, authorizeAccountChange); this.revoke(); return res.json({ user: account }); }
      if (match && req.method === 'DELETE') { this.store.deleteUser(match[1]); this.revoke(); return res.json({ success: true }); }
      if (req.path === '/api/access/settings') {
        if (user.id !== owner.id || channel !== 'local') throw new AccessError('Change network settings from the local machine.');
        if (req.method === 'GET') return res.json({ settings: this.store.settings(), connections: connectionInfo(this.store.settings()), lanHosts: lanHosts(), tlsConfigured: Boolean(process.env.GENERY_TLS_CERT && process.env.GENERY_TLS_KEY) });
        if (req.method === 'POST') {
          if (this.settingsBusy) throw new AccessError('Network settings are being changed. Try again.', 409);
          this.settingsBusy = true;
          try {
            const settings = this.store.validateSettings(req.body);
            const change = await this.prepareSettings(settings);
            try { this.store.saveSettings(settings); }
            catch (error) { await change?.rollback(); throw error; }
            change?.commit(); this.revoke();
            return res.json({ settings, connections: connectionInfo(settings), lanHosts: lanHosts() });
          } finally { this.settingsBusy = false; }
        }
      }
      throw new AccessError('Unknown access endpoint.', 404);
    } catch (error) { next(error); }
  };
}

export function authorizeAPI(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = req.access.user;
    if (!user) throw new AccessError('Sign in to continue.', 401);
    const route = `${req.method} ${req.path}`;
    const read = new Set(['GET /api/scan', 'GET /api/browse', 'GET /api/image', 'GET /api/thumbnail', 'GET /api/metadata/export', 'POST /api/ai/results', 'GET /api/ai/status']);
    const write = new Set(['POST /api/metadata', 'POST /api/metadata/import', 'POST /api/batch', 'POST /api/ai/analyze', 'POST /api/ai/clear', 'POST /api/ai/cancel', 'POST /api/ai/settings', 'POST /api/ai/install']);
    if (!read.has(route) && !write.has(route)) throw new AccessError('Unknown API endpoint.', 404);
    if ((write.has(route) && user.role === 'normal')) throw new AccessError();
    if (['GET /api/image', 'GET /api/thumbnail'].includes(route)) req.query.path = authorizePath(user, req.query.path);
    if (route === 'POST /api/metadata' || route === 'POST /api/ai/clear') req.body.path = authorizePath(user, req.body?.path);
    if (route === 'POST /api/metadata/import') {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new AccessError('Invalid metadata.', 400);
      if (user.role !== 'admin') for (const file of Object.keys(req.body)) authorizePath(user, file);
    }
    if (['POST /api/ai/results', 'POST /api/ai/analyze'].includes(route)) {
      if (!Array.isArray(req.body?.paths) || req.body.paths.length > 5000) throw new AccessError('Provide up to 5000 image paths.', 400);
      req.body.paths = req.body.paths.map((file: unknown) => authorizePath(user, file));
    }
    if (route === 'POST /api/batch') {
      if (!req.body || !['copy', 'rename', 'zip', 'delete'].includes(req.body.action) || !Array.isArray(req.body.imagePaths) || !req.body.imagePaths.length || req.body.imagePaths.length > 5000) throw new AccessError('Invalid batch operation.', 400);
      if (req.body.action === 'delete' && user.role !== 'admin') throw new AccessError('Only administrators can delete files.');
      req.body.imagePaths = req.body.imagePaths.map((file: unknown) => authorizePath(user, file));
      if (req.body.targetDirectory) req.body.targetDirectory = authorizePath(user, req.body.targetDirectory, 'destination');
      if (req.body.renamePattern) safeBasename(req.body.renamePattern);
      if (req.body.zipFileName) safeBasename(req.body.zipFileName);
    }
    next();
  } catch (error) { next(error); }
}
