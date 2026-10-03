import type { ImageItem } from '../types/gallery';
import type { AIVariant } from '../types/ai';

export interface TagStatistic { label: string; count: number; averageScore: number; groups: string[]; models: string[] }
export type TagSort = 'label' | 'count' | 'averageScore';
export function collectAIStatistics(images: ImageItem[], model: AIVariant | 'all' = 'all') {
  const tags = new Map<string, { count: number; scoreSum: number; groups: Set<string>; models: Set<string> }>();
  const modelCounts = new Map<string, number>();
  let analyzedImages = 0;
  let taggedImages = 0;
  for (const image of images) {
    const perImage = new Map<string, { score: number; groups: Set<string>; models: Set<string> }>();
    let analyzed = false;
    for (const result of Object.values(image.ai || {})) {
      if (!result) continue;
      modelCounts.set(result.variant, (modelCounts.get(result.variant) || 0) + 1);
      if (model !== 'all' && result.variant !== model) continue;
      analyzed = true;
      for (const tag of result.tags) {
        const label = tag.label.trim().toLowerCase();
        if (!label) continue;
        const entry = perImage.get(label) || { score: tag.score, groups: new Set<string>(), models: new Set<string>() };
        entry.score = Math.max(entry.score, tag.score);
        entry.groups.add(tag.group);
        entry.models.add(result.variant);
        perImage.set(label, entry);
      }
    }
    if (analyzed) analyzedImages++;
    if (perImage.size) taggedImages++;
    for (const [label, entry] of perImage) {
      const total = tags.get(label) || { count: 0, scoreSum: 0, groups: new Set<string>(), models: new Set<string>() };
      total.count++;
      total.scoreSum += entry.score;
      entry.groups.forEach(group => total.groups.add(group));
      entry.models.forEach(variant => total.models.add(variant));
      tags.set(label, total);
    }
  }
  return {
    analyzedImages, taggedImages, modelCounts,
    tags: [...tags].map(([label, entry]): TagStatistic => ({ label, count: entry.count, averageScore: entry.scoreSum / entry.count, groups: [...entry.groups].sort(), models: [...entry.models].sort() })),
  };
}
export function sortTagStatistics(tags: TagStatistic[], field: TagSort, direction: 'asc' | 'desc') {
  const factor = direction === 'asc' ? 1 : -1;
  return [...tags].sort((a, b) => factor * (field === 'label' ? a.label.localeCompare(b.label) : a[field] - b[field]) || a.label.localeCompare(b.label));
}
