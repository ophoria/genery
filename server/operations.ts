import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { BatchRequest, BatchResult } from '../src/types/gallery.js';
import { metadataStore } from './metadataStore.js';

export async function executeBatchOperation(req: BatchRequest): Promise<BatchResult> {
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

            fs.copyFileSync(filePath, destPath);
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
            const stats = fs.statSync(filePath);
            const dateStr = stats.birthtime.toISOString().split('T')[0].replace(/-/g, '');

            // Process pattern: {n}, {n:3}, {orig}, {date}, {ext}
            let newBaseName = pattern
              .replace(/\{n:(\d+)\}/g, (_, width) => String(index).padStart(parseInt(width, 10), '0'))
              .replace(/\{n\}/g, String(index))
              .replace(/\{orig\}/g, origName)
              .replace(/\{date\}/g, dateStr)
              .replace(/\{ext\}/g, ext.replace(/^\./, ''));

            const newFileName = `${newBaseName}${ext}`;
            const newFilePath = path.join(dir, newFileName);

            if (filePath !== newFilePath) {
              if (fs.existsSync(newFilePath)) {
                errors.push(`Cannot rename ${origName}${ext} -> ${newFileName}: Target file already exists.`);
              } else {
                fs.renameSync(filePath, newFilePath);
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
      const zipName = zipFileName || `gallery_export_${Date.now()}.zip`;
      const outputPath = path.join(outputDir, zipName.endsWith('.zip') ? zipName : `${zipName}.zip`);

      return new Promise<BatchResult>((resolve) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
          resolve({
            success: true,
            action,
            affectedCount: imagePaths.length,
            message: `Successfully created zip archive (${archive.pointer()} total bytes)`,
            zipFilePath: outputPath,
          });
        });

        archive.on('error', (err) => {
          resolve({
            success: false,
            action,
            affectedCount: 0,
            message: `Failed to create zip archive: ${err.message}`,
          });
        });

        archive.pipe(output);

        for (const filePath of imagePaths) {
          if (fs.existsSync(filePath)) {
            archive.file(filePath, { name: path.basename(filePath) });
          }
        }

        archive.finalize();
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
