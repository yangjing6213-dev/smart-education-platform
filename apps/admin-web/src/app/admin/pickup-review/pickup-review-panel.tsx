"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PickupReviewClient,
  type PickupExceptionAction,
  type PickupReviewProfile,
  type PickupReviewSnapshot,
} from "../../../local-review/pickup-review";

type PanelProps = Readonly<{ baseUrl: string }>;
type Exception = PickupReviewSnapshot["exceptions"][number];

const ROLES: readonly [PickupReviewProfile, string][] = [
  ["owner-east", "东区负责人"],
  ["owner-west", "西区负责人"],
  ["teacher-east", "员工只读"],
  ["platform-admin", "平台管理员 · 数字汇总"],
];
const CATEGORY: Record<Exception["category"], string> = {
  NO_AUTHORIZATION: "未找到有效授权",
  INFORMATION_MISMATCH: "信息不一致",
  INVALID_CREDENTIAL: "凭证不可用",
  OVERDUE: "超过约定时间",
};
const STATUS: Record<Exception["status"], string> = {
  OPEN: "待跟进",
  FOLLOWING: "跟进中",
  RESOLVED: "已记录处理结果",
};
const OUTCOME: Record<NonNullable<Exception["outcome"]>, string> = {
  CONTACT_GUARDIAN: "已记录联系监护人",
  INFORMATION_RECHECKED: "已记录重新核对",
  ARRANGEMENT_CONFIRMED: "已记录后续安排",
};

function createLocalPickupTransport(baseUrl: string): typeof fetch {
  const base = new URL(baseUrl);
  if (
    base.protocol !== "http:" ||
    base.hostname !== "127.0.0.1" ||
    !["4317", "4319"].includes(base.port) ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("接送服务地址无效。");
  const fixedPaths = new Set([
    "/local/sessions",
    "/local/session",
    "/local/pickup-authorizations",
    "/local/pickup-records",
    "/local/pickup-exceptions",
    "/local/pickup-summary",
  ]);
  const reviewPath =
    /^\/local\/pickup-exceptions\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/review$/iu;
  return (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, base);
    if (
      url.origin !== base.origin ||
      url.search ||
      url.hash ||
      (!fixedPaths.has(url.pathname) && !reviewPath.test(url.pathname))
    )
      return Promise.reject(new Error("已阻止访问接送演示服务范围以外的地址。"));
    return fetch(url, init);
  };
}

