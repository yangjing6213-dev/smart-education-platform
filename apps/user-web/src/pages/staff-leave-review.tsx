import {
  isAuthorizedStaff,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "../routes/staff.routes.js";

export const WEB_LEAVE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "CONFIRMED",
  "RETURNED",
  "CANCELLED",
  "EXCEPTION_PENDING",
] as const;

export type WebLeaveStatus = (typeof WEB_LEAVE_STATUSES)[number];
export type WebLeaveDecision = "CONFIRM" | "RETURN";

export interface WebLeaveRequest {
  readonly id: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly classLabel: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: "FAMILY_ARRANGEMENT" | "TEMPORARY_MATTER";
  readonly status: WebLeaveStatus;
  readonly version: number;
  readonly syntheticLabel: "模拟数据";
}

export interface WebLeaveState {
  readonly requests: readonly WebLeaveRequest[];
  readonly audit: readonly {
    readonly requestId: string;
    readonly actor: "模拟员工";
    readonly decision: WebLeaveDecision;
    readonly from: WebLeaveStatus;
    readonly to: WebLeaveStatus;
  }[];
}

export interface WebLeaveCommand {
  readonly requestId: string;
  readonly version: number;
  readonly decision: WebLeaveDecision;
}

export type WebLeaveActionResult =
  | { readonly ok: true; readonly state: WebLeaveState }
  | {
      readonly ok: false;
      readonly state: WebLeaveState;
      readonly error:
        "ACCESS_DENIED" | "INVALID_REQUEST" | "OUT_OF_SCOPE" | "STALE" | "INVALID_STATE";
    };

export interface StaffLeaveReviewInput {
  readonly access: unknown;
  readonly state: WebLeaveState;
  readonly notice?: string;
}

export interface StaffLeaveReviewView {
  readonly kind: "denied" | "error" | "empty" | "ready";
  readonly route: "/staff/report?view=leave-review";
  readonly heading: "请假审核";
  readonly statusAnnouncement: string;
  readonly externalRequests: readonly [];
  readonly focusOrder: readonly string[];
  readonly html: string;
  readonly requests: readonly WebLeaveRequest[];
}

const WEB_SCOPE = {
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-east",
};

interface ReviewStaffAccess {
  readonly role: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
}

const REASON_LABELS: Readonly<Record<WebLeaveRequest["reason"], string>> = {
  FAMILY_ARRANGEMENT: "家庭安排",
  TEMPORARY_MATTER: "临时事务",
};

const STATUS_LABELS: Readonly<Record<WebLeaveStatus, string>> = {
  DRAFT: "草稿",
  SUBMITTED: "待处理",
  CONFIRMED: "已确认",
  RETURNED: "已退回",
  CANCELLED: "已撤回",
  EXCEPTION_PENDING: "待机构复核",
};

