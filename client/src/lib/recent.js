const RECENT_PREFIX = 'tixu.recent.';
const MAX_RECENT = 5;

function storageKey(user) {
  return `${RECENT_PREFIX}${user ? `user:${user.id}` : 'guest'}`;
}

export function getRecentViewed(user) {
  try {
    const raw = localStorage.getItem(storageKey(user));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function recordRecentViewed(user, question) {
  if (!question?.id) return;
  try {
    const current = getRecentViewed(user).filter((item) => String(item.id) !== String(question.id));
    const next = [
      {
        id: String(question.id),
        title: question.title || '未命名题目',
        type: question.type,
        difficulty: question.difficulty,
        category: question.category || null,
        viewedAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, MAX_RECENT);
    localStorage.setItem(storageKey(user), JSON.stringify(next));
  } catch {
    // Recent history is a convenience only.
  }
}
