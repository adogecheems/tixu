import { ApiError } from './errors.js';
import { QUESTION_TYPES, DIFFICULTIES, clampInt, uniqueStrings } from './utils.js';

const TYPE_SET = new Set(QUESTION_TYPES);
const DIFFICULTY_SET = new Set(DIFFICULTIES);

function text(value, max = 20000) {
  return String(value ?? '').slice(0, max);
}

function normalizeOptionId(value, index) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (/^[A-Z0-9]{1,4}$/.test(raw)) return raw;
  return String.fromCharCode(65 + index);
}

export function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions.slice(0, 20).map((option, index) => {
    const item = option && typeof option === 'object' ? option : { text: option };
    return {
      id: normalizeOptionId(item.id, index),
      text: text(item.text, 8000),
    };
  });
}

export function normalizeDraftInput(body = {}) {
  const input = body && typeof body === 'object' ? body : {};
  const type = TYPE_SET.has(input.type) ? input.type : 'single';
  const difficulty = DIFFICULTY_SET.has(input.difficulty) ? input.difficulty : 'medium';
  const options = ['single', 'multiple'].includes(type) ? normalizeOptions(input.options) : [];
  const answer = input.answer && typeof input.answer === 'object' ? input.answer : {};
  const judgeConfig = input.judgeConfig && typeof input.judgeConfig === 'object' ? input.judgeConfig : {};

  let categoryId = input.categoryId;
  categoryId =
    categoryId === null || categoryId === undefined || categoryId === ''
      ? null
      : Number.parseInt(String(categoryId), 10) || null;

  return {
    title: text(input.title, 200),
    stemMarkdown: text(input.stemMarkdown ?? input.stem, 100000),
    type,
    difficulty,
    categoryId,
    options,
    answer,
    judgeConfig,
    analysisMarkdown: text(input.analysisMarkdown ?? input.analysis, 100000),
    tagIds: uniqueStrings(Array.isArray(input.tagIds) ? input.tagIds : []).slice(0, 30),
    sortOrder: clampInt(input.sortOrder, -99999, 99999, 0),
  };
}

export async function assertCategory(db, categoryId) {
  if (!categoryId) return null;
  const category = await db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  if (!category) {
    throw new ApiError(422, 'VALIDATION_FAILED', '所选分类不存在。', [
      { field: 'categoryId', message: '分类不存在。' },
    ]);
  }
  if (category.parent_id) {
    const parent = await db
      .prepare('SELECT id, parent_id FROM categories WHERE id = ?')
      .get(category.parent_id);
    if (!parent) {
      throw new ApiError(422, 'VALIDATION_FAILED', '分类层级异常。', [
        { field: 'categoryId', message: '分类层级异常。' },
      ]);
    }
  }
  return category;
}

export async function assertTags(db, tagIds) {
  if (!tagIds.length) return [];
  const placeholders = tagIds.map(() => '?').join(',');
  const rows = await db
    .prepare(`SELECT * FROM tags WHERE id IN (${placeholders})`)
    .all(...tagIds.map(Number));
  if (rows.length !== tagIds.length) {
    throw new ApiError(422, 'VALIDATION_FAILED', '含有不存在的标签。', [
      { field: 'tagIds', message: '部分标签不存在。' },
    ]);
  }
  return rows;
}

function normalizeAcceptedAnswers(values) {
  if (!Array.isArray(values)) return [];
  return uniqueStrings(values.map((value) => text(value, 1000)).filter((value) => value.length > 0));
}

export function normalizeFillAnswer(rawAnswer, blankCount) {
  const blanks = Array.isArray(rawAnswer?.blanks) ? rawAnswer.blanks : [];
  return Array.from({ length: blankCount }, (_, index) => normalizeAcceptedAnswers(blanks[index]));
}

