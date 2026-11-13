"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type LeaveReason = "FAMILY_ARRANGEMENT" | "TEMPORARY_MATTER";
type LeaveRow = Readonly<{
  id: string;
  version: number;
  status: "SUBMITTED";
  student_display_ref: string;
  class_ref: string;
  start_date: string;
  end_date: string;
  reason_category: LeaveReason;
  acknowledged: boolean;
}>;
type PanelStatus = "CHECKING" | "READY" | "UNAUTHENTICATED" | "FORBIDDEN" | "ERROR";
type PanelState = Readonly<{
  status: PanelStatus;
  displayName: string;
  rows: readonly LeaveRow[];
  message: string;
}>;

const INITIAL: PanelState = {
  status: "CHECKING",
  displayName: "",
  rows: [],
  message: "正在确认当前账号权限…",
};
const REASONS: Readonly<Record<LeaveReason, string>> = {
  FAMILY_ARRANGEMENT: "家庭安排",
  TEMPORARY_MATTER: "临时事务",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function responseData(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => undefined);
  return isRecord(payload) ? payload.data : undefined;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseRows(value: unknown): readonly LeaveRow[] | undefined {
  if (!Array.isArray(value) || value.length > 200) return undefined;
  const rows = value.map((item): LeaveRow | undefined => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      !UUID.test(item.id) ||
      !Number.isSafeInteger(item.version) ||
      Number(item.version) < 1 ||
      item.status !== "SUBMITTED" ||
      typeof item.student_display_ref !== "string" ||
      item.student_display_ref.trim().length === 0 ||
      item.student_display_ref.length > 80 ||
      typeof item.class_ref !== "string" ||
      item.class_ref.trim().length === 0 ||
      item.class_ref.length > 80 ||
      !validDate(item.start_date) ||
      !validDate(item.end_date) ||
      item.start_date > item.end_date ||
      (item.reason_category !== "FAMILY_ARRANGEMENT" &&
        item.reason_category !== "TEMPORARY_MATTER") ||
      typeof item.acknowledged !== "boolean"
    )
      return undefined;
    return {
      id: item.id,
      version: Number(item.version),
      status: "SUBMITTED",
      student_display_ref: item.student_display_ref,
      class_ref: item.class_ref,
      start_date: item.start_date,
      end_date: item.end_date,
      reason_category: item.reason_category,
      acknowledged: item.acknowledged,
    };
  });
  return rows.some((row) => row === undefined) ? undefined : (rows as LeaveRow[]);
}

function messageFor(status: number): string {
  if (status === 401) return "登录状态已失效，请重新登录。";
  if (status === 403) return "当前账号没有请假审核权限，申请内容已隐藏。";
  if (status === 409) return "申请刚刚发生变化，请刷新列表后核对。";
  if (status === 503) return "审核服务暂时无法使用，请稍后重试。";
  return "请假审核暂时无法完成，请稍后重试。";
}

