import { HomeContentPage, type HomeContentEditorState } from "./pages/home-content.js";
import {
  PublicTeacherIntroductionsPage,
  type PublicTeacherEditorState,
} from "./pages/public-teachers.js";
import {
  MealsPage,
  type MealAuditEntry,
  type MealEditorState,
  type MealSortDirection,
} from "./pages/meals.js";
import { AdminMealsClient, type AdminMealPayload, type AdminMealRecord } from "./local-review/meals-client.js";
import { AuditLogsPage, type AuditLogEventViewModel } from "./pages/audit-logs.js";
import {
  AdminLeaveReviewClient,
  type AdminLeaveDecision,
} from "./local-review/leave-review-client.js";
import { renderAdminLeaveReview as renderAdminLeaveReviewPage } from "./pages/leave-review.js";
import {
  CARE_RECORD_REVIEW_ROUTE,
  projectCareRecordAdminView,
  renderCareRecordReview,
} from "./pages/care-record-review.js";
import {
  CareRecordReviewClient,
  type CareRecordReviewProfile,
} from "./local-review/care-record-client.js";
import {
  ConsentReviewClient,
  type ConsentReviewAction,
  type ConsentReviewerProfile,
} from "./local-review/consent.js";
import { consentReviewProfilePath, renderConsentReviewPage } from "./pages/consent-review.js";
import {
  PrivacyRequestReviewClient,
  type PrivacyReviewAction,
  type PrivacyReviewerProfile,
} from "./local-review/privacy-requests.js";
import { renderPrivacyRequestsPage } from "./pages/privacy-requests.js";
import { createStaffCredentialStore } from "./local-synthetic/staff-credentials.js";
import { createStaffCredentialsSection } from "./pages/staff-credentials.js";
import { createStaffOperationsStore } from "./local-synthetic/staff-operations.js";
import { createStaffOperationsSection } from "./pages/staff-operations.js";
import { createPlatformOperationsStore } from "./local-synthetic/platform-operations.js";
import { createPlatformOperationsSection } from "./pages/platform-operations.js";
import {
  createLocalMediaTransport,
  MediaAssetsAdminClient,
  type MediaAssetsProfile,
} from "./local-review/media-assets.js";
import { renderFileLifecycle } from "./pages/file-lifecycle.js";
import {
  createLocalMembershipTransport,
  isMembershipManagementProfile,
  MembershipManagementClient,
  renderMembershipManagement,
} from "./local-review/membership-management.js";
import { AdminFeesClient, renderAdminFees, type AdminFeesProfile } from "./local-review/fees.js";
import {
  AdminBindingReviewClient,
  type AdminBindingReviewAction,
  type AdminBindingReviewerProfile,
} from "./local-review/binding-review.js";
import { renderAdminBindingReview } from "./pages/binding-review.js";
import {
  OperationalStatisticsAdminClient,
  isOperationalStatisticsProfile,
  renderAdminStatistics,
} from "./local-review/statistics.js";
import {
  HealthIncidentReviewClient,
  renderHealthIncidentReview,
  type HealthIncidentReviewAction,
  type HealthIncidentReviewRole,
  type HealthIncidentDispositionCode,
  type HealthIncidentSummaryCode,
} from "./local-review/health-incident-shared.js";
import {
  createLocalStaffTaskTransport,
  renderStaffTaskAssignment,
  StaffTaskAssignmentClient,
  type StaffTaskCreateInput,
} from "./local-review/task-assignment.js";
import { renderStaffDailyReview, StaffDailyReviewClient } from "./local-review/staff-daily.js";
import {
  MonthlyFeedbackReviewClient,
  renderMonthlyFeedbackReview,
  type MonthlyFeedbackReviewAction,
} from "./local-review/monthly-feedback.js";
import {
  isResourceReviewProfile,
  ResourceLibraryAdminClient,
  renderAdminResourceLibrary,
} from "./local-review/resource-library.js";
import { LearningSafetyAdminClient, renderLearningSafety } from "./local-review/learning-safety.js";
import {
  SUPPLY_REQUEST_REVIEW_ROUTE,
  SupplyRequestReviewClient,
  renderSupplyRequestReview,
  type SupplyRequestReviewAction,
  type SupplyRequestReviewRole,
} from "./local-review/supply-request.js";
import {
  NOTICE_REVIEW_ROUTE,
  createLocalNoticeReviewTransport,
  NoticeReviewClient,
  renderAdminNoticeReview,
  type NoticeReviewAction,
} from "./local-review/notice-shared.js";
import {
  PickupReviewClient,
  renderPickupReview,
  type PickupReviewProfile,
} from "./local-review/pickup-review.js";

const initialState: HomeContentEditorState = {
  contentKey: "home-announcement",
  title: "春季托管服务公告",
  summary: "面向访客展示的模拟首页内容，发布前仅供机构管理员预览。",
  blocks: [
    { kind: "TEXT", text: "本内容仅使用模拟数据。" },
    { kind: "LINK_REF", text: "查看服务说明", href: "/synthetic-services" },
  ],
  version: 3,
  status: "DRAFT",
  canPublish: true,
};

const initialTeacherState: PublicTeacherEditorState = {
  profileId: "teacher-one",
  displayName: "模拟教师一号",
  headline: "小学数学引导教师",
  subjects: ["数学", "作业引导"],
  bio: "这是一段仅用于管理页预览的虚构公开介绍。",
  photoRef: "file-ref:/synthetic/teacher-one.png",
  version: 1,
  status: "DRAFT",
  canPublish: true,
};

type StaffGuide = {
  readonly guideId: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly version: number;
  readonly status: "PUBLISHED" | "DRAFT";
  readonly fileRef: string;
};

const syntheticStaffGuides: readonly StaffGuide[] = [
  {
    guideId: "guide-welcome",
    title: "新成员指南",
    summary: "模拟数据：介绍报到、校区范围和内部支持入口。",
    body: "这是一份仅用于管理端预览的虚构内部指南。",
    version: 2,
    status: "PUBLISHED",
    fileRef: "file-ref:/synthetic/new-member-guide.pdf",
  },
  {
    guideId: "guide-routine",
    title: "模拟值班流程",
    summary: "模拟数据：按当前校区查看每日值班准备事项。",
    body: "这是一份仅用于检索演示的虚构草稿。",
    version: 1,
    status: "DRAFT",
    fileRef: "file-ref:/synthetic/duty-routine.pdf",
  },
];

const syntheticAuditEvents: readonly AuditLogEventViewModel[] = [
  {
    event_id: "audit-event-synthetic-001",
    actor_id: "00000000-0000-4000-8000-000000000003",
    tenant_id: "tenant-synthetic-a",
    campus_id: "campus-synthetic-east",
    action: "CONTENT_PUBLISHED",
    target_type: "HOME_CONTENT",
    target_id: "synthetic-home-announcement",
    occurred_at: "2026-09-17T02:00:00.000Z",
    correlation_id: "correlation-synthetic-audit-001",
    trace_id: "trace-synthetic-audit-001",
    metadata: {
      result: "SUCCESS",
      channel: "ADMIN_WEB",
      synthetic_reference: "synthetic-audit-001",
    },
    synthetic_data: true,
  },
];

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) throw new Error("Admin web root is missing.");
const appRoot = root;
const pickupReviewClient = new PickupReviewClient();
const consentReviewClient = new ConsentReviewClient();
let consentReviewConfirmed = false;
const privacyRequestReviewClient = new PrivacyRequestReviewClient();
const resourceLibraryAdminClient = new ResourceLibraryAdminClient();
const learningSafetyAdminClient = new LearningSafetyAdminClient();
const sharedResourceReview = () =>
  new URLSearchParams(window.location.search).get("shared") === "1";
const mediaServicePortValue = new URLSearchParams(window.location.search).get("mediaServicePort");
const parsedMediaServicePort =
  mediaServicePortValue && /^[1-9]\d{0,4}$/u.test(mediaServicePortValue)
    ? Number(mediaServicePortValue)
    : null;
const mediaAssetsAdminClient = new MediaAssetsAdminClient(
  createLocalMediaTransport(
    parsedMediaServicePort !== null && parsedMediaServicePort <= 65535
      ? parsedMediaServicePort
      : null,
  ),
);
const localServicePortValue = new URLSearchParams(window.location.search).get("localServicePort");
const parsedLocalServicePort =
  localServicePortValue && /^[1-9]\d{0,4}$/u.test(localServicePortValue)
    ? Number(localServicePortValue)
    : null;
const membershipManagementClient = new MembershipManagementClient(
  createLocalMembershipTransport(
    parsedLocalServicePort !== null && parsedLocalServicePort <= 65535
      ? parsedLocalServicePort
      : null,
  ),
);
const adminFeesClient = new AdminFeesClient(
  parsedLocalServicePort !== null && parsedLocalServicePort <= 65535
    ? parsedLocalServicePort
    : null,
);
const localHealthServiceBase =
  parsedLocalServicePort !== null && parsedLocalServicePort <= 65535
    ? `http://127.0.0.1:${parsedLocalServicePort}`
    : null;
const operationalStatisticsAdminClient = new OperationalStatisticsAdminClient(
  async (input, init) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    const baseUrl = localHealthServiceBase ?? window.location.origin;
    const url = new URL(input, baseUrl);
    const allowedPath = [
      "/local/sessions",
      "/local/session",
      "/local/statistics",
      "/local/statistics-summary",
    ].includes(url.pathname);
    if (url.origin !== baseUrl || !allowedPath) return new Response(null, { status: 403 });
    return globalThis.fetch(url, init);
  },
);
const staffTaskAssignmentClient = new StaffTaskAssignmentClient(
  createLocalStaffTaskTransport(localHealthServiceBase ?? window.location.origin),
);
const staffDailyReviewClient = new StaffDailyReviewClient({
  baseUrl: localHealthServiceBase ?? "http://127.0.0.1:4317",
});
const monthlyFeedbackReviewClient = new MonthlyFeedbackReviewClient({
  baseUrl: localHealthServiceBase ?? "http://127.0.0.1:4317",
});
let staffTaskAssignmentGeneration = 0;
const healthIncidentReviewClient = new HealthIncidentReviewClient(async (input, init) => {
  if (localHealthServiceBase === null || typeof input !== "string")
    return new Response(null, { status: 503 });
  const url = new URL(input, localHealthServiceBase);
  const allowedPath =
    url.pathname === "/local/sessions" ||
    url.pathname === "/local/session" ||
    url.pathname === "/local/health-incident-review" ||
    /^\/local\/health-incidents\/[^/]+\/(review|supplement|publish|revoke)$/u.test(url.pathname);
  if (url.origin !== localHealthServiceBase || !allowedPath)
    return new Response(null, { status: 403 });
  return globalThis.fetch(url, init);
});
let healthReviewRole: HealthIncidentReviewRole = "CAMPUS_REVIEWER";
let healthReviewRenderGeneration = 0;
const supplyRequestReviewClient = new SupplyRequestReviewClient(async (input, init) => {
  if (typeof input !== "string") return new Response(null, { status: 403 });
  const url = new URL(input, window.location.origin);
  const allowedPath =
    url.pathname === "/local/sessions" ||
    url.pathname === "/local/session" ||
    ["/local/supply-requests", "/local/supply-requests-review", "/local/supply-summary"].includes(
      url.pathname,
    ) ||
    /^\/local\/supply-requests\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(review|claim)$/iu.test(
      url.pathname,
    );
  if (url.origin !== window.location.origin || !allowedPath)
    return new Response(null, { status: 403 });
  return globalThis.fetch(url, init);
});
let supplyRequestReviewRole: SupplyRequestReviewRole = "CAMPUS_REVIEWER";
let supplyRequestReviewGeneration = 0;
let noticeReviewClient: NoticeReviewClient | null = null;
let noticeReviewGeneration = 0;
function getNoticeReviewClient(): NoticeReviewClient {
  noticeReviewClient ??= new NoticeReviewClient(
    createLocalNoticeReviewTransport(window.location.origin),
  );
  return noticeReviewClient;
}
const bindingReviewClient = new AdminBindingReviewClient({
  baseUrl:
    parsedLocalServicePort !== null && parsedLocalServicePort <= 65535
      ? `http://127.0.0.1:${parsedLocalServicePort}`
      : null,
});
let bindingReviewConfirmed = false;
let membershipManagementGeneration = 0;

let state = initialState;
let notice = "草稿尚未发布";
let teacherState = initialTeacherState;
let teacherNotice = "教师介绍草稿尚未发布";
let mealStates: MealEditorState[] = [];
let selectedMealId: string | null = null;
let mealSortDirection: MealSortDirection = "ASC";
let mealAuditEntries: MealAuditEntry[] = [];
let mealAuditSequence = 0;
let newMealSequence = 0;
let mealNotice = "餐食草稿尚未发布";
let mealLoadStatus: "IDLE" | "CONNECTING" | "READY" | "ERROR" = "IDLE";
const adminMealsClient = new AdminMealsClient({ baseUrl: window.location.origin });
let staffGuideQuery = "";
let selectedStaffGuideId = syntheticStaffGuides[0]?.guideId ?? "";
let adminCareRecordProfile: CareRecordReviewProfile = "owner-east";
const adminCareRecordClient = new CareRecordReviewClient({ baseUrl: window.location.origin });
const adminLeaveReviewClient = new AdminLeaveReviewClient({
  baseUrl: localHealthServiceBase ?? "http://127.0.0.1:4317",
});
const staffCredentialStore = createStaffCredentialStore();
let staffCredentialNotice = "仅存在于当前页面内存；刷新后恢复预置示例。";
const staffOperationsStore = createStaffOperationsStore();
const platformOperationsStore = createPlatformOperationsStore();

