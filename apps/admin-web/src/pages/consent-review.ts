import type {
  ConsentReviewRow,
  ConsentReviewSnapshot,
  ConsentReviewerProfile,
} from "../local-review/consent.js";

export function consentReviewProfilePath(profile: ConsentReviewerProfile, search: string): string {
  const query = new URLSearchParams({ profile });
  const mode = new URLSearchParams(search).get("mode");
  if (mode !== null) query.set("mode", mode);
  return `/admin/consent-review?${query.toString()}`;
}

const statusLabel: Record<ConsentReviewRow["retentionStatus"], string> = {
  WITHIN_PERIOD: "演示期限内",
  REVIEW_DUE: "等待负责人复核",
  REQUIRED_HOLD: "已标记为演示保留",
  SIMULATED_EXPIRED: "已完成到期演练",
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

export function renderConsentReviewPage(
  input: Pick<ConsentReviewSnapshot, "status" | "profile" | "records" | "message"> & {
    confirmed: boolean;
    canReview: boolean;
  },
): string {
  const rows = input.records.length
    ? `<ul class="block-list">${input.records
        .map((row, index) => {
          const actionButtons =
            input.canReview &&
            input.status === "READY" &&
            row.status === "ACTIVE" &&
            row.retentionStatus === "REVIEW_DUE"
              ? `<button class="save" type="button" data-consent-action="REQUIRED_HOLD" data-consent-index="${index}" ${input.confirmed ? "" : "disabled"}>标记必要保留</button><button class="save" type="button" data-consent-action="SIMULATE_EXPIRY" data-consent-index="${index}" ${input.confirmed ? "" : "disabled"}>期限到期演练</button>`
              : "";
          const resultNotice =
            row.retentionStatus === "REQUIRED_HOLD" || row.retentionStatus === "SIMULATED_EXPIRED"
              ? `<p class="notice">${escapeHtml(row.retentionOutcomeNotice ?? "本机演示状态已更新；尚未删除任何数据。dataChanged=false。")}</p>`
              : "";
          return `<li>
            <strong>${escapeHtml(row.purposeTitle)}</strong>
            <span class="block-kind">${statusLabel[row.retentionStatus]}</span>
            <p>告知版本：${escapeHtml(row.noticeVersion)}</p>
            <p>${escapeHtml(row.necessity)}</p>
            <p>示例资料类别：${row.dataClasses.map(escapeHtml).join("、")}</p>
            <time datetime="${escapeHtml(row.retainUntil)}">演示期限 ${row.retentionDays} 天，日期 ${escapeHtml(row.retainUntil.slice(0, 10))}</time>
            ${resultNotice}
            ${actionButtons}
          </li>`;
        })
        .join("")}</ul>`
    : `<p class="summary">当前负责范围内没有同意记录。</p>`;
  const profile = input.profile ?? "owner-east";
  const busy = input.status === "CONNECTING" || input.status === "BUSY";

  return `<main>
    <section class="panel" aria-labelledby="consent-review-title">
      <h1 id="consent-review-title">数据授权与期限复核</h1>
      <p>只显示服务端依据模拟负责人身份确定范围内的必要摘要；不展示学生、监护人或内部编号。</p>
      <form class="field" data-consent-profile-form>
        <label for="consent-review-profile">当前审核身份</label>
        <select id="consent-review-profile" name="profile" ${busy ? "disabled" : ""}>
          <option value="owner-east" ${profile === "owner-east" ? "selected" : ""}>示例东校区负责人</option>
          <option value="owner-west" ${profile === "owner-west" ? "selected" : ""}>示例西校区负责人</option>
        </select>
        <button class="save" type="submit" ${busy ? "disabled" : ""}>连接并刷新</button>
      </form>
      <p class="notice" role="status" aria-live="polite" data-consent-review-status>${escapeHtml(input.message)}</p>
      <label><input type="checkbox" data-consent-review-confirm ${input.confirmed ? "checked" : ""} ${input.status !== "READY" || !input.canReview ? "disabled" : ""} />我已了解：以下操作仅改变本机演示状态，不会删除任何数据。</label>
      ${input.canReview ? "" : `<p class="summary">当前模式仅供查看，不允许提交复核。</p>`}
      ${rows}
      <p class="summary">必要保留与到期演练只改变本机演示状态；尚未删除任何数据，dataChanged=false。示例期限不代表真实保留政策或法律结论。</p>
    </section>
  </main>`;
}
