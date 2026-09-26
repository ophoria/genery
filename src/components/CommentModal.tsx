import React, { useState, useEffect } from 'react';
import { ImageItem } from '../types/gallery';
import { MessageSquare, X, Check } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface CommentModalProps {
  image: ImageItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (comment: string) => void;
}

export const CommentModal: React.FC<CommentModalProps> = ({
  image,
  isOpen,
  onClose,
  onSave,
}) => {
  const [commentText, setCommentText] = useState<string>('');
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (image) {
      setCommentText(image.comment || '');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(commentText);
    onClose();
  };

  return (
    <div className="color-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div ref={dialogRef} tabIndex={-1} className="color-sheet w-full max-w-lg overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="comment-dialog-title">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-dark-900 border-b border-dark-700">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <MessageSquare className="w-4 h-4" />
            <span id="comment-dialog-title">Edit Image Comment</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close comment editor"
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

          <textarea
            autoFocus
            rows={5}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write notes, description, or comments about this image..."
            className="w-full px-3.5 py-2.5 bg-dark-900 border border-dark-600 rounded-lg text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
          />

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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save Comment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
