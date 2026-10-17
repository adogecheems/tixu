import { publicId } from '../utils.js';
import {
  loadTagsForQuestions,
  parseListParams,
  parseTypes,
  serializeCard,
} from './questionQueries.js';

const baseSelect = `
  SELECT q.id, q.status, q.sort_order, q.published_at, q.category_id,
         v.id AS version_id, v.version_no, v.title, v.stem_markdown, v.question_type,
         v.difficulty, v.category_id AS version_category_id,
         c.name AS category_name, c.parent_id AS category_parent_id,
         parent.name AS parent_category_name,
         s.favorite AS is_favorited,
         s.favorited_at, s.in_wrong_book, s.wrong_count,
         s.last_wrong_at, s.last_answered_at
  FROM user_question_states s
  JOIN questions q ON q.id = s.question_id
  JOIN question_versions v ON v.id = q.current_version_id
  LEFT JOIN categories c ON c.id = v.category_id
  LEFT JOIN categories parent ON parent.id = c.parent_id
`;

function buildCollectionConditions(collection, query, params) {
  const conditions = [
    's.user_id = ?',
    "q.status = 'published'",
    'q.current_version_id IS NOT NULL',
  ];
  params.push(query.userId);
  if (collection === 'favorites') conditions.push('s.favorite = 1');
  else conditions.push('s.in_wrong_book = 1');

  const types = parseTypes(query.types ?? query.type).filter((type) =>
    ['single', 'multiple', 'truefalse', 'fill', 'essay'].includes(type),
  );
  if (types.length) {
    conditions.push(`v.question_type IN (${types.map(() => '?').join(',')})`);
    params.push(...types);
  }
  const categoryId = Number.parseInt(query.category, 10);
  if (Number.isSafeInteger(categoryId) && categoryId > 0) {
    conditions.push('v.category_id IN (SELECT id FROM categories WHERE id = ? OR parent_id = ?)');
    params.push(categoryId, categoryId);
  }
  const keyword = String(query.q || '').trim().slice(0, 120);
  if (keyword) {
    conditions.push('(v.title LIKE ? OR v.stem_markdown LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like);
  }
  const tagIds = String(query.tags || '')
    .split(',')
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isSafeInteger(item) && item > 0);
  if (tagIds.length) {
    conditions.push(
      `q.id IN (
        SELECT question_id FROM question_tags WHERE tag_id IN (${tagIds.map(() => '?').join(',')})
        GROUP BY question_id HAVING COUNT(DISTINCT tag_id) = ?
      )`,
    );
    params.push(...tagIds, tagIds.length);
  }
  return conditions;
}

export async function listCollection(db, userId, collection, query) {
  const { page, pageSize, offset } = parseListParams(query);
  const params = [];
  const conditions = buildCollectionConditions(collection, { ...query, userId }, params);
  const where = conditions.join(' AND ');
  let order;
  if (collection === 'wrong') {
    order =
      query.sort === 'count'
        ? 's.wrong_count DESC, s.last_wrong_at DESC, q.id DESC'
        : 's.last_wrong_at DESC, s.wrong_count DESC, q.id DESC';
  } else {
    order = 's.favorited_at DESC, q.id DESC';
  }
  const total = Number(
    (
      await db
        .prepare(
          `SELECT COUNT(*) AS count FROM user_question_states s
           JOIN questions q ON q.id = s.question_id
           JOIN question_versions v ON v.id = q.current_version_id
           WHERE ${where}`,
        )
        .get(...params)
    ).count,
  );
  const rows = await db
    .prepare(`${baseSelect} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);
  const tagMap = await loadTagsForQuestions(db, rows.map((row) => row.id));
  return {
    items: rows.map((row) => ({
      ...serializeCard(row, tagMap.get(row.id) || []),
      isFavorited: Boolean(row.is_favorited),
      wrongCount: Number(row.wrong_count) || 0,
      lastWrongAt: row.last_wrong_at || null,
      lastAnsweredAt: row.last_answered_at || null,
      favoritedAt: row.favorited_at || null,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function listCollectionIds(db, userId, collection, query) {
  const params = [];
  const conditions = buildCollectionConditions(collection, { ...query, userId }, params);
  const where = conditions.join(' AND ');
  const order =
    collection === 'wrong'
      ? query.sort === 'count'
        ? 's.wrong_count DESC, s.last_wrong_at DESC, q.id DESC'
        : 's.last_wrong_at DESC, s.wrong_count DESC, q.id DESC'
      : 's.favorited_at DESC, q.id DESC';
  const rows = await db
    .prepare(
      `SELECT q.id FROM user_question_states s
       JOIN questions q ON q.id = s.question_id
       JOIN question_versions v ON v.id = q.current_version_id
       WHERE ${where} ORDER BY ${order}`,
    )
    .all(...params);
  return rows.map((row) => publicId(row.id));
}

