import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { ImageItem } from '../types/gallery';
import { ThumbnailSettings, parentFolder, resolveAlignment } from '../utils/thumbnailSettings';
import { ThumbnailCard } from './ThumbnailCard';
import { FolderOpen, ImageOff, LoaderCircle, SearchX } from 'lucide-react';

interface GalleryGridProps {
  completedScanVersion: number;
  images: ImageItem[];
  thumbnailSettings: ThumbnailSettings;
  thumbnailSize: number;
  thumbnailRatio: number;
  focusedIndex: number;
  selectedIds: Set<string>;
  isScanning: boolean;
  hasCompletedScan: boolean;
  hasActiveFilters: boolean;
  onFocusIndex: (index: number) => void;
  onSelectOnly: (id: string) => void;
  onRangeSelection: (id: string, additive: boolean) => void;
  onToggleSelection: (id: string) => void;
  onOpenFullscreen: (index: number) => void;
  onOpenFolderPicker: () => void;
  onColumnCountChange: (columns: number) => void;
}

export const GalleryGrid: React.FC<GalleryGridProps> = ({
  completedScanVersion,
  images,
  thumbnailSettings,
  thumbnailSize,
  thumbnailRatio,
  focusedIndex,
  selectedIds,
  isScanning,
  hasCompletedScan,
  hasActiveFilters,
  onFocusIndex,
  onSelectOnly,
  onRangeSelection,
  onToggleSelection,
  onOpenFullscreen,
  onOpenFolderPicker,
  onColumnCountChange,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const lastResetScan = useRef(-1);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const reportColumns = () => {
      const template = window.getComputedStyle(grid).gridTemplateColumns;
      const columns = template === 'none' ? 1 : template.split(' ').filter(Boolean).length;
      onColumnCountChange(Math.max(1, columns));
    };

    reportColumns();
    const observer = new ResizeObserver(reportColumns);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [onColumnCountChange, thumbnailSize, images.length > 0, isScanning]);

  useLayoutEffect(() => {
    if (lastResetScan.current !== completedScanVersion) {
      lastResetScan.current = completedScanVersion;
      scrollerRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }
    const card = gridRef.current?.children[focusedIndex] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [focusedIndex, completedScanVersion]);

  if (isScanning && images.length === 0) {
    return (
      <div className="gallery-state" role="status" aria-live="polite">
        <span className="state-icon"><LoaderCircle className="is-spinning" aria-hidden="true" /></span>
        <h2>Scanning your folder</h2>
        <p>Reading image dimensions, dates, and saved metadata…</p>
      </div>
    );
  }

  if (images.length === 0) {
    const filteredEmpty = hasCompletedScan && hasActiveFilters;
    const scannedEmpty = hasCompletedScan && !hasActiveFilters;
    return (
      <div className="gallery-state">
        <span className="state-icon">
          {filteredEmpty ? <SearchX aria-hidden="true" /> : <ImageOff aria-hidden="true" />}
        </span>
        <h2>{filteredEmpty ? 'No images match this view' : scannedEmpty ? 'No supported images found' : 'Choose an image folder'}</h2>
        <p>
          {filteredEmpty
            ? 'Adjust or reset the active filters to bring images back into the proof grid.'
            : scannedEmpty
            ? 'This folder does not contain a supported image format. Try another folder or include subfolders.'
            : 'Open a local folder to begin reviewing, rating, and organizing images.'}
        </p>
        {!filteredEmpty && !scannedEmpty && (
          <button className="primary-button" onClick={onOpenFolderPicker} type="button">
            <FolderOpen aria-hidden="true" />
            Choose folder…
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={scrollerRef} className="gallery-scroller">
      <div ref={gridRef} style={{ '--thumbnail-size': `${thumbnailSize}px`, '--thumbnail-ratio': thumbnailRatio } as React.CSSProperties} className="gallery-grid" role="grid" aria-label="Image proof grid">
        {images.map((image, index) => (
          <ThumbnailCard
            key={image.id}
            image={image}
            alignment={resolveAlignment(parentFolder(image.path), thumbnailSettings)}
            isFocused={index === focusedIndex}
            isSelected={selectedIds.has(image.id)}
            onFocus={() => {
              onFocusIndex(index);
              onSelectOnly(image.id);
            }}
            onToggleSelection={() => {
              onFocusIndex(index);
              onToggleSelection(image.id);
            }}
            onRangeSelection={(additive) => {
              onFocusIndex(index);
              onRangeSelection(image.id, additive);
            }}
            onDoubleClick={() => onOpenFullscreen(index)}
          />
        ))}
      </div>
    </div>
  );
};
