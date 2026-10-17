import { config } from '../config.js';
import { isUniqueViolation } from '../db.js';
import { invalidatePublicCache } from '../services/questionQueries.js';
import { requireAdmin } from '../auth.js';
import { ApiError, errors } from '../errors.js';
import { nowIso, parseId, parseJson, publicId } from '../utils.js';
import {
  adminStats,
  archiveAdminQuestion,
  batchArchive,
  batchPublish,
  createAdminQuestion,
  deleteAdminQuestion,
  duplicateAdminQuestion,
  getAdminQuestion,
  listAdminQuestions,
  publishAdminQuestion,
  restoreAdminQuestion,
  updateAdminDraft,
} from '../services/adminQuestions.js';
import { saveImageBuffer } from '../services/uploads.js';
import { cancelImport, confirmImport, previewImport } from '../services/importer.js';

function validateName(raw, field = '名称') {
  const name = String(raw ?? '').trim();
  if (!name || name.length > 40) {
    throw errors.validation(`${field}需为 1–40 个字符。`);
  }
  return name;
}

function catchUnique(error, message) {
  if (isUniqueViolation(error)) {
    throw errors.conflict(message);
  }
  throw error;
}

async function categoryTreeForAdmin(db) {
  const rows = await db
    .prepare(
      `SELECT c.id, c.name, c.parent_id, c.sort_order,
              COUNT(q.id) AS total_count,
              SUM(CASE WHEN q.status = 'published' THEN 1 ELSE 0 END) AS published_count
       FROM categories c
       LEFT JOIN questions q ON q.category_id = c.id
       GROUP BY c.id
       ORDER BY c.parent_id IS NOT NULL, c.sort_order ASC, LOWER(c.name) ASC`,
    )
    .all();
  const byId = new Map();
  const tree = [];
  for (const row of rows) {
    const node = {
      id: publicId(row.id),
      name: row.name,
      parentId: row.parent_id ? publicId(row.parent_id) : null,
      sortOrder: row.sort_order,
      directCount: Number(row.total_count) || 0,
      publishedCount: Number(row.published_count) || 0,
      totalCount: Number(row.total_count) || 0,
      publishedTotal: Number(row.published_count) || 0,
      children: [],
    };
    byId.set(row.id, node);
    if (!row.parent_id) tree.push(node);
  }
  for (const row of rows) {
    if (row.parent_id && byId.has(row.parent_id)) {
      const child = byId.get(row.id);
      const parent = byId.get(row.parent_id);
      parent.children.push(child);
      parent.totalCount += child.directCount;
      parent.publishedTotal += child.publishedCount || 0;
    }
  }
  return tree;
}

async function tagUsage(db) {
  const usage = new Map();
  const rows = await db
    .prepare('SELECT tag_id, COUNT(DISTINCT question_id) AS count FROM question_tags GROUP BY tag_id')
    .all();
  for (const row of rows) {
    const count = Number(row.count) || 0;
    usage.set(row.tag_id, { published: count, draft: 0, total: count });
  }
  const drafts = await db.prepare('SELECT question_id, tags_json FROM question_drafts').all();
  for (const draft of drafts) {
    for (const tagId of new Set(parseJson(draft.tags_json, []).map(Number))) {
      if (!usage.has(tagId)) usage.set(tagId, { published: 0, draft: 0, total: 0 });
      usage.get(tagId).draft += 1;
    }
  }
  return usage;
}

