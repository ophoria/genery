import fs from 'fs';
import path from 'path';
import os from 'os';

// Each account's last scanned folder, so every browser resumes where that account left off.
const STORE_PATH = process.env.GENERY_LAST_FOLDERS_PATH || path.join(os.homedir(), '.genery', 'last-folders.json');

function read(): Record<string, string> {
  try {
    const saved = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch { return {}; }
}

export function getLastFolder(userId: string): string | undefined {
  const folder = read()[userId];
  return typeof folder === 'string' && path.isAbsolute(folder) && fs.existsSync(folder) ? folder : undefined;
}

export function setLastFolder(userId: string, folder: string) {
  const folders = read();
  if (folders[userId] === folder) return;
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true, mode: 0o700 });
    fs.writeFileSync(STORE_PATH, JSON.stringify({ ...folders, [userId]: folder }, null, 2), { mode: 0o600 });
  } catch { /* Scanning still works when the preference cannot be saved. */ }
}
