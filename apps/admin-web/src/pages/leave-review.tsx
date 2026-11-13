import type {
  AdminLeaveReviewRow,
  AdminLeaveReviewSnapshot,
} from "../local-review/leave-review-client.js";

const STATUS_LABELS: Readonly<Record<AdminLeaveReviewRow["status"], string>> = {
  SUBMITTED: "待审核",
  CONFIRMED: "已通过",
  RETURNED: "已退回",
  WITHDRAWN: "已撤回",
};

const REASON_LABELS: Readonly<Record<AdminLeaveReviewRow["reason"], string>> = {
  FAMILY_ARRANGEMENT: "家庭安排",
  TEMPORARY_MATTER: "临时事务",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Readonly<Record<string, string>> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function rowHtml(row: AdminLeaveReviewRow, canReview: boolean): string {
  const actions =
    row.status === "SUBMITTED"
      ? `<div class="actions"><button type="button" data-admin-leave-id="${escapeHtml(row.id)}" data-version="${row.version}" data-decision="CONFIRM"${canReview ? "" : " disabled"}>审核通过</button><button type="button" data-admin-leave-id="${escapeHtml(row.id)}" data-version="${row.version}" data-decision="RETURN"${canReview ? "" : " disabled"}>退回修改</button></div>`
      : "<p>此申请已处理，不能重复审核。</p>";
  return `<article class="panel" data-admin-leave-status="${row.status}"><h2>${escapeHtml(row.studentLabel)} · ${STATUS_LABELS[row.status]}</h2><p>申请人：${escapeHtml(row.guardianLabel)}</p><p>${escapeHtml(row.startDate)} 至 ${escapeHtml(row.endDate)} · ${REASON_LABELS[row.reason]}</p><p>${row.acknowledged ? "家长已确认知悉" : "等待家长查看或后续处理"}</p>${actions}</article>`;
}

export function renderAdminLeaveReview(
  snapshot: AdminLeaveReviewSnapshot,
  canReview = true,
): string {
  const count = (status: AdminLeaveReviewRow["status"]) =>
    snapshot.records.filter((row) => row.status === status).length;
  const detail =
    snapshot.status === "READY"
      ? snapshot.records.length
        ? snapshot.records.map((row) => rowHtml(row, canReview)).join("")
        : '<p class="panel">当前校区暂无请假申请。</p>'
      : `<p class="panel" role="status" aria-live="polite">${escapeHtml(snapshot.message)}</p>`;
  const counts =
    snapshot.status === "READY"
      ? `<p class="panel" aria-label="当前校区请假状态统计">待审核 ${count("SUBMITTED")} · 已通过 ${count("CONFIRMED")} · 已退回 ${count("RETURNED")} · 已撤回 ${count("WITHDRAWN")}</p>`
      : "";
  return `<main><p>同芯学园 · 机构管理</p><h1>请假审核</h1><p>仅显示当前负责校区内的合成申请；处理结果会同步到家长和小程序页面。</p><p data-admin-leave-notice role="status" aria-live="polite">${escapeHtml(snapshot.message)}</p><button type="button" data-admin-leave-refresh${snapshot.status === "BUSY" || snapshot.status === "CONNECTING" ? " disabled" : ""}>刷新申请</button>${counts}<section aria-label="当前校区请假申请">${detail}</section><p>仅本机合成演示，不连接真实机构服务。</p></main>`;
}
