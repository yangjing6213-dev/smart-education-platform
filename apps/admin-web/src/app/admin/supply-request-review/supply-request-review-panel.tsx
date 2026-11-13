"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SupplyRequestReviewClient,
  type SupplyRequestReviewRole,
  type SupplyRequestReviewSnapshot,
} from "../../../local-review/supply-request";

type PanelProps = Readonly<{ baseUrl: string }>;
type Row = SupplyRequestReviewSnapshot["rows"][number];
type Status = keyof SupplyRequestReviewSnapshot["counts"];

const STATUS: Record<Status, string> = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  CONFIRMED: "已确认",
  RETURNED: "已退回",
  READY: "可领取",
  OUT_OF_STOCK: "缺货",
  CANCELLED: "已取消",
  CLAIMED: "已领取",
};
const CATALOG: Record<Row["catalog"], string> = {
  STATIONERY_SET: "日常文具包",
  ART_ACTIVITY_SET: "美术活动包",
  CLEANING_SET: "清洁用品包",
  FIRST_AID_SET: "基础急救包",
};
const PURPOSE: Record<Row["purpose"], string> = {
  CLASS_ACTIVITY: "班级活动",
  DAILY_OPERATION: "日常运营",
  EMERGENCY_STOCK: "应急储备",
};
const ROLE_OPTIONS: readonly SupplyRequestReviewRole[] = ["CAMPUS_REVIEWER", "PLATFORM_ADMIN"];

const ROLES: Record<SupplyRequestReviewRole, string> = {
  CAMPUS_REVIEWER: "校区负责人 · 东区",
  INSTITUTION_REVIEWER: "机构负责人 · 东区",
  PLATFORM_ADMIN: "平台管理员 · 匿名统计",
};

function createLocalSupplyTransport(baseUrl: string): typeof fetch {
  const base = new URL(baseUrl);
  if (
    base.protocol !== "http:" ||
    base.hostname !== "127.0.0.1" ||
    !["4317", "4319"].includes(base.port) ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("物资服务地址无效。");
  const fixedPaths = new Set([
    "/local/sessions",
    "/local/session",
    "/local/supply-requests-review",
    "/local/supply-requests",
    "/local/supply-summary",
  ]);
  const commandPath =
    /^\/local\/supply-requests\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(?:review|claim)$/iu;
  return (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, base);
    if (
      url.origin !== base.origin ||
      url.search ||
      url.hash ||
      (!fixedPaths.has(url.pathname) && !commandPath.test(url.pathname))
    )
      return Promise.reject(new Error("已阻止访问本机演示服务范围以外的地址。"));
    return fetch(url, init);
  };
}