const syntheticScope = {
  institutionName: "模拟机构",
  campusName: "模拟东校区",
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-east",
} as const;

type AdminViewMode = "AUTHORIZED" | "READ_ONLY" | "DENIED" | "CONFLICT";

function currentViewMode(): AdminViewMode {
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "readonly") return "READ_ONLY";
  if (mode === "denied") return "DENIED";
  if (mode === "conflict") return "CONFLICT";
  return "AUTHORIZED";
}

function navigate(path: string): void {
  const currentParams = new URLSearchParams(window.location.search);
  const routeParams = new URLSearchParams(window.location.search);
  if (path === "/admin/learning-safety") {
    routeParams.set("profile", "platform-admin");
    if (!currentParams.has("mode")) routeParams.delete("mode");
  }
  const query = routeParams.size ? `?${routeParams}` : "";
  window.history.pushState({}, "", `${path}${query}`);
  render();
}

function appendAdminNavigation(topbar: HTMLElement): void {
  const navToggle = element("button", "nav-toggle");
  navToggle.type = "button";
  navToggle.textContent = "菜单";
  navToggle.setAttribute("aria-controls", "admin-navigation");
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.addEventListener("click", () => {
    const shell = topbar.closest(".shell");
    if (!shell) return;
    const isOpen = shell.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
  topbar.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const shell = topbar.closest(".shell");
    if (!shell?.classList.contains("nav-open")) return;
    shell.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.focus();
  });
  const nav = element("nav");
  nav.id = "admin-navigation";
  nav.setAttribute("aria-label", "机构管理页面");
  const routes = [
    ["/admin/institution", "机构概览"],
    ["/admin/home-content", "首页内容"],
    ["/admin/public-teachers", "教师介绍"],
    ["/admin/meals", "餐食"],
    ["/admin/activities", "活动"],
    ["/admin/guides", "内部指南"],
    ["/admin/resources", "资源"],
    ["/admin/statistics", "运营统计"],
    ["/admin/learning-safety", "学习安全汇总"],
    ["/admin/staff", "员工账号"],
    ["/admin/files", "文件"],
    ["/admin/publishing", "发布与下架"],
    ["/admin/audit-logs", "审计日志"],
    ["/admin/privacy-requests", "隐私申请审核"],
    ["/admin/binding-review", "家长关系审核"],
    ["/admin/consent-review", "数据授权复核"],
    ["/admin/leave-review", "请假审核"],
    [CARE_RECORD_REVIEW_ROUTE, "成长日报审核"],
    [NOTICE_REVIEW_ROUTE, "通知审核"],
    [SUPPLY_REQUEST_REVIEW_ROUTE, "物资申请审核"],
    ["/admin/pickup-review", "接送异常处理"],
    ["/admin/platform-operations", "平台运营"],
  ] as const;
  for (const [path, label] of routes) {
    const link = element("button", "save");
    link.type = "button";
    link.textContent = label;
    link.dataset.route = path;
    if (window.location.pathname === path) link.setAttribute("aria-current", "page");
    link.addEventListener("click", () => {
      const shell = topbar.closest(".shell");
      shell?.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
      navigate(path);
    });
    nav.append(link);
  }
  topbar.append(navToggle, nav);
}

function appendTopbar(topbar: HTMLElement, suffix = ""): void {
  const brand = element("strong", "brand");
  brand.textContent = "机构管理工作台";
  const scope = element("span");
  scope.textContent = `${syntheticScope.institutionName} · ${syntheticScope.campusName}${suffix}`;
  topbar.append(brand, scope);
  appendAdminNavigation(topbar);
}

function ensureAdminNavigation(): void {
  let shell = appRoot.querySelector<HTMLElement>(".shell");
  if (!shell) {
    const contentNodes = Array.from(appRoot.childNodes);
    shell = element("div", "shell");
    const topbar = element("header", "topbar");
    appendTopbar(topbar);
    shell.append(topbar);
    const hasMain = contentNodes.some(
      (node) => node instanceof HTMLElement && node.tagName === "MAIN",
    );
    if (hasMain) shell.append(...contentNodes);
    else {
      const main = element("main", "content");
      main.append(...contentNodes);
      shell.append(main);
    }
    appRoot.replaceChildren(shell);
    return;
  }

  if (shell.tagName === "MAIN" && shell.parentElement === appRoot) {
    const pageShell = element("div", "shell");
    const topbar = shell.querySelector<HTMLElement>(":scope > .topbar");
    const content = element("main", "content");
    for (const child of Array.from(shell.childNodes)) {
      if (child === topbar) pageShell.append(child);
      else content.append(child);
    }
    if (!topbar) {
      const generatedTopbar = element("header", "topbar");
      appendTopbar(generatedTopbar);
      pageShell.prepend(generatedTopbar);
    }
    pageShell.append(content);
    shell.replaceWith(pageShell);
    shell = pageShell;
  }

  let topbar = shell.querySelector<HTMLElement>(":scope > .topbar");
  if (!topbar) {
    topbar = element("header", "topbar");
    appendTopbar(topbar);
    shell.prepend(topbar);
  } else if (!topbar.querySelector("#admin-navigation")) {
    for (const child of Array.from(topbar.children)) {
      if (child.tagName === "NAV" || child.tagName === "A") child.remove();
    }
    appendAdminNavigation(topbar);
  }
}

function renderAdminMarkup(markup: string): void {
  appRoot.innerHTML = markup;
  ensureAdminNavigation();
}

type EditorState = HomeContentEditorState | PublicTeacherEditorState | MealEditorState;

function effectiveEditorState<T extends EditorState>(value: T): T {
  const mode = currentViewMode();
  if (mode === "READ_ONLY") return { ...value, canPublish: false } as T;
  if (mode === "CONFLICT") return { ...value, status: "CONFLICT" } as T;
  return value;
}

function renderDenied(): void {
  document.title = "无权限";
  appRoot.replaceChildren();
  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar, " · 权限受限");
  const main = element("main");
  const panel = element("section", "panel");
  const heading = element("h1");
  heading.textContent = "当前账号没有此管理页权限";
  const scope = element("p", "summary");
  scope.textContent = `${syntheticScope.institutionName} · ${syntheticScope.campusName} · 仅显示模拟范围`;
  const message = element("p", "notice");
  message.textContent = "请联系机构管理员申请最小权限；本地演示不会发起网络请求。";
  panel.append(heading, scope, message);
  main.append(panel);
  shell.append(topbar, main);
  appRoot.append(shell);
}

function renderInfoPage(
  titleText: string,
  subtitleText: string,
  rows: readonly (readonly [string, string])[],
): void {
  document.title = titleText;
  appRoot.replaceChildren();
  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar);
  const main = element("main");
  const headingRow = element("div", "heading-row");
  const heading = element("div");
  const title = element("h1");
  title.textContent = titleText;
  const subtitle = element("p");
  subtitle.textContent = subtitleText;
  heading.append(title, subtitle);
  const status = element("div", "status");
  status.textContent = "模拟数据 · 只读投影";
  headingRow.append(heading, status);
  const panel = element("section", "panel");
  const list = element("dl", "meta");
  for (const [label, value] of rows) {
    const row = element("div");
    const term = element("dt");
    term.textContent = label;
    const detail = element("dd");
    detail.textContent = value;
    row.append(term, detail);
    list.append(row);
  }
  panel.append(list);
  main.append(headingRow, panel);
  shell.append(topbar, main);
  appRoot.append(shell);
}

function renderInstitutionOverview(): void {
  const effectiveState = effectiveEditorState(state);
  const effectiveTeacherState = effectiveEditorState(teacherState);
  const firstMeal = mealStates[0];
  renderInfoPage("机构与校区概览", "查看当前机构范围与公开内容投影", [
    ["机构", syntheticScope.institutionName],
    ["租户范围", syntheticScope.tenantId],
    ["校区", syntheticScope.campusName],
    ["校区范围", syntheticScope.campusId],
    ["首页内容", effectiveState.status],
    ["教师公开介绍", effectiveTeacherState.status],
    ["餐食内容", firstMeal ? effectiveEditorState(firstMeal).status : "尚未从本机服务读取"],
    ["活动内容", "模拟活动 · PUBLISHED"],
  ]);
  appRoot
    .querySelector("main")
    ?.insertAdjacentHTML(
      "beforeend",
      '<a class="save" href="/admin/binding-review">查看待审核家长关系</a><a class="save" href="/admin/fees">查看费用与协议汇总</a><a class="save" href="/admin/statistics">查看运营统计</a><a class="save" href="/admin/institution#health-review">查看健康观察审核</a>',
    );
}

async function renderHealthIncidentReviewPage(): Promise<void> {
  const generation = ++healthReviewRenderGeneration;
  const editable = currentViewMode() === "AUTHORIZED";
  renderAdminMarkup(renderHealthIncidentReview(healthIncidentReviewClient.snapshot, editable));
  const snapshot = healthIncidentReviewClient.snapshot;
  if (
    snapshot.role !== healthReviewRole ||
    snapshot.status === "IDLE" ||
    snapshot.status === "ERROR"
  )
    await healthIncidentReviewClient.connect(healthReviewRole);
  else await healthIncidentReviewClient.refresh();
  if (generation !== healthReviewRenderGeneration) return;
  renderAdminMarkup(renderHealthIncidentReview(healthIncidentReviewClient.snapshot, editable));
  appRoot
    .querySelector<HTMLSelectElement>("#health-incident-role")
    ?.addEventListener("change", (event) => {
      if (!editable) return;
      const role = (event.currentTarget as HTMLSelectElement).value;
      if (role !== "CAMPUS_REVIEWER" && role !== "PLATFORM_ADMIN") return;
      healthReviewRole = role;
      void renderHealthIncidentReviewPage();
    });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-health-incident-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editable) return;
      const action = button.dataset.healthIncidentAction as HealthIncidentReviewAction | undefined;
      const id = button.dataset.healthIncidentId;
      const version = Number(button.dataset.healthIncidentVersion);
      if (!action || !id || !Number.isSafeInteger(version)) return;
      const operation =
        action === "CONFIRM" || action === "RETURN" || action === "ESCALATE"
          ? healthIncidentReviewClient.review(id, version, action)
          : action === "SUPPLEMENT"
            ? (() => {
                const value = appRoot.querySelector<HTMLSelectElement>(
                  `[data-health-incident-disposition="${CSS.escape(id)}"]`,
                )?.value;
                if (
                  value !== "OBSERVATION_RECHECKED" &&
                  value !== "FOLLOW_UP_SCHEDULED" &&
                  value !== "GUARDIAN_SUMMARY_PREPARED"
                )
                  return Promise.reject(new Error("INVALID_DISPOSITION"));
                return healthIncidentReviewClient.supplement(
                  id,
                  version,
                  value as HealthIncidentDispositionCode,
                );
              })()
            : action === "PUBLISH"
              ? (() => {
                  const value = appRoot.querySelector<HTMLSelectElement>(
                    `[data-health-incident-summary="${CSS.escape(id)}"]`,
                  )?.value;
                  if (
                    value !== "FOLLOW_UP_IN_PROGRESS" &&
                    value !== "FOLLOW_UP_COMPLETED" &&
                    value !== "PLEASE_CHECK_PAGE_LATER"
                  )
                    return Promise.reject(new Error("INVALID_SUMMARY"));
                  return healthIncidentReviewClient.publish(
                    id,
                    version,
                    value as HealthIncidentSummaryCode,
                  );
                })()
              : action === "REVOKE"
                ? healthIncidentReviewClient.revoke(id, version)
                : Promise.reject(new Error("INVALID_ACTION"));
      void operation
        .then(() => renderHealthIncidentReviewPage())
        .catch((error: unknown) => {
          const status = appRoot.querySelector<HTMLElement>("#health-incident-feedback");
          if (status) status.textContent = error instanceof Error ? error.message : "操作失败";
        });
    });
  });
}

