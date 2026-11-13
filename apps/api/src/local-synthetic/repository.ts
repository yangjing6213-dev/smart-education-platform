export interface ScopedRow {
  id: string;
  version: number;
  tenantId: string;
  campusId: string;
  classId: string;
}
export interface Binding extends ScopedRow {
  kind: "binding";
  guardianId: string;
  studentId: string;
  relationship: "GUARDIAN";
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "RELEASED";
  submittedAt?: string;
  reviewedAt?: string | null;
  relationshipId?: string;
}
export interface Leave extends ScopedRow {
  kind: "leave";
  bindingId: string;
  guardianId: string;
  studentId: string;
  startDate: string;
  endDate: string;
  reason: "FAMILY_ARRANGEMENT" | "TEMPORARY_MATTER";
  status: "SUBMITTED" | "RETURNED" | "CONFIRMED" | "WITHDRAWN";
  acknowledged: boolean;
  updatedBy: string;
  updatedAt: string;
  history: LeaveRevision[];
}
export type LeaveRevision = Pick<
  Leave,
  | "version"
  | "startDate"
  | "endDate"
  | "reason"
  | "status"
  | "acknowledged"
  | "updatedBy"
  | "updatedAt"
>;
export interface LocalAudit {
  actorId: string;
  objectId: string | null;
  version: number | null;
  action: string;
  outcome: "ACCEPTED" | "DENIED";
  at: string;
  tenantId: string;
  campusId: string;
}

export interface CareValues {
  arrival: "ARRIVED_AS_PLANNED" | "LATE" | "ABSENT";
  homework: "COMPLETED" | "IN_PROGRESS" | "NEEDS_SUPPORT";
  meal: "FINISHED" | "PARTIAL" | "NOT_RECORDED";
  rest: "RESTED" | "QUIET_ACTIVITY" | "NOT_RECORDED";
  activity: "PARTICIPATED" | "OBSERVED" | "NOT_RECORDED";
  wellbeing: "ROUTINE" | "CHECK_IN" | "FOLLOW_UP";
}
export interface Care extends ScopedRow {
  kind: "care";
  studentId: string;
  date: string;
  values: CareValues;
  status: "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "CANCELLED" | "EXCEPTION_PENDING";
  createdBy: string;
  reviewedBy: string | null;
  updatedBy: string;
  updatedAt: string;
  published: boolean;
  publicationVersion: number;
  history: CareRevision[];
}
export type CareRevision = Pick<
  Care,
  | "version"
  | "values"
  | "status"
  | "reviewedBy"
  | "updatedBy"
  | "updatedAt"
  | "published"
  | "publicationVersion"
>;
interface CareReceipt {
  guardianId: string;
  bindingId: string;
  recordId: string;
  publicationVersion: number;
  status: "READ" | "ACKNOWLEDGED";
}

/** A single process owns all mutable rows; callers only receive detached copies. */
export interface AttendanceValues {
  status: "NOT_ARRIVED" | "ARRIVED" | "DEPARTED";
  arrivalTime: string | null;
  departureTime: string | null;
}
export interface AttendanceCorrection {
  id: string;
  status: "PENDING" | "APPROVED" | "RETURNED";
  reason: "TIME_ENTRY_ERROR" | "EVENT_ENTRY_ERROR" | "LATE_ENTRY";
  proposed: AttendanceValues;
  original: AttendanceValues;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}
export interface Attendance extends ScopedRow, AttendanceValues {
  kind: "attendance";
  studentId: string;
  date: string;
  corrected: boolean;
  updatedBy: string;
  updatedAt: string;
  correction: AttendanceCorrection | null;
  history: AttendanceRevision[];
}
export type AttendanceRevision = Pick<
  Attendance,
  | "version"
  | "status"
  | "arrivalTime"
  | "departureTime"
  | "corrected"
  | "updatedBy"
  | "updatedAt"
  | "correction"
>;
export type PickupRecipient = "pickup-alpha" | "pickup-beta";
export type PickupAuthorizationType = "REGULAR" | "TEMPORARY";
export type PickupAuthorizationStatus = "DRAFT" | "ACTIVE" | "REVOKED";
export interface PickupAuthorization extends ScopedRow {
  kind: "pickupAuthorization";
  bindingId: string;
  guardianId: string;
  studentId: string;
  recipient: PickupRecipient;
  type: PickupAuthorizationType;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  status: PickupAuthorizationStatus;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}
