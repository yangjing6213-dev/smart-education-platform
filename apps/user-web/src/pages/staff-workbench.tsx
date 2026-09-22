import {
  isAuthorizedStaff,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "../routes/staff.routes.js";

export type StaffWorkbenchState = "loading" | "empty" | "error" | "published";

export interface StaffResource {
  readonly id: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly status: "published" | "private" | "draft" | "disabled" | "stale";
  readonly title: string;
  readonly summary: string;
  readonly kind: "guide" | "resource";
}

export interface StaffTask {
  readonly id: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly status: "published" | "private" | "draft" | "disabled" | "stale";
  readonly title: string;
  readonly dueLabel: string;
}

export interface StaffWorkbenchInput {
  readonly access: unknown;
  readonly state: StaffWorkbenchState;
  readonly resources: readonly unknown[];
  readonly tasks: readonly unknown[];
}

export type StaffWorkbenchView =
  | StaffWorkbenchDeniedView
  | StaffWorkbenchErrorView
  | StaffWorkbenchStateView
  | StaffWorkbenchPublishedView;

interface StaffWorkbenchBase {
  readonly route: "/staff/workbench";
  readonly heading: "员工工作台";
  readonly statusAnnouncement: string;
  readonly statusRole: "status";
  readonly focusOrder: readonly string[];
  readonly layout: {
    readonly maxInlineSize: "100%";
    readonly minInlineSize: "0";
    readonly overflowX: "hidden";
  };
  readonly externalRequests: readonly string[];
  readonly externalResources: readonly string[];
  readonly html: string;
}

export interface StaffWorkbenchDeniedView extends StaffWorkbenchBase {
  readonly kind: "denied";
  readonly state: "denied";
}

export interface StaffWorkbenchErrorView extends StaffWorkbenchBase {
  readonly kind: "error";
  readonly state: "error";
}

export interface StaffWorkbenchStateView extends StaffWorkbenchBase {
  readonly kind: "state";
  readonly state: "loading" | "empty";
  readonly tasks: readonly [];
  readonly resources: readonly [];
}

export interface StaffWorkbenchPublishedView extends StaffWorkbenchBase {
  readonly kind: "authorized";
  readonly state: "published";
  readonly tasks: readonly StaffTask[];
  readonly resources: readonly StaffResource[];
}

const LAYOUT = {
  maxInlineSize: "100%",
  minInlineSize: "0",
  overflowX: "hidden",
} as const;

export function projectStaffWorkbench(input: StaffWorkbenchInput): StaffWorkbenchView {
  const access = input?.access;
  if (!isAuthorizedStaff(access, "workbench")) {
    return deniedView();
  }

  if (input.state === "loading" || input.state === "empty") {
    return stateView(input.state);
  }

  if (input.state !== "published") {
    return errorView();
  }

  const resources = parseResources(input.resources);
  const tasks = parseTasks(input.tasks);
  if (resources === undefined || tasks === undefined) {
    return errorView();
  }

  const scopedResources = resources.filter(
    (resource) =>
      resource.status === "published" &&
      resource.tenantId === access.tenantId &&
      resource.campusId === access.campusId,
  );
  const scopedTasks = tasks.filter(
    (task) =>
      task.status === "published" &&
      task.tenantId === access.tenantId &&
      task.campusId === access.campusId,
  );

  return {
    kind: "authorized",
    state: "published",
    route: "/staff/workbench",
    heading: "员工工作台",
    statusAnnouncement: "员工工作台已就绪",
    statusRole: "status",
    focusOrder: ["workbench", "tasks", "resources"],
    layout: LAYOUT,
    tasks: scopedTasks,
    resources: scopedResources,
    externalRequests: [],
    externalResources: [],
    html: workbenchHtml(scopedTasks, scopedResources),
  };
}

function deniedView(): StaffWorkbenchDeniedView {
  return {
    kind: "denied",
    state: "denied",
    route: "/staff/workbench",
    heading: "员工工作台",
    statusAnnouncement: "员工访问不可用",
    statusRole: "status",
    focusOrder: ["staff-access-denied"],
    layout: LAYOUT,
    externalRequests: [],
    externalResources: [],
    html: statusHtml("员工访问不可用", "staff-access-denied"),
  };
}

function errorView(): StaffWorkbenchErrorView {
  return {
    kind: "error",
    state: "error",
    route: "/staff/workbench",
    heading: "员工工作台",
    statusAnnouncement: "员工工作台暂时不可用",
    statusRole: "status",
    focusOrder: ["staff-workbench-error"],
    layout: LAYOUT,
    externalRequests: [],
    externalResources: [],
    html: statusHtml("员工工作台暂时不可用", "staff-workbench-error"),
  };
}

function stateView(state: "loading" | "empty"): StaffWorkbenchStateView {
  const message = state === "loading" ? "正在加载员工工作台" : "暂无可用工作内容";
  return {
    kind: "state",
    state,
    route: "/staff/workbench",
    heading: "员工工作台",
    statusAnnouncement: message,
    statusRole: "status",
    focusOrder: [state === "loading" ? "staff-workbench-loading" : "staff-workbench-empty"],
    layout: LAYOUT,
    tasks: [],
    resources: [],
    externalRequests: [],
    externalResources: [],
    html: statusHtml(message, `staff-workbench-${state}`),
  };
}

function workbenchHtml(tasks: readonly StaffTask[], resources: readonly StaffResource[]): string {
  return `
    <main class="internal-main" aria-labelledby="staff-workbench-heading" data-viewport="narrow-safe">
      <h1 id="staff-workbench-heading">员工工作台</h1>
      <p>模拟数据</p>
      <p id="workbench" role="status" aria-live="polite">员工工作台已就绪</p>
      <section class="staff-content-grid" id="tasks" aria-labelledby="staff-tasks-heading">
        <h2 id="staff-tasks-heading">今日任务</h2>
        ${tasks.map((task) => `<article class="staff-content-card"><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.dueLabel)}</p></article>`).join("")}
      </section>
      <section class="staff-content-grid" id="resources" aria-labelledby="staff-resources-heading">
        <h2 id="staff-resources-heading">指南与资源</h2>
        ${resources.map((resource) => `<article class="staff-content-card"><h3>${escapeHtml(resource.title)}</h3><p>${escapeHtml(resource.summary)}</p></article>`).join("")}
      </section>
    </main>
  `.trim();
}

