import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { AIFamily, AIResult, AISettings, DEFAULT_AI_SETTINGS } from '../../src/types/ai.js';
import { familyFor, validateSettings } from './config.js';

export const AI_HOME = process.env.GENERY_AI_HOME || path.join(os.homedir(), '.genery', 'ai');
export function atomicWrite(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value), 'utf8');
  fs.renameSync(temp, file);
}
export function readJSON<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
export function fingerprint(file: string) {
  const stat = fs.statSync(file);
  return `${stat.size}:${stat.mtimeMs}`;
}
const resultPath = (file: string) => path.join(AI_HOME, 'results', `${createHash('sha256').update(path.resolve(file)).digest('hex')}.json`);
export function getAIResults(file: string): Partial<Record<AIFamily, AIResult>> {
  const results = readJSON<Partial<Record<AIFamily, AIResult>>>(resultPath(file), {});
  try {
    const current = fingerprint(file);
    return Object.fromEntries(Object.entries(results).filter(([, result]) => result?.fingerprint === current));
  } catch { return {}; }
}
export function saveAIResult(file: string, result: AIResult) {
  atomicWrite(resultPath(file), { ...getAIResults(file), [result.family]: result });
}
export function deleteAIResult(file: string, family: AIFamily) {
  const results = getAIResults(file);
  delete results[family];
  atomicWrite(resultPath(file), results);
  return results;
}
export function copyAIResults(source: string, target: string) {
  const results = getAIResults(source);
  const targetFingerprint = fingerprint(target);
  atomicWrite(resultPath(target), Object.fromEntries(Object.entries(results).map(([family, result]) => [family, { ...result, fingerprint: targetFingerprint }])));
}
export function settingsKey(settings: AISettings) {
  return createHash('sha256').update(JSON.stringify(settings)).digest('hex');
}
function settingsPath(userId?: string) {
  return userId ? path.join(AI_HOME, 'user-settings', `${createHash('sha256').update(userId).digest('hex')}.json`) : path.join(AI_HOME, 'settings.json');
}
export function readAISettings(userId?: string): Record<AIFamily, AISettings> {
  const saved = readJSON<Partial<Record<AIFamily, AISettings>>>(settingsPath(userId), {});
  const settings = structuredClone(DEFAULT_AI_SETTINGS);
  for (const family of ['ram', 'wd', 'siglip'] as AIFamily[]) {
    try { if (saved[family] && familyFor(saved[family]!.variant) === family) settings[family] = validateSettings(saved[family]); } catch { /* Fall back to defaults if an old or damaged settings file is found. */ }
  }
  return settings;
}
export function saveAISettings(family: AIFamily, settings: AISettings, userId?: string) {
  atomicWrite(settingsPath(userId), { ...readAISettings(userId), [family]: settings });
}
