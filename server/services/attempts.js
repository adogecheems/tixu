import { ApiError, errors } from '../errors.js';
import { isUniqueViolation } from '../db.js';
import { nowIso, parseId, parseJson, publicId } from '../utils.js';
import { getVersionSnapshot, judgeAnswer, answerTextSummary } from './judge.js';
import {
  applyEssaySelfAssessment,
  applyEssaySubmitted,
  applyObjectiveResult,
  rebuildStatesFromHistory,
} from './study.js';

function normalizeClientEventId(value) {
  const id = String(value ?? '').trim();
  if (!id || id.length < 8 || id.length > 120 || !/^[A-Za-z0-9_\-:.]+$/.test(id)) {
    throw errors.validation('提交标识无效，请刷新页面后重试。', [
      { field: 'clientEventId', message: '提交标识格式不正确。' },
    ]);
  }
  return id;
}

function parseClientTime(value) {
  if (!value) return nowIso();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowIso();
  const now = Date.now();
  // Keep the client timestamp but never allow absurd future timestamps.
  if (date.getTime() > now + 10 * 60 * 1000) return nowIso();
  return date.toISOString();
}

function parseStoredAnswer(version) {
  return parseJson(version.answer_json, {});
}

function buildSubmissionResponse({ attempt, version, storedAnswer, analysis, duplicate = false, state = null }) {
  const isCorrect =
    attempt.is_correct === null ? null : Boolean(attempt.is_correct);
  return {
    attempt: {
      id: attempt.id === null || attempt.id === undefined ? null : publicId(attempt.id),
      questionId: publicId(version.question_id),
      versionId: publicId(version.id),
      versionNo: version.version_no,
      submittedAt: attempt.submitted_at,
      receivedAt: attempt.received_at,
      isCorrect,
      selfAssessment: attempt.self_assessment || null,
      verified: true,
      duplicate,
    },
    result: {
      isCorrect,
      requiresSelfAssessment: version.question_type === 'essay',
      selfAssessment: attempt.self_assessment || null,
      correctAnswer: storedAnswer,
      analysisMarkdown: analysis || '',
      submittedAnswer: attempt.answer_json ? parseJson(attempt.answer_json, {}) : null,
    },
    state,
  };
}

