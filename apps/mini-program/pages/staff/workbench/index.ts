import {
  buildWorkbenchProjection,
  type SyntheticStaffRecord,
} from "../../../src/pages/staff/workbench.ts";
import type { StaffAccessInput } from "../../../src/routes/staff.routes.ts";

declare function Page<T>(options: T): void;

interface WorkbenchItem {
  readonly id: string;
  readonly title: string;
  readonly kind: "SYNTHETIC";
}

interface WorkbenchPageData {
  readonly status: "READY" | "EMPTY" | "DENIED";
  readonly statusAnnouncement: string;
  readonly items: readonly WorkbenchItem[];
  readonly isReady: boolean;
  readonly isEmpty: boolean;
  readonly isDenied: boolean;
}

interface WorkbenchPage {
  data: WorkbenchPageData;
  setData(data: Partial<WorkbenchPageData>): void;
  onLoad(): void;
  handleQuickAction(): void;
  handleHome(): void;
}

interface MiniProgramApi {
  navigateTo(options: { url: string }): void;
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

const syntheticRecords: readonly SyntheticStaffRecord[] = [
  {
    id: "synthetic-staff-task-1",
    tenantId: "tenant-synthetic-a",
    campusId: "campus-synthetic-1",
    title: "模拟数据：完成交接清单",
    dataKind: "SYNTHETIC",
    status: "PUBLISHED",
    enabled: true,
    visibility: "PUBLIC",
    stale: false,
  },
  {
    id: "synthetic-staff-task-2",
    tenantId: "tenant-synthetic-a",
    campusId: "campus-synthetic-1",
    title: "模拟数据：查看今日活动提示",
    dataKind: "SYNTHETIC",
    status: "PUBLISHED",
    enabled: true,
    visibility: "PUBLIC",
    stale: false,
  },
];

function projectionData(): WorkbenchPageData {
  const projection = buildWorkbenchProjection(activeEmployee, syntheticRecords);
  const statusAnnouncement =
    projection.status === "READY"
      ? "员工工作台已就绪"
      : projection.status === "EMPTY"
        ? "暂无可用任务"
        : "员工访问不可用";

  return {
    status: projection.status,
    statusAnnouncement,
    items: projection.items,
    isReady: projection.status === "READY",
    isEmpty: projection.status === "EMPTY",
    isDenied: projection.status === "DENIED",
  };
}

const workbenchPage: WorkbenchPage = {
  data: {
    status: "EMPTY",
    statusAnnouncement: "正在准备员工工作台",
    items: [],
    isReady: false,
    isEmpty: false,
    isDenied: false,
  },

  setData(data) {
    this.data = { ...this.data, ...data };
  },

  onLoad() {
    this.setData(projectionData());
  },

  handleQuickAction() {
    wx.navigateTo({ url: "/pages/staff/quick-action/index" });
  },

  handleHome() {
    wx.reLaunch({ url: "/pages/visitor/home/index" });
  },
};

Page(workbenchPage);
