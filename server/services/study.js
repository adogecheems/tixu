import { nowIso } from '../utils.js';

async function ensureStateRow(db, userId, questionId) {
  await db
    .prepare(
      `INSERT INTO user_question_states (user_id, question_id, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, question_id) DO NOTHING`,
    )
    .run(userId, questionId, nowIso());
}

export async function applyObjectiveResult(db, userId, questionId, attemptId, isCorrect, at) {
  await ensureStateRow(db, userId, questionId);
  const timestamp = at || nowIso();
  if (isCorrect) {
    await db
      .prepare(
        `UPDATE user_question_states
         SET in_wrong_book = 0, last_answered_at = ?, last_attempt_id = ?, updated_at = ?
         WHERE user_id = ? AND question_id = ?`,
      )
      .run(timestamp, attemptId, timestamp, userId, questionId);
  } else {
    await db
      .prepare(
        `UPDATE user_question_states
         SET in_wrong_book = 1, wrong_count = wrong_count + 1, last_wrong_at = ?,
             last_answered_at = ?, last_attempt_id = ?, updated_at = ?
         WHERE user_id = ? AND question_id = ?`,
      )
      .run(timestamp, timestamp, attemptId, timestamp, userId, questionId);
  }
}

export async function applyEssaySubmitted(db, userId, questionId, attemptId, at) {
  await ensureStateRow(db, userId, questionId);
  const timestamp = at || nowIso();
  await db
    .prepare(
      `UPDATE user_question_states
       SET last_answered_at = ?, last_attempt_id = ?, updated_at = ?
       WHERE user_id = ? AND question_id = ?`,
    )
    .run(timestamp, attemptId, timestamp, userId, questionId);
}

export async function applyEssaySelfAssessment(db, userId, questionId, attemptId, mastered, at) {
  await ensureStateRow(db, userId, questionId);
  const timestamp = at || nowIso();
  if (mastered) {
    await db
      .prepare(
        `UPDATE user_question_states
         SET in_wrong_book = 0, last_answered_at = ?, last_attempt_id = ?, updated_at = ?
         WHERE user_id = ? AND question_id = ?`,
      )
      .run(timestamp, attemptId, timestamp, userId, questionId);
  } else {
    await db
      .prepare(
        `UPDATE user_question_states
         SET in_wrong_book = 1, wrong_count = wrong_count + 1, last_wrong_at = ?,
             last_answered_at = ?, last_attempt_id = ?, updated_at = ?
         WHERE user_id = ? AND question_id = ?`,
      )
      .run(timestamp, timestamp, attemptId, timestamp, userId, questionId);
  }
}

export async function setFavorite(db, userId, questionId, favorited) {
  await ensureStateRow(db, userId, questionId);
  const timestamp = nowIso();
  if (favorited) {
    await db
      .prepare(
        `UPDATE user_question_states
         SET favorite = 1,
             favorited_at = CASE WHEN favorite = 1 AND favorited_at IS NOT NULL THEN favorited_at ELSE ? END,
             updated_at = ?
         WHERE user_id = ? AND question_id = ?`,
      )
      .run(timestamp, timestamp, userId, questionId);
  } else {
    await db
      .prepare(
        `UPDATE user_question_states
         SET favorite = 0, favorited_at = NULL, updated_at = ?
         WHERE user_id = ? AND question_id = ?`,
      )
      .run(timestamp, userId, questionId);
  }
  return db
    .prepare(
      'SELECT favorite, favorited_at FROM user_question_states WHERE user_id = ? AND question_id = ?',
    )
    .get(userId, questionId);
}

export async function addFavoriteFromMerge(db, userId, questionId, favoritedAt) {
  await ensureStateRow(db, userId, questionId);
  await db
    .prepare(
      `UPDATE user_question_states
       SET favorite = 1,
           favorited_at = CASE WHEN favorite = 1 AND favorited_at IS NOT NULL THEN favorited_at ELSE ? END,
           updated_at = ?
       WHERE user_id = ? AND question_id = ?`,
    )
    .run(favoritedAt || nowIso(), nowIso(), userId, questionId);
}

export async function rebuildStatesFromHistory(db, userId, questionIds) {
  for (const questionId of questionIds) {
    const attempts = await db
      .prepare(
        `SELECT ar.*, qv.question_type
         FROM answer_records ar
         JOIN question_versions qv ON qv.id = ar.version_id
         WHERE ar.user_id = ? AND ar.question_id = ? AND ar.verified = 1
         ORDER BY ar.submitted_at ASC, ar.id ASC`,
      )
      .all(userId, questionId);

    let inWrong = 0;
    let wrongCount = 0;
    let lastWrongAt = null;
    let lastAnsweredAt = null;
    let lastAttemptId = null;

    for (const attempt of attempts) {
      lastAnsweredAt = attempt.submitted_at;
      lastAttemptId = attempt.id;
      if (attempt.question_type === 'essay') {
        if (attempt.self_assessment === 'not_mastered') {
          inWrong = 1;
          wrongCount += 1;
          lastWrongAt = attempt.submitted_at;
        } else if (attempt.self_assessment === 'mastered') {
          inWrong = 0;
        }
      } else if (Number(attempt.is_correct) === 0) {
        inWrong = 1;
        wrongCount += 1;
        lastWrongAt = attempt.submitted_at;
      } else if (Number(attempt.is_correct) === 1) {
        inWrong = 0;
      }
    }

    await ensureStateRow(db, userId, questionId);
    await db
      .prepare(
        `UPDATE user_question_states
         SET in_wrong_book = ?, wrong_count = ?, last_wrong_at = ?, last_answered_at = ?,
             last_attempt_id = ?, updated_at = ?
         WHERE user_id = ? AND question_id = ?`,
      )
      .run(
        inWrong,
        wrongCount,
        lastWrongAt,
        lastAnsweredAt,
        lastAttemptId,
        nowIso(),
        userId,
        questionId,
      );
  }
}

export async function getUserStats(db, userId) {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM answer_records WHERE user_id = ? AND verified = 1) AS attempts,
        (SELECT COUNT(*) FROM answer_records WHERE user_id = ? AND verified = 1 AND is_correct = 1) AS correct_attempts,
        (SELECT COUNT(*) FROM user_question_states WHERE user_id = ? AND in_wrong_book = 1) AS wrong,
        (SELECT COUNT(*) FROM user_question_states WHERE user_id = ? AND favorite = 1) AS favorites,
        (SELECT COUNT(*) FROM answer_records WHERE user_id = ? AND verified = 1 AND self_assessment = 'mastered') AS mastered,
        (SELECT COUNT(*) FROM answer_records WHERE user_id = ? AND verified = 0) AS unverified_attempts`,
    )
    .get(userId, userId, userId, userId, userId, userId);
  return {
    attempts: Number(row.attempts) || 0,
    correctAttempts: Number(row.correct_attempts) || 0,
    wrong: Number(row.wrong) || 0,
    favorites: Number(row.favorites) || 0,
    mastered: Number(row.mastered) || 0,
    unverifiedAttempts: Number(row.unverified_attempts) || 0,
  };
}
