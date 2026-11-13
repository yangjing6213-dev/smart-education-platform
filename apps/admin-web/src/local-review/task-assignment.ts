export const STAFF_TASK_CODES = [
  ["DAILY_CHECK", "完成班级日常检查"],
  ["TEMPORARY_SUPPORT", "处理临时工作事项"],
  ["STUDENT_FOLLOW_UP", "完成学生事项跟进"],
  ["ACTIVITY_SETUP", "完成活动准备"],
  ["SAFETY_RESPONSE", "跟进安全与设施事项"],
] as const;
export const STAFF_TASK_RESULTS = [
  ["COMPLETED_AS_PLANNED", "按计划完成"],
  ["FOLLOW_UP_REQUIRED", "需要继续跟进"],
  ["BLOCKED", "暂时受阻"],
] as const;
export const STAFF_TASK_ACTIVITIES = [
  ["ART_WORKSHOP", "美术活动"],
  ["OUTDOOR_ACTIVITY", "户外活动"],
  ["FAMILY_OPEN_DAY", "家长开放日"],
] as const;

export type StaffTaskStatus =
  "ASSIGNED" | "CLAIMED" | "IN_PROGRESS" | "COMPLETED" | "CHECKED" | "RETURNED" | "CANCELLED";
export interface StaffTaskSession {
  profile: "owner-east";
  label: string;
  actorId: string;
  tenantId: string;
  campusId: string;
  classIds: string[];
  actions: string[];
}
export interface StaffTaskRow {
  id: string;
  version: number;
  kind: "staffTask";
  tenantId: string;
  campusId: string;
  classId: string;
  code: (typeof STAFF_TASK_CODES)[number][0];
  targetType: "CLASS" | "STUDENT" | "ACTIVITY" | "CAMPUS";
  targetId: string;
  dueDate: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  status: StaffTaskStatus;
  createdBy: string;
  assigneeId: string;
  claimedBy: string | null;
  completedBy: string | null;
  result: (typeof STAFF_TASK_RESULTS)[number][0] | null;
  checkerId: string | null;
  updatedBy: string;
  updatedAt: string;
  title: string;
  assigneeLabel: string;
  creatorLabel: string;
  checkerLabel: string | null;
  targetLabel: string;
  overdue: boolean;
  synthetic: true;
}
export interface StaffTaskAssignee {
  actorId: string;
  label: string;
  campusId: string;
  classIds: string[];
}
export interface StaffTaskStudent {
  id: string;
  label: string;
  campusId: string;
  classId: string;
}
export interface StaffTaskSnapshot {
  status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR";
  session: StaffTaskSession | null;
  tasks: StaffTaskRow[];
  review: StaffTaskRow[];
  assignees: StaffTaskAssignee[];
  students: StaffTaskStudent[];
  message: string;
  error: string | null;
}
export interface StaffTaskCreateInput {
  code: string;
  assigneeId: string;
  targetType: string;
  targetId: string;
  dueDate: string;
  priority: string;
}

export function createLocalStaffTaskTransport(
  baseUrl: string | null,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): typeof fetch {
  if (baseUrl === null) return async () => new Response(null, { status: 503 });
  const base = new URL(baseUrl);
  if (
    base.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(base.hostname) ||
    base.port === "" ||
    base.username !== "" ||
    base.password !== "" ||
    base.pathname !== "/" ||
    base.search !== "" ||
    base.hash !== ""
  )
    throw new Error("Only a loopback local task service is allowed.");
  const origin = base.origin;
  const taskId = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  const allowed = (path: string, method: string): boolean => {
    if (path === "/local/sessions") return method === "POST";
    if (path === "/local/session") return method === "GET";
    if (
      [
        "/local/staff-task-assignees",
        "/local/staff-task-review",
        "/local/student-options",
      ].includes(path)
    )
      return method === "GET";
    if (path === "/local/staff-tasks") return method === "GET" || method === "POST";
    return (
      new RegExp(`^/local/staff-tasks/${taskId}/(check|cancel)$`, "iu").test(path) &&
      method === "POST"
    );
  };
  return async (input, init = {}) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(input, origin);
    } catch {
      return new Response(null, { status: 403 });
    }
    const method = init.method ?? "GET";
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !allowed(url.pathname, method)
    )
      return new Response(null, { status: 403 });
    if (url.pathname === "/local/sessions") {
      try {
        const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : null;
        if (!object(body) || Object.keys(body).length !== 1 || body.profile !== "owner-east")
          return new Response(null, { status: 403 });
      } catch {
        return new Response(null, { status: 403 });
      }
    }
    const timeout = AbortSignal.timeout(5000);
    return fetcher(url, {
      ...init,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    });
  };
}

