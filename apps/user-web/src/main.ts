import {
  createSyntheticVisitorResponse,
  selectVisitorRoute,
  type VisitorRoute,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./routes/visitor.routes.js";
import { PublicMealsClient } from "./local-synthetic/public-meals.js";
// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import type { PublicMealPageState } from "./pages/visitor-content.js";
import {
  renderVisitorContactIntent,
  type VisitorContactIntentState,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./pages/visitor-home.js";
import {
  ParentConsentClient,
  renderParentConsentPage,
  type ConsentPurposeKey,
  type ParentPrivacyRequestType,
} from "./pages/parent-consent.js";
import { ParentFeesClient, renderParentFeesPage } from "./pages/parent-fees.js";
import {
  HealthIncidentClient,
  renderHealthIncidentPanel,
  type HealthIncidentAction,
} from "./local-synthetic/health-incident.js";
import {
  StaffTaskClient,
  renderStaffTaskPanel,
  type StaffTaskCommand,
} from "./local-synthetic/task-assignment.js";
import {
  StaffDailyClient,
  renderStaffDailyPanel,
  staffDailyFormValues,
} from "./local-synthetic/staff-daily.js";
import {
  MonthlyFeedbackClient,
  type MonthlyFeedbackAction,
  type MonthlyFeedbackFormAction,
} from "./local-synthetic/monthly-feedback-client.js";
import {
  monthlyFeedbackFormValues,
  renderMonthlyFeedbackPanel,
} from "./local-synthetic/monthly-feedback.js";
import {
  renderSupplyPanel,
  SupplyRequestClient,
  supplyRequestFormValues,
  type SupplyRequestAction,
} from "./local-synthetic/supply-request.js";
import {
  selectStaffRoute,
  type StaffAccess,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./routes/staff.routes.js";
import {
  projectStaffReport,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./pages/staff-report.js";
import {
  batchReviewStaffLeaveRequests,
  createSyntheticStaffLeaveState,
  projectStaffLeaveReview,
  reviewStaffLeaveRequest,
  type WebLeaveDecision,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./pages/staff-leave-review.js";
import {
  renderCareRecordStaffPanel,
  renderSharedParentCareRecordPanel,
  type CareRecordValues,
} from "./pages/care-record-workflow.js";
import { CareRecordClient, createCareRecordState } from "./local-synthetic/care-record-client.js";
import {
  projectStaffWorkbench,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./pages/staff-workbench.js";
import {
  StaffGuidesPage,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./pages/staff-guides.js";
import {
  TeachingResourcesPage,
  type ResourceCategory,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./pages/resources.js";
import {
  PartnerLinkPage,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./pages/partner-link.js";
import {
  isResourceLibraryProfile,
  ResourceLibraryClient,
  renderResourceLibraryPage,
  type ResourceLibraryFilters,
} from "./local-synthetic/resource-library.js";
import { ParentLearningClient } from "./local-synthetic/learning.js";
import { renderParentLearningPage } from "./pages/parent-learning.js";
import {
  ParentPickupClient,
  renderParentPickupPanel,
  type ParentPickupInput,
} from "./local-synthetic/parent-pickup.js";
import {
  ParentNoticeClient,
  renderParentNoticesPanel,
  type ParentNoticeAction,
} from "./local-synthetic/parent-notices.js";

const root = document.querySelector<HTMLElement>("[data-app-root]");

if (root === null) {
  throw new Error("User-web application root is missing");
}
const appRoot = root;
const parentConsentClient = new ParentConsentClient({
  baseUrl: window.location.origin,
});
const parentFeesClient = new ParentFeesClient();
const parentPickupClient = new ParentPickupClient({ baseUrl: window.location.origin });
const parentNoticeClient = new ParentNoticeClient({ baseUrl: window.location.origin });
const teacherHealthIncidentClient = new HealthIncidentClient("teacher");
const parentHealthIncidentClient = new HealthIncidentClient("parent");
const staffTaskClient = new StaffTaskClient();
const staffDailyClient = new StaffDailyClient();
const teacherMonthlyFeedbackClient = new MonthlyFeedbackClient("teacher-east");
const parentMonthlyFeedbackClient = new MonthlyFeedbackClient("parent-alpha");
const supplyRequestClient = new SupplyRequestClient();
const resourceLibraryClient = new ResourceLibraryClient();
const parentLearningClient = new ParentLearningClient();
const teacherCareRecordClient = new CareRecordClient({ baseUrl: window.location.origin });
const parentCareRecordClient = new CareRecordClient({ baseUrl: window.location.origin });
let syntheticStaffLeaveState = createSyntheticStaffLeaveState();
let staffLeaveNotice = "请假申请仅保存在当前网页合成演示中。";
let careRecordState = createCareRecordState([]);
let careRecordValues: CareRecordValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};
let staffDailyConnectOperation: Promise<void> | null = null;
const sharedResourceMode = () =>
  new URLSearchParams(window.location.search).get("mode") === "shared";
const isLearningPath = (path = window.location.pathname) =>
  path === "/web/parent/learning" || path === "/staff/learning";
const learningProfileForLocation = () => {
  const profile = new URLSearchParams(window.location.search).get("profile");
  if (window.location.pathname === "/web/parent/learning" && profile === "parent-alpha")
    return "parent-alpha" as const;
  if (window.location.pathname === "/staff/learning" && profile === "teacher-east")
    return "teacher-east" as const;
  return null;
};

function renderParentLearning(): void {
  document.title = "陪伴式学习 | 同芯学园";
  appRoot.innerHTML = renderParentLearningPage(parentLearningClient.snapshot);
}

async function parentLearningOperation(run: () => Promise<unknown>): Promise<void> {
  const work = run();
  renderParentLearning();
  await work;
  if (isLearningPath()) renderParentLearning();
  appRoot.querySelector<HTMLElement>("[data-learning-status]")?.focus();
}

async function runResourceLibraryOperation(operation: Promise<void>): Promise<void> {
  render();
  await operation;
  if (window.location.pathname === "/web/staff/resources" && sharedResourceMode()) {
    render();
    appRoot.querySelector<HTMLElement>("[data-resource-status]")?.focus({ preventScroll: true });
  }
}

const STAFF_GUIDE_CATEGORIES = ["ORIENTATION", "POLICY", "SAFETY"] as const;
const RESOURCE_CATEGORIES: readonly ResourceCategory[] = [
  "LESSON",
  "EXERCISE",
  "READING",
  "REFERENCE",
  "WORKSHEET",
];

const response = createSyntheticVisitorResponse();
const publicMealsClient = new PublicMealsClient({ baseUrl: window.location.origin });
let publicMealsState: PublicMealPageState | undefined;
let publicMealsRequestKey: string | null = null;
let publicMealsRequestGeneration = 0;
const syntheticStaffAccess: StaffAccess = {
  session: "synthetic-staff-session",
  membership: "active",
  role: "teacher",
  capabilities: [
    "employee:workbench",
    "teacher:summary",
    "employee:partner-cloud",
    "teacher:leave-review",
  ],
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-east",
  classIds: ["class-synthetic-grade3-a"],
  scopeTenantId: "tenant-synthetic-a",
  scopeCampusId: "campus-synthetic-east",
};

const syntheticStaffResources = [
  {
    id: "guide-synthetic-1",
    tenantId: syntheticStaffAccess.tenantId,
    campusId: syntheticStaffAccess.campusId,
    status: "published" as const,
    title: "模拟数据：今日带班指南",
    summary: "仅展示当前校区的工作提示。",
    kind: "guide" as const,
  },
];

function render(): void {
  const path = window.location.pathname;
  updatePublicMeals(path);
  if (path !== "/web/parent/home") parentPickupClient.disconnect();
  if (path !== "/web/parent/home") parentNoticeClient.disconnect();
  if (path !== "/staff/workbench") supplyRequestClient.disconnect();
  if (!isLearningPath(path)) parentLearningClient.disconnect();
  if (isLearningPath(path)) {
    renderParentLearning();
    const profile = learningProfileForLocation();
    if (profile && parentLearningClient.snapshot.profile !== profile)
      void parentLearningOperation(() => parentLearningClient.connect(profile));
    else if (profile && parentLearningClient.snapshot.status === "IDLE")
      void parentLearningOperation(() => parentLearningClient.connect(profile));
    return;
  }
  if (path !== "/web/staff/resources" || !sharedResourceMode()) resourceLibraryClient.disconnect();
  if (window.location.pathname !== "/staff/report") teacherHealthIncidentClient.disconnect();
  if (window.location.pathname !== "/web/parent/home") parentHealthIncidentClient.disconnect();
  if (window.location.pathname !== "/staff/report") teacherMonthlyFeedbackClient.disconnect();
  if (window.location.pathname !== "/web/parent/home") parentMonthlyFeedbackClient.disconnect();
  if (window.location.pathname !== "/staff/report") teacherCareRecordClient.disconnect();
  if (window.location.pathname !== "/web/parent/home") parentCareRecordClient.disconnect();
  if (window.location.pathname === "/web/parent/binding") {
    parentFeesClient.disconnect();
    renderParentConsentRoute();
    return;
  }
  if (window.location.pathname === "/web/parent/home") {
    parentConsentClient.disconnect();
    renderParentFeesRoute();
    return;
  }
  if (window.location.pathname === "/staff/report") {
    renderStaffHealthRoute();
    return;
  }
  parentConsentClient.disconnect();
  parentFeesClient.disconnect();
  if (path === "/web/staff/resources" && sharedResourceMode()) {
    document.title = "教学资源 | 同芯学园";
    appRoot.innerHTML = renderResourceLibraryPage(resourceLibraryClient.snapshot);
    const profile = new URLSearchParams(window.location.search).get("profile");
    const snapshot = resourceLibraryClient.snapshot;
    if (
      isResourceLibraryProfile(profile) &&
      snapshot.profile !== profile &&
      !["CONNECTING", "BUSY"].includes(snapshot.status)
    )
      void runResourceLibraryOperation(resourceLibraryClient.connect(profile));
    return;
  }
  const internalPage = renderInternalPage(window.location.pathname);
  if (internalPage !== null) {
    appRoot.replaceChildren(document.createRange().createContextualFragment(internalPage));
    if (path === "/staff/workbench")
      appRoot
        .querySelector<HTMLElement>("main")
        ?.insertAdjacentHTML(
          "beforeend",
          '<section class="learning-entry"><h2>教师学习服务</h2><p>查看负责班级的合成学习摘要，并在需要时由教师接手。</p><a class="button button-primary" href="/staff/learning?profile=teacher-east">进入学习空间</a></section>',
        );
    if (path === "/staff/workbench")
      appRoot
        .querySelector<HTMLElement>("main")
        ?.insertAdjacentHTML(
          "beforeend",
          '<section class="learning-entry"><h2>家长申请</h2><p>查看当前模拟校区与班级的固定选项请假申请。</p><a class="button button-primary" href="/staff/report?view=leave-review">打开请假审核</a></section>',
        );
    setupRevealAnimations();
    if (window.location.pathname === "/staff/workbench") {
      setupStaffTaskWorkbench();
      setupSupplyRequestPanel();
    }
    return;
  }

  const route = selectVisitorRoute({
    path: window.location.pathname,
    response,
    ...(publicMealsState === undefined ? {} : { publicMeals: publicMealsState }),
  });
  appRoot.replaceChildren(document.createRange().createContextualFragment(renderShell(route)));
  setupRevealAnimations();
}

function localCalendarDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function updatePublicMeals(path: string): void {
  const mealPage = path === "/visitor/content/meal-plan";
  if (!mealPage) {
    if (publicMealsRequestKey !== null) publicMealsRequestGeneration += 1;
    publicMealsRequestKey = null;
    publicMealsState = undefined;
    return;
  }
  const date = localCalendarDate();
  if (publicMealsRequestKey === date && publicMealsState !== undefined) return;
  publicMealsRequestKey = date;
  const generation = ++publicMealsRequestGeneration;
  publicMealsState = { status: "LOADING", date, meals: [] };
  void publicMealsClient
    .forDate(date)
    .then((meals) => {
      if (
        generation !== publicMealsRequestGeneration ||
        window.location.pathname !== "/visitor/content/meal-plan"
      )
        return;
      publicMealsState = { status: "READY", date, meals };
      render();
    })
    .catch(() => {
      if (
        generation !== publicMealsRequestGeneration ||
        window.location.pathname !== "/visitor/content/meal-plan"
      )
        return;
      publicMealsState = { status: "ERROR", date, meals: [] };
      render();
    });
}

function renderParentFeesRoute(): void {
  const connectOperation =
    parentFeesClient.snapshot.status === "IDLE" ? parentFeesClient.connect() : null;
  const pickupConnectOperation =
    parentPickupClient.snapshot.status === "IDLE" ? parentPickupClient.connect() : null;
  const healthConnectOperation =
    parentHealthIncidentClient.snapshot.status === "IDLE"
      ? parentHealthIncidentClient.connect()
      : null;
  const noticeConnectOperation =
    parentNoticeClient.snapshot.status === "IDLE" ? parentNoticeClient.connect() : null;
  const content = `
    <header class="site-header internal-header">
      <div class="site-header-inner">
        <a class="brand" href="/visitor" aria-label="同芯学园首页">
          <img class="brand-logo" src="/assets/tongxin-logo.png" alt="同芯学园" />
        </a>
        <span class="header-action internal-badge">家长端</span>
      </div>
    </header>
    ${renderParentFeesPage(parentFeesClient.snapshot)}
    ${renderHealthIncidentPanel(parentHealthIncidentClient.snapshot)}
    <footer class="site-footer"><div class="site-footer-inner"><p>仅展示本机合成费用资料，不连接真实支付或机构服务。</p></div></footer>
  `;
  appRoot.replaceChildren(document.createRange().createContextualFragment(content));
  appRoot
    .querySelector<HTMLElement>(".visitor-content-page")
    ?.insertAdjacentHTML(
      "beforeend",
      '<section class="learning-entry"><h2>陪伴式学习</h2><p>由成人陪伴完成固定题目和分层提示练习。</p><a class="button button-primary" href="/web/parent/learning?profile=parent-alpha">进入学习空间</a></section>',
    );
  setupRevealAnimations();
  setupMonthlyFeedbackPanel(
    parentMonthlyFeedbackClient,
    appRoot.querySelector<HTMLElement>("main") ?? appRoot,
    "/web/parent/home",
  );
  setupHealthIncidentPanel(
    parentHealthIncidentClient,
    renderParentFeesRoute,
    () => window.location.pathname === "/web/parent/home",
  );
  setupParentPickupPanel();
  setupParentNoticePanel();

  const run = (operation: Promise<void>) => {
    renderParentFeesRoute();
    void operation.then(() => {
      if (window.location.pathname === "/web/parent/home") renderParentFeesRoute();
    });
  };
  appRoot
    .querySelector<HTMLButtonElement>("[data-parent-fees-refresh]")
    ?.addEventListener("click", () => {
      run(parentFeesClient.refresh());
    });
  appRoot
    .querySelector<HTMLButtonElement>("[data-parent-fees-reconnect]")
    ?.addEventListener("click", () => {
      run(parentFeesClient.connect());
    });
  setupParentCareRecordPanel();
  if (connectOperation) {
    void connectOperation.then(() => {
      if (window.location.pathname === "/web/parent/home") renderParentFeesRoute();
    });
  }
  if (healthConnectOperation) {
    void healthConnectOperation.then(() => {
      if (window.location.pathname === "/web/parent/home") renderParentFeesRoute();
    });
  }
  if (pickupConnectOperation) {
    void pickupConnectOperation.then(() => {
      if (window.location.pathname === "/web/parent/home") renderParentFeesRoute();
    });
  }
  if (noticeConnectOperation) {
    void noticeConnectOperation.then(() => {
      if (window.location.pathname === "/web/parent/home") renderParentFeesRoute();
    });
  }
}

function renderStaffHealthRoute(): void {
  if (new URLSearchParams(window.location.search).get("view") === "leave-review") {
    teacherHealthIncidentClient.disconnect();
    teacherMonthlyFeedbackClient.disconnect();
    const reviewPage = renderInternalPage("/staff/leave-review");
    if (reviewPage === null) return;
    appRoot.replaceChildren(document.createRange().createContextualFragment(reviewPage));
    setupRevealAnimations();
    setupStaffLeaveReview();
    return;
  }
  const connectOperation =
    teacherHealthIncidentClient.snapshot.status === "IDLE"
      ? teacherHealthIncidentClient.connect()
      : null;
  const page = renderInternalPage("/staff/report");
  if (page === null) return;
  appRoot.replaceChildren(document.createRange().createContextualFragment(page));
  setupRevealAnimations();
  setupHealthIncidentPanel(
    teacherHealthIncidentClient,
    renderStaffHealthRoute,
    () => window.location.pathname === "/staff/report",
  );
  setupStaffDailyPanel();
  setupMonthlyFeedbackPanel(
    teacherMonthlyFeedbackClient,
    appRoot.querySelector<HTMLElement>("main") ?? appRoot,
    "/staff/report",
  );
  setupStaffCareRecordPanel();
  if (connectOperation) {
    void connectOperation.then(() => {
      if (window.location.pathname === "/staff/report") renderStaffHealthRoute();
    });
  }
}

function setupStaffLeaveReview(): void {
  appRoot.querySelectorAll<HTMLButtonElement>("[data-leave-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const decision = button.dataset.decision;
      const requestId = button.dataset.leaveId;
      const version = Number(button.dataset.version);
      if (
        (decision !== "CONFIRM" && decision !== "RETURN") ||
        !requestId ||
        !Number.isSafeInteger(version)
      )
        return;
      const result = reviewStaffLeaveRequest(syntheticStaffLeaveState, syntheticStaffAccess, {
        requestId,
        version,
        decision: decision as WebLeaveDecision,
      });
      syntheticStaffLeaveState = result.state;
      staffLeaveNotice = result.ok
        ? "申请已在当前网页合成演示中处理，没有发送真实通知。"
        : result.error === "OUT_OF_SCOPE"
          ? "申请不属于当前租户、校区和班级范围，记录未变化。"
          : result.error === "STALE"
            ? "申请版本已经变化，请重新查看后操作。"
            : "当前模拟员工身份或申请状态不允许此操作。";
      render();
      appRoot.querySelector<HTMLElement>("#staff-leave-review-heading")?.focus();
    });
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-leave-batch]").forEach((button) => {
    button.addEventListener("click", () => {
      const decision = button.dataset.leaveBatch;
      if (decision !== "CONFIRM" && decision !== "RETURN") return;
      const selected = Array.from(
        appRoot.querySelectorAll<HTMLInputElement>('[name="leave-review-selection"]:checked'),
      );
      const commands = selected.map((input) => {
        const request = syntheticStaffLeaveState.requests.find((item) => item.id === input.value);
        return {
          requestId: input.value,
          version: request?.version ?? -1,
          decision: decision as WebLeaveDecision,
        };
      });
      const result = batchReviewStaffLeaveRequests(
        syntheticStaffLeaveState,
        syntheticStaffAccess,
        commands,
      );
      syntheticStaffLeaveState = result.state;
      staffLeaveNotice = result.ok
        ? "已按当前范围完成批量处理。"
        : "本次批量操作未修改任何申请；请检查选择和当前范围。";
      render();
      appRoot.querySelector<HTMLElement>("#staff-leave-review-heading")?.focus();
    });
  });
}

function setupStaffCareRecordPanel(): void {
  const main = appRoot.querySelector<HTMLElement>("main");
  if (!main) return;
  const host = document.createElement("div");
  host.dataset.careRecordRoot = "";
  main.append(host);

  const renderPanel = (): void => {
    if (!host.isConnected || window.location.pathname !== "/staff/report") return;
    careRecordState = createCareRecordState(teacherCareRecordClient.snapshot.records);
    host.innerHTML = renderCareRecordStaffPanel(
      careRecordState,
      "TEACHER",
      careRecordValues,
      teacherCareRecordClient.snapshot.message,
      true,
    );
    host.querySelectorAll<HTMLSelectElement>("[data-care-record-field]").forEach((select) => {
      select.addEventListener("change", () => {
        const field = select.dataset.careRecordField as keyof CareRecordValues | undefined;
        if (
          field !== "arrival" &&
          field !== "homework" &&
          field !== "meal" &&
          field !== "rest" &&
          field !== "activity" &&
          field !== "wellbeing"
        )
          return;
        careRecordValues = { ...careRecordValues, [field]: select.value } as CareRecordValues;
      });
    });
    const busy = ["CONNECTING", "BUSY"].includes(teacherCareRecordClient.snapshot.status);
    host.querySelectorAll<HTMLButtonElement>("[data-care-record-refresh]").forEach((button) => {
      button.disabled = busy;
      button.addEventListener("click", () => run(teacherCareRecordClient.refresh()));
    });
    host.querySelectorAll<HTMLButtonElement>("[data-care-record-action]").forEach((button) => {
      button.disabled = busy;
      button.addEventListener("click", () => {
        const action = button.dataset.careRecordAction;
        const id = button.dataset.careRecordId ?? "";
        const version = Number(button.dataset.careRecordVersion);
        let operation: Promise<void> | null = null;
        if (action === "create") {
          operation = teacherCareRecordClient.create(careRecordValues, currentCareRecordDate());
        } else if (action === "submit" && id && Number.isSafeInteger(version)) {
          operation = teacherCareRecordClient.command(id, version, "submit");
        } else if (action === "withdraw" && id && Number.isSafeInteger(version)) {
          operation = teacherCareRecordClient.command(id, version, "withdraw");
        } else if (action === "resubmit" && id && Number.isSafeInteger(version)) {
          operation = teacherCareRecordClient.command(id, version, "resubmit", careRecordValues);
        }
        if (operation) run(operation);
      });
    });
  };

  const run = (operation: Promise<void>): void => {
    renderPanel();
    void operation.then(() => {
      renderPanel();
      host.querySelector<HTMLElement>("#care-record-status")?.focus({ preventScroll: true });
    });
  };

  renderPanel();
  if (teacherCareRecordClient.snapshot.status === "IDLE")
    run(teacherCareRecordClient.connect("teacher-east"));
}

function setupParentCareRecordPanel(): void {
  const main = appRoot.querySelector<HTMLElement>(".parent-fees-main");
  if (!main) return;
  const host = document.createElement("div");
  host.dataset.parentCareRecordRoot = "";
  main.append(host);

  const renderPanel = (): void => {
    if (!host.isConnected || window.location.pathname !== "/web/parent/home") return;
    const snapshot = parentCareRecordClient.snapshot;
    host.innerHTML = renderSharedParentCareRecordPanel(
      snapshot.parentRecords,
      snapshot.message,
      ["CONNECTING", "BUSY"].includes(snapshot.status),
    );
    host
      .querySelector<HTMLButtonElement>("[data-parent-care-record-refresh]")
      ?.addEventListener("click", () => run(parentCareRecordClient.refresh()));
    host
      .querySelectorAll<HTMLButtonElement>("[data-parent-care-record-action]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const action = button.dataset.parentCareRecordAction;
          const id = button.dataset.parentCareRecordId;
          const version = Number(button.dataset.parentCareRecordVersion);
          if (!id || !Number.isSafeInteger(version)) return;
          if (action !== "read" && action !== "acknowledge") return;
          run(parentCareRecordClient.receipt(id, version, action));
        });
      });
  };

  const run = (operation: Promise<void>): void => {
    renderPanel();
    void operation.then(() => {
      renderPanel();
      host
        .querySelector<HTMLElement>("[data-parent-care-record-row]")
        ?.focus({ preventScroll: true });
    });
  };

  renderPanel();
  if (parentCareRecordClient.snapshot.status === "IDLE")
    run(parentCareRecordClient.connect("parent-alpha"));
}

function setupParentNoticePanel(): void {
  const main = appRoot.querySelector<HTMLElement>(".parent-fees-main");
  if (!main) return;
  const host = document.createElement("div");
  host.dataset.parentNoticesRoot = "";
  main.append(host);

  const renderPanel = (): void => {
    if (!host.isConnected || window.location.pathname !== "/web/parent/home") return;
    host.innerHTML = renderParentNoticesPanel(parentNoticeClient.snapshot);
  };

  const run = (operation: Promise<void>): void => {
    renderPanel();
    void operation.then(() => {
      renderPanel();
      host.querySelector<HTMLElement>("[data-parent-notices-status]")?.focus({
        preventScroll: true,
      });
    });
  };

  host.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-parent-notices-refresh]")) {
      run(parentNoticeClient.refresh());
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-parent-notice-action]");
    if (!button) return;
    const action = button.dataset.parentNoticeAction;
    const id = button.dataset.parentNoticeId ?? "";
    const version = Number(button.dataset.parentNoticeVersion);
    if ((action !== "read" && action !== "ack") || !id || !Number.isSafeInteger(version)) return;
    run(parentNoticeClient.receipt(id, version, action as ParentNoticeAction));
  });

  renderPanel();
}

