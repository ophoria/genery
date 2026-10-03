import { useMemo, useState } from 'react';
import { ImageItem } from '../types/gallery';
import { THUMBNAIL_RATIOS, THUMBNAIL_ALIGNMENTS, ThumbnailAlignment, ThumbnailSettings, normalizeFolder, parentFolder, resolveAlignment, setFolderAlignment, ratioLabel } from '../utils/thumbnailSettings';

interface Props {
  settings: ThumbnailSettings;
  directoryPath: string;
  images: ImageItem[];
  autoRatio: number;
  onChange: (settings: ThumbnailSettings) => void;
}

export function ThumbnailControls({ settings, directoryPath, images, autoRatio, onChange }: Props) {
  const [chosenFolder, setChosenFolder] = useState('');
  const root = directoryPath.startsWith('/') ? normalizeFolder(directoryPath) : '';
  const folders = useMemo(() => {
    if (!root) return [];
    const paths = new Set([root]);
    for (const path of [...images.map((image) => parentFolder(image.path)), ...Object.keys(settings.folderAlignments)]) {
      let folder = normalizeFolder(path);
      while (folder !== root && folder.startsWith(root === '/' ? '/' : `${root}/`)) {
        paths.add(folder);
        folder = parentFolder(folder);
      }
    }
    return [...paths].sort();
  }, [root, images, settings.folderAlignments]);
  const folder = folders.includes(chosenFolder) ? chosenFolder : root;
  const override = settings.folderAlignments[folder];
  const inherited = root ? resolveAlignment(parentFolder(folder), settings) : settings.alignment;
  const label = (value: string) => value[0].toUpperCase() + value.slice(1);
  return (
    <div className="thumbnail-controls" role="group" aria-label="Thumbnail appearance">
      <label className="thumbnail-size-control">
        <span>Thumbnail size</span>
        <input type="range" min="100" max="400" step="5" value={settings.size}
          aria-label="Thumbnail size" aria-valuetext={`${settings.size} pixels`}
          onChange={(event) => onChange({ ...settings, size: Number(event.target.value) })} />
        <output>{settings.size} px</output>
      </label>
      <label className="thumbnail-ratio-control">
        <span>Aspect ratio</span>
        <select value={settings.ratio} onChange={(event) => onChange({
          ...settings, ratio: event.target.value as ThumbnailSettings['ratio'],
        })} title="Auto uses the most common image ratio across the scanned folders">
          <option value="auto">Auto · {ratioLabel(autoRatio)}</option>
          {THUMBNAIL_RATIOS.map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
        </select>
      </label>
      <label className="thumbnail-alignment-control">
        <span>Default alignment</span>
        <select value={settings.alignment} onChange={(event) => onChange({
          ...settings, alignment: event.target.value as ThumbnailAlignment,
        })} title="Vertical crop for thumbnails without a folder override">
          {THUMBNAIL_ALIGNMENTS.map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </select>
      </label>
      <label className="mac-toggle-row thumbnail-colored-ratings-control" title="Rating frames: 1 red, 2 orange, 3 light blue, 4 blue, 5 green">
        <input type="checkbox" role="switch" checked={settings.coloredRatings}
          onChange={(event) => onChange({ ...settings, coloredRatings: event.target.checked })} />
        <span className="mac-toggle" aria-hidden="true" />
        <span>Colored Ratings</span>
      </label>
      {root && <div className="thumbnail-folder-controls" role="group" aria-label="Folder thumbnail alignment">
        <label className="thumbnail-folder-picker">
          <span>Folder</span>
          <select value={folder} title={folder} onChange={(event) => setChosenFolder(event.target.value)}>
            {folders.map((path) => <option key={path} value={path}>
              {path === root ? `This folder · ${path.split('/').pop() || '/'}` : path.slice(root === '/' ? 1 : root.length + 1)}
            </option>)}
          </select>
        </label>
        <label>
          <span>Alignment</span>
          <select value={override || 'inherit'} aria-label="Folder alignment" onChange={(event) => onChange(
            setFolderAlignment(settings, folder, event.target.value as ThumbnailAlignment | 'inherit'),
          )} title="Applies to this folder and its subfolders unless they have their own override">
            <option value="inherit">Inherit · {label(folder === '/' ? settings.alignment : inherited)}</option>
            {THUMBNAIL_ALIGNMENTS.map((value) => <option key={value} value={value}>{label(value)}</option>)}
          </select>
        </label>
        <span className="thumbnail-inheritance-note">Subfolders inherit unless overridden.</span>
      </div>}
    </div>
  );
}
