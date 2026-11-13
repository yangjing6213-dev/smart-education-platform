export type CredentialCategory =
  "TEACHER_QUALIFICATION" | "FIRST_AID_TRAINING" | "CHILDCARE_TRAINING";

export type CredentialResponsibleRole = "CAMPUS_OWNER" | "STAFF_MEMBER";
export type CredentialExpiryStatus = "EXPIRED" | "DUE_SOON" | "VALID" | "INVALID_DATE";

export interface CredentialDraft {
  readonly staffId: string;
  readonly category: CredentialCategory;
  readonly issueDate: string;
  readonly expiryDate: string;
  readonly responsibleRole: CredentialResponsibleRole;
}

export interface CredentialHistoryEvent {
  readonly action: "CREATED" | "UPDATED";
  readonly version: number;
  readonly date: string;
}

export interface StaffCredential {
  readonly id: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly staffId: string;
  readonly staffName: string;
  readonly category: CredentialCategory;
  readonly issueDate: string;
  readonly expiryDate: string;
  readonly responsibleRole: CredentialResponsibleRole;
  readonly version: number;
  readonly expiryStatus: CredentialExpiryStatus;
  readonly history: readonly CredentialHistoryEvent[];
  readonly synthetic: true;
}

export type CredentialResult =
  | { readonly ok: true; readonly record: StaffCredential }
  | { readonly ok: false; readonly error: "INVALID_INPUT" | "VERSION_CONFLICT" };

export interface StaffCredentialStore {
  list(): readonly StaffCredential[];
  find(id: string): StaffCredential | undefined;
  create(input: unknown): CredentialResult;
  update(id: string, expectedVersion: number, input: unknown): CredentialResult;
}

export const CREDENTIAL_CATEGORY_LABELS: Readonly<Record<CredentialCategory, string>> = {
  TEACHER_QUALIFICATION: "教师资格",
  FIRST_AID_TRAINING: "急救培训",
  CHILDCARE_TRAINING: "托育培训",
};

export const CREDENTIAL_ROLE_LABELS: Readonly<Record<CredentialResponsibleRole, string>> = {
  CAMPUS_OWNER: "校区负责人",
  STAFF_MEMBER: "员工本人",
};

export const SYNTHETIC_CREDENTIAL_STAFF = [
  { id: "staff-teacher-one", name: "模拟教师一号" },
  { id: "staff-duty-member", name: "模拟值班成员" },
] as const;

const CATEGORIES = new Set(Object.keys(CREDENTIAL_CATEGORY_LABELS));
const RESPONSIBLE_ROLES = new Set(Object.keys(CREDENTIAL_ROLE_LABELS));
const DRAFT_KEYS = ["category", "expiryDate", "issueDate", "responsibleRole", "staffId"];
const CREDENTIAL_SCOPE = {
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-east",
} as const;

type StoredCredential = Omit<StaffCredential, "expiryStatus" | "staffName">;

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function parseDraft(value: unknown): CredentialDraft | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join("|") !== DRAFT_KEYS.join("|")) return undefined;
  if (!SYNTHETIC_CREDENTIAL_STAFF.some((staff) => staff.id === input.staffId)) return undefined;
  if (typeof input.category !== "string" || !CATEGORIES.has(input.category)) return undefined;
  if (!isIsoDate(input.issueDate) || !isIsoDate(input.expiryDate)) return undefined;
  if (input.expiryDate < input.issueDate) return undefined;
  if (typeof input.responsibleRole !== "string" || !RESPONSIBLE_ROLES.has(input.responsibleRole)) {
    return undefined;
  }
  return input as unknown as CredentialDraft;
}

function cloneRecord(record: StoredCredential, today: string): StaffCredential {
  const staffName = SYNTHETIC_CREDENTIAL_STAFF.find((staff) => staff.id === record.staffId)?.name;
  if (staffName === undefined) throw new Error("Synthetic staff record is missing.");
  return {
    ...record,
    staffName,
    expiryStatus: credentialExpiryStatus(record.expiryDate, today),
    history: record.history.map((event) => ({ ...event })),
    synthetic: true,
  };
}

export function credentialExpiryStatus(expiryDate: string, today: string): CredentialExpiryStatus {
  if (!isIsoDate(expiryDate) || !isIsoDate(today)) return "INVALID_DATE";
  const daysRemaining =
    (Date.parse(`${expiryDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86_400_000;
  if (daysRemaining < 0) return "EXPIRED";
  if (daysRemaining <= 30) return "DUE_SOON";
  return "VALID";
}

export function createStaffCredentialStore(
  today: () => string = () => new Date().toISOString().slice(0, 10),
): StaffCredentialStore {
  let nextId = 3;
  let records: StoredCredential[] = [
    {
      id: "credential-synthetic-001",
      ...CREDENTIAL_SCOPE,
      staffId: "staff-teacher-one",
      category: "TEACHER_QUALIFICATION",
      issueDate: "2025-10-21",
      expiryDate: "2026-10-21",
      responsibleRole: "CAMPUS_OWNER",
      version: 1,
      history: [{ action: "CREATED", version: 1, date: "2026-01-10" }],
      synthetic: true,
    },
    {
      id: "credential-synthetic-002",
      ...CREDENTIAL_SCOPE,
      staffId: "staff-duty-member",
      category: "FIRST_AID_TRAINING",
      issueDate: "2026-04-01",
      expiryDate: "2027-04-01",
      responsibleRole: "STAFF_MEMBER",
      version: 1,
      history: [{ action: "CREATED", version: 1, date: "2026-04-01" }],
      synthetic: true,
    },
  ];

  return {
    list: () => records.map((record) => cloneRecord(record, today())),
    find: (id) => {
      const record = records.find((candidate) => candidate.id === id);
      return record === undefined ? undefined : cloneRecord(record, today());
    },
    create: (input) => {
      const draft = parseDraft(input);
      if (draft === undefined) return { ok: false, error: "INVALID_INPUT" };
      const version = 1;
      const record: StoredCredential = {
        id: `credential-synthetic-${String(nextId++).padStart(3, "0")}`,
        ...CREDENTIAL_SCOPE,
        ...draft,
        version,
        history: [{ action: "CREATED", version, date: today() }],
        synthetic: true,
      };
      records = [...records, record];
      return { ok: true, record: cloneRecord(record, today()) };
    },
    update: (id, expectedVersion, input) => {
      const index = records.findIndex((candidate) => candidate.id === id);
      if (index < 0 || records[index]?.version !== expectedVersion) {
        return { ok: false, error: "VERSION_CONFLICT" };
      }
      const draft = parseDraft(input);
      if (draft === undefined) return { ok: false, error: "INVALID_INPUT" };
      const current = records[index];
      if (current === undefined) return { ok: false, error: "VERSION_CONFLICT" };
      const version = current.version + 1;
      const record: StoredCredential = {
        ...current,
        ...draft,
        version,
        history: [...current.history, { action: "UPDATED", version, date: today() }],
      };
      records = records.map((candidate, candidateIndex) =>
        candidateIndex === index ? record : candidate,
      );
      return { ok: true, record: cloneRecord(record, today()) };
    },
  };
}