function currentCareRecordDate(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function setupParentPickupPanel(): void {
  const main = appRoot.querySelector<HTMLElement>(".parent-fees-main");
  if (!main) return;
  const host = document.createElement("div");
  host.dataset.parentPickupRoot = "";
  main.append(host);

  const renderPanel = (): void => {
    if (!host.isConnected || window.location.pathname !== "/web/parent/home") return;
    host.innerHTML = renderParentPickupPanel(parentPickupClient.snapshot);
  };
  parentPickupClient.setCredentialExpiryListener(renderPanel);
  const run = (operation: Promise<void>): void => {
    renderPanel();
    const focusStatus = (): void => {
      host.querySelector<HTMLElement>(".pickup-parent-message")?.focus({ preventScroll: true });
    };
    focusStatus();
    void operation.then(() => {
      renderPanel();
      focusStatus();
    });
  };

  host.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const reconnect = target.closest<HTMLButtonElement>("[data-parent-pickup-reconnect]");
    if (reconnect) {
      run(parentPickupClient.connect());
      return;
    }
    const refresh = target.closest<HTMLButtonElement>("[data-parent-pickup-refresh]");
    if (refresh) {
      run(parentPickupClient.refresh());
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-parent-pickup-action]");
    const id = button?.dataset.id;
    const version = Number(button?.dataset.version);
    if (!button || !id || !Number.isSafeInteger(version)) return;
    const action = button.dataset.parentPickupAction;
    if (action === "activate") {
      run(parentPickupClient.activate(id, version));
    } else if (action === "credential") {
      run(parentPickupClient.issueCredential(id, version));
    } else if (action === "revoke") {
      const label = button
        .closest<HTMLElement>("[data-parent-pickup-id]")
        ?.querySelector("h3")?.textContent;
      if (window.confirm(`将撤销${label ?? "此接送授权"}，现场凭证会立即失效。确认撤销？`)) {
        run(parentPickupClient.revoke(id, version));
      }
    }
  });
  host.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches("[data-parent-pickup-form]")) return;
    event.preventDefault();
    const values = new FormData(form);
    const input: ParentPickupInput = {
      bindingId: String(values.get("bindingId") ?? ""),
      recipient: String(values.get("recipient") ?? "") as ParentPickupInput["recipient"],
      type: String(values.get("type") ?? "") as ParentPickupInput["type"],
      startDate: String(values.get("startDate") ?? ""),
      endDate: String(values.get("endDate") ?? ""),
      startTime: String(values.get("startTime") ?? ""),
      endTime: String(values.get("endTime") ?? ""),
    };
    run(parentPickupClient.create(input));
  });
  host.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.name.startsWith("history")) return;
    const focusedName = target.name;
    const from = host.querySelector<HTMLInputElement>('[name="historyFrom"]')?.value ?? "";
    const to = host.querySelector<HTMLInputElement>('[name="historyTo"]')?.value ?? "";
    parentPickupClient.setHistoryFilter(from, to);
    renderPanel();
    host.querySelector<HTMLInputElement>(`[name="${focusedName}"]`)?.focus({ preventScroll: true });
  });

  renderPanel();
}