async function renderSupplyRequestReviewPage(refresh = false): Promise<void> {
  const generation = ++supplyRequestReviewGeneration;
  const editable = currentViewMode() === "AUTHORIZED";
  const snapshot = supplyRequestReviewClient.snapshot;
  let pending: Promise<void> | undefined;
  try {
    if (
      snapshot.role !== supplyRequestReviewRole ||
      snapshot.status === "IDLE" ||
      snapshot.status === "ERROR"
    ) {
      pending = supplyRequestReviewClient.connect(supplyRequestReviewRole);
      renderAdminMarkup(renderSupplyRequestReview(supplyRequestReviewClient.snapshot, editable));
    } else if (refresh) pending = supplyRequestReviewClient.refresh();
    if (pending) await pending;
  } catch {
    // The client keeps a safe, empty error snapshot for display.
  }
  if (generation !== supplyRequestReviewGeneration) return;
  renderAdminMarkup(renderSupplyRequestReview(supplyRequestReviewClient.snapshot, editable));
  appRoot.querySelector<HTMLSelectElement>("#supply-role")?.addEventListener("change", (event) => {
    if (!editable) return;
    const role = (event.currentTarget as HTMLSelectElement).value;
    if (role !== "CAMPUS_REVIEWER" && role !== "INSTITUTION_REVIEWER" && role !== "PLATFORM_ADMIN")
      return;
    supplyRequestReviewRole = role;
    void renderSupplyRequestReviewPage();
  });
  appRoot.querySelector<HTMLButtonElement>("#supply-refresh")?.addEventListener("click", () => {
    void renderSupplyRequestReviewPage(true);
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-supply-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editable) return;
      const raw = button.dataset.supplyAction;
      const action: SupplyRequestReviewAction | null =
        raw === "CONFIRM" || raw === "RETURN" || raw === "OUT_OF_STOCK" || raw === "CLAIM"
          ? raw
          : null;
      const id = button.dataset.supplyId;
      const version = Number(button.dataset.supplyVersion);
      if (!action || !id || !Number.isSafeInteger(version)) return;
      button.disabled = true;
      void supplyRequestReviewClient
        .command(id, version, action)
        .then(() => renderSupplyRequestReviewPage())
        .catch((error: unknown) => {
          void renderSupplyRequestReviewPage().then(() => {
            const status = appRoot.querySelector<HTMLElement>("#supply-feedback");
            if (status) status.textContent = error instanceof Error ? error.message : "操作失败";
          });
        });
    });
  });
}

async function renderAdminNoticeReviewPage(refresh = false): Promise<void> {
  const generation = ++noticeReviewGeneration;
  const client = getNoticeReviewClient();
  const editable = currentViewMode() === "AUTHORIZED";
  const snapshot = client.snapshot;
  renderAdminMarkup(renderAdminNoticeReview(snapshot, editable));
  try {
    if (snapshot.status === "IDLE" || snapshot.status === "ERROR") await client.connect();
    else if (refresh) await client.refresh();
  } catch {
    // The client keeps an empty error snapshot for display.
  }
  if (generation !== noticeReviewGeneration || window.location.pathname !== NOTICE_REVIEW_ROUTE)
    return;
  renderAdminMarkup(renderAdminNoticeReview(client.snapshot, editable));
  appRoot
    .querySelector<HTMLButtonElement>("[data-notice-refresh]")
    ?.addEventListener("click", () => {
      void renderAdminNoticeReviewPage(true);
    });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-notice-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editable) return;
      const action = button.dataset.noticeAction;
      const id = button.dataset.noticeId;
      const version = Number(button.dataset.noticeVersion);
      if (
        !id ||
        !Number.isSafeInteger(version) ||
        (action !== "CONFIRM" && action !== "RETURN" && action !== "PUBLISH" && action !== "REVOKE")
      )
        return;
      button.disabled = true;
      void client
        .command(id, version, action as NoticeReviewAction)
        .then(() => renderAdminNoticeReviewPage());
    });
  });
}
function selectedFeesProfile(value: string | null): AdminFeesProfile | null {
  if (value === null || value === "owner-east") return "owner-east";
  if (value === "owner-west" || value === "platform-admin") return value;
  return null;
}

function renderAdminFeesRoute(): void {
  const profile = selectedFeesProfile(new URLSearchParams(window.location.search).get("profile"));
  if (profile === null) {
    adminFeesClient.disconnect();
    renderDenied();
    return;
  }
  const existingStatus = adminFeesClient.snapshot.status;
  const connectOperation =
    adminFeesClient.snapshot.profile === profile &&
    ["CONNECTING", "BUSY", "READY"].includes(existingStatus)
      ? null
      : adminFeesClient.connect(profile);
  document.title = "费用与协议汇总";
  renderAdminMarkup(renderAdminFees(adminFeesClient.snapshot));
  appRoot
    .querySelector<HTMLSelectElement>("#admin-fees-profile")
    ?.addEventListener("change", (event) => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLSelectElement)) return;
      const selected = selectedFeesProfile(target.value);
      if (selected === null) return;
      const url = new URL(window.location.href);
      url.searchParams.set("profile", selected);
      window.history.replaceState({}, "", url);
      adminFeesClient.disconnect();
      renderAdminFeesRoute();
    });
  appRoot.querySelector<HTMLButtonElement>("#admin-fees-refresh")?.addEventListener("click", () => {
    if (currentViewMode() === "DENIED") return;
    void adminFeesClient.refresh().then(() => {
      if (window.location.pathname === "/admin/fees") renderAdminFeesRoute();
    });
  });
  if (connectOperation) {
    void connectOperation.then(() => {
      if (window.location.pathname === "/admin/fees") renderAdminFeesRoute();
    });
  }
}

function selectedBindingReviewProfile(value: string | null): AdminBindingReviewerProfile | null {
  if (value === null || value === "owner-east") return "owner-east";
  if (value === "owner-west") return value;
  return null;
}

function renderAdminBindingReviewRoute(): void {
  const profile = selectedBindingReviewProfile(
    new URLSearchParams(window.location.search).get("profile"),
  );
  if (profile === null) {
    bindingReviewClient.disconnect();
    renderDenied();
    return;
  }
  const status = bindingReviewClient.snapshot.status;
  const connectOperation =
    bindingReviewClient.snapshot.profile === profile &&
    ["CONNECTING", "BUSY", "READY"].includes(status)
      ? null
      : bindingReviewClient.connect(profile);
  const canReview = bindingReviewClient.snapshot.canReview && currentViewMode() === "AUTHORIZED";
  document.title = "家长关系审核";
  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar, " · 家长关系审核");
  const scopeLabel = topbar.querySelector("span");
  if (scopeLabel)
    scopeLabel.textContent = `${syntheticScope.institutionName} · ${profile === "owner-east" ? "模拟东校区" : "模拟西校区"}`;
  shell.append(topbar);
  shell.insertAdjacentHTML(
    "beforeend",
    renderAdminBindingReview({
      ...bindingReviewClient.snapshot,
      canReview,
      confirmed: bindingReviewConfirmed,
    }),
  );
  appRoot.replaceChildren(shell);

  appRoot
    .querySelector<HTMLSelectElement>("#binding-review-profile")
    ?.addEventListener("change", (event) => {
      const selected = selectedBindingReviewProfile(
        (event.currentTarget as HTMLSelectElement).value,
      );
      if (!selected) return;
      const url = new URL(window.location.href);
      url.searchParams.set("profile", selected);
      window.history.replaceState({}, "", url);
      bindingReviewConfirmed = false;
      bindingReviewClient.disconnect();
      renderAdminBindingReviewRoute();
    });
  appRoot
    .querySelector<HTMLInputElement>("[data-binding-review-confirm]")
    ?.addEventListener("change", (event) => {
      if (!canReview) return;
      bindingReviewConfirmed = (event.currentTarget as HTMLInputElement).checked;
      renderAdminBindingReviewRoute();
    });
  appRoot
    .querySelector<HTMLButtonElement>("#binding-review-refresh")
    ?.addEventListener("click", () => {
      if (!canReview) return;
      void bindingReviewClient.refresh().then(() => {
        if (window.location.pathname === "/admin/binding-review") renderAdminBindingReviewRoute();
      });
    });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-binding-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canReview || !bindingReviewConfirmed) return;
      const action = button.dataset.bindingAction;
      const index = Number(button.dataset.bindingIndex);
      if ((action !== "approve" && action !== "reject") || !Number.isSafeInteger(index)) return;
      const confirmed = bindingReviewConfirmed;
      bindingReviewConfirmed = false;
      const operation = bindingReviewClient.review(
        index,
        action as AdminBindingReviewAction,
        confirmed,
      );
      renderAdminBindingReviewRoute();
      void operation.then(() => {
        if (window.location.pathname === "/admin/binding-review") renderAdminBindingReviewRoute();
      });
    });
  });
  if (connectOperation) {
    void connectOperation.then(() => {
      if (window.location.pathname === "/admin/binding-review") renderAdminBindingReviewRoute();
    });
  }
}

function renderStaffResources(): void {
  renderInfoPage("员工资源", "查看当前校区允许访问的内部资源", [
    ["值班流程", "模拟值班流程 · v1 · DRAFT"],
    ["新成员指南", "模拟数据 · v2 · PUBLISHED"],
    ["伙伴云边界", "暂未开放：仅保留说明入口，不连接伙伴云"],
  ]);
}

async function runResourceLibraryAdmin(operation: Promise<void>): Promise<void> {
  render();
  await operation;
  if (window.location.pathname === "/admin/resources" && sharedResourceReview()) {
    render();
    appRoot.querySelector<HTMLElement>("[data-resource-admin-status]")?.focus({
      preventScroll: true,
    });
  }
}

function renderSharedResources(): void {
  const snapshot = resourceLibraryAdminClient.snapshot;
  const profile = new URLSearchParams(window.location.search).get("profile");
  renderInfoPage("员工资源", "管理当前机构与校区范围内的资源", []);
  const main = appRoot.querySelector("main");
  if (!main) return;
  const status = appRoot.querySelector<HTMLElement>(".heading-row .status");
  if (status) status.textContent = snapshot.message;
  const panel = element("section", "panel");
  panel.innerHTML = renderAdminResourceLibrary(snapshot);
  main.append(panel);

  if (
    isResourceReviewProfile(profile) &&
    snapshot.profile !== profile &&
    ["IDLE", "READY", "DISCONNECTED"].includes(snapshot.status)
  )
    void runResourceLibraryAdmin(resourceLibraryAdminClient.connect(profile));

  panel
    .querySelector<HTMLFormElement>("[data-resource-update]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (currentViewMode() !== "AUTHORIZED" || !sharedResourceReview()) return;
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const id = form.dataset.resourceId;
      const version = Number(form.dataset.resourceVersion);
      const scope = String(data.get("scope") ?? "");
      const expiresOn = String(data.get("expiresOn") ?? "");
      const classId = String(data.get("classId") ?? "");
      if (
        !id ||
        !Number.isSafeInteger(version) ||
        (scope !== "CAMPUS" && scope !== "CLASS") ||
        !["2026-10-31", "2026-12-31", "2027-03-31"].includes(expiresOn)
      )
        return;
      void runResourceLibraryAdmin(
        resourceLibraryAdminClient.update(
          id,
          version,
          scope,
          expiresOn as "2026-10-31" | "2026-12-31" | "2027-03-31",
          scope === "CLASS" ? classId : undefined,
        ),
      );
    });
  panel.querySelectorAll<HTMLButtonElement>("[data-learning-source-review]").forEach((button) => {
    button.addEventListener("click", () => {
      if (currentViewMode() !== "AUTHORIZED" || !sharedResourceReview()) return;
      const id = button.dataset.resourceId;
      const version = Number(button.dataset.resourceVersion);
      const action = button.dataset.learningSourceAction;
      if (!id || !Number.isSafeInteger(version) || (action !== "APPROVE" && action !== "RETURN"))
        return;
      void runResourceLibraryAdmin(resourceLibraryAdminClient.reviewSource(id, version, action));
    });
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-resource-revoke]").forEach((button) => {
    button.addEventListener("click", () => {
      if (currentViewMode() !== "AUTHORIZED" || !sharedResourceReview()) return;
      const id = button.dataset.resourceId;
      const version = Number(button.dataset.resourceVersion);
      if (!id || !Number.isSafeInteger(version)) return;
      void runResourceLibraryAdmin(resourceLibraryAdminClient.revoke(id, version));
    });
  });
  panel
    .querySelector<HTMLButtonElement>("[data-resource-reconnect]")
    ?.addEventListener("click", () => {
      if (isResourceReviewProfile(profile))
        void runResourceLibraryAdmin(resourceLibraryAdminClient.connect(profile));
    });
  panel
    .querySelector<HTMLButtonElement>("[data-resource-refresh]")
    ?.addEventListener("click", () => {
      void runResourceLibraryAdmin(resourceLibraryAdminClient.refresh());
    });
}

function renderActivities(): void {
  renderInfoPage("活动内容", "查看当前校区允许公开展示的活动说明", [
    ["科学小实验", "模拟活动 · v2 · PUBLISHED"],
    ["阅读分享", "模拟活动 · v1 · DRAFT"],
    ["活动边界", "仅使用合成数据，不连接报名或外部服务"],
  ]);
}