async function adminTagList(db) {
  const usage = await tagUsage(db);
  const rows = await db
    .prepare(
      'SELECT id, name, created_at, updated_at FROM tags ORDER BY LOWER(name) ASC',
    )
    .all();
  return rows.map((row) => {
    const counts = usage.get(row.id) || { published: 0, draft: 0 };
    return {
      id: publicId(row.id),
      name: row.name,
      publishedUsage: counts.published || 0,
      draftUsage: counts.draft || 0,
      usageCount: (counts.published || 0) + (counts.draft || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export default async function adminRoutes(app) {
  const { db } = app;
  app.addHook('preHandler', async (request) => {
    requireAdmin(request);
  });
  app.addHook('onResponse', (request, reply) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && reply.statusCode < 400) {
      invalidatePublicCache();
    }
  });

  app.get('/admin/stats', async () => adminStats(db));

  app.get('/admin/questions', async (request) => listAdminQuestions(db, request.query || {}));

  app.post('/admin/questions', async (request, reply) => {
    const result = await createAdminQuestion(db, request.user, request.body || {});
    return reply.code(201).send(result);
  });

  app.post('/admin/questions/batch-publish', async (request) => {
    return batchPublish(db, request.user, request.body?.ids);
  });

  app.post('/admin/questions/batch-archive', async (request) => {
    return batchArchive(db, request.body?.ids);
  });

  app.get('/admin/questions/:id', async (request) => {
    const question = await getAdminQuestion(db, request.params.id);
    if (!question) throw errors.notFound('题目不存在。', 'QUESTION_NOT_FOUND');
    return { question };
  });

  app.put('/admin/questions/:id/draft', async (request) => {
    return updateAdminDraft(db, request.user, request.params.id, request.body || {});
  });

  app.post('/admin/questions/:id/publish', async (request) => {
    return publishAdminQuestion(db, request.user, request.params.id);
  });

  app.post('/admin/questions/:id/archive', async (request) => {
    return archiveAdminQuestion(db, request.params.id);
  });

  app.post('/admin/questions/:id/restore', async (request) => {
    return restoreAdminQuestion(db, request.params.id);
  });

  app.post('/admin/questions/:id/duplicate', async (request, reply) => {
    return reply
      .code(201)
      .send(await duplicateAdminQuestion(db, request.user, request.params.id));
  });

  app.delete('/admin/questions/:id', async (request) => {
    return deleteAdminQuestion(db, request.params.id);
  });

  app.get('/admin/categories', async () => ({ categories: await categoryTreeForAdmin(db) }));

  app.post('/admin/categories', async (request, reply) => {
    const name = validateName(request.body?.name, '分类名称');
    const parentId =
      request.body?.parentId === null || request.body?.parentId === undefined
        ? null
        : parseId(request.body.parentId, '父级分类');
    if (parentId) {
      const parent = await db.prepare('SELECT * FROM categories WHERE id = ?').get(parentId);
      if (!parent) throw errors.validation('父级分类不存在。');
      if (parent.parent_id) throw errors.validation('分类最多只能有两级。');
    }
    const sortOrder = Number.parseInt(request.body?.sortOrder, 10) || 0;
    const now = nowIso();
    try {
      const category = await db
        .prepare(
          `INSERT INTO categories (name, parent_id, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           RETURNING id`,
        )
        .get(name, parentId, sortOrder, now, now);
      return reply.code(201).send({ id: publicId(category.id), name });
    } catch (error) {
      catchUnique(error, '同一层级已存在同名分类。');
    }
  });

  app.put('/admin/categories/:id', async (request) => {
    const categoryId = parseId(request.params.id, '分类 ID');
    const category = await db
      .prepare('SELECT * FROM categories WHERE id = ?')
      .get(categoryId);
    if (!category) throw errors.notFound('分类不存在。');
    const name = validateName(request.body?.name, '分类名称');
    const sortOrder = Number.parseInt(request.body?.sortOrder, 10);
    try {
      await db
        .prepare('UPDATE categories SET name = ?, sort_order = ?, updated_at = ? WHERE id = ?')
        .run(
          name,
          Number.isSafeInteger(sortOrder) ? sortOrder : category.sort_order,
          nowIso(),
          categoryId,
        );
    } catch (error) {
      catchUnique(error, '同一层级已存在同名分类。');
    }
    return { id: publicId(categoryId), name };
  });

  app.delete('/admin/categories/:id', async (request) => {
    const categoryId = parseId(request.params.id, '分类 ID');
    const category = await db
      .prepare('SELECT * FROM categories WHERE id = ?')
      .get(categoryId);
    if (!category) throw errors.notFound('分类不存在。');
    const childCount = Number(
      (
        await db
          .prepare('SELECT COUNT(*) AS count FROM categories WHERE parent_id = ?')
          .get(categoryId)
      ).count,
    );
    const questionCount = Number(
      (
        await db
          .prepare('SELECT COUNT(*) AS count FROM questions WHERE category_id = ?')
          .get(categoryId)
      ).count,
    );
    const versionCount = Number(
      (
        await db
          .prepare('SELECT COUNT(*) AS count FROM question_versions WHERE category_id = ?')
          .get(categoryId)
      ).count,
    );
    const draftCount = Number(
      (
        await db
          .prepare('SELECT COUNT(*) AS count FROM question_drafts WHERE category_id = ?')
          .get(categoryId)
      ).count,
    );
    if (childCount > 0) throw errors.conflict('请先删除或移走该分类下的子分类。', 'CATEGORY_IN_USE');
    if (questionCount + versionCount + draftCount > 0) {
      throw errors.conflict('分类仍被题目或历史版本引用，不能删除。', 'CATEGORY_IN_USE', {
        questionCount,
        versionCount,
        draftCount,
      });
    }
    await db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
    return { deleted: true };
  });

  app.get('/admin/tags', async () => ({ tags: await adminTagList(db) }));

  app.post('/admin/tags', async (request, reply) => {
    const name = validateName(request.body?.name, '标签名称');
    const now = nowIso();
    try {
      const tag = await db
        .prepare(
          'INSERT INTO tags (name, name_lower, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING id',
        )
        .get(name, name.toLowerCase(), now, now);
      return reply.code(201).send({ id: publicId(tag.id), name });
    } catch (error) {
      catchUnique(error, '已经存在同名标签。');
    }
  });

  app.put('/admin/tags/:id', async (request) => {
    const tagId = parseId(request.params.id, '标签 ID');
    const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
    if (!tag) throw errors.notFound('标签不存在。');
    const name = validateName(request.body?.name, '标签名称');
    try {
      await db
        .prepare('UPDATE tags SET name = ?, name_lower = ?, updated_at = ? WHERE id = ?')
        .run(name, name.toLowerCase(), nowIso(), tagId);
    } catch (error) {
      catchUnique(error, '已经存在同名标签。');
    }
    return { id: publicId(tagId), name };
  });

  app.post('/admin/tags/:id/merge', async (request) => {
    const sourceId = parseId(request.params.id, '源标签');
    const targetId = parseId(request.body?.targetId, '目标标签');
    if (sourceId === targetId) throw errors.validation('不能把标签合并到自身。');
    const source = await db.prepare('SELECT * FROM tags WHERE id = ?').get(sourceId);
    const target = await db.prepare('SELECT * FROM tags WHERE id = ?').get(targetId);
    if (!source || !target) throw errors.notFound('标签不存在。');
    return db.transaction(async () => {
      await db
        .prepare(
          `INSERT INTO question_tags (question_id, tag_id)
           SELECT question_id, ? FROM question_tags WHERE tag_id = ?
           ON CONFLICT (question_id, tag_id) DO NOTHING`,
        )
        .run(targetId, sourceId);
      await db.prepare('DELETE FROM question_tags WHERE tag_id = ?').run(sourceId);
      const drafts = await db
        .prepare('SELECT question_id, tags_json FROM question_drafts')
        .all();
      for (const draft of drafts) {
        const ids = parseJson(draft.tags_json, []).map(String);
        if (!ids.includes(String(sourceId))) continue;
        const merged = [...new Set(ids.map((id) => (id === String(sourceId) ? String(targetId) : id)))];
        await db
          .prepare('UPDATE question_drafts SET tags_json = ? WHERE question_id = ?')
          .run(JSON.stringify(merged), draft.question_id);
      }
      await db.prepare('DELETE FROM tags WHERE id = ?').run(sourceId);
      return { mergedInto: publicId(targetId), sourceName: source.name, targetName: target.name };
    });
  });

  app.delete('/admin/tags/:id', async (request) => {
    const tagId = parseId(request.params.id, '标签 ID');
    const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
    if (!tag) throw errors.notFound('标签不存在。');
    const usage = (await tagUsage(db)).get(tagId);
    if (usage && (usage.published > 0 || usage.draft > 0)) {
      throw errors.conflict('这个标签仍在使用中，不能删除。', 'TAG_IN_USE', usage);
    }
    await db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);
    return { deleted: true };
  });

  app.post('/admin/uploads', async (request) => {
    if (!request.isMultipart()) {
      throw errors.validation('请使用 multipart/form-data 上传图片。');
    }
    let file;
    try {
      file = await request.file({ limits: { fileSize: config.maxUploadBytes, files: 1 } });
    } catch (error) {
      if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new ApiError(413, 'FILE_TOO_LARGE', '图片大小超过限制。');
      }
      throw error;
    }
    if (!file) throw errors.validation('未收到图片文件。');
    const buffer = await file.toBuffer();
    if (file.file.truncated || buffer.length > config.maxUploadBytes) {
      throw new ApiError(413, 'FILE_TOO_LARGE', '图片大小超过限制。');
    }
    const saved = await saveImageBuffer(buffer);
    return { url: saved.url, mime: saved.mime, size: saved.size };
  });

  app.post('/admin/import/preview', async (request) => {
    if (!request.isMultipart()) {
      throw errors.validation('请使用 multipart/form-data 上传导入文件。');
    }
    let file;
    try {
      file = await request.file({ limits: { fileSize: config.maxImportBytes, files: 1 } });
    } catch (error) {
      if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new ApiError(413, 'FILE_TOO_LARGE', '导入文件大小超过限制。');
      }
      throw error;
    }
    if (!file) throw errors.validation('未收到导入文件。');
    const buffer = await file.toBuffer();
    if (file.file.truncated || buffer.length > config.maxImportBytes) {
      throw new ApiError(413, 'FILE_TOO_LARGE', '导入文件大小超过限制。');
    }
    return previewImport(db, request.user, buffer, file.filename);
  });

  app.post('/admin/import/confirm', async (request) => {
    return confirmImport(db, request.user, request.body?.token);
  });

  app.delete('/admin/import/:token', async (request) => {
    return cancelImport(request.params.token, request.user);
  });
}
