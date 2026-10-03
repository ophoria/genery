import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type Role = 'admin' | 'moderator' | 'normal';
export interface Grant { path: string; recursive: boolean }
export interface Principal { id: string; username: string; role: Role; grants: Grant[] }
export class AccessError extends Error {
  constructor(message = 'Access denied.', public status = 403) { super(message); }
}
export const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.avif', '.tiff', '.tif', '.ico']);
export function absolutePath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096 || value.includes('\0')) throw new AccessError('Provide a valid path.', 400);
  return path.resolve(value === '~' ? os.homedir() : value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value);
}
function inside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
// Reject symlinks in every component. Do not let a replaced grant root silently move permissions.
export function noSymlinks(target: string, allowMissing = false): void {
  const parsed = path.parse(target);
  let current = parsed.root;
  for (const component of target.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new AccessError('Symbolic links are not accessible.'); }
    catch (error) { if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  }
}
export function validateGrants(value: unknown): Grant[] {
  if (!Array.isArray(value) || !value.length || value.length > 64) throw new AccessError('Choose 1–64 allowed directories.', 400);
  return value.map(item => {
    if (!item || typeof item.recursive !== 'boolean') throw new AccessError('Each directory needs a subdirectory setting.', 400);
    const target = absolutePath(item.path);
    const canonical = fs.realpathSync(target);
    noSymlinks(canonical);
    if (!fs.statSync(canonical).isDirectory()) throw new AccessError('Grants must be directories.', 400);
    return { path: canonical, recursive: item.recursive };
  });
}
export function authorizePath(user: Principal, value: unknown, kind: 'image' | 'directory' | 'destination' = 'image'): string {
  const target = absolutePath(value);
  if (user.role !== 'admin') {
    const allowed = user.grants.some(grant => inside(grant.path, target) && (grant.recursive || target === grant.path || (kind !== 'directory' && path.dirname(target) === grant.path)));
    if (!allowed) throw new AccessError();
    noSymlinks(target, kind === 'destination');
  }
  if (kind === 'image') {
    if (!imageExtensions.has(path.extname(target).toLowerCase()) || !fs.statSync(target).isFile()) throw new AccessError('An image file is required.', 400);
  } else if (kind === 'directory' && !fs.statSync(target).isDirectory()) throw new AccessError('A directory is required.', 400);
  return target;
}
export function canAccess(user: Principal, value: unknown, kind: 'image' | 'directory' = 'image'): boolean {
  try { authorizePath(user, value, kind); return true; } catch { return false; }
}
export function safeBasename(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 200 || /[\\/\x00-\x1f]/.test(value) || value === '.' || value === '..') throw new AccessError('Use a filename without path separators.', 400);
  return value;
}
