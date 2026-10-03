import { useAccess } from '../security/AccessProvider';
import { useEffect, useRef, useState } from 'react';
import { Download, Play, RotateCcw, Save, Square, X } from 'lucide-react';
import { AIFamily, AI_MODELS, AISettings, AIStatus, AIVariant, DEFAULT_AI_SETTINGS, GAME_ART_LABELS } from '../types/ai';
import { ImageItem } from '../types/gallery';
import { cancelJob, installModel, saveSettings, startAnalysis } from '../services/ai';
import { AIProgress } from './AIProgress';
import { useDialogFocus } from '../hooks/useDialogFocus';

const FAMILIES: { id: AIFamily; name: string; detail: string }[] = [
  { id: 'ram', name: 'RAM / RAM++', detail: 'Recognize subjects, objects, and scene content with automatic tags.' },
  { id: 'wd', name: 'WD Taggers', detail: 'Detailed illustration tags. Trained on anime artwork; test its fit for your game art.' },
  { id: 'siglip', name: 'SigLIP 2', detail: 'Match your images against editable motif, style, and composition descriptions.' },
];
const labelsToText = (settings: AISettings) => settings.siglipLabels.map(row => `${row.group} | ${row.label} | ${row.description}`).join('\n');
function parseLabels(text: string) {
  return text.split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => {
    const parts = line.split('|').map(part => part.trim());
    if (parts.length !== 3 || parts.some(part => !part)) throw new Error(`Label line ${index + 1}: use group | label | description.`);
    return { group: parts[0], label: parts[1], description: parts[2] };
  });
}

interface Props {
  isOpen: boolean;
  status: AIStatus | null;
  serviceError: string | null;
  selected: ImageItem[];
  filtered: ImageItem[];
  focused: ImageItem | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}
