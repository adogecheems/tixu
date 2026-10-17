import { ApiError, errors } from '../errors.js';
import {
  getCategoryTree,
  getPublicQuestion,
  getTags,
  listPublicQuestionIds,
  listPublicQuestions,
  lookupQuestionCards,
  publicHomeSummary,
} from '../services/questionQueries.js';
import { parseId } from '../utils.js';

export default async function publicRoutes(app) {
  const { db } = app;

  app.get('/home', async (request) => {
    return publicHomeSummary(db, request.user);
  });

  app.get('/categories', async () => {
    return { categories: await getCategoryTree(db) };
  });

  app.get('/tags', async () => {
    return { tags: await getTags(db) };
  });

  app.get('/questions', async (request) => {
    return listPublicQuestions(db, request.query || {}, request.user);
  });

  app.get('/questions/ids', async (request) => {
    return { ids: await listPublicQuestionIds(db, request.query || {}) };
  });

  app.get('/questions/lookup', async (request) => {
    const raw = String(request.query?.ids || '');
    const ids = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 200);
    return { items: await lookupQuestionCards(db, ids, request.user) };
  });

  app.get('/questions/:id', async (request) => {
    const questionId = parseId(request.params.id, '题目 ID');
    const result = await getPublicQuestion(db, questionId, request.user);
    if (!result.question) {
      if (result.status === 'archived') {
        throw new ApiError(410, 'QUESTION_ARCHIVED', '这道题已归档，不能继续学习。');
      }
      throw errors.notFound('题目不存在或尚未发布。', 'QUESTION_NOT_FOUND');
    }
    return { question: result.question };
  });
}