export interface PickupRecord extends ScopedRow {
  kind: "pickup";
  authorizationId: string;
  authorizationVersion: number;
  bindingId: string;
  studentId: string;
  date: string;
  time: string;
  recipient: PickupRecipient;
  teacherId: string;
  deviceLabel: string;
  attendanceId: string;
  attendanceVersion: number;
  checks: {
    student: true;
    recipient: true;
    authorization: true;
  };
  createdAt: string;
}
export type PickupExceptionCategory =
  "NO_AUTHORIZATION" | "INFORMATION_MISMATCH" | "INVALID_CREDENTIAL" | "OVERDUE";
export type PickupExceptionStatus = "OPEN" | "FOLLOWING" | "RESOLVED";
export type PickupExceptionOutcome =
  "CONTACT_GUARDIAN" | "INFORMATION_RECHECKED" | "ARRANGEMENT_CONFIRMED";
export interface PickupException extends ScopedRow {
  kind: "pickupException";
  studentId: string;
  date: string;
  category: PickupExceptionCategory;
  status: PickupExceptionStatus;
  createdBy: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  outcome: PickupExceptionOutcome | null;
}
export type FeeDocumentType = "FEE_ITEM" | "BILL" | "RECEIPT" | "AGREEMENT";
export type FeeDocumentStatus = "AVAILABLE" | "PAID" | "VOIDED" | "EXPIRED" | "REVOKED";
export interface FeeDocument extends ScopedRow {
  kind: "feeDocument";
  documentType: FeeDocumentType;
  studentId: string;
  bindingVersion: number;
  title: string;
  amount: number | null;
  currency: "CNY";
  period: string;
  sourceVersion: number;
  validFrom: string;
  validTo: string;
  status: FeeDocumentStatus;
  unavailableReason: string | null;
  summary: string;
}
export type FinanceLedgerEntryType = "CHARGE" | "PAYMENT" | "REFUND";
export interface FinanceLedgerRecord extends ScopedRow {
  kind: "financeLedgerEntry";
  studentId: string;
  bindingVersion: number;
  type: FinanceLedgerEntryType;
  amountMinor: number;
  currency: "CNY";
  period: string;
  occurredOn: string;
  documentId: string;
  documentVersion: number;
  synthetic: true;
}
export type NoticeTemplate = "INSTITUTION_ANNOUNCEMENT" | "CLASS_ACTIVITY";
export type NoticeTarget = "INSTITUTION" | "CLASS";
export type NoticeStatus =
  "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "PUBLISHED" | "REVOKED";
export interface Notice extends ScopedRow {
  kind: "notice";
  template: NoticeTemplate;
  target: NoticeTarget;
  title: string;
  body: string;
  requiresAcknowledgment: boolean;
  status: NoticeStatus;
  published: boolean;
  authorId: string;
  updatedBy: string;
  updatedAt: string;
}
export interface NoticeReceipt {
  guardianId: string;
  noticeId: string;
  version: number;
  status: "READ" | "ACKNOWLEDGED";
}
export type HealthIncidentObservationCode =
  "ROUTINE_OBSERVATION" | "NEEDS_FOLLOW_UP" | "URGENT_REVIEW";
export type HealthIncidentDispositionCode =
  "OBSERVATION_RECHECKED" | "FOLLOW_UP_SCHEDULED" | "GUARDIAN_SUMMARY_PREPARED";
export type HealthIncidentSummaryCode =
  "FOLLOW_UP_IN_PROGRESS" | "FOLLOW_UP_COMPLETED" | "PLEASE_CHECK_PAGE_LATER";
export type HealthIncidentStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "RETURNED"
  | "CONFIRMED"
  | "EXCEPTION_PENDING"
  | "PUBLISHED"
  | "REVOKED"
  | "WITHDRAWN";