export function LeaveReviewPanel() {
  const [snapshot, setSnapshot] = useState<PanelState>(INITIAL);
  const [confirmed, setConfirmed] = useState<Readonly<Record<string, boolean>>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (successMessage?: string) => {
    setSnapshot({ ...INITIAL, status: "CHECKING" });
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
        setSnapshot({ ...INITIAL, status: "ERROR", message: messageFor(meResponse.status) });
        return;
      }

      const me = await responseData(meResponse);
      if (!isRecord(me) || typeof me.display_name !== "string" || !Array.isArray(me.memberships)) {
        setSnapshot({ ...INITIAL, status: "ERROR", message: "登录信息暂时无法确认，请稍后重试。" });
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
      if (active.length !== 1 || !capabilities.includes("leave:review")) {
        setSnapshot({
          status: "FORBIDDEN",
          displayName: me.display_name,
          rows: [],
          message: "当前账号没有请假审核权限，申请内容已隐藏。",
        });
        return;
      }

      const queueResponse = await fetch("/api/admin/staff/leave-requests", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (!queueResponse.ok) {
        setSnapshot({
          status:
            queueResponse.status === 401
              ? "UNAUTHENTICATED"
              : queueResponse.status === 403
                ? "FORBIDDEN"
                : "ERROR",
          displayName: me.display_name,
          rows: [],
          message: messageFor(queueResponse.status),
        });
        return;
      }
      const rows = parseRows(await responseData(queueResponse));
      if (!rows) {
        setSnapshot({
          status: "ERROR",
          displayName: me.display_name,
          rows: [],
          message: "审核服务返回的信息无法安全显示。",
        });
        return;
      }
      setSnapshot({
        status: "READY",
        displayName: me.display_name,
        rows,
        message: successMessage ?? "已按当前账号授权范围读取待审核申请。",
      });
    } catch {
      setSnapshot({
        ...INITIAL,
        status: "ERROR",
        message: "暂时无法连接审核服务，请稍后重试。",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    if (busy) return;
    setBusy(true);
    setConfirmed({});
    await load();
    setBusy(false);
  }

  async function review(row: LeaveRow, action: "confirm" | "return") {
    if (busy || !confirmed[row.id]) return;
    setBusy(true);
    setConfirmed({});
    try {
      const response = await fetch(
        "/api/admin/staff/leave-requests/" + row.id + "/review",
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ version: row.version, action }),
        },
      );
      if (!response.ok) {
        if (response.status === 409) await load(messageFor(409));
        else
          setSnapshot((current) => ({
            ...current,
            status: response.status === 401 ? "UNAUTHENTICATED" : response.status === 403 ? "FORBIDDEN" : "ERROR",
            rows: response.status === 401 || response.status === 403 ? [] : current.rows,
            message: messageFor(response.status),
          }));
        return;
      }
      const result = await responseData(response);
      const expectedStatus = action === "confirm" ? "CONFIRMED" : "RETURNED";
      if (
        !isRecord(result) ||
        result.id !== row.id ||
        result.status !== expectedStatus ||
        result.version !== row.version + 1
      ) {
        setSnapshot({
          ...INITIAL,
          status: "ERROR",
          message: "审核结果暂时无法确认，请刷新列表核对。",
        });
        return;
      }
      await load("审核结果已提交，待审核列表已更新。");
    } catch {
      setSnapshot((current) => ({
        ...current,
        status: "ERROR",
        message: "审核结果没有完成，请检查网络后重试。",
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
        headers: { accept: "application/json", "content-type": "application/json" },
        body: "{}",
      });
    } finally {
      window.location.assign("/admin/login?next=%2Fadmin%2Fleave-review");
    }
  }

  const ready = snapshot.status === "READY";
  const working = busy || snapshot.status === "CHECKING";

  return (
    <section
      aria-busy={working}
      aria-labelledby="leave-review-title"
      className="pickup-review leave-review"
    >
      <header className="pickup-review-header">
        <p className="pickup-review-eyebrow">请假申请 · 员工审核 · 家长查看</p>
        <h1 id="leave-review-title">请假审核</h1>
        <p>只显示当前登录账号有权限处理的待审核申请，审核后家长可在页面查看结果。</p>
        <p className="pickup-review-scope">
          {snapshot.displayName ? "审核账号：" + snapshot.displayName + " · " : ""}
          审核范围由服务端权限确定 · 合成数据
        </p>
      </header>

      <div className="pickup-review-toolbar">
        {snapshot.status === "UNAUTHENTICATED" ? (
          <Link
            className="pickup-review-primary"
            href="/admin/login?next=%2Fadmin%2Fleave-review"
          >
            前往账号登录
          </Link>
        ) : null}
        {ready || snapshot.status === "ERROR" || snapshot.status === "FORBIDDEN" ? (
          <button
            className="pickup-review-secondary"
            disabled={working}
            onClick={() => void refresh()}
            type="button"
          >
            {ready ? "刷新申请" : "重新检查权限"}
          </button>
        ) : null}
        {snapshot.status !== "UNAUTHENTICATED" && snapshot.status !== "CHECKING" ? (
          <button className="pickup-review-secondary" disabled={working} onClick={() => void logout()} type="button">
            退出账号
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="pickup-review-message" role="status">
        {snapshot.message}
      </p>

      {ready ? (
        <section aria-label="当前授权范围内的待审核请假申请" className="pickup-review-section">
          <div className="pickup-review-section-heading">
            <h2>待审核申请</h2>
            <span>{snapshot.rows.length} 条</span>
          </div>
          {snapshot.rows.length ? (
            <div className="pickup-review-list">
              {snapshot.rows.map((row) => {
                const disabled = working || confirmed[row.id] !== true;
                return (
                  <article
                    className="pickup-review-row leave-review-row"
                    data-leave-review-row={row.id}
                    key={row.id}
                  >
                    <div className="pickup-review-row-heading">
                      <h3>{row.student_display_ref}</h3>
                      <span>待审核</span>
                    </div>
                    <p>班级：{row.class_ref}</p>
                    <p>
                      {row.start_date} 至 {row.end_date} · {REASONS[row.reason_category]}
                    </p>
                    <p>{row.acknowledged ? "家长已确认知悉" : "等待家长查看处理结果"}</p>
                    <label className="pickup-review-confirm">
                      <input
                        aria-label={"确认审核 " + row.start_date + " 至 " + row.end_date + " 的请假申请"}
                        checked={confirmed[row.id] === true}
                        disabled={working}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setConfirmed((current) => ({ ...current, [row.id]: checked }));
                        }}
                        type="checkbox"
                      />
                      <span>我已核对这条申请，再提交审核结果。</span>
                    </label>
                    <div className="leave-review-actions">
                      <button
                        className="pickup-review-primary"
                        disabled={disabled}
                        onClick={() => void review(row, "confirm")}
                        type="button"
                      >
                        审核通过
                      </button>
                      <button
                        className="pickup-review-secondary"
                        disabled={disabled}
                        onClick={() => void review(row, "return")}
                        type="button"
                      >
                        退回修改
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="pickup-review-empty">当前账号授权范围内暂无待审核申请。</p>
          )}
        </section>
      ) : null}

      {ready ? (
        <dl aria-label="当前请假审核数量" className="pickup-review-summary-grid">
          <div>
            <dt>待审核</dt>
            <dd>{snapshot.rows.length}</dd>
          </div>
        </dl>
      ) : null}

      <p className="pickup-review-footnote">
        页面只显示必要申请摘要；审核记录使用本地合成资料，不发送真实通知。
      </p>
    </section>
  );
}
