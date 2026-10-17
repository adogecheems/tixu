import { ApiError, errors } from '../errors.js';
import { nowIso, parseId, parseJson, publicId, stripMarkdown } from '../utils.js';
import {
  assertCategory,
  assertTags,
  buildStoredAnswer,
  buildStoredJudgeConfig,
  fullValidation,
  normalizeDraftInput,
} from '../validation.js';

function versionRowToDraft(row) {
  return {
    title: row.title || '',
    stemMarkdown: row.stem_markdown || '',
    type: row.question_type || 'single',
    difficulty: row.difficulty || 'medium',
    categoryId: row.category_id ? publicId(row.category_id) : null,
    options: parseJson(row.options_json, []),
    answer: parseJson(row.answer_json, {}),
    judgeConfig: parseJson(row.judge_config_json, {}),
    analysisMarkdown: row.analysis_markdown || '',
    tagIds: parseJson(row.tags_json, [])
      .map((tag) => (typeof tag === 'object' ? tag.id : tag))
      .filter(Boolean)
      .map(String),
    sortOrder: row.sort_order || 0,
  };
}

function draftRowToDraft(row) {
  return {
    title: row.title,
    stemMarkdown: row.stem_markdown,
    type: row.question_type,
    difficulty: row.difficulty,
    categoryId: row.category_id ? publicId(row.category_id) : null,
    options: parseJson(row.options_json, []),
    answer: parseJson(row.answer_json, {}),
    judgeConfig: parseJson(row.judge_config_json, {}),
    analysisMarkdown: row.analysis_markdown,
    tagIds: parseJson(row.tags_json, []).map(String),
    sortOrder: row.sort_order ?? 0,
  };
}