export function PickupReviewPanel({ baseUrl }: PanelProps) {
  const client = useMemo(
    () => new PickupReviewClient(createLocalPickupTransport(baseUrl)),
    [baseUrl],
  );
  const [snapshot, setSnapshot] = useState<PickupReviewSnapshot>(client.snapshot);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const connected = client.connect("owner-east");
    setSnapshot({ ...client.snapshot });
    void connected.then(() => {
      if (active) setSnapshot({ ...client.snapshot });
    });
    return () => {
      active = false;
      client.disconnect();
    };
  }, [client]);

  async function connect(profile: PickupReviewProfile) {
    setBusy(true);
    setConfirmed(false);
    const connected = client.connect(profile);
    setSnapshot({ ...client.snapshot });
    await connected;
    setSnapshot({ ...client.snapshot });
    setBusy(false);
  }

  async function refresh() {
    setBusy(true);
    try {
      await client.refresh();
    } catch {
      // The client records a safe status message for the page.
    }
    setSnapshot({ ...client.snapshot });
    setConfirmed(false);
    setBusy(false);
  }

  async function review(row: Exception, action: PickupExceptionAction) {
    setBusy(true);
    try {
      await client.review(row.id, row.version, action);
    } catch {
      // The client records a safe status message for the page.
    }
    setSnapshot({ ...client.snapshot });
    setConfirmed(false);
    setBusy(false);
  }

  const ready = snapshot.status === "READY";
  const platform = snapshot.profile === "platform-admin";
  const canReview =
    ready && !busy && confirmed && snapshot.session?.actions.includes("pickup:review") === true;
  const summary = snapshot.summary;

  return (
    <section className="pickup-review" aria-labelledby="pickup-review-title">
      <header className="pickup-review-header">
        <p className="pickup-review-eyebrow">接送协作 · 本机合成数据</p>
        <h1 id="pickup-review-title">接送异常处理</h1>
        <p>负责人可记录异常跟进结果。页面记录不代表已经现场核验或完成交接。</p>
      </header>

      <div className="pickup-review-toolbar">
        <label className="pickup-review-role" htmlFor="pickup-review-profile">
          当前角色
          <select
            id="pickup-review-profile"
            value={snapshot.profile}
            disabled={busy}
            onChange={(event) => void connect(event.currentTarget.value as PickupReviewProfile)}
          >
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="pickup-review-secondary"
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
        >
          刷新
        </button>
      </div>

      <p className="pickup-review-message" role="status" aria-live="polite">
        {snapshot.message}
      </p>

      {platform ? (
        ready && summary ? (
          <section
            className="pickup-review-section"
            aria-labelledby="pickup-platform-summary-title"
          >
            <div className="pickup-review-section-heading">
              <h2 id="pickup-platform-summary-title">平台汇总</h2>
              <span>仅数字 · 不含单条记录</span>
            </div>
            <dl className="pickup-review-summary-grid">
              <div>
                <dt>当前有效授权</dt>
                <dd>{summary.counts.activeAuthorizations}</dd>
              </div>
              <div>
                <dt>已完成接送</dt>
                <dd>{summary.counts.completedRecords}</dd>
              </div>
              <div>
                <dt>待跟进异常</dt>
                <dd>{summary.counts.openExceptions}</dd>
              </div>
              <div>
                <dt>跟进中异常</dt>
                <dd>{summary.counts.followingExceptions}</dd>
              </div>
              <div>
                <dt>已记录处理结果</dt>
                <dd>{summary.counts.resolvedExceptions}</dd>
              </div>
            </dl>
            <p className="pickup-review-footnote">
              本机模拟数据汇总，不显示学生、校区、日期或单条接送信息。
            </p>
          </section>
        ) : null
      ) : ready ? (
        <>
          {snapshot.session?.actions.includes("pickup:review") ? (
            <label className="pickup-review-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.currentTarget.checked)}
              />
              我已确认这里只记录处理结果，不代表完成现场核验或交接。
            </label>
          ) : null}

          <section className="pickup-review-section" aria-labelledby="pickup-exceptions-title">
            <div className="pickup-review-section-heading">
              <h2 id="pickup-exceptions-title">接送异常</h2>
              <span>{snapshot.exceptions.length} 条</span>
            </div>
            {snapshot.exceptions.length ? (
              <div className="pickup-review-list">
                {snapshot.exceptions.map((row) => (
                  <article className="pickup-review-row" key={row.id}>
                    <div className="pickup-review-row-heading">
                      <h3>{row.studentLabel}</h3>
                      <span>{STATUS[row.status]}</span>
                    </div>
                    <p>
                      {row.date} · {CATEGORY[row.category]} · 记录版本 {row.version}
                    </p>
                    {row.outcome ? <p>处理记录：{OUTCOME[row.outcome]}</p> : null}
                    <p className="pickup-review-footnote">
                      请按机构流程完成现场核验；此页面不提供放行确认。
                    </p>
                    {row.status === "OPEN" ? (
                      <button
                        className="pickup-review-primary"
                        type="button"
                        disabled={!canReview}
                        onClick={() => void review(row, "follow")}
                      >
                        记录跟进
                      </button>
                    ) : row.status === "FOLLOWING" ? (
                      <button
                        className="pickup-review-primary"
                        type="button"
                        disabled={!canReview}
                        onClick={() => void review(row, "resolve")}
                      >
                        记录处理结果
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="pickup-review-empty">当前授权范围没有接送异常。</p>
            )}
          </section>

          {snapshot.session?.actions.includes("pickup:read") ? (
            <>
              <section
                className="pickup-review-section"
                aria-labelledby="pickup-authorizations-title"
              >
                <div className="pickup-review-section-heading">
                  <h2 id="pickup-authorizations-title">接送授权</h2>
                  <span>{snapshot.authorizations.length} 条</span>
                </div>
                {snapshot.authorizations.length ? (
                  <div className="pickup-review-list">
                    {snapshot.authorizations.map((row, index) => (
                      <article
                        className="pickup-review-row"
                        key={`${row.studentLabel}-${row.recipientLabel}-${index}`}
                      >
                        <h3>
                          {row.studentLabel} · {row.recipientLabel}
                        </h3>
                        <p>
                          {row.status === "ACTIVE"
                            ? row.currentlyValid
                              ? "当前有效"
                              : "已到期"
                            : row.status === "DRAFT"
                              ? "待激活"
                              : "已撤销"}
                        </p>
                        <p>
                          {row.startDate} 至 {row.endDate} · {row.startTime}–{row.endTime}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="pickup-review-empty">当前范围没有接送授权。</p>
                )}
              </section>

              <section className="pickup-review-section" aria-labelledby="pickup-records-title">
                <div className="pickup-review-section-heading">
                  <h2 id="pickup-records-title">已完成接送</h2>
                  <span>{snapshot.records.length} 条</span>
                </div>
                {snapshot.records.length ? (
                  <div className="pickup-review-list">
                    {snapshot.records.map((row, index) => (
                      <article
                        className="pickup-review-row"
                        key={`${row.studentLabel}-${row.date}-${row.time}-${index}`}
                      >
                        <h3>
                          {row.studentLabel} · {row.date} {row.time}
                        </h3>
                        <p>接送人：{row.recipient} · 已完成</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="pickup-review-empty">当前范围没有已完成接送记录。</p>
                )}
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
