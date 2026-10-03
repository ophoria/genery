import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ImageMetadata {
  score?: number;
  hashtags?: string[];
  comment?: string;
}

const STORE_PATH = process.env.GENERY_METADATA_PATH || path.join(os.homedir(), '.genery_image_metadata.json');

export function validateMetadataImport(value: unknown): Record<string, ImageMetadata> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Choose a Genery metadata JSON file containing image paths and metadata.');
  }
  const result: Record<string, ImageMetadata> = {};
  for (const [filePath, metadata] of Object.entries(value)) {
    if (!(path.isAbsolute(filePath) || path.win32.isAbsolute(filePath)) || filePath.includes('\0')) {
      throw new Error('Each metadata entry must use an absolute image path.');
    }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error(`Invalid metadata for ${filePath}.`);
    }
    const entry = metadata as Record<string, unknown>;
    if (!Object.keys(entry).length || Object.keys(entry).some(key => !['score', 'hashtags', 'comment'].includes(key))) {
      throw new Error(`Expected score, hashtags, or comment for ${filePath}.`);
    }
    if (entry.score !== undefined && (typeof entry.score !== 'number' || !Number.isInteger(entry.score) || entry.score < 0 || entry.score > 5)) {
      throw new Error(`Rating must be a whole number from 0 to 5 for ${filePath}.`);
    }
    if (entry.hashtags !== undefined && (!Array.isArray(entry.hashtags) || entry.hashtags.some(tag => typeof tag !== 'string'))) {
      throw new Error(`Hashtags must be a list of text values for ${filePath}.`);
    }
    if (entry.comment !== undefined && typeof entry.comment !== 'string') {
      throw new Error(`Comment must be text for ${filePath}.`);
    }
    result[filePath] = { ...entry } as ImageMetadata;
  }
  return result;
}

export class MetadataStore {
  private data: Record<string, ImageMetadata> = {};

  constructor(private storePath = STORE_PATH) {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf-8');
        this.data = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error loading metadata store:', err);
      this.data = {};
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving metadata store:', err);
    }
  }

  public get(filePath: string): ImageMetadata {
    return this.data[filePath] || { score: 0, hashtags: [], comment: '' };
  }

  public setScore(filePath: string, score: number): ImageMetadata {
    const current = this.get(filePath);
    current.score = Math.max(0, Math.min(5, score));
    this.data[filePath] = current;
    this.save();
    return current;
  }

  public setHashtags(filePath: string, hashtags: string[]): ImageMetadata {
    const current = this.get(filePath);
    // Clean and unique hashtags
    const cleaned = Array.from(
      new Set(
        hashtags
          .map((tag) => tag.trim().replace(/^#+/, ''))
          .filter((tag) => tag.length > 0)
      )
    );
    current.hashtags = cleaned;
    this.data[filePath] = current;
    this.save();
    return current;
  }

  public setComment(filePath: string, comment: string): ImageMetadata {
    const current = this.get(filePath);
    current.comment = comment;
    this.data[filePath] = current;
    this.save();
    return current;
  }

  public updateBatch(updates: { path: string; metadata: Partial<ImageMetadata> }[]) {
    for (const update of updates) {
      const current = this.get(update.path);
      if (update.metadata.score !== undefined) {
        current.score = Math.max(0, Math.min(5, update.metadata.score));
      }
      if (update.metadata.hashtags !== undefined) {
        current.hashtags = Array.from(new Set(update.metadata.hashtags.map((t) => t.trim().replace(/^#+/, ''))));
      }
      if (update.metadata.comment !== undefined) {
        current.comment = update.metadata.comment;
      }
      this.data[update.path] = current;
    }
    this.save();
  }

  public getAll(): Record<string, ImageMetadata> {
    return this.data;
  }

  public importMetadata(value: unknown): { importedCount: number; backupPath: string | null } {
    const entries = validateMetadataImport(value);
    const importedCount = Object.keys(entries).length;
    if (!importedCount) return { importedCount: 0, backupPath: null };
    const next = { ...this.data };
    for (const [filePath, metadata] of Object.entries(entries)) {
      next[filePath] = { ...next[filePath], ...metadata };
    }
    const backupPath = this.storePath.replace(/\.json$/, '') + '.backup.json';
    const temporaryPath = this.storePath + '.import-tmp';
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(next, null, 2), { encoding: 'utf-8', mode: 0o600 });
      // Keep the previous file before atomically replacing it; publish in memory only after success.
      const hadStore = fs.existsSync(this.storePath);
      if (hadStore) fs.copyFileSync(this.storePath, backupPath);
      fs.renameSync(temporaryPath, this.storePath);
      this.data = next;
      return { importedCount, backupPath: hadStore ? backupPath : null };
    } finally {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
  }
}

export const metadataStore = new MetadataStore();
