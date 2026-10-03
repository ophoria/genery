import express from 'express';
import { AccessControl, authorizeAPI } from './security/access.js';
import { AccessError, authorizePath, canAccess } from './security/paths.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import { scanDirectory } from './scanner.js';
import { metadataStore, validateMetadataImport } from './metadataStore.js';
import { executeBatchOperation } from './operations.js';
import { openImage, streamImage } from './security/media.js';
import { limited, WorkPool } from './security/work.js';
import { aiRouter } from './ai/routes.js';

export function createApp(access: AccessControl) {
const app = express();
const scans = new WorkPool(2, 8);
const thumbnails = new WorkPool(4, 128);
const batches = new WorkPool(1, 8);
const media = new WorkPool(16, 64);
app.disable('x-powered-by');
app.set('trust proxy', false);
app.use('/api/access/login', express.json({ limit: '1kb' }));
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/') && !req.access.user && !['/api/access/login', '/api/access/session', '/api/access/logout'].includes(req.path)) return next(new AccessError('Sign in to continue.', 401));
  next();
});
app.use(express.json({ limit: '5mb' }));
app.use(access.authRoutes);
app.use('/api', (req, res, next) => {
  // Express strips mount prefixes; policy always sees the complete route.
  const mounted = req.url; req.url = '/api' + mounted;
  authorizeAPI(req, res, error => { req.url = mounted; next(error); });
});
app.use('/api/ai', aiRouter);

function resolveLocalPath(value: string): string {
  const expanded = value === '~' ? os.homedir()
    : value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value;
  return path.resolve(expanded);
}

function getDefaultDir(): string {
  const testGallery = path.join(process.cwd(), 'test-gallery');
  if (fs.existsSync(testGallery)) {
    return testGallery;
  }
  return os.homedir();
}

// API: Scan Directory
app.get('/api/scan', limited(scans, async (req, res) => {
  try {
    const rawDir = req.query.dir as string;
    const user = req.access.user!;
    const dirPath = authorizePath(user, rawDir && rawDir.trim() ? resolveLocalPath(rawDir) : user.role === 'admin' ? getDefaultDir() : user.grants[0]?.path, 'directory');
    const subdirs = req.query.subdirs === 'true';

    if (!fs.existsSync(dirPath)) {
      return res.status(400).json({ error: `Directory path does not exist: ${dirPath}` });
    }

    const result = await scanDirectory(dirPath, subdirs, (file, kind) => canAccess(req.access.currentUser(), file, kind));
    const latest = req.access.currentUser();
    authorizePath(latest, dirPath, 'directory');
    result.images = result.images.filter(image => canAccess(latest, image.path));
    result.totalFound = result.images.length;
    result.availableTypes = [...new Set(result.images.map(image => image.extension))].sort();
    res.json(result);
  } catch (err: any) {
    res.status(err instanceof AccessError ? err.status : 400).json({ error: err instanceof AccessError ? err.message : 'Could not scan directory.' });
  }
}));

