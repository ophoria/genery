import {
  ImageItem,
  BasicFilterOptions,
  AdvancedFilterGroup,
  SingleRule,
  SortOptions,
} from '../types/gallery';

/**
 * Basic Filter Evaluation
 */
export function filterImages(
  images: ImageItem[],
  filters: BasicFilterOptions,
  advancedGroup?: AdvancedFilterGroup
): ImageItem[] {
  return images.filter((img) => {
    // 1. Extensions / Types Filter
    if (filters.selectedTypes.length > 0) {
      if (!filters.selectedTypes.includes(img.extension.toLowerCase())) {
        return false;
      }
    }

    // 2. Width Filter
    if (filters.minWidth !== undefined && filters.minWidth > 0) {
      if (img.width < filters.minWidth) return false;
    }
    if (filters.maxWidth !== undefined && filters.maxWidth > 0) {
      if (img.width > filters.maxWidth) return false;
    }

    // 3. Height Filter
    if (filters.minHeight !== undefined && filters.minHeight > 0) {
      if (img.height < filters.minHeight) return false;
    }
    if (filters.maxHeight !== undefined && filters.maxHeight > 0) {
      if (img.height > filters.maxHeight) return false;
    }

    // 4. Aspect Ratio Filter
    if (filters.aspectRatio !== 'any') {
      const ar = img.aspectRatio;
      if (filters.aspectRatio === 'landscape' && ar < 1.1) return false;
      if (filters.aspectRatio === 'portrait' && ar > 0.9) return false;
      if (filters.aspectRatio === 'square' && (ar < 0.9 || ar > 1.1)) return false;
    }

    // 5. Creation Date Range Filter
    if (filters.minDate) {
      const imgDate = new Date(img.createdAt).getTime();
      const minDate = new Date(filters.minDate).getTime();
      if (imgDate < minDate) return false;
    }
    if (filters.maxDate) {
      const imgDate = new Date(img.createdAt).getTime();
      const maxDate = new Date(filters.maxDate).getTime();
      // Set end of day for maxDate if only YYYY-MM-DD
      const maxTime = filters.maxDate.includes('T')
        ? new Date(filters.maxDate).getTime()
        : new Date(`${filters.maxDate}T23:59:59.999Z`).getTime();
      if (imgDate > maxTime) return false;
    }

    // 6. Score Filter (Ranges)
    if (filters.minScore !== undefined) {
      if (img.score < filters.minScore) return false;
    }
    if (filters.maxScore !== undefined) {
      if (img.score > filters.maxScore) return false;
    }

    // 7. Hashtags Filter
    if (filters.hashtags.length > 0) {
      const imgTags = img.hashtags.map((t) => t.toLowerCase());
      const filterTags = filters.hashtags.map((t) => t.toLowerCase().replace(/^#/, ''));

      if (filters.hashtagOperator === 'AND') {
        const hasAll = filterTags.every((t) => imgTags.includes(t));
        if (!hasAll) return false;
      } else if (filters.hashtagOperator === 'OR') {
        const hasAny = filterTags.some((t) => imgTags.includes(t));
        if (!hasAny) return false;
      } else if (filters.hashtagOperator === 'NOT') {
        const hasAny = filterTags.some((t) => imgTags.includes(t));
        if (hasAny) return false;
      }
    }

    const allTags = [...img.hashtags, ...Object.values(img.ai || {}).flatMap(result => result?.tags.map(tag => tag.label) || [])]
      .map(tag => tag.trim().toLowerCase().replace(/^#/, ''));
    const normalize = (tags: string[]) => tags.map(tag => tag.trim().toLowerCase().replace(/^#/, '')).filter(Boolean);
    if (!normalize(filters.includedTags || []).every(tag => allTags.includes(tag))) return false;
    if (normalize(filters.excludedTags || []).some(tag => allTags.includes(tag))) return false;

    // 8. Text Search Query (Filename, Comment, Manual and AI Tags)
    if (filters.searchQuery.trim().length > 0) {
      const query = filters.searchQuery.trim().toLowerCase();
      const tagQuery = query.replace(/^#/, '');
      const matchName = img.name.toLowerCase().includes(query);
      const matchComment = img.comment.toLowerCase().includes(query);
      const matchTags = img.hashtags.some((t) => t.toLowerCase().replace(/^#/, '').includes(tagQuery));
      const matchAI = Object.values(img.ai || {}).some(result => result?.tags.some(tag => tag.label.toLowerCase().includes(tagQuery) || tag.group.toLowerCase().includes(query)));
      if (!matchName && !matchComment && !matchTags && !matchAI) return false;
    }

    // 9. Advanced Rules Tree (AND / OR / NOT)
    if (advancedGroup && advancedGroup.rules.length > 0) {
      if (!evaluateAdvancedGroup(img, advancedGroup)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Evaluate Advanced Rule Group (AND / OR / NOT)
 */
export function evaluateAdvancedGroup(
  img: ImageItem,
  group: AdvancedFilterGroup
): boolean {
  if (group.rules.length === 0) return true;

  const results = group.rules.map((rule) => {
    if ('logicalOp' in rule) {
      return evaluateAdvancedGroup(img, rule);
    } else {
      return evaluateSingleRule(img, rule);
    }
  });

  if (group.logicalOp === 'AND') {
    return results.every(Boolean);
  } else if (group.logicalOp === 'OR') {
    return results.some(Boolean);
  } else if (group.logicalOp === 'NOT') {
    // NOT group negates the AND of its sub-rules
    return !results.every(Boolean);
  }

  return true;
}

/**
 * Evaluate Single Condition Rule
 */
export function evaluateSingleRule(img: ImageItem, rule: SingleRule): boolean {
  const { field, operator, value, value2 } = rule;

  let imgVal: any;

  switch (field) {
    case 'extension':
      imgVal = img.extension.toLowerCase();
      break;
    case 'width':
      imgVal = img.width;
      break;
    case 'height':
      imgVal = img.height;
      break;
    case 'aspectRatio':
      imgVal = img.aspectRatio;
      break;
    case 'score':
      imgVal = img.score;
      break;
    case 'hashtag':
      imgVal = img.hashtags.map((t) => t.toLowerCase());
      break;
    case 'aiTag':
      imgVal = Object.values(img.ai || {}).flatMap(result => result?.tags.map(tag => tag.label.toLowerCase()) || []);
      break;
    case 'aiGroup':
      imgVal = Object.values(img.ai || {}).flatMap(result => result?.tags.map(tag => tag.group.toLowerCase()) || []);
      break;
    case 'aiModel':
      imgVal = Object.values(img.ai || {}).flatMap(result => result ? [result.variant] : []);
      break;
    case 'comment':
      imgVal = img.comment.toLowerCase();
      break;
    case 'createdAt':
      imgVal = new Date(img.createdAt).getTime();
      break;
    case 'size':
      imgVal = img.size;
      break;
    case 'name':
      imgVal = img.name.toLowerCase();
      break;
    default:
      return true;
  }

  const targetVal = typeof value === 'string' ? value.toLowerCase() : value;

  switch (operator) {
    case 'equals':
      return Array.isArray(imgVal) ? imgVal.includes(targetVal) : imgVal === targetVal;
    case 'not_equals':
      return Array.isArray(imgVal) ? !imgVal.includes(targetVal) : imgVal !== targetVal;
    case 'greater_than':
      return imgVal > Number(targetVal);
    case 'less_than':
      return imgVal < Number(targetVal);
    case 'between': {
      const v1 = Number(targetVal);
      const v2 = Number(value2);
      return imgVal >= Math.min(v1, v2) && imgVal <= Math.max(v1, v2);
    }
    case 'contains':
      if (Array.isArray(imgVal)) {
        return imgVal.some((v) => String(v).includes(String(targetVal)));
      }
      return String(imgVal).includes(String(targetVal));
    case 'not_contains':
      if (Array.isArray(imgVal)) {
        return !imgVal.some((v) => String(v).includes(String(targetVal)));
      }
      return !String(imgVal).includes(String(targetVal));
    case 'in': {
      const list = String(targetVal)
        .split(',')
        .map((s) => s.trim().toLowerCase());
      if (Array.isArray(imgVal)) {
        return imgVal.some((v) => list.includes(String(v)));
      }
      return list.includes(String(imgVal));
    }
    default:
      return true;
  }
}

/**
 * Sorting Engine
 */
export function sortImages(images: ImageItem[], sort: SortOptions): ImageItem[] {
  const sorted = [...images];
  const factor = sort.direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sort.field) {
      case 'name':
        return factor * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      case 'createdAt':
        return factor * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'modifiedAt':
        return factor * (new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime());
      case 'score':
        return factor * (a.score - b.score);
      case 'width':
        return factor * (a.width - b.width);
      case 'height':
        return factor * (a.height - b.height);
      case 'size':
        return factor * (a.size - b.size);
      default:
        return 0;
    }
  });

  return sorted;
}
