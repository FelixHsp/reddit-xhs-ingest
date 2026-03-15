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

- 前端开发：`http://0.0.0.0:5173` 或自动顺延端口
- 前端预览 / systemd Web：`http://0.0.0.0:4174`
- API：`http://0.0.0.0:8787`

说明：

- `npm run dev` / `npm start` 只会启动前台进程，不会自动变成守护进程
- 如果需要长期驻留，应使用 `systemd`、`pm2`、`nohup` 或容器编排来托管

## systemd

仓库内已提供服务文件：

- `deploy/systemd/reddit-xhs-api.service`
- `deploy/systemd/reddit-xhs-web.service`

推荐部署步骤：

```bash
npm install
npm run build
sudo cp deploy/systemd/reddit-xhs-api.service /etc/systemd/system/
sudo cp deploy/systemd/reddit-xhs-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now reddit-xhs-api.service
sudo systemctl enable --now reddit-xhs-web.service
```

常用命令：

```bash
sudo systemctl status reddit-xhs-api.service
sudo systemctl status reddit-xhs-web.service
sudo systemctl restart reddit-xhs-api.service
sudo systemctl restart reddit-xhs-web.service
```

## 构建

```bash
npm run build
```

## 环境变量

- `DB_PATH`：自定义 SQLite 文件路径
- `PORT`：自定义 API 端口
