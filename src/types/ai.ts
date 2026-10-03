export type AIFamily = 'ram' | 'wd' | 'siglip';
export type AIVariant = 'ram' | 'ram-plus' | 'wd-swinv2' | 'wd-eva02' | 'siglip-base' | 'siglip-so400m';
export interface AILabel { group: string; label: string; description: string }
export interface AISettings {
  variant: AIVariant;
  device: 'auto' | 'cpu' | 'mps';
  threshold: number;
  maxTags: number;
  excludedTags: string[];
  ramUseModelThresholds: boolean;
  wdCharacterThreshold: number;
  wdIncludeCharacters: boolean;
  wdIncludeRatings: boolean;
  siglipLabels: AILabel[];
  siglipTemplate: string;
  siglipTopPerGroup: number;
}
export interface AITag { label: string; group: string; score: number }
export interface AIResult {
  family: AIFamily;
  variant: AIVariant;
  analyzedAt: string;
  fingerprint: string;
  settingsKey: string;
  device: string;
  tags: AITag[];
  durationMs: number;
}
export interface AIModelStatus { variant: AIVariant; installed: boolean }
export interface AIJob {
  id: string;
  kind: 'install' | 'analyze';
  variant: AIVariant;
  state: 'running' | 'completed' | 'cancelled' | 'failed';
  total: number;
  completed: number;
  skipped: number;
  failed: number;
  message: string;
  errors: string[];
  startedAt: string;
  updatedAt: string;
}
export interface AIStatus { models: AIModelStatus[]; job: AIJob | null; settings: Record<AIFamily, AISettings> }

export const AI_MODELS: Record<AIVariant, { family: AIFamily; name: string; repository: string; download: string }> = {
  ram: { family: 'ram', name: 'RAM', repository: 'xinyu1205/recognize_anything_model', download: 'About 5.6 GB + shared runtime' },
  'ram-plus': { family: 'ram', name: 'RAM++', repository: 'xinyu1205/recognize-anything-plus-model', download: 'About 3 GB + shared runtime' },
  'wd-swinv2': { family: 'wd', name: 'WD SwinV2 v3', repository: 'SmilingWolf/wd-swinv2-tagger-v3', download: 'About 470 MB + shared runtime' },
  'wd-eva02': { family: 'wd', name: 'WD EVA02 Large v3', repository: 'SmilingWolf/wd-eva02-large-tagger-v3', download: 'About 1.3 GB + shared runtime' },
  'siglip-base': { family: 'siglip', name: 'SigLIP 2 Base · 224 px', repository: 'google/siglip2-base-patch16-224', download: 'About 1.5 GB + shared runtime' },
  'siglip-so400m': { family: 'siglip', name: 'SigLIP 2 SO400M · 384 px', repository: 'google/siglip2-so400m-patch14-384', download: 'About 4.5 GB + shared runtime' },
};

export const GAME_ART_LABELS: AILabel[] = [
  ...[
    ['character', 'a game character illustration'], ['creature', 'a fantasy creature or monster'],
    ['environment', 'a game environment or landscape'], ['building', 'a building or architectural game asset'],
    ['weapon', 'a weapon game asset'], ['item', 'an inventory item or collectible game asset'],
    ['vehicle', 'a vehicle game asset'], ['interface', 'a game user interface or HUD'],
  ].map(([label, description]) => ({ group: 'motif', label, description })),
  ...[
    ['pixel art', 'pixel art for a video game'], ['painted', 'hand painted stylized game artwork'],
    ['anime', 'anime style game illustration'], ['low poly', 'a low poly 3D game render'],
    ['realistic', 'a photorealistic game render'], ['vector', 'flat vector game artwork'],
    ['sketch', 'a rough concept art sketch'], ['painterly', 'painterly fantasy concept art'],
  ].map(([label, description]) => ({ group: 'style', label, description })),
  ...[
    ['isometric', 'an isometric view of a game asset'], ['top down', 'a top down view of a game asset'],
    ['side view', 'a side view of a game sprite'], ['portrait', 'a character portrait'],
    ['sprite sheet', 'a sprite sheet with repeated animation frames'],
  ].map(([label, description]) => ({ group: 'composition', label, description })),
];
function defaults(family: AIFamily): AISettings {
  return {
    variant: family === 'ram' ? 'ram-plus' : family === 'wd' ? 'wd-swinv2' : 'siglip-base',
    device: 'auto', threshold: family === 'ram' ? 0.68 : family === 'wd' ? 0.35 : 0.15,
    maxTags: 30, excludedTags: [], ramUseModelThresholds: true,
    wdCharacterThreshold: 0.85, wdIncludeCharacters: false, wdIncludeRatings: false,
    siglipLabels: GAME_ART_LABELS, siglipTemplate: 'This image shows {}.', siglipTopPerGroup: 2,
  };
}
export const DEFAULT_AI_SETTINGS: Record<AIFamily, AISettings> = { ram: defaults('ram'), wd: defaults('wd'), siglip: defaults('siglip') };
