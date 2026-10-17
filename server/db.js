import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import Database from 'better-sqlite3';
import { config } from './config.js';

const transactionContext = new AsyncLocalStorage();

const sqliteSchema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique
  ON categories(COALESCE(parent_id, 0), lower(name));

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_lower TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  current_version_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id);

CREATE TABLE IF NOT EXISTS question_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  version_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  stem_markdown TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('single', 'multiple', 'truefalse', 'fill', 'essay')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  options_json TEXT NOT NULL DEFAULT '[]',
  analysis_markdown TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(question_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_versions_question ON question_versions(question_id);

CREATE TABLE IF NOT EXISTS question_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id INTEGER NOT NULL UNIQUE REFERENCES question_versions(id) ON DELETE RESTRICT,
  answer_json TEXT NOT NULL,
  judge_config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_drafts (
  question_id INTEGER PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  stem_markdown TEXT NOT NULL DEFAULT '',
  question_type TEXT NOT NULL DEFAULT 'single' CHECK (question_type IN ('single', 'multiple', 'truefalse', 'fill', 'essay')),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  options_json TEXT NOT NULL DEFAULT '[]',
  answer_json TEXT NOT NULL DEFAULT '{}',
  judge_config_json TEXT NOT NULL DEFAULT '{}',
  analysis_markdown TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS question_tags (
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_question_tags_tag ON question_tags(tag_id);

CREATE TABLE IF NOT EXISTS answer_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  version_id INTEGER REFERENCES question_versions(id) ON DELETE SET NULL,
  source_version_ref TEXT,
  client_event_id TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  is_correct INTEGER,
  self_assessment TEXT CHECK (self_assessment IN ('mastered', 'not_mastered')),
  submitted_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 1 CHECK (verified IN (0, 1)),
  source TEXT NOT NULL DEFAULT 'native' CHECK (source IN ('native', 'merge')),
  UNIQUE(user_id, client_event_id)
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_time ON answer_records(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON answer_records(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_version ON answer_records(version_id);

CREATE TABLE IF NOT EXISTS user_question_states (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  favorite INTEGER NOT NULL DEFAULT 0,
  favorited_at TEXT,
  in_wrong_book INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  last_wrong_at TEXT,
  last_answered_at TEXT,
  last_attempt_id INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_states_favorite ON user_question_states(user_id, favorite);
CREATE INDEX IF NOT EXISTS idx_states_wrong ON user_question_states(user_id, in_wrong_book);
`;

const postgresSchema = `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id BIGINT REFERENCES categories(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique
  ON categories((COALESCE(parent_id, 0)), (lower(name)));

CREATE TABLE IF NOT EXISTS tags (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  name_lower TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  category_id BIGINT REFERENCES categories(id) ON DELETE RESTRICT,
  current_version_id BIGINT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id);

CREATE TABLE IF NOT EXISTS question_versions (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  version_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  stem_markdown TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('single', 'multiple', 'truefalse', 'fill', 'essay')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  category_id BIGINT REFERENCES categories(id) ON DELETE RESTRICT,
  options_json TEXT NOT NULL DEFAULT '[]',
  analysis_markdown TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(question_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_versions_question ON question_versions(question_id);

CREATE TABLE IF NOT EXISTS question_answers (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  version_id BIGINT NOT NULL UNIQUE REFERENCES question_versions(id) ON DELETE RESTRICT,
  answer_json TEXT NOT NULL,
  judge_config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_drafts (
  question_id BIGINT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  stem_markdown TEXT NOT NULL DEFAULT '',
  question_type TEXT NOT NULL DEFAULT 'single' CHECK (question_type IN ('single', 'multiple', 'truefalse', 'fill', 'essay')),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  category_id BIGINT REFERENCES categories(id) ON DELETE RESTRICT,
  options_json TEXT NOT NULL DEFAULT '[]',
  answer_json TEXT NOT NULL DEFAULT '{}',
  judge_config_json TEXT NOT NULL DEFAULT '{}',
  analysis_markdown TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS question_tags (
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_question_tags_tag ON question_tags(tag_id);

CREATE TABLE IF NOT EXISTS answer_records (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  version_id BIGINT REFERENCES question_versions(id) ON DELETE SET NULL,
  source_version_ref TEXT,
  client_event_id TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  is_correct INTEGER,
  self_assessment TEXT CHECK (self_assessment IN ('mastered', 'not_mastered')),
  submitted_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 1 CHECK (verified IN (0, 1)),
  source TEXT NOT NULL DEFAULT 'native' CHECK (source IN ('native', 'merge')),
  UNIQUE(user_id, client_event_id)
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_time ON answer_records(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON answer_records(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_version ON answer_records(version_id);

CREATE TABLE IF NOT EXISTS user_question_states (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  favorite INTEGER NOT NULL DEFAULT 0,
  favorited_at TEXT,
  in_wrong_book INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  last_wrong_at TEXT,
  last_answered_at TEXT,
  last_attempt_id BIGINT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_states_favorite ON user_question_states(user_id, favorite);
CREATE INDEX IF NOT EXISTS idx_states_wrong ON user_question_states(user_id, in_wrong_book);
`;

function convertPlaceholders(sql) {
  let output = '';
  let index = 0;
  let quote = null;
  let i = 0;
  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];

    if (quote) {
      output += char;
      if (char === quote) {
        if (next === quote) {
          output += next;
          i += 2;
          continue;
        }
        quote = null;
      }
      i += 1;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      output += char;
      i += 1;
      continue;
    }

    if (char === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      if (end === -1) return `${output}${sql.slice(i)}`;
      output += sql.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    if (char === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) return `${output}${sql.slice(i)}`;
      output += sql.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    if (char === '?') {
      index += 1;
      output += `$${index}`;
      i += 1;
      continue;
    }

    if (
      (char === 'L' || char === 'l') &&
      sql.slice(i, i + 4).toUpperCase() === 'LIKE' &&
      !/[A-Za-z0-9_]/.test(sql[i - 1] || '') &&
      !/[A-Za-z0-9_]/.test(sql[i + 4] || '')
    ) {
      output += 'ILIKE';
      i += 4;
      continue;
    }

    output += char;
    i += 1;
  }
  return output;
}

class SqliteDatabase {
  constructor(base) {
    this.dialect = 'sqlite';
    this.base = base;
    this.tail = Promise.resolve();
    this.statements = new Map();
  }

  queue(operation) {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  statement(sql) {
    let statement = this.statements.get(sql);
    if (!statement) {
      statement = this.base.prepare(sql);
      this.statements.set(sql, statement);
    }
    return statement;
  }

  inTransaction() {
    const store = transactionContext.getStore();
    return store?.database === this ? store : null;
  }

  prepare(sql) {
    const execute = (method, params) => {
      const operation = () => this.statement(sql)[method](...params);
      return this.inTransaction() ? Promise.resolve().then(operation) : this.queue(operation);
    };
    return {
      get: (...params) => execute('get', params),
      all: (...params) => execute('all', params),
      run: (...params) => execute('run', params),
    };
  }

  async exec(sql) {
    const operation = () => this.base.exec(sql);
    if (this.inTransaction()) {
      operation();
      return;
    }
    await this.queue(operation);
  }

  async transaction(callback) {
    const current = this.inTransaction();
    if (current) {
      const depth = current.depth + 1;
      const savepoint = `tixu_savepoint_${depth}`;
      this.base.exec(`SAVEPOINT ${savepoint}`);
      try {
        const result = await transactionContext.run(
          { database: this, depth, dialect: this.dialect },
          callback,
        );
        this.base.exec(`RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (error) {
        this.base.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        this.base.exec(`RELEASE SAVEPOINT ${savepoint}`);
        throw error;
      }
    }

    return this.queue(async () => {
      this.base.exec('BEGIN IMMEDIATE');
      try {
        const result = await transactionContext.run(
          { database: this, depth: 0, dialect: this.dialect },
          callback,
        );
        this.base.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          this.base.exec('ROLLBACK');
        } catch {
          // Preserve the original error if rollback itself fails.
        }
        throw error;
      }
    });
  }

  async ping() {
    await this.prepare('SELECT 1 AS ok').get();
    return true;
  }

  async close() {
    await this.queue(() => {
      this.statements.clear();
      this.base.close();
    });
  }
}

class PostgresDatabase {
  constructor(pool) {
    this.dialect = 'postgres';
    this.pool = pool;
  }

  transactionClient() {
    const store = transactionContext.getStore();
    return store?.database === this ? store : null;
  }

  async execute(sql, params = []) {
    const store = this.transactionClient();
    const text = convertPlaceholders(sql);
    const runner = store?.client || this.pool;
    return runner.query(text, params);
  }

  prepare(sql) {
    return {
      get: async (...params) => {
        const result = await this.execute(sql, params);
        return result.rows[0] || null;
      },
      all: async (...params) => {
        const result = await this.execute(sql, params);
        return result.rows;
      },
      run: async (...params) => {
        const result = await this.execute(sql, params);
        return { changes: result.rowCount || 0 };
      },
    };
  }

  async exec(sql) {
    await this.execute(sql);
  }

  async transaction(callback) {
    const current = this.transactionClient();
    if (current) {
      const depth = current.depth + 1;
      const savepoint = `tixu_savepoint_${depth}`;
      await current.client.query(`SAVEPOINT ${savepoint}`);
      try {
        const result = await transactionContext.run(
          { database: this, client: current.client, depth, dialect: this.dialect },
          callback,
        );
        await current.client.query(`RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (error) {
        await current.client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await current.client.query(`RELEASE SAVEPOINT ${savepoint}`);
        throw error;
      }
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await transactionContext.run(
        { database: this, client, depth: 0, dialect: this.dialect },
        callback,
      );
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original error if rollback itself fails.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async ping() {
    await this.pool.query('SELECT 1');
    return true;
  }

  async close() {
    await this.pool.end();
  }
}

async function openPostgresDatabase() {
  let url;
  try {
    url = new URL(config.databaseUrl);
  } catch {
    throw new Error('DATABASE_URL 不是合法的 PostgreSQL 连接 URL。');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL 必须使用 postgres:// 或 postgresql:// 协议。');
  }

  const pgModule = await import('pg');
  const pg = pgModule.default || pgModule;
  pg.types.setTypeParser(20, (value) => Number(value));
  pg.types.setTypeParser(1700, (value) => Number(value));

  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: config.postgresPoolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'tixu',
  });
  pool.on('error', (error) => {
    console.error('[题序] PostgreSQL 连接池错误：', error.message);
  });

  const database = new PostgresDatabase(pool);
  await database.ping();
  return database;
}

export function isPostgresDatabase(db) {
  return db?.dialect === 'postgres';
}

export function isUniqueViolation(error) {
  return (
    error?.code === '23505' ||
    /UNIQUE constraint failed/i.test(String(error?.message || ''))
  );
}

export function ensureDataDirs() {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  if (!config.databaseUrl) {
    fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  }
}

export async function openDatabase(file = config.databasePath) {
  if (config.databaseUrl) {
    return openPostgresDatabase();
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const base = new Database(file);
  base.pragma('journal_mode = WAL');
  base.pragma('foreign_keys = ON');
  base.pragma('busy_timeout = 5000');
  base.pragma('synchronous = NORMAL');
  return new SqliteDatabase(base);
}

export async function initSchema(db) {
  if (isPostgresDatabase(db)) {
    await db.exec(postgresSchema);
    return;
  }
  await db.exec(sqliteSchema);
  db.base.pragma('user_version = 1');
}

export async function databaseIsEmpty(db) {
  const row = await db.prepare('SELECT COUNT(*) AS count FROM users').get();
  return Number(row?.count || 0) === 0;
}

export function databaseLabel(db) {
  return isPostgresDatabase(db) ? 'PostgreSQL' : 'SQLite';
}

export { convertPlaceholders };
