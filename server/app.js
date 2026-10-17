import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { databaseLabel, initSchema, openDatabase } from './db.js';
import {
  checkCsrf,
  checkOrigin,
  cleanupSessions,
  ensureCsrfCookie,
  loadSessionUser,
} from './auth.js';
import { ApiError } from './errors.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import studyRoutes from './routes/study.js';
import adminRoutes from './routes/admin.js';

function enrichError(error) {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
    };
  }
  if (error.code === 'FST_REQ_FILE_TOO_LARGE' || error.code === 'FST_FILES_LIMIT') {
    return {
      statusCode: 413,
      body: { error: { code: 'FILE_TOO_LARGE', message: '上传文件超过大小限制。' } },
    };
  }
  if (error.code === 'FST_INVALID_MULTIPART_CONTENT_TYPE' || error.code === 'FST_INVALID_MULTIPART_FIELD') {
    return {
      statusCode: 400,
      body: { error: { code: 'INVALID_MULTIPART', message: '上传表单格式不正确。' } },
    };
  }
  if (error.statusCode === 429 || error.code === 'FST_ERR_RATE_LIMIT') {
    return {
      statusCode: 429,
      body: { error: { code: 'RATE_LIMITED', message: '操作过于频繁，请稍后再试。' } },
    };
  }
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code || 'BAD_REQUEST',
          message: error.message || '请求无法处理。',
        },
      },
    };
  }
  return {
    statusCode: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: '服务暂时不可用，请稍后再试。' } },
  };
}

export async function buildApp({ db: providedDb = null, logger = true } = {}) {
  const db = providedDb || (await openDatabase());
  await initSchema(db);
  await cleanupSessions(db);
  fs.mkdirSync(config.uploadDir, { recursive: true });

  const app = Fastify({
    logger: logger === true ? { level: process.env.LOG_LEVEL || 'info' } : logger,
    bodyLimit: 2 * 1024 * 1024,
    requestTimeout: 30000,
  });
  app.decorate('db', db);
  app.addHook('onClose', async () => {
    await db.close();
  });

  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, {
    limits: {
      fileSize: Math.max(config.maxImportBytes, config.maxUploadBytes),
      files: 1,
      fields: 10,
      parts: 12,
    },
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
      ].join('; '),
    );
    if (request.url.startsWith('/uploads/')) {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = enrichError(error);
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'request failed');
    } else if (statusCode !== 422 && statusCode !== 409) {
      request.log.info({ err: error }, 'request rejected');
    }
    reply.code(statusCode).send(body);
  });

  app.get('/healthz', async () => ({
    ok: true,
    service: 'tixu',
    database: databaseLabel(db),
  }));

  await app.register(
    async function apiScope(api) {
      api.addHook('onRequest', async (request, reply) => {
        ensureCsrfCookie(request, reply);
        checkOrigin(request);
        checkCsrf(request);
        const hadSessionCookie = Boolean(request.cookies?.tixu_session);
        request.user = await loadSessionUser(api.db, request, reply);
        request.sessionInvalid = hadSessionCookie && !request.user;
      });
      api.get('/health', async () => ({ ok: true, time: new Date().toISOString() }));
      await api.register(authRoutes);
      await api.register(publicRoutes);
      await api.register(studyRoutes);
      await api.register(adminRoutes);
    },
    { prefix: '/api/v1' },
  );

  if (fs.existsSync(config.clientDist)) {
    const assetsDir = path.join(config.clientDist, 'assets');
    if (fs.existsSync(assetsDir)) {
      await app.register(fastifyStatic, {
        root: assetsDir,
        prefix: '/assets/',
        decorateReply: false,
        maxAge: '1y',
        immutable: true,
      });
    }
    app.get('/favicon.svg', async (request, reply) => {
      const file = path.join(config.clientDist, 'favicon.svg');
      if (!fs.existsSync(file)) throw new Error('not found');
      return reply.type('image/svg+xml').send(fs.createReadStream(file));
    });
  }

  await app.register(fastifyStatic, {
    root: config.uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
    maxAge: '365d',
    immutable: true,
    setHeaders(response) {
      response.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/uploads/')) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '没有找到对应的资源。' },
      });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '没有找到对应的资源。' } });
    }
    const indexPath = path.join(config.clientDist, 'index.html');
    const looksLikeAsset = /\/[^/?]+\.[a-zA-Z0-9]+(?:\?|$)/.test(request.url);
    if (looksLikeAsset && !request.url.startsWith('/uploads/')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '静态资源不存在。' } });
    }
    if (fs.existsSync(indexPath)) {
      return reply.type('text/html; charset=utf-8').send(fs.createReadStream(indexPath));
    }
    return reply
      .code(503)
      .type('text/html; charset=utf-8')
      .send(
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>题序</title><body style="font-family:system-ui;padding:40px;line-height:1.7"><h1>题序</h1><p>前端资源尚未构建。</p><p>开发模式请访问 <a href="http://127.0.0.1:5173">http://127.0.0.1:5173</a>，或先运行 <code>npm run build</code> 再启动服务。</p></body></html>',
      );
  });

  app.addHook('onClose', async () => {
    try {
      db.close();
    } catch {
      // ignore close errors
    }
  });

  return app;
}
