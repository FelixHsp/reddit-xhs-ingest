import type { ChangeEvent, ReactNode } from "react";
import { useDeferredValue, useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  Filter,
  Flame,
  LoaderCircle,
  MessageSquareText,
  NotebookPen,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type TopicListItem = {
  topic_id: string;
  subreddit: string;
  title: string;
  selftext: string;
  author: string;
  updated_utc: string;
  created_utc: string;
  over_18: number;
  locked: number;
  score?: number | null;
  num_comments?: number | null;
  comment_count: number;
  topic_pick_score: number | null;
  xhs_fit: string | null;
  topic_type: string | null;
  label_updated_at: string | null;
};

type TopicDetail = TopicListItem & {
  permalink: string;
  comment_potential: string | null;
  notes: string | null;
};

type CommentItem = {
  comment_id: string;
  body: string;
  author: string;
  updated_utc: string;
  score: number | null;
  comment_intent: string | null;
  standalone: string | null;
  xhs_fit: string | null;
  comment_pick_score: number | null;
  notes: string | null;
  label_updated_at: string | null;
};

type Summary = {
  topicCount: number;
  commentCount: number;
  labeledTopics: number;
  labeledComments: number;
  subredditBreakdown: {
    subreddit: string;
    topic_count: number;
    labeled_count: number;
  }[];
};

type TopicResponse = {
  items: TopicListItem[];
  total: number;
};

type DetailResponse = {
  topic: TopicDetail;
  comments: CommentItem[];
};

type TopicFormState = {
  topic_type: string;
  xhs_fit: string;
  comment_potential: string;
  topic_pick_score: string;
  notes: string;
};

const topicTypeOptions = ["生活", "情感", "职场", "成长", "故事", "争议", "信息流", "待定"];
const fitOptions = ["高", "中", "低", "待定"];
const potentialOptions = ["高", "中", "低", "未知"];
const standaloneOptions = ["是", "不是", "待定"];
const commentIntentOptions = [
  "有梗",
  "同理心",
  "观点补充",
  "反转",
  "短评，适合渐入引导",
  "信息型",
  "经验分享",
  "建议/支招",
  "情绪共鸣",
  "吐槽/调侃",
  "金句总结",
  "故事补充",
  "反问/追问",
  "纠错/澄清",
  "不适合",
];

const emptyTopicForm: TopicFormState = {
  topic_type: "",
  xhs_fit: "",
  comment_potential: "",
  topic_pick_score: "",
  notes: "",
};

function formatDate(value?: string | null) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeZh(value?: string | null) {
  if (!value) return "";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "";

  const diffMs = Date.now() - target.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `约${diffMinutes}分钟前`;
  if (diffMinutes < 1440) return `约${Math.floor(diffMinutes / 60)}小时前`;
  if (diffMinutes < 10080) return `约${Math.floor(diffMinutes / 1440)}天前`;
  return formatDate(value);
}

function statLabel(value: string | null | undefined) {
  return value?.trim() ? value : "未标注";
}

function buildSearchParams(search: string, subreddit: string, labeled: string) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (subreddit !== "all") params.set("subreddit", subreddit);
  if (labeled !== "all") params.set("labeled", labeled);
  return params;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/topics/:topicId" element={<DetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function ListPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const subreddit = searchParams.get("subreddit") ?? "all";
  const labeled = searchParams.get("labeled") ?? "all";
  const deferredSearch = useDeferredValue(search);
  const location = useLocation();

  useEffect(() => {
    fetch("/api/summary")
      .then((res) => res.json())
      .then(setSummary)
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoadingList(true);
    const params = buildSearchParams(deferredSearch, subreddit, labeled);

    fetch(`/api/topics?${params.toString()}`)
      .then((res) => res.json())
      .then((data: TopicResponse) => {
        setTopics(data.items);
        setTotal(data.total);
      })
      .finally(() => setLoadingList(false));
  }, [deferredSearch, subreddit, labeled]);

  const subreddits = summary?.subredditBreakdown.map((item) => item.subreddit) ?? [];

  function updateFilter(next: { search?: string; subreddit?: string; labeled?: string }) {
    const params = buildSearchParams(
      next.search ?? search,
      next.subreddit ?? subreddit,
      next.labeled ?? labeled
    );
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4">
        <PageHeader summary={summary} />

        <Card className="overflow-hidden border-white/60 bg-white/80 backdrop-blur">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>候选列表</CardTitle>
                  <CardDescription>{total} 条候选内容</CardDescription>
                </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <Filter className="mr-2 h-4 w-4" />
                    筛选
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>筛选与检索</DialogTitle>
                    <DialogDescription>移动端将筛选器收进弹层，避免压缩候选列表。</DialogDescription>
                  </DialogHeader>
                  <FilterPanel
                    search={search}
                    setSearch={(value) => updateFilter({ search: value })}
                    subreddit={subreddit}
                    setSubreddit={(value) => updateFilter({ subreddit: value })}
                    labeled={labeled}
                    setLabeled={(value) => updateFilter({ labeled: value })}
                    subreddits={subreddits}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <div className="hidden lg:block">
              <FilterPanel
                search={search}
                setSearch={(value) => updateFilter({ search: value })}
                subreddit={subreddit}
                setSubreddit={(value) => updateFilter({ subreddit: value })}
                labeled={labeled}
                setLabeled={(value) => updateFilter({ labeled: value })}
                subreddits={subreddits}
              />
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-280px)] min-h-[480px]">
              {loadingList ? (
                <LoadingState label="正在加载候选列表" />
              ) : (
                <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
                  {topics.map((topic) => (
                    <Link
                      key={topic.topic_id}
                      to={`/topics/${topic.topic_id}${location.search}`}
                      className="rounded-2xl border border-border/70 bg-background/90 p-4 text-left transition hover:border-primary/40 hover:bg-secondary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Badge variant="outline">{topic.subreddit}</Badge>
                        {topic.xhs_fit ? <Badge>{topic.xhs_fit}</Badge> : <Badge variant="muted">未标注</Badge>}
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-base font-semibold">{topic.title}</h3>
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{topic.selftext || "无正文"}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>@{topic.author || "unknown"}</span>
                        <span>{topic.comment_count} 条评论</span>
                        <span>{formatDate(topic.updated_utc)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailPage() {
  const { topicId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [topicForm, setTopicForm] = useState<TopicFormState>(emptyTopicForm);
  const [savingTopic, setSavingTopic] = useState(false);
  const [savingCommentId, setSavingCommentId] = useState("");
  const [selectedCommentIds, setSelectedCommentIds] = useState<string[]>([]);
  const commentLabeled = searchParams.get("comment_labeled") ?? "all";

  async function loadDetail() {
    if (!topicId) return;
    setLoadingDetail(true);
    const data = await fetch(`/api/topics/${topicId}`).then((res) => res.json());
    setDetail(data);
    setTopicForm({
      topic_type: data.topic.topic_type ?? "",
      xhs_fit: data.topic.xhs_fit ?? "",
      comment_potential: data.topic.comment_potential ?? "",
      topic_pick_score: data.topic.topic_pick_score?.toString() ?? "",
      notes: data.topic.notes ?? "",
    });
    setLoadingDetail(false);
  }

  useEffect(() => {
    setSelectedCommentIds([]);
    loadDetail().catch(console.error);
  }, [topicId]);

  async function saveTopicLabel() {
    if (!topicId) return;
    setSavingTopic(true);
    try {
      const response = await fetch(`/api/topics/${topicId}/label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(topicForm),
      });
      const data = await response.json();

      setDetail((current) => {
        if (!current) return current;

        return {
          ...current,
          topic: {
            ...current.topic,
            topic_type: data.label.topic_type,
            xhs_fit: data.label.xhs_fit,
            comment_potential: data.label.comment_potential,
            topic_pick_score: data.label.topic_pick_score,
            notes: data.label.notes,
            label_updated_at: data.label.updated_at,
          },
        };
      });
    } finally {
      setSavingTopic(false);
    }
  }

  async function saveCommentLabel(commentId: string, payload: Record<string, string>) {
    setSavingCommentId(commentId);
    try {
      const response = await fetch(`/api/comments/${commentId}/label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      setDetail((current) => {
        if (!current) return current;

        return {
          ...current,
          comments: current.comments.map((comment) =>
            comment.comment_id === commentId
              ? {
                  ...comment,
                  comment_intent: data.label.comment_intent,
                  standalone: data.label.standalone,
                  xhs_fit: data.label.xhs_fit,
                  comment_pick_score: data.label.comment_pick_score,
                  notes: data.label.notes,
                  label_updated_at: data.label.updated_at,
                }
              : comment
          ),
        };
      });
    } finally {
      setSavingCommentId("");
    }
  }

  const filteredComments = detail?.comments.filter((comment) => {
    const isLabeled =
      Boolean(comment.comment_intent?.trim()) ||
      Boolean(comment.standalone?.trim()) ||
      Boolean(comment.xhs_fit?.trim()) ||
      comment.comment_pick_score !== null ||
      Boolean(comment.notes?.trim());

    if (commentLabeled === "labeled") return isLabeled;
    if (commentLabeled === "unlabeled") return !isLabeled;
    return true;
  });

  function updateCommentFilter(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("comment_labeled");
    else next.set("comment_labeled", value);
    setSearchParams(next, { replace: true });
  }

  const backParams = new URLSearchParams(location.search);
  backParams.delete("comment_labeled");
  const backTarget = backParams.toString() ? `/?${backParams.toString()}` : "/";
  const filteredCommentIds = filteredComments?.map((comment) => comment.comment_id) ?? [];
  const selectedFilteredCount = filteredCommentIds.filter((id) => selectedCommentIds.includes(id)).length;

  function toggleCommentSelected(commentId: string) {
    setSelectedCommentIds((current) =>
      current.includes(commentId)
        ? current.filter((id) => id !== commentId)
        : [...current, commentId]
    );
  }

  function selectAllFilteredComments() {
    setSelectedCommentIds((current) => Array.from(new Set([...current, ...filteredCommentIds])));
  }

  function clearSelectedComments() {
    setSelectedCommentIds([]);
  }

  function exportSelectedComments() {
    if (!detail || selectedCommentIds.length === 0) return;

    const selectedComments = selectedCommentIds
      .map((commentId) => detail.comments.find((comment) => comment.comment_id === commentId))
      .filter((comment): comment is CommentItem => Boolean(comment));

    const payload = {
      mainQuestionZh: "",
      titleEn: detail.topic.title || "",
      author: detail.topic.author || "",
      postUrl: detail.topic.permalink || "",
      subreddit: detail.topic.subreddit.startsWith("r/")
        ? detail.topic.subreddit
        : `r/${detail.topic.subreddit}`,
      quoteEn: "",
      time: formatRelativeZh(detail.topic.created_utc || detail.topic.updated_utc),
      upvotes: detail.topic.score !== null && detail.topic.score !== undefined ? String(detail.topic.score) : "",
      comments: "",
      contents: selectedComments.map((comment, index) => ({
        id: String(index + 1),
        author: comment.author || "",
        textEn: comment.body || "",
        textZh: "",
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `topic-${detail.topic.topic_id}-comments.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(backTarget)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回列表
          </Button>
          <Badge className="bg-primary/15 text-primary">话题详情</Badge>
        </div>

        <Card className="border-white/60 bg-white/80 backdrop-blur">
          <CardContent className="p-5 md:p-6">
            {loadingDetail ? (
              <LoadingState label="正在加载详情" />
            ) : detail ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 rounded-[28px] border border-white/60 bg-white/70 p-5 md:p-6">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{detail.topic.subreddit}</Badge>
                    <Badge>{statLabel(detail.topic.xhs_fit)}</Badge>
                    {detail.topic.locked ? <Badge variant="secondary">Locked</Badge> : null}
                    {detail.topic.over_18 ? <Badge variant="secondary">NSFW</Badge> : null}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div>
                      <h1 className="text-2xl font-semibold md:text-3xl">{detail.topic.title}</h1>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground md:text-base">
                        {detail.topic.selftext || "该话题没有可用正文，当前更适合从评论区挖掘可搬运素材。"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-secondary/60 p-4 text-sm">
                      <p className="font-medium">元信息</p>
                      <p className="mt-2 text-muted-foreground">作者：{detail.topic.author || "unknown"}</p>
                      <p className="text-muted-foreground">更新时间：{formatDate(detail.topic.updated_utc)}</p>
                      <p className="text-muted-foreground">评论数：{detail.comments.length}</p>
                      <a
                        className="mt-3 inline-flex text-primary underline-offset-4 hover:underline"
                        href={detail.topic.permalink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看原帖
                      </a>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <Card className="h-fit border-border/60 bg-background/80 xl:sticky xl:top-4">
                    <CardHeader>
                      <CardTitle>话题打标</CardTitle>
                      <CardDescription>话题信息固定在左侧，评论区在右侧独立滚动浏览。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <CompactFormSelect
                          label="话题类型"
                          value={topicForm.topic_type}
                          onChange={(value) => setTopicForm((current) => ({ ...current, topic_type: value }))}
                          options={topicTypeOptions}
                        />
                        <CompactFormSelect
                          label="小红书适配"
                          value={topicForm.xhs_fit}
                          onChange={(value) => setTopicForm((current) => ({ ...current, xhs_fit: value }))}
                          options={fitOptions}
                        />
                        <CompactFormSelect
                          label="评论潜力"
                          value={topicForm.comment_potential}
                          onChange={(value) =>
                            setTopicForm((current) => ({ ...current, comment_potential: value }))
                          }
                          options={potentialOptions}
                        />
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">话题评分</label>
                          <Input
                            className="h-9"
                            inputMode="numeric"
                            placeholder="0-100"
                            value={topicForm.topic_pick_score}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              setTopicForm((current) => ({
                                ...current,
                                topic_pick_score: event.target.value.replace(/[^\d]/g, ""),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">备注</label>
                        <Textarea
                          className="min-h-[68px]"
                          placeholder="记录选题价值、风险点、改写方向"
                          value={topicForm.notes}
                          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                            setTopicForm((current) => ({ ...current, notes: event.target.value }))
                          }
                        />
                      </div>
                      <Button className="w-full" onClick={saveTopicLabel} disabled={savingTopic}>
                        {savingTopic ? "保存中..." : "保存话题标注"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        上次更新时间：{formatDate(detail.topic.label_updated_at)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 bg-background/70">
                    <CardHeader>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <CardTitle>评论候选</CardTitle>
                          <CardDescription>
                            {filteredComments?.length ?? 0} / {detail.comments.length} 条一级评论。
                          </CardDescription>
                        </div>
                        <div className="w-full lg:w-[220px]">
                          <FormSelect
                            label="评论标注状态"
                            value={commentLabeled}
                            onChange={updateCommentFilter}
                            options={["all", "labeled", "unlabeled"]}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          已选 {selectedCommentIds.length} 条，当前筛选命中 {selectedFilteredCount} 条
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={selectAllFilteredComments}>
                            全选当前筛选
                          </Button>
                          <Button variant="outline" size="sm" onClick={clearSelectedComments}>
                            清空选择
                          </Button>
                          <Button size="sm" onClick={exportSelectedComments} disabled={selectedCommentIds.length === 0}>
                            导出 JSON
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {filteredComments?.map((comment) => (
                        <CommentCard
                          key={comment.comment_id}
                          comment={comment}
                          selected={selectedCommentIds.includes(comment.comment_id)}
                          saving={savingCommentId === comment.comment_id}
                          onToggleSelected={toggleCommentSelected}
                          onSave={saveCommentLabel}
                        />
                      ))}
                      {filteredComments?.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
                          当前筛选条件下没有评论。
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">
                话题不存在。
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PageHeader({ summary }: { summary: Summary | null }) {
  return (
    <header className="rounded-[28px] border border-white/60 bg-white/70 p-5 shadow-panel backdrop-blur md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge className="w-fit bg-primary/15 text-primary">Reddit 小红书打标平台</Badge>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Reddit 小红书打标平台</h1>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={<Flame className="h-4 w-4" />} label="话题总数" value={summary?.topicCount ?? 0} />
          <StatCard
            icon={<MessageSquareText className="h-4 w-4" />}
            label="评论总数"
            value={summary?.commentCount ?? 0}
          />
          <StatCard icon={<NotebookPen className="h-4 w-4" />} label="已标话题" value={summary?.labeledTopics ?? 0} />
          <StatCard icon={<NotebookPen className="h-4 w-4" />} label="已标评论" value={summary?.labeledComments ?? 0} />
        </div>
      </div>
    </header>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function FilterPanel({
  search,
  setSearch,
  subreddit,
  setSubreddit,
  labeled,
  setLabeled,
  subreddits,
}: {
  search: string;
  setSearch: (value: string) => void;
  subreddit: string;
  setSubreddit: (value: string) => void;
  labeled: string;
  setLabeled: (value: string) => void;
  subreddits: string[];
}) {
  return (
    <div className="grid gap-3 pt-4">
      <div className="relative">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="搜索标题 / 正文 / 作者"
          value={search}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
        />
      </div>
      <FormSelect label="Subreddit" value={subreddit} onChange={setSubreddit} options={["all", ...subreddits]} />
      <FormSelect
        label="标注状态"
        value={labeled}
        onChange={setLabeled}
        options={["all", "labeled", "unlabeled"]}
      />
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value || "__empty__"} onValueChange={(next: string) => onChange(next === "__empty__" ? "" : next)}>
        <SelectTrigger>
          <SelectValue placeholder={`选择 ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">未设置</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CommentCard({
  comment,
  selected,
  saving,
  onToggleSelected,
  onSave,
}: {
  comment: CommentItem;
  selected: boolean;
  saving: boolean;
  onToggleSelected: (commentId: string) => void;
  onSave: (commentId: string, payload: Record<string, string>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    comment_intent: comment.comment_intent ?? "",
    standalone: comment.standalone ?? "",
    xhs_fit: comment.xhs_fit ?? "",
    comment_pick_score: comment.comment_pick_score?.toString() ?? "",
    notes: comment.notes ?? "",
  });

  useEffect(() => {
    setForm({
      comment_intent: comment.comment_intent ?? "",
      standalone: comment.standalone ?? "",
      xhs_fit: comment.xhs_fit ?? "",
      comment_pick_score: comment.comment_pick_score?.toString() ?? "",
      notes: comment.notes ?? "",
    });
  }, [comment]);

  return (
    <div className={`rounded-2xl border bg-card p-3.5 ${selected ? "border-primary/60 ring-1 ring-primary/20" : "border-border/70"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="mr-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
            checked={selected}
            onChange={() => onToggleSelected(comment.comment_id)}
          />
          选中
        </label>
        <Badge variant="outline">@{comment.author || "unknown"}</Badge>
        <Badge>{statLabel(comment.xhs_fit)}</Badge>
        <span className="text-xs text-muted-foreground">{formatDate(comment.updated_utc)}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 md:text-[15px]">{comment.body}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <CompactFormSelect
          label="评论意图"
          value={form.comment_intent}
          onChange={(value) => setForm((current) => ({ ...current, comment_intent: value }))}
          options={commentIntentOptions}
        />
        <CompactFormSelect
          label="可独立理解"
          value={form.standalone}
          onChange={(value) => setForm((current) => ({ ...current, standalone: value }))}
          options={standaloneOptions}
        />
        <CompactFormSelect
          label="小红书适配"
          value={form.xhs_fit}
          onChange={(value) => setForm((current) => ({ ...current, xhs_fit: value }))}
          options={fitOptions}
        />
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">评分</label>
          <Input
            className="h-9"
            inputMode="numeric"
            placeholder="0-100"
            value={form.comment_pick_score}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setForm((current) => ({
                ...current,
                comment_pick_score: event.target.value.replace(/[^\d]/g, ""),
              }))
            }
          />
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <label className="text-xs font-medium text-muted-foreground">备注</label>
        <Textarea
          className="min-h-[68px]"
          placeholder="记录可改写点、风险、标题角度"
          value={form.notes}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">上次更新时间：{formatDate(comment.label_updated_at)}</p>
        <Button onClick={() => onSave(comment.comment_id, form)} disabled={saving}>
          {saving ? (
            <>
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              保存中
            </>
          ) : (
            "保存评论标注"
          )}
        </Button>
      </div>
    </div>
  );
}

function CompactFormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value || "__empty__"} onValueChange={(next: string) => onChange(next === "__empty__" ? "" : next)}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder={`选择 ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">未设置</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center gap-3 text-muted-foreground">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
