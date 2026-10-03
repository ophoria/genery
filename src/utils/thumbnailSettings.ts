import { ImageItem } from '../types/gallery';

export const THUMBNAIL_RATIOS = ['1:1', '4:3', '3:2', '16:9', '3:4', '2:3', '9:16'] as const;
export type ThumbnailRatio = 'auto' | typeof THUMBNAIL_RATIOS[number];
export const THUMBNAIL_ALIGNMENTS = ['top', 'center', 'bottom'] as const;
export type ThumbnailAlignment = typeof THUMBNAIL_ALIGNMENTS[number];
export interface ThumbnailSettings {
  size: number;
  ratio: ThumbnailRatio;
  alignment: ThumbnailAlignment;
  coloredRatings: boolean;
  folderAlignments: Record<string, ThumbnailAlignment>;
}
export const THUMBNAIL_SETTINGS_KEY = 'genery.thumbnailSettings';

export function readThumbnailSettings(): ThumbnailSettings {
  const defaults: ThumbnailSettings = { size: 155, ratio: 'auto', alignment: 'center', coloredRatings: false, folderAlignments: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(THUMBNAIL_SETTINGS_KEY) || 'null');
    return {
      size: typeof saved?.size === 'number' && Number.isFinite(saved.size)
        ? Math.max(100, Math.min(400, saved.size)) : defaults.size,
      ratio: saved?.ratio === 'auto' || THUMBNAIL_RATIOS.includes(saved?.ratio)
        ? saved.ratio : defaults.ratio,
      alignment: isAlignment(saved?.alignment) ? saved.alignment : defaults.alignment,
      coloredRatings: typeof saved?.coloredRatings === 'boolean' ? saved.coloredRatings : defaults.coloredRatings,
      folderAlignments: Object.fromEntries(
        Object.entries(saved?.folderAlignments && typeof saved.folderAlignments === 'object'
          && !Array.isArray(saved.folderAlignments) ? saved.folderAlignments : {})
          .filter(([folder, value]) => folder.startsWith('/') && isAlignment(value))
          .map(([folder, value]) => [normalizeFolder(folder), value as ThumbnailAlignment]),
      ),
    };
  } catch { return defaults; }
}

function isAlignment(value: unknown): value is ThumbnailAlignment {
  return THUMBNAIL_ALIGNMENTS.includes(value as ThumbnailAlignment);
}

export function normalizeFolder(folder: string): string {
  return folder.replace(/\/+$/, '') || '/';
}

export function parentFolder(path: string): string {
  return path.slice(0, normalizeFolder(path).lastIndexOf('/')) || '/';
}

export function resolveAlignment(folder: string, settings: ThumbnailSettings): ThumbnailAlignment {
  let current = normalizeFolder(folder);
  while (true) {
    if (Object.hasOwn(settings.folderAlignments, current)) return settings.folderAlignments[current];
    if (current === '/') return settings.alignment;
    current = parentFolder(current);
  }
}

export function setFolderAlignment(settings: ThumbnailSettings, folder: string, alignment: ThumbnailAlignment | 'inherit'): ThumbnailSettings {
  const folderAlignments = { ...settings.folderAlignments };
  const key = normalizeFolder(folder);
  if (alignment === 'inherit') delete folderAlignments[key];
  else folderAlignments[key] = alignment;
  return { ...settings, folderAlignments };
}

export function ratioValue(ratio: typeof THUMBNAIL_RATIOS[number]): number {
  const [width, height] = ratio.split(':').map(Number);
  return width / height;
}

// Group ratios to two decimal places so small pixel rounding differences count together.
// Ties consistently prefer the smaller ratio, independent of scan order.
export function dominantRatio(images: Pick<ImageItem, 'width' | 'height'>[]): number {
  const counts = new Map<number, { count: number; total: number }>();
  for (const { width, height } of images) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) continue;
    const ratio = width / height;
    const key = Math.round(ratio * 100);
    const group = counts.get(key) || { count: 0, total: 0 };
    group.count++;
    group.total += ratio;
    counts.set(key, group);
  }
  const winner = [...counts.entries()].sort((a, b) => b[1].count - a[1].count || a[0] - b[0])[0];
  return winner ? winner[1].total / winner[1].count : 4 / 3;
}

export function ratioLabel(value: number): string {
  return THUMBNAIL_RATIOS.find((ratio) => Math.abs(ratioValue(ratio) - value) < 0.01)
    || `${Number(value.toFixed(2))}:1`;
}
