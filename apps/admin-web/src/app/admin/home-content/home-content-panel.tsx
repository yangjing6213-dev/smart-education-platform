"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HomeContentClient,
  type HomeContentDraft,
  type HomeContentRecord,
} from "./home-content-client";
import {
  HomeContentPage,
  type HomeContentEditorState,
} from "../../../pages/home-content";

type PanelMode = "CHECKING" | "READY" | "UNAUTHENTICATED" | "FORBIDDEN" | "ERROR" | "CONFLICT";

const INITIAL_DRAFT: HomeContentDraft = {
  title: "同芯学园校区服务介绍",
  summary: "欢迎了解课程安排、成长记录和家校沟通服务。",
  text: "本内容为虚构的首页示例，请编辑并保存后再发布。",
};

const STATUS_LABEL: Readonly<Record<HomeContentEditorState["status"], string>> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  UNPUBLISHED: "已下架",
  CONFLICT: "版本冲突",
};

function draftFrom(record: HomeContentRecord): HomeContentDraft {
  return {
    title: record.title,
    summary: record.body.summary,
    text: record.body.blocks[0].text,
  };
}

function codeFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : "UNAVAILABLE";
}

function stateFor(
  record: HomeContentRecord | null,
  draft: HomeContentDraft,
  canPublish: boolean,
  conflict: boolean,
): HomeContentEditorState {
  return {
    contentKey: record?.content_key ?? "home-content-synthetic-east",
    title: draft.title,
    summary: draft.summary,
    blocks: [{ kind: "TEXT", text: draft.text }],
    version: record?.version ?? 0,
    status: conflict ? "CONFLICT" : (record?.status ?? "DRAFT"),
    canPublish,
  };
}

function errorText(mode: PanelMode, code: string): string {
  if (mode === "UNAUTHENTICATED") return "请先使用机构邀请账号登录，再管理当前校区的首页内容。";
  if (mode === "FORBIDDEN") return "当前账号没有首页内容编辑权限，内容已隐藏。";
  if (mode === "CONFLICT") return "内容已被其他账号更新，请刷新并核对最新版本后再操作。";
  if (code === "INVALID_API_RESPONSE") return "首页内容服务返回的数据不完整，请刷新后重试。";
  return "首页内容服务暂不可用，请稍后刷新重试。";
}

