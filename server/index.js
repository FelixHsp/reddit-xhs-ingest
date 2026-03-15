import cors from "cors";
import Database from "better-sqlite3";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH =
  process.env.DB_PATH ||
  "/home/ubuntu/.openclaw/workspace/reddit_xhs_ingest/data/reddit_xhs.db";
const PORT = Number(process.env.PORT || 8787);
const DEV_FRONTEND_URL = process.env.DEV_FRONTEND_URL || "http://127.0.0.1:5174";
const DIST_DIR = path.resolve(__dirname, "../dist");
const DIST_INDEX = path.join(DIST_DIR, "index.html");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const app = express();
app.use(cors());
app.use(express.json());

function parseIntParam(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSummary() {
  const topicCount = db
    .prepare("select count(*) as count from topics_raw")
    .get().count;
  const commentCount = db
    .prepare("select count(*) as count from comments_raw")
    .get().count;
  const labeledTopics = db
    .prepare("select count(*) as count from topic_labels")
    .get().count;
  const labeledComments = db
    .prepare("select count(*) as count from comment_labels")
    .get().count;
  const subredditBreakdown = db
    .prepare(
      `select subreddit,
              count(*) as topic_count,
              sum(case when topic_labels.topic_id is not null then 1 else 0 end) as labeled_count
       from topics_raw
       left join topic_labels on topic_labels.topic_id = topics_raw.topic_id
       group by subreddit
       order by topic_count desc`
    )
    .all();

  return {
    topicCount,
    commentCount,
    labeledTopics,
    labeledComments,
    subredditBreakdown,
  };
}

app.get("/api/summary", (_req, res) => {
  res.json(getSummary());
});

app.get("/api/topics", (req, res) => {
  const search = String(req.query.search || "").trim();
  const subreddit = String(req.query.subreddit || "").trim();
  const labeled = String(req.query.labeled || "all").trim();
  const limit = Math.min(parseIntParam(req.query.limit, 30), 100);
  const offset = Math.max(parseIntParam(req.query.offset, 0), 0);

  const filters = [];
  const params = [];

  if (subreddit) {
    filters.push("topics_raw.subreddit = ?");
    params.push(subreddit);
  }

  if (search) {
    filters.push(
      "(topics_raw.title like ? or topics_raw.selftext like ? or topics_raw.author like ?)"
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (labeled === "labeled") {
    filters.push("topic_labels.topic_id is not null");
  } else if (labeled === "unlabeled") {
    filters.push("topic_labels.topic_id is null");
  }

  const whereClause = filters.length ? `where ${filters.join(" and ")}` : "";

  const listSql = `
    select
      topics_raw.topic_id,
      topics_raw.subreddit,
      topics_raw.title,
      topics_raw.selftext,
      topics_raw.author,
      topics_raw.updated_utc,
      topics_raw.created_utc,
      topics_raw.over_18,
      topics_raw.locked,
      count(comments_raw.comment_id) as comment_count,
      topic_labels.topic_pick_score,
      topic_labels.xhs_fit,
      topic_labels.topic_type,
      topic_labels.updated_at as label_updated_at
    from topics_raw
    left join comments_raw on comments_raw.topic_id = topics_raw.topic_id
    left join topic_labels on topic_labels.topic_id = topics_raw.topic_id
    ${whereClause}
    group by topics_raw.topic_id
    order by coalesce(topic_labels.updated_at, topics_raw.updated_utc) desc
    limit ? offset ?
  `;

  const totalSql = `
    select count(*) as total
    from topics_raw
    left join topic_labels on topic_labels.topic_id = topics_raw.topic_id
    ${whereClause}
  `;

  const items = db.prepare(listSql).all(...params, limit, offset);
  const total = db.prepare(totalSql).get(...params).total;

  res.json({
    items,
    total,
    limit,
    offset,
  });
});

app.get("/api/topics/:topicId", (req, res) => {
  const { topicId } = req.params;
  const topic = db
    .prepare(
      `select topics_raw.*,
              topic_labels.topic_type,
              topic_labels.xhs_fit,
              topic_labels.comment_potential,
              topic_labels.topic_pick_score,
              topic_labels.notes,
              topic_labels.updated_at as label_updated_at
       from topics_raw
       left join topic_labels on topic_labels.topic_id = topics_raw.topic_id
       where topics_raw.topic_id = ?`
    )
    .get(topicId);

  if (!topic) {
    res.status(404).json({ error: "Topic not found" });
    return;
  }

  const comments = db
    .prepare(
      `select comments_raw.*,
              comment_labels.comment_intent,
              comment_labels.standalone,
              comment_labels.xhs_fit,
              comment_labels.comment_pick_score,
              comment_labels.notes,
              comment_labels.updated_at as label_updated_at
       from comments_raw
       left join comment_labels on comment_labels.comment_id = comments_raw.comment_id
       where comments_raw.topic_id = ?
       order by coalesce(comment_labels.updated_at, comments_raw.updated_utc) desc`
    )
    .all(topicId);

  res.json({
    topic,
    comments,
  });
});

app.post("/api/topics/:topicId/label", (req, res) => {
  const { topicId } = req.params;
  const {
    topic_type = "",
    xhs_fit = "",
    comment_potential = "",
    topic_pick_score = null,
    notes = "",
  } = req.body || {};

  db.prepare(
    `insert into topic_labels (
      topic_id, topic_type, xhs_fit, comment_potential, topic_pick_score, notes, updated_at
    ) values (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    on conflict(topic_id) do update set
      topic_type = excluded.topic_type,
      xhs_fit = excluded.xhs_fit,
      comment_potential = excluded.comment_potential,
      topic_pick_score = excluded.topic_pick_score,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP`
  ).run(
    topicId,
    topic_type,
    xhs_fit,
    comment_potential,
    topic_pick_score === "" || topic_pick_score == null ? null : Number(topic_pick_score),
    notes
  );

  res.json({
    ok: true,
    label: db.prepare("select * from topic_labels where topic_id = ?").get(topicId),
  });
});

app.post("/api/comments/:commentId/label", (req, res) => {
  const { commentId } = req.params;
  const {
    comment_intent = "",
    standalone = "",
    xhs_fit = "",
    comment_pick_score = null,
    notes = "",
  } = req.body || {};

  db.prepare(
    `insert into comment_labels (
      comment_id, comment_intent, standalone, xhs_fit, comment_pick_score, notes, updated_at
    ) values (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    on conflict(comment_id) do update set
      comment_intent = excluded.comment_intent,
      standalone = excluded.standalone,
      xhs_fit = excluded.xhs_fit,
      comment_pick_score = excluded.comment_pick_score,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP`
  ).run(
    commentId,
    comment_intent,
    standalone,
    xhs_fit,
    comment_pick_score === "" || comment_pick_score == null ? null : Number(comment_pick_score),
    notes
  );

  res.json({
    ok: true,
    label: db
      .prepare("select * from comment_labels where comment_id = ?")
      .get(commentId),
  });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }

  if (fs.existsSync(DIST_INDEX)) {
    res.type("html").send(fs.readFileSync(DIST_INDEX, "utf8"));
    return;
  }

  const target = `${DEV_FRONTEND_URL}${req.originalUrl}`;
  res.redirect(302, target);
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
  console.log(`Using database: ${DB_PATH}`);
});