export interface HealthIncident extends ScopedRow {
  kind: "healthIncident";
  bindingId: string;
  bindingVersion: number;
  studentId: string;
  observationCode: HealthIncidentObservationCode;
  dispositionCode: HealthIncidentDispositionCode | null;
  summaryCode: HealthIncidentSummaryCode | null;
  status: HealthIncidentStatus;
  published: boolean;
  createdBy: string;
  reviewedBy: string | null;
  updatedBy: string;
  updatedAt: string;
}
export interface HealthIncidentReceipt {
  guardianId: string;
  incidentId: string;
  version: number;
  status: "READ" | "ACKNOWLEDGED";
}
export type StaffDailyArrivalCode = "ARRIVED_AS_PLANNED" | "LATE" | "ABSENT";
export type StaffDailyHomeworkCode = "COMPLETED" | "IN_PROGRESS" | "NEEDS_SUPPORT";
export type StaffDailyActivityCode = "PARTICIPATED" | "OBSERVED" | "NOT_RECORDED";
export type StaffDailyClassroomCode = "ROUTINE" | "NEEDS_ATTENTION" | "NEEDS_FOLLOW_UP";
export type StaffDailyFollowUpCode = "NONE" | "OBSERVE_TOMORROW" | "OWNER_ATTENTION";
export interface StaffDailyValues {
  arrival: StaffDailyArrivalCode;
  homework: StaffDailyHomeworkCode;
  activity: StaffDailyActivityCode;
  classroom: StaffDailyClassroomCode;
  followUp: StaffDailyFollowUpCode;
}
export type StaffDailySourceKind =
  "TASK" | "ATTENDANCE" | "CARE_RECORD" | "PICKUP" | "PICKUP_EXCEPTION";
export interface StaffDailySourceReference {
  kind: StaffDailySourceKind;
  id: string;
  version: number;
}
export type StaffDailyStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED";
export interface StaffDailyReport extends ScopedRow {
  kind: "staffDaily";
  date: string;
  values: StaffDailyValues;
  sourceRefs: StaffDailySourceReference[];
  status: StaffDailyStatus;
  createdBy: string;
  reviewedBy: string | null;
  updatedBy: string;
  updatedAt: string;
}

export type MonthlyFeedbackSupplementCode = "KEEP_WATCHING" | "PROGRESSING" | "FOLLOW_UP";
export interface MonthlyFeedbackSupplements {
  learningParticipation: MonthlyFeedbackSupplementCode;
  dailyHabits: MonthlyFeedbackSupplementCode;
  activityParticipation: MonthlyFeedbackSupplementCode;
  familySchoolCollaboration: MonthlyFeedbackSupplementCode;
}
export type MonthlyFeedbackSourceKind = "GROWTH_RECORD" | "ATTENDANCE_OVERVIEW" | "STAFF_DAILY";
export interface MonthlyFeedbackSource {
  kind: MonthlyFeedbackSourceKind;
  id: string;
  version: number;
  date: string;
}
export interface MonthlyFeedbackSourceSummary {
  kind: MonthlyFeedbackSourceKind;
  label: string;
  count: number;
  dates: string[];
}
export type MonthlyFeedbackStatus =
  "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "PUBLISHED" | "REVIEW_REQUIRED";
export interface MonthlyFeedback extends ScopedRow {
  kind: "monthlyFeedback";
  month: string;
  sourceVersion: number;
  sources: MonthlyFeedbackSource[];
  supplements: MonthlyFeedbackSupplements;
  status: MonthlyFeedbackStatus;
  createdBy: string;
  reviewedBy: string | null;
  published: boolean;
  parentAcknowledgedBy: string[];
  updatedBy: string;
  updatedAt: string;
}
export type SupplyRequestCatalogCode =
  "STATIONERY_SET" | "ART_ACTIVITY_SET" | "CLEANING_SET" | "FIRST_AID_SET";
export type SupplyRequestPurposeCode = "CLASS_ACTIVITY" | "DAILY_OPERATION" | "EMERGENCY_STOCK";
export type SupplyRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CONFIRMED"
  | "RETURNED"
  | "READY"
  | "OUT_OF_STOCK"
  | "CANCELLED"
  | "CLAIMED";
export interface SupplyRequest extends ScopedRow {
  kind: "supplyRequest";
  catalog: SupplyRequestCatalogCode;
  quantity: number;
  purpose: SupplyRequestPurposeCode;
  status: SupplyRequestStatus;
  createdBy: string;
  reviewedBy: string | null;
  claimedBy: string | null;
  updatedBy: string;
  updatedAt: string;
}
export type StaffTaskCode =
  "DAILY_CHECK" | "TEMPORARY_SUPPORT" | "STUDENT_FOLLOW_UP" | "ACTIVITY_SETUP" | "SAFETY_RESPONSE";
export type StaffTaskTargetType = "CLASS" | "STUDENT" | "ACTIVITY" | "CAMPUS";
export type StaffTaskPriority = "NORMAL" | "IMPORTANT" | "URGENT";
export type StaffTaskStatus =
  "ASSIGNED" | "CLAIMED" | "IN_PROGRESS" | "COMPLETED" | "CHECKED" | "RETURNED" | "CANCELLED";