const STAFF_LEAVE_REVIEW_STYLES = `
.staff-leave-review {
  display: grid;
  inline-size: min(100% - 32px, 1120px);
  gap: 20px;
  padding-block: 36px 72px;
  overflow: visible;
}

.staff-leave-review > h1 {
  max-inline-size: none;
  margin: 0;
  color: #28542c;
  font-size: clamp(32px, 4vw, 44px);
  line-height: 1.2;
}

.staff-leave-review > p {
  margin: 0;
  color: #66745f;
  line-height: 1.7;
}

.staff-leave-review > [role="status"] {
  padding: 12px 16px;
  border: 1px solid #dce9bd;
  border-radius: 12px;
  color: #315c31;
  background: #f4f9e9;
}

.leave-review-batch {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 20px;
  border: 1px solid #e8eddd;
  border-radius: 18px;
  background: linear-gradient(120deg, #f4f9e8, #fffbed);
}

.leave-review-batch p {
  flex: 1 1 100%;
  margin: 0;
  color: #53624d;
  line-height: 1.65;
}

.staff-leave-review button {
  min-block-size: 44px;
  padding: 10px 18px;
  border: 0;
  border-radius: 999px;
  color: #234a27;
  background: #eaf3d8;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 160ms ease, transform 160ms ease;
}

.leave-review-batch button:first-of-type,
.leave-review-actions button:first-child {
  color: #243f20;
  background: #ffd33e;
}

.staff-leave-review button:hover {
  transform: translateY(-1px);
  background-color: #dcebbd;
}

.leave-review-batch button:first-of-type:hover,
.leave-review-actions button:first-child:hover {
  background-color: #ffca1d;
}

.staff-leave-review button:focus-visible,
.leave-review-select input:focus-visible {
  outline: 3px solid #6e9f31;
  outline-offset: 3px;
}

#leave-review-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
  gap: 16px;
}

.leave-review-card {
  min-inline-size: 0;
  padding: 22px;
  border: 1px solid #e5ebdc;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 26px rgb(49 79 38 / 7%);
}

.leave-review-card h2 {
  margin: 0 0 16px;
  color: #294a2b;
  font-size: clamp(19px, 2vw, 23px);
  line-height: 1.4;
}

.leave-review-card p {
  margin: 0 0 12px;
  color: #687463;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.leave-review-select {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-block: 14px;
  color: #4f604b;
  cursor: pointer;
}

.leave-review-select input {
  inline-size: 20px;
  block-size: 20px;
  margin: 0;
  accent-color: #76a935;
}

.leave-review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.leave-review-actions button + button {
  color: #52604e;
  background: #f0f3eb;
}

.leave-review-actions button + button:hover {
  background: #e3e9d9;
}

@media (max-width: 560px) {
  .staff-leave-review {
    gap: 16px;
    padding-block: 28px 56px;
  }

  .leave-review-batch,
  .leave-review-card {
    padding: 16px;
  }

  .leave-review-batch button {
    flex: 1 1 120px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .staff-leave-review button {
    transition: none;
  }
}
`;

export function createSyntheticStaffLeaveState(): WebLeaveState {
  return {
    requests: [
      {
        id: "leave-web-synthetic-001",
        ...WEB_SCOPE,
        classId: "class-synthetic-grade3-a",
        classLabel: "三年级A班",
        startDate: "2026-10-05",
        endDate: "2026-10-06",
        reason: "FAMILY_ARRANGEMENT",
        status: "SUBMITTED",
        version: 1,
        syntheticLabel: "模拟数据",
      },
      {
        id: "leave-web-synthetic-002",
        ...WEB_SCOPE,
        classId: "class-synthetic-grade3-a",
        classLabel: "三年级A班",
        startDate: "2026-10-08",
        endDate: "2026-10-08",
        reason: "TEMPORARY_MATTER",
        status: "SUBMITTED",
        version: 1,
        syntheticLabel: "模拟数据",
      },
      {
        id: "leave-web-synthetic-other-class",
        ...WEB_SCOPE,
        classId: "class-synthetic-grade3-b",
        classLabel: "模拟其他班级",
        startDate: "2026-10-09",
        endDate: "2026-10-09",
        reason: "FAMILY_ARRANGEMENT",
        status: "SUBMITTED",
        version: 1,
        syntheticLabel: "模拟数据",
      },
    ],
    audit: [],
  };
}

function hasReviewAccess(value: unknown): value is ReviewStaffAccess {
  return isAuthorizedStaff(value, "leave-review");
}

