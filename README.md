# 题序 TIXU · 在线刷题平台

一个可本地运行的完整全栈刷题平台：游客与账户学习记录、五种题型、即时判题、错题本、收藏夹、作答历史、题目版本管理、批量操作、JSON / ZIP 导入、浅色与深色主题。

## 技术栈

| 层次 | 方案 |
| --- | --- |
| 前端 | Vue 3、JavaScript、Vite |
| 后端 | Node.js、Fastify |
| 数据库 | SQLite 或 PostgreSQL |
| 渲染 | markdown-it + KaTeX |
| 样式 | 原生 CSS |

## 快速开始

环境要求：**Node.js ≥ 20.19**。默认使用本地 SQLite；如需 PostgreSQL，见下方「可选：使用 PostgreSQL」。

```bash
npm install
npm run setup
npm run dev
```

- 浏览器访问开发地址：**<http://127.0.0.1:5173>**
- 后端 API：<http://127.0.0.1:3000>
- `npm run setup` 会创建数据库、示例分类、示例题目与管理员账户，并打印管理员凭据。

默认管理员账户：

```text
用户名：admin
密码：admin12345
```

该默认密码仅用于本地 Demo。若要使用自己的管理员密码，请在首次执行 setup 之前设置环境变量：

```bash
ADMIN_USERNAME=myadmin ADMIN_PASSWORD='a-long-password' npm run setup
# 管理员已存在时，重新运行 setup 不会覆盖密码。
```

### 构建与单进程运行

```bash
npm run build
npm start
```

构建完成后，Fastify 同时提供 `/api/v1`、`/uploads/*` 与前端页面，默认访问

**<http://127.0.0.1:3000>**

首次启动前仍需执行 `npm run setup`。

### 可选：使用 PostgreSQL

不设置 `DATABASE_URL` 时，项目使用本地 `data/tixu.db`。设置后，所有业务数据改由 PostgreSQL 保存；数据库结构由 `npm run setup` 自动创建，无需手动执行 SQL 迁移文件。

```bash
# 1. 准备一个可用的空数据库
createdb tixu

# 2. 初始化表结构、示例数据和管理员
DATABASE_URL='postgres://tixu:password@127.0.0.1:5432/tixu' npm run setup

# 3. 启动
DATABASE_URL='postgres://tixu:password@127.0.0.1:5432/tixu' npm start
```

也可以写入根目录 `.env`：

```dotenv
DATABASE_URL=postgres://tixu:password@127.0.0.1:5432/tixu
```

- `DATABASE_URL` 优先于 `DATABASE_PATH`；留空或删除该变量即回到 SQLite。
- 使用托管数据库时，请在 URL 中携带 SSL 参数，例如 `?sslmode=require`。
- `PG_POOL_MAX` 可调整 PostgreSQL 连接池上限，默认 `10`。
- 图片与导入资源仍保存在本地 `UPLOAD_DIR`，不会上传到 PostgreSQL。
- SQLite 与 PostgreSQL 之间不会自动迁移数据。切换前请自行导出 / 导入，或重新运行 setup 创建示例数据。
- setup 会创建缺失的表和示例内容，可重复执行；已有管理员密码不会被覆盖。

### 重置数据

SQLite：

```bash
rm -rf data
npm run setup
```

## 常用命令

```bash
npm run setup        # 初始化 / 补全示例数据和管理员
npm run dev          # 同时启动 Fastify（3000）与 Vite（5173）
npm run dev:server   # 只启动后端，watch 模式
npm run dev:web      # 只启动 Vite
npm run build        # 构建前端到 dist/
npm start            # 生产模式单进程启动
npm test             # API 集成测试（默认临时 SQLite，不影响 data/）
```

## 配置

