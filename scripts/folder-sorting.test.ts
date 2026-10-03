import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FOLDER_LAST_USED_KEY, FOLDER_SORT_KEY, readFolderLastUsed, readFolderSortSettings,
  recordFolderUse, sortFolders,
} from '../src/utils/folderSorting';
import { FolderNode } from '../src/types/gallery';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
} });
const folders: FolderNode[] = [
  { name: 'Folder 10', path: '/10', hasSubdirs: false, createdAt: 100 },
  { name: 'Folder 2', path: '/2', hasSubdirs: false, createdAt: 300 },
  { name: 'Alpha', path: '/a', hasSubdirs: false, createdAt: 200 },
  { name: 'Unknown', path: '/u', hasSubdirs: false, createdAt: null },
];
const paths = (items: FolderNode[]) => items.map((folder) => folder.path);

test('name sorting uses natural order in both directions without mutating input', () => {
  assert.deepEqual(paths(sortFolders(folders, { by: 'name', direction: 'asc' }, {})), ['/a', '/2', '/10', '/u']);
  assert.deepEqual(paths(sortFolders(folders, { by: 'name', direction: 'desc' }, {})), ['/u', '/10', '/2', '/a']);
  assert.deepEqual(paths(folders), ['/10', '/2', '/a', '/u']);
});
test('creation dates sort chronologically with missing dates last in both directions', () => {
  assert.deepEqual(paths(sortFolders(folders, { by: 'createdAt', direction: 'asc' }, {})), ['/10', '/a', '/2', '/u']);
  assert.deepEqual(paths(sortFolders(folders, { by: 'createdAt', direction: 'desc' }, {})), ['/2', '/a', '/10', '/u']);
});
test('last-used sorting keeps never-used folders last and breaks ties by name', () => {
  const history = { '/a': 100, '/10': 200, '/2': 200 };
  assert.deepEqual(paths(sortFolders(folders, { by: 'lastUsed', direction: 'asc' }, history)), ['/a', '/2', '/10', '/u']);
  assert.deepEqual(paths(sortFolders(folders, { by: 'lastUsed', direction: 'desc' }, history)), ['/2', '/10', '/a', '/u']);
  assert.deepEqual(paths(sortFolders(folders, { by: 'lastUsed', direction: 'desc' }, {})), ['/a', '/2', '/10', '/u']);
});
test('preferences and folder selections round trip through storage', () => {
  storage.clear();
  assert.deepEqual(readFolderSortSettings(), { by: 'name', direction: 'asc' });
  storage.set(FOLDER_SORT_KEY, JSON.stringify({ by: 'lastUsed', direction: 'desc' }));
  assert.deepEqual(readFolderSortSettings(), { by: 'lastUsed', direction: 'desc' });
  const before = Date.now();
  recordFolderUse('/a');
  const history = recordFolderUse('/2');
  assert.ok(history['/a'] >= before && history['/2'] >= before);
  assert.deepEqual(readFolderLastUsed(), history);
});
test('malformed settings and histories are handled safely', () => {
  storage.set(FOLDER_SORT_KEY, '{broken');
  storage.set(FOLDER_LAST_USED_KEY, '{broken');
  assert.deepEqual(readFolderSortSettings(), { by: 'name', direction: 'asc' });
  assert.deepEqual(readFolderLastUsed(), {});
  storage.set(FOLDER_LAST_USED_KEY, JSON.stringify({ '/good': 123, '/zero': 0, '/bad': 'today', relative: 200 }));
  assert.deepEqual(readFolderLastUsed(), { '/good': 123 });
});