function isValidRequest(value: unknown): value is WebLeaveRequest {
  if (typeof value !== "object" || value === null) return false;
  const request = value as Partial<WebLeaveRequest>;
  return (
    typeof request.id === "string" &&
    request.id.startsWith("leave-web-synthetic-") &&
    typeof request.tenantId === "string" &&
    typeof request.campusId === "string" &&
    typeof request.classId === "string" &&
    typeof request.classLabel === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(request.startDate ?? "") &&
    /^\d{4}-\d{2}-\d{2}$/u.test(request.endDate ?? "") &&
    request.startDate! <= request.endDate! &&
    (request.reason === "FAMILY_ARRANGEMENT" || request.reason === "TEMPORARY_MATTER") &&
    WEB_LEAVE_STATUSES.includes(request.status as WebLeaveStatus) &&
    Number.isSafeInteger(request.version) &&
    request.version! > 0 &&
    request.syntheticLabel === "模拟数据"
  );
}

function inScope(request: WebLeaveRequest, access: ReviewStaffAccess): boolean {
  return (
    request.tenantId === access.tenantId &&
    request.campusId === access.campusId &&
    access.classIds.includes(request.classId)
  );
}

function scopeRequests(state: WebLeaveState, access: ReviewStaffAccess) {
  if (!Array.isArray(state.requests) || !state.requests.every(isValidRequest)) return undefined;
  return state.requests.filter((request) => inScope(request, access));
}

export function projectStaffLeaveReview(input: StaffLeaveReviewInput): StaffLeaveReviewView {
  if (!hasReviewAccess(input?.access))
    return statusView("denied", "员工请假审核权限不可用", "staff-leave-review-denied");
  const requests = scopeRequests(input.state, input.access);
  if (requests === undefined)
    return statusView("error", "请假记录暂时不可用", "staff-leave-review-error");
  if (requests.length === 0)
    return statusView("empty", "当前范围暂无请假申请", "staff-leave-review-empty");

  const cards = requests
    .map((request) => {
      const actionable = request.status === "SUBMITTED";
      const controls = actionable
        ? `
          <label class="leave-review-select"><input type="checkbox" name="leave-review-selection" value="${escapeHtml(request.id)}" aria-label="选择 ${escapeHtml(request.classLabel)} 模拟申请" />加入批量处理</label>
          <div class="leave-review-actions">
            <button type="button" data-leave-id="${escapeHtml(request.id)}" data-version="${request.version}" data-decision="CONFIRM">确认通过</button>
            <button type="button" data-leave-id="${escapeHtml(request.id)}" data-version="${request.version}" data-decision="RETURN">退回调整</button>
          </div>`
        : "<p>此记录已处理，不能重复审核。</p>";
      return `
      <article class="panel leave-review-card" data-status="${request.status}">
        <h2>模拟请假申请 · ${STATUS_LABELS[request.status]}</h2>
        <p>模拟数据 · ${escapeHtml(request.classLabel)} · ${request.startDate} 至 ${request.endDate}</p>
        <p>原因：${REASON_LABELS[request.reason]}</p>
        <p>版本：${request.version}</p>
        ${controls}
      </article>`;
    })
    .join("");
  const notice = input.notice ?? "请假审核仅保存在当前网页演示内存中。";
  return {
    kind: "ready",
    route: "/staff/report?view=leave-review",
    heading: "请假审核",
    statusAnnouncement: notice,
    externalRequests: [],
    focusOrder: ["staff-leave-review-heading", "leave-review-batch-confirm", "leave-review-list"],
    requests,
    html: `
      <style>${STAFF_LEAVE_REVIEW_STYLES}</style>
      <main class="internal-main staff-leave-review" aria-labelledby="staff-leave-review-heading" data-viewport="narrow-safe">
        <h1 id="staff-leave-review-heading">请假审核</h1>
        <p role="status" aria-live="polite">${escapeHtml(notice)}</p>
        <p>本页使用独立的合成队列；不读取小程序记录，也不连接网络。</p>
        <section class="leave-review-batch" aria-label="批量审核">
          <p>批量处理仅对已选择、同租户/校区/班级且仍待处理的记录生效；任何一条校验失败，整批不变。</p>
          <button id="leave-review-batch-confirm" type="button" data-leave-batch="CONFIRM">批量确认</button>
          <button type="button" data-leave-batch="RETURN">批量退回</button>
        </section>
        <section id="leave-review-list" aria-label="请假申请历史">${cards}</section>
        <p>没有真实通知或正式审核结果。</p>
      </main>`,
  };
}

