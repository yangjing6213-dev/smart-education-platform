"use client";

import { useMemo, useState } from "react";
import {
  ConsentReviewClient,
  type ConsentReviewAction,
  type ConsentReviewSnapshot,
  type ConsentReviewerProfile,
} from "../../../local-review/consent";

type PanelProps = Readonly<{ baseUrl: string }>;

const STATUS: Readonly<
  Record<ConsentReviewSnapshot["records"][number]["retentionStatus"], string>
> = {
  WITHIN_PERIOD: "演示期限内",
  REVIEW_DUE: "等待负责人复核",
  REQUIRED_HOLD: "已标记为演示保留",
  SIMULATED_EXPIRED: "已完成到期演练",
};

const PROFILE_LABEL: Readonly<Record<ConsentReviewerProfile, string>> = {
  "owner-east": "东校区负责人",
  "owner-west": "西校区负责人",
};

function createConsentReviewTransport(baseUrl: string): typeof fetch {
  const base = new URL(baseUrl);
  if (
    base.protocol !== "http:" ||
    base.hostname !== "127.0.0.1" ||
    base.port !== "4319" ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("数据授权复核只允许连接本机合成服务。");

  const fixedPaths = new Set(["/local/sessions", "/local/session", "/local/consents"]);
  const reviewPath =
    /^\/local\/consents\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/retention-review$/iu;

  return (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, base);
    if (
      url.origin !== base.origin ||
      url.search ||
      url.hash ||
      (!fixedPaths.has(url.pathname) && !reviewPath.test(url.pathname))
    )
      return Promise.reject(new Error("已阻止访问数据授权复核范围以外的地址。"));
    return fetch(url, {
      ...init,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    });
  };
}

export function ConsentReviewPanel({ baseUrl }: PanelProps) {
  const client = useMemo(
    () => new ConsentReviewClient({ baseUrl, fetcher: createConsentReviewTransport(baseUrl) }),
    [baseUrl],
  );
  const [profile, setProfile] = useState<ConsentReviewerProfile>("owner-east");
  const [snapshot, setSnapshot] = useState<ConsentReviewSnapshot>(client.snapshot);
  const [confirmed, setConfirmed] = useState<Readonly<Record<number, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const ready = snapshot.status === "READY";
  const working = busy || snapshot.status === "CONNECTING" || snapshot.status === "BUSY";

  async function connect() {
    setBusy(true);
    setConfirmed({});
    await client.connect(profile);
    setSnapshot(client.snapshot);
    setBusy(false);
  }

  async function refresh() {
    setBusy(true);
    setConfirmed({});
    if (ready) await client.refresh();
    else await client.connect(profile);
    setSnapshot(client.snapshot);
    setBusy(false);
  }

  async function review(index: number, action: ConsentReviewAction) {
    if (working || confirmed[index] !== true) return;
    setBusy(true);
    await client.review(index, action, true);
    setSnapshot(client.snapshot);
    setConfirmed({});
    setBusy(false);
  }

  return (
    <section aria-labelledby="consent-review-title" className="pickup-review consent-review">
      <header className="pickup-review-header">
        <p className="pickup-review-eyebrow">数据授权 · 期限复核 · 本机合成资料</p>
        <h1 id="consent-review-title">数据授权与期限复核</h1>
        <p>
          仅显示当前模拟负责人校区的必要摘要。这里的复核只更新演示状态，不会删除或改变真实资料。
        </p>
      </header>

      <div className="pickup-review-toolbar">
        <label className="pickup-review-role" htmlFor="consent-review-profile">
          当前审核校区
          <select
            disabled={working}
            id="consent-review-profile"
            onChange={(event) => setProfile(event.currentTarget.value as ConsentReviewerProfile)}
            value={profile}
          >
            <option value="owner-east">东校区负责人（模拟）</option>
            <option value="owner-west">西校区负责人（模拟）</option>
          </select>
        </label>
        <button
          className="pickup-review-primary"
          disabled={working}
          onClick={() => void connect()}
          type="button"
        >
          连接并刷新
        </button>
        {ready ? (
          <button
            className="pickup-review-secondary"
            disabled={working}
            onClick={() => void refresh()}
            type="button"
          >
            刷新记录
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="pickup-review-message" role="status">
        {snapshot.message}
      </p>
      {ready ? (
        <section aria-label="当前负责范围的数据授权记录" className="pickup-review-section">
          <div className="pickup-review-section-heading">
            <h2>{PROFILE_LABEL[snapshot.profile ?? profile]} · 授权记录</h2>
            <span>{snapshot.records.length} 条</span>
          </div>
          {snapshot.records.length ? (
            <div className="pickup-review-list">
              {snapshot.records.map((record, index) => {
                const canReview =
                  record.status === "ACTIVE" && record.retentionStatus === "REVIEW_DUE";
                const disabled = !canReview || working || confirmed[index] !== true;
                return (
                  <article
                    className="pickup-review-row consent-review-row"
                    data-consent-review-row={index}
                    key={`${record.purposeKey}-${index}`}
                  >
                    <div className="pickup-review-row-heading">
                      <h3>{record.purposeTitle}</h3>
                      <span>{STATUS[record.retentionStatus]}</span>
                    </div>
                    <p>告知版本：{record.noticeVersion}</p>
                    <p>{record.necessity}</p>
                    <p>示例资料类别：{record.dataClasses.join("、")}</p>
                    <p>
                      演示期限 {record.retentionDays} 天，日期 {record.retainUntil.slice(0, 10)}
                    </p>
                    {record.retentionOutcomeNotice ? (
                      <p className="consent-review-result">{record.retentionOutcomeNotice}</p>
                    ) : null}
                    {canReview ? (
                      <>
                        <label className="pickup-review-confirm">
                          <input
                            aria-label="确认已核对该模拟授权记录"
                            checked={confirmed[index] === true}
                            disabled={working}
                            onChange={(event) => {
                              const checked = event.currentTarget.checked;
                              setConfirmed((current) => ({ ...current, [index]: checked }));
                            }}
                            type="checkbox"
                          />
                          <span>我已核对这条模拟记录，确认只更新本机演练状态。</span>
                        </label>
                        <div className="consent-review-actions">
                          <button
                            className="pickup-review-primary"
                            disabled={disabled}
                            onClick={() => void review(index, "REQUIRED_HOLD")}
                            type="button"
                          >
                            标记必要保留
                          </button>
                          <button
                            className="pickup-review-secondary"
                            disabled={disabled}
                            onClick={() => void review(index, "SIMULATE_EXPIRY")}
                            type="button"
                          >
                            期限到期演练
                          </button>
                        </div>
                      </>
                    ) : null}
                    <p className="consent-review-data-state">
                      本机模拟状态；没有删除或改变真实资料，dataChanged=false。
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="pickup-review-empty">当前负责范围内没有同意记录。</p>
          )}
        </section>
      ) : null}
      <p className="pickup-review-footnote">
        示例期限不是法律结论；此页面不执行真实删除或资料变更。
      </p>
    </section>
  );
}
