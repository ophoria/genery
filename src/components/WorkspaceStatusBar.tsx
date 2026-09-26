import React from 'react';
import { Command, Image as ImageIcon } from 'lucide-react';

interface WorkspaceStatusBarProps {
  filteredCount: number;
  totalCount: number;
  selectedCount: number;
  isScanning: boolean;
}

export const WorkspaceStatusBar: React.FC<WorkspaceStatusBarProps> = ({
  filteredCount,
  totalCount,
  selectedCount,
  isScanning,
}) => (
  <footer className="workspace-statusbar">
    <div className="status-summary">
      <ImageIcon aria-hidden="true" />
      <span>{isScanning ? 'Scanning folder…' : `${filteredCount} of ${totalCount} images`}</span>
      {selectedCount > 0 && <span className="selection-summary">{selectedCount} selected</span>}
    </div>
    <div className="status-shortcuts" aria-label="Keyboard shortcuts summary">
      <span><kbd>← ↑ ↓ →</kbd> Navigate</span>
      <span><kbd>Space</kbd> Quick Look</span>
      <span><kbd>Shift</kbd> click Range</span>
      <span><Command aria-hidden="true" /> click Multi-select</span>
    </div>
  </footer>
);
