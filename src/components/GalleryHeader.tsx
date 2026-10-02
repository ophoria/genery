import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Layers3,
  Keyboard,
  PanelRight,
  Grid2X2,
  List,
  MoreHorizontal,
} from 'lucide-react';

interface GalleryHeaderProps {
  directoryPath: string;
  searchQuery: string;
  selectedCount: number;
  isScanning: boolean;
  isFilterPanelOpen: boolean;
  isInspectorOpen: boolean;
  onDirectoryChange: (path: string) => void;
  onSearchChange: (query: string) => void;
  onScan: () => void;
  onOpenFolderPicker: () => void;
  onToggleFilterPanel: () => void;
  onToggleInspector: () => void;
  onOpenBatchModal: () => void;
  onOpenShortcutsModal: () => void;
  onToggleFullscreen: () => void;
}

export const GalleryHeader: React.FC<GalleryHeaderProps> = ({
  directoryPath,
  searchQuery,
  selectedCount,
  isScanning,
  isFilterPanelOpen,
  isInspectorOpen,
  onDirectoryChange,
  onSearchChange,
  onScan,
  onOpenFolderPicker,
  onToggleFilterPanel,
  onToggleInspector,
  onOpenBatchModal,
  onOpenShortcutsModal,
  onToggleFullscreen,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobileMenuOpen]);

  return (
  <header className="gallery-toolbar">
    <div className="window-identity">
      <div className="traffic-lights">
        <span className="traffic-light is-close" aria-hidden="true" />
        <span className="traffic-light is-minimize" aria-hidden="true" />
        <button className="traffic-light is-zoom" type="button" aria-label="Enter fullscreen" title="Enter fullscreen (F)" onClick={onToggleFullscreen} />
      </div>
      <strong>Genery</strong>
    </div>

    <div className="path-control">
      <FolderOpen aria-hidden="true" />
      <input
        type="text"
        value={directoryPath}
        onChange={(event) => onDirectoryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onScan();
        }}
        aria-label="Image folder path"
        placeholder="Choose an image folder"
      />
      <button className="path-browse-button" onClick={onOpenFolderPicker} type="button">
        Browse
      </button>
    </div>

    <button
      className="toolbar-button toolbar-refresh"
      onClick={onScan}
      disabled={isScanning}
      type="button"
      aria-label={isScanning ? 'Scanning folder' : 'Scan gallery'}
      title={isScanning ? 'Scanning folder' : 'Scan gallery'}
    >
      <RefreshCw className={isScanning ? 'is-spinning' : ''} aria-hidden="true" />
      <span>{isScanning ? 'Scanning…' : 'Scan'}</span>
    </button>

    <div className="segmented-control view-control" aria-label="Gallery view">
      <button className="is-selected" type="button" aria-label="Grid view" aria-pressed="true">
        <Grid2X2 aria-hidden="true" />
      </button>
      <button type="button" aria-label="List view unavailable" disabled>
        <List aria-hidden="true" />
      </button>
    </div>

    <label className="toolbar-search">
      <Search aria-hidden="true" />
      <input
        type="search"
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search"
        aria-label="Search images"
      />
      <kbd>⌘F</kbd>
    </label>

    <button
      className={`toolbar-button ${isFilterPanelOpen ? 'is-active' : ''}`}
      onClick={onToggleFilterPanel}
      type="button"
      aria-expanded={isFilterPanelOpen}
    >
      <SlidersHorizontal aria-hidden="true" />
      <span>Filters</span>
    </button>

    <button
      className={`toolbar-button inspector-toggle ${isInspectorOpen ? 'is-active' : ''}`}
      onClick={onToggleInspector}
      type="button"
      aria-pressed={isInspectorOpen}
      title="Toggle inspector"
    >
      <PanelRight aria-hidden="true" />
      <span>Inspector</span>
    </button>

    <button className="toolbar-button batch-button" onClick={onOpenBatchModal} type="button">
      <Layers3 aria-hidden="true" />
      <span>{selectedCount > 0 ? `Batch · ${selectedCount}` : 'Batch'}</span>
    </button>

    <button
      className="icon-button shortcuts-button"
      onClick={onOpenShortcutsModal}
      type="button"
      title="Keyboard shortcuts"
      aria-label="Keyboard shortcuts"
    >
      <Keyboard aria-hidden="true" />
    </button>

    <button
      className={`icon-button mobile-more-button ${isMobileMenuOpen ? 'is-active' : ''}`}
      onClick={() => setIsMobileMenuOpen((open) => !open)}
      type="button"
      aria-label="More gallery controls"
      aria-expanded={isMobileMenuOpen}
    >
      <MoreHorizontal aria-hidden="true" />
    </button>

    {isMobileMenuOpen && (
      <div className="mobile-toolbar-menu" role="dialog" aria-label="Gallery controls">
        <div className="mobile-menu-identity">
          <strong>Genery</strong>
          <span>Personal image workspace</span>
        </div>
        <label className="mobile-menu-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search images"
            aria-label="Search images"
            autoFocus
          />
        </label>
        <button type="button" onClick={() => { onOpenFolderPicker(); setIsMobileMenuOpen(false); }}>
          <FolderOpen aria-hidden="true" />
          <span>Browse folder</span>
        </button>
        <button type="button" disabled={isScanning} onClick={() => { onScan(); setIsMobileMenuOpen(false); }}>
          <RefreshCw className={isScanning ? 'is-spinning' : ''} aria-hidden="true" />
          <span>{isScanning ? 'Scanning…' : 'Scan folder'}</span>
        </button>
        <button type="button" onClick={() => { onOpenShortcutsModal(); setIsMobileMenuOpen(false); }}>
          <Keyboard aria-hidden="true" />
          <span>Keyboard shortcuts</span>
        </button>
      </div>
    )}
  </header>
  );
};
