import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config, normalizeOrigin } from './config.js';
import { isUniqueViolation } from './db.js';
import { ApiError, errors } from './errors.js';
import { nowIso } from './utils.js';

const SESSION_COOKIE = 'tixu_session';
const CSRF_COOKIE = 'tixu_csrf';
const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)).toString('hex');
  return { salt, hash };
}

export async function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = await scrypt(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function validateUsername(raw) {
  const username = String(raw ?? '').trim();
  if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(username)) {
    throw errors.validation('用户名需为 3–24 个字符，可使用中文、字母、数字、下划线或短横线。', [
      { field: 'username', message: '用户名格式不正确。' },
    ]);
  }
  return username;
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw errors.validation('密码长度需为 8–128 个字符。', [
      { field: 'password', message: '密码长度需为 8–128 个字符。' },
    ]);
  }
  return password;
}

export async function findUserByUsername(db, username) {
  return db
    .prepare('SELECT * FROM users WHERE username_lower = ?')
    .get(String(username || '').trim().toLowerCase());
}

export async function createUser(db, { username, password, role = 'user' }) {
  const cleanUsername = validateUsername(username);
  validatePassword(password);
  const { salt, hash } = await hashPassword(password);
  const timestamp = nowIso();
  try {
    return await db
      .prepare(
        `INSERT INTO users (username, username_lower, password_hash, password_salt, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         RETURNING *`,
      )
      .get(cleanUsername, cleanUsername.toLowerCase(), hash, salt, role, timestamp, timestamp);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw errors.conflict('这个用户名已经被使用，请换一个。', 'USERNAME_TAKEN', [
        { field: 'username', message: '用户名已存在。' },
      ]);
    }
    throw error;
  }
}

export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: String(user.id),
    username: user.username,
    role: user.role,
    createdAt: user.created_at,
  };
}

export async function createSession(db, userId, reply) {
  const token = crypto.randomBytes(32).toString('base64url');
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000).toISOString();
  await db
    .prepare(
      `INSERT INTO sessions (user_id, token_hash, expires_at, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(userId, hashToken(token), expiresAt, createdAt, createdAt);
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: config.sessionDays * 24 * 60 * 60,
  });
  return token;
}

export async function destroySession(db, request, reply) {
  const token = request.cookies?.[SESSION_COOKIE];
  if (token) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function loadSessionUser(db, request, reply) {
  const token = request.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const session = await db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, s.last_seen_at,
              u.id, u.username, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(hashToken(token));
  if (!session) {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return null;
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').run(session.session_id);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return null;
  }
  if (Date.now() - new Date(session.last_seen_at).getTime() > 60 * 60 * 1000) {
    await db
      .prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?')
      .run(nowIso(), session.session_id);
  }
  return {
    id: session.id,
    username: session.username,
    role: session.role,
    created_at: session.created_at,
  };
}

export function ensureCsrfCookie(request, reply) {
  let token = request.cookies?.[CSRF_COOKIE];
  if (!token || token.length < 20) {
    token = crypto.randomBytes(24).toString('base64url');
    reply.setCookie(CSRF_COOKIE, token, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  return token;
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function checkCsrf(request) {
  if (!UNSAFE_METHODS.has(request.method)) return;
  const cookieToken = request.cookies?.[CSRF_COOKIE];
  const headerToken = request.headers['x-csrf-token'];
  if (
    !cookieToken ||
    !headerToken ||
    typeof headerToken !== 'string' ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    throw new ApiError(403, 'CSRF_FAILED', '安全校验失败，请刷新页面后重试。');
  }
}

export function checkOrigin(request) {
  if (!UNSAFE_METHODS.has(request.method)) return;
  const rawOrigin = request.headers.origin;
  if (!rawOrigin) return; // Non-browser clients are still protected by the CSRF double-submit check.

  const origin = normalizeOrigin(rawOrigin);
  const forwardedHost = config.trustProxy ? request.headers['x-forwarded-host'] : null;
  const hostHeader = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || request.headers.host;
  const host = String(hostHeader || '').split(',')[0].trim();
  const sameHostOrigin = normalizeOrigin(host ? `${request.protocol || 'http'}://${host}` : '');

  const allowed = new Set([
    ...config.allowedOrigins,
    ...(config.environment !== 'production'
      ? [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          `http://localhost:${config.port}`,
          `http://127.0.0.1:${config.port}`,
        ]
      : []),
    ...(sameHostOrigin ? [sameHostOrigin] : []),
  ]);

  if (!origin || !allowed.has(origin)) {
    request.log?.warn(
      {
        origin: rawOrigin,
        normalizedOrigin: origin || null,
        host: host || null,
        protocol: request.protocol || null,
        allowedOrigins: [...allowed],
      },
      'origin rejected',
    );
    throw new ApiError(403, 'ORIGIN_REJECTED', '请求来源未被允许。');
  }
}

export function requireUser(request) {
  if (!request.user) throw errors.unauthorized();
  return request.user;
}

export function requireAdmin(request) {
  const user = requireUser(request);
  if (user.role !== 'admin') throw errors.forbidden();
  return user;
}

export async function cleanupSessions(db) {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso());
}

export { SESSION_COOKIE, CSRF_COOKIE };
