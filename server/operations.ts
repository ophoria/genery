import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { Readable, Transform, pipeline } from 'node:stream';
import { safeBasename } from './security/paths.js';
import { BatchRequest, BatchResult } from '../src/types/gallery.js';
import { metadataStore } from './metadataStore.js';
import { copyAIResults, fingerprint, getAIResults, saveAIResult } from './ai/store.js';

function renameName(file: string, pattern: string, index: number) {
  safeBasename(pattern);
  const ext = path.extname(file);
  const date = fs.statSync(file).birthtime.toISOString().split('T')[0].replace(/-/g, '');
  return safeBasename(pattern.replace(/\{n:(\d+)\}/g, (_, width) => {
    const size = Number(width); if (size > 12) throw new Error('Number padding must be at most 12.');
    return String(index).padStart(size, '0');
  }).replace(/\{n\}/g, String(index)).replace(/\{orig\}/g, path.basename(file, ext)).replace(/\{date\}/g, date).replace(/\{ext\}/g, ext.slice(1)) + ext);
}

export async function executeBatchOperation(req: BatchRequest, permitted: (file: string, kind: 'image' | 'destination') => string = file => file): Promise<BatchResult> {
  const { action, imagePaths, targetDirectory, renamePattern, zipFileName } = req;
  const errors: string[] = [];
  let affectedCount = 0;

  if (!imagePaths || imagePaths.length === 0) {
    return {
      success: false,
      action,
      affectedCount: 0,
      message: 'No images provided for batch operation',
    };
  }

  // Validate the entire operation before creating any destination or changing any source.
  for (const [index, file] of imagePaths.entries()) {
    permitted(file, 'image');
    if (action === 'rename') permitted(path.join(path.dirname(file), renameName(file, renamePattern || 'image_{n:3}', index + 1)), 'destination');
    if (action === 'copy' && targetDirectory) permitted(path.join(targetDirectory, path.basename(file)), 'destination');
  }
  if (action === 'zip') permitted(path.join(targetDirectory || path.dirname(imagePaths[0]), safeBasename(zipFileName || 'gallery_export.zip')), 'destination');

  switch (action) {
    case 'copy': {
      if (!targetDirectory) {
        return { success: false, action, affectedCount: 0, message: 'Target directory is required for copy operation' };
      }
      if (!fs.existsSync(targetDirectory)) {
        fs.mkdirSync(targetDirectory, { recursive: true });
      }

      for (const filePath of imagePaths) {
        try {
          if (fs.existsSync(filePath)) {
            const fileName = path.basename(filePath);
            let destPath = path.join(targetDirectory, fileName);
            
            // Handle duplicate names
            if (fs.existsSync(destPath)) {
              const ext = path.extname(fileName);
              const base = path.basename(fileName, ext);
              destPath = path.join(targetDirectory, `${base}_${Date.now()}${ext}`);
            }

            permitted(filePath, 'image');
            permitted(destPath, 'destination');
            fs.copyFileSync(filePath, destPath, fs.constants.COPYFILE_EXCL);
            try { copyAIResults(filePath, destPath); }
            catch (error) { errors.push(`Copied ${fileName}, but could not save its AI results: ${(error as Error).message}`); }
            affectedCount++;
          } else {
            errors.push(`File not found: ${filePath}`);
          }
        } catch (err: any) {
          errors.push(`Failed to copy ${filePath}: ${err.message}`);
        }
      }

      return {
        success: affectedCount > 0,
        action,
        affectedCount,
        message: `Successfully copied ${affectedCount} files to ${targetDirectory}`,
        errors: errors.length > 0 ? errors : undefined,
      };
    }

    case 'delete': {
      for (const filePath of imagePaths) {
        try {
          if (fs.existsSync(filePath)) {
            permitted(filePath, 'image');
            fs.unlinkSync(filePath);
            affectedCount++;
          } else {
            errors.push(`File not found: ${filePath}`);
          }
        } catch (err: any) {
          errors.push(`Failed to delete ${filePath}: ${err.message}`);
        }
      }

      return {
        success: affectedCount > 0,
        action,
        affectedCount,
        message: `Successfully deleted ${affectedCount} files`,
        errors: errors.length > 0 ? errors : undefined,
      };
    }

    case 'rename': {
      const pattern = renamePattern || 'image_{n:3}';
      let index = 1;

      for (const filePath of imagePaths) {
        try {
          if (fs.existsSync(filePath)) {
            const dir = path.dirname(filePath);
            const ext = path.extname(filePath);
            const origName = path.basename(filePath, ext);

            const newFileName = renameName(filePath, pattern, index);
            const newFilePath = path.join(dir, newFileName);

            if (filePath !== newFilePath) {
              if (fs.existsSync(newFilePath)) {
                errors.push(`Cannot rename ${origName}${ext} -> ${newFileName}: Target file already exists.`);
              } else {
                permitted(filePath, 'image');
                permitted(newFilePath, 'destination');
                const aiResults = getAIResults(filePath);
                // Both names are in the same directory/filesystem. Exclusive linking
                // prevents a concurrent destination from being overwritten by rename.
                fs.linkSync(filePath, newFilePath);
                fs.unlinkSync(filePath);
                try {
                  for (const result of Object.values(aiResults)) {
                    if (result) saveAIResult(newFilePath, { ...result, fingerprint: fingerprint(newFilePath) });
                  }
                } catch (error) { errors.push(`Renamed ${newFileName}, but could not save its AI results: ${(error as Error).message}`); }
                // Update metadata key if stored
                const existingMeta = metadataStore.get(filePath);
                if (existingMeta) {
                  metadataStore.setScore(newFilePath, existingMeta.score || 0);
                  metadataStore.setHashtags(newFilePath, existingMeta.hashtags || []);
                  metadataStore.setComment(newFilePath, existingMeta.comment || '');
                }
                affectedCount++;
              }
            }
            index++;
          } else {
            errors.push(`File not found: ${filePath}`);
          }
        } catch (err: any) {
          errors.push(`Failed to rename ${filePath}: ${err.message}`);
        }
      }

      return {
        success: affectedCount > 0,
        action,
        affectedCount,
        message: `Successfully renamed ${affectedCount} files`,
        errors: errors.length > 0 ? errors : undefined,
      };
    }

    case 'zip': {
      const outputDir = targetDirectory || path.dirname(imagePaths[0]);
      const zipName = safeBasename(zipFileName || `gallery_export_${Date.now()}.zip`);
      const outputPath = path.join(outputDir, zipName.endsWith('.zip') ? zipName : `${zipName}.zip`);

      return new Promise<BatchResult>((resolve) => {
        permitted(outputPath, 'destination');
        const output = fs.createWriteStream(outputPath, { flags: 'wx' });
        const archive = archiver('zip', { zlib: { level: 9 } });
        let failed = false;
        const fail = () => {
          if (failed) return;
          failed = true; archive.abort(); output.destroy();
          resolve({ success: false, action, affectedCount: 0, message: 'Archive could not be completed. Check access and choose an unused destination.' });
        };
        archive.on('error', fail); archive.on('warning', fail); output.on('error', fail);
        const gate = new Transform({ transform(chunk, _encoding, callback) {
          try { permitted(outputPath, 'destination'); callback(null, chunk); }
          catch (error) { callback(error as Error); }
        } });
        pipeline(archive, gate, output, error => {
          if (error) return fail();
          if (!failed) resolve({ success: true, action, affectedCount: imagePaths.length, message: `Successfully created zip archive (${archive.pointer()} total bytes)`, zipFilePath: outputPath });
        });
        // Async generators open one source at consumption time, without queuing
        // thousands of descriptors. Check grants again before every source chunk.
        for (const filePath of imagePaths) {
          const source = Readable.from((async function* () {
            permitted(filePath, 'image');
            const fd = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
            let input: fs.ReadStream;
            try {
              permitted(filePath, 'image');
              const opened = fs.fstatSync(fd); const current = fs.statSync(filePath);
              if (!opened.isFile() || opened.ino !== current.ino || opened.dev !== current.dev) throw new Error('Source changed.');
              input = fs.createReadStream(filePath, { fd, autoClose: true });
            } catch (error) { fs.closeSync(fd); throw error; }
            try { for await (const chunk of input) { permitted(filePath, 'image'); yield chunk; } }
            finally { input.destroy(); }
          })());
          source.on('error', fail);
          archive.append(source, { name: path.basename(filePath) });
        }
        void archive.finalize().catch(fail);
      });
    }

    default:
      return {
        success: false,
        action,
        affectedCount: 0,
        message: `Unsupported batch action: ${action}`,
      };
  }
}
