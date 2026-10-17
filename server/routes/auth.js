import { createUser, findUserByUsername, toPublicUser, verifyPassword } from '../auth.js';
import { errors } from '../errors.js';
import { createSession, destroySession } from '../auth.js';
import { mergeGuestData } from '../services/attempts.js';
import { getUserStats } from '../services/study.js';

const loginLimiter = {
  config: {
    rateLimit: { max: 20, timeWindow: '1 minute' },
  },
};

export default async function authRoutes(app) {
  const { db } = app;

  app.get('/auth/me', async (request, reply) => {
    return {
      user: toPublicUser(request.user),
      csrfToken: request.cookies.tixu_csrf || null,
    };
  });

  app.post('/auth/register', loginLimiter, async (request, reply) => {
    const body = request.body || {};
    const user = await createUser(db, {
      username: body.username,
      password: body.password,
      role: 'user',
    });
    await createSession(db, user.id, reply);
    return reply.code(201).send({
      user: toPublicUser(user),
      stats: await getUserStats(db, user.id),
    });
  });

  app.post('/auth/login', loginLimiter, async (request, reply) => {
    const body = request.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) {
      throw errors.validation('请输入用户名和密码。');
    }
    const user = await findUserByUsername(db, username);
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      throw errors.unauthorized('用户名或密码不正确。');
    }
    await createSession(db, user.id, reply);
    return {
      user: toPublicUser(user),
      stats: await getUserStats(db, user.id),
    };
  });

  app.post('/auth/logout', async (request, reply) => {
    await destroySession(db, request, reply);
    return { ok: true };
  });

  app.post('/auth/merge', async (request, reply) => {
    if (!request.user) throw errors.unauthorized('请先登录后再合并学习记录。');
    const result = await mergeGuestData(db, request.user, request.body || {});
    return {
      ...result,
      stats: await getUserStats(db, request.user.id),
    };
  });

  app.get('/auth/csrf', async (request) => ({
    csrfToken: request.cookies.tixu_csrf || null,
  }));
}
