import { useAccess } from '../security/AccessProvider';
import React, { useEffect, useState } from 'react';
import { ImageItem, BatchAction, BatchResult } from '../types/gallery';
import { sendBatchRequest } from '../services/api';
import { FolderPickerModal } from './FolderPickerModal';
import { useDialogFocus } from '../hooks/useDialogFocus';
import {
  Copy,
  Trash2,
  Edit3,
  FileArchive,
  FolderPlus,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface BatchOperationsModalProps {
  isOpen: boolean;
  filteredImages: ImageItem[];
  selectedImages: ImageItem[];
  onClose: () => void;
  onSuccess: (result: BatchResult) => void;
}

export const BatchOperationsModal: React.FC<BatchOperationsModalProps> = ({
  isOpen,
  filteredImages,
  selectedImages,
  onClose,
  onSuccess,
}) => {
  const { canWrite, canDelete, user } = useAccess();
  const [action, setAction] = useState<BatchAction>('copy');
  const [scope, setScope] = useState<'filtered' | 'selected'>(
    selectedImages.length > 0 ? 'selected' : 'filtered'
  );
  const [targetDirectory, setTargetDirectory] = useState<string>('');
  const [renamePattern, setRenamePattern] = useState<string>('photo_{n:3}');
  const [zipFileName, setZipFileName] = useState<string>('gallery_archive');
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen && !isFolderPickerOpen);

  useEffect(() => {
    if (!isOpen || isFolderPickerOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFolderPickerOpen, isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setScope(selectedImages.length > 0 ? 'selected' : 'filtered');
      setResult(null);
    }
    // Initialize the scope when opening, preserving an explicit choice while open.
  }, [isOpen]);

  if (!isOpen) return null;

  const targetList = scope === 'selected' ? selectedImages : filteredImages;

  const handleExecute = async () => {
    if (targetList.length === 0) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await sendBatchRequest({
        action,
        imagePaths: targetList.map((img) => img.path),
        targetDirectory: action === 'copy' || action === 'zip' ? targetDirectory : undefined,
        renamePattern: action === 'rename' ? renamePattern : undefined,
        zipFileName: action === 'zip' ? zipFileName : undefined,
      });

      setResult(res);
      if (res.success) {
        onSuccess(res);
      }
    } catch (err: any) {
      setResult({
        success: false,
        action,
        affectedCount: 0,
        message: err.message || 'Batch operation failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="color-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div ref={dialogRef} tabIndex={-1} className="color-sheet w-full max-w-lg overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-labelledby="batch-dialog-title">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-dark-900 border-b border-dark-700">
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
              <FolderPlus className="w-4 h-4" />
              <span id="batch-dialog-title">Bulk Image Actions (Copy / Delete / Rename / Zip)</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close bulk image actions"
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-dark-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4 text-xs text-gray-200">
            {/* Scope Selection */}
            <div className="bg-dark-900/80 p-3 rounded-lg border border-dark-700 flex flex-col gap-2">
              <label className="font-semibold text-gray-300">Target Images Scope:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('filtered')}
                  className={`px-3 py-2 rounded-lg border text-left flex flex-col transition-colors ${
                    scope === 'filtered'
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500'
                      : 'bg-dark-800 text-gray-400 border-dark-600 hover:text-gray-200'
                  }`}
                >
                  <span className="font-semibold">All Filtered Images</span>
                  <span className="text-[10px] opacity-75">{filteredImages.length} images matching current filter</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('selected')}
                  disabled={selectedImages.length === 0}
                  className={`px-3 py-2 rounded-lg border text-left flex flex-col transition-colors ${
                    selectedImages.length === 0
                      ? 'opacity-50 cursor-not-allowed bg-dark-900 text-gray-600 border-dark-700'
                      : scope === 'selected'
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500'
                      : 'bg-dark-800 text-gray-400 border-dark-600 hover:text-gray-200'
                  }`}
                >
                  <span className="font-semibold">Selected Images Only</span>
                  <span className="text-[10px] opacity-75">{selectedImages.length} manually selected images</span>
                </button>
              </div>
            </div>

            {/* Action Type Selector */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-gray-300">Select Action:</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'copy', label: 'Copy', icon: Copy, color: 'blue' },
                  { key: 'delete', label: 'Delete', icon: Trash2, color: 'red' },
                  { key: 'rename', label: 'Rename', icon: Edit3, color: 'amber' },
                  { key: 'zip', label: 'Zip', icon: FileArchive, color: 'emerald' },
                ].filter(act => act.key !== 'delete' || canDelete).map((act) => {
                  const Icon = act.icon;
                  const isAct = action === act.key;
                  return (
                    <button
                      key={act.key}
                      type="button"
                      onClick={() => setAction(act.key as BatchAction)}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
                        isAct
                          ? act.color === 'red'
                            ? 'bg-red-600/30 text-red-300 border-red-500'
                            : act.color === 'amber'
                            ? 'bg-amber-600/30 text-amber-300 border-amber-500'
                            : act.color === 'emerald'
                            ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500'
                            : 'bg-blue-600/30 text-blue-300 border-blue-500'
                          : 'bg-dark-900 text-gray-400 border-dark-700 hover:text-gray-200'
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-1" />
                      <span className="font-semibold">{act.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Config options based on action */}
            {action === 'copy' && (
              <div className="bg-dark-900/60 p-3 rounded-lg border border-dark-700 flex flex-col gap-2">
                <label className="font-semibold text-gray-300">Destination Directory:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetDirectory}
                    onChange={(e) => setTargetDirectory(e.target.value)}
                    placeholder="Enter or select destination folder path..."
                    className="flex-1 px-3 py-1.5 bg-dark-900 border border-dark-600 rounded text-xs text-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => setIsFolderPickerOpen(true)}
                    className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-blue-300 rounded border border-dark-600 font-medium transition-colors"
                  >
                    Browse...
                  </button>
                </div>
              </div>
            )}

            {action === 'delete' && (
              <div className="bg-red-950/40 p-3 rounded-lg border border-red-800/60 flex items-start gap-2.5 text-red-300 text-xs">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <span className="font-bold block text-red-200">Warning: Permanent File Deletion</span>
                  This action will permanently delete <span className="font-bold underline">{targetList.length}</span> images from your filesystem disk.
                </div>
              </div>
            )}

            {action === 'rename' && (
              <div className="bg-dark-900/60 p-3 rounded-lg border border-dark-700 flex flex-col gap-2">
                <label className="font-semibold text-gray-300">Rename Pattern Template:</label>
                <input
                  type="text"
                  value={renamePattern}
                  onChange={(e) => setRenamePattern(e.target.value)}
                  placeholder="e.g. photo_{n:3} or {date}_{orig}"
                  className="w-full px-3 py-1.5 bg-dark-900 border border-dark-600 rounded text-xs text-gray-200"
                />
                <div className="text-[10px] text-gray-400 flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>Variables:</span>
                  <code className="text-amber-300">{'{n}'}</code> = index,
                  <code className="text-amber-300">{'{n:3}'}</code> = 001 padding,
                  <code className="text-amber-300">{'{orig}'}</code> = original name,
                  <code className="text-amber-300">{'{date}'}</code> = date string.
                </div>
              </div>
            )}

            {action === 'zip' && (
              <div className="bg-dark-900/60 p-3 rounded-lg border border-dark-700 flex flex-col gap-2">
                <label className="font-semibold text-gray-300">Archive Options:</label>
                <div>
                  <label className="text-[10px] text-gray-400">Zip File Name:</label>
                  <input
                    type="text"
                    value={zipFileName}
                    onChange={(e) => setZipFileName(e.target.value)}
                    placeholder="e.g. vacation_photos"
                    className="w-full px-3 py-1.5 bg-dark-900 border border-dark-600 rounded text-xs text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">Save Zip To Folder (Optional):</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetDirectory}
                      onChange={(e) => setTargetDirectory(e.target.value)}
                      placeholder="Default: same as images folder"
                      className="flex-1 px-3 py-1.5 bg-dark-900 border border-dark-600 rounded text-xs text-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => setIsFolderPickerOpen(true)}
                      className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-blue-300 rounded border border-dark-600 font-medium transition-colors"
                    >
                      Browse...
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Execution Result Banner */}
            {result && (
              <div
                className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                  result.success
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                    : 'bg-red-950/40 text-red-300 border-red-800/60'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold block">{result.message}</span>
                  {result.zipFilePath && (
                    <span className="text-[10px] block font-mono text-emerald-400 mt-0.5">
                      Zip File: {result.zipFilePath}
                    </span>
                  )}
                  {result.errors && (
                    <ul className="mt-1 list-disc list-inside text-[10px] text-red-400">
                      {result.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Action Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-dark-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 text-xs font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || targetList.length === 0}
                onClick={handleExecute}
                className={`px-5 py-2 text-white text-xs font-semibold rounded-lg shadow-lg transition-colors flex items-center gap-2 ${
                  action === 'delete'
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                }`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  Execute {action.toUpperCase()} on {targetList.length} images
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Folder Picker Modal for selecting target directory */}
      <FolderPickerModal
        isOpen={isFolderPickerOpen}
        initialPath={targetDirectory || undefined}
        onClose={() => setIsFolderPickerOpen(false)}
        onSelectFolder={(folderPath) => setTargetDirectory(folderPath)}
      />
    </>
  );
};
