"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiteFooter, SiteHeader } from "../visitor/site-header";
import shared from "../parent/binding/parent-binding-panel.module.css";
import layout from "../parent/leave/leave-panel.module.css";
import { StaffNavigation } from "./staff-navigation";

type Collection = "resources" | "guides";
type Item = {
  id: string;
  title: string;
  summary: string;
  category: string;
  grade: string;
  subject: string;
  tags: string[];
  favorite: boolean;
  lastUsedAt: string | null;
  version: number;
};
type View = "全部" | "我的收藏" | "最近使用";
const filters = [
  ["category", "类型"],
  ["grade", "年级"],
  ["subject", "学科"],
  ["tag", "标签"],
] as const;
const emptyFilters = { category: "", grade: "", subject: "", tag: "" };
const libraryTitles = { resources: "教学资源", guides: "新员工指南" };

async function request<T>(
  path: string,
  signal: AbortSignal,
  change?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    ...(change
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(change),
        }
      : {}),
  });
  if (!response.ok) throw Object.assign(new Error(), { status: response.status });
  return (await response.json()).data as T;
}

export function StaffLibraryPanel({ collection }: { readonly collection: Collection }) {
  const resources = collection === "resources";
  const title = libraryTitles[collection];
  const endpoint = "/api-local/staff/library/" + collection;
  const [items, setItems] = useState<Item[]>([]);
  const [detail, setDetail] = useState<(Item & { body: string }) | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(emptyFilters);
  const [view, setView] = useState<View>("全部");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [loginNeeded, setLoginNeeded] = useState(false);
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  const run = useCallback(async (work: (signal: AbortSignal) => Promise<void>) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    setLoginNeeded(false);
    setNotice("");
    try {
      await work(controller.signal);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const status = cause instanceof Error && "status" in cause ? cause.status : 0;
      setItems([]);
      setDetail(null);
      setLoginNeeded(status === 401);
      setError(
        status === 401
          ? "请使用受邀员工账号登录。"
          : status === 403
            ? "该账号没有查看权限。"
            : status === 409
              ? "内容已更新，请刷新后重试。"
              : "内容暂时无法读取，请刷新后重试。",
      );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }, []);
  const readList = useCallback(
    async (signal: AbortSignal) => {
      const data = await request<{ items: Item[] }>(endpoint, signal);
      if (!signal.aborted) {
        setItems(data.items);
        setDetail(null);
      }
    },
    [endpoint],
  );
  useEffect(() => {
    void run(readList);
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [readList, run]);
  function openItem(item: Item) {
    void run(async (signal) => {
      const selectedItem = await request<Item & { body: string }>(endpoint + "/" + item.id, signal);
      if (!signal.aborted) setDetail(selectedItem);
    });
  }
  function save(item: Item, action: "favorite" | "use") {
    void run(async (signal) => {
      await request(endpoint + "/" + item.id + "/" + action, signal, {
        version: item.version,
        ...(action === "favorite" ? { favorite: !item.favorite } : {}),
      });
      await readList(signal);
      if (!signal.aborted)
        setNotice(
          action === "use" ? "已记入最近使用。" : item.favorite ? "已取消收藏。" : "已收藏。",
        );
    });
  }
  const keyword = search.trim().toLocaleLowerCase();
  const availableFilters = resources
    ? filters
    : filters.filter(([field]) => field === "category" || field === "tag");
  const visible = items.filter(
    (item) =>
      (view !== "我的收藏" || item.favorite) &&
      (view !== "最近使用" || item.lastUsedAt) &&
      availableFilters.every(
        ([field]) =>
          !selected[field] ||
          (field === "tag" ? item.tags.includes(selected.tag) : item[field] === selected[field]),
      ) &&
      (!keyword ||
        [item.title, item.summary, item.category, item.grade, item.subject, ...item.tags]
          .join(" ")
          .toLocaleLowerCase()
          .includes(keyword)),
  );
  if (view === "最近使用")
    visible.sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""));
  return (
    <>
      <SiteHeader active="staff-workbench" />
      <main id="main-content" className={shared.main}>
        <div className={shared.container + " " + layout.staffContainer}>
          <a href="/web/staff/workbench" className={shared.backLink}>
            返回员工工作台
          </a>
          <h1>{title}</h1>
          <div className={layout.staffLayout}>
            <aside aria-label="员工资料导航">
              <StaffNavigation active={collection} />
            </aside>
            <section
              className={shared.panel}
              aria-label={title + "目录"}
              aria-busy={busy}
              style={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              {error ? (
                <div role="alert" className={shared.stateCard}>
                  <p>{error}</p>
                  {loginNeeded && (
                    <a
                      href={"/web/login?next=/web/staff/" + collection}
                      className={shared.primaryButton}
                    >
                      登录员工账号
                    </a>
                  )}
                  <button
                    type="button"
                    className={shared.secondaryButton}
                    onClick={() => void run(readList)}
                  >
                    刷新重试
                  </button>
                </div>
              ) : (
                <>
                  <div className={layout.fields}>
                    <label>
                      搜索
                      <input
                        type="search"
                        disabled={busy}
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setDetail(null);
                        }}
                        placeholder={resources ? "输入资源名称或关键词" : "输入指南名称或关键词"}
                      />
                    </label>
                    {availableFilters.map(([field, label]) => {
                      const options = Array.from(
                        new Set(
                          items
                            .flatMap((item) => (field === "tag" ? item.tags : [item[field]]))
                            .filter(Boolean),
                        ),
                      ).sort();
                      return (
                        <label key={field}>
                          {label}
                          <select
                            disabled={busy}
                            value={selected[field]}
                            onChange={(e) => {
                              setSelected({ ...selected, [field]: e.target.value });
                              setDetail(null);
                            }}
                          >
                            <option value="">全部{label}</option>
                            {options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                  {(search || Object.values(selected).some(Boolean)) && (
                    <button
                      type="button"
                      disabled={busy}
                      className={shared.secondaryButton}
                      onClick={() => {
                        setSearch("");
                        setSelected(emptyFilters);
                        setDetail(null);
                      }}
                    >
                      清除筛选
                    </button>
                  )}
                  {resources && (
                    <div className={layout.actions} aria-label="资源列表">
                      {(["全部", "我的收藏", "最近使用"] as const).map((option) => (
                        <button
                          type="button"
                          key={option}
                          disabled={busy}
                          aria-pressed={view === option}
                          className={
                            view === option ? shared.primaryButton : shared.secondaryButton
                          }
                          onClick={() => {
                            setView(option);
                            setDetail(null);
                          }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                  <p role="status" className={shared.status}>
                    {busy ? "正在读取…" : notice}
                  </p>
                  {detail ? (
                    <article className={shared.itemCard}>
                      <h2>{detail.title}</h2>
                      <p style={{ whiteSpace: "pre-wrap" }}>{detail.body}</p>
                      <button
                        type="button"
                        className={shared.secondaryButton}
                        onClick={() => setDetail(null)}
                      >
                        返回列表
                      </button>
                    </article>
                  ) : (
                    <div className={shared.section}>
                      {visible.map((item) => (
                        <article key={item.id} className={shared.itemCard}>
                          <h2>{item.title}</h2>
                          <p>{item.summary}</p>
                          <p className={shared.muted}>
                            {[item.category, item.grade, item.subject, ...item.tags]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <div className={layout.actions}>
                            <button
                              type="button"
                              disabled={busy}
                              className={shared.primaryButton}
                              onClick={() => openItem(item)}
                            >
                              查看正文
                            </button>
                            {resources && (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  aria-pressed={item.favorite}
                                  className={shared.secondaryButton}
                                  onClick={() => save(item, "favorite")}
                                >
                                  {item.favorite ? "取消收藏" : "收藏"}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  className={shared.secondaryButton}
                                  onClick={() => save(item, "use")}
                                >
                                  记为最近使用
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      ))}
                      {!busy && !visible.length && (
                        <p role="status" className={shared.stateCard}>
                          {!items.length
                            ? "暂无可查看的" + title + "。"
                            : "当前条件下没有匹配内容。"}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
