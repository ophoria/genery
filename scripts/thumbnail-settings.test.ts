import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readThumbnailSettings, resolveAlignment, setFolderAlignment, parentFolder } from '../src/utils/thumbnailSettings';

let saved: string | null = null;
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => saved } });

test('old settings retain size and ratio and default to center', () => {
  saved = JSON.stringify({ size: 210, ratio: '3:4' });
  assert.deepEqual(readThumbnailSettings(), { size: 210, ratio: '3:4', alignment: 'center', folderAlignments: {} });
});
test('nearest ancestor wins, with exact directory boundaries and reset to inherit', () => {
  saved = null;
  let settings = { ...readThumbnailSettings(), alignment: 'bottom' as const };
  let configured = setFolderAlignment(settings, '/photos/', 'top');
  configured = setFolderAlignment(configured, '/photos/portraits', 'center');
  assert.equal(resolveAlignment('/photos/portraits/children', configured), 'center');
  assert.equal(resolveAlignment('/photos/landscapes', configured), 'top');
  assert.equal(resolveAlignment('/photos-other', configured), 'bottom');
  configured = setFolderAlignment(configured, '/photos/portraits', 'inherit');
  assert.equal(resolveAlignment('/photos/portraits/children', configured), 'top');
  assert.equal(parentFolder('/photos/portrait.png'), '/photos');
  assert.equal(resolveAlignment('/', configured), 'bottom');
});
test('round trips settings and independent nested overrides through storage', () => {
  saved = null;
  const configured = setFolderAlignment(setFolderAlignment(readThumbnailSettings(), '/photos', 'top'), '/photos/child', 'bottom');
  saved = JSON.stringify(configured);
  assert.deepEqual(readThumbnailSettings(), configured);
});
test('malformed settings fall back safely and invalid overrides are ignored', () => {
  saved = '{bad json';
  assert.equal(readThumbnailSettings().alignment, 'center');
  saved = JSON.stringify({ alignment: 'left', folderAlignments: { '/photos': 'left', '/valid/': 'top', 'relative': 'bottom' } });
  assert.deepEqual(readThumbnailSettings().folderAlignments, { '/valid': 'top' });
  assert.equal(readThumbnailSettings().alignment, 'center');
});