// API: Browse Directory Structure
app.get('/api/browse', (req, res) => {
  try {
    let rawPath = req.query.path as string;
    const user = req.access.user!;
    let targetPath = authorizePath(user, rawPath && rawPath.trim() ? resolveLocalPath(rawPath) : user.role === 'admin' ? os.homedir() : user.grants[0]?.path, 'directory');
    if (!fs.existsSync(targetPath)) {
      return res.status(400).json({ error: `Directory path does not exist: ${targetPath}` });
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      targetPath = path.dirname(targetPath);
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const directories = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && canAccess(user, path.join(targetPath, e.name), 'directory'))
      .map((e) => {
        const full = path.join(targetPath, e.name);
        let createdAt: number | null = null;
        try {
          const birthtime = fs.statSync(full).birthtimeMs;
          if (Number.isFinite(birthtime) && birthtime > 0) createdAt = birthtime;
        } catch { /* Keep inaccessible folders browsable without a date. */ }
        let hasSubdirs = false;
        try {
          hasSubdirs = fs.readdirSync(full, { withFileTypes: true }).some((sub) => sub.isDirectory() && !sub.name.startsWith('.') && canAccess(user, path.join(full, sub.name), 'directory'));
        } catch {
          hasSubdirs = false;
        }
        return {
          name: e.name,
          path: full,
          hasSubdirs,
          createdAt,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const parentPath = path.dirname(targetPath);

    res.json({
      currentPath: targetPath,
      homePath: user.role === 'admin' ? os.homedir() : user.grants[0]?.path,
      roots: user.grants,
      parentPath: parentPath !== targetPath && canAccess(user, parentPath, 'directory') ? parentPath : null,
      directories,
    });
  } catch (err: any) {
    res.status(err instanceof AccessError ? err.status : 400).json({ error: err instanceof AccessError ? err.message : 'Could not browse directory.' });
  }
});

// API: Serve Raw Image File
app.get('/api/image', limited(media, async (req, res) => {
  try {
    const { file: filePath, fd } = openImage(req);

    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.avif': 'image/avif',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      '.ico': 'image/x-icon',
    };

    const mimeType = mimeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'no-store');
    if (ext === '.svg') { res.setHeader('Content-Disposition', 'attachment'); res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'"); }
    await streamImage(req, res, filePath, fd);
  } catch (err: any) {
    res.status(err instanceof AccessError ? err.status : 400).send('Could not read image.');
  }
}));

// API: Serve Optimized Thumbnail
app.get('/api/thumbnail', limited(thumbnails, async (req, res) => {
  let fd: number | undefined;
  try {
    const width = Number(req.query.width || '320');
    if (!Number.isInteger(width) || width < 16 || width > 2048) return res.status(400).json({ error: 'Thumbnail width must be 16–2048.' });
    const opened = openImage(req); fd = opened.fd;
    const filePath = opened.file;
    if (fs.fstatSync(fd).size > 64 * 1024 * 1024) throw new AccessError('Image is too large for thumbnail decoding. View the original.', 413);
    if (path.extname(filePath).toLowerCase() === '.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
      res.setHeader('Content-Disposition', 'attachment');
      const completed = streamImage(req, res, filePath, fd); fd = undefined; await completed; return;
    }
    // Read from the checked descriptor, with bounded decoding and output size.
    const input = fs.createReadStream(filePath, { fd, autoClose: true }); fd = undefined;
    const transform = sharp({ limitInputPixels: 40_000_000 }).resize(width, width, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 });
    input.on('error', error => transform.destroy(error));
    transform.on('close', () => input.destroy());
    const disconnected = () => transform.destroy(new Error('Request ended.'));
    res.once('close', disconnected);
    input.pipe(transform);
    let thumbnail: Buffer;
    try { thumbnail = await transform.toBuffer(); }
    finally { res.off('close', disconnected); }
    authorizePath(req.access.currentUser(), filePath);
    res.type('webp').send(thumbnail);
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    if (!res.headersSent) res.status(error instanceof AccessError ? error.status : 400).json({ error: 'Could not decode thumbnail. Try viewing the original image.' });
  }
}));

// Export the complete metadata file, independently of the current gallery filters.
app.get('/api/metadata/export', (req, res) => {
  if (req.access.user!.role !== 'admin') {
    const filtered = Object.fromEntries(Object.entries(metadataStore.getAll()).filter(([file]) => canAccess(req.access.user!, file)));
    return res.attachment('genery_image_metadata.json').json(filtered);
  }
  const storePath = process.env.GENERY_METADATA_PATH || path.join(os.homedir(), '.genery_image_metadata.json');
  res.setHeader('Cache-Control', 'no-store');
  if (!fs.existsSync(storePath)) {
    res.attachment('genery_image_metadata.json').type('json').send('{}\n');
    return;
  }
  res.download(storePath, 'genery_image_metadata.json', { dotfiles: 'allow' }, (error) => {
    if (error && !res.headersSent) {
      res.status(500).json({ error: 'Could not read image metadata. Please try again.' });
    }
  });
});

// API: Update Metadata (score, hashtags, comment)
app.post('/api/metadata/import', (req, res) => {
  try {
    validateMetadataImport(req.body);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid metadata file.' });
  }
  try {
    const result = metadataStore.importMetadata(req.body);
    res.json({ ...result, backupPath: req.access.user!.role === 'admin' ? result.backupPath : null });
  } catch (error) {
    res.status(500).json({ error: 'Could not save imported metadata. Check that the metadata folder is writable and try again.' });
  }
});

app.post('/api/metadata', (req, res) => {
  try {
    const { path: filePath, score, hashtags, comment } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'Image path is required' });
    }

    const fields = Object.fromEntries(Object.entries({ score, hashtags, comment }).filter(([, value]) => value !== undefined));
    validateMetadataImport({ [filePath]: fields });
    let meta = metadataStore.get(filePath);

    if (score !== undefined) {
      meta = metadataStore.setScore(filePath, score);
    }
    if (hashtags !== undefined) {
      meta = metadataStore.setHashtags(filePath, hashtags);
    }
    if (comment !== undefined) {
      meta = metadataStore.setComment(filePath, comment);
    }

    res.json({ success: true, metadata: meta });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Batch Operations (copy, delete, rename, zip)
app.post('/api/batch', limited(batches, async (req, res) => {
  try {
    const result = await executeBatchOperation(req.body, (file, kind) => {
      const user = req.access.currentUser();
      if (user.role === 'normal' || req.body.action === 'delete' && user.role !== 'admin') throw new AccessError();
      return authorizePath(user, file, kind);
    });
    res.json(result);
  } catch (err: any) {
    res.status(err instanceof AccessError ? err.status : 400).json({ error: err instanceof AccessError ? err.message : 'Batch operation could not be completed.' });
  }
}));

app.use(express.static(path.join(process.cwd(), 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Unknown endpoint.' });
  res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return res.end();
  const status = error instanceof AccessError ? error.status : error.status === 413 ? 413 : 400;
  res.status(status).json({ error: error instanceof AccessError ? error.message : 'Request could not be completed.' });
});
return app;
}
