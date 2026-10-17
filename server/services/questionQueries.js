import { config } from '../config.js';
import { parseJson, publicId, stripMarkdown } from '../utils.js';
import { publicFillConfig } from '../validation.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function parseListParams(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requestedSize = Number.parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedSize));
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function parseTypes(raw) {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : String(raw).split(',');
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

export function parseIntegerList(raw) {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : String(raw).split(',');
  return [
    ...new Set(
      values
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isSafeInteger(item) && item > 0),
    ),
  ];
}

function escapeLike(value) {
  return String(value || '').replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function buildPublicFilters(query = {}) {
  const conditions = [`q.status = 'published'`, `q.current_version_id IS NOT NULL`];
  const params = [];
  const types = parseTypes(query.types ?? query.type).filter((type) =>
    ['single', 'multiple', 'truefalse', 'fill', 'essay'].includes(type),
  );
  if (types.length) {
    conditions.push(`v.question_type IN (${types.map(() => '?').join(',')})`);
    params.push(...types);
  }
  if (query.difficulty && ['easy', 'medium', 'hard'].includes(query.difficulty)) {
    conditions.push('v.difficulty = ?');
    params.push(query.difficulty);
  }
  const categoryId = Number.parseInt(query.category, 10);
  if (Number.isSafeInteger(categoryId) && categoryId > 0) {
    conditions.push(
      `v.category_id IN (SELECT id FROM categories WHERE id = ? OR parent_id = ?)`,
    );
    params.push(categoryId, categoryId);
  }
  const tagIds = parseIntegerList(query.tags);
  if (tagIds.length) {
    conditions.push(
      `q.id IN (
        SELECT question_id FROM question_tags
        WHERE tag_id IN (${tagIds.map(() => '?').join(',')})
        GROUP BY question_id HAVING COUNT(DISTINCT tag_id) = ?
      )`,
    );
    params.push(...tagIds, tagIds.length);
  }
  const keyword = String(query.q || '').trim().slice(0, 120);
  if (keyword) {
    conditions.push(`(v.title LIKE ? ESCAPE '\\' OR v.stem_markdown LIKE ? ESCAPE '\\')`);
    const like = `%${escapeLike(keyword)}%`;
    params.push(like, like);
  }
  return { conditions, params, types, keyword };
}

export function orderClause(sort) {
  switch (sort) {
    case 'newest':
      return 'q.published_at DESC, q.id DESC';
    case 'difficulty_asc':
      return "CASE v.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC, q.id DESC";
    case 'difficulty_desc':
      return "CASE v.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END DESC, q.id DESC";
    case 'default':
    default:
      return 'q.sort_order ASC, q.id DESC';
  }
}

const cardSelect = `
  SELECT q.id, q.status, q.sort_order, q.published_at, q.category_id,
         v.id AS version_id, v.version_no, v.title, v.stem_markdown, v.question_type,
         v.difficulty, v.category_id AS version_category_id,
         c.name AS category_name, c.parent_id AS category_parent_id,
         parent.name AS parent_category_name,
         COALESCE(s.favorite, 0) AS is_favorited
  FROM questions q
  JOIN question_versions v ON v.id = q.current_version_id
  LEFT JOIN categories c ON c.id = v.category_id
  LEFT JOIN categories parent ON parent.id = c.parent_id
  LEFT JOIN user_question_states s ON s.user_id = ? AND s.question_id = q.id
`;

export async function loadTagsForQuestions(db, questionIds) {
  if (!questionIds.length) return new Map();
  const placeholders = questionIds.map(() => '?').join(',');
  const rows = await db
    .prepare(
      `SELECT qt.question_id, t.id, t.name
       FROM question_tags qt JOIN tags t ON t.id = qt.tag_id
       WHERE qt.question_id IN (${placeholders})
       ORDER BY LOWER(t.name) ASC`,
    )
    .all(...questionIds);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.question_id)) map.set(row.question_id, []);
    map.get(row.question_id).push({ id: publicId(row.id), name: row.name });
  }
  return map;
}

export function serializeCategory(row) {
  if (!row.category_id && !row.version_category_id) return null;
  const categoryId = row.version_category_id || row.category_id;
  if (!categoryId) return null;
  if (row.category_parent_id) {
    return {
      id: publicId(categoryId),
      name: row.category_name,
      parent: {
        id: publicId(row.category_parent_id),
        name: row.parent_category_name,
      },
    };
  }
  return {
    id: publicId(categoryId),
    name: row.category_name,
    parent: null,
  };
}

