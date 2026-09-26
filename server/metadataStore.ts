import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ImageMetadata {
  score?: number;
  hashtags?: string[];
  comment?: string;
}

const STORE_PATH = path.join(os.homedir(), '.genery_image_metadata.json');

class MetadataStore {
  private data: Record<string, ImageMetadata> = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        this.data = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error loading metadata store:', err);
      this.data = {};
    }
  }

  private save() {
    try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
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
}

export const metadataStore = new MetadataStore();