function setupMonthlyFeedbackPanel(
  client: MonthlyFeedbackClient,
  target: HTMLElement,
  route: "/staff/report" | "/web/parent/home",
): void {
  const host = document.createElement("div");
  host.dataset.monthlyFeedbackRoot = route === "/staff/report" ? "staff" : "parent";
  target.append(host);

  const renderPanel = (): void => {
    if (!host.isConnected || window.location.pathname !== route) return;
    host.innerHTML = renderMonthlyFeedbackPanel(client.snapshot);
    host
      .querySelector<HTMLButtonElement>("[data-monthly-feedback-refresh]")
      ?.addEventListener("click", () => {
        const operation =
          client.snapshot.status === "IDLE" || client.snapshot.status === "ERROR"
            ? client.connect()
            : client.refresh();
        renderPanel();
        void operation.then(renderPanel);
      });
    host.querySelectorAll<HTMLButtonElement>("[data-monthly-feedback-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.monthlyFeedbackAction;
        const id = button.dataset.monthlyFeedbackId;
        const version = Number(button.dataset.monthlyFeedbackVersion);
        if ((action !== "submit" && action !== "ack") || !id || !Number.isSafeInteger(version))
          return;
        const operation = client.command(action as MonthlyFeedbackAction, id, version);
        renderPanel();
        void operation.then(renderPanel);
      });
    });
    host.querySelectorAll<HTMLFormElement>("[data-monthly-feedback-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const action = (form.dataset.monthlyFeedbackForm || "create") as MonthlyFeedbackFormAction;
        const values = monthlyFeedbackFormValues(form);
        const operation =
          action === "create"
            ? client.create(values)
            : (() => {
                const id = form.dataset.monthlyFeedbackId;
                const version = Number(form.dataset.monthlyFeedbackVersion);
                if (!id || !Number.isSafeInteger(version)) return Promise.resolve();
                return client.command(action, id, version, values);
              })();
        renderPanel();
        void operation.then(renderPanel);
      });
    });
  };

  const status = client.snapshot.status;
  const operation =
    status === "IDLE" || status === "ERROR" || status === "CONNECTING"
      ? client.connect()
      : client.refresh();
  renderPanel();
  void operation.then(renderPanel);
}

