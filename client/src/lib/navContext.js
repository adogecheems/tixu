const NAV_PREFIX = 'tixu.nav.';
const MAX_CONTEXTS = 12;

function safeSession() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function pruneContexts() {
  const storage = safeSession();
  if (!storage) return;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(NAV_PREFIX)) keys.push(key);
  }
  while (keys.length > MAX_CONTEXTS) {
    const oldest = keys.shift();
    storage.removeItem(oldest);
  }
}

export function createNavigationContext({ ids, source, label }) {
  const storage = safeSession();
  if (!storage || !Array.isArray(ids) || !ids.length) return null;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = {
    id,
    ids: ids.map(String),
    source: source || '题库',
    label: label || source || '题库',
    createdAt: new Date().toISOString(),
  };
  try {
    storage.setItem(`${NAV_PREFIX}${id}`, JSON.stringify(payload));
    pruneContexts();
    return id;
  } catch {
    return null;
  }
}

export function readNavigationContext(id) {
  if (!id) return null;
  const storage = safeSession();
  if (!storage) return null;
  try {
    const raw = storage.getItem(`${NAV_PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.ids)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function navigationContextQuery(contextId) {
  return contextId ? { ctx: contextId } : {};
}

export async function openQuestionWithContext(router, questionId, { ids, source, label } = {}) {
  if (!ids || !ids.length) {
    return router.push({ name: 'question', params: { id: String(questionId) } });
  }
  const contextId = createNavigationContext({ ids, source, label });
  return router.push({
    name: 'question',
    params: { id: String(questionId) },
    query: contextId ? { ctx: contextId } : {},
  });
}
