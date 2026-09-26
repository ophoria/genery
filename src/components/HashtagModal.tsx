import React, { useState, useEffect } from 'react';
import { ImageItem } from '../types/gallery';
import { Tag, X, Check, Plus } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface HashtagModalProps {
  image: ImageItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (hashtags: string[]) => void;
}

export const HashtagModal: React.FC<HashtagModalProps> = ({
  image,
  isOpen,
  onClose,
  onSave,
}) => {
  const [inputVal, setInputVal] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (image) {
      setTags(image.hashtags || []);
      setInputVal('');
    }
  }, [image, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !image) return null;

  const handleAddTag = () => {
    if (!inputVal.trim()) return;
    const newTags = inputVal
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#+/, '').trim())
      .filter((t) => t.length > 0);

    const merged = Array.from(new Set([...tags, ...newTags]));
    setTags(merged);
    setInputVal('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      const newTags = inputVal
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#+/, '').trim())
        .filter((t) => t.length > 0);
      const merged = Array.from(new Set([...tags, ...newTags]));
      onSave(merged);
    } else {
      onSave(tags);
    }
    onClose();
  };

  return (
    <div className="color-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div ref={dialogRef} tabIndex={-1} className="color-sheet w-full max-w-md overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="hashtag-dialog-title">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-dark-900 border-b border-dark-700">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <Tag className="w-4 h-4" />
            <span id="hashtag-dialog-title">Edit Hashtags</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close hashtag editor"
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="text-xs text-gray-400 truncate">
            Image: <span className="text-gray-200 font-medium">{image.name}</span>
          </div>

          {/* Active Tags */}
          <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-dark-900 rounded-lg border border-dark-700">
            {tags.length === 0 ? (
              <span className="text-xs text-gray-500 italic">No hashtags added yet</span>
            ) : (
              tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-900/40 text-blue-300 border border-blue-700/50 rounded-full"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Input Box */}
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Enter tags (e.g. nature, portrait, 2024)..."
              className="flex-1 px-3.5 py-2 bg-dark-900 border border-dark-600 rounded-lg text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="px-3 py-2 bg-dark-700 hover:bg-dark-600 text-gray-200 text-xs font-medium rounded-lg border border-dark-600 transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-dark-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel (Esc)
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shadow-lg shadow-blue-600/20 transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save Hashtags</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
