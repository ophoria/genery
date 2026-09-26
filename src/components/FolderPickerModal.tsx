import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { browseDirectory } from '../services/api';
import { FolderNode } from '../types/gallery';
import {
  Folder,
  FolderPlus,
  ChevronRight,
  ArrowUp,
  X,
  Check,
  Search,
  Home,
  Monitor,
  FileText,
  Download,
  Image as ImageIcon,
  FolderOpen,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface FolderPickerModalProps {
  isOpen: boolean;
  initialPath?: string;
  title?: string;
  onClose: () => void;
  onSelectFolder: (folderPath: string) => void;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  isOpen,
  initialPath,
  title = 'Select Folder',
  onClose,
  onSelectFolder,
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [inputPath, setInputPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<FolderNode[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selection & Filtering State
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [isEditingPath, setIsEditingPath] = useState<boolean>(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const [homePath, setHomePath] = useState('');
  const requestId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen);

  const loadFolder = useCallback(async (targetPath?: string) => {
    const id = ++requestId.current;
    setLoading(true);
    setFilterQuery('');
    setError(null);
    setSelectedPath(null);
    setFocusedIndex(-1);
    try {
      const data = await browseDirectory(targetPath);
      if (id !== requestId.current) return;
      setHomePath(data.homePath);
      setCurrentPath(data.currentPath);
      setInputPath(data.currentPath);
      setParentPath(data.parentPath);
      setDirectories(data.directories);
    } catch (err: any) {
      if (id !== requestId.current) return;
      setError(err.message || 'Failed to load folder contents');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadFolder(initialPath);
      setFilterQuery('');
      setIsEditingPath(false);
    }
    return () => { requestId.current += 1; };
  }, [isOpen, initialPath, loadFolder]);

  // Filtered directories based on search query
  const filteredDirectories = useMemo(() => {
    if (!filterQuery.trim()) return directories;
    const q = filterQuery.toLowerCase().trim();
    return directories.filter((dir) => dir.name.toLowerCase().includes(q));
  }, [directories, filterQuery]);

  // Parse path breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs: { name: string; path: string }[] = [];

    // Root
    crumbs.push({ name: '/', path: '/' });

    let accum = '';
    parts.forEach((part) => {
      accum += '/' + part;
      crumbs.push({ name: part, path: accum });
    });

    return crumbs;
  }, [currentPath]);

  // Scroll focused element into view
  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [focusedIndex]);

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept arrow keys if user is editing input text or search box
      const target = e.target as HTMLElement;
      const isInputActive = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (isInputActive || target.closest('button, a, select') || loading || error) return;

      if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowUp')) {
        e.preventDefault();
        if (parentPath) void loadFolder(parentPath);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredDirectories.length === 0) return;
        setFocusedIndex((prev) => {
          const next = Math.min(filteredDirectories.length - 1, prev + 1);
          setSelectedPath(filteredDirectories[next].path);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredDirectories.length === 0) return;
        setFocusedIndex((prev) => {
          const next = Math.max(0, prev - 1);
          setSelectedPath(filteredDirectories[next].path);
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedPath) {
          loadFolder(selectedPath);
        } else if (currentPath) {
          const targetToSelect = selectedPath || currentPath;
          onSelectFolder(targetToSelect);
          onClose();
        }

      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    loading,
    error,
    filteredDirectories,
    focusedIndex,
    selectedPath,
    currentPath,
    inputPath,
    parentPath,
    loadFolder,
    onSelectFolder,
    onClose,
  ]);

  if (!isOpen) return null;

  const targetFolderToSelect = selectedPath || currentPath;

  return (
    <div className="color-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div ref={dialogRef} tabIndex={-1} className="color-sheet w-full max-w-2xl overflow-hidden flex flex-col h-[85vh] max-h-[720px]" role="dialog" aria-modal="true" aria-labelledby="folder-dialog-title">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-dark-900 border-b border-dark-700 shrink-0">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <FolderPlus className="w-4 h-4" />
            <span id="folder-dialog-title">{title}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close folder picker"
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Access Shortcuts Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-dark-900/90 border-b border-dark-700 text-xs overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mr-1 shrink-0">
            Quick:
          </span>
          <button
            onClick={() => loadFolder()}
            className="flex items-center gap-1 px-2.5 py-1 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded border border-dark-700 shrink-0 transition-colors"
            title="User Home Directory"
          >
            <Home className="w-3.5 h-3.5 text-amber-400" />
            <span>Home</span>
          </button>
          {homePath && (
            <>
              <button
                onClick={() => loadFolder(`${homePath}/Desktop`)}
                className="flex items-center gap-1 px-2.5 py-1 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded border border-dark-700 shrink-0 transition-colors"
              >
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                <span>Desktop</span>
              </button>
              <button
                onClick={() => loadFolder(`${homePath}/Documents`)}
                className="flex items-center gap-1 px-2.5 py-1 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded border border-dark-700 shrink-0 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Documents</span>
              </button>
              <button
                onClick={() => loadFolder(`${homePath}/Downloads`)}
                className="flex items-center gap-1 px-2.5 py-1 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded border border-dark-700 shrink-0 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span>Downloads</span>
              </button>
              <button
                onClick={() => loadFolder(`${homePath}/Pictures`)}
                className="flex items-center gap-1 px-2.5 py-1 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded border border-dark-700 shrink-0 transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
                <span>Pictures</span>
              </button>
            </>
          )}
        </div>

        {/* Current Path Navigation / Breadcrumb Bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-dark-900/60 border-b border-dark-700 text-xs text-gray-300 shrink-0">
          <button
            onClick={() => parentPath && loadFolder(parentPath)}
            disabled={!parentPath}
            className="p-1.5 bg-dark-800 hover:bg-dark-700 disabled:opacity-40 text-gray-200 rounded border border-dark-600 transition-colors shrink-0"
            title="Go Up One Level (Backspace / Alt+Up)"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          {isEditingPath ? (
            <div className="flex-1 flex items-center gap-1.5">
              <input
                type="text"
                data-path-input="true"
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    loadFolder(inputPath);
                    setIsEditingPath(false);
                  }
                }}
                autoFocus
                className="flex-1 px-3 py-1 bg-dark-900 border border-blue-500 rounded font-mono text-xs text-gray-100 focus:outline-none"
              />
              <button
                onClick={() => {
                  loadFolder(inputPath);
                  setIsEditingPath(false);
                }}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-xs transition-colors shrink-0"
              >
                Go
              </button>
              <button
                onClick={() => {
                  setInputPath(currentPath);
                  setIsEditingPath(false);
                }}
                className="px-2 py-1 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded text-xs transition-colors shrink-0"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center gap-1 overflow-x-auto py-0.5 font-mono text-xs scrollbar-none">
              <div className="flex items-center gap-0.5 shrink-0">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.path}>
                    {idx > 0 && <span className="text-gray-600 select-none">/</span>}
                    <button
                      onClick={() => loadFolder(crumb.path)}
                      className="px-1.5 py-0.5 rounded hover:bg-dark-700 text-gray-200 hover:text-blue-300 transition-colors shrink-0 max-w-[150px] truncate"
                      title={crumb.path}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
              <button
                onClick={() => {
                  setInputPath(currentPath);
                  setIsEditingPath(true);
                }}
                className="p-1 text-gray-400 hover:text-gray-200 rounded hover:bg-dark-700 ml-auto transition-colors shrink-0"
                title="Edit path directly"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Search / Filter Subdirectories Input */}
        <div className="px-4 py-2 bg-dark-900/40 border-b border-dark-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => {
                setFilterQuery(e.target.value);
                setSelectedPath(null);
                setFocusedIndex(-1);
              }}
              placeholder="Filter folders in this directory..."
              className="w-full pl-8 pr-3 py-1 bg-dark-900 border border-dark-700 rounded-md text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs"
              >
                ×
              </button>
            )}
          </div>
          <span className="text-[11px] text-gray-400 shrink-0 font-medium">
            {filteredDirectories.length} {filteredDirectories.length === 1 ? 'folder' : 'folders'}
          </span>
        </div>

        {/* Folder List (Main Scrollable Container - min-h-0 is essential for flex-1 scrolling) */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Folders"
          tabIndex={0}
          className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-1 text-xs"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-xs text-gray-400 gap-2 animate-pulse">
              <FolderOpen className="w-8 h-8 text-blue-400/60" />
              <span>Loading folder contents...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 text-xs text-red-400 p-4 text-center">
              <span className="font-semibold">Unable to access directory:</span>
              <span className="mt-1 font-mono text-[11px] bg-red-950/40 border border-red-800/60 p-2 rounded max-w-full truncate">
                {error}
              </span>
            </div>
          ) : filteredDirectories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-xs text-gray-500 italic">
              <Folder className="w-8 h-8 text-gray-600 mb-1" />
              <span>
                {filterQuery
                  ? `No folders matching "${filterQuery}"`
                  : 'No subdirectories in this folder'}
              </span>
            </div>
          ) : (
            filteredDirectories.map((dir, idx) => {
              const isSelected = selectedPath === dir.path;
              const isFocused = focusedIndex === idx;

              return (
                <div
                  key={dir.path}
                  tabIndex={isFocused ? 0 : -1}
                  role="option"
                  aria-selected={isSelected}
                  ref={(el) => (itemRefs.current[idx] = el)}
                  onClick={() => {
                    setSelectedPath(dir.path);
                    setFocusedIndex(idx);
                  }}
                  onDoubleClick={() => loadFolder(dir.path)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer border transition-colors group select-none ${
                    isSelected
                      ? 'bg-blue-600/25 border-blue-500/80 text-white shadow-sm'
                      : isFocused
                      ? 'bg-dark-700 border-dark-600 text-gray-100'
                      : 'bg-dark-900/50 border-dark-700/60 hover:bg-dark-700/70 text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-blue-400 shrink-0 group-hover:text-blue-300" />
                    )}
                    <span className="font-medium truncate">{dir.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadFolder(dir.path);
                      }}
                      className="p-1 hover:bg-dark-600 rounded text-gray-400 hover:text-blue-300 transition-colors flex items-center gap-1 text-[11px]"
                      title="Open / Enter folder"
                    >
                      <span className="hidden group-hover:inline text-[10px]">Open</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-dark-900 border-t border-dark-700 shrink-0">
          <div className="text-[11px] text-gray-400 truncate max-w-[55%] flex items-center gap-1.5">
            <span>Selected:</span>
            <span className="font-mono text-gray-100 font-semibold truncate bg-dark-800 px-2 py-0.5 rounded border border-dark-700">
              {targetFolderToSelect}
            </span>
            {selectedPath && (
              <button
                onClick={() => setSelectedPath(null)}
                className="text-[10px] text-blue-400 hover:underline shrink-0"
              >
                (Reset to current)
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !!error || !targetFolderToSelect}
              onClick={() => {
                onSelectFolder(targetFolderToSelect);
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shadow-lg shadow-blue-600/20 transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Select This Folder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