function statusHtml(message: string, id: string): string {
  return `
    <main class="internal-main" aria-labelledby="staff-workbench-heading" data-viewport="narrow-safe">
      <h1 id="staff-workbench-heading">员工工作台</h1>
      <p id="${id}" role="status" aria-live="polite">${escapeHtml(message)}</p>
    </main>
  `.trim();
}

function parseResources(values: readonly unknown[]): StaffResource[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }
  const parsed = values.map(parseResource);
  return parsed.every((value): value is StaffResource => value !== undefined) ? parsed : undefined;
}

function parseTasks(values: readonly unknown[]): StaffTask[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }
  const parsed = values.map(parseTask);
  return parsed.every((value): value is StaffTask => value !== undefined) ? parsed : undefined;
}

function parseResource(value: unknown): StaffResource | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    typeof value.id !== "string" ||
    typeof value.tenantId !== "string" ||
    typeof value.campusId !== "string" ||
    typeof value.title !== "string" ||
    typeof value.summary !== "string" ||
    (value.kind !== "guide" && value.kind !== "resource") ||
    !isContentStatus(value.status)
  ) {
    return undefined;
  }
  return value as unknown as StaffResource;
}

function parseTask(value: unknown): StaffTask | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    typeof value.id !== "string" ||
    typeof value.tenantId !== "string" ||
    typeof value.campusId !== "string" ||
    typeof value.title !== "string" ||
    typeof value.dueLabel !== "string" ||
    !isContentStatus(value.status)
  ) {
    return undefined;
  }
  return value as unknown as StaffTask;
}

function isContentStatus(value: unknown): value is StaffResource["status"] {
  return (
    value === "published" ||
    value === "private" ||
    value === "draft" ||
    value === "disabled" ||
    value === "stale"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
