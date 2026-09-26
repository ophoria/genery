import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen);
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Shift + Click', desc: 'Select the range from the last clicked image' },
    { key: '⌘ / Ctrl + Shift + Click', desc: 'Add a range to the current selection' },
    { key: '⌘ / Ctrl + Click', desc: 'Add or remove an image from the bulk selection' },
    { key: 'Image checkbox', desc: 'Toggle selection; then open Batch for bulk actions' },
    { key: '1 - 5', desc: 'Rate selected images; if none, rate the highlighted image' },
    { key: 'Enter', desc: 'Open Hashtag editor for highlighted image' },
    { key: 'Shift + Enter', desc: 'Open Comment editor for highlighted image' },
    { key: 'Space', desc: 'Open Fullscreen viewer mode (Aspect Ratio 1:1 fit view)' },
    { key: 'Arrow Keys', desc: 'Navigate thumbnail selection grid (Up, Down, Left, Right)' },
    { key: 'Scroll Wheel', desc: 'Scroll gallery & navigate thumbnails smoothly' },
    { key: 'Left / Right', desc: 'In Fullscreen: Navigate previous / next image' },
    { key: 'Click Image Sides', desc: 'In Fullscreen: Click left or right edge to go prev/next' },
    { key: 'F', desc: 'In Fullscreen: Toggle Real Size 100% pixels vs Fit to screen' },
    { key: 'ESC', desc: 'Exit Fullscreen / Close modal dialogs / Back to gallery anywhere' },
  ];

  return (
    <div className="color-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div ref={dialogRef} tabIndex={-1} className="color-sheet w-full max-w-lg overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-labelledby="shortcuts-dialog-title">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-dark-900 border-b border-dark-700">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <Keyboard className="w-4 h-4" />
            <span id="shortcuts-dialog-title">Keyboard Hotkeys & Mouse Guide</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts table */}
        <div className="p-5 flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
          {shortcuts.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2.5 bg-dark-900/60 rounded-lg border border-dark-700/80 text-xs"
            >
              <span className="text-gray-300 font-medium">{item.desc}</span>
              <kbd className="px-2.5 py-1 bg-dark-800 border border-dark-600 rounded font-mono text-[11px] font-bold text-blue-300 shadow">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 bg-dark-900 border-t border-dark-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
