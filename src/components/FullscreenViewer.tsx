import React, { useState, useEffect } from 'react';
import { ImageItem } from '../types/gallery';
import { getImageUrl } from '../services/api';
import { useDialogFocus } from '../hooks/useDialogFocus';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Minimize2,
  Star,
  Tag,
  MessageSquare,
  Calendar,
  HardDrive,
  Maximize,
} from 'lucide-react';

interface FullscreenViewerProps {
  image: ImageItem;
  currentIndex: number;
  totalImages: number;
  shortcutsEnabled?: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onRate: (score: number) => void;
  onOpenHashtags: () => void;
  onOpenComment: () => void;
}

export const FullscreenViewer: React.FC<FullscreenViewerProps> = ({
  image,
  currentIndex,
  totalImages,
  shortcutsEnabled = true,
  onClose,
  onNext,
  onPrev,
  onRate,
  onOpenHashtags,
  onOpenComment,
}) => {
  // 'fit' vs 'real' (100% pixel scale)
  const [isRealSize, setIsRealSize] = useState<boolean>(false);
  const dialogRef = useDialogFocus<HTMLDivElement>(true);

  // Key event listeners for F, Left, Right, Esc inside Fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!shortcutsEnabled) return;
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsRealSize((prev) => !prev);
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        onRate(parseInt(e.key, 10));
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onOpenHashtags();
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        onOpenComment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcutsEnabled, onClose, onNext, onPrev, onRate, onOpenHashtags, onOpenComment]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleString();
    } catch {
      return isoStr;
    }
  };

  return (
    <div ref={dialogRef} tabIndex={-1} className="quicklook-overlay fixed inset-0 z-50 flex flex-col justify-between overflow-hidden animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-label={`Quick Look: ${image.name}`}>
      {/* Top Overlay Bar */}
      <div className="quicklook-bar relative z-20 flex items-center justify-between px-6 py-4 text-gray-200">
        <div className="flex items-center gap-4 truncate">
          <span className="px-2.5 py-1 text-xs font-semibold bg-blue-600/30 text-blue-400 border border-blue-500/40 rounded">
            {currentIndex + 1} / {totalImages}
          </span>
          <div className="truncate">
            <h2 className="text-sm font-semibold truncate" title={image.name}>
              {image.name}
            </h2>
            <p className="text-xs text-gray-400 truncate" title={image.path}>
              {image.path}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Real Size Toggle (F key) */}
          <button
            onClick={() => setIsRealSize(!isRealSize)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors border ${
              isRealSize
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-dark-800 text-gray-300 hover:bg-dark-700 border-dark-600'
            }`}
            title="Toggle Real Size 100% (HotKey: F)"
          >
            {isRealSize ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isRealSize ? '100% Real Size' : 'Fit View'} (F)</span>
          </button>

          {/* Close button (Esc) */}
          <button
            onClick={onClose}
            aria-label="Close Quick Look"
            className="p-1.5 bg-dark-800 hover:bg-dark-700 text-gray-300 hover:text-white rounded border border-dark-600 transition-colors"
            title="Close Fullscreen (HotKey: Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Display Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-auto p-4 select-none">
        {/* Left Navigation Zone & Arrow Button */}
        <button
          onClick={onPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-dark-900/70 hover:bg-dark-800 text-gray-200 hover:text-white rounded-full border border-dark-600 backdrop-blur transition-all shadow-xl hover:scale-110"
          title="Previous Image (Left Arrow)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Clickable Left Half Overlay for navigation */}
        <div
          onClick={onPrev}
          className="absolute left-0 top-0 bottom-0 w-1/4 z-10 cursor-pointer"
          title="Click left side for previous"
        />

        {/* Clickable Right Half Overlay for navigation */}
        <div
          onClick={onNext}
          className="absolute right-0 top-0 bottom-0 w-1/4 z-10 cursor-pointer"
          title="Click right side for next"
        />

        {/* The Image */}
        <div className={`relative flex items-center justify-center ${isRealSize ? 'overflow-auto max-w-none max-h-none' : 'max-w-full max-h-full'}`}>
          <img
            src={getImageUrl(image.path)}
            alt={image.name}
            className={`transition-all duration-200 ${
              isRealSize
                ? 'object-none'
                : 'max-w-[calc(100vw-8rem)] max-h-[calc(100vh-12rem)] object-contain shadow-2xl rounded-md'
            }`}
          />
        </div>

        {/* Right Navigation Zone & Arrow Button */}
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-dark-900/70 hover:bg-dark-800 text-gray-200 hover:text-white rounded-full border border-dark-600 backdrop-blur transition-all shadow-xl hover:scale-110"
          title="Next Image (Right Arrow)"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Metadata & Controls Bar */}
      <div className="quicklook-bar quicklook-bar-bottom relative z-20 flex flex-wrap items-center justify-between gap-4 px-6 py-3 text-xs text-gray-300">
        {/* Dimensions, Size, Date */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Maximize className="w-3.5 h-3.5 text-blue-400" />
            <span>{image.width} × {image.height} px ({image.aspectRatio} AR)</span>
          </div>

          <div className="flex items-center gap-1.5 text-gray-400">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span>{formatBytes(image.size)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-gray-400">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>{formatDate(image.createdAt)}</span>
          </div>
        </div>

        {/* Score Stars (1-5 keys) */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-medium">Score (1-5):</span>
          <div className="flex items-center gap-1 bg-dark-800 p-1 rounded border border-dark-700">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onRate(star === image.score ? 0 : star)}
                className={`p-1 rounded hover:bg-dark-700 transition-colors ${
                  star <= image.score ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'
                }`}
                title={`Set Score ${star} (Key: ${star})`}
              >
                <Star className={`w-4 h-4 ${star <= image.score ? 'fill-yellow-400' : ''}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Hashtags & Comment Trigger buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenHashtags}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 text-blue-300 rounded border border-dark-600 transition-colors"
            title="Edit Hashtags (HotKey: Enter)"
          >
            <Tag className="w-3.5 h-3.5 text-blue-400" />
            <span>Hashtags ({image.hashtags.length}) [Enter]</span>
          </button>

          <button
            onClick={onOpenComment}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 text-blue-300 rounded border border-dark-600 transition-colors"
            title="Edit Comment (HotKey: Shift+Enter)"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            <span>Comment {image.comment ? '✓' : ''} [Shift+Enter]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
