import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { errors } from '../errors.js';

const signatures = [
  {
    ext: 'png',
    mime: 'image/png',
    test: (buffer) =>
      buffer.length > 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },
  {
    ext: 'jpg',
    mime: 'image/jpeg',
    test: (buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    ext: 'gif',
    mime: 'image/gif',
    test: (buffer) =>
      buffer.length > 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii')),
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    test: (buffer) =>
      buffer.length > 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export function detectImage(buffer) {
  return signatures.find((signature) => signature.test(buffer)) || null;
}

export function imageUrl(filename) {
  return `/uploads/${filename}`;
}

export async function saveImageBuffer(buffer, { uploadDir = config.uploadDir } = {}) {
  const detected = detectImage(buffer);
  if (!detected) {
    throw errors.validation('仅支持 PNG、JPEG、GIF 或 WebP 图片。');
  }
  if (buffer.length > config.maxUploadBytes) {
    throw errors.validation(`图片大小不能超过 ${Math.round(config.maxUploadBytes / 1024 / 1024)}MB。`);
  }
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${detected.ext}`;
  await fs.writeFile(path.join(uploadDir, filename), buffer, { flag: 'wx' });
  return {
    filename,
    url: imageUrl(filename),
    mime: detected.mime,
    size: buffer.length,
  };
}

export async function removeUploadedFiles(filenames, { uploadDir = config.uploadDir } = {}) {
  for (const filename of filenames) {
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) continue;
    try {
      await fs.unlink(path.join(uploadDir, filename));
    } catch {
      // Best-effort cleanup only.
    }
  }
}
