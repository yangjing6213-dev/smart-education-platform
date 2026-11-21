import type { TrustedAuthResult } from "@student-care/auth";
import type { StaffLibraryOperations } from "../modules/staff-library/operations.js";
import type { StudentTransferOperations } from "../modules/student-transfers/student-transfer.service.js";
import type { StaffDailyAuditEvent } from "@student-care/contracts";
import type { ScopeContext } from "@student-care/tenant";
import type { GuardianBindingOperations } from "../modules/guardian-bindings/guardian-binding.service.js";
import type { ActivityScope, ActivityService } from "../modules/activities/activity.service.js";
import type { AuditService } from "../modules/audit/audit.service.js";
import type { MealPublicationAuditOperations } from "../modules/audit/prisma-meal-publication-audit.service.js";
import type { CareRecordOperations } from "../modules/care-records/prisma-care-record.service.js";
import type { AttendanceOperations } from "../modules/attendance/prisma-attendance.service.js";
import type { LeaveOperations } from "../modules/leave/prisma-leave.service.js";
import type { PrismaMonthlyFeedbackService } from "../modules/monthly-feedback/prisma-monthly-feedback.service.js";
import type { PrismaChildMonthlyService } from "../modules/monthly-feedback/prisma-child-monthly.service.js";
import type { FileService } from "../modules/files/file.service.js";
import type { ContentService } from "../modules/content/content.service.js";
import type {
  InstitutionContentKind,
  InstitutionPublicScope,
  InstitutionServiceOperations,
} from "../modules/institution/institution.service.js";
import type { GuideScope, GuideService } from "../modules/guides/guide.service.js";
import type { MealOperations, MealScope } from "../modules/meals/meal.service.js";
import type { PartnerLinkService } from "../modules/partner-links/partner-link.service.js";
import type { ResourceService } from "../modules/resources/resource.service.js";
import type {
  TeacherProfileService,
  TeacherScope,
} from "../modules/teachers/public-profile.service.js";

export const CONTENT_SERVICE = Symbol("CONTENT_SERVICE");
export const ACTIVITY_SERVICE = Symbol("ACTIVITY_SERVICE");
export const PUBLIC_ACTIVITY_SCOPE_PROVIDER = Symbol("PUBLIC_ACTIVITY_SCOPE_PROVIDER");
export const MEAL_SERVICE = Symbol("MEAL_SERVICE");
export const PUBLIC_MEAL_SCOPE_PROVIDER = Symbol("PUBLIC_MEAL_SCOPE_PROVIDER");
export const PUBLIC_TEACHER_SCOPE_PROVIDER = Symbol("PUBLIC_TEACHER_SCOPE_PROVIDER");
export const TEACHER_PROFILE_SERVICE = Symbol("TEACHER_PROFILE_SERVICE");
export const TRUSTED_AUTH_PROVIDER = Symbol("TRUSTED_AUTH_PROVIDER");
export const STAFF_LIBRARY_OPERATIONS = Symbol("STAFF_LIBRARY_OPERATIONS");
export const MONTHLY_FEEDBACK_OPERATIONS = Symbol("MONTHLY_FEEDBACK_OPERATIONS");
export const CHILD_MONTHLY_OPERATIONS = Symbol("CHILD_MONTHLY_OPERATIONS");
export type ChildMonthlyOperations = Pick<
  PrismaChildMonthlyService,
  | "list"
  | "create"
  | "edit"
  | "submit"
  | "review"
  | "publish"
  | "resolveParentScope"
  | "listParent"
  | "acknowledgeParent"
>;
export type MonthlyFeedbackOperations = Pick<
  PrismaMonthlyFeedbackService,
  "list" | "create" | "edit" | "submit" | "review" | "publish"
>;
export const GUIDE_SERVICE = Symbol("GUIDE_SERVICE");
export const STAFF_GUIDE_SCOPE_PROVIDER = Symbol("STAFF_GUIDE_SCOPE_PROVIDER");
export const RESOURCE_SERVICE = Symbol("RESOURCE_SERVICE");
export const AUDIT_SERVICE = Symbol("AUDIT_SERVICE");
export const MEAL_PUBLICATION_AUDIT_SERVICE = Symbol("MEAL_PUBLICATION_AUDIT_SERVICE");
export const FILE_SERVICE = Symbol("FILE_SERVICE");
export const PARTNER_LINK_SERVICE = Symbol("PARTNER_LINK_SERVICE");
export const INSTITUTION_SERVICE = Symbol("INSTITUTION_SERVICE");
export const PUBLIC_INSTITUTION_SCOPE_PROVIDER = Symbol("PUBLIC_INSTITUTION_SCOPE_PROVIDER");