export async function submitAnswer(db, user, rawQuestionId, body) {
  const questionId = parseId(rawQuestionId, '题目 ID');
  const clientEventId = normalizeClientEventId(body?.clientEventId);

  // Idempotent retries are resolved before version checks: if the original
  // submission was recorded, a network retry should return that same result
  // even when an administrator published a new version in the meantime.
  if (user) {
    const existing = await db
      .prepare('SELECT * FROM answer_records WHERE user_id = ? AND client_event_id = ?')
      .get(user.id, clientEventId);
    if (existing) {
      if (Number(existing.question_id) !== questionId) {
        throw errors.conflict('提交标识已用于其他题目。', 'IDEMPOTENCY_KEY_REUSED');
      }
      const existingVersion = await getVersionSnapshot(db, existing.version_id);
      if (existingVersion) {
        return buildSubmissionResponse({
          attempt: existing,
          version: existingVersion,
          storedAnswer: parseStoredAnswer(existingVersion),
          analysis: existingVersion.analysis_markdown || '',
          duplicate: true,
        });
      }
    }
  }

  const question = await db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!question) throw errors.notFound('题目不存在。', 'QUESTION_NOT_FOUND');
  if (question.status === 'archived') {
    throw new ApiError(410, 'QUESTION_ARCHIVED', '这道题已归档，不能继续作答。');
  }
  if (question.status !== 'published' || !question.current_version_id) {
    throw errors.notFound('题目暂不可用。', 'QUESTION_NOT_FOUND');
  }

  const versionIdParam = body?.versionId ? parseId(body.versionId, '题目版本') : null;
  if (versionIdParam && versionIdParam !== question.current_version_id) {
    const current = await getVersionSnapshot(db, question.current_version_id);
    throw new ApiError(
      409,
      'VERSION_MISMATCH',
      '题目内容已更新，请刷新后再作答。',
      {
        currentVersionId: publicId(current.id),
        currentVersionNo: current.version_no,
        yourVersionId: publicId(versionIdParam),
      },
    );
  }

  const version = await getVersionSnapshot(db, question.current_version_id);
  if (!version) throw errors.notFound('题目版本不存在。', 'QUESTION_NOT_FOUND');
  const judged = judgeAnswer(version, body?.answer);
  const submittedAt = parseClientTime(body?.submittedAt);
  const receivedAt = nowIso();
  const storedAnswer = judged.normalizedAnswer;

  if (!user) {
    return buildSubmissionResponse({
      attempt: {
        id: null,
        is_correct: judged.isCorrect,
        self_assessment: null,
        submitted_at: submittedAt,
        received_at: receivedAt,
        answer_json: JSON.stringify(storedAnswer),
      },
      version,
      storedAnswer: judged.correctAnswer,
      analysis: version.analysis_markdown,
    });
  }

  try {
    return await db.transaction(async () => {
      const duplicate = await db
        .prepare('SELECT * FROM answer_records WHERE user_id = ? AND client_event_id = ?')
        .get(user.id, clientEventId);
      if (duplicate) {
        const duplicateVersion = await getVersionSnapshot(db, duplicate.version_id);
        return buildSubmissionResponse({
          attempt: duplicate,
          version: duplicateVersion || version,
          storedAnswer: parseStoredAnswer(duplicateVersion || version),
          analysis: duplicateVersion?.analysis_markdown || '',
          duplicate: true,
        });
      }

      const attempt = await db
        .prepare(
          `INSERT INTO answer_records
            (user_id, question_id, version_id, client_event_id, answer_json, is_correct,
             self_assessment, submitted_at, received_at, verified, source)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, 'native')
           RETURNING *`,
        )
        .get(
          user.id,
          questionId,
          version.id,
          clientEventId,
          JSON.stringify(storedAnswer),
          judged.isCorrect === null ? null : judged.isCorrect ? 1 : 0,
          submittedAt,
          receivedAt,
        );
      if (version.question_type === 'essay') {
        await applyEssaySubmitted(db, user.id, questionId, attempt.id, receivedAt);
      } else {
        await applyObjectiveResult(db, user.id, questionId, attempt.id, judged.isCorrect, receivedAt);
      }
      return buildSubmissionResponse({
        attempt,
        version,
        storedAnswer: judged.correctAnswer,
        analysis: version.analysis_markdown,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const duplicate = await db
        .prepare('SELECT * FROM answer_records WHERE user_id = ? AND client_event_id = ?')
        .get(user.id, clientEventId);
      if (duplicate) {
        const duplicateVersion = await getVersionSnapshot(db, duplicate.version_id);
        return buildSubmissionResponse({
          attempt: duplicate,
          version: duplicateVersion || version,
          storedAnswer: parseStoredAnswer(duplicateVersion || version),
          analysis: duplicateVersion?.analysis_markdown || '',
          duplicate: true,
        });
      }
    }
    throw error;
  }
}

export async function assessEssay(db, user, rawAttemptId, body) {
  const attemptId = parseId(rawAttemptId, '作答记录 ID');
  const assessment = body?.assessment;
  if (!['mastered', 'not_mastered'].includes(assessment)) {
    throw errors.validation('请选择「已掌握」或「未掌握」。', [
      { field: 'assessment', message: '自评结果无效。' },
    ]);
  }
  const attempt = await db
    .prepare(
      `SELECT ar.*, v.question_type, v.question_id
       FROM answer_records ar JOIN question_versions v ON v.id = ar.version_id
       WHERE ar.id = ? AND ar.user_id = ?`,
    )
    .get(attemptId, user.id);
  if (!attempt) throw errors.notFound('作答记录不存在。', 'ATTEMPT_NOT_FOUND');
  if (attempt.question_type !== 'essay') {
    throw errors.validation('只有简答题需要进行自评。');
  }
  if (!attempt.verified) throw errors.validation('这条历史记录无法进行自评。');
  if (attempt.self_assessment) {
    if (attempt.self_assessment === assessment) {
      return {
        attemptId: publicId(attempt.id),
        selfAssessment: assessment,
        duplicate: true,
      };
    }
    throw errors.conflict('这道题已经完成自评，不能重复修改。', 'ALREADY_ASSESSED');
  }
  const timestamp = nowIso();
  return db.transaction(async () => {
    const updated = await db
      .prepare(
        `UPDATE answer_records SET self_assessment = ?
         WHERE id = ? AND user_id = ? AND self_assessment IS NULL`,
      )
      .run(assessment, attemptId, user.id);
    if (updated.changes === 0) {
      throw errors.conflict('这道题已经完成自评。', 'ALREADY_ASSESSED');
    }
    await applyEssaySelfAssessment(
      db,
      user.id,
      attempt.question_id,
      attemptId,
      assessment === 'mastered',
      timestamp,
    );
    return {
      attemptId: publicId(attempt.id),
      selfAssessment: assessment,
      assessedAt: timestamp,
    };
  });
}

export async function getOwnedAttemptDetail(db, user, attemptId) {
  const attempt = await db
    .prepare(
      `SELECT ar.*, v.title, v.stem_markdown, v.question_type, v.difficulty, v.options_json,
              v.analysis_markdown, v.version_no, v.created_at AS version_created_at,
              qa.answer_json AS version_answer_json, qa.judge_config_json,
              v.category_id,
              q.status AS question_status, q.current_version_id,
              c.name AS category_name, c.parent_id AS category_parent_id,
              parent.name AS parent_category_name
       FROM answer_records ar
       LEFT JOIN question_versions v ON v.id = ar.version_id
       JOIN questions q ON q.id = ar.question_id
       LEFT JOIN question_answers qa ON qa.version_id = v.id
       LEFT JOIN categories c ON c.id = v.category_id
       LEFT JOIN categories parent ON parent.id = c.parent_id
       WHERE ar.id = ? AND ar.user_id = ?`,
    )
    .get(Number(attemptId), user.id);
  if (!attempt) return null;
  if (!attempt.version_no) {
    return {
      id: publicId(attempt.id),
      questionId: publicId(attempt.question_id),
      versionId: null,
      sourceVersionRef: attempt.source_version_ref || null,
      versionNo: null,
      title: '历史题目版本已失效',
      type: null,
      difficulty: null,
      category: null,
      tags: [],
      stemMarkdown: '',
      options: [],
      fillConfig: {},
      userAnswer: parseJson(attempt.answer_json, {}),
      answerSummary: '未验证的历史作答',
      correctAnswer: null,
      analysisMarkdown: '',
      isCorrect: null,
      selfAssessment: attempt.self_assessment || null,
      verified: Boolean(attempt.verified),
      source: attempt.source,
      submittedAt: attempt.submitted_at,
      receivedAt: attempt.received_at,
      questionStatus: attempt.question_status,
      unavailable: true,
    };
  }
  const tagRows = await db
    .prepare(
      `SELECT t.id, t.name FROM question_tags qt JOIN tags t ON t.id = qt.tag_id
       WHERE qt.question_id = ? ORDER BY LOWER(t.name)`,
    )
    .all(attempt.question_id);
  const tags = tagRows.map((tag) => ({ id: publicId(tag.id), name: tag.name }));
  return {
    id: publicId(attempt.id),
    questionId: publicId(attempt.question_id),
    versionId: publicId(attempt.version_id),
    versionNo: attempt.version_no,
    clientEventId: attempt.client_event_id,
    title: attempt.title,
    type: attempt.question_type,
    difficulty: attempt.difficulty,
    category: attempt.category_id
      ? {
          id: publicId(attempt.category_id),
          name: attempt.category_name,
          parent: attempt.category_parent_id
            ? { id: publicId(attempt.category_parent_id), name: attempt.parent_category_name }
            : null,
        }
      : null,
    tags,
    stemMarkdown: attempt.stem_markdown,
    options: parseJson(attempt.options_json, []),
    fillConfig: parseJson(attempt.judge_config_json, {}),
    userAnswer: parseJson(attempt.answer_json, {}),
    answerSummary: answerTextSummary(attempt.question_type, parseJson(attempt.answer_json, {})),
    correctAnswer: parseJson(attempt.version_answer_json, {}),
    analysisMarkdown: attempt.analysis_markdown,
    isCorrect: attempt.is_correct === null ? null : Boolean(attempt.is_correct),
    selfAssessment: attempt.self_assessment || null,
    verified: Boolean(attempt.verified),
    source: attempt.source,
    submittedAt: attempt.submitted_at,
    receivedAt: attempt.received_at,
    questionStatus: attempt.question_status,
  };
}

export async function listAttempts(db, user, query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  const conditions = ['ar.user_id = ?'];
  const params = [user.id];
  if (query.type && ['single', 'multiple', 'truefalse', 'fill', 'essay'].includes(query.type)) {
    conditions.push('v.question_type = ?');
    params.push(query.type);
  }
  if (query.questionId) {
    const questionId = Number.parseInt(query.questionId, 10);
    if (Number.isSafeInteger(questionId) && questionId > 0) {
      conditions.push('ar.question_id = ?');
      params.push(questionId);
    }
  }
  const keyword = String(query.q || '').trim().slice(0, 120);
  if (keyword) {
    conditions.push('v.title LIKE ?');
    params.push(`%${keyword.replace(/[\\%_]/g, (char) => `\\${char}`)}%`);
  }
  const result = String(query.result || '');
  if (result === 'correct') conditions.push('ar.is_correct = 1 AND ar.verified = 1');
  else if (result === 'wrong') conditions.push('ar.is_correct = 0 AND ar.verified = 1');
  else if (result === 'self_mastered') conditions.push("ar.self_assessment = 'mastered'");
  else if (result === 'self_not_mastered') conditions.push("ar.self_assessment = 'not_mastered'");
  else if (result === 'pending') {
    conditions.push("v.question_type = 'essay' AND ar.self_assessment IS NULL AND ar.verified = 1");
  } else if (result === 'unverified') conditions.push('ar.verified = 0');

  const where = conditions.join(' AND ');
  const total = Number(
    (
      await db
        .prepare(
          `SELECT COUNT(*) AS count FROM answer_records ar
           LEFT JOIN question_versions v ON v.id = ar.version_id WHERE ${where}`,
        )
        .get(...params)
    ).count,
  );
  const rows = await db
    .prepare(
      `SELECT ar.id, ar.question_id, ar.version_id, ar.source_version_ref, ar.is_correct,
              ar.self_assessment, ar.submitted_at, ar.received_at, ar.verified, ar.source,
              ar.answer_json, v.title, v.question_type, v.difficulty, v.version_no
       FROM answer_records ar LEFT JOIN question_versions v ON v.id = ar.version_id
       WHERE ${where}
       ORDER BY ar.submitted_at DESC, ar.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  return {
    items: rows.map((row) => ({
      id: publicId(row.id),
      questionId: publicId(row.question_id),
      versionId: publicId(row.version_id),
      sourceVersionRef: row.source_version_ref || null,
      versionNo: row.version_no ?? null,
      title: row.title || '历史题目版本已失效',
      type: row.question_type || null,
      difficulty: row.difficulty || null,
      isCorrect: row.is_correct === null ? null : Boolean(row.is_correct),
      selfAssessment: row.self_assessment || null,
      verified: Boolean(row.verified),
      source: row.source,
      answerSummary: row.question_type
        ? answerTextSummary(row.question_type, parseJson(row.answer_json, {}))
        : '未验证的历史作答',
      submittedAt: row.submitted_at,
      receivedAt: row.received_at,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function mergeGuestData(db, user, body) {
  const attempts = Array.isArray(body?.attempts) ? body.attempts.slice(0, 2000) : [];
  const favorites = Array.isArray(body?.favorites) ? body.favorites.slice(0, 5000) : [];
  if (!attempts.length && !favorites.length) {
    return {
      attemptsImported: 0,
      attemptsSkipped: 0,
      attemptsUnverified: 0,
      favoritesAdded: 0,
      favoritesUnchanged: 0,
    };
  }

  return db.transaction(async () => {
    let attemptsImported = 0;
    let attemptsSkipped = 0;
    let attemptsUnverified = 0;
    const touchedQuestions = new Set();

    const statement = db.prepare(
      `INSERT INTO answer_records
        (user_id, question_id, version_id, source_version_ref, client_event_id, answer_json,
         is_correct, self_assessment, submitted_at, received_at, verified, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'merge')`,
    );

    for (const item of attempts) {
      try {
        const questionId = parseId(item.questionId, '题目 ID');
        const versionId = parseId(item.versionId, '版本 ID');
        const clientEventId = normalizeClientEventId(item.clientEventId);
        const existing = await db
          .prepare('SELECT id FROM answer_records WHERE user_id = ? AND client_event_id = ?')
          .get(user.id, clientEventId);
        if (existing) {
          attemptsSkipped += 1;
          continue;
        }

        const version = await getVersionSnapshot(db, versionId);
        const usableVersion = version && Number(version.question_id) === questionId ? version : null;
        const submittedAt = parseClientTime(item.submittedAt);
        const receivedAt = nowIso();
        let verified = 0;
        let isCorrect = null;
        let selfAssessment = null;
        let normalizedAnswer = item.answer || {};
        let judgedOk = false;

        if (usableVersion) {
          try {
            const judged = judgeAnswer(usableVersion, item.answer);
            normalizedAnswer = judged.normalizedAnswer;
            judgedOk = true;
            if (usableVersion.question_type === 'essay') {
              verified = 1;
              selfAssessment =
                item.selfAssessment === 'mastered' || item.selfAssessment === 'not_mastered'
                  ? item.selfAssessment
                  : null;
            } else {
              verified = 1;
              isCorrect = judged.isCorrect ? 1 : 0;
            }
          } catch {
            verified = 0;
          }
        }

        if (!judgedOk) {
          // Keep the original answer as an explicitly unverified record. It is
          // excluded from verified statistics and cannot influence study state.
          verified = 0;
          isCorrect = null;
          selfAssessment = null;
        }

        await statement.run(
          user.id,
          questionId,
          usableVersion ? usableVersion.id : null,
          usableVersion ? null : String(versionId),
          clientEventId,
          JSON.stringify(normalizedAnswer),
          isCorrect,
          selfAssessment,
          submittedAt,
          receivedAt,
          verified,
        );
        attemptsImported += 1;
        if (!verified) attemptsUnverified += 1;
        touchedQuestions.add(questionId);
      } catch {
        attemptsSkipped += 1;
      }
    }

    let favoritesAdded = 0;
    let favoritesUnchanged = 0;
    for (const item of favorites) {
      try {
        const questionId = parseId(item.questionId, '题目 ID');
        const question = await db.prepare('SELECT id FROM questions WHERE id = ?').get(questionId);
        if (!question) {
          continue;
        }
        const state = await db
          .prepare('SELECT * FROM user_question_states WHERE user_id = ? AND question_id = ?')
          .get(user.id, questionId);
        if (Number(state?.favorite) === 1) {
          favoritesUnchanged += 1;
          continue;
        }
        await db
          .prepare(
            `INSERT INTO user_question_states
              (user_id, question_id, favorite, favorited_at, updated_at)
             VALUES (?, ?, 1, ?, ?)
             ON CONFLICT(user_id, question_id) DO UPDATE SET
               favorite = 1,
               favorited_at = COALESCE(user_question_states.favorited_at, excluded.favorited_at),
               updated_at = excluded.updated_at`,
          )
          .run(user.id, questionId, item.favoritedAt || nowIso(), nowIso());
        favoritesAdded += 1;
      } catch {
        // Invalid favorite payload items are ignored; the rest of the merge can proceed.
      }
    }

    // Rebuild wrong-book aggregates for every imported/touched question from the
    // union of the account history and the newly-verified guest history.
    await rebuildStatesFromHistory(db, user.id, [...touchedQuestions]);

    return {
      attemptsImported,
      attemptsSkipped,
      attemptsUnverified,
      favoritesAdded,
      favoritesUnchanged,
    };
  });
}
