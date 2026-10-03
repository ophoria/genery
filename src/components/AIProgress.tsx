import { useEffect, useState } from 'react';
import type { AIJob } from '../types/ai';
import { analysisProgress, analysisSummary } from '../utils/aiProgress';

export function AIProgress({ job }: { job: AIJob }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (job.state !== 'running') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [job.id, job.state]);
  const stats = analysisProgress(job, now);
  return <div className="ai-progress-display">
    <div className="ai-progress-meter"><progress max={Math.max(1, job.total)} value={stats.processed} aria-label="Analysis progress" /><strong>{stats.percent}%</strong></div>
    {job.state === 'running' ? <p className="ai-timing">{stats.remainingMs === null ? 'Estimating time remaining after the first image…' : `About ${Math.max(1, Math.ceil(stats.remainingMs / 60000))} min remaining · Estimated done at ${new Date(stats.estimatedFinish!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</p>
      : <p className="ai-timing">{analysisSummary(job)}</p>}
  </div>;
}