function renderStaffAccounts(): void {
  document.title = "员工账号与资格材料";
  appRoot.replaceChildren();
  const mode = currentViewMode();
  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar);
  const main = element("main");
  const headingRow = element("div", "heading-row");
  const heading = element("div");
  const title = element("h1");
  title.textContent = "员工账号与资格材料";
  const subtitle = element("p");
  subtitle.textContent = "查看本校区合成资料与到期提醒";
  heading.append(title, subtitle);
  const status = element("div", "status");
  status.textContent =
    mode === "AUTHORIZED"
      ? "本机示例 · 可编辑"
      : mode === "READ_ONLY"
        ? "只读查看"
        : "状态冲突 · 只读";
  headingRow.append(heading, status);
  const membershipPanel = element("div", "membership-panel");
  const staffTaskPanel = element("section", "panel");
  staffTaskPanel.id = "staff-task-assignment-panel";
  const staffDailyPanel = element("section", "panel");
  staffDailyPanel.id = "staff-daily-review-panel";
  const monthlyFeedbackPanel =
    window.location.pathname === "/admin/staff" ? element("section", "panel") : null;
  monthlyFeedbackPanel?.setAttribute("id", "monthly-feedback-review-panel");
  const credentials = createStaffCredentialsSection(
    staffCredentialStore,
    mode === "AUTHORIZED",
    staffCredentialNotice,
    (message) => {
      staffCredentialNotice = message;
      renderStaffAccounts();
    },
  );
  const staffOperations = createStaffOperationsSection(staffOperationsStore, mode === "AUTHORIZED");
  main.append(
    headingRow,
    staffTaskPanel,
    staffDailyPanel,
    ...(monthlyFeedbackPanel ? [monthlyFeedbackPanel] : []),
    membershipPanel,
    credentials,
    staffOperations,
  );
  shell.append(topbar, main);
  appRoot.append(shell);
  void loadStaffTaskAssignment(staffTaskPanel);
  void loadStaffDailyReview(staffDailyPanel);
  if (monthlyFeedbackPanel) void loadMonthlyFeedbackReview(monthlyFeedbackPanel);
  void loadMembershipManagement(membershipPanel);
}

async function loadMembershipManagement(
  panel: HTMLElement,
  requestedProfile?: string,
  refresh = true,
): Promise<void> {
  const generation = ++membershipManagementGeneration;
  const profile =
    requestedProfile && isMembershipManagementProfile(requestedProfile)
      ? requestedProfile
      : undefined;
  const editable = currentViewMode() === "AUTHORIZED";
  if (currentViewMode() === "DENIED") {
    membershipManagementClient.disconnect("当前视图没有成员管理权限。", "DENIED");
  } else if (refresh) {
    const current = membershipManagementClient.snapshot;
    if (
      profile ||
      current.status === "IDLE" ||
      current.status === "CONNECTING" ||
      current.status === "ERROR" ||
      current.status === "DENIED"
    ) {
      await membershipManagementClient.connect(profile ?? current.profile);
    } else {
      await membershipManagementClient.refresh();
    }
  }
  if (!panel.isConnected || generation !== membershipManagementGeneration) return;
  panel.innerHTML = renderMembershipManagement(membershipManagementClient.snapshot, editable);
  panel
    .querySelector<HTMLFormElement>("[data-membership-profile-form]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!editable) return;
      const selected = new FormData(event.currentTarget as HTMLFormElement).get("profile");
      if (typeof selected === "string" && isMembershipManagementProfile(selected))
        void loadMembershipManagement(panel, selected);
    });
  panel.querySelectorAll<HTMLButtonElement>("[data-membership-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editable) return;
      const row = button.closest<HTMLElement>("[data-membership-row]");
      const actorId = row?.dataset.membershipRow;
      const status = button.dataset.membershipAction;
      if (!actorId || (status !== "ACTIVE" && status !== "SUSPENDED" && status !== "REVOKED"))
        return;
      if (status === "REVOKED" && !window.confirm("撤销后该示例成员无法再次登录，确定继续吗？"))
        return;
      button.disabled = true;
      void membershipManagementClient
        .setStatus(actorId, status)
        .then(() => loadMembershipManagement(panel, undefined, false));
    });
  });
}

async function loadStaffTaskAssignment(panel: HTMLElement, refresh = true): Promise<void> {
  const generation = ++staffTaskAssignmentGeneration;
  const mode = currentViewMode();
  const editable = mode === "AUTHORIZED";
  if (mode === "DENIED") {
    panel.innerHTML =
      '<h2>任务分派与独立检查</h2><p role="status">当前视图没有查看任务的权限。</p>';
    return;
  }

  panel.innerHTML = renderStaffTaskAssignment(staffTaskAssignmentClient.snapshot, editable);
  if (refresh) {
    const snapshot = staffTaskAssignmentClient.snapshot;
    if (snapshot.status === "IDLE" || snapshot.status === "ERROR")
      await staffTaskAssignmentClient.connect();
    else await staffTaskAssignmentClient.refresh();
  }
  if (!panel.isConnected || generation !== staffTaskAssignmentGeneration) return;
  panel.innerHTML = renderStaffTaskAssignment(staffTaskAssignmentClient.snapshot, editable);
  if (!editable) return;

  panel
    .querySelector<HTMLFormElement>("[data-staff-task-create]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement) || currentViewMode() !== "AUTHORIZED") return;
      const data = new FormData(form);
      const [targetType, targetId] = String(data.get("target") ?? "").split("|");
      if (!targetType || !targetId) return;
      const input: StaffTaskCreateInput = {
        code: String(data.get("code") ?? ""),
        assigneeId: String(data.get("assigneeId") ?? ""),
        targetType,
        targetId,
        dueDate: String(data.get("dueDate") ?? ""),
        priority: String(data.get("priority") ?? ""),
      };
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (button) button.disabled = true;
      void staffTaskAssignmentClient
        .create(input)
        .then(() => loadStaffTaskAssignment(panel, false));
    });

  panel.querySelectorAll<HTMLButtonElement>("[data-staff-task-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (currentViewMode() !== "AUTHORIZED") return;
      const raw = button.dataset.staffTaskAction;
      const action =
        raw === "confirm"
          ? "CONFIRM"
          : raw === "return"
            ? "RETURN"
            : raw === "cancel"
              ? "CANCEL"
              : null;
      const id = button.dataset.staffTaskId;
      const version = Number(button.dataset.staffTaskVersion);
      if (!action || !id || !Number.isSafeInteger(version)) return;
      button.disabled = true;
      void staffTaskAssignmentClient
        .review(id, version, action)
        .then(() => loadStaffTaskAssignment(panel, false));
    });
  });
}
async function loadStaffDailyReview(panel: HTMLElement, refresh = true): Promise<void> {
  const mode = currentViewMode();
  if (mode === "DENIED") {
    panel.innerHTML = '<h2>工作日报审核</h2><p role="status">当前视图没有查看审核队列的权限。</p>';
    return;
  }
  panel.innerHTML = renderStaffDailyReview(staffDailyReviewClient.snapshot, mode === "AUTHORIZED");
  if (refresh) {
    const snapshot = staffDailyReviewClient.snapshot;
    if (snapshot.status === "IDLE" || snapshot.status === "ERROR")
      await staffDailyReviewClient.connect();
    else await staffDailyReviewClient.refresh();
  }
  if (!panel.isConnected) return;
  const editable = currentViewMode() === "AUTHORIZED";
  panel.innerHTML = renderStaffDailyReview(staffDailyReviewClient.snapshot, editable);
  panel
    .querySelector<HTMLButtonElement>("[data-staff-daily-refresh]")
    ?.addEventListener("click", () => {
      void loadStaffDailyReview(panel);
    });
  panel.querySelectorAll<HTMLButtonElement>("[data-staff-daily-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editable) return;
      const action = button.dataset.staffDailyAction;
      const id = button.dataset.staffDailyId;
      const version = Number(button.dataset.staffDailyVersion);
      if ((action !== "CONFIRM" && action !== "RETURN") || !id || !Number.isSafeInteger(version))
        return;
      button.disabled = true;
      void staffDailyReviewClient
        .review(id, version, action)
        .then(() => loadStaffDailyReview(panel, false));
    });
  });
}

async function loadMonthlyFeedbackReview(panel: HTMLElement, refresh = true): Promise<void> {
  const mode = currentViewMode();
  if (mode === "DENIED") {
    panel.innerHTML =
      '<h2>月度成长反馈审核</h2><p role="status">当前视图没有查看审核队列的权限。</p>';
    return;
  }
  panel.innerHTML = renderMonthlyFeedbackReview(
    monthlyFeedbackReviewClient.snapshot,
    mode === "AUTHORIZED",
  );
  if (refresh) {
    try {
      const snapshot = monthlyFeedbackReviewClient.snapshot;
      if (snapshot.status === "IDLE" || snapshot.status === "ERROR")
        await monthlyFeedbackReviewClient.connect();
      else await monthlyFeedbackReviewClient.refresh();
    } catch (error) {
      if (!panel.isConnected) return;
      const status = panel.querySelector<HTMLElement>("#monthly-feedback-feedback");
      if (status) status.textContent = error instanceof Error ? error.message : "刷新失败。";
      return;
    }
  }
  if (!panel.isConnected) return;
  panel.innerHTML = renderMonthlyFeedbackReview(
    monthlyFeedbackReviewClient.snapshot,
    currentViewMode() === "AUTHORIZED",
  );
  panel
    .querySelector<HTMLButtonElement>("[data-monthly-feedback-refresh]")
    ?.addEventListener("click", () => {
      void loadMonthlyFeedbackReview(panel);
    });
  panel.querySelectorAll<HTMLButtonElement>("[data-monthly-feedback-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (currentViewMode() !== "AUTHORIZED") return;
      const raw = button.dataset.monthlyFeedbackAction;
      const action =
        raw === "CONFIRM" || raw === "RETURN" || raw === "PUBLISH" || raw === "SOURCE_REFRESH"
          ? (raw as MonthlyFeedbackReviewAction)
          : null;
      const id = button.dataset.monthlyFeedbackId;
      const version = Number(button.dataset.monthlyFeedbackVersion);
      if (!action || !id || !Number.isSafeInteger(version)) return;
      button.disabled = true;
      void monthlyFeedbackReviewClient
        .command(id, version, action)
        .then(() => loadMonthlyFeedbackReview(panel, false))
        .catch((error: unknown) => {
          const status = panel.querySelector<HTMLElement>("#monthly-feedback-feedback");
          if (status) status.textContent = error instanceof Error ? error.message : "操作失败。";
        });
    });
  });
}

function renderPlatformOperations(): void {
  const feesSnapshot = adminFeesClient.snapshot;
  const connectOperation =
    currentViewMode() !== "DENIED" &&
    (feesSnapshot.profile !== "platform-admin" || feesSnapshot.status === "IDLE")
      ? adminFeesClient.connect("platform-admin")
      : null;
  renderInfoPage("平台运营", "查看合成租户、固定配额和汇总支持状态。", [
    ["使用范围", "仅本机合成数据，不控制真实机构服务"],
    ["隐私边界", "仅展示汇总，不展示学生、家长或员工明细"],
  ]);
  const main = appRoot.querySelector("main");
  if (!main) return;
  main.append(
    createPlatformOperationsSection(platformOperationsStore, currentViewMode() === "AUTHORIZED", {
      fees: adminFeesClient.snapshot,
      staffOperations: staffOperationsStore.snapshot,
      credentials: staffCredentialStore.list(),
    }),
  );
  if (connectOperation) {
    void connectOperation.then(() => {
      if (
        window.location.pathname === "/admin/platform-operations" &&
        currentViewMode() !== "DENIED"
      )
        renderPlatformOperations();
    });
  }
}

function renderFiles(): void {
  const profile = new URLSearchParams(window.location.search).get("profile") ?? "owner-east";
  const editable = currentViewMode() === "AUTHORIZED";
  const canView = currentViewMode() !== "DENIED";
  const renderIfStillAllowed = (): void => {
    if (window.location.pathname === "/admin/files" && currentViewMode() !== "DENIED")
      renderFiles();
  };
  document.title = "同芯学园 · 文件与引用管理";
  renderAdminMarkup(renderFileLifecycle(mediaAssetsAdminClient.snapshot, profile, !editable));
  const profilePicker = appRoot.querySelector<HTMLSelectElement>("[data-media-profile]");
  profilePicker?.addEventListener("change", () => {
    if (!canView) return;
    const selected = profilePicker.value as MediaAssetsProfile;
    const url = new URL(window.location.href);
    url.searchParams.set("profile", selected);
    window.history.replaceState({}, "", url);
    void mediaAssetsAdminClient.connect(selected).then(renderIfStillAllowed);
  });
  appRoot
    .querySelector<HTMLButtonElement>("[data-media-refresh]")
    ?.addEventListener("click", () => {
      if (!canView) return;
      void mediaAssetsAdminClient.refresh().then(renderIfStillAllowed);
    });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-media-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editable) return;
      const action = button.dataset.mediaAction;
      const id = button.dataset.mediaId;
      const version = Number(button.dataset.mediaVersion);
      const source = mediaAssetsAdminClient.snapshot.assets.find((asset) => asset.id === id);
      if (!id || !source || !Number.isSafeInteger(version) || version !== source.version) return;
      let operation: Promise<void>;
      if (action === "access") operation = mediaAssetsAdminClient.checkAccess(id, version);
      else if (action === "archive") operation = mediaAssetsAdminClient.archive(id, version);
      else if (action === "delete") operation = mediaAssetsAdminClient.softDelete(id, version);
      else if (action === "revoke") {
        const confirmed =
          appRoot.querySelector<HTMLInputElement>(`[data-media-confirm="${id}"]`)?.checked ?? false;
        operation = mediaAssetsAdminClient.revoke(id, version, confirmed);
      } else if (action === "replace") {
        const referenceId = button.dataset.mediaReference;
        const targetId = appRoot.querySelector<HTMLSelectElement>(
          `[data-media-target="${referenceId}"]`,
        )?.value;
        const target = mediaAssetsAdminClient.snapshot.assets.find(
          (asset) => asset.id === targetId,
        );
        if (!referenceId || !target) return;
        operation = mediaAssetsAdminClient.replaceReference(id, version, referenceId, target);
      } else return;
      void operation.then(renderIfStillAllowed);
    });
  });
  appRoot.querySelectorAll<HTMLInputElement>("[data-media-confirm]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const id = checkbox.dataset.mediaConfirm;
      const button = appRoot.querySelector<HTMLButtonElement>(
        `[data-media-action="revoke"][data-media-id="${id}"]`,
      );
      if (button && editable) button.disabled = !checkbox.checked;
    });
  });
  const snapshot = mediaAssetsAdminClient.snapshot;
  if (
    snapshot.profile !== profile &&
    !["CONNECTING", "BUSY"].includes(snapshot.status) &&
    canView
  ) {
    void mediaAssetsAdminClient.connect(profile).then(renderIfStillAllowed);
  }
}
function element<T extends keyof HTMLElementTagNameMap>(tagName: T, className?: string) {
  const element = document.createElement(tagName);
  if (className !== undefined) element.className = className;
  return element;
}

