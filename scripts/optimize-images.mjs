#!/usr/bin/env node

/**
 * Image Optimization Script
 * Optimizes images in public directory for better performance
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = 'public';
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png'];

async function optimizeImage(filePath) {
  try {
    const ext = extname(filePath).toLowerCase();

    if (!SUPPORTED_FORMATS.includes(ext)) {
      return;
    }

    const image = sharp(filePath);
    const metadata = await image.metadata();

    console.log(`Optimizing: ${filePath} (${metadata.width}x${metadata.height})`);

    // Convert to WebP for better compression
    const webpPath = filePath.replace(ext, '.webp');
    await image
      .webp({ quality: 85, effort: 6 })
      .toFile(webpPath);

    // Also optimize the original
    await image
      .jpeg({ quality: 85, progressive: true, mozjpeg: true })
      .png({ quality: 85, compressionLevel: 9 })
      .toFile(filePath + '.optimized');

    console.log(`✓ Created WebP version: ${webpPath}`);
  } catch (error) {
    console.error(`Failed to optimize ${filePath}:`, error.message);
  }
}

async function walkDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(fullPath);
    } else if (entry.isFile()) {
      await optimizeImage(fullPath);
    }
  }
}

console.log('Starting image optimization...');
await walkDirectory(PUBLIC_DIR);
console.log('Image optimization complete!');