export interface ApiHttpRequest {
  readonly query: Record<string, unknown>;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly params: Record<string, string>;
}

export type InviteLoginResult =
  | {
      readonly ok: true;
      readonly access_token: string;
      readonly expires_at: string;
    }
  | {
      readonly ok: false;
      readonly reason: "AUTH_NOT_CONFIGURED" | "INVALID_CREDENTIALS";
    };

export type AccountUpdateFailure =
  | "ACCOUNT_NOT_FOUND"
  | "CURRENT_PASSWORD_INVALID"
  | "PROFILE_INVALID"
  | "PASSWORD_INVALID"
  | "USERNAME_INVALID"
  | "USERNAME_TAKEN"
  | "RATE_LIMITED"
  | "PROFILE_CHANGE_PENDING"
  | "PROFILE_CHANGE_NOT_FOUND"
  | "PROFILE_CHANGE_CONFLICT"
  | "FORBIDDEN_SCOPE";

export type AccountUpdateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: AccountUpdateFailure };

export interface AccountCenterRecord {
  readonly actor_id: string;
  readonly username: string;
  readonly display_name: string;
  readonly account_status: "ACTIVE" | "SUSPENDED" | "REVOKED";
}

export interface ProfileChangeRecord {
  readonly id: string;
  readonly actor_id: string;
  readonly display_name: string;
  readonly tenant_id: string;
  readonly status: "PENDING" | "APPROVED" | "REJECTED";
  readonly version: number;
  readonly created_at: string;
  readonly reviewed_at?: string;
}

export interface InviteAuthOperations {
  login(username: string, password: string): Promise<InviteLoginResult>;
  getTrustedAuthResult(
    request: ApiHttpRequest,
  ): TrustedAuthResult | undefined | Promise<TrustedAuthResult | undefined>;
  logout(request: ApiHttpRequest): void | Promise<void>;
  logoutAll(request: ApiHttpRequest): Promise<void>;
  getAccount(actorId: string): Promise<AccountCenterRecord | undefined>;
  updateProfile(actorId: string, displayName: string): Promise<AccountUpdateResult>;
  changeUsername(
    actorId: string,
    currentPassword: string,
    newUsername: string,
  ): Promise<AccountUpdateResult>;
  changePassword(
    actorId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AccountUpdateResult>;
  createProfileChangeRequest(
    actorId: string,
    tenantId: string,
    displayName: string,
  ): Promise<{ readonly result: AccountUpdateResult; readonly request?: ProfileChangeRecord }>;
  listProfileChangeRequests(tenantId: string): Promise<readonly ProfileChangeRecord[]>;
  reviewProfileChangeRequest(input: {
    readonly requestId: string;
    readonly tenantId: string;
    readonly reviewerId: string;
    readonly expectedVersion: number;
    readonly approved: boolean;
  }): Promise<AccountUpdateResult>;
}

export const INVITE_AUTH_SERVICE = Symbol("INVITE_AUTH_SERVICE");

export type TrustedAuthProvider = (
  request: ApiHttpRequest,
) => TrustedAuthResult | null | undefined | Promise<TrustedAuthResult | null | undefined>;

export type PublicTeacherScopeProvider = (
  request: ApiHttpRequest,
) => TeacherScope | undefined | Promise<TeacherScope | undefined>;

export type PublicActivityScopeProvider = (
  request: ApiHttpRequest,
) => ActivityScope | undefined | Promise<ActivityScope | undefined>;

export type PublicMealScopeProvider = (
  request: ApiHttpRequest,
) => MealScope | undefined | Promise<MealScope | undefined>;

export type PublicInstitutionScopeProvider = (
  request: ApiHttpRequest,
  kind: InstitutionContentKind,
) => InstitutionPublicScope | undefined | Promise<InstitutionPublicScope | undefined>;

export type StaffGuideScopeProvider = (
  request: ApiHttpRequest,
) => GuideScope | undefined | Promise<GuideScope | undefined>;

export interface ParentGovernanceContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}

