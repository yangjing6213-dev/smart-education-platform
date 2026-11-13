export const CARE_RECORD_REVIEW_ROUTE = "/admin/care-record-review";

const STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "CONFIRMED",
  "RETURNED",
  "CANCELLED",
  "EXCEPTION_PENDING",
] as const;
type Status = (typeof STATUSES)[number];
type Role = "CAMPUS_REVIEWER" | "INSTITUTION_REVIEWER" | "PLATFORM_ADMIN";

interface InputRecord {
  readonly id?: unknown;
  readonly version?: unknown;
  readonly status?: unknown;
  readonly tenantId?: unknown;
  readonly campusId?: unknown;
  readonly classId?: unknown;
  readonly summaryLabel?: unknown;
  readonly published?: unknown;
}

interface InputActor {
  readonly role?: Role | string;
  readonly status?: unknown;
  readonly tenantId?: unknown;
  readonly authorizedCampusIds?: readonly unknown[];
  readonly authorizedClassIds?: readonly unknown[];
}

const STATUS_LABELS: Record<Status, string> = {
  DRAFT: "草稿",
  SUBMITTED: "待人工审核",
  CONFIRMED: "已确认",
  RETURNED: "已退回",
  CANCELLED: "已撤回",
  EXCEPTION_PENDING: "待升级复核",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

function emptyCounts(): Record<Status, number> {
  return Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<Status, number>;
}

export function projectCareRecordAdminView(input: {
  readonly actor: InputActor | null;
  readonly records: readonly InputRecord[];
}) {
  const actor = input?.actor;
  const records = Array.isArray(input?.records) ? input.records : [];
  const counts = emptyCounts();
  if (!actor || actor.status !== "ACTIVE") return { mode: "DENIED" as const, counts, rows: [] };

  if (actor.role === "PLATFORM_ADMIN") {
    for (const record of records) {
      const status = record?.status;
      if (isStatus(status)) counts[status] += 1;
    }
    return { mode: "AGGREGATE_ONLY" as const, counts, rows: [] };
  }

  if (
    (actor.role !== "CAMPUS_REVIEWER" && actor.role !== "INSTITUTION_REVIEWER") ||
    typeof actor.tenantId !== "string" ||
    !Array.isArray(actor.authorizedCampusIds) ||
    !Array.isArray(actor.authorizedClassIds)
  )
    return { mode: "DENIED" as const, counts, rows: [] };

  const rows = records
    .filter(
      (record): record is InputRecord & { id: string; status: Status; summaryLabel: string } =>
        Boolean(
          record &&
          typeof record.id === "string" &&
          Number.isSafeInteger(record.version) &&
          (record.version as number) > 0 &&
          isStatus(record.status) &&
          record.tenantId === actor.tenantId &&
          typeof record.campusId === "string" &&
          actor.authorizedCampusIds?.includes(record.campusId) &&
          typeof record.classId === "string" &&
          actor.authorizedClassIds?.includes(record.classId) &&
          typeof record.summaryLabel === "string",
        ),
    )
    .map((record) => ({
      id: record.id,
      version: record.version as number,
      status: record.status,
      statusLabel: STATUS_LABELS[record.status],
      summaryLabel: record.summaryLabel,
      published: record.published === true,
    }));
  for (const row of rows) counts[row.status] += 1;
  return { mode: "SCOPED_REVIEW" as const, counts, rows };
}

export function reviewAdminCareRecord(input: {
  readonly actor: InputActor | null;
  readonly records: readonly InputRecord[];
  readonly id: string;
  readonly version: number;
  readonly decision: "CONFIRM" | "RETURN";
}) {
  const records = Array.isArray(input?.records) ? input.records : [];
  const unchanged = () => ({ ok: false as const, records, error: "INVALID_STATE" as const });
  const view = projectCareRecordAdminView({ actor: input?.actor ?? null, records });
  if (view.mode !== "SCOPED_REVIEW")
    return { ok: false as const, records, error: "FORBIDDEN" as const };

  const row = view.rows.find((candidate) => candidate.id === input.id);
  if (!row) return { ok: false as const, records, error: "OUT_OF_SCOPE" as const };
  if (!Number.isSafeInteger(input.version) || row.version !== input.version)
    return { ok: false as const, records, error: "STALE" as const };
  if (row.status !== "SUBMITTED") return unchanged();
  if (input.decision !== "CONFIRM" && input.decision !== "RETURN") return unchanged();

  const nextStatus = input.decision === "CONFIRM" ? "CONFIRMED" : "RETURNED";
  return {
    ok: true as const,
    records: records.map((record) =>
      record.id === input.id ? { ...record, status: nextStatus, version: row.version + 1 } : record,
    ),
  };
}

export function renderCareRecordReview(
  view: ReturnType<typeof projectCareRecordAdminView>,
  role: Role = "INSTITUTION_REVIEWER",
  notice = "本机共享服务审核状态。",
  profile: "owner-east" | "owner-west" = "owner-east",
): string {
  const summary = STATUSES.map(
    (status) => `<div><dt>${STATUS_LABELS[status]}</dt><dd>${view.counts[status]}</dd></div>`,
  ).join("");
  const profilePicker =
    role === "PLATFORM_ADMIN"
      ? ""
      : `<label>当前负责人校区<select id="admin-care-record-profile"><option value="owner-east"${profile === "owner-east" ? " selected" : ""}>东校区负责人</option><option value="owner-west"${profile === "owner-west" ? " selected" : ""}>西校区负责人</option></select></label>`;
  const records =
    view.mode === "AGGREGATE_ONLY"
      ? `<p class="notice">平台管理员仅查看匿名合计，不显示日报行、学生身份或摘要内容。</p>`
      : view.mode === "DENIED"
        ? `<p role="status">当前模拟身份没有日报审核权限。</p>`
        : view.rows
            .map((row) => {
              const button = (action: string, label: string) =>
                `<button type="button" data-admin-care-record-action="${action}" data-admin-care-record-id="${escapeHtml(row.id)}" data-admin-care-record-version="${row.version}">${label}</button>`;
              const actionButtons =
                row.status === "SUBMITTED"
                  ? `<div class="actions">${button("CONFIRM", "审核通过")}${button("RETURN", "退回修改")}</div>`
                  : row.status === "CONFIRMED"
                    ? `<div class="actions">${button(row.published ? "REVOKE" : "PUBLISH", row.published ? "撤回家长发布" : "发布给家长")}</div>`
                    : "";
              return `<article class="field" data-admin-care-record-row><h2>成长记录 ${escapeHtml(row.id.slice(-3))}</h2><p>${escapeHtml(row.statusLabel)} · 第 ${row.version} 版</p><p>${escapeHtml(row.summaryLabel)}</p>${actionButtons}</article>`;
            })
            .join("") || `<p>当前授权范围没有日报记录。</p>`;
  return `<main class="shell"><header class="topbar"><strong>机构管理工作台</strong><span>成长记录审核</span><a href="/">返回管理首页</a></header><section class="panel"><p class="eyebrow">仅合成数据 · 本机共享服务</p><h1>成长记录审核与发布</h1><p>审核通过和发布给家长是两个独立步骤。</p>${profilePicker}<p id="admin-care-record-notice" role="status">${escapeHtml(notice)}</p><button type="button" data-admin-care-record-refresh>刷新审核队列</button><dl class="meta">${summary}</dl></section><section class="panel"><h2>${view.mode === "AGGREGATE_ONLY" ? "匿名统计" : "本校区成长记录"}</h2>${records}</section><footer>仅显示当前负责人授权范围内的合成记录。</footer></main>`;
}
