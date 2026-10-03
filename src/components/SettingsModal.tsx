import { useEffect, useRef, useState } from 'react';
import { AccessSettings } from '../security/AccessSettings';
import { useAccess } from '../security/AccessProvider';
import { Download, Settings, Upload, X } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';

type SaveFileHandle = {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> }>;
};
type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<SaveFileHandle>;
};

export function SettingsModal({ isOpen, onClose, onImported }: { isOpen: boolean; onClose: () => void; onImported: () => Promise<void> }) {
  const access = useAccess();
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isBusy = isExporting || isImporting;
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (isOpen) { setError(''); setStatus(''); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [isOpen, isBusy, onClose]);

  async function importMetadata(file: File) {
    setIsImporting(true);
    setError('');
    setStatus('');
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a metadata JSON file smaller than 5 MB.');
      let metadata: unknown;
      try { metadata = JSON.parse(await file.text()); }
      catch { throw new Error('This file is not valid JSON. Choose a file exported by Genery.'); }
      const response = await fetch('/api/metadata/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Import failed. Check that the local server is running and try again.');
      setStatus(result.importedCount
        ? `Imported metadata for ${result.importedCount} ${result.importedCount === 1 ? 'image' : 'images'}.${result.backupPath ? ` Previous metadata backed up to ${result.backupPath}.` : ''}`
        : 'The file contains no image metadata. Nothing changed.');
      if (result.importedCount) await onImported();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed. Please try again.');
    } finally {
      setIsImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function exportMetadata() {
    setIsExporting(true);
    setError('');
    setStatus('');
    try {
      // Open the picker directly from the click to retain browser user activation.
      const pickerWindow = window as SavePickerWindow;
      const handle = pickerWindow.showSaveFilePicker
        ? await pickerWindow.showSaveFilePicker({
          suggestedName: 'genery_image_metadata.json',
          types: [{ description: 'Image metadata (JSON)', accept: { 'application/json': ['.json'] } }],
        }) : null;
      const response = await fetch('/api/metadata/export');
      if (!response.ok) throw new Error('Could not export image metadata. Check that the local server is running and try again.');
      const blob = await response.blob();
      if (handle) {
        const writable = await handle.createWritable();
        try {
          await writable.write(blob);
          await writable.close();
        } catch (writeError) {
          await writable.abort().catch(() => {});
          throw writeError;
        }
        setStatus('Image metadata exported.');
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'genery_image_metadata.json';
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setStatus('Download started. Check your browser downloads for the exported file.');
      }
    } catch (exportError) {
      if (!(exportError instanceof Error && exportError.name === 'AbortError')) {
        setError(exportError instanceof Error ? exportError.message : 'Export failed. Please try again.');
      }
    } finally {
      setIsExporting(false);
    }
  }

  if (!isOpen) return null;
  return (
    <div className="color-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div ref={dialogRef} tabIndex={-1} className="color-sheet settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-heading">
          <h1 id="settings-title"><Settings aria-hidden="true" />Settings</h1>
          <button className="icon-button" type="button" aria-label="Close settings" onClick={onClose} disabled={isBusy}><X aria-hidden="true" /></button>
        </header>
        <AccessSettings />
        <section className="settings-body" aria-labelledby="metadata-heading">
          <h2 id="metadata-heading">Image metadata</h2>
          <p>Export image ratings, hashtags, and comments as a JSON file. Your directory permissions apply to this export.</p>
          {access.user.role === 'admin' && <p className="settings-storage">Saved in <code>~/.genery_image_metadata.json</code></p>}
          <button className="toolbar-button settings-export" type="button" onClick={() => void exportMetadata()} disabled={isBusy} data-dialog-initial="true">
            <Download aria-hidden="true" /><span>{isExporting ? 'Exporting…' : 'Export image metadata'}</span>
          </button>
          <p className="settings-hint">Choose where to save the copy. If your browser uses downloads, the file goes to your configured download location. Exporting keeps your current metadata in place.</p>
          {access.canWrite && <div className="settings-import">
            <button className="toolbar-button settings-export" type="button" onClick={() => fileInput.current?.click()} disabled={isBusy}>
              <Upload aria-hidden="true" /><span>{isImporting ? 'Importing…' : 'Import image metadata'}</span>
            </button>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Choose image metadata file" onChange={event => {
              const file = event.target.files?.[0];
              if (file) void importMetadata(file);
            }} />
            <p className="settings-hint">Choose a Genery export to merge its ratings, tags, and comments. Matching fields are replaced; other saved entries are kept. A backup is saved before import. Image paths must match their current locations.</p>
          </div>}
          {error && <p className="settings-error" role="alert">{error}</p>}
          {status && <p className="settings-status" role="status">{status}</p>}
        </section>
      </div>
    </div>
  );
}
