export const HEALTH_INCIDENT_OBSERVATIONS = [
  { code: "ROUTINE_OBSERVATION", label: "日常状态观察" },
  { code: "NEEDS_FOLLOW_UP", label: "需要后续关注" },
  { code: "URGENT_REVIEW", label: "需要尽快复核" },
] as const;

export const HEALTH_INCIDENT_DISPOSITIONS = [
  { code: "OBSERVATION_RECHECKED", label: "已重新核对" },
  { code: "FOLLOW_UP_SCHEDULED", label: "已安排后续关注" },
  { code: "GUARDIAN_SUMMARY_PREPARED", label: "已准备家长摘要" },
] as const;

export type HealthIncidentObservationCode = (typeof HEALTH_INCIDENT_OBSERVATIONS)[number]["code"];
export type HealthIncidentDispositionCode = (typeof HEALTH_INCIDENT_DISPOSITIONS)[number]["code"];

export interface HealthIncidentStudentOption {
  readonly id: string;
  readonly studentLabel: string;
}

export interface HealthIncidentDraft {
  readonly id: string;
  readonly version: number;
  readonly status: "DRAFT" | "SUBMITTED";
  readonly statusLabel: string;
}

export interface HealthIncidentSavedDraft extends HealthIncidentDraft {
  readonly status: "DRAFT";
  readonly studentId: string;
  readonly observationCode: HealthIncidentObservationCode;
  readonly dispositionCode: HealthIncidentDispositionCode;
}

export interface ParentHealthNotice {
  readonly id: string;
  readonly version: number;
  readonly status: "PUBLISHED";
  readonly studentLabel: string;
  readonly parentSummary: string;
  readonly receiptStatus: "UNREAD" | "READ" | "ACKNOWLEDGED";
  readonly updatedAt: string;
  readonly synthetic: true;
}

export interface HealthIncidentTransport {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}

export async function runHealthIncidentSingleFlight<T>(
  lock: { current: boolean },
  action: () => Promise<T>,
): Promise<{ readonly started: false } | { readonly started: true; readonly value: T }> {
  if (lock.current) return { started: false };
  lock.current = true;
  try {
    return { started: true, value: await action() };
  } finally {
    lock.current = false;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const OBSERVATION_CODES = HEALTH_INCIDENT_OBSERVATIONS.map(({ code }) => code);
const DISPOSITION_CODES = HEALTH_INCIDENT_DISPOSITIONS.map(({ code }) => code);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function healthError(target: "学生列表" | "健康事项" | "家长健康消息"): Error {
  return new Error(`${target}格式暂不可用，请刷新后重试。`);
}

function parseStudent(value: unknown): HealthIncidentStudentOption | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.studentLabel !== "string" ||
    !value.studentLabel.trim() ||
    value.studentLabel.length > 80
  )
    return null;
  return { id: value.id, studentLabel: value.studentLabel };
}

function parseDraft(value: unknown): HealthIncidentDraft | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !validVersion(value.version) ||
    (value.status !== "DRAFT" && value.status !== "SUBMITTED") ||
    typeof value.statusLabel !== "string" ||
    !value.statusLabel.trim() ||
    value.synthetic !== true
  )
    return null;
  return {
    id: value.id,
    version: value.version,
    status: value.status,
    statusLabel: value.statusLabel,
  };
}

function parseSavedDraft(value: unknown): HealthIncidentSavedDraft | null {
  const draft = parseDraft(value);
  if (
    !draft ||
    draft.status !== "DRAFT" ||
    !isRecord(value) ||
    typeof value.studentId !== "string" ||
    !UUID.test(value.studentId) ||
    typeof value.observationCode !== "string" ||
    !OBSERVATION_CODES.includes(value.observationCode as HealthIncidentObservationCode) ||
    typeof value.dispositionCode !== "string" ||
    !DISPOSITION_CODES.includes(value.dispositionCode as HealthIncidentDispositionCode)
  )
    return null;
  return {
    ...draft,
    status: "DRAFT",
    studentId: value.studentId,
    observationCode: value.observationCode as HealthIncidentObservationCode,
    dispositionCode: value.dispositionCode as HealthIncidentDispositionCode,
  };
}