function setupStaffDailyPanel(): void {
  const main = appRoot.querySelector<HTMLElement>("main");
  if (!main) return;
  const host = document.createElement("div");
  host.dataset.staffDailyRoot = "";
  main.append(host);

  const renderPanel = (): void => {
    if (!host.isConnected || window.location.pathname !== "/staff/report") return;
    host.innerHTML = renderStaffDailyPanel(staffDailyClient.snapshot);
    host
      .querySelector<HTMLButtonElement>("[data-staff-daily-refresh]")
      ?.addEventListener("click", () => {
        const status = staffDailyClient.snapshot.status;
        const operation =
          status === "ERROR" || status === "IDLE"
            ? connectStaffDailyClient()
            : status === "CONNECTING"
              ? (staffDailyConnectOperation ?? Promise.resolve())
              : staffDailyClient.refresh();
        renderPanel();
        void operation.then(renderPanel);
      });
    host
      .querySelector<HTMLFormElement>('[data-staff-daily-form="create"]')
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!(form instanceof HTMLFormElement)) return;
        const values = staffDailyFormValues(form);
        if (!values) return;
        const operation = staffDailyClient.create(values.date, values.values);
        renderPanel();
        void operation.then(renderPanel);
      });
    host.querySelectorAll<HTMLFormElement>('[data-staff-daily-form="resubmit"]').forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const current = event.currentTarget;
        if (!(current instanceof HTMLFormElement)) return;
        const id = current.dataset.staffDailyId;
        const version = Number(current.dataset.staffDailyVersion);
        const values = staffDailyFormValues(current);
        if (!id || !Number.isSafeInteger(version) || !values) return;
        const operation = staffDailyClient.resubmit(id, version, values.values);
        renderPanel();
        void operation.then(renderPanel);
      });
    });
    host
      .querySelectorAll<HTMLButtonElement>('[data-staff-daily-action="submit"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.dataset.staffDailyId;
          const version = Number(button.dataset.staffDailyVersion);
          if (!id || !Number.isSafeInteger(version)) return;
          const operation = staffDailyClient.submit(id, version);
          renderPanel();
          void operation.then(renderPanel);
        });
      });
  };

  const status = staffDailyClient.snapshot.status;
  const operation =
    status === "IDLE" || status === "ERROR"
      ? connectStaffDailyClient()
      : status === "CONNECTING"
        ? (staffDailyConnectOperation ?? Promise.resolve())
        : staffDailyClient.refresh();
  renderPanel();
  void operation.then(renderPanel);
}

