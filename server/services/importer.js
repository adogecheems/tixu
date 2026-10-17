import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { config } from '../config.js';
import { ApiError, errors } from '../errors.js';
import { nowIso } from '../utils.js';
import {
  fullValidation,
  normalizeDraftInput,
  normalizeOptions,
  normalizeFillAnswer,
} from '../validation.js';
import { detectImage, imageUrl } from './uploads.js';

const pendingImports = new Map();
const IMPORT_TTL_MS = 15 * 60 * 1000;
const MAX_QUESTIONS = 100;
const MAX_ZIP_FILES = 200;

function addError(errorsList, index, title, field, message) {
  errorsList.push({ index, title: title || `第 ${index + 1} 题`, field, message });
}

function parseRoot(buffer) {
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    throw errors.validation('JSON 文件无法解析，请检查文件格式。', [
      { field: 'file', message: 'JSON 语法错误。' },
    ]);
  }
  const questions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(questions)) {
    throw errors.validation('导入文件需要包含 questions 数组。', [
      { field: 'questions', message: '缺少 questions 数组。' },
    ]);
  }
  if (!questions.length) {
    throw errors.validation('导入文件中没有题目。', [
      { field: 'questions', message: '至少需要一道题目。' },
    ]);
  }
  if (questions.length > MAX_QUESTIONS) {
    throw errors.validation(`单次最多导入 ${MAX_QUESTIONS} 道题目。`);
  }
  return questions;
}

function validateAssetPath(entryName) {
  if (typeof entryName !== 'string' || !entryName) return '文件路径为空。';
  if (entryName.includes('\\') || entryName.includes('\0')) return '文件路径包含非法字符。';
  if (entryName.startsWith('/') || /^[A-Za-z]:/.test(entryName)) return '不允许绝对路径。';
  const segments = entryName.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return '文件路径不合法。';
  }
  if (!/^[\p{L}\p{N}._/-]+$/u.test(entryName)) return '文件路径包含不支持的字符。';
  if (entryName !== 'questions.json' && !entryName.startsWith('assets/')) {
    return 'ZIP 中只能包含 questions.json 与 assets/ 目录下的图片。';
  }
  return null;
}

function extractZip(buffer) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw errors.validation('ZIP 文件无法解析。', [{ field: 'file', message: 'ZIP 结构无效。' }]);
  }
  const entries = zip.getEntries();
  if (entries.length > MAX_ZIP_FILES) {
    throw errors.validation(`ZIP 内文件数量不能超过 ${MAX_ZIP_FILES} 个。`);
  }
  let totalUncompressed = 0;
  let actualUncompressed = 0;
  let questionsBuffer = null;
  const assets = new Map();
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;
    const pathError = validateAssetPath(name);
    if (pathError) {
      throw errors.validation(`ZIP 包含不安全的文件路径：${name}`, [
        { field: 'file', message: pathError },
      ]);
    }
    if (entry.header.encrypted) {
      throw errors.validation('不支持加密的 ZIP 文件。');
    }
    const size = Number(entry.header.size) || 0;
    totalUncompressed += size;
    if (totalUncompressed > config.maxImportUncompressedBytes) {
      throw errors.validation('ZIP 解压后体积超过限制。');
    }
    let data;
    try {
      data = entry.getData();
    } catch {
      throw errors.validation(`无法读取 ZIP 内的文件：${name}`);
    }
    actualUncompressed += data.length;
    if (actualUncompressed > config.maxImportUncompressedBytes) {
      throw errors.validation('ZIP 解压后体积超过限制。');
    }
    if (data.length > config.maxUploadBytes && name !== 'questions.json') {
      throw errors.validation(`图片 ${name} 超过大小限制。`);
    }
    if (name === 'questions.json') {
      if (questionsBuffer) throw errors.validation('ZIP 内只能有一个 questions.json。');
      questionsBuffer = data;
      continue;
    }
    const extension = path.posix.extname(name).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(extension)) {
      throw errors.validation(`不支持的图片格式：${name}`);
    }
    const detected = detectImage(data);
    if (!detected) {
      throw errors.validation(`文件不是有效的图片：${name}`);
    }
    if (assets.has(name)) {
      throw errors.validation(`ZIP 内存在重复文件：${name}`);
    }
    assets.set(name, { buffer: data, extension: detected.ext });
  }
  if (!questionsBuffer) {
    throw errors.validation('ZIP 内缺少 questions.json。');
  }
  if (totalUncompressed > config.maxImportUncompressedBytes) {
    throw errors.validation('ZIP 解压后体积超过限制。');
  }
  return { rootBuffer: questionsBuffer, assets };
}

