import { config } from './config.js';
import { databaseLabel, ensureDataDirs, initSchema, openDatabase } from './db.js';
import { createUser, findUserByUsername } from './auth.js';
import { createAdminQuestion, publishAdminQuestion } from './services/adminQuestions.js';
import { categorySeed, draftQuestionSeed, questionSeed, tagSeed } from './seedData.js';
import { nowIso } from './utils.js';

async function ensureAdmin(db) {
  const user = await findUserByUsername(db, config.admin.username);
  if (user) {
    if (user.role !== 'admin') {
      throw new Error(`用户名「${config.admin.username}」已存在，但不是管理员账户，初始化中止。`);
    }
    return { user, created: false };
  }
  const created = await createUser(db, {
    username: config.admin.username,
    password: config.admin.password,
    role: 'admin',
  });
  return { user: created, created: true };
}

async function seedTaxonomy(db) {
  const now = nowIso();
  const categories = new Map();
  const insertRoot = db.prepare(
    `INSERT INTO categories (name, parent_id, sort_order, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?)
     RETURNING id`,
  );
  const insertChild = db.prepare(
    `INSERT INTO categories (name, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id`,
  );
  for (const [rootIndex, root] of categorySeed.entries()) {
    let rootRow = await db
      .prepare('SELECT * FROM categories WHERE parent_id IS NULL AND lower(name) = lower(?)')
      .get(root.name);
    if (!rootRow) {
      rootRow = await insertRoot.get(root.name, rootIndex, now, now);
    }
    categories.set(root.name, rootRow.id);
    for (const [childIndex, childName] of root.children.entries()) {
      let childRow = await db
        .prepare('SELECT * FROM categories WHERE parent_id = ? AND lower(name) = lower(?)')
        .get(rootRow.id, childName);
      if (!childRow) {
        childRow = await insertChild.get(childName, rootRow.id, childIndex, now, now);
      }
      categories.set(`${root.name}/${childName}`, childRow.id);
    }
  }
  const insertTag = db.prepare(
    'INSERT INTO tags (name, name_lower, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING id',
  );
  const tags = new Map();
  for (const name of tagSeed) {
    let tag = await db.prepare('SELECT * FROM tags WHERE name_lower = ?').get(name.toLowerCase());
    if (!tag) {
      tag = await insertTag.get(name, name.toLowerCase(), now, now);
    }
    tags.set(name, tag.id);
  }
  return { categories, tags };
}

function resolveSeedPayload(seed, taxonomy) {
  const categoryKey = seed.categoryPath.join('/');
  const categoryId = taxonomy.categories.get(categoryKey);
  if (!categoryId) throw new Error(`示例分类不存在：${categoryKey}`);
  const tagIds = seed.tags.map((name) => {
    const id = taxonomy.tags.get(name);
    if (!id) throw new Error(`示例标签不存在：${name}`);
    return String(id);
  });
  return {
    title: seed.title,
    stemMarkdown: seed.stemMarkdown,
    type: seed.type,
    difficulty: seed.difficulty,
    categoryId: String(categoryId),
    options: seed.options || [],
    answer: seed.answer || {},
    judgeConfig: seed.judgeConfig || {},
    analysisMarkdown: seed.analysisMarkdown || '',
    tagIds,
    sortOrder: seed.sortOrder ?? 0,
  };
}

async function main() {
  ensureDataDirs();
  const db = await openDatabase();
  await initSchema(db);
  const { user: admin, created: adminCreated } = await ensureAdmin(db);
  const { categories, tags } = await seedTaxonomy(db);

  let published = 0;
  let drafts = 0;
  const existingQuestions = Number(
    (await db.prepare('SELECT COUNT(*) AS count FROM questions').get()).count,
  );
  if (existingQuestions === 0) {
    await db.transaction(async () => {
      for (const [index, seed] of questionSeed.entries()) {
        const payload = resolveSeedPayload({ ...seed, sortOrder: index }, { categories, tags });
        const created = await createAdminQuestion(db, admin, payload);
        await publishAdminQuestion(db, admin, created.questionId);
        published += 1;
      }
      const payload = resolveSeedPayload(
        { ...draftQuestionSeed, sortOrder: questionSeed.length },
        { categories, tags },
      );
      await createAdminQuestion(db, admin, payload);
      drafts += 1;
    });
  }

  const counts = {
    categories: Number(
      (await db.prepare('SELECT COUNT(*) AS count FROM categories').get()).count,
    ),
    tags: Number((await db.prepare('SELECT COUNT(*) AS count FROM tags').get()).count),
    questions: Number((await db.prepare('SELECT COUNT(*) AS count FROM questions').get()).count),
    published: Number(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM questions WHERE status = 'published'")
          .get()
      ).count,
    ),
    draft: Number(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM questions WHERE status = 'draft'")
          .get()
      ).count,
    ),
  };

  console.log('\n────────────────────────────────────────');
  console.log('  题序 · 初始化完成');
  console.log(`  数据库      ${databaseLabel(db)}`);
  console.log('────────────────────────────────────────');
  console.log(`  分类        ${counts.categories}`);
  console.log(`  标签        ${counts.tags}`);
  console.log(`  题目        ${counts.questions}（已发布 ${counts.published} / 草稿 ${counts.draft}）`);
  if (adminCreated) {
    console.log('\n  管理员账户已创建：');
    console.log(`    用户名：${config.admin.username}`);
    console.log(`    密码：${config.admin.password}`);
    console.log('    上线前请通过 ADMIN_USERNAME / ADMIN_PASSWORD 环境变量重新初始化，或修改初始化脚本。');
  } else {
    console.log('\n  管理员账户已存在，未覆盖现有密码。');
  }
  console.log('\n  运行 npm run dev 开始开发；');
  console.log('  或运行 npm run build && npm start 以单进程方式启动。\n');
  await db.close();
}

main().catch((error) => {
  console.error('\n[题序] 初始化失败：', error);
  process.exitCode = 1;
});
