import { errors } from '../errors.js';
import { parseId, publicId } from '../utils.js';
import { requireUser } from '../auth.js';
import {
  assessEssay,
  getOwnedAttemptDetail,
  listAttempts,
  submitAnswer,
} from '../services/attempts.js';
import { listCollection, listCollectionIds } from '../services/collections.js';
import { getUserStats, setFavorite } from '../services/study.js';

const submissionLimiter = {
  config: {
    rateLimit: { max: 80, timeWindow: '1 minute' },
  },
};

export default async function studyRoutes(app) {
  const { db } = app;

  app.post('/questions/:id/submit', submissionLimiter, async (request) => {
    if (request.sessionInvalid) {
      throw errors.unauthorized('登录状态已失效，请刷新页面后重新登录。');
    }
    const questionId = parseId(request.params.id, '题目 ID');
    return submitAnswer(db, request.user, questionId, request.body || {});
  });

  app.get('/me/summary', async (request) => {
    const user = requireUser(request);
    return {
      user: {
        id: publicId(user.id),
        username: user.username,
        role: user.role,
        createdAt: user.created_at,
      },
      stats: await getUserStats(db, user.id),
    };
  });

  app.get('/me/attempts', async (request) => {
    const user = requireUser(request);
    return listAttempts(db, user, request.query || {});
  });

  app.get('/me/attempts/:id', async (request) => {
    const user = requireUser(request);
    const attemptId = parseId(request.params.id, '作答记录 ID');
    const attempt = await getOwnedAttemptDetail(db, user, attemptId);
    if (!attempt) throw errors.notFound('作答记录不存在。', 'ATTEMPT_NOT_FOUND');
    return { attempt };
  });

  app.patch('/me/attempts/:id/assessment', async (request) => {
    const user = requireUser(request);
    return assessEssay(db, user, request.params.id, request.body || {});
  });

  app.get('/me/wrong', async (request) => {
    const user = requireUser(request);
    return listCollection(db, user.id, 'wrong', request.query || {});
  });

  app.get('/me/wrong/ids', async (request) => {
    const user = requireUser(request);
    return { ids: await listCollectionIds(db, user.id, 'wrong', request.query || {}) };
  });

  app.get('/me/favorites', async (request) => {
    const user = requireUser(request);
    return listCollection(db, user.id, 'favorites', request.query || {});
  });

  app.get('/me/favorites/ids', async (request) => {
    const user = requireUser(request);
    return { ids: await listCollectionIds(db, user.id, 'favorites', request.query || {}) };
  });

  app.put('/me/favorites/:questionId', async (request) => {
    const user = requireUser(request);
    const questionId = parseId(request.params.questionId, '题目 ID');
    const favorited = request.body?.favorited;
    if (typeof favorited !== 'boolean') {
      throw errors.validation('收藏状态无效。');
    }
    const question = await db
      .prepare('SELECT id, status FROM questions WHERE id = ?')
      .get(questionId);
    if (!question || question.status !== 'published') {
      throw errors.notFound('题目不存在或已下架。', 'QUESTION_NOT_FOUND');
    }
    const state = await setFavorite(db, user.id, questionId, favorited);
    return {
      questionId: publicId(questionId),
      isFavorited: Boolean(state.favorite),
      favoritedAt: state.favorited_at || null,
    };
  });
}
