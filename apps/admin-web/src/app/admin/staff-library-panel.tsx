"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./resources/resources-panel.module.css";
type Kind = "RESOURCE" | "GUIDE";
type Managed = {
  id: string;
  kind: Kind;
  title: string;
  summary: string;
  status: "PUBLISHED" | "REVOKED";
  scope: "CAMPUS" | "CLASS";
  classId: string | null;
  version: number;
  expiresOn: string;
};
type Catalog = { items: Managed[]; classIds: string[] };
type Summary = { total: number; expired: number; revoked: number; published: number };
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/admin/library/" + path, {
    method,
    ...(signal ? { signal } : {}),
    credentials: "same-origin",
    cache: "no-store",
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw Object.assign(new Error("资料服务请求失败"), { status: response.status });
  return (await response.json()).data;
}
function code(error: unknown) {
  return typeof error === "object" && error && "status" in error ? error.status : 0;
}
function failure(error: unknown) {
  switch (code(error)) {
    case 401:
      return "登录已失效，请重新登录。";
    case 403:
      return "当前账号没有此校区的资料权限。";
    case 409:
      return "资料已被更新，请刷新后核对最新版本。";
    case 400:
      return "请检查资料内容、班级和到期日期。";
    default:
      return "资料服务暂不可用，请稍后刷新。";
  }
}
function ScopeFields({ classIds, row }: { classIds: string[]; row?: Managed }) {
  const [scope, setScope] = useState(row?.scope ?? "CAMPUS");
  return (
    <>
      <label className={styles.field}>
        可见范围
        <select
          name="scope"
          value={scope}
          onChange={(e) => setScope(e.currentTarget.value as Managed["scope"])}
        >
          <option value="CAMPUS">当前校区</option>
          <option value="CLASS" disabled={!classIds.length}>
            指定班级
          </option>
        </select>
      </label>
      {scope === "CLASS" && (
        <label className={styles.field}>
          班级
          <select name="classId" required defaultValue={row?.classId ?? ""}>
            <option value="">请选择</option>
            {classIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={styles.field}>
        到期日期
        <input type="date" name="expiresOn" required defaultValue={row?.expiresOn} />
      </label>
    </>
  );
}
export function StaffLibraryPanel({ kind }: { kind: Kind }) {
  const label = kind === "GUIDE" ? "新员工指南" : "教学资源";
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("正在读取资料…");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState("");
  const pending = useRef(false);
  const [retry, setRetry] = useState(0);
  const [formRevision, setFormRevision] = useState(0);
  const read = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await request<Catalog>("items", "GET", undefined, signal);
      if (!signal?.aborted) {
        setCatalog(data);
        setSummary(null);
        setNeedsLogin(false);
        return true;
      }
    } catch (err) {
      if (signal?.aborted) return false;
      setCatalog(null);
      if (code(err) !== 403) throw err;
      const counts = await request<Summary>("summary", "GET", undefined, signal);
      if (!signal?.aborted) {
        setSummary(counts);
        setNeedsLogin(false);
        return true;
      }
    }
    return false;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    read(controller.signal)
      .then((ok) => {
        if (ok) setMessage("");
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setSummary(null);
          setNeedsLogin(code(err) === 401);
          setMessage(failure(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [read, retry]);
  async function save(e: FormEvent<HTMLFormElement>, row?: Managed) {
    e.preventDefault();
    if (busy || pending.current) return;
    const form = e.currentTarget,
      data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const visibility = {
      scope: value("scope"),
      expiresOn: value("expiresOn"),
      classId: value("scope") === "CLASS" ? value("classId") : null,
    };
    const entry = row
      ? { ...visibility, version: row.version }
      : {
          ...visibility,
          kind,
          title: value("title"),
          summary: value("summary"),
          body: value("body"),
          category: value("category"),
          grade: value("grade"),
          subject: value("subject"),
          tags: value("tags")
            .split(/[、,，]/u)
            .map((x) => x.trim())
            .filter(Boolean),
        };
    await change(
      row ? "items/" + row.id : "items",
      row ? "PATCH" : "POST",
      entry,
      row ? "范围和有效期已保存。" : "资料已发布。",
      row ? undefined : () => setFormRevision((value) => value + 1),
    );
  }
  async function change(
    path: string,
    method: string,
    payload: unknown,
    done: string,
    onSaved?: () => void,
  ) {
    if (pending.current || busy) return;
    pending.current = true;
    setBusy(true);
    setMessage("正在保存…");
    let saved = false;
    try {
      await request(path, method, payload);
      saved = true;
      onSaved?.();
      setConfirmId("");
      await read();
      setMessage(done);
    } catch (err) {
      setNeedsLogin(code(err) === 401);
      if (saved || code(err) === 401 || code(err) === 403) {
        setCatalog(null);
        setSummary(null);
      }
      setMessage(saved ? "更改已保存，列表未能刷新。请重新读取。" : failure(err));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const rows = catalog?.items.filter((row) => row.kind === kind) ?? [];
  return (
    <section className={styles.panel} aria-busy={busy}>
      <header className={styles.header}>
        <h1>{label}</h1>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={busy}
          onClick={() => setRetry((n) => n + 1)}
        >
          刷新
        </button>
      </header>
      <p role="status" className={styles.message}>
        {message}
      </p>
      {needsLogin && (
        <a href={kind === "RESOURCE" ? "/admin/login?next=/admin/resources" : "/admin/login?next=/admin/guides"}>
          管理员登录
        </a>
      )}
      {summary && (
        <section className={styles.card}>
          <h2>资料汇总</h2>
          <p>
            共 {summary.total} 份，有效 {summary.published} 份，已到期 {summary.expired} 份，已撤回{" "}
            {summary.revoked} 份。
          </p>
        </section>
      )}
      {catalog && (
        <>
          <details className={styles.card}>
            <summary>发布{label}</summary>
            <form key={formRevision} onSubmit={(e) => void save(e)} className={styles.form}>
              <label className={styles.field}>
                标题
                <input name="title" required maxLength={120} />
              </label>
              <label className={styles.field}>
                摘要
                <textarea name="summary" required maxLength={500} />
              </label>
              <label className={styles.field}>
                正文
                <textarea name="body" rows={6} required maxLength={8000} />
              </label>
              <label className={styles.field}>
                分类
                <input name="category" required maxLength={80} />
              </label>
              {kind === "RESOURCE" && (
                <>
                  <label className={styles.field}>
                    年级
                    <input name="grade" maxLength={80} />
                  </label>
                  <label className={styles.field}>
                    科目
                    <input name="subject" maxLength={80} />
                  </label>
                  <label className={styles.field}>
                    标签（用顿号分隔）
                    <input name="tags" maxLength={970} />
                  </label>
                </>
              )}
              <ScopeFields classIds={catalog.classIds} />
              <button disabled={busy} className={styles.primaryButton}>
                发布
              </button>
            </form>
          </details>
          {rows.length === 0 && <p>当前范围内还没有{label}。</p>}
          <div className={styles.resourceGrid}>
            {rows.map((row) => (
              <article key={row.id + "-" + row.version} className={styles.card}>
                <h2>{row.title}</h2>
                <p>{row.summary}</p>
                <p>
                  {row.status === "REVOKED" ? "已撤回" : "已发布"} · 第 {row.version} 版 · 到期{" "}
                  {row.expiresOn}
                </p>
                {row.status === "PUBLISHED" && (
                  <>
                    <form className={styles.form} onSubmit={(e) => void save(e, row)}>
                      <ScopeFields classIds={catalog.classIds} row={row} />
                      <button disabled={busy} className={styles.secondaryButton}>
                        保存范围和日期
                      </button>
                    </form>
                    {confirmId === row.id ? (
                      <div className={styles.actions}>
                        <span>撤回后员工将无法查看。</span>
                        <button
                          disabled={busy}
                          className={styles.dangerButton}
                          onClick={() =>
                            void change(
                              "items/" + row.id + "/revoke",
                              "POST",
                              { version: row.version },
                              "资料已撤回。",
                            )
                          }
                        >
                          确认撤回
                        </button>
                        <button disabled={busy} onClick={() => setConfirmId("")}>
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={busy}
                        className={styles.dangerButton}
                        onClick={() => setConfirmId(row.id)}
                      >
                        撤回
                      </button>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