export function serializeCard(row, tags = []) {
  return {
    id: publicId(row.id),
    versionId: publicId(row.version_id),
    versionNo: row.version_no,
    title: row.title,
    summary: stripMarkdown(row.stem_markdown, 150),
    type: row.question_type,
    difficulty: row.difficulty,
    category: serializeCategory(row),
    tags,
    isFavorited: Boolean(row.is_favorited),
    publishedAt: row.published_at,
  };
}

export async function listPublicQuestions(db, query, user) {
  const { page, pageSize, offset } = parseListParams(query);
  const { conditions, params } = buildPublicFilters(query);
  const where = conditions.join(' AND ');
  const order = orderClause(query.sort);
  const userId = user ? user.id : -1;
  const total = Number(
    (
      await db
        .prepare(
          `SELECT COUNT(*) AS count FROM questions q
           JOIN question_versions v ON v.id = q.current_version_id
           WHERE ${where}`,
        )
        .get(...params)
    ).count,
  );
  const rows = await db
    .prepare(
      `${cardSelect}
       WHERE ${where}
       ORDER BY ${order}
       LIMIT ? OFFSET ?`,
    )
    .all(userId, ...params, pageSize, offset);
  const tagMap = await loadTagsForQuestions(db, rows.map((row) => row.id));
  return {
    items: rows.map((row) => serializeCard(row, tagMap.get(row.id) || [])),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function listPublicQuestionIds(db, query) {
  const { conditions, params } = buildPublicFilters(query);
  const rows = await db
    .prepare(
      `SELECT q.id FROM questions q
       JOIN question_versions v ON v.id = q.current_version_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderClause(query.sort)}`,
    )
    .all(...params);
  return rows.map((row) => publicId(row.id));
}

export async function lookupQuestionCards(db, ids, user) {
  const numericIds = ids
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isSafeInteger(id) && id > 0)
    .slice(0, 100);
  if (!numericIds.length) return [];
  const userId = user ? user.id : -1;
  const placeholders = numericIds.map(() => '?').join(',');
  const rows = await db
    .prepare(
      `${cardSelect}
       WHERE q.status = 'published' AND q.id IN (${placeholders})`,
    )
    .all(userId, ...numericIds);
  const tagMap = await loadTagsForQuestions(db, rows.map((row) => row.id));
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  return numericIds
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map((row) => serializeCard(row, tagMap.get(row.id) || []));
}

export async function getPublicQuestion(db, questionId, user) {
  const userId = user ? user.id : -1;
  const row = await db
    .prepare(
      `SELECT q.id, q.status, q.category_id, q.published_at, q.current_version_id,
              v.id AS version_id, v.version_no, v.title, v.stem_markdown, v.question_type,
              v.difficulty, v.options_json, v.category_id AS version_category_id,
              qa.judge_config_json,
              c.name AS category_name, c.parent_id AS category_parent_id,
              parent.name AS parent_category_name,
              COALESCE(s.favorite, 0) AS is_favorited
       FROM questions q
       LEFT JOIN question_versions v ON v.id = q.current_version_id
       LEFT JOIN categories c ON c.id = v.category_id
       LEFT JOIN categories parent ON parent.id = c.parent_id
       LEFT JOIN question_answers qa ON qa.version_id = v.id
       LEFT JOIN user_question_states s ON s.user_id = ? AND s.question_id = q.id
       WHERE q.id = ?`,
    )
    .get(userId, questionId);
  if (!row) return { question: null, status: null };
  if (row.status === 'archived') return { question: null, status: 'archived' };
  if (row.status !== 'published' || !row.version_id) return { question: null, status: 'not_found' };
  const tags = (await loadTagsForQuestions(db, [row.id])).get(row.id) || [];
  return {
    status: 'published',
    question: {
      ...serializeCard({ ...row, is_favorited: row.is_favorited }, tags),
      stemMarkdown: row.stem_markdown,
      options: parseJson(row.options_json, []),
      fillConfig:
        row.question_type === 'fill' ? publicFillConfig(parseJson(row.judge_config_json, {})) : null,
      initialAnswer:
        row.question_type === 'multiple'
          ? { optionIds: [] }
          : row.question_type === 'truefalse'
            ? { value: null }
            : row.question_type === 'fill'
              ? { blanks: [''] }
              : row.question_type === 'essay'
                ? { text: '' }
                : { optionId: null },
    },
  };
}

const publicCacheTtlMs = Math.max(0, Number(config.publicCacheTtlSeconds || 0) * 1000);
let publicCacheRevision = 0;
const publicCaches = {
  categories: { value: null, expiresAt: 0, loading: null },
  tags: { value: null, expiresAt: 0, loading: null },
  home: { value: null, expiresAt: 0, loading: null },
};

export function invalidatePublicCache() {
  publicCacheRevision += 1;
  for (const cache of Object.values(publicCaches)) {
    cache.value = null;
    cache.expiresAt = 0;
    cache.loading = null;
  }
}

function loadCached(key, loader) {
  if (publicCacheTtlMs <= 0) return loader();
  const cache = publicCaches[key];
  if (cache.value !== null && Date.now() < cache.expiresAt) {
    return Promise.resolve(cache.value);
  }
  if (cache.loading) return cache.loading;

  const revision = publicCacheRevision;
  const loading = Promise.resolve()
    .then(loader)
    .then((value) => {
      if (revision === publicCacheRevision) {
        cache.value = value;
        cache.expiresAt = Date.now() + publicCacheTtlMs;
      }
      return value;
    })
    .finally(() => {
      if (cache.loading === loading) cache.loading = null;
    });
  cache.loading = loading;
  return loading;
}

async function computeCategoryTree(db, { includeZero = false } = {}) {
  const rows = await db
    .prepare(
      `SELECT c.id, c.name, c.parent_id, c.sort_order,
              COUNT(DISTINCT CASE WHEN q.status = 'published' THEN q.id END) AS question_count
       FROM categories c
       LEFT JOIN questions q ON q.category_id = c.id
       GROUP BY c.id
       ORDER BY c.parent_id IS NOT NULL, c.sort_order ASC, c.id ASC`,
    )
    .all();
  const roots = [];
  const byId = new Map();
  for (const row of rows) {
    const node = {
      id: publicId(row.id),
      name: row.name,
      sortOrder: row.sort_order,
      questionCount: Number(row.question_count) || 0,
      children: [],
    };
    byId.set(row.id, node);
    if (!row.parent_id) roots.push(node);
  }
  for (const row of rows) {
    if (row.parent_id && byId.has(row.parent_id)) {
      const node = byId.get(row.id);
      const parent = byId.get(row.parent_id);
      parent.children.push(node);
      parent.questionCount += node.questionCount;
    }
  }
  return includeZero ? roots : roots.filter((root) => root.questionCount > 0 || root.children.length);
}

export async function getCategoryTree(db, { includeZero = false } = {}) {
  if (includeZero) return computeCategoryTree(db, { includeZero: true });
  return loadCached('categories', () => computeCategoryTree(db, { includeZero: false }));
}

async function computeTags(db) {
  const rows = await db
    .prepare(
      `SELECT t.id, t.name,
              COUNT(DISTINCT CASE WHEN q.status = 'published' THEN q.id END) AS usage_count
       FROM tags t
       LEFT JOIN question_tags qt ON qt.tag_id = t.id
       LEFT JOIN questions q ON q.id = qt.question_id
       GROUP BY t.id
       ORDER BY usage_count DESC, LOWER(t.name) ASC`,
    )
    .all();
  return rows.map((row) => ({
    id: publicId(row.id),
    name: row.name,
    usageCount: Number(row.usage_count) || 0,
  }));
}

export async function getTags(db) {
  return loadCached('tags', () => computeTags(db));
}

async function computeHomeBase(db) {
  const questionCount = Number(
    (
      await db
        .prepare(`SELECT COUNT(*) AS count FROM questions WHERE status = 'published'`)
        .get()
    ).count,
  );
  const categoryCount = Number(
    (
      await db
        .prepare(`SELECT COUNT(*) AS count FROM categories WHERE parent_id IS NULL`)
        .get()
    ).count,
  );
  const tagCount = Number(
    (await db.prepare('SELECT COUNT(*) AS count FROM tags').get()).count,
  );
  const categories = (await getCategoryTree(db))
    .slice(0, 6)
    .map((item) => ({
      ...item,
      children: item.children.slice(0, 5),
    }));
  return { questionCount, categoryCount, tagCount, categories };
}

export async function publicHomeSummary(db, user) {
  const base = await loadCached('home', () => computeHomeBase(db));
  let userStats = null;
  if (user) {
    const stats = await db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM answer_records WHERE user_id = ? AND verified = 1) AS attempts,
          (SELECT COUNT(*) FROM user_question_states WHERE user_id = ? AND in_wrong_book = 1) AS wrong,
          (SELECT COUNT(*) FROM user_question_states WHERE user_id = ? AND favorite = 1) AS favorites`,
      )
      .get(user.id, user.id, user.id);
    userStats = {
      attempts: Number(stats.attempts) || 0,
      wrong: Number(stats.wrong) || 0,
      favorites: Number(stats.favorites) || 0,
    };
  }
  return { ...base, userStats };
}
