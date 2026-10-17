const DB_NAME = 'tixu-local';
const DB_VERSION = 1;
const ATTEMPTS = 'guestAttempts';
const FAVORITES = 'guestFavorites';
const DRAFTS = 'drafts';

let dbPromise = null;

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持本地存储。'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTEMPTS)) {
        const store = db.createObjectStore(ATTEMPTS, { keyPath: 'clientEventId' });
        store.createIndex('questionId', 'questionId', { unique: false });
        store.createIndex('submittedAt', 'submittedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(FAVORITES)) {
        db.createObjectStore(FAVORITES, { keyPath: 'questionId' });
      }
      if (!db.objectStoreNames.contains(DRAFTS)) {
        const store = db.createObjectStore(DRAFTS, { keyPath: 'key' });
        store.createIndex('namespace', 'namespace', { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('无法打开本地存储。'));
    request.onblocked = () => reject(new Error('本地存储正在被其他页面占用，请关闭其他页面后重试。'));
  });
  return dbPromise;
}

function requestDone(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('本地数据写入被中止。'));
  });
}

async function allFromStore(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  return requestDone(tx.objectStore(storeName).getAll());
}

export async function getGuestAttempts() {
  const attempts = await allFromStore(ATTEMPTS);
  return attempts.sort((a, b) => {
    const time = String(a.submittedAt).localeCompare(String(b.submittedAt));
    return time || String(a.clientEventId).localeCompare(String(b.clientEventId));
  });
}

function plainClone(value) {
  // Vue reactive proxies cannot be structured-cloned by IndexedDB.
  return JSON.parse(JSON.stringify(value));
}

export async function saveGuestAttempt(attempt) {
  const plain = plainClone(attempt);
  const db = await openDatabase();
  const tx = db.transaction(ATTEMPTS, 'readwrite');
  tx.objectStore(ATTEMPTS).put(plain);
  await transactionDone(tx);
  return plain;
}

export async function getGuestAttempt(clientEventId) {
  const db = await openDatabase();
  const tx = db.transaction(ATTEMPTS, 'readonly');
  return requestDone(tx.objectStore(ATTEMPTS).get(clientEventId));
}

export async function updateGuestAttempt(clientEventId, patch) {
  const existing = await getGuestAttempt(clientEventId);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await saveGuestAttempt(updated);
  return updated;
}

export async function getGuestFavorites() {
  return allFromStore(FAVORITES);
}

export async function getGuestFavoriteIds() {
  const favorites = await getGuestFavorites();
  return new Set(favorites.map((item) => String(item.questionId)));
}

export async function setGuestFavorite(questionId, favorited) {
  const db = await openDatabase();
  const tx = db.transaction(FAVORITES, 'readwrite');
  const store = tx.objectStore(FAVORITES);
  if (favorited) {
    store.put({
      questionId: String(questionId),
      favoritedAt: new Date().toISOString(),
    });
  } else {
    store.delete(String(questionId));
  }
  await transactionDone(tx);
}

export async function toggleGuestFavorite(questionId) {
  const ids = await getGuestFavoriteIds();
  const favorited = !ids.has(String(questionId));
  await setGuestFavorite(questionId, favorited);
  return favorited;
}

export function draftKey(namespace, questionId) {
  return `${namespace}:${questionId}`;
}

export async function getDraft(namespace, questionId) {
  const db = await openDatabase();
  const tx = db.transaction(DRAFTS, 'readonly');
  return requestDone(tx.objectStore(DRAFTS).get(draftKey(namespace, questionId)));
}

export async function saveDraft(namespace, questionId, answer) {
  const db = await openDatabase();
  const tx = db.transaction(DRAFTS, 'readwrite');
  tx.objectStore(DRAFTS).put(plainClone({
    key: draftKey(namespace, questionId),
    namespace,
    questionId: String(questionId),
    answer,
    updatedAt: new Date().toISOString(),
  }));
  await transactionDone(tx);
}

export async function deleteDraft(namespace, questionId) {
  const db = await openDatabase();
  const tx = db.transaction(DRAFTS, 'readwrite');
  tx.objectStore(DRAFTS).delete(draftKey(namespace, questionId));
  await transactionDone(tx);
}

export async function clearGuestLearningData() {
  const db = await openDatabase();
  const tx = db.transaction([ATTEMPTS, FAVORITES], 'readwrite');
  tx.objectStore(ATTEMPTS).clear();
  tx.objectStore(FAVORITES).clear();
  await transactionDone(tx);
}

export async function getGuestMergeData() {
  const [attempts, favorites] = await Promise.all([getGuestAttempts(), getGuestFavorites()]);
  return {
    attempts: attempts.map((attempt) => ({
      clientEventId: attempt.clientEventId,
      questionId: attempt.questionId,
      versionId: attempt.versionId,
      answer: attempt.submittedAnswer,
      submittedAt: attempt.submittedAt,
      selfAssessment: attempt.selfAssessment || null,
    })),
    favorites: favorites.map((favorite) => ({
      questionId: favorite.questionId,
      favoritedAt: favorite.favoritedAt,
    })),
  };
}

export async function getGuestDataCount() {
  try {
    const [attempts, favorites] = await Promise.all([getGuestAttempts(), getGuestFavorites()]);
    return { attempts: attempts.length, favorites: favorites.length, total: attempts.length + favorites.length };
  } catch {
    return { attempts: 0, favorites: 0, total: 0 };
  }
}

export function deriveGuestStates(attempts) {
  const states = new Map();
  const ordered = [...attempts].sort((a, b) => {
    const time = String(a.submittedAt).localeCompare(String(b.submittedAt));
    return time || String(a.clientEventId).localeCompare(String(b.clientEventId));
  });
  for (const attempt of ordered) {
    const questionId = String(attempt.questionId);
    if (!states.has(questionId)) {
      states.set(questionId, {
        questionId,
        inWrongBook: false,
        wrongCount: 0,
        lastWrongAt: null,
        lastAnsweredAt: null,
        lastAttemptId: attempt.clientEventId,
      });
    }
    const state = states.get(questionId);
    state.lastAnsweredAt = attempt.submittedAt;
    state.lastAttemptId = attempt.clientEventId;
    if (attempt.requiresSelfAssessment) {
      if (attempt.selfAssessment === 'not_mastered') {
        state.inWrongBook = true;
        state.wrongCount += 1;
        state.lastWrongAt = attempt.submittedAt;
      } else if (attempt.selfAssessment === 'mastered') {
        state.inWrongBook = false;
      }
    } else if (attempt.isCorrect === false) {
      state.inWrongBook = true;
      state.wrongCount += 1;
      state.lastWrongAt = attempt.submittedAt;
    } else if (attempt.isCorrect === true) {
      state.inWrongBook = false;
    }
  }
  return states;
}

export async function getGuestStudyState() {
  const [attempts, favorites] = await Promise.all([getGuestAttempts(), getGuestFavorites()]);
  const states = deriveGuestStates(attempts);
  const wrongEntries = [];
  for (const state of states.values()) {
    if (state.inWrongBook) wrongEntries.push(state);
  }
  return {
    attempts,
    favorites,
    states,
    wrongEntries,
    favoriteIds: new Set(favorites.map((item) => String(item.questionId))),
    stats: {
      attempts: attempts.length,
      wrong: wrongEntries.length,
      favorites: favorites.length,
    },
  };
}

export async function getGuestWrongEntries() {
  const attempts = await getGuestAttempts();
  return [...deriveGuestStates(attempts).values()].filter((state) => state.inWrongBook);
}

export function guestDraftNamespace(user) {
  return user ? `user:${user.id}` : 'guest';
}