function connectStaffDailyClient(): Promise<void> {
  const operation = staffDailyClient.connect();
  staffDailyConnectOperation = operation;
  void operation.finally(() => {
    if (staffDailyConnectOperation === operation) staffDailyConnectOperation = null;
  });
  return operation;
}

function setupStaffTaskWorkbench(): void {
  const main = appRoot.querySelector<HTMLElement>("main");
  if (!main) return;
  const host = document.createElement("div");
  host.dataset.staffTaskRoot = "";
  main.append(host);

  const renderPanel = (): void => {
    if (!host.isConnected || window.location.pathname !== "/staff/workbench") return;
    host.innerHTML = renderStaffTaskPanel(staffTaskClient.snapshot);
    host
      .querySelector<HTMLButtonElement>("[data-staff-task-refresh]")
      ?.addEventListener("click", () => {
        const operation =
          staffTaskClient.snapshot.status === "ERROR"
            ? staffTaskClient.connect()
            : staffTaskClient.refresh();
        renderPanel();
        void operation.then(renderPanel);
      });
    host.querySelectorAll<HTMLButtonElement>("[data-staff-task-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.staffTaskAction;
        const id = button.dataset.staffTaskId;
        const version = Number(button.dataset.staffTaskVersion);
        if (
          (action !== "claim" && action !== "start" && action !== "complete") ||
          !id ||
          !Number.isSafeInteger(version)
        )
          return;
        const result = button
          .closest<HTMLElement>("[data-staff-task-item]")
          ?.querySelector<HTMLSelectElement>("[name=staff-task-result]")?.value;
        const completionResult =
          result === "COMPLETED_AS_PLANNED" ||
          result === "FOLLOW_UP_REQUIRED" ||
          result === "BLOCKED"
            ? result
            : undefined;
        const operation = staffTaskClient.command(
          action as StaffTaskCommand,
          id,
          version,
          completionResult,
        );
        renderPanel();
        void operation.then(renderPanel);
      });
    });
  };

  const operation =
    staffTaskClient.snapshot.status === "IDLE"
      ? staffTaskClient.connect()
      : staffTaskClient.refresh();
  renderPanel();
  void operation.then(renderPanel);
}

function setupSupplyRequestPanel(): void {
  const main = appRoot.querySelector<HTMLElement>("main");
  if (!main) return;
  const host = document.createElement("div");
  host.dataset.supplyRequestRoot = "";
  main.append(host);

  const renderPanel = (): void => {
    if (!host.isConnected || window.location.pathname !== "/staff/workbench") return;
    host.innerHTML = renderSupplyPanel(supplyRequestClient.snapshot);
    host
      .querySelector<HTMLButtonElement>("[data-supply-refresh]")
      ?.addEventListener("click", () => {
        const operation =
          supplyRequestClient.snapshot.status === "ERROR" ||
          supplyRequestClient.snapshot.status === "IDLE"
            ? supplyRequestClient.connect()
            : supplyRequestClient.refresh();
        renderPanel();
        void operation.then(renderPanel);
      });
    host.querySelectorAll<HTMLButtonElement>("[data-supply-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.supplyAction;
        const id = button.dataset.supplyId;
        const version = Number(button.dataset.supplyVersion);
        if (
          (action !== "submit" && action !== "cancel" && action !== "claim") ||
          !id ||
          !Number.isSafeInteger(version)
        )
          return;
        const operation = supplyRequestClient.command(action as SupplyRequestAction, id, version);
        renderPanel();
        void operation.then(renderPanel);
      });
    });
    host.querySelectorAll<HTMLFormElement>("[data-supply-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = supplyRequestFormValues(form);
        if (!values) return;
        let operation: Promise<void>;
        if (form.dataset.supplyForm === "create") {
          operation = supplyRequestClient.create(values);
        } else {
          const id = form.dataset.supplyId;
          const version = Number(form.dataset.supplyVersion);
          if (!id || !Number.isSafeInteger(version)) return;
          operation = supplyRequestClient.edit(id, version, values);
        }
        renderPanel();
        void operation.then(renderPanel);
      });
    });
  };

  renderPanel();
  const operation =
    supplyRequestClient.snapshot.status === "IDLE" ||
    supplyRequestClient.snapshot.status === "ERROR"
      ? supplyRequestClient.connect()
      : supplyRequestClient.refresh();
  void operation.then(renderPanel);
}
function setupHealthIncidentPanel(
  client: HealthIncidentClient,
  rerender: () => void,
  isActive: () => boolean,
): void {
  const run = (operation: Promise<void>) => {
    rerender();
    void operation.then(() => {
      if (isActive()) rerender();
    });
  };
  appRoot
    .querySelector<HTMLButtonElement>("[data-health-refresh]")
    ?.addEventListener("click", () => {
      run(client.snapshot.status === "ERROR" ? client.connect() : client.refresh());
    });
  appRoot
    .querySelector<HTMLButtonElement>("[data-health-reconnect]")
    ?.addEventListener("click", () => {
      run(client.connect());
    });
  appRoot
    .querySelector<HTMLFormElement>("[data-health-create]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;
      const observationCode =
        form.querySelector<HTMLSelectElement>('[name="observationCode"]')?.value ?? "";
      const dispositionCode =
        form.querySelector<HTMLSelectElement>('[name="dispositionCode"]')?.value ?? "";
      run(client.create(observationCode, dispositionCode));
    });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-health-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.healthAction as HealthIncidentAction | undefined;
      const id = button.dataset.healthId;
      if (!action || !id) return;
      if (action === "edit") {
        const row = button.closest<HTMLElement>("[data-health-record]");
        const observationCode = row?.querySelector<HTMLSelectElement>(
          '[name="observationCode"]',
        )?.value;
        const dispositionCode = row?.querySelector<HTMLSelectElement>(
          '[name="dispositionCode"]',
        )?.value;
        if (!observationCode || !dispositionCode) return;
        run(client.command(action, id, { observationCode, dispositionCode }));
        return;
      }
      run(client.command(action, id));
    });
  });
}