async function buildCategoryIndex(db) {
  const rows = await db.prepare('SELECT id, name, parent_id FROM categories').all();
  const roots = new Map();
  const children = new Map();
  const byId = new Map();
  for (const row of rows) {
    byId.set(row.id, row);
    if (!row.parent_id) {
      roots.set(row.name.toLowerCase(), row);
    } else {
      if (!children.has(row.parent_id)) children.set(row.parent_id, new Map());
      children.get(row.parent_id).set(row.name.toLowerCase(), row);
    }
  }
  return { roots, children, byId };
}

function resolveCategory(index, categoryPath) {
  if (!Array.isArray(categoryPath) || categoryPath.length < 1 || categoryPath.length > 2) {
    return null;
  }
  const root = index.roots.get(String(categoryPath[0]).trim().toLowerCase());
  if (!root) return null;
  if (categoryPath.length === 1) return root;
  const child = index.children
    .get(root.id)
    ?.get(String(categoryPath[1]).trim().toLowerCase());
  return child || null;
}

async function buildTagIndex(db) {
  const map = new Map();
  for (const row of await db.prepare('SELECT id, name FROM tags').all()) {
    map.set(row.name.toLowerCase(), row);
  }
  return map;
}

function normalizeImportAnswer(item, type, errorsList, index, title) {
  const raw = item.answer;
  if (type === 'single') {
    if (typeof raw === 'string') return { optionId: raw };
    return raw && typeof raw === 'object' ? raw : {};
  }
  if (type === 'multiple') {
    if (Array.isArray(raw)) return { optionIds: raw.map(String) };
    return raw && typeof raw === 'object' ? raw : {};
  }
  if (type === 'truefalse') {
    if (typeof raw === 'boolean') return { value: raw };
    if (raw === 'true' || raw === '正确') return { value: true };
    if (raw === 'false' || raw === '错误') return { value: false };
    return raw && typeof raw === 'object' ? raw : {};
  }
  if (type === 'fill') {
    let rawBlanks = Array.isArray(raw) ? raw : raw?.blanks;
    if (!Array.isArray(rawBlanks)) {
      addError(errorsList, index, title, 'answer', '填空题答案需要是按空排列的数组。');
      rawBlanks = [];
    }
    const answers = rawBlanks.map((value) =>
      Array.isArray(value) ? value.map(String) : [String(value ?? '')],
    );
    const rawConfig = item.judgeConfig && typeof item.judgeConfig === 'object' ? item.judgeConfig : {};
    const configBlanks = Array.isArray(rawConfig.blanks) ? [...rawConfig.blanks] : [];
    while (configBlanks.length < answers.length) {
      configBlanks.push({ placeholder: `第 ${configBlanks.length + 1} 空` });
    }
    return {
      answer: { blanks: answers },
      judgeConfig: {
        blanks: configBlanks.slice(0, Math.max(configBlanks.length, answers.length)).map((blank, blankIndex) => ({
          placeholder:
            (typeof blank === 'string' ? blank : blank?.placeholder) || `第 ${blankIndex + 1} 空`,
        })),
        caseSensitive: Boolean(rawConfig.caseSensitive),
        trimWhitespace: rawConfig.trimWhitespace !== false,
        collapseWhitespace: Boolean(rawConfig.collapseWhitespace),
      },
    };
  }
  if (type === 'essay') {
    if (typeof raw === 'string') return { referenceMarkdown: raw };
    return raw && typeof raw === 'object' ? raw : {};
  }
  return {};
}

