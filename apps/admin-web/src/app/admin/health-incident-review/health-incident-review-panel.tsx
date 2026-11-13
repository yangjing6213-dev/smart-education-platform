"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Capability = "health:review" | "health:supplement" | "health:publish" | "health:revoke";
type HealthStatus =
  "SUBMITTED" | "EXCEPTION_PENDING" | "CONFIRMED" | "PUBLISHED" | "RETURNED" | "REVOKED";
type DispositionCode =
  "OBSERVATION_RECHECKED" | "FOLLOW_UP_SCHEDULED" | "GUARDIAN_SUMMARY_PREPARED";
type SummaryCode = "FOLLOW_UP_IN_PROGRESS" | "FOLLOW_UP_COMPLETED" | "PLEASE_CHECK_PAGE_LATER";
type HealthRow = Readonly<{
  id: string;
  version: number;
  status: HealthStatus;
  student_label: string;
  observation_code: string;
  observation_label: string;
  disposition_code: DispositionCode | null;
  disposition_label: string | null;
  summary_code: SummaryCode | null;
  published: boolean;
  created_by_label: string;
}>;
type PanelStatus = "CHECKING" | "READY" | "UNAUTHENTICATED" | "FORBIDDEN" | "ERROR";
type PanelState = Readonly<{
  status: PanelStatus;
  displayName: string;
  capabilities: readonly string[];
  rows: readonly HealthRow[];
  message: string;
}>;

const INITIAL: PanelState = {
  status: "CHECKING",
  displayName: "",
  capabilities: [],
  rows: [],
  message: "正在确认当前账号权限…",
};
const DISPOSITIONS: readonly [DispositionCode, string][] = [
  ["OBSERVATION_RECHECKED", "已重新核对观察"],
  ["FOLLOW_UP_SCHEDULED", "已安排跟进"],
  ["GUARDIAN_SUMMARY_PREPARED", "已准备家长摘要"],
];
const SUMMARIES: readonly [SummaryCode, string][] = [
  ["FOLLOW_UP_IN_PROGRESS", "后续跟进正在进行。"],
  ["FOLLOW_UP_COMPLETED", "后续跟进已完成。"],
  ["PLEASE_CHECK_PAGE_LATER", "请稍后查看页面内的更新。"],
];
const STATUS: Readonly<Record<HealthStatus, string>> = {
  SUBMITTED: "待审核",
  EXCEPTION_PENDING: "需负责人继续跟进",
  CONFIRMED: "已审核",
  PUBLISHED: "已发布",
  RETURNED: "已退回",
  REVOKED: "已撤回",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function responseData(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => undefined);
  return isRecord(payload) ? payload.data : undefined;
}

function healthRows(value: unknown): readonly HealthRow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (
    value.some(
      (item) =>
        !isRecord(item) ||
        typeof item.id !== "string" ||
        !Number.isSafeInteger(item.version) ||
        typeof item.status !== "string" ||
        typeof item.student_label !== "string" ||
        typeof item.observation_label !== "string" ||
        typeof item.published !== "boolean" ||
        typeof item.created_by_label !== "string",
    )
  )
    return undefined;
  return value as readonly HealthRow[];
}

function messageFor(status: number): string {
  if (status === 401) return "登录状态已失效，请重新登录。";
  if (status === 403) return "当前账号没有查看或处理此范围记录的权限。";
  if (status === 409) return "记录刚刚发生变化，列表已刷新，请核对后重试。";
  return "暂时无法读取健康审核记录，请稍后重试。";
}