function renderParentConsentRoute(): void {
  const connectOperation =
    parentConsentClient.snapshot.status === "IDLE" ? parentConsentClient.connect() : null;
  const content = `
    <header class="site-header internal-header">
      <div class="site-header-inner">
        <a class="brand" href="/visitor" aria-label="同芯学园首页">
          <img class="brand-logo" src="/assets/tongxin-logo.png" alt="同芯学园" />
        </a>
        <span class="header-action internal-badge">家长端</span>
      </div>
    </header>
    ${renderParentConsentPage(parentConsentClient.snapshot)}
    <footer class="site-footer"><div class="site-footer-inner"><p>仅展示合成演示资料，不连接真实服务。</p></div></footer>
  `;
  appRoot.replaceChildren(document.createRange().createContextualFragment(content));
  setupRevealAnimations();

  const run = (operation: Promise<void>) => {
    renderParentConsentRoute();
    void operation.then(() => {
      if (window.location.pathname === "/web/parent/binding") renderParentConsentRoute();
    });
  };
  appRoot
    .querySelector<HTMLButtonElement>("[data-parent-reconnect]")
    ?.addEventListener("click", () => {
      run(parentConsentClient.connect());
    });
  appRoot
    .querySelector<HTMLButtonElement>("[data-parent-refresh]")
    ?.addEventListener("click", () => {
      run(parentConsentClient.refresh());
    });
  appRoot
    .querySelector<HTMLButtonElement>("[data-parent-binding]")
    ?.addEventListener("click", () => {
      run(parentConsentClient.applyBinding());
    });
  appRoot
    .querySelector<HTMLFormElement>("[data-parent-privacy-form]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = appRoot.querySelector<HTMLSelectElement>("#parent-privacy-type")?.value;
      if (value !== "ACCESS" && value !== "CORRECT" && value !== "COPY" && value !== "DELETE")
        return;
      run(parentConsentClient.submitPrivacyRequest(value as ParentPrivacyRequestType));
    });
  appRoot
    .querySelectorAll<HTMLButtonElement>("[data-parent-privacy-withdraw]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.parentPrivacyWithdraw);
        if (Number.isSafeInteger(index) && index >= 0)
          run(parentConsentClient.withdrawPrivacyRequest(index));
      });
    });
  appRoot.querySelectorAll<HTMLInputElement>("[data-parent-grant-confirm]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const key = checkbox.dataset.parentGrantConfirm;
      if (!key) return;
      const button = appRoot.querySelector<HTMLButtonElement>(`[data-parent-grant="${key}"]`);
      if (button) button.disabled = !checkbox.checked;
    });
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-parent-grant]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.parentGrant;
      if (key !== "CARE_RECORD" && key !== "HEALTH_SUPPORT" && key !== "LEARNING_SUPPORT") return;
      const checkbox = appRoot.querySelector<HTMLInputElement>(
        `[data-parent-grant-confirm="${key}"]`,
      );
      run(parentConsentClient.grant(key as ConsentPurposeKey, checkbox?.checked === true));
    });
  });
  appRoot.querySelectorAll<HTMLInputElement>("[data-parent-revoke-confirm]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const index = checkbox.dataset.parentRevokeConfirm;
      if (!index) return;
      const button = appRoot.querySelector<HTMLButtonElement>(`[data-parent-revoke="${index}"]`);
      if (button) button.disabled = !checkbox.checked;
    });
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-parent-revoke]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.parentRevoke);
      const checkbox = appRoot.querySelector<HTMLInputElement>(
        `[data-parent-revoke-confirm="${index}"]`,
      );
      run(parentConsentClient.revoke(index, checkbox?.checked === true));
    });
  });

  if (connectOperation) {
    void connectOperation.then(() => {
      if (window.location.pathname === "/web/parent/binding") renderParentConsentRoute();
    });
  }
}

function renderInternalPage(pathname: string): string | null {
  if (pathname === "/staff/leave-review") {
    const route = selectStaffRoute(syntheticStaffAccess, "leave-review");
    const view = projectStaffLeaveReview({
      access: route.kind === "authorized" ? syntheticStaffAccess : undefined,
      state: syntheticStaffLeaveState,
      notice: staffLeaveNotice,
    });
    return renderInternalShell(view.html, view.heading);
  }

  if (pathname === "/staff/workbench") {
    const route = selectStaffRoute(syntheticStaffAccess, "workbench");
    const view =
      route.kind === "authorized"
        ? projectStaffWorkbench({
            access: syntheticStaffAccess,
            state: "published",
            resources: syntheticStaffResources,
            tasks: [],
          })
        : projectStaffWorkbench({
            access: undefined,
            state: "error",
            resources: [],
            tasks: [],
          });
    return renderInternalShell(view.html, view.heading);
  }

  if (pathname === "/staff/report") {
    const route = selectStaffRoute(syntheticStaffAccess, "report");
    const view = projectStaffReport({
      access: route.kind === "authorized" ? syntheticStaffAccess : undefined,
      state: "published",
      report:
        route.kind === "authorized"
          ? {
              tenantId: syntheticStaffAccess.tenantId,
              campusId: syntheticStaffAccess.campusId,
              status: "published" as const,
              summary: "模拟数据：今日教学摘要已准备好。",
            }
          : undefined,
    });
    return renderInternalShell(
      `${view.html}${renderHealthIncidentPanel(teacherHealthIncidentClient.snapshot)}`,
      view.heading,
    );
  }

  if (pathname === "/staff/guides") {
    const route = selectStaffRoute(syntheticStaffAccess, "guides");
    const view = StaffGuidesPage({
      ...readStaffSearchParams(STAFF_GUIDE_CATEGORIES),
      limit: 20,
    });
    return route.kind === "authorized"
      ? renderInternalShell(view.html, view.heading)
      : renderInternalShell("<main><h1>员工访问不可用</h1></main>", "新员工指南");
  }

  if (pathname === "/web/staff/resources") {
    const route = selectStaffRoute(syntheticStaffAccess, "resources");
    const view = TeachingResourcesPage({
      ...readStaffSearchParams(RESOURCE_CATEGORIES),
      limit: 20,
    });
    return route.kind === "authorized"
      ? renderInternalShell(view.html, view.heading)
      : renderInternalShell("<main><h1>员工访问不可用</h1></main>", "教学资源");
  }

  if (pathname === "/web/staff/partner-cloud") {
    const route = selectStaffRoute(syntheticStaffAccess, "partner-cloud");
    const view = PartnerLinkPage({ state: "UNAVAILABLE" });
    return route.kind === "authorized"
      ? renderInternalShell(view.html, view.heading)
      : renderInternalShell("<main><h1>员工访问不可用</h1></main>", "伙伴云入口");
  }

  return null;
}

function readStaffSearchParams<T extends string>(
  categories: readonly T[],
): {
  readonly query: string;
  readonly category?: T;
} {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("query") ?? "";
  const category = params.get("category");
  return category !== null && (categories as readonly string[]).includes(category)
    ? { query, category: category as T }
    : { query };
}

