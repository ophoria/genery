import { FolderNode } from '../types/gallery';

export type FolderSortBy = 'name' | 'createdAt' | 'lastUsed';
export type FolderSortDirection = 'asc' | 'desc';
export interface FolderSortSettings {
  by: FolderSortBy;
  direction: FolderSortDirection;
}
export const FOLDER_SORT_KEY = 'genery.folderSort';
export const FOLDER_LAST_USED_KEY = 'genery.folderLastUsed';

export function readFolderSortSettings(): FolderSortSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(FOLDER_SORT_KEY) || 'null');
    return {
      by: ['name', 'createdAt', 'lastUsed'].includes(saved?.by) ? saved.by : 'name',
      direction: saved?.direction === 'desc' ? 'desc' : 'asc',
    };
  } catch { return { by: 'name', direction: 'asc' }; }
}

export function readFolderLastUsed(): Record<string, number> {
  try {
    const saved = JSON.parse(localStorage.getItem(FOLDER_LAST_USED_KEY) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([path, date]) =>
      path.startsWith('/') && typeof date === 'number' && Number.isFinite(date) && date > 0,
    )) as Record<string, number>;
  } catch { return {}; }
}

export function recordFolderUse(path: string): Record<string, number> {
  const history = { ...readFolderLastUsed(), [path]: Date.now() };
  try { localStorage.setItem(FOLDER_LAST_USED_KEY, JSON.stringify(history)); } catch { /* Storage may be unavailable. */ }
  return history;
}

export function sortFolders(
  folders: FolderNode[], settings: FolderSortSettings, lastUsed: Record<string, number>,
): FolderNode[] {
  const direction = settings.direction === 'asc' ? 1 : -1;
  const compareNames = (a: FolderNode, b: FolderNode) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    || a.path.localeCompare(b.path);
  return [...folders].sort((a, b) => {
    if (settings.by === 'name') return direction * compareNames(a, b);
    const aDate = settings.by === 'createdAt' ? a.createdAt : lastUsed[a.path];
    const bDate = settings.by === 'createdAt' ? b.createdAt : lastUsed[b.path];
    const aKnown = typeof aDate === 'number' && Number.isFinite(aDate) && aDate > 0;
    const bKnown = typeof bDate === 'number' && Number.isFinite(bDate) && bDate > 0;
    // Missing dates and never-used folders stay last in either direction.
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    return (aKnown && bKnown ? direction * (aDate! - bDate!) : 0) || compareNames(a, b);
  });
}
