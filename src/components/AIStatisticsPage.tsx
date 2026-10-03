import { useAccess } from '../security/AccessProvider';
import { useMemo, useState } from 'react';
import { ArrowLeft, ScanSearch } from 'lucide-react';
import type { ImageItem } from '../types/gallery';
import { AI_MODELS, type AIVariant } from '../types/ai';
import { collectAIStatistics, sortTagStatistics, type TagSort } from '../utils/aiStatistics';

interface Props { images: ImageItem[]; directory: string; includeSubdirs: boolean; isScanning: boolean; onBack: () => void; onAnalyze: () => void; onTag: (tag: string) => void }
export function AIStatisticsPage({ images, directory, includeSubdirs, isScanning, onBack, onAnalyze, onTag }: Props) {
  const { canWrite, user } = useAccess();
  const [model, setModel] = useState<AIVariant | 'all'>('all');
  const [query, setQuery] = useState('');
  const [field, setField] = useState<TagSort>('count');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const stats = useMemo(() => collectAIStatistics(images, model), [images, model]);
  const rows = useMemo(() => sortTagStatistics(stats.tags.filter(tag => tag.label.includes(query.trim().toLowerCase())), field, direction), [stats.tags, query, field, direction]);
  const topTags = useMemo(() => sortTagStatistics(sortTagStatistics(stats.tags, 'count', 'desc').slice(0, 12), field, direction), [stats.tags, field, direction]);
  const largest = Math.max(1, ...topTags.map(tag => tag.count));
  const largestModel = Math.max(1, ...stats.modelCounts.values());
  function sortBy(next: TagSort) { if (field === next) setDirection(current => current === 'asc' ? 'desc' : 'asc'); else { setField(next); setDirection(next === 'label' ? 'asc' : 'desc'); } }
  return <main className="ai-statistics-page">
    <div className="ai-statistics-heading"><div><button type="button" className="ai-text-button" onClick={onBack}><ArrowLeft aria-hidden="true" />Back to gallery</button><h1>AI tag statistics</h1><p>{directory || 'Choose and scan a directory'} · {includeSubdirs ? 'Including subfolders' : 'This folder only'}</p></div><button type="button" className="toolbar-button" disabled={!canWrite} onClick={onAnalyze}><ScanSearch aria-hidden="true" />Analyze images</button></div>
    <p className="ai-statistics-overview">{isScanning ? 'Scanning directory… ' : ''}{images.length.toLocaleString()} images · {stats.analyzedImages.toLocaleString()} analyzed · {stats.taggedImages.toLocaleString()} with AI tags · {stats.tags.length.toLocaleString()} unique tags</p>
    <div className="ai-statistics-controls">
      <label>Model<select value={model} onChange={event => setModel(event.target.value as typeof model)}><option value="all">All models</option>{Object.entries(AI_MODELS).map(([variant, item]) => <option key={variant} value={variant}>{item.name}</option>)}</select></label>
      <label>Find a tag<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search AI tags" /></label>
      <label>Sort by<select value={field} onChange={event => setField(event.target.value as TagSort)}><option value="count">Image count</option><option value="label">Tag name</option><option value="averageScore">Average score</option></select></label>
      <label>Order<select value={direction} onChange={event => setDirection(event.target.value as typeof direction)}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
    </div>
    {stats.tags.length ? <>
      <div className="ai-statistics-charts">
        <section aria-labelledby="top-tags-title"><h2 id="top-tags-title">Top tags</h2><p>12 most frequent tags · distinct images · current sort order</p><ol className="ai-tag-chart">{topTags.map(tag => <li key={tag.label}><button type="button" onClick={() => onTag(tag.label)} title={`Show images tagged ${tag.label}`}>{tag.label}</button><span className="ai-chart-track" aria-hidden="true"><span style={{ width: `${tag.count / largest * 100}%` }} /></span><strong>{tag.count.toLocaleString()}</strong></li>)}</ol></section>
        <section aria-labelledby="model-coverage-title"><h2 id="model-coverage-title">Model coverage</h2><p>Images analyzed by each model · entire directory</p><ul className="ai-tag-chart">{[...stats.modelCounts].sort((a, b) => b[1] - a[1]).map(([variant, count]) => <li key={variant}><span>{AI_MODELS[variant as AIVariant]?.name || variant}</span><span className="ai-chart-track" aria-hidden="true"><span style={{ width: `${count / largestModel * 100}%` }} /></span><strong>{count.toLocaleString()}</strong></li>)}</ul></section>
      </div>
      <section className="ai-statistics-tags"><h2>All identified tags <span>({rows.length.toLocaleString()})</span></h2><p>Counts are distinct images. Across models, each image contributes its highest score for a tag. Scores are model match values, not confidence percentages.</p>
        <div className="ai-statistics-table-wrap"><table><thead><tr>{(['label', 'count', 'averageScore'] as TagSort[]).map(key => <th key={key} aria-sort={field === key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => sortBy(key)}>{key === 'label' ? 'Tag' : key === 'count' ? 'Images' : 'Average score'}{field === key ? direction === 'asc' ? ' ↑' : ' ↓' : ''}</button></th>)}<th>Directory share</th><th>Groups</th><th>Models</th></tr></thead><tbody>{rows.map(tag => <tr key={tag.label}><td><button className="ai-text-button" type="button" onClick={() => onTag(tag.label)}>{tag.label}</button></td><td>{tag.count.toLocaleString()}</td><td>{tag.averageScore.toFixed(3)}</td><td>{images.length ? (tag.count / images.length * 100).toFixed(1) : 0}%</td><td>{tag.groups.join(', ')}</td><td>{tag.models.map(variant => AI_MODELS[variant as AIVariant]?.name || variant).join(', ')}</td></tr>)}</tbody></table></div>
        {!rows.length && <p>No tags match “{query}”. Clear the search to see all tags.</p>}
      </section>
    </> : <div className="ai-statistics-empty"><h2>{images.length ? 'No AI tags yet' : 'No images scanned'}</h2><p>{images.length ? 'Analyze images with this model to see tag frequencies and scores here.' : 'Choose a directory and scan it to get started.'}</p><button type="button" className="toolbar-button" disabled={Boolean(images.length) && !canWrite} onClick={images.length ? onAnalyze : onBack}>{images.length ? 'Open AI analysis' : 'Back to gallery'}</button></div>}
  </main>;
}