export interface ParentGovernanceMember {
  readonly actorId: string;
  readonly profile: string;
  readonly label: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: string[];
  readonly actions: string[];
}

export interface ParentGovernanceOperations {
  resolveMember(context: ParentGovernanceContext): ParentGovernanceMember | undefined;
  parentPickup(member: ParentGovernanceMember): unknown;
  createParentPickupAuthorization(member: ParentGovernanceMember, value: unknown): unknown;
  activateParentPickupAuthorization(
    member: ParentGovernanceMember,
    id: string,
    value: unknown,
  ): unknown;
  revokeParentPickupAuthorization(
    member: ParentGovernanceMember,
    id: string,
    value: unknown,
  ): unknown;
  issueParentPickupCredential(member: ParentGovernanceMember, id: string, value: unknown): unknown;
  parentFees(member: ParentGovernanceMember): {
    readonly bindingApplications: readonly unknown[];
    readonly documents: readonly unknown[];
    readonly ledger: unknown;
  };
  parentMonthlyFeedback(member: ParentGovernanceMember): readonly unknown[];
  acknowledgeParentMonthlyFeedback(
    member: ParentGovernanceMember,
    id: string,
    value: unknown,
  ): unknown;
  parentNotices(member: ParentGovernanceMember): readonly unknown[];
  readParentNotice(member: ParentGovernanceMember, id: string, value: unknown): unknown;
  acknowledgeParentNotice(member: ParentGovernanceMember, id: string, value: unknown): unknown;
  parentHealthIncidents(member: ParentGovernanceMember): readonly unknown[];
  readParentHealthIncident(member: ParentGovernanceMember, id: string, value: unknown): unknown;
  acknowledgeParentHealthIncident(
    member: ParentGovernanceMember,
    id: string,
    value: unknown,
  ): unknown;
  parentLearning(member: ParentGovernanceMember): {
    readonly approvedStudents: readonly {
      readonly studentId: string;
      readonly studentLabel: string;
      readonly classLabel: string;
    }[];
    readonly parentControls: readonly unknown[];
    readonly parentSummary: readonly unknown[];
    readonly parentSummaryUpdatedAt: string;
  };
  updateParentLearningControls(
    member: ParentGovernanceMember,
    studentId: string,
    value: unknown,
  ): unknown;
  recordParentLearningContact(
    member: ParentGovernanceMember,
    studentId: string,
    value: unknown,
  ): unknown;
  studentOptions(member: ParentGovernanceMember): readonly {
    readonly id: string;
    readonly alias: string;
    readonly label: string;
  }[];
  policies(member: ParentGovernanceMember): unknown;
  listConsents(member: ParentGovernanceMember): unknown;
  createConsent(member: ParentGovernanceMember, value: unknown): unknown;
  revokeConsent(member: ParentGovernanceMember, id: string, value: unknown): unknown;
  listPrivacyRequests(member: ParentGovernanceMember): unknown;
  createPrivacyRequest(member: ParentGovernanceMember, value: unknown): unknown;
  withdrawPrivacyRequest(member: ParentGovernanceMember, id: string, value: unknown): unknown;
}

export const PARENT_GOVERNANCE_OPERATIONS = Symbol("PARENT_GOVERNANCE_OPERATIONS");

export interface ParentPickupContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}

export interface ParentPickupBindingView {
  readonly id: string;
  readonly version: number;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly classLabel: string;
  readonly status: "APPROVED";
}

export interface ParentPickupAuthorizationView {
  readonly id: string;
  readonly version: number;
  readonly status: "DRAFT" | "ACTIVE" | "REVOKED";
  readonly currentlyValid: boolean;
  readonly bindingId: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly classLabel: string;
  readonly recipient: "pickup-alpha" | "pickup-beta";
  readonly recipientLabel: string;
  readonly type: "REGULAR" | "TEMPORARY";
  readonly startDate: string;
  readonly endDate: string;
  readonly startTime: string;
  readonly endTime: string;
}

export interface ParentPickupRecordView {
  readonly id: string;
  readonly date: string;
  readonly time: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly recipient: string;
  readonly status: "COMPLETED";
}

export interface ParentPickupProjection {
  readonly bindings: readonly ParentPickupBindingView[];
  readonly authorizations: readonly ParentPickupAuthorizationView[];
  readonly records: readonly ParentPickupRecordView[];
}