const STATUSES: StaffTaskStatus[] = [
  "ASSIGNED",
  "CLAIMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CHECKED",
  "RETURNED",
  "CANCELLED",
];
const STATUS_LABELS: Record<StaffTaskStatus, string> = {
  ASSIGNED: "待领取",
  CLAIMED: "已领取",
  IN_PROGRESS: "处理中",
  COMPLETED: "待检查",
  CHECKED: "已验收",
  RETURNED: "已退回",
  CANCELLED: "已取消",
};
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 200;
const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^202[6-9]-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function parseSession(value: unknown): StaffTaskSession {
  if (
    !object(value) ||
    value.mode !== "local-synthetic" ||
    value.profile !== "owner-east" ||
    !text(value.label) ||
    !uuid(value.actorId) ||
    !uuid(value.tenantId) ||
    !uuid(value.campusId) ||
    !Array.isArray(value.classIds) ||
    !value.classIds.every(uuid) ||
    new Set(value.classIds).size !== value.classIds.length ||
    !Array.isArray(value.actions) ||
    !value.actions.every((action) => typeof action === "string") ||
    new Set(value.actions).size !== value.actions.length ||
    !value.actions.includes("task:read") ||
    !value.actions.some((action) => ["task:assign", "task:check", "task:cancel"].includes(action))
  )
    throw new Error("当前示例身份不能管理任务。");
  return {
    profile: "owner-east",
    label: value.label,
    actorId: value.actorId,
    tenantId: value.tenantId,
    campusId: value.campusId,
    classIds: value.classIds,
    actions: value.actions,
  };
}

