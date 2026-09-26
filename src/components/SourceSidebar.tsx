import React from 'react';
import {
  Folder,
  FolderOpen,
  Images,
  ListFilter,
  CheckCircle2,
  ScanSearch,
  Star,
  Tags,
} from 'lucide-react';

interface SourceSidebarProps {
  directoryPath: string;
  includeSubdirs: boolean;
  totalFound: number;
  filteredCount: number;
  selectedCount: number;
  isScanning: boolean;
  quickView: 'all' | 'rated' | 'tagged';
  ratedCount: number;
  taggedCount: number;
  onSubdirsChange: (include: boolean) => void;
  onOpenFolderPicker: () => void;
  onScan: () => void;
  onQuickViewChange: (view: 'all' | 'rated' | 'tagged') => void;
}

const getFolderName = (path: string) => {
  const parts = path.split('/').filter(Boolean);
  return parts.at(-1) || 'No folder selected';
};

export const SourceSidebar: React.FC<SourceSidebarProps> = ({
  directoryPath,
  includeSubdirs,
  totalFound,
  filteredCount,
  selectedCount,
  isScanning,
  quickView,
  ratedCount,
  taggedCount,
  onSubdirsChange,
  onOpenFolderPicker,
  onScan,
  onQuickViewChange,
}) => (
  <aside className="source-sidebar" aria-label="Gallery sources">
    <div className="sidebar-section">
      <h2>Library</h2>
      <button className={`sidebar-row ${quickView === 'all' ? 'is-active' : ''}`} onClick={() => onQuickViewChange('all')} type="button">
        <Images aria-hidden="true" />
        <span>All images</span>
        <span className="sidebar-count">{totalFound}</span>
      </button>
      <button className={`sidebar-row ${quickView === 'rated' ? 'is-active' : ''}`} onClick={() => onQuickViewChange('rated')} type="button">
        <Star aria-hidden="true" />
        <span>Rated</span>
        <span className="sidebar-count">{ratedCount}</span>
      </button>
      <button className={`sidebar-row ${quickView === 'tagged' ? 'is-active' : ''}`} onClick={() => onQuickViewChange('tagged')} type="button">
        <Tags aria-hidden="true" />
        <span>Tagged</span>
        <span className="sidebar-count">{taggedCount}</span>
      </button>
      <div className="sidebar-row">
        <ListFilter aria-hidden="true" />
        <span>Visible</span>
        <span className="sidebar-count">{filteredCount}</span>
      </div>
      <div className="sidebar-row">
        <CheckCircle2 aria-hidden="true" />
        <span>Selected</span>
        <span className="sidebar-count">{selectedCount}</span>
      </div>
    </div>

    <div className="sidebar-divider" />

    <div className="sidebar-section">
      <h2>Folder</h2>
      <button className="folder-source" onClick={onOpenFolderPicker} type="button">
        <span className="folder-source-icon"><Folder aria-hidden="true" /></span>
        <span className="folder-source-copy">
          <strong>{getFolderName(directoryPath)}</strong>
          <small>{directoryPath || 'Choose a local image folder'}</small>
        </span>
      </button>
      <button className="sidebar-action" onClick={onOpenFolderPicker} type="button">
        <FolderOpen aria-hidden="true" />
        Choose folder…
      </button>
    </div>

    <div className="sidebar-divider" />

    <div className="sidebar-section sidebar-scan-section">
      <h2>Scan options</h2>
      <label className="mac-toggle-row">
        <span>Include subfolders</span>
        <input
          type="checkbox"
          checked={includeSubdirs}
          onChange={(event) => onSubdirsChange(event.target.checked)}
        />
        <span className="mac-toggle" aria-hidden="true" />
      </label>
      <button className="sidebar-action" onClick={onScan} disabled={isScanning} type="button">
        <ScanSearch className={isScanning ? 'is-spinning' : ''} aria-hidden="true" />
        {isScanning ? 'Scanning…' : 'Rescan folder'}
      </button>
    </div>
  </aside>
);