export async function fullValidation(db, draft) {
  const errors = [];
  const push = (field, message) => errors.push({ field, message });

  if (!draft.title.trim()) push('title', '请填写题目标题。');
  if (draft.title.length > 200) push('title', '标题不能超过 200 个字符。');
  if (!draft.stemMarkdown.trim()) push('stemMarkdown', '请填写题干内容。');
  if (!draft.categoryId) push('categoryId', '请选择题目分类。');

  if (draft.categoryId) {
    const category = await db
      .prepare('SELECT * FROM categories WHERE id = ?')
      .get(draft.categoryId);
    if (!category) push('categoryId', '所选分类不存在。');
    else if (category.parent_id) {
      const grandparent = await db
        .prepare('SELECT parent_id FROM categories WHERE id = ?')
        .get(category.parent_id);
      if (!grandparent || grandparent.parent_id) push('categoryId', '分类最多只能有两级。');
    }
  }

  const optionIds = draft.options.map((option) => option.id);
  if (new Set(optionIds).size !== optionIds.length) push('options', '选项标识不能重复。');

  if (draft.type === 'single') {
    if (draft.options.length < 2) push('options', '单选题至少需要两个选项。');
    if (draft.options.some((option) => !option.text.trim())) push('options', '选项内容不能为空。');
    if (!draft.answer?.optionId || !optionIds.includes(String(draft.answer.optionId))) {
      push('answer', '请选择一个正确选项。');
    }
  }

  if (draft.type === 'multiple') {
    if (draft.options.length < 2) push('options', '多选题至少需要两个选项。');
    if (draft.options.some((option) => !option.text.trim())) push('options', '选项内容不能为空。');
    const selected = Array.isArray(draft.answer?.optionIds)
      ? uniqueStrings(draft.answer.optionIds.map(String))
      : [];
    if (!selected.length) push('answer', '请至少选择一个正确选项。');
    if (selected.some((id) => !optionIds.includes(id))) push('answer', '正确答案包含无效选项。');
  }

  if (draft.type === 'truefalse') {
    if (typeof draft.answer?.value !== 'boolean') push('answer', '请选择判断题的正确答案。');
  }

  if (draft.type === 'fill') {
    const configBlanks = Array.isArray(draft.judgeConfig?.blanks) ? draft.judgeConfig.blanks : [];
    if (configBlanks.length < 1) push('judgeConfig', '填空题至少需要一个空。');
    if (configBlanks.length > 10) push('judgeConfig', '填空题最多支持十个空。');
    const normalizedAnswer = normalizeFillAnswer(draft.answer, configBlanks.length);
    if (normalizedAnswer.some((accepted) => accepted.length === 0)) {
      push('answer', '每个空都需要至少一个可接受答案。');
    }
  }

  if (draft.type === 'essay') {
    if (!String(draft.answer?.referenceMarkdown || '').trim()) {
      push('answer', '请填写简答题参考答案。');
    }
  }

  if (draft.tagIds.length) {
    const placeholders = draft.tagIds.map(() => '?').join(',');
    const count = (
      await db
        .prepare(`SELECT COUNT(*) AS count FROM tags WHERE id IN (${placeholders})`)
        .get(...draft.tagIds.map(Number))
    ).count;
    if (Number(count) !== draft.tagIds.length) push('tagIds', '部分标签不存在。');
  }

  if (errors.length) {
    throw new ApiError(422, 'VALIDATION_FAILED', '题目内容尚未通过发布校验。', errors);
  }
  return true;
}

export function buildStoredAnswer(draft) {
  if (draft.type === 'single') {
    return { optionId: String(draft.answer.optionId) };
  }
  if (draft.type === 'multiple') {
    return { optionIds: uniqueStrings((draft.answer.optionIds || []).map(String)).sort() };
  }
  if (draft.type === 'truefalse') {
    return { value: Boolean(draft.answer.value) };
  }
  if (draft.type === 'fill') {
    const blankCount = Array.isArray(draft.judgeConfig?.blanks) ? draft.judgeConfig.blanks.length : 1;
    return { blanks: normalizeFillAnswer(draft.answer, blankCount) };
  }
  return { referenceMarkdown: String(draft.answer?.referenceMarkdown || '') };
}

export function buildStoredJudgeConfig(draft) {
  if (draft.type !== 'fill') return {};
  const configBlanks = Array.isArray(draft.judgeConfig?.blanks) ? draft.judgeConfig.blanks : [];
  return {
    blankCount: configBlanks.length,
    blanks: configBlanks.map((blank, index) => ({
      placeholder: text(blank?.placeholder, 80) || `第 ${index + 1} 空`,
    })),
    caseSensitive: Boolean(draft.judgeConfig?.caseSensitive),
    trimWhitespace: draft.judgeConfig?.trimWhitespace !== false,
    collapseWhitespace: Boolean(draft.judgeConfig?.collapseWhitespace),
  };
}

export function publicFillConfig(judgeConfig) {
  const config = judgeConfig && typeof judgeConfig === 'object' ? judgeConfig : {};
  return {
    blanks: Array.isArray(config.blanks) ? config.blanks : [],
    caseSensitive: Boolean(config.caseSensitive),
    trimWhitespace: config.trimWhitespace !== false,
    collapseWhitespace: Boolean(config.collapseWhitespace),
  };
}
