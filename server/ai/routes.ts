import { Router } from 'express';
import path from 'node:path';
import { aiStatus, analyzeImages, cancelAIJob, installAIModel } from './service.js';
import { familyFor, validateSettings } from './config.js';
import { deleteAIResult, getAIResults, readAISettings, saveAISettings } from './store.js';
import { AccessError, authorizePath } from '../security/paths.js';
import { AIFamily } from '../../src/types/ai.js';

export const aiRouter = Router();
let ownedJob: { id: string; owner: string } | null = null;
aiRouter.get('/status', (req, res) => {
  const status = aiStatus();
  const admin = req.access.user!.role === 'admin';
  res.json({ ...status, settings: admin ? status.settings : readAISettings(req.access.user!.id), job: admin || ownedJob?.owner === req.access.user!.id && ownedJob?.id === status.job?.id ? status.job : null });
});
aiRouter.post('/settings', (req, res) => {
  try {
    const settings = validateSettings(req.body.settings);
    saveAISettings(familyFor(settings.variant), settings, req.access.user!.role === 'admin' ? undefined : req.access.user!.id);
    res.json({ settings });
  } catch (error) { res.status(400).json({ error: (error as Error).message }); }
});
aiRouter.post('/install', (req, res) => {
  try {
    const job = installAIModel(req.body.variant, () => { if (req.access.currentUser().role === 'normal') throw new AccessError(); });
    ownedJob = { id: job.id, owner: req.access.user!.id };
    res.status(202).json(job);
  }
  catch (error) { res.status(400).json({ error: (error as Error).message }); }
});
aiRouter.post('/analyze', (req, res) => {
  try {
    const user = req.access.user!;
    const job = analyzeImages(req.body.paths, req.body.settings, req.body.force === true, file => { const latest = req.access.currentUser(); if (latest.role === 'normal') throw new AccessError(); authorizePath(latest, file); }, user.role === 'admin');
    if (user.role !== 'admin') saveAISettings(familyFor(req.body.settings.variant), validateSettings(req.body.settings), user.id);
    ownedJob = { id: job.id, owner: user.id };
    res.status(202).json(job);
  }
  catch (error) { res.status(400).json({ error: (error as Error).message }); }
});
aiRouter.post('/cancel', (req, res) => {
  try {
    if (req.access.user!.role !== 'admin' && (ownedJob?.owner !== req.access.user!.id || ownedJob?.id !== req.body.id)) throw new AccessError();
    res.json(cancelAIJob(req.body.id));
  }
  catch (error) { res.status(error instanceof AccessError ? error.status : 400).json({ error: error instanceof AccessError ? error.message : 'Could not cancel task.' }); }
});
aiRouter.post('/results', (req, res) => {
  const files = req.body.paths;
  if (!Array.isArray(files) || files.length > 5000 || files.some(p => typeof p !== 'string')) return res.status(400).json({ error: 'Provide at most 5000 image paths.' });
  res.json(Object.fromEntries(files.map(file => [file, getAIResults(path.resolve(file))])));
});
aiRouter.post('/clear', (req, res) => {
  if (typeof req.body.path !== 'string' || !['ram', 'wd', 'siglip'].includes(req.body.family)) return res.status(400).json({ error: 'Choose an image and model family.' });
  if (aiStatus().job?.state === 'running') return res.status(409).json({ error: 'Wait for the AI task to finish before clearing results.' });
  try { res.json(deleteAIResult(path.resolve(req.body.path), req.body.family as AIFamily)); }
  catch (error) { res.status(500).json({ error: (error as Error).message }); }
});
