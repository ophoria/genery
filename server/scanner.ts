import fs from 'fs';
import path from 'path';
import { imageSize } from 'image-size';
import sharp from 'sharp';
import { ImageItem, ScanResult } from '../src/types/gallery.js';
import { metadataStore } from './metadataStore.js';

const SUPPORTED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif', 'tiff', 'tif', 'ico'
]);

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.git',
  '.svn',
  '.hg',
  '.vscode',
  '.idea',
  'Library',
  'System',
  'AppData',
  'vendor',
  'target',
  'bin',
  'obj',
  '.next',
  '.nuxt',
  '.cache',
  '.npm',
  '.Trash',
  '.cargo',
  '.pyenv',
  'venv',
  '.venv',
  '__pycache__',
  'Photos Library.photoslibrary',
]);

const MAX_SCANNED_IMAGES = 5000;
const MAX_DEPTH = 8;

export async function scanDirectory(
  dirPath: string,
  includeSubdirs: boolean = true
): Promise<ScanResult> {
  const images: ImageItem[] = [];
  const foundTypes = new Set<string>();

  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory does not exist: ${dirPath}`);
  }

  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }

  async function walkDir(currentDir: string, currentDepth: number) {
    if (images.length >= MAX_SCANNED_IMAGES || currentDepth > MAX_DEPTH) {
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (err: any) {
      if (currentDepth === 0) throw err;
      if (err.code !== 'EPERM' && err.code !== 'EACCES') {
        console.warn(`Could not read directory ${currentDir}:`, err.message);
      }
      return;
    }

    for (const entry of entries) {
      if (images.length >= MAX_SCANNED_IMAGES) {
        break;
      }

      const fullPath = path.join(currentDir, entry.name);

      // Skip symlinks or ignored directory names
      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (
          includeSubdirs &&
          !entry.name.startsWith('.') &&
          !IGNORED_DIRS.has(entry.name)
        ) {
          await walkDir(fullPath, currentDepth + 1);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase().replace(/^\./, '');
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          foundTypes.add(ext);
          try {
            const item = await processFile(fullPath, dirPath, ext);
            if (item) {
              images.push(item);
            }
          } catch (err) {
            console.warn(`Failed to process image ${fullPath}:`, err);
          }
        }
      }
    }
  }

  await walkDir(dirPath, 0);

  return {
    directory: dirPath,
    totalFound: images.length,
    images,
    availableTypes: Array.from(foundTypes).sort(),
  };
}

async function processFile(
  fullPath: string,
  rootDir: string,
  ext: string
): Promise<ImageItem | null> {
  const stats = fs.statSync(fullPath);
  let width = 0;
  let height = 0;

  try {
    const dimensions = imageSize(fullPath);
    if (dimensions.width && dimensions.height) {
      width = dimensions.width;
      height = dimensions.height;
    }
  } catch (err) {
    // Fallback to Sharp if image-size fails or for certain formats
    try {
      const sharpMeta = await sharp(fullPath).metadata();
      width = sharpMeta.width || 0;
      height = sharpMeta.height || 0;
    } catch (sharpErr) {
      // Default dimensions 0 if unreadable
      width = 0;
      height = 0;
    }
  }

  const relativePath = path.relative(rootDir, fullPath);
  const meta = metadataStore.get(fullPath);
  const aspectRatio = height > 0 ? parseFloat((width / height).toFixed(2)) : 1;

  // Use birthtime or ctime/mtime for creation date
  const createdAt = (stats.birthtime && stats.birthtime.getTime() > 0 ? stats.birthtime : stats.ctime).toISOString();
  const modifiedAt = stats.mtime.toISOString();

  return {
    id: Buffer.from(fullPath).toString('base64'),
    path: fullPath,
    relativePath,
    name: path.basename(fullPath),
    extension: ext,
    width,
    height,
    aspectRatio,
    size: stats.size,
    createdAt,
    modifiedAt,
    score: meta.score || 0,
    hashtags: meta.hashtags || [],
    comment: meta.comment || '',
  };
}
