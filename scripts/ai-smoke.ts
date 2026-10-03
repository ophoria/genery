// Downloads selected models and runs actual local inference on a supplied image.
// Usage: npm run ai:smoke -- wd-swinv2 test-gallery/mountain_sunset.jpg
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { aiStatus, analyzeImages, installAIModel } from '../server/ai/service.js';
import { familyFor } from '../server/ai/config.js';
import { getAIResults } from '../server/ai/store.js';
import { AI_MODELS, AIVariant, DEFAULT_AI_SETTINGS } from '../src/types/ai.js';

const variant = process.argv[2] as AIVariant;
familyFor(variant);
const file = path.resolve(process.argv[3] || 'test-gallery/mountain_sunset.jpg');
async function wait() {
  let message = '';
  while (aiStatus().job?.state === 'running') {
    const current = aiStatus().job!;
    if (current.message !== message) { console.log(current.message); message = current.message; }
    await setTimeout(1000);
  }
  const current = aiStatus().job!;
  if (current.state !== 'completed') throw new Error(JSON.stringify(current));
}
if (!aiStatus().models.find(model => model.variant === variant)?.installed) {
  installAIModel(variant);
  await wait();
}
analyzeImages([file], { ...DEFAULT_AI_SETTINGS[familyFor(variant)], variant }, true);
await wait();
console.log(JSON.stringify({ model: AI_MODELS[variant].name, result: getAIResults(file)[familyFor(variant)] }, null, 2));
