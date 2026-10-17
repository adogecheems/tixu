export const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  truefalse: '判断题',
  fill: '填空题',
  essay: '简答题',
};

export const TYPE_SHORT = {
  single: '单选',
  multiple: '多选',
  truefalse: '判断',
  fill: '填空',
  essay: '简答',
};

export const DIFFICULTY_LABELS = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export const DIFFICULTY_RANK = { easy: 1, medium: 2, hard: 3 };

export const SORT_OPTIONS = [
  { value: 'default', label: '默认顺序' },
  { value: 'newest', label: '最新发布' },
  { value: 'difficulty_asc', label: '难度从低到高' },
  { value: 'difficulty_desc', label: '难度从高到低' },
];

export function typeLabel(type) {
  return TYPE_LABELS[type] || '题目';
}

export function typeShort(type) {
  return TYPE_SHORT[type] || '题目';
}

export function difficultyLabel(difficulty) {
  return DIFFICULTY_LABELS[difficulty] || '未设置';
}

export function categoryPath(category) {
  if (!category) return '未分类';
  return category.parent ? `${category.parent.name} / ${category.name}` : category.name;
}

export function categoryName(category) {
  return category?.name || '未分类';
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatRelative(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  if (absolute < 60) return '刚刚';
  if (absolute < 3600) return `${Math.round(absolute / 60)} 分钟前`;
  if (absolute < 86400) return `${Math.round(absolute / 3600)} 小时前`;
  if (absolute < 86400 * 7) return `${Math.round(absolute / 86400)} 天前`;
  return formatDate(value);
}

export function formatNumber(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('zh-CN').format(number);
}

export function initials(username) {
  const text = String(username || '?').trim();
  return text.slice(0, 1).toUpperCase();
}

export function defaultAnswerFor(question) {
  if (!question) return {};
  if (question.type === 'single') return { optionId: null };
  if (question.type === 'multiple') return { optionIds: [] };
  if (question.type === 'truefalse') return { value: null };
  if (question.type === 'fill') {
    const count = question.fillConfig?.blanks?.length || question.judgeConfig?.blanks?.length || 1;
    return { blanks: Array.from({ length: count }, () => '') };
  }
  if (question.type === 'essay') return { text: '' };
  return {};
}

export function isEmptyAnswer(answer) {
  if (!answer) return true;
  if (Array.isArray(answer)) return answer.length === 0;
  if (typeof answer === 'string') return !answer.trim();
  return Object.keys(answer).length === 0;
}

export function isAnswerComplete(question, answer) {
  if (!question || !answer) return false;
  if (question.type === 'single') return Boolean(answer.optionId);
  if (question.type === 'multiple') return Array.isArray(answer.optionIds) && answer.optionIds.length > 0;
  if (question.type === 'truefalse') return typeof answer.value === 'boolean';
  if (question.type === 'fill') {
    const count = question.fillConfig?.blanks?.length || 1;
    return (
      Array.isArray(answer.blanks) &&
      answer.blanks.length === count &&
      answer.blanks.every((value) => String(value ?? '').trim().length > 0)
    );
  }
  if (question.type === 'essay') return String(answer.text || '').trim().length > 0;
  return false;
}

export function answerText(type, answer, question = null) {
  if (!answer) return '';
  if (type === 'single') {
    const option = question?.options?.find((item) => item.id === answer.optionId);
    return option ? `${option.id}. ${plainOption(option.text)}` : answer.optionId || '';
  }
  if (type === 'multiple') {
    const ids = answer.optionIds || [];
    if (!question?.options) return ids.join('、');
    return ids
      .map((id) => {
        const option = question.options.find((item) => item.id === id);
        return option ? `${option.id}. ${plainOption(option.text)}` : id;
      })
      .join('；');
  }
  if (type === 'truefalse') {
    if (answer.value === true) return '正确';
    if (answer.value === false) return '错误';
    return '未选择';
  }
  if (type === 'fill') {
    return (answer.blanks || [])
      .map((value, index) => `第 ${index + 1} 空：${String(value || '（空）')}`)
      .join(' · ');
  }
  if (type === 'essay') return String(answer.text || '');
  return '';
}

export function correctAnswerText(type, answer, question = null) {
  if (!answer) return '';
  if (type === 'single') {
    const option = question?.options?.find((item) => item.id === answer.optionId);
    return option ? `${option.id}. ${plainOption(option.text)}` : String(answer.optionId || '');
  }
  if (type === 'multiple') {
    return (answer.optionIds || [])
      .map((id) => {
        const option = question?.options?.find((item) => item.id === id);
        return option ? `${id}. ${plainOption(option.text)}` : id;
      })
      .join('；');
  }
  if (type === 'truefalse') return answer.value === true ? '正确' : '错误';
  if (type === 'fill') {
    return (answer.blanks || [])
      .map((accepted, index) => `第 ${index + 1} 空：${(accepted || []).join(' / ')}`)
      .join(' · ');
  }
  if (type === 'essay') return String(answer.referenceMarkdown || '');
  return '';
}

export function plainOption(value) {
  return String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[图片]')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resultMeta(item) {
  if (!item.verified) {
    return { label: '未验证', tone: 'warning', icon: 'help' };
  }
  if (item.selfAssessment === 'mastered') return { label: '自评已掌握', tone: 'success', icon: 'check' };
  if (item.selfAssessment === 'not_mastered') return { label: '自评未掌握', tone: 'danger', icon: 'x' };
  if (item.type === 'essay' && item.isCorrect === null && item.selfAssessment === null) {
    return { label: '待自评', tone: 'warning', icon: 'clock' };
  }
  if (item.isCorrect === true) return { label: '回答正确', tone: 'success', icon: 'check' };
  if (item.isCorrect === false) return { label: '回答错误', tone: 'danger', icon: 'x' };
  return { label: '已记录', tone: 'neutral', icon: 'dot' };
}

export function clampPage(value, totalPages) {
  const page = Number.parseInt(value, 10) || 1;
  return Math.min(Math.max(1, totalPages || 1), Math.max(1, page));
}

export function previewQuestionFromDraft(form) {
  const blanks = Array.isArray(form.judgeConfig?.blanks) ? form.judgeConfig.blanks : [];
  return {
    id: 'preview',
    title: form.title,
    stemMarkdown: form.stemMarkdown,
    type: form.type,
    difficulty: form.difficulty,
    options: form.options || [],
    fillConfig: form.type === 'fill' ? { blanks } : null,
    category: null,
    tags: [],
  };
}

export function compactNumber(value) {
  const number = Number(value) || 0;
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)} 万`;
  return formatNumber(number);
}

export function weekdayShort(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
}
