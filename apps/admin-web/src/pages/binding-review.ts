import type {
  AdminBindingReviewRow,
  AdminBindingReviewSnapshot,
} from "../local-review/binding-review.js";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });

const statusLabel: Record<AdminBindingReviewRow["status"], string> = {
  PENDING: "待审核",
  APPROVED: "已确认关系",
  REJECTED: "已拒绝",
  RELEASED: "已解除",
  WITHDRAWN: "已撤回",
};

function formatAuditTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function renderAdminBindingReview(
  snapshot: AdminBindingReviewSnapshot & { readonly confirmed: boolean },
): string {
  const profile = snapshot.profile ?? "owner-east";
  const rows = snapshot.records.length
    ? snapshot.records
        .map((row, index) => {
          const reviewAction = row.status === "APPROVED" ? "approve" : row.status === "REJECTED" ? "reject" : null;
          const reviewAudit = reviewAction
            ? snapshot.audit.find(
                (event) =>
                  event.objectId === row.id &&
                  event.version === row.version &&
                  event.action === reviewAction,
              )
            : undefined;
          const auditDetails =
            !reviewAction
              ? ""
              : !snapshot.auditAvailable
                ? `<p class="summary">本机模拟审核记录暂不可查看。</p>`
                : reviewAudit
                  ? `<p class="summary">本机模拟审核角色 · ${reviewAction === "approve" ? "关系已确认" : "申请已拒绝"} · ${escapeHtml(formatAuditTime(reviewAudit.at))}</p>`
                  : `<p class="summary">未找到与当前关系状态匹配的本机审核记录。</p>`;
          const actions =
            row.status === "PENDING" && snapshot.canReview
              ? `<div class="review-actions"><button class="save" type="button" data-binding-action="approve" data-binding-index="${index}"${snapshot.confirmed && snapshot.status === "READY" ? "" : " disabled"}>确认关系</button><button class="save" type="button" data-binding-action="reject" data-binding-index="${index}"${snapshot.confirmed && snapshot.status === "READY" ? "" : " disabled"}>拒绝申请</button></div>`
              : "";
          return `<li class="binding-review-row"><strong>${escapeHtml(row.studentLabel)} · ${statusLabel[row.status]}</strong><p>申请人：${escapeHtml(row.guardianLabel)} · 关系：监护人</p><p>${escapeHtml(row.campusLabel)} · ${escapeHtml(row.classLabel)}</p>${auditDetails}${actions}</li>`;
        })
        .join("")
    : `<p class="summary">当前校区没有可查看的家长关系申请。</p>`;
  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";

  return `<main class="review-main">
    <section class="panel" aria-labelledby="binding-review-title">
      <p class="notice">本机合成数据 · 按当前负责人校区隔离 · 不连接真实机构</p>
      <h1 id="binding-review-title">家长关系审核</h1>
      <p>仅查看虚构的申请人称呼、学生别名、校区与班级。页面不显示手机号、微信号或内部编号。</p>
      <label for="binding-review-profile">审核范围</label>
      <select id="binding-review-profile"${busy ? " disabled" : ""}>
        <option value="owner-east"${profile === "owner-east" ? " selected" : ""}>示例东校区负责人</option>
        <option value="owner-west"${profile === "owner-west" ? " selected" : ""}>示例西校区负责人</option>
      </select>
      <button class="save" id="binding-review-refresh" type="button"${busy || snapshot.status !== "READY" ? " disabled" : ""}>刷新申请</button>
      <p role="status" aria-live="polite" data-binding-review-message>${escapeHtml(snapshot.message)}</p>
      <label><input type="checkbox" data-binding-review-confirm${snapshot.confirmed ? " checked" : ""}${snapshot.status !== "READY" || !snapshot.canReview ? " disabled" : ""}>我已确认：下面只会改变本机演示资料。</label>
      ${snapshot.canReview ? "" : `<p class="summary">当前身份不能执行关系审核，页面不显示申请资料。</p>`}
      <ul class="block-list">${rows}</ul>
      <p class="summary">本机模拟记录展示审核动作和时间，不记录审核说明，也不显示真实审核人；不能作为正式机构审核记录。</p>
      <a href="/admin">返回管理首页</a>
    </section>
  </main>`;
}