export type StaffTaskResult = "COMPLETED_AS_PLANNED" | "FOLLOW_UP_REQUIRED" | "BLOCKED";
export interface StaffTask extends ScopedRow {
  kind: "staffTask";
  code: StaffTaskCode;
  targetType: StaffTaskTargetType;
  targetId: string;
  dueDate: string;
  priority: StaffTaskPriority;
  status: StaffTaskStatus;
  createdBy: string;
  assigneeId: string;
  claimedBy: string | null;
  completedBy: string | null;
  result: StaffTaskResult | null;
  checkerId: string | null;
  updatedBy: string;
  updatedAt: string;
}
export type ResourceLibraryScope = "CAMPUS" | "CLASS";
export type ResourceLibraryStatus = "PUBLISHED" | "REVOKED";
export type ResourceLibraryAudience = "PARENT" | "TEACHER" | "OWNER";
export interface ResourceLibraryRecord extends ScopedRow {
  kind: "resourceLibrary";
  scope: ResourceLibraryScope;
  audienceRoles: ResourceLibraryAudience[];
  category: "LESSON" | "EXERCISE" | "READING" | "REFERENCE";
  title: string;
  summary: string;
  content: string;
  grade: string;
  subject: string;
  tags: string[];
  sourceLabel: string;
  ownerId: string;
  ownerRole: "机构负责人";
  ownerLabel: string;
  status: ResourceLibraryStatus;
  expiresOn: string;
  updatedBy: string;
  updatedAt: string;
  learningSourceGovernance?: {
    collection: "SYNTHETIC_CAMPUS_MATH_SET";
    revision: "SYNTHETIC_2026_10_V1";
    reviewStatus: "PENDING_REVIEW" | "APPROVED" | "RETURNED";
    reviewedAt: string | null;
  };
}
export interface ResourceLibraryFilter {
  query?: string;
  grade?: string;
  subject?: string;
  tag?: string;
}
export interface ResourceLibraryProjection extends ResourceLibraryRecord {
  favorite: boolean;
  lastUsedAt?: string;
}
export interface ResourceLibraryUpdate {
  version: number;
  scope: ResourceLibraryScope;
  expiresOn: string;
  classId?: string;
  learningSourceAction?: "APPROVE" | "RETURN";
}
export interface ResourceLibrarySummary {
  total: number;
  published: number;
  expired: number;
  revoked: number;
}
type LocalRow =
  | Binding
  | Leave
  | Care
  | Attendance
  | PickupAuthorization
  | PickupRecord
  | PickupException
  | FeeDocument
  | FinanceLedgerRecord
  | Notice
  | HealthIncident
  | StaffDailyReport
  | MonthlyFeedback
  | SupplyRequest
  | StaffTask
  | ResourceLibraryRecord;