export interface ParentPickupCredentialView {
  readonly credential: string;
  readonly expiresAt: string;
}

export interface StaffPickupCredentialPreview {
  readonly studentLabel: string;
  readonly classLabel: string;
  readonly recipientLabel: string;
}

export interface StaffPickupCredentialResult {
  readonly id: string;
  readonly status: "COMPLETED";
}

export interface ParentPickupOperations {
  list(context: ParentPickupContext): Promise<ParentPickupProjection>;
  create(context: ParentPickupContext, value: unknown): Promise<ParentPickupAuthorizationView>;
  activate(
    context: ParentPickupContext,
    authorizationId: string,
    value: unknown,
  ): Promise<ParentPickupAuthorizationView>;
  revoke(
    context: ParentPickupContext,
    authorizationId: string,
    value: unknown,
  ): Promise<ParentPickupAuthorizationView>;
  issueCredential(
    context: ParentPickupContext,
    authorizationId: string,
    value: unknown,
  ): Promise<ParentPickupCredentialView>;
  previewCredential(
    context: ParentPickupContext,
    value: unknown,
  ): Promise<StaffPickupCredentialPreview>;
  confirmCredential(
    context: ParentPickupContext,
    value: unknown,
  ): Promise<StaffPickupCredentialResult>;
}

export const PARENT_PICKUP_OPERATIONS = Symbol("PARENT_PICKUP_OPERATIONS");

export interface ParentLearningContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}

export interface ParentLearningSummaryInput {
  readonly studentId: string;
  readonly summaryDate: string;
  readonly usedMinutes: number;
  readonly sessionCount: number;
  readonly completedSessions: number;
  readonly knowledgePoints: readonly {
    readonly label: string;
    readonly sessionCount: number;
    readonly completedSessions: number;
  }[];
  readonly attentionCount: number;
}

export interface ParentLearningOperations {
  parentLearning(context: ParentLearningContext): Promise<unknown>;
  updateParentLearningControls(
    context: ParentLearningContext,
    studentId: string,
    value: unknown,
  ): Promise<unknown>;
  recordParentLearningContact(
    context: ParentLearningContext,
    studentId: string,
    value: unknown,
  ): Promise<unknown>;
  submitStaffSummary(context: ParentLearningContext, value: unknown): Promise<unknown>;
}

export const PARENT_LEARNING_OPERATIONS = Symbol("PARENT_LEARNING_OPERATIONS");

export interface ParentLearningSessionOperations {
  listSessions(context: ParentLearningContext, studentId: string): Promise<unknown>;
  createSession(
    context: ParentLearningContext,
    studentId: string,
    value: unknown,
  ): Promise<unknown>;
  getSession(context: ParentLearningContext, sessionId: string): Promise<unknown>;
  answerSession(
    context: ParentLearningContext,
    sessionId: string,
    value: unknown,
  ): Promise<unknown>;
  hintSession(context: ParentLearningContext, sessionId: string, value: unknown): Promise<unknown>;
  closeSession(context: ParentLearningContext, sessionId: string, value: unknown): Promise<unknown>;
}

export const PARENT_LEARNING_SESSION_OPERATIONS = Symbol("PARENT_LEARNING_SESSION_OPERATIONS");

export const FEES_OPERATIONS = Symbol("FEES_OPERATIONS");
export const STUDENT_TRANSFER_OPERATIONS = Symbol("STUDENT_TRANSFER_OPERATIONS");

export interface FeesContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}

export interface FeesOperations {
  parentFees(context: FeesContext): Promise<unknown>;
  adminFees(context: FeesContext): Promise<unknown>;
  createFee(context: FeesContext, value: unknown): Promise<unknown>;
  revokeFee(context: FeesContext, id: string, value: unknown): Promise<unknown>;
}

export const STAFF_TASK_WORKBENCH_OPERATIONS = Symbol("STAFF_TASK_WORKBENCH_OPERATIONS");

export interface StaffTaskWorkbenchContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}

