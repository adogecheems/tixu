import { config } from './config.js';
import { buildApp } from './app.js';
import { databaseIsEmpty, databaseLabel, initSchema, openDatabase } from './db.js';

let app;
let db;
try {
  db = await openDatabase();
  await initSchema(db);
  if (await databaseIsEmpty(db)) {
    console.warn('\n[题序] 数据库尚未初始化。请先运行：npm run setup\n');
  }
  app = await buildApp({ db });
  await app.listen({ host: config.host, port: config.port });
  const showHost = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  console.log(`\n题序已启动：http://${showHost}:${config.port}`);
  console.log(`数据库：${databaseLabel(db)}\n`);
} catch (error) {
  console.error('[题序] 启动失败：', error);
  process.exitCode = 1;
  if (app) await app.close().catch(() => {});
  else if (db) await db.close().catch(() => {});
}

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`\n收到 ${signal}，正在关闭服务…`);
  try {
    await app?.close();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
