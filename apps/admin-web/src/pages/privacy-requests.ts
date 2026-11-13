import type {
  PrivacyRequestStatus,
  PrivacyRequestType,
  PrivacyRequestView,
  PrivacyReviewerProfile,
} from "../local-review/privacy-requests.js";

const typeLabels: Record<PrivacyRequestType, string> = {
  ACCESS: "查阅资料",
  CORRECT: "更正资料",
  COPY: "获取资料副本",
  DELETE: "删除申请",
};

const statusLabels: Record<PrivacyRequestStatus, string> = {
  SUBMITTED: "待开始处理",
  IN_REVIEW: "处理中",
  SIMULATED_COMPLETE: "本机处理演示完成",
  WITHDRAWN: "已撤回",
};

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

export function renderPrivacyRequestsPage(input: {
  profile: PrivacyReviewerProfile;
  rows: readonly PrivacyRequestView[];
  canAct: boolean;
  busy: boolean;
  message: string;
}): string {
  const rows = input.rows.length
    ? `<ul class="block-list privacy-request-list">${input.rows
        .map((row, index) => {
          const action =
            input.canAct && row.status === "SUBMITTED"
              ? `<button class="save" type="button" data-privacy-action="START" data-privacy-index="${index}" ${input.busy ? "disabled" : ""}>开始处理</button>`
              : input.canAct && row.status === "IN_REVIEW"
                ? `<button class="save" type="button" data-privacy-action="COMPLETE" data-privacy-index="${index}" ${input.busy ? "disabled" : ""}>完成本机处理演示</button>`
                : "";
          const completion =
            row.status === "SIMULATED_COMPLETE"
              ? `<p class="notice">处理流程已完成；没有访问、复制、更正或删除真实资料，dataChanged=false。</p>`
              : "";
          return `<li>
            <strong>${typeLabels[row.type]}</strong>
            <span class="block-kind">${statusLabels[row.status]}</span>
            <time datetime="${escapeHtml(row.updatedAt)}">更新于 ${escapeHtml(row.updatedAt.slice(0, 10))}</time>
            ${completion}
            ${action}
          </li>`;
        })
        .join("")}</ul>`
    : `<p class="summary">当前负责人范围内没有待处理申请。</p>`;

  return `<main class="review-main">
    <section class="panel" aria-labelledby="privacy-review-title">
      <h1 id="privacy-review-title">个人信息申请</h1>
      <p>仅查看服务端按当前负责人身份确定范围内的申请摘要，不展示学生、家长或机构内部编号。</p>
      <form data-privacy-profile-form>
        <label for="privacy-review-profile">审核范围</label>
        <select id="privacy-review-profile" name="profile" ${input.busy ? "disabled" : ""}>
          <option value="owner-east" ${input.profile === "owner-east" ? "selected" : ""}>示例东校区负责人</option>
          <option value="owner-west" ${input.profile === "owner-west" ? "selected" : ""}>示例西校区负责人</option>
        </select>
        <button class="save" type="submit" ${input.busy ? "disabled" : ""}>切换范围</button>
      </form>
      <p class="notice" aria-live="polite" data-privacy-review-status>${escapeHtml(input.message)}</p>
      <button class="save" type="button" data-privacy-refresh ${input.busy ? "disabled" : ""}>刷新申请</button>
      ${input.canAct ? "" : `<p class="summary">当前为只读查看，不允许处理申请。</p>`}
      ${rows}
      <p class="summary">本页只更新本机演示状态，不会访问、复制、更正或删除真实资料。</p>
    </section>
  </main>`;
}