function renderHomeContent(): void {
  const view = HomeContentPage(effectiveEditorState(state));
  document.title = view.heading;
  appRoot.replaceChildren();

  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar);

  const main = element("main");
  const headingRow = element("div", "heading-row");
  const heading = element("div");
  const title = element("h1");
  title.textContent = view.heading;
  const subtitle = element("p");
  subtitle.textContent = "编辑、预览并控制首页内容的发布状态";
  heading.append(title, subtitle);
  const status = element("div", "status");
  status.textContent = notice;
  headingRow.append(heading, status);

  const workspace = element("div", "workspace");
  const editorPanel = element("section", "panel");
  const editorTitle = element("h2");
  editorTitle.textContent = "内容编辑";
  const titleField = element("div", "field");
  const titleLabel = element("label");
  titleLabel.textContent = "标题";
  const contentTitle = element("strong");
  contentTitle.textContent = view.state.title;
  titleField.append(titleLabel, contentTitle);
  const summaryField = element("div", "field");
  const summaryLabel = element("label");
  summaryLabel.textContent = "摘要";
  const summary = element("p", "summary");
  summary.textContent = view.state.summary;
  summaryField.append(summaryLabel, summary);
  const blocksField = element("div", "field");
  const blocksLabel = element("label");
  blocksLabel.textContent = "内容区块";
  const blocks = element("ul", "block-list");
  for (const block of view.state.blocks) {
    const item = element("li");
    const kind = element("span", "block-kind");
    kind.textContent = block.kind;
    const text = element("span");
    text.textContent = block.text;
    item.append(kind, text);
    blocks.append(item);
  }
  blocksField.append(blocksLabel, blocks);
  editorPanel.append(editorTitle, titleField, summaryField, blocksField);

  const actionPanel = element("aside", "panel");
  const actionTitle = element("h2");
  actionTitle.textContent = "发布控制";
  const meta = element("dl", "meta");
  const version = element("div");
  const versionLabel = element("dt");
  versionLabel.textContent = "版本";
  const versionValue = element("dd");
  versionValue.textContent = `v${view.state.version}`;
  version.append(versionLabel, versionValue);
  const stateRow = element("div");
  const stateLabel = element("dt");
  stateLabel.textContent = "状态";
  const stateValue = element("dd");
  stateValue.textContent = view.state.status;
  stateRow.append(stateLabel, stateValue);
  meta.append(version, stateRow);

  const actions = element("div", "actions");
  const save = element("button", "save");
  save.type = "button";
  save.textContent = view.saveAction;
  save.disabled = currentViewMode() !== "AUTHORIZED";
  save.addEventListener("click", () => {
    state = { ...state, status: "DRAFT", version: state.version + 1 };
    notice = "草稿已保存";
    render();
  });
  const publish = element("button", "publish");
  publish.type = "button";
  publish.disabled = currentViewMode() !== "AUTHORIZED" || !view.state.canPublish;
  publish.textContent = view.publishAction;
  publish.addEventListener("click", () => {
    state = { ...state, status: "PUBLISHED", version: state.version + 1 };
    notice = "内容已发布";
    render();
  });
  const unpublish = element("button", "save");
  unpublish.type = "button";
  unpublish.textContent =
    "unpublishAction" in view && typeof view.unpublishAction === "string"
      ? view.unpublishAction
      : "下架内容";
  unpublish.disabled = currentViewMode() !== "AUTHORIZED" || !view.state.canPublish;
  unpublish.addEventListener("click", () => {
    state = { ...state, status: "UNPUBLISHED", version: state.version + 1 };
    notice = "内容已下架";
    render();
  });
  actions.append(save, publish, unpublish);
  const audit = element("p", "notice");
  audit.textContent = "发布动作使用模拟状态，不连接正式服务。";
  actionPanel.append(actionTitle, meta, actions, audit);

  workspace.append(editorPanel, actionPanel);
  main.append(headingRow, workspace);
  shell.append(topbar, main);
  appRoot.append(shell);
}

function renderPublicTeachers(): void {
  const view = PublicTeacherIntroductionsPage(effectiveEditorState(teacherState));
  document.title = view.heading;
  appRoot.replaceChildren();

  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar);

  const main = element("main");
  const headingRow = element("div", "heading-row");
  const heading = element("div");
  const title = element("h1");
  title.textContent = view.heading;
  const subtitle = element("p");
  subtitle.textContent = "编辑并控制教师公开介绍的发布状态";
  heading.append(title, subtitle);
  const status = element("div", "status");
  status.textContent = teacherNotice;
  headingRow.append(heading, status);

  const workspace = element("div", "workspace");
  const editorPanel = element("section", "panel");
  const editorTitle = element("h2");
  editorTitle.textContent = "教师介绍";
  const name = element("strong");
  name.textContent = view.state.displayName;
  const headline = element("p", "summary");
  headline.textContent = view.state.headline;
  const subjects = element("p", "summary");
  subjects.textContent = view.state.subjects.join(" · ");
  const bio = element("p", "summary");
  bio.textContent = view.state.bio;
  editorPanel.append(editorTitle, name, headline, subjects, bio);

  const actionPanel = element("aside", "panel");
  const actionTitle = element("h2");
  actionTitle.textContent = "发布控制";
  const meta = element("dl", "meta");
  const version = element("div");
  const versionLabel = element("dt");
  versionLabel.textContent = "版本";
  const versionValue = element("dd");
  versionValue.textContent = `v${view.state.version}`;
  version.append(versionLabel, versionValue);
  const stateRow = element("div");
  const stateLabel = element("dt");
  stateLabel.textContent = "状态";
  const stateValue = element("dd");
  stateValue.textContent = view.state.status;
  stateRow.append(stateLabel, stateValue);
  meta.append(version, stateRow);

  const actions = element("div", "actions");
  const save = element("button", "save");
  save.type = "button";
  save.textContent = view.saveAction;
  save.disabled = currentViewMode() !== "AUTHORIZED";
  save.addEventListener("click", () => {
    teacherState = { ...teacherState, status: "DRAFT", version: teacherState.version + 1 };
    teacherNotice = "教师介绍草稿已保存";
    render();
  });
  const publish = element("button", "publish");
  publish.type = "button";
  publish.disabled = currentViewMode() !== "AUTHORIZED" || !view.state.canPublish;
  publish.textContent = view.publishAction;
  publish.addEventListener("click", () => {
    teacherState = { ...teacherState, status: "PUBLISHED", version: teacherState.version + 1 };
    teacherNotice = "教师介绍已发布";
    render();
  });
  const unpublish = element("button", "save");
  unpublish.type = "button";
  unpublish.textContent =
    "unpublishAction" in view && typeof view.unpublishAction === "string"
      ? view.unpublishAction
      : "下架内容";
  unpublish.disabled = currentViewMode() !== "AUTHORIZED" || !view.state.canPublish;
  unpublish.addEventListener("click", () => {
    teacherState = { ...teacherState, status: "UNPUBLISHED", version: teacherState.version + 1 };
    teacherNotice = "教师介绍已下架";
    render();
  });
  actions.append(save, publish, unpublish);
  const audit = element("p", "notice");
  audit.textContent = "发布动作使用模拟状态，不连接正式服务。";
  actionPanel.append(actionTitle, meta, actions, audit);

  workspace.append(editorPanel, actionPanel);
  main.append(headingRow, workspace);
  shell.append(topbar, main);
  appRoot.append(shell);
}

const mealTypeLabels: Record<MealEditorState["mealType"], string> = {
  BREAKFAST: "早餐",
  LUNCH: "午餐",
  SNACK: "加餐",
  DINNER: "晚餐",
};

const mealStatusLabels: Record<MealEditorState["status"], string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  UNPUBLISHED: "已下架",
  CONFLICT: "版本冲突待处理",
};

const mealAuditLabels: Record<MealAuditEntry["action"], string> = {
  SORT: "调整列表顺序",
  SAVE_DRAFT: "保存草稿",
  PUBLISH: "发布",
  UNPUBLISH: "下架",
};

function recordMealAction(action: MealAuditEntry["action"], mealId: string): void {
  mealAuditSequence += 1;
  mealAuditEntries = [
    {
      id: mealAuditSequence,
      action,
      mealId,
      occurredAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    },
    ...mealAuditEntries,
  ].slice(0, 50);
}

function mealEditorState(record: AdminMealRecord): MealEditorState {
  return {
    mealId: record.id,
    mealDate: record.meal_date,
    mealType: record.meal_type,
    items: [...record.items],
    notes: record.notes,
    version: record.version,
    status: record.status,
    canPublish: true,
  };
}

function applyMealRecord(record: AdminMealRecord, previousId = record.id): void {
  const updated = mealEditorState(record);
  const exists = mealStates.some((entry) => entry.mealId === previousId);
  mealStates = exists
    ? mealStates.map((entry) => (entry.mealId === previousId ? updated : entry))
    : [...mealStates, updated];
  selectedMealId = updated.mealId;
}

function mealFailureMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "UNAVAILABLE";
  if (code === "VERSION_MISMATCH" || code === "CONFLICT_STATE")
    return "餐食内容已被更新，请重新选择并核对最新版本。";
  if (code === "FORBIDDEN_SCOPE" || code === "UNAVAILABLE")
    return "当前合成账号没有餐食管理权限。";
  return "本机餐食服务暂不可用；请启动本地演示服务后刷新。";
}

function isValidMealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function renderMeals(): void {
  const mode = currentViewMode();
  const selectedMeal = mealStates.find((meal) => meal.mealId === selectedMealId) ?? null;
  const hasConflict = mode === "CONFLICT" || selectedMeal?.status === "CONFLICT";
  const view = MealsPage({
    meals: mealStates,
    selectedMealId,
    sortDirection: mealSortDirection,
    auditEntries: mealAuditEntries,
    canEdit: mode === "AUTHORIZED" && mealLoadStatus === "READY" && !hasConflict,
    canPublish:
      mode === "AUTHORIZED" &&
      mealLoadStatus === "READY" &&
      !hasConflict &&
      selectedMeal?.canPublish === true,
    hasConflict,
  });
  document.title = view.heading;
  appRoot.replaceChildren();

  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar);

  const main = element("main");
  const headingRow = element("div", "heading-row");
  const heading = element("div");
  const title = element("h1");
  title.textContent = view.heading;
  const subtitle = element("p");
  subtitle.textContent = "管理已发布菜单，访客页面会读取当前校区的公开餐食；内容保存在本机服务运行期间。";
  heading.append(title, subtitle);
  const status = element("div", "status");
  status.setAttribute("role", "status");
  status.textContent = mealNotice;
  headingRow.append(heading, status);

  const workspace = element("div", "workspace");
  const listPanel = element("section", "panel");
  listPanel.setAttribute("aria-label", "餐食列表区域");
  const listTitle = element("h2");
  listTitle.textContent = "日期与餐次";
  const listActions = element("div", "actions");
  const sortLabel = element("label");
  sortLabel.htmlFor = "meal-sort-direction";
  sortLabel.textContent = "列表日期排序";
  const sortSelect = element("select");
  sortSelect.id = "meal-sort-direction";
  for (const [value, label] of [
    ["ASC", "日期从早到晚"],
    ["DESC", "日期从晚到早"],
  ] as const) {
    const option = element("option");
    option.value = value;
    option.textContent = label;
    sortSelect.append(option);
  }
  sortSelect.value = view.sortDirection;
  sortSelect.disabled = !view.canEdit;
  const applySort = element("button", "save");
  applySort.type = "button";
  applySort.textContent = "应用排序";
  applySort.disabled = !view.canEdit;
  applySort.addEventListener("click", () => {
    if (!view.canEdit || (sortSelect.value !== "ASC" && sortSelect.value !== "DESC")) return;
    const direction = sortSelect.value;
    if (direction !== mealSortDirection) {
      mealSortDirection = direction;
      recordMealAction("SORT", "meal-list");
      mealNotice = "餐食列表顺序已调整（仅当前演示会话）";
    }
    render();
  });
  const addMeal = element("button", "save");
  addMeal.type = "button";
  addMeal.textContent = "新建餐食";
  addMeal.disabled = !view.canEdit;
  addMeal.addEventListener("click", () => {
    if (!view.canEdit) return;
    newMealSequence += 1;
    const mealId = `meal-unsaved-${newMealSequence}`;
    mealStates = [
      ...mealStates,
      {
        mealId,
        mealDate: "2026-10-15",
        mealType: "LUNCH",
        items: [],
        notes: "",
        version: 0,
        status: "DRAFT",
        canPublish: true,
      },
    ];
    selectedMealId = mealId;
    mealNotice = "请填写餐食内容后保存草稿。";
    render();
  });
  listActions.append(sortLabel, sortSelect, applySort, addMeal);

  const mealList = element("ul", "block-list");
  mealList.setAttribute("aria-label", "餐食列表");
  for (const meal of view.meals) {
    const listItem = element("li");
    const mealButton = element("button", "save");
    mealButton.type = "button";
    mealButton.textContent = `${meal.mealDate} · ${mealTypeLabels[meal.mealType]} · ${mealStatusLabels[meal.status]}`;
    mealButton.setAttribute("aria-pressed", String(meal.mealId === selectedMealId));
    mealButton.addEventListener("click", () => {
      selectedMealId = meal.mealId;
      mealNotice = "已选择餐食内容。";
      render();
    });
    listItem.append(mealButton);
    mealList.append(listItem);
  }
  if (view.meals.length === 0) {
    const empty = element("p", "summary");
    empty.textContent =
      mealLoadStatus === "CONNECTING" || mealLoadStatus === "IDLE"
        ? "正在读取本机餐食安排…"
        : mealLoadStatus === "ERROR"
          ? "本机餐食服务暂不可用；请启动服务后刷新页面。"
          : "暂无餐食安排，请新建一条餐食。";
    listPanel.append(empty);
  }
  listPanel.append(listTitle, listActions, mealList);

  const editorPanel = element("section", "panel");
  editorPanel.setAttribute("aria-label", "餐食编辑与预览");
  const editorTitle = element("h2");
  editorTitle.textContent = "餐食编辑";
  editorPanel.append(editorTitle);

  if (view.selectedMeal === null) {
    const empty = element("p", "summary");
    empty.textContent = "请选择一条餐食安排，或新建餐食。";
    editorPanel.append(empty);
  } else {
    const meal = view.selectedMeal;
    const dateLabel = element("label");
    dateLabel.htmlFor = "meal-date";
    dateLabel.textContent = "日期";
    const dateInput = element("input");
    dateInput.id = "meal-date";
    dateInput.type = "date";
    dateInput.value = meal.mealDate;
    dateInput.disabled = !view.canEdit;

    const typeLabel = element("label");
    typeLabel.htmlFor = "meal-type";
    typeLabel.textContent = "餐次";
    const typeSelect = element("select");
    typeSelect.id = "meal-type";
    for (const [value, label] of [
      ["BREAKFAST", "早餐"],
      ["LUNCH", "午餐"],
      ["SNACK", "加餐"],
      ["DINNER", "晚餐"],
    ] as const) {
      const option = element("option");
      option.value = value;
      option.textContent = label;
      typeSelect.append(option);
    }
    typeSelect.value = meal.mealType;
    typeSelect.disabled = !view.canEdit;

    const itemsLabel = element("label");
    itemsLabel.htmlFor = "meal-items";
    itemsLabel.textContent = "菜品（每行一道）";
    const itemsInput = element("textarea");
    itemsInput.id = "meal-items";
    itemsInput.rows = 4;
    itemsInput.maxLength = 1450;
    itemsInput.value = meal.items.join("\n");
    itemsInput.disabled = !view.canEdit;

    const notesLabel = element("label");
    notesLabel.htmlFor = "meal-notes";
    notesLabel.textContent = "菜单说明";
    const notesInput = element("textarea");
    notesInput.id = "meal-notes";
    notesInput.rows = 3;
    notesInput.maxLength = 500;
    notesInput.value = meal.notes;
    notesInput.disabled = !view.canEdit;

    const save = element("button", "save");
    save.type = "button";
    save.textContent = view.saveAction;
    save.disabled = !view.canEdit;
    save.addEventListener("click", () => {
      if (!view.canEdit) return;
      const items = itemsInput.value
        .split(/\r?\n/u)
        .map((item) => item.trim())
        .filter(Boolean);
      if (
        !isValidMealDate(dateInput.value) ||
        items.length < 1 ||
        items.length > 12 ||
        items.some((item) => item.length > 120) ||
        notesInput.value.length > 500
      ) {
        mealNotice = "請填写有效日期、1 至 12 道菜品及不超过 500 字的说明。";
        status.textContent = mealNotice;
        return;
      }
      const payload: AdminMealPayload = {
        meal_date: dateInput.value,
        meal_type: typeSelect.value as MealEditorState["mealType"],
        items,
        notes: notesInput.value,
      };
      save.disabled = true;
      status.textContent = "正在保存到本机共享餐食服务…";
      void (async () => {
        try {
          const saved =
            meal.version === 0
              ? await adminMealsClient.createDraft(payload)
              : await adminMealsClient.updateDraft(meal.mealId, meal.version, payload);
          applyMealRecord(saved, meal.mealId);
          recordMealAction("SAVE_DRAFT", saved.id);
          mealNotice = "餐食草稿已保存到本机共享服务。";
        } catch (error) {
          if (error instanceof Error && error.message === "VERSION_MISMATCH") {
            mealStates = mealStates.map((entry) =>
              entry.mealId === meal.mealId ? { ...entry, status: "CONFLICT" } : entry,
            );
          }
          mealNotice = mealFailureMessage(error);
        }
        render();
      })();
    });

    const publish = element("button", "publish");
    publish.type = "button";
    publish.textContent = view.publishAction;
    publish.disabled =
      !view.canPublish || meal.version === 0 || meal.status === "PUBLISHED";
    publish.addEventListener("click", () => {
      if (
        !view.canPublish ||
        meal.version === 0 ||
        meal.status === "PUBLISHED" ||
        currentViewMode() !== "AUTHORIZED"
      )
        return;
      publish.disabled = true;
      status.textContent = "正在发布餐食…";
      void adminMealsClient
        .publish(meal.mealId, meal.version)
        .then((published) => {
          applyMealRecord(published);
          recordMealAction("PUBLISH", meal.mealId);
          mealNotice = "餐食已发布，访客页面可以查看。";
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.message === "VERSION_MISMATCH") {
            mealStates = mealStates.map((entry) =>
              entry.mealId === meal.mealId ? { ...entry, status: "CONFLICT" } : entry,
            );
          }
          mealNotice = mealFailureMessage(error);
        })
        .finally(render);
    });

    const unpublish = element("button", "save");
    unpublish.type = "button";
    unpublish.textContent =
      "unpublishAction" in view && typeof view.unpublishAction === "string"
        ? view.unpublishAction
        : "下架内容";
    unpublish.disabled =
      !view.canPublish || meal.version === 0 || meal.status !== "PUBLISHED";
    unpublish.addEventListener("click", () => {
      if (
        !view.canPublish ||
        meal.version === 0 ||
        meal.status !== "PUBLISHED" ||
        currentViewMode() !== "AUTHORIZED"
      )
        return;
      unpublish.disabled = true;
      status.textContent = "正在下架餐食…";
      void adminMealsClient
        .unpublish(meal.mealId, meal.version)
        .then((unpublished) => {
          applyMealRecord(unpublished);
          recordMealAction("UNPUBLISH", meal.mealId);
          mealNotice = "餐食已下架，访客页面将不再显示。";
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.message === "VERSION_MISMATCH") {
            mealStates = mealStates.map((entry) =>
              entry.mealId === meal.mealId ? { ...entry, status: "CONFLICT" } : entry,
            );
          }
          mealNotice = mealFailureMessage(error);
        })
        .finally(render);
    });

    const preview = element("section", "panel");
    preview.setAttribute("aria-label", "餐食预览");
    const previewTitle = element("h3");
    previewTitle.textContent = "预览";
    const previewSummary = element("p", "summary");
    previewSummary.textContent = `${dateInput.value} · ${mealTypeLabels[typeSelect.value as MealEditorState["mealType"]]}`;
    const previewItems = element("ul", "block-list");
    for (const item of itemsInput.value.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean)) {
      const listItem = element("li");
      listItem.textContent = item;
      previewItems.append(listItem);
    }
    const previewNotes = element("p", "summary");
    previewNotes.textContent = notesInput.value;
    preview.append(previewTitle, previewSummary, previewItems, previewNotes);
    const updatePreview = () => {
      previewSummary.textContent = `${dateInput.value} · ${mealTypeLabels[typeSelect.value as MealEditorState["mealType"]]}`;
      previewItems.replaceChildren();
      for (const item of itemsInput.value
        .split(/\r?\n/u)
        .map((value) => value.trim())
        .filter(Boolean)) {
        const listItem = element("li");
        listItem.textContent = item;
        previewItems.append(listItem);
      }
      previewNotes.textContent = notesInput.value;
    };
    dateInput.addEventListener("input", updatePreview);
    typeSelect.addEventListener("change", updatePreview);
    itemsInput.addEventListener("input", updatePreview);
    notesInput.addEventListener("input", updatePreview);

    const mealStatus = element("p", "summary");
    mealStatus.setAttribute("aria-label", "餐食状态");
    mealStatus.textContent = view.hasConflict
      ? "版本冲突待处理"
      : mealStatusLabels[meal.status];
    const version = element("p", "summary");
    version.textContent = `版本 v${meal.version}`;
    const actions = element("div", "actions");
    actions.append(save, publish, unpublish);
    editorPanel.append(
      dateLabel,
      dateInput,
      typeLabel,
      typeSelect,
      itemsLabel,
      itemsInput,
      notesLabel,
      notesInput,
      mealStatus,
      version,
      actions,
      preview,
    );
  }

  const auditPanel = element("section", "panel");
  const auditTitle = element("h2");
  auditTitle.textContent = "本页操作记录";
  const auditList = element("ol", "block-list");
  auditList.setAttribute("aria-label", "餐食操作记录");
  for (const entry of view.auditEntries) {
    const item = element("li");
    item.textContent = `${entry.occurredAt} · ${mealAuditLabels[entry.action]} · ${entry.mealId}`;
    auditList.append(item);
  }
  if (view.auditEntries.length === 0) {
    const empty = element("p", "summary");
    empty.textContent = "当前会话还没有餐食操作记录。";
    auditPanel.append(empty);
  }
  auditPanel.append(auditTitle, auditList);

  const editorColumn = element("div");
  editorColumn.append(editorPanel, auditPanel);
  workspace.append(listPanel, editorColumn);
  main.append(headingRow, workspace);
  shell.append(topbar, main);
  appRoot.append(shell);
  if (mealLoadStatus === "IDLE") {
    mealLoadStatus = "CONNECTING";
    mealNotice = "正在连接本机餐食服务…";
    void adminMealsClient
      .connect()
      .then((records) => {
        if (window.location.pathname !== "/admin/meals") return;
        mealStates = records.map(mealEditorState);
        selectedMealId = mealStates[0]?.mealId ?? null;
        mealLoadStatus = "READY";
        mealNotice = `已读取 ${records.length} 条合成餐食安排。`;
        render();
      })
      .catch((error: unknown) => {
        if (window.location.pathname !== "/admin/meals") return;
        mealStates = [];
        selectedMealId = null;
        mealLoadStatus = "ERROR";
        mealNotice = mealFailureMessage(error);
        render();
      });
  }
}

function renderStaffGuides(): void {
  const matches = syntheticStaffGuides.filter((guide) => {
    const query = staffGuideQuery.trim().toLocaleLowerCase();
    return (
      query.length === 0 || `${guide.title} ${guide.summary}`.toLocaleLowerCase().includes(query)
    );
  });
  const selectedGuide =
    matches.find((guide) => guide.guideId === selectedStaffGuideId) ?? matches[0] ?? null;
  if (selectedGuide !== null) selectedStaffGuideId = selectedGuide.guideId;

  document.title = "新成员指南";
  appRoot.replaceChildren();

  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar, " · 内部内容");

  const main = element("main");
  const headingRow = element("div", "heading-row");
  const heading = element("div");
  const title = element("h1");
  title.textContent = "新成员指南";
  const subtitle = element("p");
  subtitle.textContent = "检索当前校区允许查看的内部指南与版本状态";
  heading.append(title, subtitle);
  const status = element("div", "status");
  status.textContent = "仅显示模拟数据，不连接正式服务";
  headingRow.append(heading, status);

  const workspace = element("div", "workspace");
  const listPanel = element("section", "panel");
  const listTitle = element("h2");
  listTitle.textContent = "指南列表";
  const searchLabel = element("label");
  searchLabel.textContent = "搜索指南";
  const search = element("input");
  search.type = "search";
  search.value = staffGuideQuery;
  search.placeholder = "输入标题或摘要";
  search.addEventListener("input", () => {
    staffGuideQuery = search.value;
    render();
  });
  listPanel.append(listTitle, searchLabel, search);

  const list = element("ul", "block-list");
  for (const guide of matches) {
    const item = element("li");
    const button = element("button");
    button.type = "button";
    button.textContent = `${guide.title} · v${guide.version} · ${guide.status}`;
    button.addEventListener("click", () => {
      selectedStaffGuideId = guide.guideId;
      render();
    });
    item.append(button);
    list.append(item);
  }
  if (matches.length === 0) {
    const empty = element("p", "summary");
    empty.textContent = "没有匹配的模拟指南";
    listPanel.append(empty);
  }
  listPanel.append(list);

  const detailPanel = element("section", "panel");
  const detailTitle = element("h2");
  detailTitle.textContent = "指南详情";
  detailPanel.append(detailTitle);
  if (selectedGuide === null) {
    const empty = element("p", "summary");
    empty.textContent = "请选择一条指南查看详情";
    detailPanel.append(empty);
  } else {
    const guideTitle = element("strong");
    guideTitle.textContent = selectedGuide.title;
    const summary = element("p", "summary");
    summary.textContent = selectedGuide.summary;
    const body = element("p", "summary");
    body.textContent = selectedGuide.body;
    const meta = element("dl", "meta");
    const version = element("div");
    const versionLabel = element("dt");
    versionLabel.textContent = "版本";
    const versionValue = element("dd");
    versionValue.textContent = `v${selectedGuide.version}`;
    version.append(versionLabel, versionValue);
    const stateRow = element("div");
    const stateLabel = element("dt");
    stateLabel.textContent = "发布状态";
    const stateValue = element("dd");
    stateValue.textContent = selectedGuide.status;
    stateRow.append(stateLabel, stateValue);
    const fileRow = element("div");
    const fileLabel = element("dt");
    fileLabel.textContent = "批准文件引用";
    const fileValue = element("dd");
    fileValue.textContent = selectedGuide.fileRef;
    fileRow.append(fileLabel, fileValue);
    meta.append(version, stateRow, fileRow);
    detailPanel.append(guideTitle, summary, body, meta);
  }

  workspace.append(listPanel, detailPanel);
  main.append(headingRow, workspace);
  shell.append(topbar, main);
  appRoot.append(shell);
}