export interface StaffTaskWorkbenchOperations {
  list(context: StaffTaskWorkbenchContext): unknown;
  adminList(context: StaffTaskWorkbenchContext): unknown;
  create(context: StaffTaskWorkbenchContext, body: unknown): unknown;
  check(context: StaffTaskWorkbenchContext, taskId: string, body: unknown): unknown;
  cancel(context: StaffTaskWorkbenchContext, taskId: string, body: unknown): unknown;
  claim(context: StaffTaskWorkbenchContext, taskId: string, body: unknown): unknown;
  start(context: StaffTaskWorkbenchContext, taskId: string, body: unknown): unknown;
  complete(context: StaffTaskWorkbenchContext, taskId: string, body: unknown): unknown;
}

export const STAFF_HEALTH_INCIDENT_REVIEW_OPERATIONS = Symbol(
  "STAFF_HEALTH_INCIDENT_REVIEW_OPERATIONS",
);

export const STAFF_DAILY_OPERATIONS = Symbol("STAFF_DAILY_OPERATIONS");

export type StaffDailyCapability = "daily:read" | "daily:create" | "daily:submit" | "daily:review";

export interface StaffDailyScopeAccess {
  readonly scope: ScopeContext;
  readonly capabilities: readonly StaffDailyCapability[];
}

export interface StaffDailyContext {
  readonly scopes: readonly StaffDailyScopeAccess[];
}

export type StaffDailyResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: {
        readonly code:
          "FORBIDDEN_SCOPE" | "VALIDATION_FAILED" | "NOT_FOUND_SCOPED" | "CONFLICT_STATE";
        readonly message: string;
      };
    };

export interface StaffDailyOperations {
  reviewList(
    context: StaffDailyContext,
  ):
    | StaffDailyResult<{ readonly records: readonly unknown[] }>
    | Promise<StaffDailyResult<{ readonly records: readonly unknown[] }>>;
  auditEvents(
    context: StaffDailyContext,
    reportId: string,
  ):
    | StaffDailyResult<{ readonly events: readonly StaffDailyAuditEvent[] }>
    | Promise<StaffDailyResult<{ readonly events: readonly StaffDailyAuditEvent[] }>>;
  review(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): StaffDailyResult<unknown> | Promise<StaffDailyResult<unknown>>;
  withdraw(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): StaffDailyResult<unknown> | Promise<StaffDailyResult<unknown>>;
  list(context: StaffDailyContext):
    | StaffDailyResult<{
        readonly records: readonly unknown[];
        readonly canCreate: boolean;
      }>
    | Promise<
        StaffDailyResult<{ readonly records: readonly unknown[]; readonly canCreate: boolean }>
      >;
  create(
    context: StaffDailyContext,
    body: unknown,
  ): StaffDailyResult<unknown> | Promise<StaffDailyResult<unknown>>;
  edit(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): StaffDailyResult<unknown> | Promise<StaffDailyResult<unknown>>;
  submit(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): StaffDailyResult<unknown> | Promise<StaffDailyResult<unknown>>;
  resubmit(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): StaffDailyResult<unknown> | Promise<StaffDailyResult<unknown>>;
}

export interface StaffHealthIncidentReviewContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}

export interface StaffHealthIncidentReviewOperations {
  listStudents?(context: StaffHealthIncidentReviewContext): unknown;
  listDrafts?(context: StaffHealthIncidentReviewContext): unknown;
  list(context: StaffHealthIncidentReviewContext): unknown;
  create?(context: StaffHealthIncidentReviewContext, body: unknown): unknown;
  submit?(context: StaffHealthIncidentReviewContext, incidentId: string, body: unknown): unknown;
  review(context: StaffHealthIncidentReviewContext, incidentId: string, body: unknown): unknown;
  supplement(context: StaffHealthIncidentReviewContext, incidentId: string, body: unknown): unknown;
  publish(context: StaffHealthIncidentReviewContext, incidentId: string, body: unknown): unknown;
  revoke(context: StaffHealthIncidentReviewContext, incidentId: string, body: unknown): unknown;
}

export interface ParentHealthIncidentContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}

export interface ParentHealthIncidentOperations {
  list(context: ParentHealthIncidentContext): unknown;
  read(context: ParentHealthIncidentContext, incidentId: string, body: unknown): unknown;
  acknowledge(context: ParentHealthIncidentContext, incidentId: string, body: unknown): unknown;
}

export const PARENT_HEALTH_INCIDENT_OPERATIONS = Symbol("PARENT_HEALTH_INCIDENT_OPERATIONS");

export interface StaffNoticeContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}

