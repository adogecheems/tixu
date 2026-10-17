import MarkdownIt from 'markdown-it';
import katex from 'katex';

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function renderKatex(expression, displayMode = false) {
  try {
    return katex.renderToString(expression, {
      displayMode,
      throwOnError: false,
      trust: false,
      strict: 'ignore',
      output: 'html',
    });
  } catch (error) {
    return `<code class="katex-error">${escapeHtml(expression || error.message)}</code>`;
  }
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: true,
});

// Inline math: $...$
md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
  const start = state.pos;
  if (state.src[start] !== '$' || state.src[start + 1] === '$') return false;
  if (state.src[start + 1] === undefined || /\s/.test(state.src[start + 1])) return false;
  let cursor = start + 1;
  let content = '';
  while (cursor < state.src.length) {
    const char = state.src[cursor];
    if (char === '\\' && state.src[cursor + 1] === '$') {
      content += '$';
      cursor += 2;
      continue;
    }
    if (char === '$') {
      if (content && !/\s$/.test(content) && !/[0-9]/.test(state.src[cursor + 1] || '')) {
        if (!silent) {
          const token = state.push('html_inline', '', 0);
          token.content = renderKatex(content, false);
        }
        state.pos = cursor + 1;
        return true;
      }
      return false;
    }
    content += char;
    cursor += 1;
  }
  return false;
});

// Block math: $$...$$
md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const line = state.src.slice(start, max).trim();
  if (!line.startsWith('$$')) return false;
  let content = line.slice(2);
  let nextLine = startLine;
  if (content.endsWith('$$') && content.length > 2) {
    content = content.slice(0, -2);
    if (!silent) {
      const token = state.push('html_block', '', 0);
      token.map = [startLine, startLine + 1];
      token.content = `<div class="math-block">${renderKatex(content.trim(), true)}</div>`;
    }
    state.line = startLine + 1;
    return true;
  }
  content = content ? `${content}\n` : '';
  while (++nextLine < endLine) {
    const begin = state.bMarks[nextLine] + state.tShift[nextLine];
    const end = state.eMarks[nextLine];
    const current = state.src.slice(begin, end);
    if (current.trim().endsWith('$$')) {
      const closingIndex = current.lastIndexOf('$$');
      content += current.slice(0, closingIndex);
      if (!silent) {
        const token = state.push('html_block', '', 0);
        token.map = [startLine, nextLine + 1];
        token.content = `<div class="math-block">${renderKatex(content.trim(), true)}</div>`;
      }
      state.line = nextLine + 1;
      return true;
    }
    content += `${current}\n`;
  }
  return false;
});

const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = token.attrGet('href') || '';
  if (/^https?:\/\//i.test(href)) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const defaultImage =
  md.renderer.rules.image ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  token.attrSet('loading', 'lazy');
  token.attrSet('decoding', 'async');
  token.attrSet('class', 'md-image');
  const src = token.attrGet('src');
  if (src && !/^(https?:|data:|\/uploads\/|\/)/i.test(src)) {
    // Relative images are intentionally unsupported in demo content. Keep the
    // link inert until it is replaced by an uploaded asset.
    token.attrSet('title', '图片资源不可用');
  }
  return defaultImage(tokens, idx, options, env, self);
};

const cache = new Map();

export function renderMarkdown(source) {
  const content = String(source || '');
  if (!content.trim()) return '';
  if (cache.has(content)) return cache.get(content);
  const rendered = md.render(content);
  cache.set(content, rendered);
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  return rendered;
}

export function renderMarkdownInline(source) {
  return md.renderInline(String(source || ''));
}
