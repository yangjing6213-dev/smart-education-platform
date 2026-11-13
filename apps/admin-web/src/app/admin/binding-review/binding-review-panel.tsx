"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ViewState = "CHECKING" | "UNAUTHENTICATED" | "FORBIDDEN" | "READY" | "ERROR" | "BUSY";
type ReviewAction = "approve" | "reject";
type Application = Readonly<{
  id: string;
  relationship: "GUARDIAN";
  version: number;
  applicant_label: string;
  student_label: string;
  submitted_at: string;
}>;

type ApiResult<T> = Readonly<{ data: T }>;

class AdminApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch("/api/admin/" + path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
    const message = typeof error?.message === "string" ? error.message : "请求未完成，请重试。";
    throw new AdminApiError(message, response.status);
  }
  if (!isRecord(payload) || !("data" in payload))
    throw new AdminApiError("服务返回内容不完整，请稍后重试。", 502);
  return payload as ApiResult<T>;
}

function hasReviewCapability(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.memberships)) return false;
  return value.memberships.some(
    (membership) =>
      isRecord(membership) &&
      membership.status === "ACTIVE" &&
      Array.isArray(membership.capabilities) &&
      membership.capabilities.includes("binding:review"),
  );
}

function isApplication(value: unknown): value is Application {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.relationship === "GUARDIAN" &&
    Number.isSafeInteger(value.version) &&
    Number(value.version) > 0 &&
    typeof value.applicant_label === "string" &&
    value.applicant_label.trim().length > 0 &&
    value.applicant_label.length <= 80 &&
    typeof value.student_label === "string" &&
    value.student_label.trim().length > 0 &&
    value.student_label.length <= 80 &&
    typeof value.submitted_at === "string" &&
    Number.isFinite(Date.parse(value.submitted_at))
  );
}

const PANEL_STATE_TEXT: Record<ViewState, string> = {
  CHECKING: "正在确认当前账号权限…",
  UNAUTHENTICATED: "请使用机构邀请账号登录后查看待审核申请。",
  FORBIDDEN: "当前账号没有关系审核权限，申请详情已隐藏。",
  READY: "审核范围由当前账号的服务端权限确定。",
  ERROR: "暂时无法读取审核信息，请稍后重试。",
  BUSY: "正在处理，请稍候…",
};

export function AdminBindingReviewPanel() {
  const [state, setState] = useState<ViewState>("CHECKING");
  const [applications, setApplications] = useState<readonly Application[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadQueue() {
    const response = await request<unknown>("staff/guardian-binding/applications");
    if (!Array.isArray(response.data) || !response.data.every(isApplication))
      throw new AdminApiError("审核列表格式不正确，请联系管理员。", 502);
    setApplications(response.data);
  }

  useEffect(() => {
    let active = true;
    async function loadSession() {
      try {
        const session = await request<unknown>("me");
        if (!active) return;
        if (!hasReviewCapability(session.data)) {
          setState("FORBIDDEN");
          return;
        }
        await loadQueue();
        if (active) setState("READY");
      } catch (error) {
        if (!active) return;
        if (error instanceof AdminApiError && error.status === 401) {
          setState("UNAUTHENTICATED");
          return;
        }
        setMessage(error instanceof Error ? error.message : PANEL_STATE_TEXT.ERROR);
        setState("ERROR");
      }
    }
    void loadSession();
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    setBusy(true);
    setMessage("");
    try {
      await loadQueue();
      setState("READY");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : PANEL_STATE_TEXT.ERROR);
      setState("ERROR");
    } finally {
      setBusy(false);
    }
  }

  async function review(application: Application, action: ReviewAction) {
    if (!confirmed || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await request<unknown>("staff/guardian-binding/applications/" + application.id + "/review", {
        method: "POST",
        body: JSON.stringify({ version: application.version, action }),
      });
      setApplications((current) => current.filter((item) => item.id !== application.id));
      setMessage(action === "approve" ? "关系申请已确认。" : "关系申请已拒绝。");
      setState("READY");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : PANEL_STATE_TEXT.ERROR);
      setState("ERROR");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await request<unknown>("identity/logout", { method: "POST", body: "{}" });
      window.location.assign("/admin/login");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "退出登录未完成，请重试。");
      setBusy(false);
    }
  }

  return (
    <section
      aria-busy={busy || state === "CHECKING"}
      aria-labelledby="binding-review-title"
      className="binding-review-panel"
      data-binding-review-state={state}
    >
      <header className="binding-review-header">
        <p className="binding-review-eyebrow">机构管理 · 家长关系</p>
        <h1 id="binding-review-title">家长关系审核</h1>
        <p>审核范围由当前账号的校区权限决定，不显示学生内部编号或其他校区申请。</p>
      </header>

      <div className="binding-review-actions">
        {state === "UNAUTHENTICATED" ? (
          <Link className="binding-review-primary" href="/admin/login">
            前往账号登录
          </Link>
        ) : null}
        {state === "READY" || state === "ERROR" ? (
          <button
            className="binding-review-secondary"
            disabled={busy}
            id="binding-review-refresh"
            onClick={() => void refresh()}
            type="button"
          >
            刷新申请
          </button>
        ) : null}
        {state !== "UNAUTHENTICATED" && state !== "CHECKING" ? (
          <button
            className="binding-review-secondary"
            disabled={busy}
            onClick={() => void logout()}
            type="button"
          >
            退出登录
          </button>
        ) : null}
      </div>

      <p
        aria-live="polite"
        className="binding-review-message"
        data-binding-review-message
        role="status"
      >
        {message || PANEL_STATE_TEXT[state]}
      </p>

      {state === "READY" ? (
        <>
          <label className="binding-review-confirm">
            <input
              checked={confirmed}
              data-binding-review-confirm
              disabled={busy}
              onChange={(event) => setConfirmed(event.currentTarget.checked)}
              type="checkbox"
            />
            我已核对申请信息，并确认要处理所选关系申请。
          </label>

          {applications.length === 0 ? (
            <p className="binding-review-empty">当前权限范围内没有待审核的关系申请。</p>
          ) : (
            <ul className="binding-review-list">
              {applications.map((application) => (
                <li className="binding-review-row" key={application.id}>
                  <div className="binding-review-row-heading">
                    <strong>{application.applicant_label} · 家长关系申请</strong>
                    <span>待审核 · 监护关系</span>
                  </div>
                  <p>学生：{application.student_label}</p>
                  <p>提交时间：{new Date(application.submitted_at).toLocaleString("zh-CN")}</p>
                  <div className="binding-review-actions">
                    <button
                      className="binding-review-primary"
                      data-binding-action="approve"
                      disabled={busy || !confirmed}
                      onClick={() => void review(application, "approve")}
                      type="button"
                    >
                      确认关系
                    </button>
                    <button
                      className="binding-review-secondary"
                      data-binding-action="reject"
                      disabled={busy || !confirmed}
                      onClick={() => void review(application, "reject")}
                      type="button"
                    >
                      拒绝申请
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <p className="binding-review-footnote">
        每次处理均由服务器重新核对账号权限和申请版本；页面不保存审核身份或申请资料。
      </p>
    </section>
  );
}