项目会自动读取根目录 `.env`（如果存在），也可以直接通过 shell 环境变量覆盖。参考 `.env.example`。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 监听地址；局域网访问可设为 `0.0.0.0` |
| `PORT` | `3000` | 后端端口 |
| `DATABASE_URL` | 空 | PostgreSQL 连接 URL；设置后启用 PostgreSQL，并忽略 `DATABASE_PATH` |
| `DATABASE_PATH` | `./data/tixu.db` | 未设置 `DATABASE_URL` 时使用的 SQLite 数据库路径 |
| `PG_POOL_MAX` | `10` | PostgreSQL 连接池上限 |
| `PUBLIC_CACHE_TTL_SECONDS` | `10` | 分类、标签与首页公开统计的进程内缓存时间；设为 `0` 关闭 |
| `UPLOAD_DIR` | `./data/uploads` | 图片上传与导入资源目录 |
| `SESSION_DAYS` | `30` | 登录会话有效期（天） |
| `COOKIE_SECURE` | `false` | 部署在 HTTPS 后设置为 `true` |
| `ADMIN_USERNAME` | `admin` | 首次 setup 创建的管理员用户名 |
| `ADMIN_PASSWORD` | `admin12345` | 首次 setup 创建的管理员密码 |
| `MAX_UPLOAD_MB` | `5` | 单张图片大小上限 |
| `MAX_IMPORT_MB` | `15` | 单个导入文件大小上限 |
| `MAX_IMPORT_UNCOMPRESSED_MB` | `25` | ZIP 解压后总大小上限 |
| `ALLOWED_ORIGINS` | 空 | 额外允许的 CSRF Origin，逗号分隔；需写完整 scheme://host[:port]，不要带路径 |
| `TRUST_PROXY` | `false` | 可信反向代理跳数；HTTPS 终止通常设为 `1` 或 `true` |
| `LOG_LEVEL` | `info` | Fastify 日志等级 |

开发模式下，Vite 通过代理访问后端，默认允许 `localhost:5173` / `127.0.0.1:5173`。如果修改开发端口，请同步设置 `ALLOWED_ORIGINS`。

## 功能一览

### 前台

- 开始页：面向访客的单页介绍、能力概览、题库数据与学科快捷入口、学习概览和一道公开题目预览；登录用户默认进入题库。
- 题库：分类（一级包含二级）、题型多选、难度、标签 AND 筛选、标题 / 题干搜索、排序、分页。
- 单题浏览：五种题型、Markdown / LaTeX / 图片、主动提交、服务端判题、解析展开、无限次重新作答、收藏。
- 题干与解析在正式刷题页和管理员预览中复用同一个 `QuestionAnswerArea` 渲染组件。
- 题目导航：进入时建立稳定 ID 快照；支持列表、搜索结果、错题本、收藏夹来源；刷新后可恢复；直接 URL 不推断前后题。
- 错题本：客观题答错进入、再次答对移出；简答题自评决定是否保留；按最近错误或累计错误次数排序。
- 收藏夹：可收藏未作答题目；收藏与错题状态互不影响；记录收藏时间。
- 作答历史：独立记录每次提交；展示当时的题目版本、用户答案、标准答案、解析与自评；支持题型、结果、题目关键词筛选。
- 草稿：未提交答案保存在浏览器 IndexedDB；游客与每个账户命名空间隔离；提交成功后清除；刷新和切题后可恢复。
- 游客学习数据：IndexedDB；登录后不静默上传，由用户确认合并；合并失败不删除本地数据；合并成功后清理本地游客学习记录，避免重复恢复已取消的收藏。
- 注册、登录、退出、30 天 HttpOnly 会话；主题偏好保存在 localStorage，支持跟随系统 / 浅色 / 深色。

### 管理后台

- 概览：题目状态、待发布修订、近 7 日作答、最近编辑。
- 题目管理：状态筛选、搜索、题型筛选、按页多选、批量发布、批量归档。
- 生命周期：草稿 → 已发布 → 已归档；已发布题目可保存独立修改草稿；发布修订生成不可变新版本；归档可恢复。
- 编辑器：基本信息、题干、题型配置、标准答案 / 判题规则、解析；左右实时预览；支持图片上传、Markdown 与 LaTeX；标签支持搜索选择、直接新建并自动选中。
- 五种题型均有独立配置表单与预览。
- 复制为新草稿；从未发布且无历史引用的草稿可以删除；已发布题目受到保护。
- 批量发布事务一致性：任一题目校验失败，整批不执行，并展示逐题错误；批量归档同样为全成功或全失败。
- 分类管理：最多两级，包含直接的题目与子分类题目；被引用分类不能删除。
- 标签管理：创建、重命名、合并、删除未使用标签；标签引用同时考虑发布题目与草稿。
- 批量导入：JSON / ZIP → 解析 → 校验 → 预览 → 管理员确认 → 创建草稿 → 导入报告；默认不自动创建分类 / 标签，不覆盖已有题目。

