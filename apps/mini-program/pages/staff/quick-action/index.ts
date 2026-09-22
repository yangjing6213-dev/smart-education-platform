import { runQuickAction, type QuickAction } from "../../../src/pages/staff/quick-action.ts";
import type { StaffAccessInput } from "../../../src/routes/staff.routes.ts";

declare function Page<T>(options: T): void;

interface QuickActionPageData {
  readonly status: "READY" | "DENIED";
  readonly statusAnnouncement: string;
  readonly result: string;
  readonly isReady: boolean;
  readonly isDenied: boolean;
}

interface QuickActionEvent {
  readonly currentTarget?: {
    readonly dataset?: {
      readonly action?: unknown;
    };
  };
}

interface QuickActionPage {
  data: QuickActionPageData;
  setData(data: Partial<QuickActionPageData>): void;
  onLoad(): void;
  handleAction(event: QuickActionEvent): void;
  handleBack(): void;
}

interface MiniProgramApi {
  navigateBack(options: { delta: number; fail: () => void }): void;
  reLaunch(options: { url: string }): void;
}

declare const wx: MiniProgramApi;

const activeEmployee: StaffAccessInput = {
  identityType: "EMPLOYEE",
  identityStatus: "ACTIVE",
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-1",
  membership: {
    status: "ACTIVE",
    tenantId: "tenant-synthetic-a",
    campusId: "campus-synthetic-1",
    capabilities: ["STAFF_WORKBENCH", "STAFF_QUICK_ACTION"],
  },
};

function isQuickAction(value: unknown): value is QuickAction {
  return value === "REVIEW_TASKS" || value === "CHECK_SYNTHETIC_STATUS";
}

function actionResult(action: QuickAction): QuickActionPageData {
  const result = runQuickAction(activeEmployee, action);
  return {
    status: result.status,
    statusAnnouncement: result.status === "READY" ? "快捷动作已完成" : "员工访问不可用",
    result: result.result ?? "当前无法执行快捷动作。",
    isReady: result.status === "READY",
    isDenied: result.status === "DENIED",
  };
}

const quickActionPage: QuickActionPage = {
  data: {
    status: "DENIED",
    statusAnnouncement: "请选择一个模拟快捷动作",
    result: "",
    isReady: false,
    isDenied: false,
  },

  setData(data) {
    this.data = { ...this.data, ...data };
  },

  onLoad() {
    this.setData({
      status: "READY",
      statusAnnouncement: "请选择一个模拟快捷动作",
      result: "",
      isReady: true,
      isDenied: false,
    });
  },

  handleAction(event) {
    const action = event.currentTarget?.dataset?.action;
    if (!isQuickAction(action)) {
      this.setData({
        status: "DENIED",
        statusAnnouncement: "快捷动作不可用",
        result: "当前动作未被确认。",
        isReady: false,
        isDenied: true,
      });
      return;
    }

    this.setData(actionResult(action));
  },

  handleBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        wx.reLaunch({ url: "/pages/staff/workbench/index" });
      },
    });
  },
};

Page(quickActionPage);
