import type { AIJob } from '../types/ai';

export function analysisProgress(job: AIJob, now = Date.now()) {
  const processed = Math.min(job.total, job.completed + job.skipped + job.failed);
  const elapsedMs = Math.max(0, (job.state === 'running' ? now : Date.parse(job.updatedAt)) - Date.parse(job.startedAt));
  const remaining = Math.max(0, job.total - processed);
  // Cached images do not provide a useful estimate of inference speed.
  const attempted = job.completed + job.failed;
  const remainingMs = attempted > 0 ? elapsedMs / attempted * remaining : null;
  return {
    processed,
    percent: job.total > 0 ? Math.round(processed / job.total * 100) : 0,
    elapsedMs,
    averageMs: job.completed > 0 ? elapsedMs / job.completed : null,
    remainingMs,
    estimatedFinish: remainingMs === null ? null : now + remainingMs,
  };
}

export function formatAnalysisDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} sec`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
}

export function analysisSummary(job: AIJob) {
  const stats = analysisProgress(job);
  return `Total time: ${formatAnalysisDuration(stats.elapsedMs)} · Average per analyzed image: ${stats.averageMs === null ? 'N/A (no images analyzed)' : `${(stats.averageMs / 1000).toFixed(1)} sec`}`;
}

export function shouldNotifyAnalysisDone(previous: AIJob | null, next: AIJob | null, modalOpen: boolean) {
  return !modalOpen && next?.kind === 'analyze' && next.state === 'completed'
    && previous?.id === next.id && previous.state === 'running';
}