function collectMarkdownFields(draft) {
  return [
    { field: 'stemMarkdown', value: draft.stemMarkdown, set: (value) => (draft.stemMarkdown = value) },
    {
      field: 'analysisMarkdown',
      value: draft.analysisMarkdown,
      set: (value) => (draft.analysisMarkdown = value),
    },
    ...draft.options.map((option, optionIndex) => ({
      field: `options.${optionIndex}.text`,
      value: option.text,
      set: (value) => (draft.options[optionIndex].text = value),
    })),
    ...(typeof draft.answer?.referenceMarkdown === 'string'
      ? [
          {
            field: 'answer.referenceMarkdown',
            value: draft.answer.referenceMarkdown,
            set: (value) => (draft.answer.referenceMarkdown = value),
          },
        ]
      : []),
  ];
}

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

function prepareAssetUrls(drafts, assets, errorsList) {
  const referenced = new Map();
  for (const { draft, index, title } of drafts) {
    for (const field of collectMarkdownFields(draft)) {
      if (!field.value) continue;
      const replaced = field.value.replace(MARKDOWN_IMAGE_RE, (full, alt, rawTarget) => {
        const target = String(rawTarget).replace(/^<|>$/g, '');
        if (/^https?:\/\//i.test(target)) return full;
        if (target.startsWith('/uploads/')) return full;
        if (!target.startsWith('assets/')) {
          addError(
            errorsList,
            index,
            title,
            field.field,
            `图片路径 ${target} 不合法，只能引用 ZIP 内的 assets/ 图片。`,
          );
          return full;
        }
        const asset = assets.get(target);
        if (!asset) {
          addError(
            errorsList,
            index,
            title,
            field.field,
            `找不到图片资源 ${target}。`,
          );
          return full;
        }
        if (!referenced.has(target)) {
          referenced.set(target, {
            ...asset,
            filename: `${crypto.randomUUID()}.${asset.extension}`,
          });
        }
        const replacement = imageUrl(referenced.get(target).filename);
        return `![${alt}](${replacement})`;
      });
      field.set(replaced);
    }
  }
  return referenced;
}

async function persistAssets(referenced) {
  const files = [];
  await fs.mkdir(config.uploadDir, { recursive: true });
  try {
    for (const asset of referenced.values()) {
      await fs.writeFile(path.join(config.uploadDir, asset.filename), asset.buffer, { flag: 'wx' });
      files.push(asset.filename);
    }
  } catch (error) {
    await removeFiles(files);
    throw error;
  }
  return files;
}

async function removeFiles(files) {
  for (const filename of files) {
    try {
      await fs.unlink(path.join(config.uploadDir, filename));
    } catch {
      // Ignore cleanup errors.
    }
  }
}

function cleanupToken(token, { removeAssets = true } = {}) {
  const record = pendingImports.get(token);
  if (!record) return;
  pendingImports.delete(token);
  if (record.timer) clearTimeout(record.timer);
  if (removeAssets) removeFiles(record.files).catch(() => {});
}

export async function previewImport(db, admin, buffer, originalFilename) {
  if (!buffer?.length) throw errors.validation('请选择需要导入的文件。');
  if (buffer.length > config.maxImportBytes) {
    throw errors.validation(`导入文件不能超过 ${Math.round(config.maxImportBytes / 1024 / 1024)}MB。`);
  }
  const extension = path.extname(String(originalFilename || '')).toLowerCase();
  if (!['.json', '.zip'].includes(extension)) {
    throw errors.validation('仅支持 .json 或 .zip 文件。');
  }

  const { rootBuffer, assets } = extension === '.zip'
    ? extractZip(buffer)
    : { rootBuffer: buffer, assets: new Map() };
  const rawQuestions = parseRoot(rootBuffer);
  const [categories, tagIndex] = await Promise.all([
    buildCategoryIndex(db),
    buildTagIndex(db),
  ]);
  const errorsList = [];
  const drafts = [];

  rawQuestions.forEach((item, index) => {
    const title = typeof item?.title === 'string' ? item.title.slice(0, 200) : '';
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      addError(errorsList, index, title, 'question', '题目必须是 JSON 对象。');
      return;
    }
    const type = ['single', 'multiple', 'truefalse', 'fill', 'essay'].includes(item.type)
      ? item.type
      : 'single';
    if (!['single', 'multiple', 'truefalse', 'fill', 'essay'].includes(item.type)) {
      addError(errorsList, index, title, 'type', '题型必须是 single、multiple、truefalse、fill 或 essay。');
    }
    const categoryPath = Array.isArray(item.categoryPath)
      ? item.categoryPath.map((value) => String(value))
      : [];
    const category = resolveCategory(categories, categoryPath);
    if (!category) {
      addError(
        errorsList,
        index,
        title,
        'categoryPath',
        `分类路径 ${categoryPath.join(' / ') || '（空）'} 不存在，导入不会自动创建分类。`,
      );
    }
    const tagNames = Array.isArray(item.tags) ? item.tags.map((value) => String(value)) : [];
    const tagIds = [];
    for (const tagName of tagNames) {
      const tag = tagIndex.get(tagName.toLowerCase());
      if (!tag) {
        addError(errorsList, index, title, 'tags', `标签「${tagName}」不存在，导入不会自动创建标签。`);
      } else if (!tagIds.includes(String(tag.id))) {
        tagIds.push(String(tag.id));
      }
    }
    if (typeof item.stem !== 'string' && typeof item.stemMarkdown !== 'string') {
      addError(errorsList, index, title, 'stem', '缺少题干内容 stem。');
    }
    if (typeof item.title !== 'string' || !item.title.trim()) {
      addError(errorsList, index, title, 'title', '缺少题目标题。');
    }

    const options = normalizeOptions(
      Array.isArray(item.options)
        ? item.options.map((option) =>
            typeof option === 'string' ? { text: option } : option,
          )
        : [],
    );
    const answerResult = normalizeImportAnswer(item, type, errorsList, index, title);
    let answer = answerResult;
    let judgeConfig = item.judgeConfig && typeof item.judgeConfig === 'object' ? item.judgeConfig : {};
    if (type === 'fill' && answerResult && typeof answerResult === 'object' && answerResult.answer) {
      answer = answerResult.answer;
      judgeConfig = answerResult.judgeConfig;
    }

    const normalized = normalizeDraftInput({
      title: item.title,
      stemMarkdown: item.stemMarkdown ?? item.stem,
      type,
      difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : 'medium',
      categoryId: category ? String(category.id) : null,
      options,
      answer,
      judgeConfig,
      analysisMarkdown: item.analysisMarkdown ?? item.analysis,
      tagIds,
      sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : index,
    });
    // Store metadata only for the preview/error report; it is not written to the DB.
    const resolvedPath = category
      ? category.parent_id
        ? [categories.byId.get(category.parent_id)?.name, category.name].filter(Boolean)
        : [category.name]
      : categoryPath;
    drafts.push({
      index,
      title: normalized.title,
      categoryPath: resolvedPath,
      tagNames: tagIds.map((id) => {
        const found = [...tagIndex.values()].find((tag) => String(tag.id) === id);
        return found?.name || id;
      }),
      draft: normalized,
    });
  });

  if (errorsList.length) {
    throw new ApiError(
      422,
      'IMPORT_VALIDATION_FAILED',
      '导入文件未通过校验，整批题目均未创建。',
      errorsList.slice(0, 100),
    );
  }

  const referenced = prepareAssetUrls(drafts, assets, errorsList);
  if (errorsList.length) {
    throw new ApiError(
      422,
      'IMPORT_VALIDATION_FAILED',
      '导入文件引用的图片资源有误，整批题目均未创建。',
      errorsList.slice(0, 100),
    );
  }

  for (const entry of drafts) {
    try {
      await fullValidation(db, entry.draft);
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        for (const detail of error.details) {
          addError(errorsList, entry.index, entry.title, detail.field, detail.message);
        }
      } else {
        throw error;
      }
    }
  }
  if (errorsList.length) {
    throw new ApiError(
      422,
      'IMPORT_VALIDATION_FAILED',
      '导入题目内容未通过发布级校验，整批题目均未创建。',
      errorsList.slice(0, 100),
    );
  }

  const files = await persistAssets(referenced);
  const token = crypto.randomBytes(24).toString('base64url');
  const timer = setTimeout(() => {
    cleanupToken(token, { removeAssets: true });
  }, IMPORT_TTL_MS);
  timer.unref?.();
  pendingImports.set(token, {
    token,
    adminId: admin.id,
    createdAt: nowIso(),
    expiresAt: Date.now() + IMPORT_TTL_MS,
    drafts: drafts.map((entry) => ({ ...entry, draft: entry.draft })),
    files,
    timer,
  });

  return {
    token,
    expiresInSeconds: Math.floor(IMPORT_TTL_MS / 1000),
    summary: {
      total: drafts.length,
      imageCount: files.length,
      filename: path.basename(String(originalFilename || '')),
    },
    items: drafts.map((entry) => ({
      index: entry.index,
      title: entry.draft.title,
      type: entry.draft.type,
      difficulty: entry.draft.difficulty,
      categoryPath: entry.categoryPath,
      tags: entry.tagNames,
      stemMarkdown: entry.draft.stemMarkdown,
      analysisMarkdown: entry.draft.analysisMarkdown,
      options: entry.draft.options,
      answer: entry.draft.answer,
      judgeConfig: entry.draft.judgeConfig,
    })),
  };
}