function renderInternalShell(content: string, heading: string): string {
  return `
    <header class="site-header internal-header">
      <div class="site-header-inner">
        <a class="brand" href="/visitor" aria-label="同芯托管访客首页">
          <img class="brand-logo" src="/assets/tongxin-logo.png" alt="同芯学园" />
        </a>
        <nav class="site-navigation internal-navigation" aria-label="员工导航">
          <a href="/visitor">访客首页</a>
          <a href="/staff/workbench" aria-current="${heading === "员工工作台" ? "page" : "false"}">工作台</a>
          <a href="/staff/report" aria-current="${heading === "每日报告" ? "page" : "false"}">每日报告</a>
          <a href="/staff/report?view=leave-review" aria-current="${heading === "请假审核" ? "page" : "false"}">请假审核</a>
          <a href="/staff/guides" aria-current="${heading === "新员工指南" ? "page" : "false"}">新员工指南</a>
          <a href="/web/staff/resources" aria-current="${heading === "教学资源" ? "page" : "false"}">教学资源</a>
          <a href="/web/staff/partner-cloud" aria-current="${heading === "伙伴云入口" ? "page" : "false"}">伙伴云入口</a>
        </nav>
        <span class="header-action internal-badge" title="本地合成身份演示，非真实认证">本地合成身份演示 · 非真实认证</span>
      </div>
    </header>
    ${content}
    <footer id="site-footer" class="site-footer">
      <div class="site-footer-inner">
        <div class="footer-brand">
          <strong>同芯员工端</strong>
          <p class="footer-description">仅展示当前校区范围内的合成数据，不连接正式服务。</p>
        </div>
      </div>
    </footer>
  `;
}

function updateVisitorContactIntent(state: VisitorContactIntentState): void {
  const body = document.querySelector<HTMLElement>("[data-contact-intent-body]");
  if (body === null) {
    return;
  }

  body.replaceChildren(
    document.createRange().createContextualFragment(renderVisitorContactIntent(state)),
  );
  if (state === "INVALID") {
    body.querySelector<HTMLInputElement>("input[name=contactName]")?.focus();
  }
}

function setupRevealAnimations(): void {
  const revealNodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (revealNodes.length === 0 || !("IntersectionObserver" in window)) {
    revealNodes.forEach((node) => node.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add("is-revealed");
        currentObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12%", threshold: 0.08 },
  );

  revealNodes.forEach((node) => observer.observe(node));
}

function renderShell(route: VisitorRoute): string {
  const navigation = `
    <header class="site-header">
      <div class="site-header-inner">
        <a class="brand" href="/visitor" aria-label="同芯托管访客首页">
          <img class="brand-logo" src="/assets/tongxin-logo.png" alt="同芯学园" />
        </a>
        <button class="menu-toggle" type="button" aria-label="菜单" aria-expanded="false" aria-controls="site-navigation">
          <span class="menu-toggle-icon" aria-hidden="true">＋</span>
        </button>
        <nav id="site-navigation" class="site-navigation" aria-label="主导航">
          <a href="/visitor" aria-current="${route.kind === "HOME" ? "page" : "false"}">首页</a>
          <a href="/web/visitor/institution" aria-current="${route.kind === "INSTITUTION" ? "page" : "false"}">机构介绍</a>
          <a href="/web/visitor/day-flow" aria-current="${route.kind === "DAY_FLOW" ? "page" : "false"}">一日流程</a>
          <a href="/visitor#visitor-empty-states">服务方向</a>
          <a href="/web/parent/binding">家长服务</a>
          <a href="/visitor#site-footer">联系我们</a>
          <a class="staff-demo-link" href="/staff/workbench" title="本地合成身份演示，非真实认证" aria-label="员工演示入口，本地合成身份演示，非真实认证">员工演示入口</a>
        </nav>
        <a class="header-action" href="${route.kind === "CONTENT" ? "/visitor" : "/visitor#visitor-empty-states"}">家长咨询 <span aria-hidden="true">↗</span></a>
      </div>
    </header>
  `;

  return `
    ${navigation}
    ${route.view.html}
    <footer id="site-footer" class="site-footer">
      <div class="site-footer-inner">
        <div class="footer-brand">
          <a class="brand brand-footer" href="/visitor" aria-label="同芯托管访客首页">
            <img class="brand-logo" src="/assets/tongxin-logo.png" alt="同芯学园" />
          </a>
          <p class="footer-description">让每个孩子在放学后的时光里，继续学习、探索与成长。</p>
          <p class="footer-meta">全部内容均为模拟数据 · 访客端公开信息预览</p>
        </div>
        <div class="footer-column">
          <h2>快速导航</h2>
          <a href="/visitor">访客首页</a>
          <a href="/visitor#about">关于我们</a>
          <a href="/visitor#visitor-empty-states">服务状态</a>
        </div>
        <div class="footer-column">
          <h2>服务方向</h2>
          <span>课后托管</span>
          <span>兴趣探索</span>
          <span>成长陪伴</span>
        </div>
        <div class="footer-column footer-contact">
          <h2>联系我们</h2>
          <span>家长咨询 · 模拟入口</span>
          <span>信息准备好后公开呈现</span>
          <a href="/visitor#site-footer">查看访客信息</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>同芯托管 · 模拟数据</span>
        <span>© 2026 同芯托管</span>
      </div>
    </footer>
  `;
}

document.addEventListener("submit", (event) => {
  const resourceForm = event.target;
  if (
    resourceForm instanceof HTMLFormElement &&
    resourceForm.hasAttribute("data-resource-search") &&
    window.location.pathname === "/web/staff/resources" &&
    sharedResourceMode()
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const values = new FormData(resourceForm);
    const filters: ResourceLibraryFilters = {
      query: String(values.get("query") ?? ""),
      grade: String(values.get("grade") ?? ""),
      subject: String(values.get("subject") ?? ""),
      tag: String(values.get("tag") ?? ""),
    };
    void runResourceLibraryOperation(resourceLibraryClient.refresh(filters));
    return;
  }
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.dataset.contactIntentForm !== "true") {
    return;
  }

  event.preventDefault();
  const name = form.elements.namedItem("contactName");
  const topic = form.elements.namedItem("contactTopic");
  if (!(name instanceof HTMLInputElement) || !(topic instanceof HTMLSelectElement)) {
    updateVisitorContactIntent("INVALID");
    return;
  }

  if (name.value.trim() === "" || topic.value === "") {
    updateVisitorContactIntent("INVALID");
    return;
  }

  updateVisitorContactIntent("SUBMITTING");
  window.setTimeout(() => {
    const currentState = document.querySelector<HTMLElement>("[data-contact-intent-state]")?.dataset
      .contactIntentState;
    if (currentState === "SUBMITTING") {
      updateVisitorContactIntent("CONFIRMED");
    }
  }, 180);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const resourceAction = target.closest<HTMLElement>("[data-resource-action]");
  if (
    resourceAction &&
    window.location.pathname === "/web/staff/resources" &&
    sharedResourceMode()
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const action = resourceAction.dataset.resourceAction;
    const id = resourceAction.dataset.resourceId ?? "";
    if (action === "connect") {
      const profile = new URLSearchParams(window.location.search).get("profile");
      if (isResourceLibraryProfile(profile))
        void runResourceLibraryOperation(resourceLibraryClient.connect(profile));
    } else if (action === "open") void runResourceLibraryOperation(resourceLibraryClient.open(id));
    else if (action === "favorite")
      void runResourceLibraryOperation(resourceLibraryClient.toggleFavorite(id));
    else if (action === "use") void runResourceLibraryOperation(resourceLibraryClient.use(id));
    else if (action === "return") {
      resourceLibraryClient.closeDetail();
      render();
    } else if (action === "clear")
      void runResourceLibraryOperation(resourceLibraryClient.refresh({}));
    return;
  }

  const actionElement = target.closest<HTMLElement>("[data-action]");
  const action = actionElement?.dataset.action;
  if (action === "open-guide" || action === "open-resource") {
    event.preventDefault();
    const card = actionElement?.closest<HTMLElement>("[data-guide-id], [data-resource-id]");
    const title = card?.querySelector("h2")?.textContent?.trim() ?? "模拟内容";
    document
      .querySelector<HTMLElement>("[data-staff-action-status]")
      ?.replaceChildren(document.createTextNode(`本地演示已选择：${title}。未连接正式服务。`));
    return;
  }

  if (action === "clear-filters") {
    event.preventDefault();
    const href = actionElement?.getAttribute("href") ?? window.location.pathname;
    const url = new URL(href, window.location.origin);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    render();
    return;
  }

  const link = target.closest<HTMLAnchorElement>("a");
  if (
    event.defaultPrevented ||
    link === null ||
    link.origin !== window.location.origin ||
    !link.pathname.startsWith("/")
  ) {
    return;
  }

  const isHashOnly = link.pathname === window.location.pathname && link.hash !== "";
  if (isHashOnly) {
    return;
  }

  event.preventDefault();
  if (
    sharedResourceMode() &&
    link.pathname === "/web/staff/resources" &&
    !new URLSearchParams(link.search).has("mode")
  )
    link.search = window.location.search;
  window.history.pushState({}, "", `${link.pathname}${link.search}${link.hash}`);
  render();
  if (link.hash !== "") {
    document.querySelector(link.hash)?.scrollIntoView({ block: "start" });
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const toggle = target.closest<HTMLButtonElement>(".menu-toggle");
  if (toggle === null) {
    return;
  }

  const navigation = document.querySelector<HTMLElement>("#site-navigation");
  if (navigation === null) {
    return;
  }

  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!expanded));
  navigation.toggleAttribute("data-open", !expanded);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || target.closest(".menu-toggle") !== null) {
    return;
  }

  const navigation = document.querySelector<HTMLElement>("#site-navigation");
  const toggle = document.querySelector<HTMLButtonElement>(".menu-toggle");
  if (navigation?.hasAttribute("data-open") && target.closest("#site-navigation a") !== null) {
    navigation.removeAttribute("data-open");
    toggle?.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  const navigation = document.querySelector<HTMLElement>("#site-navigation");
  const toggle = document.querySelector<HTMLButtonElement>(".menu-toggle");
  navigation?.removeAttribute("data-open");
  toggle?.setAttribute("aria-expanded", "false");
});

