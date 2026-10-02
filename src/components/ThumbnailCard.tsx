import React from 'react';
import { ThumbnailAlignment } from '../utils/thumbnailSettings';
import { Check, MessageSquare, Star } from 'lucide-react';
import { ImageItem } from '../types/gallery';
import { getThumbnailUrl } from '../services/api';

interface ThumbnailCardProps {
  image: ImageItem;
  alignment: ThumbnailAlignment;
  isFocused: boolean;
  isSelected: boolean;
  onFocus: () => void;
  onToggleSelection: () => void;
  onRangeSelection: (additive: boolean) => void;
  onDoubleClick: () => void;
}

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const ThumbnailCard: React.FC<ThumbnailCardProps> = ({
  image,
  alignment,
  isFocused,
  isSelected,
  onFocus,
  onToggleSelection,
  onRangeSelection,
  onDoubleClick,
}) => (
  <article
    data-image-id={image.id}
    className={`proof-card ${isFocused ? 'is-focused' : ''} ${isSelected ? 'is-selected' : ''}`}
    onClick={(event) => {
      if (event.shiftKey) onRangeSelection(event.metaKey || event.ctrlKey);
      else if (event.metaKey || event.ctrlKey) onToggleSelection();
      else onFocus();
    }}
    onMouseDown={(event) => {
      if (event.shiftKey) event.preventDefault();
    }}
    onDoubleClick={(event) => {
      if (!event.shiftKey && !event.metaKey && !event.ctrlKey) onDoubleClick();
    }}
    role="gridcell"
    aria-selected={isSelected}
    tabIndex={isFocused ? 0 : -1}
  >
    <div className="proof-image">
      <img
        src={getThumbnailUrl(image.path, 480)}
        alt={image.name}
        style={{ objectPosition: `center ${alignment}` }}
        loading="lazy"
        draggable={false}
      />
      <button
        className="selection-check"
        type="button"
        aria-label={isSelected ? `Remove ${image.name} from selection` : `Add ${image.name} to selection`}
        aria-pressed={isSelected}
        onClick={(event) => {
          event.stopPropagation();
          if (event.shiftKey) onRangeSelection(true);
          else onToggleSelection();
        }}
      >
        {isSelected && <Check aria-hidden="true" />}
      </button>
      <span className="format-badge">{image.extension}</span>
      {image.comment && (
        <span className="comment-mark" title="Has a comment"><MessageSquare aria-hidden="true" /></span>
      )}
    </div>

    <div className="proof-info">
      <div className="proof-name-row">
        <strong title={image.name}>{image.name}</strong>
        {image.score > 0 && (
          <span className="proof-rating" aria-label={`Rated ${image.score} out of 5`}>
            <Star aria-hidden="true" />
            {image.score}
          </span>
        )}
      </div>
      <div className="proof-facts">
        <span>{image.width > 0 ? `${image.width} × ${image.height}` : 'Unknown size'}</span>
        <span>{formatDate(image.createdAt)}</span>
      </div>
      {image.hashtags.length > 0 && (
        <div className="proof-tags" aria-label="Tags">
          {image.hashtags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
          {image.hashtags.length > 2 && <span>+{image.hashtags.length - 2}</span>}
        </div>
      )}
    </div>
  </article>
);
