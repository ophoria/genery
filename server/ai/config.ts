import { AI_MODELS, AIFamily, AISettings, AIVariant } from '../../src/types/ai.js';

export function familyFor(variant: unknown): AIFamily {
  if (typeof variant !== 'string' || !Object.hasOwn(AI_MODELS, variant)) throw new Error('Choose a supported model.');
  return AI_MODELS[variant as AIVariant].family;
}

export function validateSettings(value: unknown): AISettings {
  if (!value || typeof value !== 'object') throw new Error('Model settings are required.');
  const s = value as AISettings;
  const family = familyFor(s.variant);
  if (!['auto', 'cpu', 'mps'].includes(s.device) || (family === 'wd' && s.device === 'mps')) throw new Error('This model does not support the selected device.');
  for (const key of ['threshold', 'wdCharacterThreshold'] as const) {
    if (typeof s[key] !== 'number' || !Number.isFinite(s[key]) || s[key] < 0 || s[key] > 1) throw new Error('Thresholds must be between 0 and 1.');
  }
  if (!Number.isInteger(s.maxTags) || s.maxTags < 1 || s.maxTags > 200) throw new Error('Maximum tags must be between 1 and 200.');
  if (!Number.isInteger(s.siglipTopPerGroup) || s.siglipTopPerGroup < 1 || s.siglipTopPerGroup > 20) throw new Error('Matches per group must be between 1 and 20.');
  for (const key of ['ramUseModelThresholds', 'wdIncludeCharacters', 'wdIncludeRatings'] as const) {
    if (typeof s[key] !== 'boolean') throw new Error('Invalid model options.');
  }
  if (!Array.isArray(s.excludedTags) || s.excludedTags.length > 500 || s.excludedTags.some(t => typeof t !== 'string' || t.length > 200)) throw new Error('Enter at most 500 excluded tags.');
  if (typeof s.siglipTemplate !== 'string' || s.siglipTemplate.length > 500 || s.siglipTemplate.split('{}').length !== 2) throw new Error('The description template must contain exactly one {} placeholder.');
  if (!Array.isArray(s.siglipLabels) || s.siglipLabels.length > 300 || (family === 'siglip' && !s.siglipLabels.length)) throw new Error('Enter between 1 and 300 SigLIP labels.');
  const seen = new Set<string>();
  for (const row of s.siglipLabels) {
    if (!row || ['group', 'label', 'description'].some(k => typeof row[k as keyof typeof row] !== 'string' || !row[k as keyof typeof row].trim() || row[k as keyof typeof row].length > 300)) throw new Error('Every label needs a group, label, and description.');
    const key = `${row.group.trim().toLowerCase()}\0${row.label.trim().toLowerCase()}`;
    if (seen.has(key)) throw new Error('Labels must be unique within each group.');
    seen.add(key);
  }
  return { ...s, excludedTags: s.excludedTags.map(t => t.trim()).filter(Boolean), siglipLabels: s.siglipLabels.map(row => ({ group: row.group.trim(), label: row.label.trim(), description: row.description.trim() })) };
}