window.addEventListener("popstate", render);
window.addEventListener("pagehide", () => parentLearningClient.disconnect());
window.addEventListener("pagehide", () => parentPickupClient.disconnect());
window.addEventListener("pagehide", () => supplyRequestClient.disconnect());
window.addEventListener("pageshow", (event) => {
  if (event.persisted) render();
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (
    !(target instanceof HTMLSelectElement) ||
    target.name !== "studentId" ||
    !isLearningPath() ||
    parentLearningClient.snapshot.profile !== "parent-alpha"
  )
    return;
  const form = target.closest<HTMLFormElement>("[data-learning-open-form]");
  const duration = form?.querySelector<HTMLSelectElement>('[name="durationMinutes"]');
  const submit = form?.querySelector<HTMLButtonElement>('[type="submit"]');
  const control = parentLearningClient.snapshot.parentControls?.find(
    (item) => item.studentId === target.value,
  );
  if (!duration || !submit) return;
  for (const option of Array.from(duration.options)) {
    option.disabled = !control || Number(option.value) > control.maxDurationMinutes;
  }
  if (duration.selectedOptions[0]?.disabled) {
    duration.value = String(control?.maxDurationMinutes === 5 ? 5 : 10);
  }
  submit.disabled =
    !(
      parentLearningClient.snapshot.status === "READY" ||
      parentLearningClient.snapshot.status === "BUSY"
    ) || !control?.enabled;
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !isLearningPath()) return;
  if (form.matches("[data-learning-control-form]")) {
    event.preventDefault();
    const studentId = form.dataset.studentId;
    const values = new FormData(form);
    const maxDurationMinutes = Number(values.get("maxDurationMinutes"));
    const maxHintLevel = Number(values.get("maxHintLevel"));
    if (
      !studentId ||
      ![5, 10, 15].includes(maxDurationMinutes) ||
      ![0, 1, 2, 3].includes(maxHintLevel)
    )
      return;
    void parentLearningOperation(() =>
      parentLearningClient.updateParentControls(studentId, {
        enabled: form.querySelector<HTMLInputElement>('[name="enabled"]')?.checked === true,
        maxDurationMinutes: maxDurationMinutes as 5 | 10 | 15,
        maxHintLevel: maxHintLevel as 0 | 1 | 2 | 3,
      }),
    );
    return;
  }
  if (!form.matches("[data-learning-open-form]")) return;
  event.preventDefault();
  const values = new FormData(form);
  const studentId = String(values.get("studentId") ?? "");
  const duration = Number(values.get("durationMinutes"));
  const consent = form.querySelector<HTMLInputElement>('[name="consent"]')?.checked === true;
  if (!consent || ![5, 10, 15].includes(duration)) return;
  void parentLearningOperation(() => parentLearningClient.open(studentId, duration as 5 | 10 | 15));
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !isLearningPath()) return;
  const contact = target.closest<HTMLElement>("[data-learning-contact]");
  if (contact?.dataset.learningContact) {
    void parentLearningOperation(() =>
      parentLearningClient.contactTeacher(contact.dataset.learningContact!),
    );
    return;
  }
  const handoff = target.closest<HTMLElement>("[data-learning-handoff]");
  if (handoff?.dataset.learningHandoff) {
    void parentLearningOperation(() =>
      parentLearningClient.handoff(handoff.dataset.learningHandoff!),
    );
    return;
  }
  const answer = target.closest<HTMLElement>("[data-learning-answer]");
  if (answer) {
    const itemId = answer.dataset.learningAnswer;
    const choice = answer.dataset.learningChoice;
    if (
      (itemId === "main" || itemId === "practice-1" || itemId === "practice-2") &&
      (choice === "A" || choice === "B" || choice === "C")
    )
      void parentLearningOperation(() => parentLearningClient.answer(itemId, choice));
    return;
  }
  const hint = target.closest<HTMLElement>("[data-learning-hint]");
  if (hint) {
    const level = Number(hint.dataset.learningHint);
    if ([0, 1, 2, 3].includes(level))
      void parentLearningOperation(() => parentLearningClient.hint(level as 0 | 1 | 2 | 3));
    return;
  }
  if (target.closest("[data-learning-close]")) {
    void parentLearningOperation(() => parentLearningClient.close());
    return;
  }
  const remove = target.closest<HTMLElement>("[data-learning-delete]");
  if (remove?.dataset.learningDelete)
    void parentLearningOperation(() => parentLearningClient.delete(remove.dataset.learningDelete!));
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const actionElement = target.closest<HTMLElement>("[data-action]");
  const action = actionElement?.dataset.action;
  if (action !== "open-guide" && action !== "open-resource") {
    return;
  }

  event.preventDefault();
  const card = actionElement?.closest<HTMLElement>("[data-guide-id], [data-resource-id]");
  const title = card?.querySelector("h2")?.textContent?.trim() ?? "模拟内容";
  const status = document.querySelector<HTMLElement>("[data-staff-action-status]");
  status?.replaceChildren(document.createTextNode(`本地演示已选择：${title}。未连接正式服务。`));
  status?.focus();
});

render();
