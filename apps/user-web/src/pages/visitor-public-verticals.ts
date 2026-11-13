export type PublicVerticalState = "LOADING" | "EMPTY" | "ERROR" | "PUBLISHED";

export interface PublicVerticalBase {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly publicationStatus: "PUBLISHED" | "DRAFT" | "UNPUBLISHED";
  readonly visibility: "PUBLIC" | "PRIVATE";
  readonly scope: "CURRENT_SYNTHETIC" | "FOREIGN";
  readonly syntheticData: "SIMULATED" | "REAL" | "UNKNOWN";
  readonly freshnessStatus: "FRESH" | "STALE";
  readonly enabledStatus: "ENABLED" | "DISABLED";
}

export interface PublicInstitution extends PublicVerticalBase {
  readonly kind: "INSTITUTION";
  readonly principles: readonly string[];
  readonly audience: string;
}

export interface PublicDayFlowStep {
  readonly time: string;
  readonly title: string;
  readonly description: string;
}

export interface PublicDayFlow extends PublicVerticalBase {
  readonly kind: "DAY_FLOW";
  readonly steps: readonly PublicDayFlowStep[];
}

export interface PublicVerticalResponse {
  readonly institution: PublicInstitution | null;
  readonly dayFlow: PublicDayFlow | null;
}

export interface PublicVerticalView {
  readonly route: "/web/visitor/institution" | "/web/visitor/day-flow";
  readonly heading: string;
  readonly state: PublicVerticalState;
  readonly statusAnnouncement: string;
  readonly statusRole: "status";
  readonly requests: readonly string[];
  readonly externalDestinations: readonly string[];
}

export function createSyntheticPublicVerticalResponse(): PublicVerticalResponse {
  return {
    institution: {
      id: "institution-synthetic",
      tenantId: "tenant-synthetic-a",
      campusId: "campus-synthetic-east",
      kind: "INSTITUTION",
      title: "同芯学园",
      summary: "用稳定的日常、清晰的边界和可理解的信息，陪伴孩子在放学后继续成长。",
      audience: "面向访客的课后成长服务品牌示例",
      principles: ["先保护孩子的尝试空间", "用清晰记录连接家长与教师", "真实信息确认后再公开"],
      publicationStatus: "PUBLISHED",
      visibility: "PUBLIC",
      scope: "CURRENT_SYNTHETIC",
      syntheticData: "SIMULATED",
      freshnessStatus: "FRESH",
      enabledStatus: "ENABLED",
    },
    dayFlow: {
      id: "day-flow-synthetic",
      tenantId: "tenant-synthetic-a",
      campusId: "campus-synthetic-east",
      kind: "DAY_FLOW",
      title: "同芯学园的一日流程",
      summary: "用明确标注的模拟流程，帮助访客理解服务节奏；不代表任何真实校区排班。",
      steps: [
        { time: "15:30", title: "抵达与安顿", description: "放下书包，也放松心情。" },
        { time: "16:00", title: "专注与探索", description: "完成当天的小目标，发现新的兴趣。" },
        { time: "17:30", title: "分享与回家", description: "把今天的收获带回家，也带走好心情。" },
      ],
      publicationStatus: "PUBLISHED",
      visibility: "PUBLIC",
      scope: "CURRENT_SYNTHETIC",
      syntheticData: "SIMULATED",
      freshnessStatus: "FRESH",
      enabledStatus: "ENABLED",
    },
  };
}

export function resolvePublicVertical<T extends PublicVerticalBase>(
  response: unknown,
  key: "institution" | "dayFlow",
  state: PublicVerticalState,
  validate: (value: unknown) => value is T,
): { readonly state: PublicVerticalState; readonly value?: T } {
  if (state !== "PUBLISHED") {
    return { state };
  }
  if (!isRecord(response) || !(key in response)) {
    return { state: "ERROR" };
  }
  const value = response[key];
  if (value === null) {
    return { state: "EMPTY" };
  }
  if (!validate(value)) {
    return { state: "ERROR" };
  }
  if (!isPublishedCurrentSynthetic(value, key)) {
    return { state: "EMPTY" };
  }
  return { state: "PUBLISHED", value };
}

export function isPublishedCurrentSynthetic(
  value: PublicVerticalBase,
  key?: "institution" | "dayFlow",
): boolean {
  return (
    (key === undefined ||
      value.id === (key === "institution" ? "institution-synthetic" : "day-flow-synthetic")) &&
    value.tenantId === "tenant-synthetic-a" &&
    value.campusId === "campus-synthetic-east" &&
    value.publicationStatus === "PUBLISHED" &&
    value.visibility === "PUBLIC" &&
    value.scope === "CURRENT_SYNTHETIC" &&
    value.syntheticData === "SIMULATED" &&
    value.freshnessStatus === "FRESH" &&
    value.enabledStatus === "ENABLED"
  );
}

export function isPublicInstitution(value: unknown): value is PublicInstitution {
  if (!isValidBase(value) || !isRecord(value) || value.kind !== "INSTITUTION") {
    return false;
  }
  return (
    typeof value.audience === "string" &&
    Array.isArray(value.principles) &&
    value.principles.every((item) => typeof item === "string")
  );
}

export function isPublicDayFlow(value: unknown): value is PublicDayFlow {
  if (!isValidBase(value) || !isRecord(value) || value.kind !== "DAY_FLOW") {
    return false;
  }
  return (
    Array.isArray(value.steps) &&
    value.steps.every((step) => {
      if (!isRecord(step)) {
        return false;
      }
      return (
        typeof step.time === "string" &&
        typeof step.title === "string" &&
        typeof step.description === "string"
      );
    })
  );
}

export function escapePublicVerticalHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isValidBase(value: unknown): value is PublicVerticalBase {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.tenantId === "string" &&
    typeof value.campusId === "string" &&
    (value.publicationStatus === "PUBLISHED" ||
      value.publicationStatus === "DRAFT" ||
      value.publicationStatus === "UNPUBLISHED") &&
    (value.visibility === "PUBLIC" || value.visibility === "PRIVATE") &&
    (value.scope === "CURRENT_SYNTHETIC" || value.scope === "FOREIGN") &&
    value.syntheticData === "SIMULATED" &&
    (value.freshnessStatus === "FRESH" || value.freshnessStatus === "STALE") &&
    (value.enabledStatus === "ENABLED" || value.enabledStatus === "DISABLED")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
