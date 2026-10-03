import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { AccessError, Grant, Principal, validateGrants } from './paths.js';

export interface Account extends Principal { salt: string; hash: string; hashVersion?: 2 }
export interface NetworkSettings {
  lanEnabled: boolean; lanPassword: boolean; internetEnabled: boolean; publicOrigin: string;
  guestRole: 'normal' | 'moderator'; guestGrants: Grant[];
}
interface State { version: 1; settings: NetworkSettings; users: Account[] }
const defaults: NetworkSettings = { lanEnabled: false, lanPassword: true, internetEnabled: false, publicOrigin: '', guestRole: 'normal', guestGrants: [] };
export function hashPassword(password: string, salt: string, cost = 131072): Promise<string> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: cost, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key.toString('hex'))));
}
export function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 15 || value.length > 128 || new Set(value).size < 6 || /^(password|123456|qwerty|letmein)/i.test(value)) throw new AccessError('Use a unique password of 15–128 characters (at least 6 distinct characters).', 400);
  return value;
}
export function publicUser(user: Principal): Principal { return { id: user.id, username: user.username, role: user.role, grants: user.grants }; }
export class SecurityStore {
  state: State;
  private changing = false;
  private accountGeneration = 0;
  constructor(private filename = process.env.GENERY_ACCESS_PATH || path.join(os.homedir(), '.genery', 'access.json')) {
    // Fail closed on corrupt security configuration rather than resetting to open access.
    this.state = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : { version: 1, settings: { ...defaults }, users: [] };
    if (this.state.version !== 1 || !Array.isArray(this.state.users) || !this.state.settings || typeof this.state.settings.lanEnabled !== 'boolean' || typeof this.state.settings.internetEnabled !== 'boolean') throw new Error('Invalid security configuration. Restore access.json locally.');
    const settings = this.state.settings;
    if (typeof settings.lanPassword !== 'boolean' || typeof settings.publicOrigin !== 'string' || !['normal', 'moderator'].includes(settings.guestRole) || !Array.isArray(settings.guestGrants)) throw new Error('Invalid network security configuration.');
    const validGrants = (grants: Grant[]) => Array.isArray(grants) && grants.every(grant => typeof grant?.path === 'string' && path.isAbsolute(grant.path) && !grant.path.includes('\0') && typeof grant.recursive === 'boolean');
    if (!validGrants(settings.guestGrants) || this.state.users.some(user => !user || typeof user.id !== 'string' || typeof user.username !== 'string' || !['admin', 'moderator', 'normal'].includes(user.role) || !/^[a-f0-9]{64}$/.test(user.salt) || !/^[a-f0-9]{128}$/.test(user.hash) || !validGrants(user.grants) || user.hashVersion !== undefined && user.hashVersion !== 2 || user.role !== 'admin' && !user.grants.length)) throw new Error('Invalid account security configuration.');
    if (settings.lanEnabled && !settings.lanPassword && !settings.guestGrants.length) throw new Error('Guest directories are required.');
    if (settings.internetEnabled) {
      const origin = new URL(settings.publicOrigin);
      if (origin.protocol !== 'https:' || origin.origin !== settings.publicOrigin || !this.state.users.some(user => user.role === 'admin')) throw new Error('Invalid internet security configuration.');
    }
    if (settings.lanEnabled && settings.lanPassword && !this.state.users.some(user => user.role === 'admin')) throw new Error('LAN authentication requires an administrator.');
    if (fs.existsSync(filename)) fs.chmodSync(filename, 0o600);
  }
  private save(state: State) {
    fs.mkdirSync(path.dirname(this.filename), { recursive: true, mode: 0o700 });
    const temporary = `${this.filename}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
      fs.renameSync(temporary, this.filename);
      this.state = state;
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  settings() { return structuredClone(this.state.settings); }
  users() { return this.state.users.map(publicUser); }
  async createUser(body: any, authorize: () => void = () => {}) {
    if (this.changing) throw new AccessError('Account update in progress. Try again.', 409);
    this.changing = true;
    try {
      if (!body || typeof body.username !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,63}$/.test(body.username)) throw new AccessError('Username must be 3–64 letters, digits, dots, underscores, or hyphens.', 400);
      const username = body.username.toLowerCase();
      if (this.state.users.length >= 100 || this.state.users.some(user => user.username === username)) throw new AccessError('Username unavailable or account limit reached.', 400);
      if (!['admin', 'moderator', 'normal'].includes(body.role)) throw new AccessError('Choose a valid role.', 400);
      const grants = body.role === 'admin' ? [] : validateGrants(body.grants);
      const salt = randomBytes(32).toString('hex');
      const hash = await hashPassword(validatePassword(body.password), salt);
      const user: Account = { id: randomUUID(), username, role: body.role, grants, salt, hash, hashVersion: 2 };
      authorize();
      this.save({ ...this.state, users: [...this.state.users, user] });
      return publicUser(user);
    } finally { this.changing = false; }
  }
  async updateUser(id: string, body: any, authorize: () => void = () => {}) {
    this.accountGeneration++;
    if (this.changing) throw new AccessError('Account update in progress. Try again.', 409);
    this.changing = true;
    try {
      const old = this.state.users.find(user => user.id === id);
      if (!old) throw new AccessError('Account not found.', 404);
      if (!body || !['admin', 'moderator', 'normal'].includes(body.role)) throw new AccessError('Choose a valid role.', 400);
      if (old.role === 'admin' && body.role !== 'admin' && !this.state.users.some(user => user.id !== id && user.role === 'admin')) throw new AccessError('Keep at least one administrator.', 400);
      const next = { ...old, role: body.role, grants: body.role === 'admin' ? [] : validateGrants(body.grants) };
      if (body.password !== undefined && body.password !== '') { next.salt = randomBytes(32).toString('hex'); next.hash = await hashPassword(validatePassword(body.password), next.salt); next.hashVersion = 2; }
      authorize();
      this.save({ ...this.state, users: this.state.users.map(user => user.id === id ? next : user) });
      return publicUser(next);
    } finally { this.changing = false; }
  }
  deleteUser(id: string) {
    this.accountGeneration++;
    if (this.changing) throw new AccessError('Account update in progress. Try again.', 409);
    const user = this.state.users.find(user => user.id === id);
    if (!user) throw new AccessError('Account not found.', 404);
    if (user.role === 'admin' && !this.state.users.some(other => other.id !== id && other.role === 'admin')) throw new AccessError('Keep at least one administrator.', 400);
    this.save({ ...this.state, users: this.state.users.filter(user => user.id !== id) });
  }
  validateSettings(body: any): NetworkSettings {
    if (!body || ['lanEnabled', 'lanPassword', 'internetEnabled'].some(key => typeof body[key] !== 'boolean') || !['normal', 'moderator'].includes(body.guestRole)) throw new AccessError('Invalid network settings.', 400);
    let publicOrigin = '';
    if (body.publicOrigin) {
      try { const url = new URL(body.publicOrigin); if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error(); publicOrigin = url.origin; }
      catch { throw new AccessError('Provide a public HTTPS origin, without a path.', 400); }
    }
    if ((body.internetEnabled || (body.lanEnabled && body.lanPassword)) && !this.state.users.some(user => user.role === 'admin')) throw new AccessError('Create an administrator account before enabling password access.', 400);
    if (body.internetEnabled && !publicOrigin) throw new AccessError('Internet access requires a public HTTPS origin.', 400);
    const guestGrants = body.guestGrants?.length ? validateGrants(body.guestGrants) : [];
    if (body.lanEnabled && !body.lanPassword && !guestGrants.length) throw new AccessError('Choose allowed guest directories before enabling password-free LAN access.', 400);
    return { lanEnabled: body.lanEnabled, lanPassword: body.lanPassword, internetEnabled: body.internetEnabled, publicOrigin, guestRole: body.guestRole, guestGrants };
  }
  saveSettings(settings: NetworkSettings) { this.save({ ...this.state, settings }); }
  async authenticate(username: unknown, password: unknown): Promise<Principal | null> {
    if (typeof username !== 'string' || username.length > 64 || typeof password !== 'string' || password.length > 128) return null;
    const generation = this.accountGeneration;
    const user = this.state.users.find(user => user.username === username.toLowerCase());
    const candidate = await hashPassword(password, user?.salt || '0'.repeat(64), user && user.hashVersion !== 2 ? 32768 : 131072);
    const expected = user?.hash || '0'.repeat(128);
    const matches = timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(expected, 'hex'));
    // An account/password/grant update during hashing invalidates this attempt.
    if (!matches || this.changing || generation !== this.accountGeneration || !user || this.state.users.find(current => current.id === user.id) !== user) return null;
    if (user.hashVersion === 2) return publicUser(user);
    const upgraded: Account = { ...user, hash: await hashPassword(password, user.salt), hashVersion: 2 };
    if (this.changing || generation !== this.accountGeneration || this.state.users.find(current => current.id === user.id) !== user) return null;
    this.save({ ...this.state, users: this.state.users.map(current => current.id === user.id ? upgraded : current) });
    return publicUser(upgraded);
  }
}