function renderAuditLogs(): void {
  const mode = currentViewMode();
  const auditStatus = mode === "DENIED" ? "DENIED" : mode === "CONFLICT" ? "CONFLICT" : "READY";
  const view = AuditLogsPage({
    status: auditStatus as Parameters<typeof AuditLogsPage>[0]["status"],
    events: syntheticAuditEvents,
  });
  document.title = view.heading;
  appRoot.replaceChildren();

  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar, " · 只读审计");

  const main = element("main");
  const headingRow = element("div", "heading-row");
  const heading = element("div");
  const title = element("h1");
  title.textContent = view.heading;
  const subtitle = element("p");
  subtitle.textContent = "仅展示当前授权范围内的脱敏模拟元数据";
  heading.append(title, subtitle);
  const status = element("div", "status");
  status.textContent = view.message;
  headingRow.append(heading, status);

  const auditPanel = element("section", "panel");
  const summary = element("p", "summary");
  const syntheticCount = view.rows.filter((row) => row.syntheticData).length;
  summary.textContent = `范围：${syntheticScope.campusName} · ${view.rows.length} 条事件 · ${syntheticCount} 条合成数据`;
  const table = element("table");
  const head = element("thead");
  const headRow = element("tr");
  for (const column of view.columns) {
    const cell = element("th");
    cell.textContent = column;
    headRow.append(cell);
  }
  head.append(headRow);

  const body = element("tbody");
  for (const row of view.rows) {
    const tableRow = element("tr");
    const values = [
      row.occurredAt,
      row.actorReference,
      row.action,
      row.targetReference,
      row.correlationId,
      row.traceId,
      JSON.stringify(row.metadata),
    ];
    for (const value of values) {
      const cell = element("td");
      cell.textContent = value;
      tableRow.append(cell);
    }
    body.append(tableRow);
  }
  table.append(head, body);

  const actions = element("div", "actions");
  const refresh = element("button", "save");
  refresh.type = "button";
  refresh.textContent = view.availableActions[0];
  refresh.addEventListener("click", renderAuditLogs);
  actions.append(refresh);
  auditPanel.append(summary, table, actions);

  main.append(headingRow, auditPanel);
  shell.append(topbar, main);
  appRoot.append(shell);
}

function consentReviewerProfile(value: string | null): ConsentReviewerProfile | null {
  if (value === null || value === "owner-east") return "owner-east";
  return value === "owner-west" ? "owner-west" : null;
}

function privacyReviewerProfile(value: string | null): PrivacyReviewerProfile | null {
  if (value === null || value === "owner-east") return "owner-east";
  return value === "owner-west" ? "owner-west" : null;
}

function privacyReviewerProfilePath(profile: PrivacyReviewerProfile, search: string): string {
  const query = new URLSearchParams({ profile });
  const mode = new URLSearchParams(search).get("mode");
  if (mode !== null) query.set("mode", mode);
  return `/admin/privacy-requests?${query.toString()}`;
}

function renderPrivacyRequestsRoute(): void {
  const canAct = currentViewMode() === "AUTHORIZED";
  const profile = privacyReviewerProfile(
    new URLSearchParams(window.location.search).get("profile"),
  );
  if (profile === null) {
    privacyRequestReviewClient.disconnect();
    renderDenied();
    return;
  }
  if (
    privacyRequestReviewClient.snapshot.profile !== null &&
    privacyRequestReviewClient.snapshot.profile !== profile
  )
    privacyRequestReviewClient.disconnect();
  const connectOperation =
    privacyRequestReviewClient.snapshot.status === "IDLE"
      ? privacyRequestReviewClient.connect(profile)
      : null;

  document.title = "个人信息申请";
  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar, " · 个人信息申请");
  const scope = topbar.querySelector("span");
  if (scope)
    scope.textContent = `${syntheticScope.institutionName} · ${profile === "owner-east" ? "模拟东校区" : "模拟西校区"}`;
  shell.append(topbar);
  shell.insertAdjacentHTML(
    "beforeend",
    renderPrivacyRequestsPage({
      profile,
      rows: privacyRequestReviewClient.snapshot.requests,
      canAct,
      busy:
        privacyRequestReviewClient.snapshot.status === "BUSY" ||
        privacyRequestReviewClient.snapshot.status === "CONNECTING",
      message: privacyRequestReviewClient.snapshot.message,
    }),
  );
  appRoot.replaceChildren(shell);

  appRoot
    .querySelector<HTMLFormElement>("[data-privacy-profile-form]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const selected = appRoot.querySelector<HTMLSelectElement>("#privacy-review-profile")?.value;
      if (selected !== "owner-east" && selected !== "owner-west") return;
      window.history.pushState(
        {},
        "",
        privacyReviewerProfilePath(selected, window.location.search),
      );
      privacyRequestReviewClient.disconnect();
      render();
    });
  appRoot
    .querySelector<HTMLButtonElement>("[data-privacy-refresh]")
    ?.addEventListener("click", () => {
      const operation = privacyRequestReviewClient.refresh();
      renderPrivacyRequestsRoute();
      void operation.then(() => {
        if (window.location.pathname === "/admin/privacy-requests") renderPrivacyRequestsRoute();
      });
    });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-privacy-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canAct) return;
      const action = button.dataset.privacyAction;
      const index = Number(button.dataset.privacyIndex);
      if (
        (action !== "START" && action !== "COMPLETE") ||
        !Number.isSafeInteger(index) ||
        index < 0
      )
        return;
      const operation = privacyRequestReviewClient.review(index, action as PrivacyReviewAction);
      renderPrivacyRequestsRoute();
      void operation.then(() => {
        if (window.location.pathname === "/admin/privacy-requests") renderPrivacyRequestsRoute();
      });
    });
  });
  if (connectOperation) {
    void connectOperation.then(() => {
      if (window.location.pathname === "/admin/privacy-requests") renderPrivacyRequestsRoute();
    });
  }
}

function renderConsentReviewRoute(): void {
  const canReview = currentViewMode() === "AUTHORIZED";
  const profile = consentReviewerProfile(
    new URLSearchParams(window.location.search).get("profile"),
  );
  if (profile === null) {
    consentReviewConfirmed = false;
    consentReviewClient.disconnect();
    renderDenied();
    return;
  }
  if (
    consentReviewClient.snapshot.profile !== null &&
    consentReviewClient.snapshot.profile !== profile
  ) {
    consentReviewClient.disconnect();
    consentReviewConfirmed = false;
  }
  const connectOperation =
    consentReviewClient.snapshot.status === "IDLE" ? consentReviewClient.connect(profile) : null;

  document.title = "数据授权与期限复核";
  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar, " · 数据授权复核");
  const scopeLabel = topbar.querySelector("span");
  if (scopeLabel)
    scopeLabel.textContent = `${syntheticScope.institutionName} · ${profile === "owner-east" ? "模拟东校区" : "模拟西校区"}`;
  shell.append(topbar);
  shell.insertAdjacentHTML(
    "beforeend",
    renderConsentReviewPage({
      ...consentReviewClient.snapshot,
      confirmed: consentReviewConfirmed,
      canReview,
    }),
  );
  appRoot.replaceChildren(shell);

  appRoot
    .querySelector<HTMLFormElement>("[data-consent-profile-form]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const selected = appRoot.querySelector<HTMLSelectElement>("#consent-review-profile")?.value;
      if (selected !== "owner-east" && selected !== "owner-west") return;
      consentReviewConfirmed = false;
      window.history.pushState({}, "", consentReviewProfilePath(selected, window.location.search));
      consentReviewClient.disconnect();
      render();
    });
  appRoot
    .querySelector<HTMLInputElement>("[data-consent-review-confirm]")
    ?.addEventListener("change", (event) => {
      if (!canReview) return;
      consentReviewConfirmed = (event.currentTarget as HTMLInputElement).checked;
      renderConsentReviewRoute();
    });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-consent-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canReview || !consentReviewConfirmed) return;
      const action = button.dataset.consentAction;
      const index = Number(button.dataset.consentIndex);
      if (
        (action !== "REQUIRED_HOLD" && action !== "SIMULATE_EXPIRY") ||
        !Number.isSafeInteger(index)
      )
        return;
      const operation = consentReviewClient.review(index, action as ConsentReviewAction, true);
      renderConsentReviewRoute();
      void operation.then(() => {
        if (window.location.pathname === "/admin/consent-review") renderConsentReviewRoute();
      });
    });
  });
  if (connectOperation) {
    void connectOperation.then(() => {
      if (window.location.pathname === "/admin/consent-review") renderConsentReviewRoute();
    });
  }
}

async function runOperationalStatistics(operation: Promise<void>): Promise<void> {
  renderAdminStatisticsPage();
  await operation;
  if (window.location.pathname === "/admin/statistics") renderAdminStatisticsPage();
}

function renderAdminStatisticsPage(): void {
  const snapshot = operationalStatisticsAdminClient.snapshot;
  const params = new URLSearchParams(window.location.search);
  const profileFromUrl = params.get("profile") ?? "owner-east";
  document.title = "同芯学园 · 运营统计";
  renderAdminMarkup(renderAdminStatistics(snapshot));

  const returnLink = appRoot.querySelector<HTMLAnchorElement>('a[href^="/admin/institution"]');
  if (returnLink) {
    const url = new URL(returnLink.href);
    for (const key of ["localServicePort", "mediaServicePort"]) {
      const value = params.get(key);
      if (value !== null) url.searchParams.set(key, value);
    }
    returnLink.href = `${url.pathname}${url.search}`;
  }

  appRoot
    .querySelector<HTMLFormElement>("[data-statistics-profile-form]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (currentViewMode() === "DENIED") return;
      const profile = new FormData(event.currentTarget as HTMLFormElement).get("profile");
      if (!isOperationalStatisticsProfile(profile)) return;
      const url = new URL(window.location.href);
      url.searchParams.set("profile", profile);
      window.history.replaceState({}, "", url);
      void runOperationalStatistics(operationalStatisticsAdminClient.connect(profile));
    });
  appRoot
    .querySelector<HTMLFormElement>("[data-statistics-filter]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (currentViewMode() === "DENIED") return;
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const classId = String(data.get("classId") ?? "");
      void runOperationalStatistics(
        operationalStatisticsAdminClient.applyFilters({
          from: String(data.get("from") ?? ""),
          to: String(data.get("to") ?? ""),
          ...(classId ? { classId } : {}),
        }),
      );
    });
  appRoot
    .querySelector<HTMLButtonElement>("[data-statistics-refresh]")
    ?.addEventListener("click", () => {
      void runOperationalStatistics(operationalStatisticsAdminClient.refresh());
    });
  appRoot
    .querySelector<HTMLButtonElement>("[data-statistics-reconnect]")
    ?.addEventListener("click", () => {
      const profile = operationalStatisticsAdminClient.snapshot.profile;
      if (profile) void runOperationalStatistics(operationalStatisticsAdminClient.connect(profile));
    });

  if (
    currentViewMode() !== "DENIED" &&
    isOperationalStatisticsProfile(profileFromUrl) &&
    snapshot.profile !== profileFromUrl &&
    !["CONNECTING", "BUSY"].includes(snapshot.status)
  )
    void runOperationalStatistics(operationalStatisticsAdminClient.connect(profileFromUrl));
}

async function runLearningSafety(operation: Promise<void>): Promise<void> {
  renderLearningSafetyPage();
  await operation;
  if (window.location.pathname === "/admin/learning-safety") renderLearningSafetyPage();
}

function renderLearningSafetyPage(): void {
  document.title = "同芯学园 · 学习安全汇总";
  const requestedProfile = new URLSearchParams(window.location.search).get("profile");
  const allowed = currentViewMode() !== "DENIED" && requestedProfile === "platform-admin";
  renderAdminMarkup(renderLearningSafety(
    allowed
      ? learningSafetyAdminClient.snapshot
      : {
          status: "DENIED",
          message: "当前示例身份无权查看平台匿名安全汇总。",
          summary: null,
        },
  ));
}