export function reviewStaffLeaveRequest(
  state: WebLeaveState,
  access: unknown,
  command: WebLeaveCommand,
): WebLeaveActionResult {
  if (!hasReviewAccess(access)) return { ok: false, state, error: "ACCESS_DENIED" };
  if (!Array.isArray(state.requests) || !state.requests.every(isValidRequest))
    return { ok: false, state, error: "INVALID_REQUEST" };
  const request = state.requests.find((item) => item.id === command.requestId);
  if (!request) return { ok: false, state, error: "INVALID_REQUEST" };
  if (!inScope(request, access)) return { ok: false, state, error: "OUT_OF_SCOPE" };
  if (!Number.isSafeInteger(command.version) || command.version !== request.version)
    return { ok: false, state, error: "STALE" };
  if (request.status !== "SUBMITTED") return { ok: false, state, error: "INVALID_STATE" };
  return { ok: true, state: applyDecision(state, request, command.decision) };
}

export function batchReviewStaffLeaveRequests(
  state: WebLeaveState,
  access: unknown,
  commands: readonly WebLeaveCommand[],
): WebLeaveActionResult {
  if (!hasReviewAccess(access)) return { ok: false, state, error: "ACCESS_DENIED" };
  if (!Array.isArray(state.requests) || !state.requests.every(isValidRequest))
    return { ok: false, state, error: "INVALID_REQUEST" };
  if (commands.length === 0) return { ok: false, state, error: "INVALID_REQUEST" };
  const ids = new Set<string>();
  const selected: WebLeaveRequest[] = [];
  for (const command of commands) {
    if (ids.has(command.requestId)) return { ok: false, state, error: "INVALID_REQUEST" };
    ids.add(command.requestId);
    const request = state.requests.find((item) => item.id === command.requestId);
    if (!request) return { ok: false, state, error: "INVALID_REQUEST" };
    if (!inScope(request, access)) return { ok: false, state, error: "OUT_OF_SCOPE" };
    if (!Number.isSafeInteger(command.version) || command.version !== request.version)
      return { ok: false, state, error: "STALE" };
    if (request.status !== "SUBMITTED") return { ok: false, state, error: "INVALID_STATE" };
    selected.push(request);
  }
  const result = selected.reduce(
    (current, request, index) => applyDecision(current, request, commands[index]!.decision),
    state,
  );
  return { ok: true, state: result };
}

function applyDecision(
  state: WebLeaveState,
  request: WebLeaveRequest,
  decision: WebLeaveDecision,
): WebLeaveState {
  const status: WebLeaveStatus = decision === "CONFIRM" ? "CONFIRMED" : "RETURNED";
  const requests = state.requests.map((item) =>
    item.id === request.id ? { ...item, status, version: item.version + 1 } : item,
  );
  return {
    ...state,
    requests,
    audit: [
      ...state.audit,
      { requestId: request.id, actor: "模拟员工", decision, from: request.status, to: status },
    ],
  };
}

function statusView(
  kind: "denied" | "error" | "empty",
  message: string,
  id: string,
): StaffLeaveReviewView {
  return {
    kind,
    route: "/staff/report?view=leave-review",
    heading: "请假审核",
    statusAnnouncement: message,
    externalRequests: [],
    focusOrder: [id],
    requests: [],
    html: `<style>${STAFF_LEAVE_REVIEW_STYLES}</style><main class="internal-main staff-leave-review" aria-labelledby="staff-leave-review-heading"><h1 id="staff-leave-review-heading">请假审核</h1><p id="${id}" role="status" aria-live="polite">${escapeHtml(message)}</p><p>本页不连接正式服务。</p></main>`,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}