## 导入格式

### JSON

```json
{
  "version": 1,
  "questions": [
    {
      "title": "函数求值",
      "type": "single",
      "difficulty": "easy",
      "categoryPath": ["高等数学", "函数与极限"],
      "tags": ["基础"],
      "stem": "已知 $f(x)=x^2-1$，则 $f(2)=$（ ）。",
      "options": [
        { "id": "A", "text": "2" },
        { "id": "B", "text": "3" }
      ],
      "answer": { "optionId": "B" },
      "analysis": "代入 $x=2$，得 $3$。"
    }
  ]
}
```

`categoryPath` 与 `tags` 必须匹配系统中已经存在的分类路径和标签名称。

不同题型的答案字段：

```json
{ "answer": { "optionId": "B" } }
{ "answer": { "optionIds": ["A", "C"] } }
{ "answer": { "value": true } }
{
  "answer": { "blanks": [["3", "3.0"], ["42"]] },
  "judgeConfig": {
    "blanks": [{ "placeholder": "输入结果" }, { "placeholder": "第二空" }],
    "caseSensitive": false,
    "trimWhitespace": true,
    "collapseWhitespace": false
  }
}
{ "answer": { "referenceMarkdown": "参考答案内容" } }
```

### ZIP

```text
questions.json
assets/
  diagram-1.png
  formula.png
```

- 仅允许 `questions.json` 与 `assets/` 下的 PNG、JPEG、GIF、WebP 图片。
- 在 Markdown 中使用 `![说明](assets/diagram-1.png)`；导入后会重写为本地 `/uploads/...` 地址。
- 任意题目校验失败则整批拒绝。

## 项目结构

```text
.
├── client/
│   ├── index.html
│   └── src/
│       ├── components/        # 公共组件、题库渲染、编辑器、弹窗、Toast 等
│       ├── views/             # 前台页面
│       ├── views/admin/       # 管理后台
│       ├── lib/               # API、Markdown 渲染、IndexedDB、导航快照等
│       ├── stores/            # 认证、主题、Toast、学习数据版本
│       └── styles/            # Token 与基础样式
├── server/
│   ├── app.js                 # Fastify 应用装配
│   ├── index.js               # 单进程启动
│   ├── setup.js               # 数据库 / 示例数据 / 管理员初始化
│   ├── db.js                  # SQLite / PostgreSQL 适配、Schema 与事务
│   ├── auth.js                # 密码、会话、CSRF、权限
│   ├── routes/                # public / auth / study / admin
│   ├── services/              # 判题、学习状态、版本、导入、上传等
│   └── seedData.js
├── tests/api.integration.js
├── vite.config.js
└── package.json
```

## 主要端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/auth/me` | 当前会话与 CSRF Cookie |
| POST | `/auth/register` | 注册并自动登录 |
| POST | `/auth/login` / `/auth/logout` | 登录 / 退出 |
| POST | `/auth/merge` | 合并游客学习记录 |
| GET | `/home` `/categories` `/tags` | 公开首页数据与分类标签 |
| GET | `/questions` `/questions/ids` `/questions/:id` | 公开题库、轻量 ID 列表、单题 |
| POST | `/questions/:id/submit` | 服务端判题；登录用户写入历史，游客不落库 |
| GET | `/me/attempts` `/me/attempts/:id` | 作答历史列表与详情 |
| PATCH | `/me/attempts/:id/assessment` | 简答题一次性自评 |
| GET | `/me/wrong` `/me/wrong/ids` | 当前错题 |
| GET | `/me/favorites` `/me/favorites/ids` | 当前收藏 |
| PUT | `/me/favorites/:questionId` | 收藏 / 取消收藏 |
| GET / POST / PUT / DELETE | `/admin/questions...` | 题目列表、详情、草稿、发布、归档、复制、批量操作 |
| GET / POST / PUT / DELETE | `/admin/categories...` `/admin/tags...` | 分类与标签管理 |
| POST | `/admin/uploads` | 图片上传 |
| POST | `/admin/import/preview` `/admin/import/confirm` | 导入预览与确认 |
| GET | `/health` `/healthz` | 健康检查 |

标准答案与解析不会出现在公开列表 / 详情接口中，只在有效提交响应、管理员接口和用户自己的历史详情中返回。
