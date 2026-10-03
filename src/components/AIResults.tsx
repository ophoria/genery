import { useAccess } from '../security/AccessProvider';
import { useState } from 'react';
import { ScanSearch, Plus, Trash2 } from 'lucide-react';
import { AIFamily, AI_MODELS } from '../types/ai';
import { ImageItem } from '../types/gallery';
import { clearAIResult } from '../services/ai';

interface Props { image: ImageItem; onAnalyze: () => void; onPromote: (tags: string[]) => Promise<void>; onClear: (family: AIFamily) => void }
export function AIResults({ image, onAnalyze, onPromote, onClear }: Props) {
  const { canWrite, user } = useAccess();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const results = Object.values(image.ai || {}).filter(result => Boolean(result));
  async function promote(tags: string[]) {
    setPending(true); setError(null);
    try { await onPromote(tags); } catch (error) { setError(error instanceof Error ? error.message : 'Could not save tags.'); }
    finally { setPending(false); }
  }
  async function clear(family: AIFamily) {
    setPending(true); setError(null);
    try { await clearAIResult(image.path, family); onClear(family); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not clear results.'); }
    finally { setPending(false); }
  }
  return <section className="inspector-section ai-results">
    <div className="section-label"><span>AI classification</span><button className="ai-text-button" type="button" disabled={!canWrite} onClick={onAnalyze}><ScanSearch aria-hidden="true" />Analyze</button></div>
    {error && <p className="ai-error" role="alert">{error}</p>}
    {!results.length && <p className="ai-help">Analyze this image with RAM, WD Tagger, or your SigLIP vocabulary.</p>}
    {results.map(result => result && <div key={result.family} className="ai-result-block">
      <div className="ai-result-heading"><strong>{AI_MODELS[result.variant].name}</strong><button className="icon-button" type="button" disabled={!canWrite || pending} onClick={() => void clear(result.family)} aria-label={`Clear ${AI_MODELS[result.variant].name} results`} title="Clear these suggestions"><Trash2 aria-hidden="true" /></button></div>
      <p className="ai-result-meta">{new Date(result.analyzedAt).toLocaleDateString()} · {result.device === 'mps' ? 'Apple GPU' : 'CPU'} · {(result.durationMs / 1000).toFixed(1)}s</p>
      {result.tags.length ? <>
        <div className="ai-suggestions">{result.tags.map(tag => <button key={`${tag.group}:${tag.label}`} type="button" disabled={!canWrite || pending || image.hashtags.includes(tag.label)} onClick={() => void promote([tag.label])} title={`${tag.group}: ${tag.label} · match score ${tag.score.toFixed(3)}. Click to add to your tags.`}><span>{tag.label}</span><small>{tag.score.toFixed(2)}</small></button>)}</div>
        <button className="ai-text-button ai-promote-all" type="button" disabled={!canWrite || pending} onClick={() => void promote(result.tags.filter(tag => tag.group !== 'rating').map(tag => tag.label))}><Plus aria-hidden="true" />Add suggestions to my tags</button>
      </> : <p className="ai-help">No tags passed these settings. Try a lower threshold or different descriptions.</p>}
    </div>)}
  </section>;
}
