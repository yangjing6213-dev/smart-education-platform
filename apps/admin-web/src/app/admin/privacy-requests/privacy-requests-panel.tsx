"use client";

import { useMemo, useState } from "react";
import {
  PrivacyRequestReviewClient,
  type PrivacyRequestReviewSnapshot,
  type PrivacyReviewerProfile,
} from "../../../local-review/privacy-requests";

type PanelProps = Readonly<{ baseUrl: string }>;

const TYPE_LABEL: Readonly<Record<"ACCESS" | "CORRECT" | "COPY" | "DELETE", string>> = {
  ACCESS: "查阅资料",
  CORRECT: "更正资料",
  COPY: "获取资料副本",
  DELETE: "删除申请",
};

const STATUS_LABEL: Readonly<
  Record<"SUBMITTED" | "IN_REVIEW" | "SIMULATED_COMPLETE" | "WITHDRAWN", string>
> = {
  SUBMITTED: "待开始处理",
  IN_REVIEW: "处理中",
  SIMULATED_COMPLETE: "本机处理演示完成",
  WITHDRAWN: "已撤回",
};

export function PrivacyRequestsPanel({ baseUrl }: PanelProps) {
  const client = useMemo(() => {
    const base = new URL(baseUrl);
    if (
      base.protocol !== "http:" ||
      base.hostname !== "127.0.0.1" ||
      base.port !== "4319" ||
      base.pathname !== "/" ||
      base.search ||
      base.hash
    )
      throw new Error("隐私申请页面只允许连接本机合成服务。");

    const fixedPaths = new Set(["/local/sessions", "/local/session", "/local/privacy-requests"]);
    const reviewPath =
      /^\/local\/privacy-requests\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/review$/iu;
    const fetcher: typeof fetch = (input, init) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(raw, base);
      if (
        url.origin !== base.origin ||
        url.search ||
        url.hash ||
        (!fixedPaths.has(url.pathname) && !reviewPath.test(url.pathname))
      )
        return Promise.reject(new Error("已阻止访问隐私申请审核范围以外的地址。"));
      return fetch(url, {
        ...init,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
      });
    };
    return new PrivacyRequestReviewClient({ baseUrl: base.origin, fetcher });
  }, [baseUrl]);
  const [profile, setProfile] = useState<PrivacyReviewerProfile>("owner-east");
  const [snapshot, setSnapshot] = useState<PrivacyRequestReviewSnapshot>(client.snapshot);
  const [busy, setBusy] = useState(false);
  const ready = snapshot.status === "READY";
  const working = busy || snapshot.status === "CONNECTING" || snapshot.status === "BUSY";

  async function connect() {
    setBusy(true);
    if (ready) await client.refresh();
    else await client.connect(profile);
    setSnapshot(client.snapshot);
    setBusy(false);
  }

  async function review(index: number, action: "START" | "COMPLETE") {
    if (working) return;
    setBusy(true);
    await client.review(index, action);
    setSnapshot(client.snapshot);
    setBusy(false);
  }

  function changeProfile(nextProfile: PrivacyReviewerProfile) {
    client.disconnect();
    setProfile(nextProfile);
    setSnapshot(client.snapshot);
  }

  return (
    <section aria-labelledby="privacy-review-title" className="pickup-review privacy-review">
      <header className="pickup-review-header">
        <p className="pickup-review-eyebrow">隐私申请 · 审核与处理 · 本机合成资料</p>
        <h1 id="privacy-review-title">隐私申请审核</h1>
        <p>只显示当前负责校区和班级范围内的申请摘要，不显示申请人或学生的内部编号。</p>
      </header>

      <div className="pickup-review-toolbar">
        <label className="pickup-review-role" htmlFor="privacy-review-profile">
          当前审核校区
          <select
            disabled={working}
            id="privacy-review-profile"
            onChange={(event) => changeProfile(event.currentTarget.value as PrivacyReviewerProfile)}
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
          {ready ? "刷新申请" : "连接并刷新"}
        </button>
      </div>

      <p aria-live="polite" className="pickup-review-message" role="status">
        {snapshot.message}
      </p>
      {ready ? (
        <section aria-label="当前负责范围内的隐私申请" className="pickup-review-section">
          <div className="pickup-review-section-heading">
            <h2>{snapshot.profile === "owner-west" ? "西校区" : "东校区"} · 申请记录</h2>
            <span>{snapshot.requests.length} 条</span>
          </div>
          {snapshot.requests.length ? (
            <div className="pickup-review-list">
              {snapshot.requests.map((request, index) => {
                const canStart = request.status === "SUBMITTED";
                const canComplete = request.status === "IN_REVIEW";
                return (
                  <article
                    className="pickup-review-row privacy-review-row"
                    data-privacy-review-row={index}
                    key={`${request.id}-${request.version}`}
                  >
                    <div className="pickup-review-row-heading">
                      <h3>{TYPE_LABEL[request.type]}</h3>
                      <span>{STATUS_LABEL[request.status]}</span>
                    </div>
                    <p>更新日期：{request.updatedAt.slice(0, 10)}</p>
                    {request.status === "SIMULATED_COMPLETE" ? (
                      <p className="privacy-review-result">
                        仅完成本机流程演示；没有访问、复制、更正或删除真实资料。dataChanged=false。
                      </p>
                    ) : null}
                    {canStart || canComplete ? (
                      <div className="privacy-review-actions">
                        <button
                          className={canStart ? "pickup-review-primary" : "pickup-review-secondary"}
                          disabled={working}
                          onClick={() => void review(index, canStart ? "START" : "COMPLETE")}
                          type="button"
                        >
                          {canStart ? "开始处理" : "完成本机处理演示"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="pickup-review-empty privacy-review-empty">
              当前负责范围内没有待处理申请。
            </p>
          )}
        </section>
      ) : null}
      <p className="pickup-review-footnote">
        页面只处理虚构申请；所有状态均为本机演示，不会改变真实资料。
      </p>
    </section>
  );
}
