import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import { scanDirectory } from './scanner.js';
import { metadataStore } from './metadataStore.js';
import { executeBatchOperation } from './operations.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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
app.get('/api/scan', async (req, res) => {
  try {
    const rawDir = req.query.dir as string;
    const dirPath = rawDir && rawDir.trim() ? resolveLocalPath(rawDir) : getDefaultDir();
    const subdirs = req.query.subdirs === 'true';

    if (!fs.existsSync(dirPath)) {
      return res.status(400).json({ error: `Directory path does not exist: ${dirPath}` });
    }

    const result = await scanDirectory(dirPath, subdirs);
    res.json(result);
  } catch (err: any) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message || 'Failed to scan directory' });
  }
});

// API: Browse Directory Structure
app.get('/api/browse', (req, res) => {
  try {
    let rawPath = req.query.path as string;
    let targetPath = rawPath && rawPath.trim() ? resolveLocalPath(rawPath) : os.homedir();
    if (!fs.existsSync(targetPath)) {
      return res.status(400).json({ error: `Directory path does not exist: ${targetPath}` });
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      targetPath = path.dirname(targetPath);
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const directories = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => {
        const full = path.join(targetPath, e.name);
        let hasSubdirs = false;
        try {
          hasSubdirs = fs.readdirSync(full, { withFileTypes: true }).some((sub) => sub.isDirectory() && !sub.name.startsWith('.'));
        } catch {
          hasSubdirs = false;
        }
        return {
          name: e.name,
          path: full,
          hasSubdirs,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const parentPath = path.dirname(targetPath);

    res.json({
      currentPath: targetPath,
      homePath: os.homedir(),
      parentPath: parentPath !== targetPath ? parentPath : null,
      directories,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to browse directory' });
  }
});

// API: Serve Raw Image File
app.get('/api/image', (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('Image file not found');
    }

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
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// API: Serve Optimized Thumbnail
app.get('/api/thumbnail', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    const width = parseInt((req.query.width as string) || '320', 10);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    // SVG can be served directly
    if (ext === '.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
      return fs.createReadStream(filePath).pipe(res);
    }

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=604800');

    const transform = sharp(filePath)
      .resize(width, width, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 });

    transform.pipe(res);
  } catch (err: any) {
    // If sharp resize fails (e.g. unsupported format), fall back to raw image
    const filePath = req.query.path as string;
    if (filePath && fs.existsSync(filePath)) {
      return fs.createReadStream(filePath).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

// API: Update Metadata (score, hashtags, comment)
app.post('/api/metadata', (req, res) => {
  try {
    const { path: filePath, score, hashtags, comment } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'Image path is required' });
    }

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
app.post('/api/batch', async (req, res) => {
  try {
    const result = await executeBatchOperation(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Batch operation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Genery Server running on http://localhost:${PORT}`);
});
