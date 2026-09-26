import React from 'react';
import {
  CalendarDays,
  Expand,
  FileImage,
  Hash,
  HardDrive,
  Maximize2,
  MessageSquare,
  Star,
  X,
} from 'lucide-react';
import { ImageItem } from '../types/gallery';
import { getImageUrl } from '../services/api';

interface InspectorPanelProps {
  image: ImageItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRate: (score: number) => void;
  onOpenHashtags: () => void;
  onOpenComment: () => void;
  onOpenFullscreen: () => void;
}

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  image,
  isOpen,
  onClose,
  onRate,
  onOpenHashtags,
  onOpenComment,
  onOpenFullscreen,
}) => (
  <aside className={`inspector-panel ${isOpen ? 'is-open' : ''}`} aria-label="Image inspector">
    <div className="inspector-titlebar">
      <div>
        <strong>{image ? 'Image details' : 'Nothing selected'}</strong>
      </div>
      <button className="icon-button inspector-close" onClick={onClose} type="button" aria-label="Close inspector">
        <X aria-hidden="true" />
      </button>
    </div>

    {image ? (
      <div className="inspector-scroll">
        <button className="inspector-preview" onClick={onOpenFullscreen} type="button" title="Open Quick Look">
          <img src={getImageUrl(image.path)} alt={image.name} />
          <span><Expand aria-hidden="true" /> Quick Look</span>
        </button>

        <div className="inspector-heading">
          <h2 title={image.name}>{image.name}</h2>
          <p title={image.path}>{image.relativePath || image.path}</p>
        </div>

        <dl className="fact-grid">
          <div><dt><Maximize2 aria-hidden="true" /> Dimensions</dt><dd>{image.width} × {image.height}</dd></div>
          <div><dt><HardDrive aria-hidden="true" /> File size</dt><dd>{formatBytes(image.size)}</dd></div>
          <div><dt><FileImage aria-hidden="true" /> Format</dt><dd>{image.extension.toUpperCase()}</dd></div>
          <div><dt><CalendarDays aria-hidden="true" /> Created</dt><dd>{formatDate(image.createdAt)}</dd></div>
        </dl>

        <section className="inspector-section">
          <div className="section-label"><span>Rating</span><kbd>1–5</kbd></div>
          <div className="rating-control" aria-label={`Rating: ${image.score} out of 5`}>
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => onRate(score === image.score ? 0 : score)}
                className={score <= image.score ? 'is-filled' : ''}
                aria-label={`Rate ${score} stars`}
              >
                <Star aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        <section className="inspector-section">
          <div className="section-label"><span>Tags</span><kbd>↩</kbd></div>
          <button className="inspector-edit-row" onClick={onOpenHashtags} type="button">
            <Hash aria-hidden="true" />
            <span className="tag-list">
              {image.hashtags.length > 0
                ? image.hashtags.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>)
                : <em>Add tags…</em>}
            </span>
          </button>
        </section>

        <section className="inspector-section">
          <div className="section-label"><span>Comment</span><kbd>⇧↩</kbd></div>
          <button className="inspector-edit-row inspector-comment" onClick={onOpenComment} type="button">
            <MessageSquare aria-hidden="true" />
            <span>{image.comment || <em>Add a comment…</em>}</span>
          </button>
        </section>
      </div>
    ) : (
      <div className="inspector-empty">
        <FileImage aria-hidden="true" />
        <strong>Select an image</strong>
        <p>Its preview and file details will appear here.</p>
      </div>
    )}
  </aside>
);