function parseParentNotice(value: unknown): ParentHealthNotice | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !validVersion(value.version) ||
    value.status !== "PUBLISHED" ||
    typeof value.studentLabel !== "string" ||
    !value.studentLabel.trim() ||
    typeof value.parentSummary !== "string" ||
    !value.parentSummary.trim() ||
    !["UNREAD", "READ", "ACKNOWLEDGED"].includes(String(value.receiptStatus)) ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    value.synthetic !== true
  )
    return null;
  return {
    id: value.id,
    version: value.version,
    status: "PUBLISHED",
    studentLabel: value.studentLabel,
    parentSummary: value.parentSummary,
    receiptStatus: value.receiptStatus as ParentHealthNotice["receiptStatus"],
    updatedAt: value.updatedAt,
    synthetic: true,
  };
}

function incidentPath(id: string, action: string): string {
  if (!UUID.test(id)) throw healthError("健康事项");
  return `/parent/health-incidents/${id}/${action}`;
}

export function createHealthIncidentClient(transport: HealthIncidentTransport) {
  return {
    async loadStaffStudents(): Promise<HealthIncidentStudentOption[]> {
      const value = await transport.get("/staff/health-incidents/students");
      if (!Array.isArray(value)) throw healthError("学生列表");
      const students = value.map(parseStudent);
      if (students.some((student) => student === null)) throw healthError("学生列表");
      return students as HealthIncidentStudentOption[];
    },

    async loadStaffDrafts(): Promise<HealthIncidentSavedDraft[]> {
      const value = await transport.get("/staff/health-incidents/drafts");
      if (!Array.isArray(value)) throw healthError("健康事项");
      const drafts = value.map(parseSavedDraft);
      if (drafts.some((draft) => draft === null)) throw healthError("健康事项");
      return drafts as HealthIncidentSavedDraft[];
    },

    async createStaffDraft(input: {
      readonly studentId: string;
      readonly observationCode: HealthIncidentObservationCode;
      readonly dispositionCode: HealthIncidentDispositionCode;
    }): Promise<HealthIncidentDraft> {
      if (
        !UUID.test(input.studentId) ||
        !OBSERVATION_CODES.includes(input.observationCode) ||
        !DISPOSITION_CODES.includes(input.dispositionCode)
      )
        throw healthError("健康事项");
      const value = await transport.post("/staff/health-incidents", input);
      const draft = parseDraft(value);
      if (!draft) throw healthError("健康事项");
      return draft;
    },

    async submitStaffDraft(id: string, version: number): Promise<HealthIncidentDraft> {
      if (!UUID.test(id) || !validVersion(version)) throw healthError("健康事项");
      const value = await transport.post(`/staff/health-incidents/${id}/submit`, { version });
      const draft = parseDraft(value);
      if (!draft) throw healthError("健康事项");
      return draft;
    },

    async loadParentNotices(): Promise<ParentHealthNotice[]> {
      const value = await transport.get("/parent/health-incidents");
      if (!Array.isArray(value)) throw healthError("家长健康消息");
      const notices = value.map(parseParentNotice);
      if (notices.some((notice) => notice === null)) throw healthError("家长健康消息");
      return notices as ParentHealthNotice[];
    },

    async markParentNoticeRead(id: string, version: number): Promise<ParentHealthNotice> {
      if (!validVersion(version)) throw healthError("家长健康消息");
      const value = await transport.post(incidentPath(id, "read"), { version });
      const notice = parseParentNotice(value);
      if (!notice) throw healthError("家长健康消息");
      return notice;
    },

    async acknowledgeParentNotice(id: string, version: number): Promise<ParentHealthNotice> {
      if (!validVersion(version)) throw healthError("家长健康消息");
      const value = await transport.post(incidentPath(id, "ack"), { version });
      const notice = parseParentNotice(value);
      if (!notice) throw healthError("家长健康消息");
      return notice;
    },
  };
}