export function SupplyRequestReviewPanel({ baseUrl }: PanelProps) {
  const client = useMemo(
    () => new SupplyRequestReviewClient(createLocalSupplyTransport(baseUrl)),
    [baseUrl],
  );
  const [snapshot, setSnapshot] = useState<SupplyRequestReviewSnapshot>(client.snapshot);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const connected = client.connect("CAMPUS_REVIEWER");
    setSnapshot({ ...client.snapshot });
    void connected.then(() => {
      if (active) setSnapshot({ ...client.snapshot });
    });
    return () => {
      active = false;
      client.disconnect();
    };
  }, [client]);

  async function connect(role: SupplyRequestReviewRole) {
    setBusy(true);
    setConfirmed(false);
    const connected = client.connect(role);
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
      /* client stores a safe message in its snapshot */
    }
    setSnapshot({ ...client.snapshot });
    setConfirmed(false);
    setBusy(false);
  }

  async function run(row: Row, action: "CONFIRM" | "RETURN" | "OUT_OF_STOCK" | "CLAIM") {
    setBusy(true);
    try {
      await client.command(row.id, row.version, action);
    } catch {
      /* client stores a safe message in its snapshot */
    }
    setSnapshot({ ...client.snapshot });
    setConfirmed(false);
    setBusy(false);
  }

  const ready = snapshot.status === "READY";
  const platform = snapshot.role === "PLATFORM_ADMIN";
  const disabled = busy || !ready || !confirmed || platform;

  function renderRow(row: Row, inQueue: boolean) {
    return (
      <article className="supply-review-row" key={row.id}>
        <div className="supply-review-row-heading">
          <h3>{CATALOG[row.catalog]}</h3>
          <span>{STATUS[row.status]}</span>
        </div>
        <p className="supply-review-meta">
          {row.quantity} 份 · {PURPOSE[row.purpose]} · 申请教师：{row.authorLabel}
        </p>
        <p className="supply-review-meta">申请版本 {row.version}</p>
        {inQueue && row.status === "SUBMITTED" ? (
          <div className="supply-review-actions">
            <button
              className="supply-review-primary"
              disabled={disabled}
              onClick={() => void run(row, "CONFIRM")}
              type="button"
            >
              确认可领取
            </button>
            <button
              className="supply-review-secondary"
              disabled={disabled}
              onClick={() => void run(row, "RETURN")}
              type="button"
            >
              退回修改
            </button>
            <button
              className="supply-review-secondary"
              disabled={disabled}
              onClick={() => void run(row, "OUT_OF_STOCK")}
              type="button"
            >
              标记缺货
            </button>
          </div>
        ) : null}
        {inQueue && row.status === "READY" ? (
          <div className="supply-review-actions">
            <button
              className="supply-review-primary"
              disabled={disabled}
              onClick={() => void run(row, "CLAIM")}
              type="button"
            >
              确认领取
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <section
      aria-busy={busy || snapshot.status === "CONNECTING"}
      aria-labelledby="supply-review-title"
      className="supply-review"
    >
      <header className="supply-review-header">
        <p className="supply-review-eyebrow">物资协作 · 本机合成数据</p>
        <h1 id="supply-review-title">物资申请审核</h1>
        <p>负责人核对固定物资目录和用途，确认后可登记领取；不会产生真实采购。</p>
        <label className="supply-review-role">
          当前审核角色
          <select
            disabled={busy}
            onChange={(event) => void connect(event.currentTarget.value as SupplyRequestReviewRole)}
            value={snapshot.role}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {ROLES[role]}
              </option>
            ))}
          </select>
        </label>
        {snapshot.session ? (
          <p className="supply-review-scope">
            当前身份：{snapshot.session.label} · 当前校区 · {snapshot.session.classIds.length}{" "}
            个授权班级
          </p>
        ) : null}
      </header>
      <div className="supply-review-toolbar">
        <span>{snapshot.rows.filter((row) => row.status === "SUBMITTED").length} 条待审核申请</span>
        <button
          className="supply-review-secondary"
          disabled={busy || snapshot.status === "CONNECTING"}
          onClick={() => void refresh()}
          type="button"
        >
          刷新申请
        </button>
      </div>
      <p aria-live="polite" className="supply-review-message" role="status">
        {snapshot.message}
      </p>
      {ready && !platform ? (
        <label className="supply-review-confirm">
          <input
            checked={confirmed}
            onChange={(event) => setConfirmed(event.currentTarget.checked)}
            type="checkbox"
          />
          我已确认：本次操作只修改本机合成数据，不会发起真实采购。
        </label>
      ) : null}
      <section aria-labelledby="supply-review-counts-title" className="supply-review-section">
        <div className="supply-review-section-heading">
          <h2 id="supply-review-counts-title">{platform ? "匿名状态统计" : "授权范围状态统计"}</h2>
        </div>
        <dl className="supply-review-counts">
          {(Object.keys(STATUS) as Status[]).map((status) => (
            <div key={status}>
              <dt>{STATUS[status]}</dt>
              <dd>{ready ? snapshot.counts[status] : "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
      {platform ? (
        <section className="supply-review-section">
          <p className="supply-review-empty">
            平台管理员只查看状态合计，不显示申请编号、教师、班级或用途。
          </p>
        </section>
      ) : (
        <>
          <section aria-labelledby="supply-review-queue-title" className="supply-review-section">
            <div className="supply-review-section-heading">
              <h2 id="supply-review-queue-title">负责人审核队列</h2>
              <span>{ready ? snapshot.rows.length : 0}</span>
            </div>
            {ready && snapshot.rows.length ? (
              <div className="supply-review-list">
                {snapshot.rows.map((row) => renderRow(row, true))}
              </div>
            ) : (
              <p className="supply-review-empty">
                {snapshot.status === "CONNECTING"
                  ? "正在读取当前校区申请…"
                  : snapshot.status === "ERROR"
                    ? "当前物资申请不可用，请检查本机服务后刷新。"
                    : "当前授权范围没有待处理的物资申请。"}
              </p>
            )}
          </section>
          <section aria-labelledby="supply-review-history-title" className="supply-review-section">
            <div className="supply-review-section-heading">
              <h2 id="supply-review-history-title">其他申请记录</h2>
              <span>{ready ? snapshot.history.length : 0}</span>
            </div>
            {ready && snapshot.history.length ? (
              <div className="supply-review-list">
                {snapshot.history.map((row) => renderRow(row, false))}
              </div>
            ) : (
              <p className="supply-review-empty">暂无其他申请记录。</p>
            )}
          </section>
        </>
      )}
      <p className="supply-review-footnote">仅本机合成数据，不代表真实采购、付款或外部通知。</p>
    </section>
  );
}