export async function confirmImport(db, admin, token) {
  const cleanToken = String(token || '');
  const record = pendingImports.get(cleanToken);
  if (!record) {
    throw errors.notFound('导入预览已失效，请重新上传文件。', 'IMPORT_TOKEN_EXPIRED');
  }
  if (record.adminId !== admin.id) throw errors.forbidden('无权确认这次导入。');
  if (Date.now() > record.expiresAt) {
    cleanupToken(cleanToken, { removeAssets: true });
    throw new ApiError(410, 'IMPORT_TOKEN_EXPIRED', '导入预览已失效，请重新上传文件。');
  }

  const result = await db.transaction(async () => {
    const now = nowIso();
    const questionIds = [];
    for (const entry of record.drafts) {
      const draft = entry.draft;
      const question = await db
        .prepare(
          `INSERT INTO questions
            (status, category_id, sort_order, created_at, updated_at, created_by)
           VALUES ('draft', ?, ?, ?, ?, ?)
           RETURNING id`,
        )
        .get(draft.categoryId, draft.sortOrder, now, now, admin.id);
      const questionId = question.id;
      await db
        .prepare(
          `INSERT INTO question_drafts
            (question_id, title, stem_markdown, question_type, difficulty, category_id,
             options_json, answer_json, judge_config_json, analysis_markdown, tags_json,
             sort_order, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          questionId,
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
          admin.id,
        );
      questionIds.push(String(questionId));
    }
    return {
      importedCount: questionIds.length,
      questionIds,
      titles: record.drafts.map((entry) => entry.draft.title),
    };
  });

  cleanupToken(cleanToken, { removeAssets: false });
  return result;
}

export function cancelImport(token, admin) {
  const record = pendingImports.get(String(token || ''));
  if (!record) return { cancelled: false };
  if (record.adminId !== admin.id) throw errors.forbidden('无权取消这次导入。');
  cleanupToken(String(token), { removeAssets: true });
  return { cancelled: true };
}

export { normalizeFillAnswer };
