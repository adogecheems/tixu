import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'tixu-test-'));
const dbPath = path.join(tmpRoot, 'test.db');
const uploadDir = path.join(tmpRoot, 'uploads');
const ADMIN_USERNAME = 'testadmin';
const ADMIN_PASSWORD = 'testadmin12345';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function log(label) {
  console.log(`✓ ${label}`);
}

class Client {
  constructor(base) {
    this.base = base;
    this.jar = new Map();
  }

  cookieHeader() {
    return [...this.jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
  }

  collect(response) {
    for (const raw of response.headers.getSetCookie?.() || []) {
      const pair = raw.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const key = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (value) this.jar.set(key, value);
      else this.jar.delete(key);
    }
  }

  async ensureCsrf() {
    if (!this.jar.get('tixu_csrf')) {
      await this.request('/api/v1/auth/me');
    }
  }

  async request(pathname, { method = 'GET', body, formData, includeCsrf = true, headers = {} } = {}) {
    const unsafe = !['GET', 'HEAD'].includes(method.toUpperCase());
    if (unsafe && includeCsrf) await this.ensureCsrf();
    const requestHeaders = { Accept: 'application/json', Cookie: this.cookieHeader(), ...headers };
    let payload = body;
    if (formData) {
      payload = formData;
    } else if (body !== undefined) {
      requestHeaders['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    if (unsafe && includeCsrf) requestHeaders['X-CSRF-Token'] = this.jar.get('tixu_csrf') || '';
    const response = await fetch(`${this.base}${pathname}`, {
      method,
      headers: requestHeaders,
      body: payload,
    });
    this.collect(response);
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    return { status: response.status, data, response };
  }

  async json(pathname, options) {
    return this.request(pathname, options);
  }

  get(pathname) {
    return this.request(pathname);
  }

  post(pathname, body) {
    return this.request(pathname, { method: 'POST', body });
  }

  put(pathname, body) {
    return this.request(pathname, { method: 'PUT', body });
  }

  patch(pathname, body) {
    return this.request(pathname, { method: 'PATCH', body });
  }

  delete(pathname) {
    return this.request(pathname, { method: 'DELETE' });
  }

  multipart(pathname, formData) {
    return this.request(pathname, { method: 'POST', formData });
  }
}

let app;
let base;
const TEST_DATABASE_URL = String(process.env.TEST_DATABASE_URL || '').trim();

async function resetPostgresTestSchema() {
  if (!TEST_DATABASE_URL) return;
  let databaseName = '';
  try {
    databaseName = decodeURIComponent(new URL(TEST_DATABASE_URL).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('TEST_DATABASE_URL 不是合法的 PostgreSQL 连接 URL。');
  }
  const normalizedName = databaseName.toLowerCase();
  const isDedicatedTestDb =
    normalizedName === 'test' ||
    normalizedName.startsWith('test_') ||
    normalizedName.startsWith('test-') ||
    normalizedName.endsWith('_test') ||
    normalizedName.endsWith('-test');
  if (!isDedicatedTestDb) {
    throw new Error(
      '为防止误删数据，TEST_DATABASE_URL 必须指向数据库名为 test、test_*、*-test 或 *_test 的专用测试数据库。',
    );
  }
  const pgModule = await import('pg');
  const pg = pgModule.default || pgModule;
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
}

async function setupServer() {
  await resetPostgresTestSchema();
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL || '',
    DATABASE_PATH: dbPath,
    UPLOAD_DIR: uploadDir,
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    PORT: '0',
    ALLOWED_ORIGINS: 'https://app.example.test, https://trailing.example.test/',
    TRUST_PROXY: 'false',
  };
  execFileSync(process.execPath, ['server/setup.js'], {
    cwd: ROOT,
    env,
    stdio: 'pipe',
  });
  Object.assign(process.env, env);
  const { buildApp } = await import('../server/app.js');
  const { openDatabase } = await import('../server/db.js');
  app = await buildApp({ db: await openDatabase(), logger: false });
  await app.listen({ host: '127.0.0.1', port: 0 });
  base = `http://127.0.0.1:${app.server.address().port}`;
}

function importFile(contents, name = 'import.json', type = 'application/json') {
  const form = new FormData();
  form.append('file', new Blob([contents], { type }), name);
  return form;
}

function createSingleQuestionPayload({ categoryId, tagId, title, versionTag = 'v1' }) {
  return {
    title,
    stemMarkdown: `这是 ${versionTag} 题干，已知 $f(x)=x^2$，则 $f(3)=$（ ）。`,
    type: 'single',
    difficulty: 'medium',
    categoryId,
    tagIds: tagId ? [tagId] : [],
    options: [
      { id: 'A', text: '6' },
      { id: 'B', text: '9' },
      { id: 'C', text: '12' },
      { id: 'D', text: '3' },
    ],
    answer: { optionId: 'B' },
    judgeConfig: {},
    analysisMarkdown: '因为 $3^2=9$。',
    sortOrder: 50,
  };
}

async function main() {
  await setupServer();
  const guest = new Client(base);
  await guest.get('/api/v1/auth/me');
  assert.ok(guest.jar.get('tixu_csrf'), 'CSRF cookie should be set');
  log('服务器启动并生成 CSRF 会话');

  // CSRF protection
  const csrfResponse = await fetch(`${base}/api/v1/questions/1/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: guest.cookieHeader() },
    body: JSON.stringify({ clientEventId: 'csrf-test-1234', answer: { optionId: 'A' } }),
  });
  assert.equal(csrfResponse.status, 403);
  log('缺少 CSRF 头的写请求被拒绝');

  // Origin allowlist normalization: the trailing slash in config must not break matching.
  const allowedOrigin = await guest.request('/api/v1/auth/merge', {
    method: 'POST',
    body: {},
    headers: { Origin: 'https://trailing.example.test' },
  });
  assert.equal(allowedOrigin.status, 401);
  const rejectedOrigin = await guest.request('/api/v1/auth/merge', {
    method: 'POST',
    body: {},
    headers: { Origin: 'https://untrusted.example.test' },
  });
  assert.equal(rejectedOrigin.status, 403);
  assert.equal(rejectedOrigin.data.error.code, 'ORIGIN_REJECTED');
  log('Origin 白名单归一化与未授权来源拒绝正常');

  // Public content and answer redaction
  const listResponse = await guest.get('/api/v1/questions?pageSize=100');
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.data.pagination.total, 17);
  for (const item of listResponse.data.items) {
    assert.ok(!('answer' in item));
    assert.ok(!('correctAnswer' in item));
    assert.ok(!('analysisMarkdown' in item));
  }
  const categories = await guest.get('/api/v1/categories');
  const root = categories.data.categories[0];
  assert.ok(root.questionCount >= root.children.reduce((sum, child) => sum + child.questionCount, 0));
  log('公开题库不泄露答案，分类包含子分类题目数');

  const multipleOnly = await guest.get('/api/v1/questions?types=multiple&pageSize=100');
  assert.ok(multipleOnly.data.items.length > 0);
  assert.ok(multipleOnly.data.items.every((item) => item.type === 'multiple'));
  const pageOne = await guest.get('/api/v1/questions?page=1&pageSize=5');
  const pageTwo = await guest.get('/api/v1/questions?page=2&pageSize=5');
  assert.equal(pageOne.data.items.length, 5);
  assert.equal(pageOne.data.pagination.total, 17);
  assert.ok(!pageTwo.data.items.some((item) => pageOne.data.items.some((first) => first.id === item.id)));
  const difficultySorted = await guest.get('/api/v1/questions?sort=difficulty_asc&pageSize=100');
  const ranks = { easy: 1, medium: 2, hard: 3 };
  const sortedRanks = difficultySorted.data.items.map((item) => ranks[item.difficulty]);
  assert.deepEqual(sortedRanks, [...sortedRanks].sort((a, b) => a - b));
  const rootCategorySearch = await guest.get(`/api/v1/questions?category=${root.id}&pageSize=100`);
  assert.ok(rootCategorySearch.data.items.length > 0);
  assert.ok(
    rootCategorySearch.data.items.every(
      (item) => item.category?.id === root.id || item.category?.parent?.id === root.id,
    ),
  );
  const publicTags = await guest.get('/api/v1/tags');
  const functionTag = publicTags.data.tags.find((tag) => tag.name === '函数');
  const basicTag = publicTags.data.tags.find((tag) => tag.name === '基础');
  const tagAndResult = await guest.get(
    `/api/v1/questions?tags=${functionTag.id},${basicTag.id}&pageSize=100`,
  );
  assert.ok(tagAndResult.data.pagination.total >= 1);
  const probabilityTag = publicTags.data.tags.find((tag) => tag.name === '概率');
  const impossibleTagAnd = await guest.get(
    `/api/v1/questions?tags=${functionTag.id},${probabilityTag.id}&pageSize=100`,
  );
  assert.equal(impossibleTagAnd.data.pagination.total, 0);
  log('题型、分类、标签 AND、排序与分页筛选正常');

  const q1 = await guest.get('/api/v1/questions/1');
  assert.equal(q1.status, 200);
  assert.ok(q1.data.question.stemMarkdown);
  assert.ok(!('answer' in q1.data.question));
  assert.ok(!('analysisMarkdown' in q1.data.question));

  const guestWrong = await guest.post('/api/v1/questions/1/submit', {
    clientEventId: `guest-${crypto.randomUUID()}`,
    versionId: q1.data.question.versionId,
    answer: { optionId: 'A' },
  });
  assert.equal(guestWrong.status, 200);
  assert.equal(guestWrong.data.attempt.id, null);
  assert.equal(guestWrong.data.result.isCorrect, false);
  assert.ok(guestWrong.data.result.analysisMarkdown);
  log('游客可以提交并得到无持久化记录的判题结果');

  // Users and client isolation
  const suffix = Date.now().toString(36);
  const userA = new Client(base);
  const usernameA = `learner_${suffix}`;
  const registerA = await userA.post('/api/v1/auth/register', {
    username: usernameA,
    password: 'learner12345',
  });
  assert.equal(registerA.status, 201);
  assert.equal(registerA.data.user.role, 'user');
  assert.match(registerA.response.headers.get('set-cookie') || '', /HttpOnly/i);
  log('用户注册后自动登录且会话 Cookie 为 HttpOnly');

  const duplicateRegister = await new Client(base).post('/api/v1/auth/register', {
    username: usernameA.toUpperCase(),
    password: 'learner12345',
  });
  assert.equal(duplicateRegister.status, 409);
  log('用户名大小写不敏感且不可重复');

  const userB = new Client(base);
  const usernameB = `other_${suffix}`;
  await userB.post('/api/v1/auth/register', { username: usernameB, password: 'learner12345' });

  const favorite = await userA.put('/api/v1/me/favorites/1', { favorited: true });
  assert.equal(favorite.status, 200);
  assert.equal(favorite.data.isFavorited, true);
  log('用户可以收藏未作答题目');

  async function submitAttempt(client, question, answer, eventId = crypto.randomUUID()) {
    return client.post(`/api/v1/questions/${question.id}/submit`, {
      clientEventId: eventId,
      versionId: question.versionId,
      answer,
      submittedAt: new Date().toISOString(),
    });
  }

  const eventWrong1 = `attempt-${crypto.randomUUID()}`;
  const eventWrong2 = `attempt-${crypto.randomUUID()}`;
  const eventCorrect = `attempt-${crypto.randomUUID()}`;
  for (const [eventId, optionId] of [
    [eventWrong1, 'A'],
    [eventWrong2, 'A'],
    [eventCorrect, 'B'],
  ]) {
    const response = await userA.post('/api/v1/questions/1/submit', {
      clientEventId: eventId,
      versionId: q1.data.question.versionId,
      answer: { optionId },
      submittedAt: new Date().toISOString(),
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
  }
  const historyA = await userA.get('/api/v1/me/attempts?pageSize=20');
  assert.equal(historyA.data.pagination.total, 3);
  assert.deepEqual(new Set(historyA.data.items.map((item) => item.isCorrect)), new Set([true, false]));
  const wrongAfterCorrect = await userA.get('/api/v1/me/wrong');
  assert.equal(wrongAfterCorrect.data.pagination.total, 0);
  log('同一题三次提交产生三条记录，答对后移出错题本但历史保留');

  const duplicated = await userA.post('/api/v1/questions/1/submit', {
    clientEventId: eventWrong1,
    versionId: q1.data.question.versionId,
    answer: { optionId: 'B' },
  });
  assert.equal(duplicated.status, 200);
  assert.equal(duplicated.data.attempt.duplicate, true);
  const historyAfterDup = await userA.get('/api/v1/me/attempts?pageSize=20');
  assert.equal(historyAfterDup.data.pagination.total, 3);
  log('相同 clientEventId 重试不会生成重复历史');

  // Wrong book increment checks using a second question
  const q5 = await guest.get('/api/v1/questions/5');
  for (let index = 0; index < 2; index += 1) {
    const response = await userA.post('/api/v1/questions/5/submit', {
      clientEventId: `wrong-count-${index}-${crypto.randomUUID()}`,
      versionId: q5.data.question.versionId,
      answer: { optionId: 'A' },
      submittedAt: new Date().toISOString(),
    });
    assert.equal(response.status, 200);
  }
  const wrongFive = await userA.get('/api/v1/me/wrong');
  const q5Entry = wrongFive.data.items.find((item) => item.id === '5');
  assert.ok(q5Entry, 'wrong book should include question 5');
  assert.equal(q5Entry.wrongCount, 2);
  log('重复答错保留在错题本并累计错误次数');

  const essay = await guest.get('/api/v1/questions/11');
  const essayAttempt = await userA.post('/api/v1/questions/11/submit', {
    clientEventId: `essay-${crypto.randomUUID()}`,
    versionId: essay.data.question.versionId,
    answer: { text: '线性相关表示存在非零系数使线性组合为零。' },
    submittedAt: new Date().toISOString(),
  });
  assert.equal(essayAttempt.status, 200);
  assert.equal(essayAttempt.data.result.isCorrect, null);
  assert.equal(essayAttempt.data.result.requiresSelfAssessment, true);
  assert.ok(essayAttempt.data.result.correctAnswer.referenceMarkdown);
  const essayAttemptId = essayAttempt.data.attempt.id;
  const assessment = await userA.patch(`/api/v1/me/attempts/${essayAttemptId}/assessment`, {
    assessment: 'not_mastered',
  });
  assert.equal(assessment.status, 200);
  const wrongWithEssay = await userA.get('/api/v1/me/wrong');
  assert.ok(wrongWithEssay.data.items.some((item) => item.id === '11'));
  const repeatedAssessment = await userA.patch(`/api/v1/me/attempts/${essayAttemptId}/assessment`, {
    assessment: 'not_mastered',
  });
  assert.equal(repeatedAssessment.status, 200);
  const conflictingAssessment = await userA.patch(`/api/v1/me/attempts/${essayAttemptId}/assessment`, {
    assessment: 'mastered',
  });
  assert.equal(conflictingAssessment.status, 409);
  log('简答题支持参考答案与一次性自评，并更新错题状态');

  // Account isolation
  const userBFavorites = await userB.get('/api/v1/me/favorites');
  const userBAttempts = await userB.get('/api/v1/me/attempts');
  assert.equal(userBFavorites.data.pagination.total, 0);
  assert.equal(userBAttempts.data.pagination.total, 0);
  const rawAttemptId = historyA.data.items[0].id;
  const crossRead = await userB.get(`/api/v1/me/attempts/${rawAttemptId}`);
  assert.equal(crossRead.status, 404);
  const regularAdmin = await userA.get('/api/v1/admin/stats');
  assert.equal(regularAdmin.status, 403);
  log('账户数据隔离，普通用户无法访问管理接口');

  // Admin auth
  const admin = new Client(base);
  await admin.get('/api/v1/auth/me');
  const wrongPassword = await new Client(base).post('/api/v1/auth/login', {
    username: ADMIN_USERNAME,
    password: 'wrong-password',
  });
  assert.equal(wrongPassword.status, 401);
  const adminLogin = await admin.post('/api/v1/auth/login', {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.data.user.role, 'admin');
  const adminStats = await admin.get('/api/v1/admin/stats');
  assert.equal(adminStats.status, 200);
  assert.equal(adminStats.data.statusCounts.published, 17);
  log('管理员登录与统计接口正常');

  const adminCategories = await admin.get('/api/v1/admin/categories');
  const adminTags = await admin.get('/api/v1/admin/tags');
  const categoryId = adminCategories.data.categories[0].children[0].id;
  const tagId = adminTags.data.tags[0].id;
  const uniqueTitle = `集成测试题目 ${suffix}`;
  const payload = createSingleQuestionPayload({ categoryId, tagId, title: uniqueTitle });
  const created = await admin.post('/api/v1/admin/questions', payload);
  assert.equal(created.status, 201);
  const createdId = created.data.questionId;
  const notPublicYet = await guest.get(`/api/v1/questions?q=${encodeURIComponent(uniqueTitle)}`);
  assert.equal(notPublicYet.data.pagination.total, 0);
  const published = await admin.post(`/api/v1/admin/questions/${createdId}/publish`, {});
  assert.equal(published.status, 200);
  const nowPublic = await guest.get(`/api/v1/questions?q=${encodeURIComponent(uniqueTitle)}`);
  assert.equal(nowPublic.data.pagination.total, 1);
  const newVersionId = nowPublic.data.items[0].versionId;
  log('管理员创建草稿后发布，草稿发布前不进入公开题库');

  const preRevisionAttemptEvent = `revision-${crypto.randomUUID()}`;
  const preRevisionAttempt = await userA.post(`/api/v1/questions/${createdId}/submit`, {
    clientEventId: preRevisionAttemptEvent,
    versionId: newVersionId,
    answer: { optionId: 'B' },
    submittedAt: new Date().toISOString(),
  });
  assert.equal(preRevisionAttempt.status, 200);

  const adminQuestion = await admin.get(`/api/v1/admin/questions/${createdId}`);
  assert.equal(adminQuestion.data.question.versions.length, 1);
  const revisionTitle = `${uniqueTitle} · 修订版`;
  const revision = await admin.put(`/api/v1/admin/questions/${createdId}/draft`, {
    ...payload,
    title: revisionTitle,
    stemMarkdown: '修订后的题干内容。',
    baseUpdatedAt: adminQuestion.data.question.baseUpdatedAt,
  });
  assert.equal(revision.status, 200);
  const stillOldTitle = await guest.get(`/api/v1/questions?q=${encodeURIComponent(uniqueTitle)}`);
  assert.equal(stillOldTitle.data.pagination.total, 1);
  const revisionPublished = await admin.post(`/api/v1/admin/questions/${createdId}/publish`, {});
  assert.equal(revisionPublished.status, 200);
  const nowNewTitle = await guest.get(`/api/v1/questions?q=${encodeURIComponent(revisionTitle)}`);
  assert.equal(nowNewTitle.data.pagination.total, 1);
  const versionsAfter = await admin.get(`/api/v1/admin/questions/${createdId}`);
  assert.equal(versionsAfter.data.question.versions.length, 2);
  const oldAttemptDetail = await userA.get(`/api/v1/me/attempts/${preRevisionAttempt.data.attempt.id}`);
  assert.equal(oldAttemptDetail.status, 200);
  assert.equal(oldAttemptDetail.data.attempt.title, uniqueTitle);
  const retryAfterRevision = await userA.post(`/api/v1/questions/${createdId}/submit`, {
    clientEventId: preRevisionAttemptEvent,
    versionId: newVersionId,
    answer: { optionId: 'B' },
  });
  assert.equal(retryAfterRevision.status, 200);
  assert.equal(retryAfterRevision.data.attempt.duplicate, true);
  const newerPublic = await guest.get(`/api/v1/questions?q=${encodeURIComponent(revisionTitle)}`);
  const newerVersionId = newerPublic.data.items[0].versionId;
  const staleSubmission = await userA.post(`/api/v1/questions/${createdId}/submit`, {
    clientEventId: `stale-${crypto.randomUUID()}`,
    versionId: newVersionId,
    answer: { optionId: 'B' },
  });
  assert.equal(staleSubmission.status, 409);
  assert.equal(staleSubmission.data.error.code, 'VERSION_MISMATCH');
  const currentSubmission = await userA.post(`/api/v1/questions/${createdId}/submit`, {
    clientEventId: `current-${crypto.randomUUID()}`,
    versionId: newerVersionId,
    answer: { optionId: 'B' },
  });
  assert.equal(currentSubmission.status, 200);
  log('旧版本提交返回版本冲突，刷新后当前版本可正常提交');

  // All five question types through admin and solving
  const allTypes = [
    {
      title: `五题型-多选 ${suffix}`,
      type: 'multiple',
      options: [{ id: 'A', text: '甲' }, { id: 'B', text: '乙' }, { id: 'C', text: '丙' }],
      answer: { optionIds: ['A', 'C'] },
      judgeConfig: {},
    },
    {
      title: `五题型-判断 ${suffix}`,
      type: 'truefalse',
      options: [],
      answer: { value: true },
      judgeConfig: {},
    },
    {
      title: `五题型-填空 ${suffix}`,
      type: 'fill',
      options: [],
      answer: { blanks: [['Hello World'], ['42']] },
      judgeConfig: {
        blanks: [{ placeholder: '第一个空' }, { placeholder: '第二个空' }],
        caseSensitive: false,
        trimWhitespace: true,
        collapseWhitespace: true,
      },
    },
    {
      title: `五题型-简答 ${suffix}`,
      type: 'essay',
      options: [],
      answer: { referenceMarkdown: '这是简答题的参考答案。' },
      judgeConfig: {},
    },
  ];
  const createdTypes = {};
  for (const item of allTypes) {
    const response = await admin.post('/api/v1/admin/questions', {
      ...createSingleQuestionPayload({ categoryId, tagId, title: item.title }),
      type: item.type,
      options: item.options,
      answer: item.answer,
      judgeConfig: item.judgeConfig,
      stemMarkdown: `${item.title} 的题干内容。`,
    });
    assert.equal(response.status, 201, JSON.stringify(response.data));
    const publishResponse = await admin.post(`/api/v1/admin/questions/${response.data.questionId}/publish`, {});
    assert.equal(publishResponse.status, 200, JSON.stringify(publishResponse.data));
    createdTypes[item.type] = response.data.questionId;
  }
  const multiPublic = await guest.get(`/api/v1/questions?q=${encodeURIComponent(`五题型-多选 ${suffix}`)}`);
  assert.equal(multiPublic.data.items[0].type, 'multiple');
  const multiVersion = multiPublic.data.items[0].versionId;
  const multiCorrect = await userA.post(`/api/v1/questions/${createdTypes.multiple}/submit`, {
    clientEventId: `multi-${crypto.randomUUID()}`,
    versionId: multiVersion,
    answer: { optionIds: ['C', 'A'] },
  });
  assert.equal(multiCorrect.data.result.isCorrect, true);
  const multiWrong = await userA.post(`/api/v1/questions/${createdTypes.multiple}/submit`, {
    clientEventId: `multi-wrong-${crypto.randomUUID()}`,
    versionId: multiVersion,
    answer: { optionIds: ['A'] },
  });
  assert.equal(multiWrong.data.result.isCorrect, false);
  const truefalsePublic = await guest.get(`/api/v1/questions?q=${encodeURIComponent(`五题型-判断 ${suffix}`)}`);
  const truefalseWrong = await userA.post(`/api/v1/questions/${createdTypes.truefalse}/submit`, {
    clientEventId: `tf-${crypto.randomUUID()}`,
    versionId: truefalsePublic.data.items[0].versionId,
    answer: { value: false },
  });
  assert.equal(truefalseWrong.data.result.isCorrect, false);
  const fillPublic = await guest.get(`/api/v1/questions?q=${encodeURIComponent(`五题型-填空 ${suffix}`)}`);
  const fillCorrect = await userA.post(`/api/v1/questions/${createdTypes.fill}/submit`, {
    clientEventId: `fill-${crypto.randomUUID()}`,
    versionId: fillPublic.data.items[0].versionId,
    answer: { blanks: ['  hello   world  ', '42'] },
  });
  assert.equal(fillCorrect.data.result.isCorrect, true);
  const essayPublic = await guest.get(`/api/v1/questions?q=${encodeURIComponent(`五题型-简答 ${suffix}`)}`);
  const essayPublicDetail = await guest.get(`/api/v1/questions/${createdTypes.essay}`);
  assert.ok(!('analysisMarkdown' in essayPublicDetail.data.question));
  assert.ok(!('answer' in essayPublicDetail.data.question));
  const essayCreatedAttempt = await userA.post(`/api/v1/questions/${createdTypes.essay}/submit`, {
    clientEventId: `essay-created-${crypto.randomUUID()}`,
    versionId: essayPublic.data.items[0].versionId,
    answer: { text: '我的简答内容。' },
  });
  assert.equal(essayCreatedAttempt.status, 200);
  assert.equal(essayCreatedAttempt.data.result.requiresSelfAssessment, true);
  log('管理员可创建并发布五种题型，且服务端判题正确');

  // Archive behavior
  await admin.post(`/api/v1/admin/questions/${createdTypes.truefalse}/archive`, {});
  const archivedDetail = await guest.get(`/api/v1/questions/${createdTypes.truefalse}`);
  assert.equal(archivedDetail.status, 410);
  assert.equal(archivedDetail.data.error.code, 'QUESTION_ARCHIVED');
  const archivedSubmit = await userA.post(`/api/v1/questions/${createdTypes.truefalse}/submit`, {
    clientEventId: `archived-${crypto.randomUUID()}`,
    versionId: truefalsePublic.data.items[0].versionId,
    answer: { value: true },
  });
  assert.equal(archivedSubmit.status, 410);
  const archivedHistory = await userA.get('/api/v1/me/attempts?pageSize=50');
  assert.ok(archivedHistory.data.items.some((item) => item.questionId === createdTypes.truefalse));
  await admin.post(`/api/v1/admin/questions/${createdTypes.truefalse}/restore`, {});
  const restoredDetail = await guest.get(`/api/v1/questions/${createdTypes.truefalse}`);
  assert.equal(restoredDetail.status, 200);
  log('归档题目禁止公开访问与提交，但历史保留，恢复后重新可访问');

  // Batch / lifecycle
  const batchA = await admin.post('/api/v1/admin/questions', createSingleQuestionPayload({
    categoryId,
    tagId,
    title: `批量A ${suffix}`,
  }));
  const batchInvalid = await admin.post('/api/v1/admin/questions', {
    type: 'single',
    difficulty: 'medium',
    options: [],
    answer: {},
    tagIds: [],
    title: '',
    stemMarkdown: '',
    analysisMarkdown: '',
  });
  assert.equal(batchInvalid.status, 201);
  const batchFailure = await admin.post('/api/v1/admin/questions/batch-publish', {
    ids: [batchA.data.questionId, batchInvalid.data.questionId],
  });
  assert.equal(batchFailure.status, 422);
  assert.equal(batchFailure.data.error.code, 'BATCH_VALIDATION_FAILED');
  const batchAStillDraft = await admin.get(`/api/v1/admin/questions/${batchA.data.questionId}`);
  assert.equal(batchAStillDraft.data.question.status, 'draft');
  const batchC = await admin.post('/api/v1/admin/questions', createSingleQuestionPayload({
    categoryId,
    tagId,
    title: `批量C ${suffix}`,
  }));
  const batchSuccess = await admin.post('/api/v1/admin/questions/batch-publish', {
    ids: [batchA.data.questionId, batchC.data.questionId],
  });
  assert.equal(batchSuccess.status, 200);
  assert.equal(batchSuccess.data.publishedCount, 2);
  const batchArchive = await admin.post('/api/v1/admin/questions/batch-archive', {
    ids: [batchA.data.questionId, batchC.data.questionId],
  });
  assert.equal(batchArchive.status, 200);
  const archivedPublic = await guest.get(`/api/v1/questions?q=${encodeURIComponent(`批量A ${suffix}`)}`);
  assert.equal(archivedPublic.data.pagination.total, 0);
  const restored = await admin.post(`/api/v1/admin/questions/${batchA.data.questionId}/restore`, {});
  assert.equal(restored.status, 200);
  const deletedDraft = await admin.delete(`/api/v1/admin/questions/${batchInvalid.data.questionId}`);
  assert.equal(deletedDraft.status, 200);
  const duplicateQuestion = await admin.post(`/api/v1/admin/questions/${createdId}/duplicate`, {});
  assert.equal(duplicateQuestion.status, 201);
  const protectedDelete = await admin.delete(`/api/v1/admin/questions/${createdId}`);
  assert.equal(protectedDelete.status, 409);
  log('批量发布/归档事务一致，归档可恢复，已发布题目不可永久删除');

  // Categories and tags CRUD
  const catRoot = await admin.post('/api/v1/admin/categories', { name: `测试分类 ${suffix}` });
  assert.equal(catRoot.status, 201);
  const catChild = await admin.post('/api/v1/admin/categories', {
    name: `测试子分类 ${suffix}`,
    parentId: catRoot.data.id,
  });
  assert.equal(catChild.status, 201);
  const deleteUsedCategory = await admin.delete(`/api/v1/admin/categories/${categoryId}`);
  assert.equal(deleteUsedCategory.status, 409);
  const deleteChild = await admin.delete(`/api/v1/admin/categories/${catChild.data.id}`);
  assert.equal(deleteChild.status, 200);
  const deleteRoot = await admin.delete(`/api/v1/admin/categories/${catRoot.data.id}`);
  assert.equal(deleteRoot.status, 200);
  const tagOne = await admin.post('/api/v1/admin/tags', { name: `测试标签A ${suffix}` });
  const tagTwo = await admin.post('/api/v1/admin/tags', { name: `测试标签B ${suffix}` });
  assert.equal(tagOne.status, 201);
  const publicTagsAfterCreate = await guest.get('/api/v1/tags');
  assert.ok(
    publicTagsAfterCreate.data.tags.some((tag) => tag.id === tagOne.data.id),
    '管理员创建标签后，公开标签缓存应立即失效',
  );
  const renameTag = await admin.put(`/api/v1/admin/tags/${tagTwo.data.id}`, {
    name: `测试标签B2 ${suffix}`,
  });
  assert.equal(renameTag.status, 200);
  const mergeTag = await admin.post(`/api/v1/admin/tags/${tagOne.data.id}/merge`, {
    targetId: tagTwo.data.id,
  });
  assert.equal(mergeTag.status, 200);
  const deleteUnusedTag = await admin.delete(`/api/v1/admin/tags/${tagTwo.data.id}`);
  assert.equal(deleteUnusedTag.status, 200);
  log('分类与标签的创建、重命名、合并、删除和引用保护正常');

  // Import JSON
  const importTitle = `导入题目 ${suffix}`;
  const importDoc = {
    version: 1,
    questions: [
      {
        title: importTitle,
        type: 'fill',
        difficulty: 'easy',
        categoryPath: [adminCategories.data.categories[0].name, adminCategories.data.categories[0].children[0].name],
        tags: [adminTags.data.tags[0].name],
        stem: '填空：$2+3=$ ____。',
        judgeConfig: { blanks: [{ placeholder: '输入结果' }] },
        answer: { blanks: [['5']] },
        analysis: '$2+3=5$。',
      },
    ],
  };
  const preview = await admin.multipart(
    '/api/v1/admin/import/preview',
    importFile(JSON.stringify(importDoc), 'questions.json'),
  );
  assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.items.length, 1);
  const emptyBeforeConfirm = await admin.get(`/api/v1/admin/questions?q=${encodeURIComponent(importTitle)}`);
  assert.equal(emptyBeforeConfirm.data.pagination.total, 0);
  const confirmed = await admin.post('/api/v1/admin/import/confirm', { token: preview.data.token });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.importedCount, 1);
  const importedDrafts = await admin.get(`/api/v1/admin/questions?q=${encodeURIComponent(importTitle)}`);
  assert.equal(importedDrafts.data.pagination.total, 1);
  assert.equal(importedDrafts.data.items[0].status, 'draft');
  log('JSON 导入先预览后确认，仅创建草稿');

  const invalidImportDoc = {
    questions: [
      { ...importDoc.questions[0], title: `错误导入 ${suffix}`, categoryPath: ['不存在的分类', '不存在子分类'] },
      { ...importDoc.questions[0], title: '' },
    ],
  };
  const invalidPreview = await admin.multipart(
    '/api/v1/admin/import/preview',
    importFile(JSON.stringify(invalidImportDoc), 'invalid.json'),
  );
  assert.equal(invalidPreview.status, 422);
  assert.equal(invalidPreview.data.error.code, 'IMPORT_VALIDATION_FAILED');
  assert.ok(invalidPreview.data.error.details.length >= 2);
  log('导入任意题目校验失败时整批拒绝并返回错误明细');

  // Import ZIP with asset
  const zipDoc = {
    questions: [
      {
        title: `ZIP导入 ${suffix}`,
        type: 'single',
        difficulty: 'easy',
        categoryPath: [adminCategories.data.categories[0].name, adminCategories.data.categories[0].children[0].name],
        tags: [adminTags.data.tags[0].name],
        stem: '如下图，求 $f(3)$。\\n\\n![示意图](assets/pixel.png)',
        options: [{ id: 'A', text: '6' }, { id: 'B', text: '9' }],
        answer: { optionId: 'B' },
        analysis: '答案为 9。',
      },
    ],
  };
  const zip = new AdmZip();
  zip.addFile('questions.json', Buffer.from(JSON.stringify(zipDoc)));
  zip.addFile('assets/pixel.png', PNG);
  const zipPreview = await admin.multipart(
    '/api/v1/admin/import/preview',
    importFile(zip.toBuffer(), 'questions.zip', 'application/zip'),
  );
  assert.equal(zipPreview.status, 200, JSON.stringify(zipPreview.data));
  assert.match(zipPreview.data.items[0].stemMarkdown, /\/uploads\//);
  const imageUrl = zipPreview.data.items[0].stemMarkdown.match(/\((\/uploads\/[^)]+)\)/)?.[1];
  assert.ok(imageUrl);
  const assetResponse = await fetch(`${base}${imageUrl}`);
  assert.equal(assetResponse.status, 200);
  const zipConfirmed = await admin.post('/api/v1/admin/import/confirm', { token: zipPreview.data.token });
  assert.equal(zipConfirmed.status, 200);
  log('ZIP 导入解析并重写 assets 图片路径，整批确认创建');

  const missingQuestionsZip = new AdmZip();
  missingQuestionsZip.addFile('assets/pixel.png', PNG);
  const zipRejected = await admin.multipart(
    '/api/v1/admin/import/preview',
    importFile(missingQuestionsZip.toBuffer(), 'missing.zip', 'application/zip'),
  );
  assert.equal(zipRejected.status, 422);
  log('缺少 questions.json 的 ZIP 被拒绝');

  // Upload
  const uploadForm = new FormData();
  uploadForm.append('file', new Blob([PNG], { type: 'image/png' }), 'pixel.png');
  const upload = await admin.multipart('/api/v1/admin/uploads', uploadForm);
  assert.equal(upload.status, 200);
  const uploaded = await fetch(`${base}${upload.data.url}`);
  assert.equal(uploaded.status, 200);
  assert.equal(uploaded.headers.get('content-type'), 'image/png');
  log('管理员图片上传与静态访问正常');

  // Guest merge
  const guest2 = new Client(base);
  const mergeQ = await guest2.get('/api/v1/questions/2');
  const guestEvent = `merge-${crypto.randomUUID()}`;
  const guestAttemptResponse = await guest2.post('/api/v1/questions/2/submit', {
    clientEventId: guestEvent,
    versionId: mergeQ.data.question.versionId,
    answer: { blanks: ['999'] },
  });
  assert.equal(guestAttemptResponse.status, 200);
  const merger = new Client(base);
  const mergerName = `merger_${suffix}`;
  await merger.post('/api/v1/auth/register', { username: mergerName, password: 'learner12345' });
  const mergePayload = {
    attempts: [
      {
        clientEventId: guestEvent,
        questionId: '2',
        versionId: mergeQ.data.question.versionId,
        answer: { blanks: ['999'] },
        submittedAt: new Date().toISOString(),
        selfAssessment: null,
      },
    ],
    favorites: [{ questionId: '2', favoritedAt: new Date().toISOString() }],
  };
  const mergeResult = await merger.post('/api/v1/auth/merge', mergePayload);
  assert.equal(mergeResult.status, 200);
  assert.equal(mergeResult.data.attemptsImported, 1);
  assert.equal(mergeResult.data.favoritesAdded, 1);
  const mergedHistory = await merger.get('/api/v1/me/attempts?pageSize=20');
  assert.equal(mergedHistory.data.pagination.total, 1);
  assert.equal(mergedHistory.data.items[0].isCorrect, false);
  assert.equal(mergedHistory.data.items[0].source, 'merge');
  const mergedWrong = await merger.get('/api/v1/me/wrong');
  assert.ok(mergedWrong.data.items.some((item) => item.id === '2'));
  const mergeAgain = await merger.post('/api/v1/auth/merge', mergePayload);
  assert.equal(mergeAgain.data.attemptsSkipped, 1);
  assert.equal(mergeAgain.data.attemptsImported, 0);
  assert.equal(mergeAgain.data.favoritesUnchanged, 1);
  const historyAfterMergeAgain = await merger.get('/api/v1/me/attempts?pageSize=20');
  assert.equal(historyAfterMergeAgain.data.pagination.total, 1);
  log('游客记录合并去重，重新验证答案并重建错题状态');

  const unverifiedEvent = `missing-version-${crypto.randomUUID()}`;
  const unverifiedResult = await merger.post('/api/v1/auth/merge', {
    attempts: [
      {
        clientEventId: unverifiedEvent,
        questionId: '2',
        versionId: '999999',
        answer: { blanks: ['999'] },
        submittedAt: new Date().toISOString(),
        selfAssessment: null,
      },
    ],
    favorites: [],
  });
  assert.equal(unverifiedResult.status, 200);
  assert.equal(unverifiedResult.data.attemptsUnverified, 1);
  const unverifiedList = await merger.get('/api/v1/me/attempts?result=unverified');
  assert.equal(unverifiedList.data.pagination.total, 1);
  assert.equal(unverifiedList.data.items[0].verified, false);
  log('不存在版本号的合并记录被保留为未验证，不计入有效统计');

  // Logout
  const logoutResponse = await userA.post('/api/v1/auth/logout', {});
  assert.equal(logoutResponse.status, 200);
  const afterLogout = await userA.get('/api/v1/auth/me');
  assert.equal(afterLogout.data.user, null);
  log('主动退出后会话失效');

  // An invalid session cookie should not silently downgrade a submission to a
  // guest judgement when the browser still believes it is logged in.
  const stale = new Client(base);
  await stale.get('/api/v1/auth/me');
  stale.jar.set('tixu_session', 'invalid-session-token');
  const staleSubmit = await stale.post('/api/v1/questions/1/submit', {
    clientEventId: `stale-session-${crypto.randomUUID()}`,
    versionId: q1.data.question.versionId,
    answer: { optionId: 'B' },
  });
  assert.equal(staleSubmit.status, 401);
  log('失效会话不会静默降级为游客提交');

  // Login rate limit: 20 requests per minute per IP.
  const limitedClient = new Client(base);
  await limitedClient.get('/api/v1/auth/me');
  let sawRateLimit = false;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const response = await limitedClient.post('/api/v1/auth/login', {
      username: ADMIN_USERNAME,
      password: `wrong-${attempt}`,
    });
    if (response.status === 429) {
      sawRateLimit = true;
      break;
    }
  }
  assert.equal(sawRateLimit, true);
  log('登录接口基础限速生效');

  console.log('\n全部 API 集成测试通过。');
}

try {
  await main();
} catch (error) {
  console.error('\n集成测试失败：', error);
  process.exitCode = 1;
} finally {
  try {
    await app?.close();
  } catch {}
  await rm(tmpRoot, { recursive: true, force: true });
}