export function HealthIncidentReviewPanel() {
  const [snapshot, setSnapshot] = useState<PanelState>(INITIAL);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dispositions, setDispositions] = useState<Record<string, DispositionCode>>({});
  const [summaries, setSummaries] = useState<Record<string, SummaryCode>>({});

  const load = useCallback(async () => {
    setSnapshot((current) => ({
      ...current,
      status: "CHECKING",
      rows: [],
      message: "正在确认当前账号权限…",
    }));
    try {
      const meResponse = await fetch("/api/admin/me", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (meResponse.status === 401) {
        setSnapshot({
          ...INITIAL,
          status: "UNAUTHENTICATED",
          message: "请先使用邀请账号登录。",
        });
        return;
      }
      if (!meResponse.ok) {
        setSnapshot({
          ...INITIAL,
          status: "ERROR",
          message: messageFor(meResponse.status),
        });
        return;
      }
      const me = await responseData(meResponse);
      if (!isRecord(me) || typeof me.display_name !== "string" || !Array.isArray(me.memberships)) {
        setSnapshot({
          ...INITIAL,
          status: "ERROR",
          message: "登录信息暂时无法确认，请稍后重试。",
        });
        return;
      }
      const active = me.memberships.filter(
        (membership) => isRecord(membership) && membership.status === "ACTIVE",
      );
      const membership = active[0];
      const capabilities =
        isRecord(membership) && Array.isArray(membership.capabilities)
          ? membership.capabilities.filter(
              (capability): capability is string => typeof capability === "string",
            )
          : [];
      if (active.length !== 1 || !capabilities.includes("health:review")) {
        setSnapshot({
          status: "FORBIDDEN",
          displayName: me.display_name,
          capabilities,
          rows: [],
          message: "当前账号没有健康审核权限，记录内容已隐藏。",
        });
        return;
      }

      const queueResponse = await fetch("/api/admin/staff/health-incidents", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (!queueResponse.ok) {
        const status = queueResponse.status;
        setSnapshot({
          status: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "ERROR",
          displayName: me.display_name,
          capabilities,
          rows: [],
          message: messageFor(status),
        });
        return;
      }
      const rows = healthRows(await responseData(queueResponse));
      if (!rows) {
        setSnapshot({
          status: "ERROR",
          displayName: me.display_name,
          capabilities,
          rows: [],
          message: "管理服务返回的数据无法安全显示。",
        });
        return;
      }
      setSnapshot({
        status: "READY",
        displayName: me.display_name,
        capabilities,
        rows,
        message: "已按当前登录账号的授权范围读取记录。",
      });
    } catch {
      setSnapshot({
        ...INITIAL,
        status: "ERROR",
        message: "暂时无法连接管理服务，请稍后重试。",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function perform(
    row: HealthRow,
    action: "review" | "supplement" | "publish" | "revoke",
    body: Record<string, unknown>,
  ) {
    setBusy(true);
    setConfirmed(false);
    try {
      const response = await fetch(`/api/admin/staff/health-incidents/${row.id}/${action}`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const status = response.status;
        if (status === 409) await load();
        else
          setSnapshot((current) => ({
            ...current,
            status: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "ERROR",
            rows: status === 401 || status === 403 ? [] : current.rows,
            message: messageFor(status),
          }));
        return;
      }
      await load();
    } catch {
      setSnapshot((current) => ({
        ...current,
        status: "ERROR",
        message: "操作没有完成，请检查网络后重试。",
      }));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/admin/identity/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: "{}",
      });
    } finally {
      window.location.assign("/admin/login?next=%2Fadmin%2Fhealth-incident-review");
    }
  }

  const can = (capability: Capability) => snapshot.capabilities.includes(capability);
  const ready = snapshot.status === "READY";
  const rowActionEnabled = (capability: Capability) =>
    ready && !busy && confirmed && can(capability);

  return (
    <section
      aria-busy={snapshot.status === "CHECKING" || busy}
      className="health-incident-review pickup-review"
      aria-labelledby="health-incident-title"
    >
      <header className="pickup-review-header">
        <p className="pickup-review-eyebrow">员工上报 · 校区审核 · 家长查看</p>
        <h1 id="health-incident-title">健康异常审核与发布</h1>
        <p>
          仅处理固定观察项和处置项。审核后还需单独发布，已绑定家长才可查看；页面不提供自由文本、医疗诊断或建议。
        </p>
        <p className="health-incident-scope">
          审核范围由当前登录账号的有效成员与校区权限确定 · 合成数据
        </p>
      </header>

      <div className="pickup-review-toolbar">
        {snapshot.status === "UNAUTHENTICATED" ? (
          <Link
            className="pickup-review-primary"
            href="/admin/login?next=%2Fadmin%2Fhealth-incident-review"
          >
            前往账号登录
          </Link>
        ) : null}
        {ready || snapshot.status === "ERROR" || snapshot.status === "FORBIDDEN" ? (
          <button
            className="pickup-review-secondary"
            type="button"
            disabled={busy}
            onClick={() => void load()}
          >
            {snapshot.status === "READY" ? "刷新审核列表" : "重新检查权限"}
          </button>
        ) : null}
        {snapshot.status !== "UNAUTHENTICATED" && snapshot.status !== "CHECKING" ? (
          <button
            className="pickup-review-secondary"
            type="button"
            disabled={busy}
            onClick={() => void logout()}
          >
            退出登录
          </button>
        ) : null}
      </div>

      <p className="pickup-review-message" role="status" aria-live="polite">
        {snapshot.message}
      </p>
      {snapshot.displayName ? (
        <p className="health-incident-session">
          当前审核人：{snapshot.displayName} · 范围由服务端校验
        </p>
      ) : null}

      {ready ? (
        <label className="pickup-review-confirm">
          <input
            data-health-incident-confirm
            type="checkbox"
            checked={confirmed}
            disabled={busy}
            onChange={(event) => setConfirmed(event.currentTarget.checked)}
          />
          我已核对当前仅为本机合成记录，处理结果不会自动发送给家长。
        </label>
      ) : null}

      <section className="pickup-review-section" aria-labelledby="health-incident-queue-title">
        <div className="pickup-review-section-heading">
          <h2 id="health-incident-queue-title">待审核与已发布记录</h2>
          <span>{ready ? `${snapshot.rows.length} 条` : "—"}</span>
        </div>
        {ready && snapshot.rows.length ? (
          <div className="pickup-review-list">
            {snapshot.rows.map((row) => (
              <article
                className="pickup-review-row health-incident-row"
                data-health-incident-row={row.id}
                key={row.id}
              >
                <div className="pickup-review-row-heading">
                  <h3>{row.student_label}</h3>
                  <span>{STATUS[row.status]}</span>
                </div>
                <p>
                  {row.observation_label} · 记录版本 {row.version} · 当前授权范围内
                </p>
                <p>固定处置项：{row.disposition_label ?? "尚未选择"}</p>
                {row.summary_code ? (
                  <p>
                    家长摘要：
                    {SUMMARIES.find(([code]) => code === row.summary_code)?.[1]}
                  </p>
                ) : null}

                {row.status === "SUBMITTED" || row.status === "EXCEPTION_PENDING" ? (
                  <div className="health-incident-actions">
                    <button
                      className="pickup-review-primary"
                      data-health-incident-action="CONFIRM"
                      type="button"
                      disabled={!rowActionEnabled("health:review")}
                      onClick={() =>
                        void perform(row, "review", {
                          version: row.version,
                          action: "CONFIRM",
                        })
                      }
                    >
                      审核通过
                    </button>
                    <button
                      className="pickup-review-secondary"
                      data-health-incident-action="RETURN"
                      type="button"
                      disabled={!rowActionEnabled("health:review")}
                      onClick={() =>
                        void perform(row, "review", {
                          version: row.version,
                          action: "RETURN",
                        })
                      }
                    >
                      退回报告者
                    </button>
                    {row.status === "SUBMITTED" ? (
                      <button
                        className="pickup-review-secondary"
                        data-health-incident-action="ESCALATE"
                        type="button"
                        disabled={!rowActionEnabled("health:review")}
                        onClick={() =>
                          void perform(row, "review", {
                            version: row.version,
                            action: "ESCALATE",
                          })
                        }
                      >
                        标记人工跟进
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {row.status === "CONFIRMED" || row.status === "PUBLISHED" ? (
                  <div className="health-incident-actions">
                    <label className="health-incident-choice">
                      固定处置项
                      <select
                        data-health-incident-disposition={row.id}
                        disabled={busy}
                        value={
                          dispositions[row.id] ?? row.disposition_code ?? "OBSERVATION_RECHECKED"
                        }
                        onChange={(event) => {
                          const value = event.currentTarget.value as DispositionCode;
                          setDispositions((current) => ({
                            ...current,
                            [row.id]: value,
                          }));
                        }}
                      >
                        {DISPOSITIONS.map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="pickup-review-secondary"
                      data-health-incident-action="SUPPLEMENT"
                      type="button"
                      disabled={!rowActionEnabled("health:supplement")}
                      onClick={() =>
                        void perform(row, "supplement", {
                          version: row.version,
                          dispositionCode:
                            dispositions[row.id] ?? row.disposition_code ?? "OBSERVATION_RECHECKED",
                        })
                      }
                    >
                      更新固定处置项
                    </button>
                    {row.status === "CONFIRMED" ? (
                      <>
                        <label className="health-incident-choice">
                          家长摘要
                          <select
                            data-health-incident-summary={row.id}
                            disabled={busy}
                            value={summaries[row.id] ?? "FOLLOW_UP_IN_PROGRESS"}
                            onChange={(event) => {
                              const value = event.currentTarget.value as SummaryCode;
                              setSummaries((current) => ({
                                ...current,
                                [row.id]: value,
                              }));
                            }}
                          >
                            {SUMMARIES.map(([code, label]) => (
                              <option key={code} value={code}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="pickup-review-primary"
                          data-health-incident-action="PUBLISH"
                          type="button"
                          disabled={!rowActionEnabled("health:publish")}
                          onClick={() =>
                            void perform(row, "publish", {
                              version: row.version,
                              summaryCode: summaries[row.id] ?? "FOLLOW_UP_IN_PROGRESS",
                            })
                          }
                        >
                          发布家长摘要
                        </button>
                      </>
                    ) : (
                      <button
                        className="pickup-review-secondary"
                        data-health-incident-action="REVOKE"
                        type="button"
                        disabled={!rowActionEnabled("health:revoke")}
                        onClick={() => void perform(row, "revoke", { version: row.version })}
                      >
                        撤回家长摘要
                      </button>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : ready ? (
          <p className="pickup-review-empty">当前授权范围没有待处理健康异常。</p>
        ) : (
          <p className="pickup-review-empty">
            {snapshot.status === "CHECKING"
              ? "正在读取当前授权范围的记录…"
              : "登录并通过权限检查后，此处才会显示记录。"}
          </p>
        )}
      </section>
      <p className="pickup-review-footnote">
        健康记录只用于本机合成流程验证；不代替专业判断，不发送真实通知。家长只能查看已审核并单独发布的固定摘要。
      </p>
    </section>
  );
}