function parseRows(value: unknown, session: StaffTaskSession): StaffTaskRow[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("任务列表格式不正确。");
  const rows = value.map((row): StaffTaskRow => {
    if (!object(row)) throw new Error("任务资料格式不正确。");
    const code = STAFF_TASK_CODES.find(([key]) => key === row.code);
    const result = STAFF_TASK_RESULTS.find(([key]) => key === row.result);
    const targetIdValid =
      row.targetType === "ACTIVITY"
        ? STAFF_TASK_ACTIVITIES.some(([key]) => key === row.targetId)
        : uuid(row.targetId);
    if (
      !uuid(row.id) ||
      !Number.isSafeInteger(row.version) ||
      Number(row.version) < 1 ||
      row.kind !== "staffTask" ||
      row.tenantId !== session.tenantId ||
      row.campusId !== session.campusId ||
      !uuid(row.classId) ||
      !session.classIds.includes(row.classId) ||
      !code ||
      typeof row.targetType !== "string" ||
      !["CLASS", "STUDENT", "ACTIVITY", "CAMPUS"].includes(row.targetType) ||
      !targetIdValid ||
      (row.targetType === "CLASS" && row.targetId !== row.classId) ||
      (row.targetType === "CAMPUS" && row.targetId !== session.campusId) ||
      !validDate(row.dueDate) ||
      typeof row.priority !== "string" ||
      !["NORMAL", "IMPORTANT", "URGENT"].includes(row.priority) ||
      typeof row.status !== "string" ||
      !STATUSES.includes(row.status as StaffTaskStatus) ||
      !uuid(row.createdBy) ||
      !uuid(row.assigneeId) ||
      (row.claimedBy !== null && !uuid(row.claimedBy)) ||
      (row.completedBy !== null && !uuid(row.completedBy)) ||
      (row.result !== null && !result) ||
      (row.checkerId !== null && !uuid(row.checkerId)) ||
      !uuid(row.updatedBy) ||
      !text(row.updatedAt) ||
      row.title !== code[1] ||
      !text(row.assigneeLabel) ||
      !text(row.creatorLabel) ||
      (row.checkerLabel !== null && !text(row.checkerLabel)) ||
      !text(row.targetLabel) ||
      typeof row.overdue !== "boolean" ||
      row.synthetic !== true
    )
      throw new Error("任务资料不在当前校区范围内。");
    return row as unknown as StaffTaskRow;
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error("任务标识重复。");
  return rows;
}

function parseAssignees(value: unknown, session: StaffTaskSession): StaffTaskAssignee[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error("员工范围资料格式不正确。");
  const rows = value.map((row): StaffTaskAssignee => {
    if (
      !object(row) ||
      !uuid(row.actorId) ||
      !text(row.label) ||
      row.campusId !== session.campusId ||
      !Array.isArray(row.classIds) ||
      !row.classIds.every(uuid) ||
      new Set(row.classIds).size !== row.classIds.length ||
      !row.classIds.some((id) => session.classIds.includes(id))
    )
      throw new Error("员工不在当前校区范围内。");
    return {
      actorId: row.actorId,
      label: row.label,
      campusId: row.campusId,
      classIds: row.classIds.filter((id) => session.classIds.includes(id)),
    };
  });
  if (new Set(rows.map((row) => row.actorId)).size !== rows.length)
    throw new Error("员工标识重复。");
  return rows;
}

function parseStudents(value: unknown, session: StaffTaskSession): StaffTaskStudent[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("学生选项格式不正确。");
  const rows = value.map((row): StaffTaskStudent => {
    if (
      !object(row) ||
      !uuid(row.id) ||
      !text(row.label) ||
      row.campusId !== session.campusId ||
      !uuid(row.classId) ||
      !session.classIds.includes(row.classId)
    )
      throw new Error("学生选项不在当前授权范围内。");
    return { id: row.id, label: row.label, campusId: row.campusId, classId: row.classId };
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error("学生标识重复。");
  return rows;
}

export function parseStaffTaskSnapshot(value: unknown): StaffTaskSnapshot {
  if (
    !object(value) ||
    typeof value.status !== "string" ||
    !["IDLE", "CONNECTING", "BUSY", "READY", "ERROR"].includes(value.status)
  )
    throw new Error("任务页面资料格式不正确。");
  const rawSession =
    object(value.session) && value.session.mode === undefined
      ? { mode: "local-synthetic", ...value.session }
      : value.session;
  const session = value.session === null ? null : parseSession(rawSession);
  if (!session) {
    if (value.status === "READY") throw new Error("任务页面缺少授权身份。");
    return {
      status: value.status as StaffTaskSnapshot["status"],
      session: null,
      tasks: [],
      review: [],
      assignees: [],
      students: [],
      message: text(value.message) ? value.message : "正在连接本机服务。",
      error: typeof value.error === "string" ? value.error : null,
    };
  }
  const tasks = parseRows(value.tasks, session);
  const review = parseRows(value.review, session);
  if (
    review.some(
      (row) =>
        row.status !== "COMPLETED" ||
        !tasks.some((task) => task.id === row.id && task.version === row.version),
    )
  )
    throw new Error("待检查任务与当前列表不一致。");
  return {
    status: value.status as StaffTaskSnapshot["status"],
    session,
    tasks,
    review,
    assignees: parseAssignees(value.assignees, session),
    students: parseStudents(value.students, session),
    message: text(value.message) ? value.message : "任务资料已更新。",
    error: typeof value.error === "string" ? value.error : null,
  };
}

function dueDateDefault(now: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) throw new Error("无法读取上海日期。");
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + 1))
    .toISOString()
    .slice(0, 10);
}

export function renderStaffTaskAssignment(
  snapshot: StaffTaskSnapshot,
  editable: boolean,
  now = Date.now(),
): string {
  const session = snapshot.session;
  if (!session)
    return `<section class="panel"><h2>任务分派与检查</h2><p>${escape(snapshot.message)}</p></section>`;
  const canAssign = editable && session.actions.includes("task:assign");
  const targetOptions = [
    ...session.classIds.map(
      (id) => `<option value="CLASS|${escape(id)}">班级 · 当前授权班级</option>`,
    ),
    ...snapshot.students.map(
      (student) =>
        `<option value="STUDENT|${escape(student.id)}">学生 · ${escape(student.label)}</option>`,
    ),
    ...STAFF_TASK_ACTIVITIES.map(
      ([id, label]) => `<option value="ACTIVITY|${id}">活动 · ${label}</option>`,
    ),
    `<option value="CAMPUS|${escape(session.campusId)}">校区 · 当前授权校区</option>`,
  ].join("");
  const assigneeOptions = snapshot.assignees
    .map((person) => `<option value="${escape(person.actorId)}">${escape(person.label)}</option>`)
    .join("");
  const form = canAssign
    ? `<form data-staff-task-create class="staff-task-create"><h3>分派新任务</h3><label>任务类别<select name="code">${STAFF_TASK_CODES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label><label>经办员工<select name="assigneeId">${assigneeOptions}</select></label><label>任务对象<select name="target">${targetOptions}</select></label><label>截止日期<input name="dueDate" type="date" min="2026-01-01" max="2029-12-31" value="${dueDateDefault(now)}" required></label><label>优先级<select name="priority"><option value="NORMAL">普通</option><option value="IMPORTANT">重要</option><option value="URGENT">紧急</option></select></label><button type="submit" ${snapshot.status !== "READY" || snapshot.assignees.length === 0 ? "disabled" : ""}>分派任务</button></form>`
    : `<p>当前身份可查看当前授权校区任务，分派与验收操作由负责人完成。</p>`;
  const cards = snapshot.tasks
    .map((task) => {
      const canCheck =
        editable &&
        snapshot.status === "READY" &&
        session.actions.includes("task:check") &&
        task.status === "COMPLETED" &&
        task.assigneeId !== session.actorId;
      const canCancel =
        editable &&
        snapshot.status === "READY" &&
        session.actions.includes("task:cancel") &&
        !["CHECKED", "CANCELLED"].includes(task.status);
      const result = task.result
        ? (STAFF_TASK_RESULTS.find(([code]) => code === task.result)?.[1] ?? "")
        : "尚未提交";
      const target = `${task.targetLabel} · ${task.dueDate} · ${task.priority === "URGENT" ? "紧急" : task.priority === "IMPORTANT" ? "重要" : "普通"}${task.overdue ? " · 已逾期" : ""}`;
      const resultLabel =
        task.result && task.status === "CANCELLED"
          ? "取消前提交结果"
          : task.result && ["ASSIGNED", "CLAIMED", "IN_PROGRESS", "RETURNED"].includes(task.status)
            ? "上次提交结果"
            : "完成结果";
      return `<article class="staff-task-card"><div><h3>${escape(task.title)}</h3><span>${STATUS_LABELS[task.status]} · 第 ${task.version} 版</span></div><p>${escape(target)}</p><p>经办：${escape(task.assigneeLabel)} · ${resultLabel}：${result}</p><div class="staff-task-actions">${canCheck ? `<button type="button" data-staff-task-action="confirm" data-staff-task-id="${escape(task.id)}" data-staff-task-version="${task.version}">验收通过</button><button type="button" data-staff-task-action="return" data-staff-task-id="${escape(task.id)}" data-staff-task-version="${task.version}">退回处理</button>` : ""}${canCancel ? `<button type="button" data-staff-task-action="cancel" data-staff-task-id="${escape(task.id)}" data-staff-task-version="${task.version}">取消任务</button>` : ""}</div></article>`;
    })
    .join("");
  const empty =
    snapshot.tasks.length === 0 ? "<p>当前校区还没有任务，可从上方分派一项固定任务。</p>" : "";
  return `<section class="panel staff-task-admin" aria-labelledby="staff-task-admin-title"><div class="staff-task-panel-heading"><h2 id="staff-task-admin-title">任务分派与独立检查</h2><span>仅当前校区 · 合成资料</span></div><p id="staff-task-feedback" role="status">${escape(snapshot.error ?? snapshot.message)}</p>${form}<div class="staff-task-admin-list"><h3>校区任务</h3>${empty}${cards}</div></section>`;
}

export class StaffTaskAssignmentClient {
  private handle: string | null = null;
  private generation = 0;
  private value: StaffTaskSnapshot = {
    status: "IDLE",
    session: null,
    tasks: [],
    review: [],
    assignees: [],
    students: [],
    message: "等待连接本机任务服务。",
    error: null,
  };
  constructor(private readonly transport: typeof fetch = fetch.bind(globalThis)) {}
  get snapshot(): StaffTaskSnapshot {
    return structuredClone(this.value);
  }
  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.value = {
      status: "IDLE",
      session: null,
      tasks: [],
      review: [],
      assignees: [],
      students: [],
      message: "本机任务连接已关闭。",
      error: null,
    };
  }
  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    const response = await this.transport(path, {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: {
        ...(this.handle ? { Authorization: `Bearer ${this.handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      await response.arrayBuffer();
      throw new Error("本机任务服务暂不可用。");
    }
    return response.json();
  }
  async connect(): Promise<void> {
    this.disconnect();
    const generation = this.generation;
    this.value = {
      ...this.value,
      status: "CONNECTING",
      message: "正在连接本机任务服务。",
      error: null,
    };
    try {
      const bootstrap = await this.request("/local/sessions", "POST", { profile: "owner-east" });
      if (generation !== this.generation) return;
      if (
        !object(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[\w-]{43}$/.test(bootstrap.handle)
      )
        throw new Error("本机服务返回的登录信息无效。");
      this.handle = bootstrap.handle;
      const response = await this.request("/local/session");
      if (generation !== this.generation) return;
      await this.load(generation, parseSession(response));
    } catch {
      if (generation === this.generation) this.fail();
    }
  }
  async refresh(): Promise<void> {
    if (this.value.status === "BUSY" || this.value.status === "CONNECTING") return;
    const session = this.value.session;
    if (!this.handle || !session) {
      await this.connect();
      return;
    }
    const generation = this.generation;
    this.busy("正在刷新本机任务资料。");
    try {
      await this.load(generation, session);
    } catch {
      if (generation === this.generation) this.fail();
    }
  }
  async create(input: StaffTaskCreateInput): Promise<void> {
    const session = this.value.session;
    const assignee = this.value.assignees.find((person) => person.actorId === input.assigneeId);
    const targetTypes = ["CLASS", "STUDENT", "ACTIVITY", "CAMPUS"];
    const validTarget =
      (input.targetType === "ACTIVITY" &&
        assignee?.classIds.some((id) => session?.classIds.includes(id)) &&
        STAFF_TASK_ACTIVITIES.some(([code]) => code === input.targetId)) ||
      (input.targetType === "CLASS" &&
        session?.classIds.includes(input.targetId) &&
        assignee?.classIds.includes(input.targetId)) ||
      (input.targetType === "CAMPUS" &&
        input.targetId === session?.campusId &&
        assignee?.classIds.some((id) => session.classIds.includes(id))) ||
      (input.targetType === "STUDENT" &&
        this.value.students.some(
          (student) =>
            student.id === input.targetId && assignee?.classIds.includes(student.classId),
        ));
    if (
      this.value.status !== "READY" ||
      !this.handle ||
      !session ||
      !session.actions.includes("task:assign") ||
      !STAFF_TASK_CODES.some(([code]) => code === input.code) ||
      !assignee ||
      !targetTypes.includes(input.targetType) ||
      !validTarget ||
      !validDate(input.dueDate) ||
      !["NORMAL", "IMPORTANT", "URGENT"].includes(input.priority)
    )
      return;
    await this.mutate("/local/staff-tasks", {
      code: input.code,
      assigneeId: input.assigneeId,
      targetType: input.targetType,
      targetId: input.targetId,
      dueDate: input.dueDate,
      priority: input.priority,
    });
  }
  async review(
    id: string,
    version: number,
    action: "CONFIRM" | "RETURN" | "CANCEL",
  ): Promise<void> {
    const session = this.value.session;
    const row = this.value.tasks.find((task) => task.id === id && task.version === version);
    if (
      !this.handle ||
      this.value.status !== "READY" ||
      !session ||
      !["CONFIRM", "RETURN", "CANCEL"].includes(action) ||
      !session.actions.includes(action === "CANCEL" ? "task:cancel" : "task:check") ||
      !row ||
      (action !== "CANCEL" && row.assigneeId === session.actorId)
    )
      return;
    if (
      (action === "CANCEL" && ["CHECKED", "CANCELLED"].includes(row.status)) ||
      (action !== "CANCEL" && row.status !== "COMPLETED")
    )
      return;
    await this.mutate(
      `/local/staff-tasks/${id}/${action === "CANCEL" ? "cancel" : "check"}`,
      action === "CANCEL" ? { version } : { version, action },
    );
  }

  private async mutate(path: string, body: object): Promise<void> {
    const session = this.value.session;
    if (!this.handle || !session || this.value.status !== "READY") return;
    const generation = this.generation;
    this.busy("正在保存任务操作。");
    try {
      await this.request(path, "POST", body);
      if (generation !== this.generation) return;
      await this.load(generation, session);
    } catch {
      if (generation === this.generation) this.fail();
    }
  }

  private async load(generation: number, session: StaffTaskSession): Promise<void> {
    const canAssign = session.actions.includes("task:assign");
    const [tasks, review, assignees, students] = await Promise.all([
      this.request("/local/staff-tasks"),
      session.actions.includes("task:check") ? this.request("/local/staff-task-review") : [],
      canAssign ? this.request("/local/staff-task-assignees") : [],
      canAssign ? this.request("/local/student-options") : [],
    ]);
    if (generation !== this.generation) return;
    this.value = parseStaffTaskSnapshot({
      status: "READY",
      session,
      tasks,
      review,
      assignees,
      students,
      message: "已显示当前授权范围内的本机任务。",
      error: null,
    });
  }

  private busy(message: string): void {
    this.value = {
      ...this.value,
      status: "BUSY",
      tasks: [],
      review: [],
      assignees: [],
      students: [],
      message,
      error: null,
    };
  }

  private fail(): void {
    this.handle = null;
    this.value = {
      status: "ERROR",
      session: null,
      tasks: [],
      review: [],
      assignees: [],
      students: [],
      message: "本机任务资料已清空，请重新连接后核实。",
      error: "本机任务服务暂不可用，操作结果尚未确认。",
    };
  }
}