export class LocalRepository {
  readonly #rows = new Map<string, LocalRow>();
  readonly #audits: LocalAudit[] = [];
  readonly #careReceipts = new Map<string, CareReceipt>();
  readonly #noticeReceipts = new Map<string, NoticeReceipt>();
  readonly #healthIncidentReceipts = new Map<string, HealthIncidentReceipt>();
  get(id: string) {
    const row = this.#rows.get(id);
    return row ? structuredClone(row) : undefined;
  }
  list() {
    return [...this.#rows.values()].map((row) => structuredClone(row));
  }
  insert(row: LocalRow) {
    if (this.#rows.has(row.id)) throw new Error("Duplicate server-generated identifier.");
    this.#rows.set(row.id, structuredClone(row));
  }
  replaceBatch(rows: readonly LocalRow[]) {
    // Validate the entire write set before committing any member of a batch.
    if (
      new Set(rows.map((row) => row.id)).size !== rows.length ||
      rows.some((row) => this.#rows.get(row.id)?.version !== row.version - 1)
    )
      return false;
    for (const row of rows) {
      const previous = this.#rows.get(row.id);
      const next = structuredClone(row);
      if (next.kind === "leave" && previous?.kind === "leave") {
        const { version, startDate, endDate, reason, status, acknowledged, updatedBy, updatedAt } =
          previous;
        next.history = [
          ...structuredClone(previous.history),
          { version, startDate, endDate, reason, status, acknowledged, updatedBy, updatedAt },
        ];
      }
      if (next.kind === "care" && previous?.kind === "care") {
        const {
          version,
          values,
          status,
          reviewedBy,
          updatedBy,
          updatedAt,
          published,
          publicationVersion,
        } = previous;
        next.history = [
          ...structuredClone(previous.history),
          {
            version,
            values: structuredClone(values),
            status,
            reviewedBy,
            updatedBy,
            updatedAt,
            published,
            publicationVersion,
          },
        ];
      }
      if (next.kind === "attendance" && previous?.kind === "attendance") {
        const {
          version,
          status,
          arrivalTime,
          departureTime,
          corrected,
          updatedBy,
          updatedAt,
          correction,
        } = previous;
        next.history = [
          ...structuredClone(previous.history),
          {
            version,
            status,
            arrivalTime,
            departureTime,
            corrected,
            updatedBy,
            updatedAt,
            correction: structuredClone(correction),
          },
        ];
      }
      this.#rows.set(row.id, next);
      if (row.kind === "leave" && next.kind === "leave")
        row.history = structuredClone(next.history);
      if (row.kind === "care" && next.kind === "care") row.history = structuredClone(next.history);
      if (row.kind === "attendance" && next.kind === "attendance")
        row.history = structuredClone(next.history);
    }
    return true;
  }
  replaceAndInsertBatch(replacements: readonly LocalRow[], inserts: readonly LocalRow[]) {
    const ids = [...replacements, ...inserts].map((row) => row.id);
    if (
      new Set(ids).size !== ids.length ||
      inserts.some((row) => this.#rows.has(row.id)) ||
      replacements.some((row) => this.#rows.get(row.id)?.version !== row.version - 1)
    )
      return false;
    // Validate every row before changing the map. This is the local atomic boundary used by pickup.
    for (const row of replacements) {
      const previous = this.#rows.get(row.id);
      const next = structuredClone(row);
      if (next.kind === "attendance" && previous?.kind === "attendance") {
        const {
          version,
          status,
          arrivalTime,
          departureTime,
          corrected,
          updatedBy,
          updatedAt,
          correction,
        } = previous;
        next.history = [
          ...structuredClone(previous.history),
          {
            version,
            status,
            arrivalTime,
            departureTime,
            corrected,
            updatedBy,
            updatedAt,
            correction: structuredClone(correction),
          },
        ];
      }
      this.#rows.set(row.id, next);
    }
    for (const row of inserts) this.#rows.set(row.id, structuredClone(row));
    return true;
  }
  audit(event: LocalAudit) {
    this.#audits.push(structuredClone(event));
  }
  audits() {
    return structuredClone(this.#audits);
  }
  careReceipt(guardianId: string, bindingId: string, recordId: string, publicationVersion: number) {
    const value = this.#careReceipts.get(
      JSON.stringify([guardianId, bindingId, recordId, publicationVersion]),
    );
    return value ? structuredClone(value) : undefined;
  }
  setCareReceipt(receipt: CareReceipt) {
    const key = JSON.stringify([
      receipt.guardianId,
      receipt.bindingId,
      receipt.recordId,
      receipt.publicationVersion,
    ]);
    this.#careReceipts.set(key, structuredClone(receipt));
  }
  noticeReceipt(guardianId: string, noticeId: string, version: number) {
    const value = this.#noticeReceipts.get(JSON.stringify([guardianId, noticeId, version]));
    return value ? structuredClone(value) : undefined;
  }
  setNoticeReceipt(receipt: NoticeReceipt) {
    const key = JSON.stringify([receipt.guardianId, receipt.noticeId, receipt.version]);
    this.#noticeReceipts.set(key, structuredClone(receipt));
  }
  clearNoticeReceipts(noticeId: string, keepVersion?: number) {
    for (const [key, value] of this.#noticeReceipts) {
      if (value.noticeId === noticeId && value.version !== keepVersion)
        this.#noticeReceipts.delete(key);
    }
  }
  healthIncidentReceipt(guardianId: string, incidentId: string, version: number) {
    const value = this.#healthIncidentReceipts.get(
      JSON.stringify([guardianId, incidentId, version]),
    );
    return value ? structuredClone(value) : undefined;
  }
  setHealthIncidentReceipt(receipt: HealthIncidentReceipt) {
    const key = JSON.stringify([receipt.guardianId, receipt.incidentId, receipt.version]);
    this.#healthIncidentReceipts.set(key, structuredClone(receipt));
  }
  clearHealthIncidentReceipts(incidentId: string, keepVersion?: number) {
    for (const [key, value] of this.#healthIncidentReceipts) {
      if (value.incidentId === incidentId && value.version !== keepVersion)
        this.#healthIncidentReceipts.delete(key);
    }
  }
}
