import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Optional .env support without pulling in a dependency.
const envFile = path.join(rootDir, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

const port = Number(process.env.PORT || 3000);

export const config = {
  rootDir,
  host: process.env.HOST || '127.0.0.1',
  port,
  environment: process.env.NODE_ENV || 'development',
  databaseUrl: String(process.env.DATABASE_URL || '').trim(),
  databasePath: resolvePath(process.env.DATABASE_PATH || 'data/tixu.db'),
  postgresPoolMax: Math.max(1, Number(process.env.PG_POOL_MAX || 10)),
  uploadDir: resolvePath(process.env.UPLOAD_DIR || 'data/uploads'),
  clientDist: path.join(rootDir, 'dist'),
  sessionDays: Math.max(1, Number(process.env.SESSION_DAYS || 30)),
  cookieSecure: String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true',
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin12345',
  },
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024,
  maxImportBytes: Number(process.env.MAX_IMPORT_MB || 15) * 1024 * 1024,
  maxImportUncompressedBytes: Number(process.env.MAX_IMPORT_UNCOMPRESSED_MB || 25) * 1024 * 1024,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
};

export const devOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
];
