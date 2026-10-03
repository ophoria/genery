import fs from 'node:fs';
import { Transform, pipeline } from 'node:stream';
import type { Request, Response } from 'express';
import { AccessError, authorizePath } from './paths.js';

// Open the authorized file before streaming. O_NOFOLLOW closes the final-component
// symlink race; verify its inode after a second complete path/grant check as well.
export function openImage(req: Request) {
  const user = req.access.currentUser();
  const file = authorizePath(user, req.query.path);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (user.role === 'admin' ? 0 : fs.constants.O_NOFOLLOW));
  try {
    const opened = fs.fstatSync(fd);
    authorizePath(req.access.currentUser(), file);
    const current = fs.statSync(file);
    if (!opened.isFile() || opened.ino !== current.ino || opened.dev !== current.dev) throw new AccessError('The image changed. Retry the request.', 409);
    return { file, fd };
  } catch (error) { fs.closeSync(fd); throw error; }
}
export function streamImage(req: Request, res: Response, file: string, fd: number) {
  const source = fs.createReadStream(file, { fd, autoClose: true });
  const gate = new Transform({ transform(chunk, _encoding, callback) {
    try { authorizePath(req.access.currentUser(), file); callback(null, chunk); }
    catch (error) { callback(error as Error); }
  } });
  return new Promise<void>(resolve => {
    pipeline(source, gate, res, () => { resolve(); });
  });
}
