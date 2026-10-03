import { useCallback, useEffect, useRef, useState } from 'react';
import { AIStatus } from '../types/ai';
import { getAIStatus } from '../services/ai';

export function useAI(onProgress: () => void) {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useRef(onProgress);
  progress.current = onProgress;
  const lastProgress = useRef('');
  const lastStatus = useRef('');
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const next = await getAIStatus();
      if (!mounted.current) return;
      const signature = JSON.stringify(next);
      if (signature !== lastStatus.current) { setStatus(next); lastStatus.current = signature; }
      setError(null);
      const key = next.job ? `${next.job.id}:${next.job.completed}:${next.job.state}` : '';
      if (next.job?.kind === 'analyze' && key !== lastProgress.current) progress.current();
      lastProgress.current = key;
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : 'AI service unavailable.'); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      void refresh().finally(() => { inFlight = false; });
    }, 2000);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, [refresh]);
  return { status, error, refresh };
}