function renderAdminLeaveReviewRoute(): void {
  document.title = "请假审核";
  const profile = new URLSearchParams(window.location.search).get("profile");
  if (profile !== null && profile !== "owner-east") {
    renderAdminMarkup(renderAdminLeaveReviewPage(
      {
        status: "DENIED",
        profile: null,
        records: [],
        message: "请假明细仅向当前校区负责人开放；其他身份看不到申请内容。",
      },
      false,
    ));
    return;
  }
  const connection =
    adminLeaveReviewClient.snapshot.status === "IDLE" ? adminLeaveReviewClient.connect() : null;
  const snapshot = adminLeaveReviewClient.snapshot;
  const canReview = currentViewMode() === "AUTHORIZED";
  renderAdminMarkup(renderAdminLeaveReviewPage(snapshot, canReview));
  appRoot
    .querySelector<HTMLButtonElement>("[data-admin-leave-refresh]")
    ?.addEventListener("click", () => {
      const operation =
        adminLeaveReviewClient.snapshot.status === "READY"
          ? adminLeaveReviewClient.refresh()
          : adminLeaveReviewClient.connect();
      renderAdminLeaveReviewRoute();
      void operation.then(() => {
        if (window.location.pathname === "/admin/leave-review") renderAdminLeaveReviewRoute();
      });
    });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-admin-leave-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canReview || currentViewMode() !== "AUTHORIZED") return;
      const decision = button.dataset.decision;
      const id = button.dataset.adminLeaveId;
      const version = Number(button.dataset.version);
      if (
        (decision !== "CONFIRM" && decision !== "RETURN") ||
        !id ||
        !Number.isSafeInteger(version)
      )
        return;
      const operation = adminLeaveReviewClient.review(id, version, decision as AdminLeaveDecision);
      renderAdminLeaveReviewRoute();
      void operation.then(() => {
        if (window.location.pathname === "/admin/leave-review") renderAdminLeaveReviewRoute();
      });
    });
  });
  if (connection) {
    void connection.then(() => {
      if (window.location.pathname === "/admin/leave-review") renderAdminLeaveReviewRoute();
    });
  }
}

function renderAdminCareRecordReview(): void {
  const snapshot = adminCareRecordClient.snapshot;
  const actor = snapshot.actor
    ? {
        role: "INSTITUTION_REVIEWER",
        status: "ACTIVE",
        tenantId: snapshot.actor.tenantId,
        authorizedCampusIds: [snapshot.actor.campusId],
        authorizedClassIds: snapshot.actor.classIds,
      }
    : null;
  const view = projectCareRecordAdminView({
    actor,
    records: snapshot.records,
  });
  document.title = "成长记录审核";
  appRoot.replaceChildren(
    document
      .createRange()
      .createContextualFragment(
        renderCareRecordReview(
          view,
          "INSTITUTION_REVIEWER",
          snapshot.message,
          adminCareRecordProfile,
        ),
      ),
  );
  ensureAdminNavigation();
  appRoot
    .querySelector<HTMLSelectElement>("#admin-care-record-profile")
    ?.addEventListener("change", (event) => {
      const profile = (event.currentTarget as HTMLSelectElement).value;
      if (profile !== "owner-east" && profile !== "owner-west") return;
      adminCareRecordProfile = profile;
      run(adminCareRecordClient.connect(profile));
    });
  appRoot
    .querySelector<HTMLButtonElement>("[data-admin-care-record-refresh]")
    ?.addEventListener("click", () => run(adminCareRecordClient.refresh()));
  appRoot
    .querySelectorAll<HTMLButtonElement>("[data-admin-care-record-action]")
    .forEach((button) => {
      button.disabled = snapshot.status === "BUSY" || snapshot.status === "CONNECTING";
      button.addEventListener("click", () => {
        const action = button.dataset.adminCareRecordAction;
        const id = button.dataset.adminCareRecordId ?? "";
        const version = Number(button.dataset.adminCareRecordVersion);
        if (!id || !Number.isSafeInteger(version)) return;
        const operation =
          action === "CONFIRM"
            ? adminCareRecordClient.review(id, version, "CONFIRM")
            : action === "RETURN"
              ? adminCareRecordClient.review(id, version, "RETURN")
              : action === "PUBLISH"
                ? adminCareRecordClient.publish(id, version)
                : action === "REVOKE"
                  ? adminCareRecordClient.revoke(id, version)
                  : null;
        if (operation) run(operation);
      });
    });

  function run(operation: Promise<void>): void {
    renderAdminCareRecordReview();
    void operation.then(() => {
      if (window.location.pathname !== CARE_RECORD_REVIEW_ROUTE) return;
      renderAdminCareRecordReview();
      appRoot
        .querySelector<HTMLElement>("#admin-care-record-notice")
        ?.focus({ preventScroll: true });
    });
  }

  if (snapshot.status === "IDLE") run(adminCareRecordClient.connect(adminCareRecordProfile));
}

function pickupReviewProfileFromLocation(): PickupReviewProfile {
  const profile = new URLSearchParams(window.location.search).get("profile");
  return profile === "teacher-east" || profile === "platform-admin" ? profile : "owner-east";
}

function runPickupReview(operation: Promise<void>): void {
  renderAdminPickupReviewPage();
  void operation.then(() => {
    if (window.location.pathname !== "/admin/pickup-review") return;
    renderAdminPickupReviewPage();
    appRoot.querySelector<HTMLElement>("[data-pickup-message]")?.focus({ preventScroll: true });
  });
}

function renderAdminPickupReviewPage(): void {
  const snapshot = pickupReviewClient.snapshot;
  document.title = "接送异常处理 · 机构管理工作台";
  const shell = element("div", "shell");
  const topbar = element("header", "topbar");
  appendTopbar(topbar, " · 接送异常处理");
  const content = element("main", "content");
  content.innerHTML = renderPickupReview(snapshot, currentViewMode() === "AUTHORIZED");
  shell.append(topbar, content);
  appRoot.replaceChildren(shell);

  appRoot
    .querySelector<HTMLSelectElement>("[data-pickup-profile]")
    ?.addEventListener("change", (event) => {
      const profile = (event.currentTarget as HTMLSelectElement).value;
      if (profile !== "owner-east" && profile !== "teacher-east" && profile !== "platform-admin")
        return;
      const url = new URL(window.location.href);
      url.searchParams.set("profile", profile);
      window.history.replaceState({}, "", url);
      runPickupReview(pickupReviewClient.connect(profile));
    });
  appRoot
    .querySelector<HTMLButtonElement>("[data-pickup-refresh]")
    ?.addEventListener("click", () => {
      if (currentViewMode() === "AUTHORIZED") runPickupReview(pickupReviewClient.refresh());
    });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-pickup-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (currentViewMode() !== "AUTHORIZED") return;
      const action = button.dataset.pickupAction;
      const id = button.dataset.pickupId;
      const version = Number(button.dataset.pickupVersion);
      if ((action !== "follow" && action !== "resolve") || !id || !Number.isSafeInteger(version))
        return;
      runPickupReview(pickupReviewClient.review(id, version, action));
    });
  });
  if (snapshot.status === "IDLE")
    runPickupReview(pickupReviewClient.connect(pickupReviewProfileFromLocation()));
}
function render(): void {
  const path = window.location.pathname;
  const leaveProfile = new URLSearchParams(window.location.search).get("profile");
  if (
    path !== "/admin/leave-review" ||
    currentViewMode() === "DENIED" ||
    (leaveProfile !== null && leaveProfile !== "owner-east")
  )
    adminLeaveReviewClient.disconnect();
  if (path !== "/admin/pickup-review" || currentViewMode() === "DENIED")
    pickupReviewClient.disconnect();
  if (path !== CARE_RECORD_REVIEW_ROUTE) adminCareRecordClient.disconnect();
  if (path !== NOTICE_REVIEW_ROUTE || currentViewMode() === "DENIED") {
    noticeReviewGeneration += 1;
    noticeReviewClient?.disconnect();
  }
  if (path !== SUPPLY_REQUEST_REVIEW_ROUTE) {
    supplyRequestReviewGeneration += 1;
    supplyRequestReviewClient.disconnect();
  }
  if (path !== "/admin/learning-safety") learningSafetyAdminClient.disconnect();
  if (path !== "/admin/resources" || !sharedResourceReview())
    resourceLibraryAdminClient.disconnect();
  if (path !== "/admin/statistics") operationalStatisticsAdminClient.disconnect();
  const healthReviewRoute =
    path === "/admin/institution" && window.location.hash === "#health-review";
  if (!healthReviewRoute) healthReviewRenderGeneration += 1;
  if (path !== "/admin/consent-review") {
    consentReviewConfirmed = false;
    consentReviewClient.disconnect();
  }
  if (path !== "/admin/privacy-requests") privacyRequestReviewClient.disconnect();
  if (path !== "/admin/binding-review") {
    bindingReviewConfirmed = false;
    bindingReviewClient.disconnect();
  }
  const mode = currentViewMode();
  if ((path !== "/admin/fees" && path !== "/admin/platform-operations") || mode === "DENIED")
    adminFeesClient.disconnect();
  if ((path !== "/admin/staff" && path !== "/admin/staff-accounts") || mode === "DENIED")
    membershipManagementClient.disconnect();
  if (path !== "/admin/files" || mode === "DENIED") mediaAssetsAdminClient.disconnect();
  if (path === "/admin/statistics") {
    if (mode === "DENIED") {
      operationalStatisticsAdminClient.disconnect();
      renderDenied();
      return;
    }
    renderAdminStatisticsPage();
    return;
  }
  if (path === "/admin/learning-safety") {
    operationalStatisticsAdminClient.disconnect();
    resourceLibraryAdminClient.disconnect();
    renderLearningSafetyPage();
    const requestedProfile = new URLSearchParams(window.location.search).get("profile");
    if (
      currentViewMode() !== "DENIED" &&
      requestedProfile === "platform-admin" &&
      ["IDLE", "DISCONNECTED"].includes(learningSafetyAdminClient.snapshot.status)
    )
      void runLearningSafety(learningSafetyAdminClient.connect());
    return;
  }
  if (mode === "DENIED" && path !== "/admin/audit-logs") {
    renderDenied();
    return;
  }
  if (path === "/admin/leave-review") {
    renderAdminLeaveReviewRoute();
    return;
  }
  if (path === CARE_RECORD_REVIEW_ROUTE) {
    renderAdminCareRecordReview();
    return;
  }
  if (path === NOTICE_REVIEW_ROUTE) {
    void renderAdminNoticeReviewPage();
    return;
  }
  if (path === SUPPLY_REQUEST_REVIEW_ROUTE) {
    void renderSupplyRequestReviewPage();
    return;
  }
  if (healthReviewRoute) {
    void renderHealthIncidentReviewPage();
    return;
  }
  if (path === "/admin/consent-review") {
    renderConsentReviewRoute();
    return;
  }
  if (path === "/admin/privacy-requests") {
    renderPrivacyRequestsRoute();
    return;
  }
  if (path === "/admin/binding-review") {
    renderAdminBindingReviewRoute();
    return;
  }
  if (path === "/admin/pickup-review") {
    renderAdminPickupReviewPage();
    return;
  }
  if (path === "/admin/fees") {
    renderAdminFeesRoute();
    return;
  }
  if (path === "/admin/resources" && sharedResourceReview()) {
    renderSharedResources();
    return;
  }
  if (path === "/admin" || path === "/admin/dashboard" || path === "/admin/institution") {
    renderInstitutionOverview();
    return;
  }
  if (
    path === "/admin/home-content" ||
    path === "/admin/institution/home" ||
    path === "/admin/publishing"
  ) {
    renderHomeContent();
    return;
  }
  if (path === "/admin/guides" || path === "/admin/staff-guides") {
    renderStaffGuides();
    return;
  }
  if (
    path === "/admin/resources" ||
    path === "/admin/partner-cloud" ||
    path === "/admin/staff-resources"
  ) {
    renderStaffResources();
    return;
  }
  if (path === "/admin/activities") {
    renderActivities();
    return;
  }
  if (path === "/admin/staff" || path === "/admin/staff-accounts") {
    renderStaffAccounts();
    return;
  }
  if (path === "/admin/platform-operations") {
    renderPlatformOperations();
    return;
  }
  if (path === "/admin/files") {
    renderFiles();
    return;
  }
  if (window.location.pathname === "/admin/audit-logs") {
    renderAuditLogs();
    return;
  }
  if (window.location.pathname === "/admin/meals") {
    renderMeals();
    return;
  }
  if (window.location.pathname === "/admin/public-teachers") {
    renderPublicTeachers();
    return;
  }
  renderHomeContent();
}

window.addEventListener("popstate", render);
window.addEventListener("hashchange", render);
window.addEventListener("pagehide", () => {
  pickupReviewClient.disconnect();
  supplyRequestReviewClient.disconnect();
  adminMealsClient.disconnect();
  operationalStatisticsAdminClient.disconnect();
  resourceLibraryAdminClient.disconnect();
  learningSafetyAdminClient.disconnect();
});
render();