export interface StaffNoticeOperations {
  listAuthored(context: StaffNoticeContext): unknown;
  listForReview(context: StaffNoticeContext): unknown;
  create(context: StaffNoticeContext, body: unknown): unknown;
  submit(context: StaffNoticeContext, noticeId: string, body: unknown): unknown;
  review(context: StaffNoticeContext, noticeId: string, body: unknown): unknown;
  publish(context: StaffNoticeContext, noticeId: string, body: unknown): unknown;
  revoke(context: StaffNoticeContext, noticeId: string, body: unknown): unknown;
}

export interface ParentNoticeContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}

export interface ParentNoticeOperations {
  list(context: ParentNoticeContext): unknown;
  read(context: ParentNoticeContext, noticeId: string, body: unknown): unknown;
  acknowledge(context: ParentNoticeContext, noticeId: string, body: unknown): unknown;
}

export const STAFF_NOTICE_OPERATIONS = Symbol("STAFF_NOTICE_OPERATIONS");
export const PARENT_NOTICE_OPERATIONS = Symbol("PARENT_NOTICE_OPERATIONS");

export interface ApiAppOptions {
  readonly learningInstitutionSettingOperations?: LearningInstitutionSettingOperations;
  readonly parentLearningSessionOperations?: ParentLearningSessionOperations;
  readonly inviteAuthService?: InviteAuthOperations;
  readonly getTrustedAuthResult?: TrustedAuthProvider;
  readonly parentGovernanceOperations?: ParentGovernanceOperations;
  readonly parentPickupOperations?: ParentPickupOperations;
  readonly parentLearningOperations?: ParentLearningOperations;
  readonly feesOperations?: FeesOperations;
  readonly studentTransferOperations?: StudentTransferOperations;
  readonly parentHealthIncidentOperations?: ParentHealthIncidentOperations;
  readonly staffNoticeOperations?: StaffNoticeOperations;
  readonly parentNoticeOperations?: ParentNoticeOperations;
  readonly staffTaskWorkbenchOperations?: StaffTaskWorkbenchOperations;
  readonly staffLibraryOperations?: StaffLibraryOperations;
  readonly staffHealthIncidentReviewOperations?: StaffHealthIncidentReviewOperations;
  readonly staffDailyOperations?: StaffDailyOperations;
  readonly monthlyFeedbackOperations?: MonthlyFeedbackOperations;
  readonly childMonthlyOperations?: ChildMonthlyOperations;
  readonly guardianBindingOperations?: GuardianBindingOperations;
  readonly careRecordOperations?: CareRecordOperations;
  readonly attendanceOperations?: AttendanceOperations;
  readonly leaveOperations?: LeaveOperations;
  readonly contentService?: ContentService;
  readonly activityService?: ActivityService;
  readonly getPublicActivityScope?: PublicActivityScopeProvider;
  readonly mealService?: MealOperations;
  readonly getPublicMealScope?: PublicMealScopeProvider;
  readonly getPublicTeacherScope?: PublicTeacherScopeProvider;
  readonly teacherProfileService?: TeacherProfileService;
  readonly guideService?: GuideService;
  readonly getStaffGuideScope?: StaffGuideScopeProvider;
  readonly resourceService?: ResourceService;
  readonly auditService?: AuditService;
  readonly mealPublicationAuditService?: MealPublicationAuditOperations;
  readonly fileService?: FileService;
  readonly partnerLinkService?: PartnerLinkService;
  readonly institutionService?: InstitutionServiceOperations;
  readonly getPublicInstitutionScope?: PublicInstitutionScopeProvider;
}

export interface ApiHttpResponse {
  status(code: number): ApiHttpResponse;
  json(body: unknown): unknown;
}

export interface LearningInstitutionSettingContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}

export interface LearningInstitutionSettingView {
  readonly enabled: boolean;
  readonly version: number;
}

export interface LearningInstitutionSettingOperations {
  read(context: LearningInstitutionSettingContext): Promise<LearningInstitutionSettingView>;
  update(
    context: LearningInstitutionSettingContext,
    body: unknown,
  ): Promise<LearningInstitutionSettingView>;
}

export const LEARNING_INSTITUTION_SETTING_OPERATIONS = Symbol(
  "LEARNING_INSTITUTION_SETTING_OPERATIONS",
);