export function HomeContentPanel({ heading }: Readonly<{ heading: string }>) {
  const client = useMemo(() => new HomeContentClient(), []);
  const [mode, setMode] = useState<PanelMode>("CHECKING");
  const [record, setRecord] = useState<HomeContentRecord | null>(null);
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("正在确认账号权限并读取当前校区内容…");
  const [error, setError] = useState("");

  const load = useCallback(
    async (successNotice?: string) => {
      setBusy(true);
      setMode("CHECKING");
      setRecord(null);
      setError("");
      try {
        const current = await client.connect();
        setRecord(current);
        setDraft(current ? draftFrom(current) : INITIAL_DRAFT);
        setMode("READY");
        setNotice(
          successNotice ??
            (current
              ? `已读取当前校区首页内容 · v${current.version}`
              : "当前校区尚未配置首页内容。示例文案未保存；点击“保存草稿”后才会创建。"),
        );
      } catch (reason) {
        const code = codeFrom(reason);
        const nextMode: PanelMode =
          code === "UNAUTHENTICATED"
            ? "UNAUTHENTICATED"
            : code === "FORBIDDEN_SCOPE"
              ? "FORBIDDEN"
              : "ERROR";
        setMode(nextMode);
        setError(errorText(nextMode, code));
        setNotice("");
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  useEffect(() => {
    void load();
    return () => client.disconnect();
  }, [client, load]);

  const view = HomeContentPage(stateFor(record, draft, client.canPublish, mode === "CONFLICT"));
  const editable =
    mode === "READY" && !busy && client.canWrite && record?.status !== "PUBLISHED";
  const validDraft =
    draft.title.trim().length > 0 &&
    draft.title.length <= 120 &&
    draft.summary.trim().length > 0 &&
    draft.summary.length <= 500 &&
    draft.text.trim().length > 0 &&
    draft.text.length <= 4000;
  const canSave = editable && validDraft;
  const canPublish =
    editable && Boolean(record) && client.canPublish;
  const canUnpublish =
    mode === "READY" && !busy && client.canPublish && record?.status === "PUBLISHED";

  function failAction(reason: unknown) {
    const code = codeFrom(reason);
    if (code === "VERSION_MISMATCH") {
      setMode("CONFLICT");
      setError(errorText("CONFLICT", code));
    } else if (code === "UNAUTHENTICATED" || code === "FORBIDDEN_SCOPE") {
      const nextMode = code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN";
      setMode(nextMode);
      setRecord(null);
      setDraft(INITIAL_DRAFT);
      setError(errorText(nextMode, code));
    } else {
      setError(errorText("ERROR", code));
    }
    setNotice("");
  }

  async function saveDraft() {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      const saved = await client.saveDraft(draft);
      setRecord(saved);
      setDraft(draftFrom(saved));
      setNotice("草稿已保存。内容尚未公开。");
    } catch (reason) {
      failAction(reason);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!canPublish) return;
    setBusy(true);
    setError("");
    try {
      const published = await client.publish();
      setRecord(published);
      setDraft(draftFrom(published));
      setNotice("首页内容已发布，可由访客查看。");
    } catch (reason) {
      failAction(reason);
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!canUnpublish) return;
    setBusy(true);
    setError("");
    try {
      const unpublished = await client.unpublish();
      setRecord(unpublished);
      setDraft(draftFrom(unpublished));
      setNotice("首页内容已下架，访客页不再展示。");
    } catch (reason) {
      failAction(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="home-content-title" className="home-content-panel">
      <header className="pickup-review-header">
        <p className="pickup-review-eyebrow">首页内容 · 当前负责校区</p>
        <h1 id="home-content-title">{heading}</h1>
        <p>编辑并保存校区首页内容。草稿不会公开；发布和下架需要对应权限。</p>
        <span className="preview-badge">仅使用合成示例资料</span>
      </header>

      {mode === "CHECKING" ? (
        <p aria-live="polite" role="status">
          {notice}
        </p>
      ) : mode === "UNAUTHENTICATED" ? (
        <div className="home-content-card" role="alert">
          <p>{error}</p>
          <Link href="/admin/login?next=%2Fadmin%2Fhome-content">前往管理端登录</Link>
        </div>
      ) : mode === "FORBIDDEN" || mode === "ERROR" || mode === "CONFLICT" ? (
        <div className="home-content-card" role="alert">
          <p>{error}</p>
          <button disabled={busy} onClick={() => void load("已重新读取当前校区首页内容。")} type="button">
            刷新内容
          </button>
        </div>
      ) : (
        <div className="home-content-layout">
          <article className="home-content-card">
            <h2>首页展示预览</h2>
            <h3>{view.state.title || "首页标题"}</h3>
            <p>{view.state.summary}</p>
            <ul aria-label="内容区块" className="home-content-blocks">
              {view.state.blocks.map((block, index) => (
                <li key={`${block.kind}-${index}`}>
                  <span>{block.kind === "TEXT" ? "正文" : "内容区块"}</span>
                  <p>{block.text}</p>
                </li>
              ))}
            </ul>
          </article>

          <form
            className="home-content-card"
            onSubmit={(event) => {
              event.preventDefault();
              void saveDraft();
            }}
          >
            <h2>编辑首页内容</h2>
            <div className="public-teacher-fields" data-home-content-fields>
              <label className="public-teacher-field">
                首页标题
                <input
                  aria-label="首页标题"
                  disabled={!editable}
                  maxLength={120}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  required
                  value={draft.title}
                />
              </label>
              <label className="public-teacher-field">
                首页摘要
                <textarea
                  aria-label="首页摘要"
                  disabled={!editable}
                  maxLength={500}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, summary: event.target.value }))
                  }
                  required
                  rows={3}
                  value={draft.summary}
                />
              </label>
              <label className="public-teacher-field">
                首页正文
                <textarea
                  aria-label="首页正文"
                  disabled={!editable}
                  maxLength={4000}
                  onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
                  required
                  rows={5}
                  value={draft.text}
                />
              </label>
            </div>
            <p className="home-content-notice">
              {record?.status === "PUBLISHED"
                ? "已发布内容需先下架后修改。"
                : record
                  ? "保存后会更新当前校区草稿；发布后访客页才会展示。"
                  : "当前是未保存的合成示例，保存后才会在当前校区创建草稿。"}
            </p>
            <div aria-label="草稿操作" className="home-content-actions">
              <button data-primary="true" disabled={!canSave} type="submit">
                {view.saveAction}
              </button>
            </div>
          </form>

          <aside aria-label="发布控制" className="home-content-card home-content-controls">
            <h2>发布状态</h2>
            <dl className="home-content-meta">
              <div>
                <dt>当前状态</dt>
                <dd>{record ? STATUS_LABEL[record.status] : "未保存"}</dd>
              </div>
              <div>
                <dt>版本</dt>
                <dd>v{record?.version ?? 0}</dd>
              </div>
            </dl>
            <div aria-label="内容操作" className="home-content-actions">
              <button disabled={busy} onClick={() => void load("已重新读取当前校区首页内容。")} type="button">
                刷新内容
              </button>
              <button
                data-primary="true"
                disabled={!canPublish}
                onClick={() => void publish()}
                type="button"
              >
                {view.publishAction}
              </button>
              <button disabled={!canUnpublish} onClick={() => void unpublish()} type="button">
                {view.unpublishAction}
              </button>
            </div>
            {error ? <p role="alert">{error}</p> : null}
            <p aria-live="polite" className="home-content-notice" role="status">
              {notice}
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
