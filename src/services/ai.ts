import { AIFamily, AIJob, AIResult, AISettings, AIStatus, AIVariant } from '../types/ai';

async function request<T>(route: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/ai/${route}`, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Cannot reach the AI service. Restart Genery and try again.');
  return data as T;
}
export const getAIStatus = () => request<AIStatus>('status');
export const saveSettings = (settings: AISettings) => request<{ settings: AISettings }>('settings', { settings });
export const installModel = (variant: AIVariant) => request<AIJob>('install', { variant });
export const startAnalysis = (paths: string[], settings: AISettings, force: boolean) => request<AIJob>('analyze', { paths, settings, force });
export const cancelJob = (id: string) => request<AIJob>('cancel', { id });
export const fetchAIResults = (paths: string[]) => request<Record<string, Partial<Record<AIFamily, AIResult>>>>('results', { paths });
export const clearAIResult = (path: string, family: AIFamily) => request<Partial<Record<AIFamily, AIResult>>>('clear', { path, family });