async function saveDraftRecord(db, questionId, draft, adminId) {
  const now = nowIso();
  const values = [
    draft.title,
    draft.stemMarkdown,
    draft.type,
    draft.difficulty,
    draft.categoryId,
    JSON.stringify(draft.options),
    JSON.stringify(draft.answer),
    JSON.stringify(draft.judgeConfig),
    draft.analysisMarkdown,
    JSON.stringify(draft.tagIds),
    draft.sortOrder,
    now,
    adminId,
    questionId,
  ];
  const exists = await db
    .prepare('SELECT question_id FROM question_drafts WHERE question_id = ?')
    .get(questionId);
  if (exists) {
    await db
      .prepare(
        `UPDATE question_drafts SET title = ?, stem_markdown = ?, question_type = ?,
         difficulty = ?, category_id = ?, options_json = ?, answer_json = ?, judge_config_json = ?,
         analysis_markdown = ?, tags_json = ?, sort_order = ?, updated_at = ?, updated_by = ?
         WHERE question_id = ?`,
      )
      .run(...values);
  } else {
    await db
      .prepare(
        `INSERT INTO question_drafts
          (title, stem_markdown, question_type, difficulty, category_id, options_json,
           answer_json, judge_config_json, analysis_markdown, tags_json, sort_order,
           updated_at, updated_by, question_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...values);
  }
}

async function validateDraftReferences(db, draft) {
  if (draft.categoryId) await assertCategory(db, draft.categoryId);
  if (draft.tagIds.length) await assertTags(db, draft.tagIds);
}

export async function createAdminQuestion(db, admin, body) {
  const draft = normalizeDraftInput(body);
  await validateDraftReferences(db, draft);
  const timestamp = nowIso();
  return db.transaction(async () => {
    const question = await db
      .prepare(
        `INSERT INTO questions
          (status, category_id, sort_order, created_at, updated_at, created_by)
         VALUES ('draft', ?, ?, ?, ?, ?)
         RETURNING id`,
      )
      .get(draft.categoryId, draft.sortOrder, timestamp, timestamp, admin.id);
    await saveDraftRecord(db, question.id, draft, admin.id);
    return {
      questionId: publicId(question.id),
      updatedAt: timestamp,
    };
  });
}

export async function updateAdminDraft(db, admin, rawQuestionId, body) {
  const questionId = parseId(rawQuestionId, '题目 ID');
  const question = await db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!question) throw errors.notFound('题目不存在。', 'QUESTION_NOT_FOUND');
  if (question.status === 'archived') {
    throw errors.conflict('已归档的题目需要先恢复公开，才能继续编辑。', 'QUESTION_ARCHIVED');
  }
  const currentDraft = await db
    .prepare('SELECT * FROM question_drafts WHERE question_id = ?')
    .get(questionId);
  const currentUpdatedAt = currentDraft?.updated_at || question.updated_at;
  if (body?.baseUpdatedAt && body.baseUpdatedAt !== currentUpdatedAt) {
    throw errors.conflict('题目草稿已在其他位置更新，请刷新后再编辑。', 'EDIT_CONFLICT', {
      currentUpdatedAt,
    });
  }
  const draft = normalizeDraftInput(body);
  await validateDraftReferences(db, draft);
  const timestamp = nowIso();
  return db.transaction(async () => {
    await saveDraftRecord(db, questionId, draft, admin.id);
    await db.prepare('UPDATE questions SET updated_at = ? WHERE id = ?').run(timestamp, questionId);
    if (question.status === 'draft') {
      await db
        .prepare('UPDATE questions SET category_id = ?, sort_order = ? WHERE id = ?')
        .run(draft.categoryId, draft.sortOrder, questionId);
    }
    return { questionId: publicId(questionId), updatedAt: timestamp };
  });
}

function getPublishableDraft(db, questionId) {
  return db.prepare('SELECT * FROM question_drafts WHERE question_id = ?').get(questionId);
}

async function publishOne(db, admin, questionId) {
  const question = await db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!question) {
    return { errors: [{ field: 'id', message: '题目不存在。' }] };
  }
  if (question.status === 'archived') {
    return { errors: [{ field: 'status', message: '已归档题目不能直接发布，请先恢复公开。' }] };
  }
  const draftRow = await getPublishableDraft(db, questionId);
  if (!draftRow) {
    return { errors: [{ field: 'draft', message: '没有待发布的修改。' }] };
  }
  const draft = draftRowToDraft(draftRow);
  try {
    await fullValidation(db, draft);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
      return { errors: error.details || [] };
    }
    throw error;
  }

  const now = nowIso();
  const maxVersionRow = await db
    .prepare('SELECT COALESCE(MAX(version_no), 0) AS max_version FROM question_versions WHERE question_id = ?')
    .get(questionId);
  const versionNo = Number(maxVersionRow.max_version || 0) + 1;
  const tags = await assertTags(db, draft.tagIds);
  const versionTags = tags.map((tag) => ({ id: publicId(tag.id), name: tag.name }));
  const version = await db
    .prepare(
      `INSERT INTO question_versions
        (question_id, version_no, title, stem_markdown, question_type, difficulty,
         category_id, options_json, analysis_markdown, tags_json, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    )
    .get(
      questionId,
      versionNo,
      draft.title,
      draft.stemMarkdown,
      draft.type,
      draft.difficulty,
      draft.categoryId,
      JSON.stringify(draft.options),
      draft.analysisMarkdown,
      JSON.stringify(versionTags),
      now,
      admin.id,
    );
  await db
    .prepare(
      `INSERT INTO question_answers (version_id, answer_json, judge_config_json, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      version.id,
      JSON.stringify(buildStoredAnswer(draft)),
      JSON.stringify(buildStoredJudgeConfig(draft)),
      now,
    );

  await db
    .prepare(
      `UPDATE questions SET status = 'published', category_id = ?, current_version_id = ?,
        sort_order = ?, published_at = ?, archived_at = NULL, updated_at = ? WHERE id = ?`,
    )
    .run(draft.categoryId, version.id, draft.sortOrder, now, now, questionId);

  await db.prepare('DELETE FROM question_tags WHERE question_id = ?').run(questionId);
  for (const tag of tags) {
    await db
      .prepare('INSERT INTO question_tags (question_id, tag_id) VALUES (?, ?)')
      .run(questionId, tag.id);
  }

  await db.prepare('DELETE FROM question_drafts WHERE question_id = ?').run(questionId);
  return { versionId: publicId(version.id), versionNo };
}

export async function publishAdminQuestion(db, admin, rawQuestionId) {
  const questionId = parseId(rawQuestionId, '题目 ID');
  return db.transaction(async () => {
    const result = await publishOne(db, admin, questionId);
    if (result.errors) {
      throw new ApiError(
        422,
        result.errors[0]?.field === 'draft' ? 'NO_PENDING_DRAFT' : 'VALIDATION_FAILED',
        result.errors[0]?.field === 'draft'
          ? '当前没有待发布的内容。'
          : '题目尚未通过发布校验。',
        result.errors,
      );
    }
    return result;
  });
}

export async function archiveAdminQuestion(db, rawQuestionId) {
  const questionId = parseId(rawQuestionId, '题目 ID');
  const question = await db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!question) throw errors.notFound('题目不存在。', 'QUESTION_NOT_FOUND');
  if (question.status !== 'published') {
    throw errors.conflict('只有已发布题目可以归档。', 'INVALID_STATUS');
  }
  const now = nowIso();
  await db
    .prepare("UPDATE questions SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, questionId);
  return { questionId: publicId(questionId), status: 'archived', archivedAt: now };
}

export async function restoreAdminQuestion(db, rawQuestionId) {
  const questionId = parseId(rawQuestionId, '题目 ID');
  const question = await db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!question) throw errors.notFound('题目不存在。', 'QUESTION_NOT_FOUND');
  if (question.status !== 'archived') {
    throw errors.conflict('只有已归档题目可以恢复公开。', 'INVALID_STATUS');
  }
  if (!question.current_version_id) {
    throw errors.conflict('题目没有可恢复的已发布版本。', 'NO_PUBLISHED_VERSION');
  }
  const now = nowIso();
  await db
    .prepare(
      "UPDATE questions SET status = 'published', archived_at = NULL, published_at = ?, updated_at = ? WHERE id = ?",
    )
    .run(now, now, questionId);
  return { questionId: publicId(questionId), status: 'published' };
}

export async function duplicateAdminQuestion(db, admin, rawQuestionId) {
  const questionId = parseId(rawQuestionId, '题目 ID');
  const question = await db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!question) throw errors.notFound('题目不存在。', 'QUESTION_NOT_FOUND');
  const draftRow = await getPublishableDraft(db, questionId);
  let sourceDraft;
  if (draftRow) {
    sourceDraft = draftRowToDraft(draftRow);
  } else if (question.current_version_id) {
    const version = await db
      .prepare(
        `SELECT v.*, qa.answer_json, qa.judge_config_json
         FROM question_versions v JOIN question_answers qa ON qa.version_id = v.id
         WHERE v.id = ?`,
      )
      .get(question.current_version_id);
    if (!version) throw errors.notFound('题目版本不存在。', 'QUESTION_NOT_FOUND');
    sourceDraft = {
      ...versionRowToDraft({ ...version, sort_order: question.sort_order }),
      answer: parseJson(version.answer_json, {}),
      judgeConfig: parseJson(version.judge_config_json, {}),
    };
  } else {
    throw errors.conflict('这道题还没有可复制的内容。', 'NOTHING_TO_COPY');
  }
  sourceDraft.title = `${sourceDraft.title || '未命名题目'}（副本）`;
  return db.transaction(async () => {
    const now = nowIso();
    const created = await db
      .prepare(
        `INSERT INTO questions
          (status, category_id, sort_order, created_at, updated_at, created_by)
         VALUES ('draft', ?, ?, ?, ?, ?)
         RETURNING id`,
      )
      .get(sourceDraft.categoryId, question.sort_order, now, now, admin.id);
    await saveDraftRecord(db, created.id, sourceDraft, admin.id);
    return { questionId: publicId(created.id) };
  });
}

export async function deleteAdminQuestion(db, rawQuestionId) {
  const questionId = parseId(rawQuestionId, '题目 ID');
  const question = await db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!question) throw errors.notFound('题目不存在。', 'QUESTION_NOT_FOUND');
  if (question.status !== 'draft' || question.current_version_id) {
    throw errors.conflict('已发布过的题目不能永久删除。', 'QUESTION_PROTECTED');
  }
  const attemptCount = Number(
    (
      await db
        .prepare('SELECT COUNT(*) AS count FROM answer_records WHERE question_id = ?')
        .get(questionId)
    ).count,
  );
  const versionCount = Number(
    (
      await db
        .prepare('SELECT COUNT(*) AS count FROM question_versions WHERE question_id = ?')
        .get(questionId)
    ).count,
  );
  if (attemptCount || versionCount) {
    throw errors.conflict('题目已有历史引用，不能永久删除。', 'QUESTION_PROTECTED');
  }
  await db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
  return { deleted: true, questionId: publicId(questionId) };
}

export async function batchPublish(db, admin, rawIds) {
  if (!Array.isArray(rawIds) || !rawIds.length) {
    throw errors.validation('请至少选择一道题目。');
  }
  const ids = [...new Set(rawIds.map((id) => parseId(id, '题目 ID')))].slice(0, 100);
  return db.transaction(async () => {
    const results = [];
    const failures = [];
    for (const questionId of ids) {
      const row = await db
        .prepare(
          `SELECT q.id, q.status, COALESCE(d.title, v.title, '未命名题目') AS title
           FROM questions q
           LEFT JOIN question_versions v ON v.id = q.current_version_id
           LEFT JOIN question_drafts d ON d.question_id = q.id
           WHERE q.id = ?`,
        )
        .get(questionId);
      if (!row) {
        failures.push({ questionId: publicId(questionId), title: '未知题目', errors: [{ field: 'id', message: '题目不存在。' }] });
        continue;
      }
      const result = await publishOne(db, admin, questionId);
      if (result.errors) {
        failures.push({ questionId: publicId(questionId), title: row.title, errors: result.errors });
      } else {
        results.push({ questionId: publicId(questionId), title: row.title, ...result });
      }
    }
    if (failures.length) {
      throw new ApiError(
        422,
        'BATCH_VALIDATION_FAILED',
        '部分题目未通过校验，本批次没有执行发布。',
        failures,
      );
    }
    return { publishedCount: results.length, results };
  });
}

export async function batchArchive(db, rawIds) {
  if (!Array.isArray(rawIds) || !rawIds.length) {
    throw errors.validation('请至少选择一道题目。');
  }
  const ids = [...new Set(rawIds.map((id) => parseId(id, '题目 ID')))].slice(0, 100);
  return db.transaction(async () => {
    const failures = [];
    const rows = [];
    for (const questionId of ids) {
      const row = await db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
      if (!row) {
        failures.push({ questionId: publicId(questionId), message: '题目不存在。' });
      } else if (row.status !== 'published') {
        failures.push({ questionId: publicId(questionId), title: null, message: '只有已发布题目可以归档。' });
      } else {
        rows.push(row);
      }
    }
    if (failures.length) {
      throw new ApiError(422, 'BATCH_NOT_ELIGIBLE', '部分题目不能归档，本批次没有执行。', failures);
    }
    const now = nowIso();
    for (const row of rows) {
      await db
        .prepare(
          "UPDATE questions SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ? AND status = 'published'",
        )
        .run(now, now, row.id);
    }
    return { archivedCount: rows.length };
  });
}

function adminQuestionRow(row) {
  const title = row.draft_title ?? row.published_title ?? '未命名题目';
  const type = row.draft_type ?? row.published_type ?? 'single';
  const difficulty = row.draft_difficulty ?? row.published_difficulty ?? 'medium';
  const categoryId = row.draft_category_id ?? row.published_category_id;
  const categoryName = row.draft_category_name ?? row.published_category_name;
  const parentName = row.draft_parent_name ?? row.published_parent_name;
  const parentId = row.draft_parent_id ?? row.published_parent_id;
  return {
    id: publicId(row.id),
    title,
    type,
    difficulty,
    status: row.status,
    hasPendingDraft: Boolean(row.draft_updated_at),
    currentVersionNo: row.published_version_no ?? null,
    currentVersionId: row.current_version_id ? publicId(row.current_version_id) : null,
    category: categoryId
      ? {
          id: publicId(categoryId),
          name: categoryName,
          parent: parentId ? { id: publicId(parentId), name: parentName } : null,
        }
      : null,
    summary: stripMarkdown(row.draft_stem ?? row.published_stem ?? '', 100),
    updatedAt: row.draft_updated_at || row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    sortOrder: row.sort_order,
  };
}

export async function listAdminQuestions(db, query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  const conditions = ['1 = 1'];
  const params = [];
  if (['draft', 'published', 'archived'].includes(query.status)) {
    conditions.push('q.status = ?');
    params.push(query.status);
  }
  if (query.pending === '1') {
    conditions.push('d.updated_at IS NOT NULL');
  }
  const keyword = String(query.q || '').trim().slice(0, 120);
  if (keyword) {
    conditions.push("(COALESCE(d.title, v.title, '') LIKE ? OR COALESCE(d.stem_markdown, v.stem_markdown, '') LIKE ?)");
    const like = `%${keyword}%`;
    params.push(like, like);
  }
  if (query.type && ['single', 'multiple', 'truefalse', 'fill', 'essay'].includes(query.type)) {
    conditions.push('COALESCE(d.question_type, v.question_type) = ?');
    params.push(query.type);
  }
  if (query.category) {
    const categoryId = Number.parseInt(query.category, 10);
    if (Number.isSafeInteger(categoryId) && categoryId > 0) {
      conditions.push(
        'COALESCE(d.category_id, v.category_id) IN (SELECT id FROM categories WHERE id = ? OR parent_id = ?)',
      );
      params.push(categoryId, categoryId);
    }
  }
  const where = conditions.join(' AND ');
  const base = `
    FROM questions q
    LEFT JOIN question_versions v ON v.id = q.current_version_id
    LEFT JOIN question_drafts d ON d.question_id = q.id
    LEFT JOIN categories c_draft ON c_draft.id = d.category_id
    LEFT JOIN categories p_draft ON p_draft.id = c_draft.parent_id
    LEFT JOIN categories c_pub ON c_pub.id = v.category_id
    LEFT JOIN categories p_pub ON p_pub.id = c_pub.parent_id
    WHERE ${where}
  `;
  const total = Number(
    (await db.prepare(`SELECT COUNT(*) AS count ${base}`).get(...params)).count,
  );
  const rows = await db
    .prepare(
      `SELECT q.id, q.status, q.current_version_id, q.sort_order, q.updated_at,
              q.published_at, q.archived_at,
              v.title AS published_title, v.question_type AS published_type,
              v.difficulty AS published_difficulty, v.category_id AS published_category_id,
              v.version_no AS published_version_no, v.stem_markdown AS published_stem,
              d.title AS draft_title, d.question_type AS draft_type,
              d.difficulty AS draft_difficulty, d.category_id AS draft_category_id,
              d.updated_at AS draft_updated_at, d.stem_markdown AS draft_stem,
              c_draft.name AS draft_category_name, p_draft.name AS draft_parent_name,
              p_draft.id AS draft_parent_id,
              c_pub.name AS published_category_name, p_pub.name AS published_parent_name,
              p_pub.id AS published_parent_id
       ${base}
       ORDER BY q.updated_at DESC, q.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  return {
    items: rows.map(adminQuestionRow),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function getAdminQuestion(db, rawQuestionId) {
  const questionId = parseId(rawQuestionId, '题目 ID');
  const question = await db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!question) return null;
  const currentVersion = question.current_version_id
    ? await db
        .prepare(
          `SELECT v.*, qa.answer_json, qa.judge_config_json
           FROM question_versions v JOIN question_answers qa ON qa.version_id = v.id
           WHERE v.id = ?`,
        )
        .get(question.current_version_id)
    : null;
  const draftRow = await getPublishableDraft(db, questionId);
  const versionRows = await db
    .prepare(
      `SELECT id, version_no, title, created_at, question_type, difficulty
       FROM question_versions WHERE question_id = ? ORDER BY version_no DESC`,
    )
    .all(questionId);
  const versions = versionRows.map((row) => ({
    id: publicId(row.id),
    versionNo: row.version_no,
    title: row.title,
    type: row.question_type,
    difficulty: row.difficulty,
    createdAt: row.created_at,
  }));

  let source = 'draft';
  let draft;
  let baseUpdatedAt;
  if (draftRow) {
    draft = draftRowToDraft(draftRow);
    baseUpdatedAt = draftRow.updated_at;
  } else if (currentVersion) {
    source = 'published';
    draft = versionRowToDraft({ ...currentVersion, sort_order: question.sort_order });
    baseUpdatedAt = question.updated_at;
  } else {
    source = 'empty';
    draft = normalizeDraftInput({});
    baseUpdatedAt = question.updated_at;
  }

  return {
    id: publicId(question.id),
    status: question.status,
    hasPendingDraft: Boolean(draftRow),
    source,
    baseUpdatedAt,
    createdAt: question.created_at,
    updatedAt: question.updated_at,
    publishedAt: question.published_at,
    archivedAt: question.archived_at,
    currentVersion: currentVersion
      ? {
          id: publicId(currentVersion.id),
          versionNo: currentVersion.version_no,
          title: currentVersion.title,
          type: currentVersion.question_type,
          difficulty: currentVersion.difficulty,
          createdAt: currentVersion.created_at,
        }
      : null,
    draft,
    versions,
  };
}

export async function adminStats(db) {
  const statusRows = await db
    .prepare('SELECT status, COUNT(*) AS count FROM questions GROUP BY status')
    .all();
  const statusCounts = { draft: 0, published: 0, archived: 0 };
  for (const row of statusRows) statusCounts[row.status] = Number(row.count) || 0;
  const pendingDrafts = Number(
    (
      await db
        .prepare(
          `SELECT COUNT(*) AS count FROM question_drafts d
           JOIN questions q ON q.id = d.question_id WHERE q.status = 'published'`,
        )
        .get()
    ).count,
  );
  const attempts = Number(
    (await db.prepare('SELECT COUNT(*) AS count FROM answer_records').get()).count,
  );
  const users = Number((await db.prepare('SELECT COUNT(*) AS count FROM users').get()).count);
  const categories = Number(
    (await db.prepare('SELECT COUNT(*) AS count FROM categories').get()).count,
  );
  const tags = Number((await db.prepare('SELECT COUNT(*) AS count FROM tags').get()).count);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attemptDays = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const start = new Date(today);
    start.setDate(start.getDate() - offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const count = Number(
      (
        await db
          .prepare(
            'SELECT COUNT(*) AS count FROM answer_records WHERE received_at >= ? AND received_at < ?',
          )
          .get(start.toISOString(), end.toISOString())
      ).count,
    );
    attemptDays.push({
      date: start.toISOString().slice(0, 10),
      count,
    });
  }
  const recentRows = await db
    .prepare(
      `SELECT q.id, q.status, q.updated_at, COALESCE(v.title, d.title, '未命名题目') AS title
       FROM questions q
       LEFT JOIN question_versions v ON v.id = q.current_version_id
       LEFT JOIN question_drafts d ON d.question_id = q.id
       ORDER BY q.updated_at DESC LIMIT 5`,
    )
    .all();
  const recentQuestions = recentRows.map((row) => ({
    id: publicId(row.id),
    title: row.title,
    status: row.status,
    updatedAt: row.updated_at,
  }));
  return {
    statusCounts,
    pendingDrafts,
    attempts,
    users,
    categories,
    tags,
    attemptDays,
    recentQuestions,
  };
}
