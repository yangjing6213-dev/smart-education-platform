import {
  isAuthorizedStaff,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "../routes/staff.routes.js";

export interface StaffReportInput {
  readonly access: unknown;
  readonly state: "loading" | "empty" | "error" | "published";
  readonly report: unknown;
}

interface StaffReportRecord {
  readonly tenantId: string;
  readonly campusId: string;
  readonly status: "published";
  readonly summary: string;
}

export type StaffReportView =
  | {
      readonly kind: "denied" | "error" | "state";
      readonly state: "denied" | "error" | "loading" | "empty";
      readonly route: "/staff/report";
      readonly heading: "每日报告";
      readonly statusAnnouncement: string;
      readonly statusRole: "status";
      readonly focusOrder: readonly string[];
      readonly externalRequests: readonly string[];
      readonly externalResources: readonly string[];
      readonly html: string;
    }
  | {
      readonly kind: "authorized";
      readonly state: "published";
      readonly route: "/staff/report";
      readonly heading: "每日报告";
      readonly statusAnnouncement: string;
      readonly statusRole: "status";
      readonly focusOrder: readonly string[];
      readonly summary: string;
      readonly externalRequests: readonly string[];
      readonly externalResources: readonly string[];
      readonly html: string;
    };

export function projectStaffReport(input: StaffReportInput): StaffReportView {
  if (!isAuthorizedStaff(input?.access, "report")) {
    return statusView("denied", "教师摘要访问不可用", ["staff-report-denied"]);
  }
  if (input.state === "loading" || input.state === "empty") {
    return statusView("state", input.state === "loading" ? "正在加载每日报告" : "暂无每日报告", [
      `staff-report-${input.state}`,
    ]);
  }
  if (input.state !== "published") {
    return statusView("error", "每日报告暂时不可用", ["staff-report-error"]);
  }

  const report = parseReport(input.report);
  const access = input.access;
  if (
    report === undefined ||
    !isAuthorizedStaff(access, "report") ||
    report.tenantId !== access.tenantId ||
    report.campusId !== access.campusId
  ) {
    return statusView("error", "每日报告暂时不可用", ["staff-report-error"]);
  }

  return {
    kind: "authorized",
    state: "published",
    route: "/staff/report",
    heading: "每日报告",
    statusAnnouncement: "每日报告已就绪",
    statusRole: "status",
    focusOrder: ["staff-report", "staff-report-summary"],
    summary: report.summary,
    externalRequests: [],
    externalResources: [],
    html: `
      <main class="internal-main" aria-labelledby="staff-report-heading" data-viewport="narrow-safe">
        <h1 id="staff-report-heading">每日报告</h1>
        <p role="status" aria-live="polite">每日报告已就绪</p>
        <section id="staff-report-summary" aria-labelledby="staff-report-summary-heading">
          <h2 id="staff-report-summary-heading">模拟数据：教师摘要</h2>
          <p>${escapeHtml(report.summary)}</p>
        </section>
      </main>
    `.trim(),
  };
}

function statusView(
  kind: "denied" | "error" | "state",
  message: string,
  focusOrder: readonly string[],
): StaffReportView {
  const state = kind === "state" ? focusOrder[0]?.replace("staff-report-", "") : kind;
  return {
    kind,
    state: state === "loading" || state === "empty" ? state : kind,
    route: "/staff/report",
    heading: "每日报告",
    statusAnnouncement: message,
    statusRole: "status",
    focusOrder,
    externalRequests: [],
    externalResources: [],
    html: `
      <main class="internal-main" aria-labelledby="staff-report-heading" data-viewport="narrow-safe">
        <h1 id="staff-report-heading">每日报告</h1>
        <p role="status" aria-live="polite">${escapeHtml(message)}</p>
      </main>
    `.trim(),
  } as StaffReportView;
}

function parseReport(value: unknown): StaffReportRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    typeof value.tenantId !== "string" ||
    typeof value.campusId !== "string" ||
    value.status !== "published" ||
    typeof value.summary !== "string"
  ) {
    return undefined;
  }
  return {
    tenantId: value.tenantId,
    campusId: value.campusId,
    status: "published",
    summary: value.summary,
  };
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
