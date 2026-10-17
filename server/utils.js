import crypto from 'node:crypto';
import { ApiError } from './errors.js';

export const QUESTION_TYPES = ['single', 'multiple', 'truefalse', 'fill', 'essay'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

export const difficultyRank = { easy: 1, medium: 2, hard: 3 };

export function nowIso() {
  return new Date().toISOString();
}

export function publicId(value) {
  return value === null || value === undefined ? null : String(value);
}

export function parseId(value, field = 'id') {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) {
    throw new ApiError(400, 'INVALID_ID', `无效的 ${field}。`);
  }
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new ApiError(400, 'INVALID_ID', `无效的 ${field}。`);
  }
  return number;
}

export function optionalParseId(value, field = 'id') {
  if (value === undefined || value === null || value === '') return null;
  return parseId(value, field);
}

export function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((v) => String(v)).filter(Boolean))];
}

export function todayStartIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

const LATEX_PLAIN_WORDS = {
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', log: 'log', ln: 'ln', lim: 'lim',
  max: 'max', min: 'min', det: 'det', rank: 'rank', limsup: 'lim sup', liminf: 'lim inf',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ',
  lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', phi: 'φ', omega: 'ω',
  int: '∫', iint: '∬', iiint: '∭', sum: 'Σ', prod: 'Π', infty: '∞',
  partial: '∂', sqrt: '√', cdot: '·', times: '×', le: '≤', ge: '≥', ne: '≠', to: '→',
  mid: '|', vert: '|', Vert: '‖', ldots: '…', dots: '…', cdots: '⋯',
  cap: '∩', cup: '∪', in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆',
};

function latexToPlain(expression) {
  return String(expression || '')
    .replace(/\\(?:frac|dfrac|tfrac)\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\begin\{[pbvB]?matrix\}/g, '[')
    .replace(/\\end\{[pbvB]?matrix\}/g, ']')
    .replace(/\\begin\{array\}\{[^}]*\}/g, '[')
    .replace(/\\end\{array\}/g, ']')
    .replace(/\\begin\{[^}]+\}/g, ' ')
    .replace(/\\end\{[^}]+\}/g, ' ')
    .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|operatorname\*)\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:left|right|big|Big|bigl|bigr|Bigl|Bigr)/g, '')
    .replace(/\\(?:quad|qquad|[,;:! ])/g, ' ')
    .replace(/\\\\/g, '; ')
    .replace(/&/g, ' ')
    .replace(/\\([a-zA-Z]+)/g, (_, word) => LATEX_PLAIN_WORDS[word] ?? ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripMarkdown(input, maxLength = 160) {
  let text = String(input || '');
  text = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, expression) => ` ${latexToPlain(expression)} `)
    .replace(/\$([^$\n]+)\$/g, (_, expression) => ` ${latexToPlain(expression)} `)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]*#{1,6}\s+/gm, '')
    .replace(/^[ \t]*[-+*]\s+/gm, '')
    .replace(/[>*~`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > maxLength) text = `${text.slice(0, maxLength).trim()}…`;
  return text;
}

export function safeJsonStringify(value) {
  return JSON.stringify(value ?? null);
}

export function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
