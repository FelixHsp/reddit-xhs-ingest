# Reddit XHS Label Studio

基于 `React + Tailwind CSS + shadcn 风格组件 + Express + SQLite` 的本地打标平台，用于浏览和标注 Reddit 话题与评论候选。

## 特性

- 直接读取旧项目数据库：`/home/ubuntu/.openclaw/workspace/reddit_xhs_ingest/data/reddit_xhs.db`
- 话题列表筛选：搜索、subreddit、已标/未标
- 话题详情与评论联动浏览
- 直接写回 `topic_labels` / `comment_labels`
- 移动端友好：筛选器弹层、单列内容流、较大点击区域

## 启动

```bash
npm install
npm run dev
```

默认端口：

- 前端：`http://localhost:5173` 或自动顺延端口
- API：`http://localhost:8787`

## 构建

```bash
npm run build
```

## 环境变量

- `DB_PATH`：自定义 SQLite 文件路径
- `PORT`：自定义 API 端口