export function AIAnalysisModal({ isOpen, status, serviceError, selected, filtered, focused, onClose, onRefresh }: Props) {
  const { canWrite } = useAccess();
  const [family, setFamily] = useState<AIFamily>('ram');
  const [drafts, setDrafts] = useState(() => structuredClone(DEFAULT_AI_SETTINGS));
  const [baseline, setBaseline] = useState(() => structuredClone(DEFAULT_AI_SETTINGS));
  const [labelsText, setLabelsText] = useState(labelsToText(DEFAULT_AI_SETTINGS.siglip));
  const [scope, setScope] = useState<'selected' | 'filtered' | 'focused'>('filtered');
  const [force, setForce] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [closingRequested, setClosingRequested] = useState(false);
  const initialized = useRef(false);
  const [scrollToRun, setScrollToRun] = useState(false);
  const dialog = useDialogFocus<HTMLDivElement>(isOpen);
  const settings = drafts[family];
  const activeJob = status?.job;
  const busy = activeJob?.state === 'running';
  const installed = status?.models.find(model => model.variant === settings.variant)?.installed;
  const images = scope === 'selected' ? selected : scope === 'focused' ? focused ? [focused] : [] : filtered;
  const dirtyFamilies = FAMILIES.filter(item => JSON.stringify(drafts[item.id]) !== JSON.stringify(baseline[item.id]) || (item.id === 'siglip' && labelsText !== labelsToText(baseline.siglip))).map(item => item.id);
  const dirty = dirtyFamilies.length > 0;
  function close() { if (dirty) setClosingRequested(true); else onClose(); }

  useEffect(() => {
    if (!isOpen) { initialized.current = false; return; }
    if (status && !initialized.current) {
      setDrafts(structuredClone(status.settings));
      setBaseline(structuredClone(status.settings));
      setLabelsText(labelsToText(status.settings.siglip));
      setScope(selected.length ? 'selected' : focused ? 'focused' : 'filtered');
      setError(null); setSaved(false); setClosingRequested(false);
      initialized.current = true;
    }
  }, [isOpen, status, selected.length, Boolean(focused)]);
  useEffect(() => {
    dialog.current?.querySelector('.ai-body')?.scrollTo({ top: 0 });
  }, [family]);
  useEffect(() => {
    if (!isOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pending) { event.preventDefault(); event.stopPropagation(); close(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [isOpen, onClose, dirty, pending]);
  useEffect(() => {
    if (!isOpen || !scrollToRun) return;
    const body = dialog.current?.querySelector('.ai-body');
    body?.scrollTo({ top: body.scrollHeight, behavior: 'instant' as ScrollBehavior });
    if (!pending) setScrollToRun(false);
  }, [isOpen, scrollToRun, pending, activeJob?.id]);
  if (!isOpen) return null;

  function patch(value: Partial<AISettings>) {
    setDrafts(current => ({ ...current, [family]: { ...current[family], ...value } }));
    setSaved(false); setError(null);
  }
  function currentSettings() {
    return family === 'siglip' ? { ...settings, siglipLabels: parseLabels(labelsText) } : settings;
  }
  async function action(kind: 'save' | 'install' | 'analyze' | 'cancel') {
    setPending(true); setError(null); setSaved(false);
    if (kind === 'analyze') setScrollToRun(true);
    try {
      if (kind === 'cancel') { if (activeJob) await cancelJob(activeJob.id); }
      else {
        const cfg = currentSettings();
        await saveSettings(cfg);
        setBaseline(current => ({ ...current, [family]: structuredClone(cfg) }));
        setDrafts(current => ({ ...current, [family]: structuredClone(cfg) }));
        if (family === 'siglip') setLabelsText(labelsToText(cfg));
        if (kind === 'install') await installModel(cfg.variant);
        else if (kind === 'analyze') await startAnalysis(images.map(image => image.path), cfg, force);
        else setSaved(true);
      }
      await onRefresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'The AI action failed.'); }
    finally { setPending(false); }
  }
  async function saveAndClose() {
    setPending(true); setError(null);
    try {
      const changed = dirtyFamilies.map(id => ({ id, cfg: id === 'siglip' ? { ...drafts[id], siglipLabels: parseLabels(labelsText) } : drafts[id] }));
      for (const { id, cfg } of changed) {
        await saveSettings(cfg);
        setBaseline(current => ({ ...current, [id]: structuredClone(cfg) }));
        setDrafts(current => ({ ...current, [id]: structuredClone(cfg) }));
        if (id === 'siglip') setLabelsText(labelsToText(cfg));
      }
      await onRefresh();
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save settings.'); }
    finally { setPending(false); }
  }

  return (
    <div className="color-backdrop ai-backdrop">
      <div ref={dialog} tabIndex={-1} className="color-sheet ai-sheet" role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title">
        <div className="ai-titlebar">
          <div><h2 id="ai-dialog-title">Local AI analysis</h2><p>Classify your collection. Images stay on this Mac.</p></div>
          <button className="icon-button" type="button" aria-label="Close AI analysis" onClick={close} disabled={pending}><X aria-hidden="true" /></button>
        </div>
        <div className="ai-model-tabs" role="tablist" aria-label="Image models">
          {FAMILIES.map((item, index) => <button key={item.id} id={`ai-tab-${item.id}`} type="button" role="tab" aria-selected={family === item.id} aria-controls={`ai-panel-${item.id}`} tabIndex={family === item.id ? 0 : -1} onClick={() => { setFamily(item.id); setError(null); setSaved(false); }} onKeyDown={event => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
              setFamily(FAMILIES[next].id);
              document.getElementById(`ai-tab-${FAMILIES[next].id}`)?.focus();
            }
          }}>{item.name}</button>)}
        </div>
        <div className="ai-body" role="tabpanel" id={`ai-panel-${family}`} aria-labelledby={`ai-tab-${family}`}>
          <p className="ai-model-description">{FAMILIES.find(item => item.id === family)?.detail}</p>
          {(error || serviceError) && <div className="ai-error" role="alert">{error || serviceError} {serviceError && <button type="button" onClick={() => void onRefresh()}>Retry connection</button>}</div>}
          <fieldset disabled={pending} className="ai-fieldset">
            <div className="ai-fields">
              <label>Model<select value={settings.variant} onChange={event => patch({ variant: event.target.value as AIVariant })}>{Object.entries(AI_MODELS).filter(([, model]) => model.family === family).map(([variant, model]) => <option key={variant} value={variant}>{model.name}</option>)}</select></label>
              <label>Compute device<select value={family === 'wd' ? 'cpu' : settings.device} onChange={event => patch({ device: event.target.value as AISettings['device'] })} disabled={family === 'wd'}>
                <option value="auto">Automatic · Apple GPU when available</option><option value="mps">Apple GPU</option><option value="cpu">CPU</option>
              </select></label>
            </div>
            <div className="ai-install-row"><span className={installed ? 'ai-installed' : ''}>{installed ? 'Installed · ready offline' : AI_MODELS[settings.variant].download + ' (estimate)'}</span>
              <button className="toolbar-button" type="button" disabled={!canWrite || pending || busy || !status} onClick={() => void action('install')}><Download aria-hidden="true" />{installed ? 'Check / repair model' : 'Install model'}</button>
            </div>
            {!installed && <p className="ai-help">Installation downloads open weights and a shared Python runtime. Subsequent image analysis runs offline.</p>}
            {family === 'wd' && <p className="ai-help">WD uses the local ONNX CPU runtime. Transparent images are analyzed against a white background.</p>}

            <div className="ai-settings-section">
              <h3>{family === 'siglip' ? 'Matching rules' : 'Tag selection'}</h3>
              {family === 'ram' && <label className="ai-check"><input type="checkbox" checked={settings.ramUseModelThresholds} onChange={event => patch({ ramUseModelThresholds: event.target.checked })} />Use the model’s recommended per-tag thresholds</label>}
              <div className="ai-fields">
                <label>{family === 'wd' ? 'General tag threshold' : family === 'siglip' ? 'Minimum match score' : 'Custom tag threshold'}<input type="number" min="0" max="1" step="0.01" value={settings.threshold} disabled={family === 'ram' && settings.ramUseModelThresholds} onChange={event => patch({ threshold: Number(event.target.value) })} /></label>
                <label>Maximum {family === 'siglip' ? 'matches' : 'tags'} per image<input type="number" min="1" max="200" value={settings.maxTags} onChange={event => patch({ maxTags: Number(event.target.value) })} /></label>
              </div>
              {family === 'wd' && <>
                <div className="ai-checks"><label className="ai-check"><input type="checkbox" checked={settings.wdIncludeCharacters} onChange={event => patch({ wdIncludeCharacters: event.target.checked })} />Include named characters</label><label className="ai-check"><input type="checkbox" checked={settings.wdIncludeRatings} onChange={event => patch({ wdIncludeRatings: event.target.checked })} />Include content ratings</label></div>
                <label className="ai-single-field">Character tag threshold<input type="number" min="0" max="1" step="0.01" value={settings.wdCharacterThreshold} disabled={!settings.wdIncludeCharacters} onChange={event => patch({ wdCharacterThreshold: Number(event.target.value) })} /></label>
              </>}
              {family === 'siglip' && <>
                <div className="ai-fields"><label>Maximum matches per group<input type="number" min="1" max="20" value={settings.siglipTopPerGroup} onChange={event => patch({ siglipTopPerGroup: Number(event.target.value) })} /></label><label>Description template<input value={settings.siglipTemplate} onChange={event => patch({ siglipTemplate: event.target.value })} placeholder="This image shows {}." /></label></div>
                <p className="ai-help">The template’s {'{}'} is replaced with each description. Scores indicate matches, not calibrated certainty. Groups can return multiple matches or none.</p>
              </>}
              <label className="ai-single-field">Exclude tags<input value={settings.excludedTags.join(', ')} onChange={event => patch({ excludedTags: event.target.value.split(',').map(tag => tag.trim()) })} placeholder="Comma-separated tags to ignore" /></label>
            </div>
            {family === 'siglip' && <div className="ai-settings-section">
              <div className="ai-section-heading"><h3>Your classification vocabulary</h3><button type="button" className="ai-text-button" onClick={() => { setLabelsText(labelsToText({ ...settings, siglipLabels: GAME_ART_LABELS })); setSaved(false); }}>Load game-art preset</button></div>
              <label className="ai-single-field">One entry per line: group | label | description<textarea rows={9} spellCheck={false} value={labelsText} onChange={event => { setLabelsText(event.target.value); setSaved(false); }} /></label>
              <p className="ai-help">Edit or add groups such as motif, style, composition, mood, and medium. Up to 300 descriptions. These are matching candidates, not a trained game-art classifier.</p>
            </div>}
            <div className="ai-settings-actions"><button className="ai-text-button" type="button" onClick={() => { patch(structuredClone(DEFAULT_AI_SETTINGS[family])); if (family === 'siglip') setLabelsText(labelsToText(DEFAULT_AI_SETTINGS.siglip)); }}><RotateCcw aria-hidden="true" />Reset this model’s settings</button><button className="toolbar-button" type="button" disabled={!canWrite || pending || !status} onClick={() => void action('save')}><Save aria-hidden="true" />{saved ? 'Settings saved' : 'Save settings'}</button></div>
          </fieldset>

          <div className="ai-settings-section ai-run-section">
            <h3>Analyze images</h3>
            <div className="ai-fields"><label>Scope<select value={scope} onChange={event => setScope(event.target.value as typeof scope)}>
              <option value="focused" disabled={!focused}>Current image · {focused ? 1 : 0}</option><option value="selected" disabled={!selected.length}>Selected images · {selected.length}</option><option value="filtered">All filtered images · {filtered.length}</option>
            </select></label><div className="ai-run-button"><button className="ai-primary" type="button" disabled={!canWrite || !installed || pending || busy || !images.length || !status} onClick={() => void action('analyze')}><Play aria-hidden="true" />Analyze {images.length} {images.length === 1 ? 'image' : 'images'}</button></div></div>
            <label className="ai-check"><input type="checkbox" checked={force} onChange={event => setForce(event.target.checked)} />Reanalyze cached images</label>
            <p className="ai-help">Otherwise, unchanged images with identical model settings are skipped. Results appear in the inspector and gallery search.</p>
          </div>
          {activeJob && !busy && <div className="ai-job" role="status" aria-live="polite">
            <div className="ai-job-heading"><strong>{AI_MODELS[activeJob.variant].name} · {activeJob.kind === 'install' ? 'Installation' : 'Analysis'}</strong><span>{activeJob.state}</span></div>
            {activeJob.kind === 'analyze' && <AIProgress job={activeJob} />}
            <p>{activeJob.message}</p>
            {activeJob.kind === 'analyze' && <div className="ai-job-counts">{activeJob.completed} analyzed · {activeJob.skipped} cached · {activeJob.failed} failed / {activeJob.total}</div>}
            {activeJob.errors.length > 0 && <details><summary>{activeJob.errors.length} {activeJob.errors.length === 1 ? 'error' : 'errors'}</summary><ul>{activeJob.errors.map((message, i) => <li key={i}>{message}</li>)}</ul></details>}
            {busy && <button className="toolbar-button" type="button" disabled={pending} onClick={() => void action('cancel')}><Square aria-hidden="true" />Cancel task</button>}
          </div>}
        </div>
        {busy && activeJob && <div className="ai-active-job" role="status" aria-live="polite">
          <div className="ai-job-heading"><strong>{AI_MODELS[activeJob.variant].name} · {activeJob.kind === 'install' ? 'Installing' : `${activeJob.completed + activeJob.skipped + activeJob.failed} / ${activeJob.total}`}</strong><button className="toolbar-button" type="button" disabled={pending} onClick={() => void action('cancel')}><Square aria-hidden="true" />Cancel task</button></div>
          {activeJob.kind === 'analyze' ? <AIProgress job={activeJob} /> : <progress aria-label="Model installation" />}
          <p>{activeJob.message}</p>
        </div>}
        <div className="ai-footer"><span>{dirty ? closingRequested ? 'Save your settings or discard them to close.' : 'Unsaved settings. Save to keep your changes.' : busy ? 'You can close this window. The task keeps running.' : 'Results and model settings are saved locally.'}</span><div className="ai-close-actions">
          {dirty && <button className="ai-text-button" type="button" disabled={pending} onClick={onClose}>Discard changes</button>}
          <button className="toolbar-button" type="button" disabled={pending} onClick={() => dirty ? void saveAndClose() : onClose()}>{dirty ? 'Save & close' : 'Done'}</button>
        </div></div>
      </div>
    </div>
  );
}
