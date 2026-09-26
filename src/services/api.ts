import { ScanResult, FolderNode, ImageItem, BatchRequest, BatchResult } from '../types/gallery';

const BASE_URL = '/api';

export async function scanFolder(dirPath: string, includeSubdirs: boolean): Promise<ScanResult> {
  const params = new URLSearchParams({
    dir: dirPath,
    subdirs: String(includeSubdirs),
  });

  const res = await fetch(`${BASE_URL}/scan?${params}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to scan directory: ${res.statusText}`);
  }
  return res.json();
}

export async function browseDirectory(path?: string): Promise<{
  currentPath: string;
  homePath: string;
  parentPath: string | null;
  directories: FolderNode[];
}> {
  const params = path ? new URLSearchParams({ path }) : '';
  const res = await fetch(`${BASE_URL}/browse${params ? `?${params}` : ''}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Cannot reach the local file server. Start Genery with npm run dev and try again.');
  }
  return res.json();
}

export async function updateImageMetadata(
  filePath: string,
  updates: { score?: number; hashtags?: string[]; comment?: string }
): Promise<any> {
  const res = await fetch(`${BASE_URL}/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: filePath,
      ...updates,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update image metadata');
  }
  return res.json();
}

export async function sendBatchRequest(req: BatchRequest): Promise<BatchResult> {
  const res = await fetch(`${BASE_URL}/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Batch operation failed');
  }
  return res.json();
}

export function getImageUrl(filePath: string): string {
  return `${BASE_URL}/image?path=${encodeURIComponent(filePath)}`;
}

export function getThumbnailUrl(filePath: string, width: number = 320): string {
  return `${BASE_URL}/thumbnail?path=${encodeURIComponent(filePath)}&width=${width}&v=2`;
}
