import type {
  ParentGovernanceContext,
  ParentGovernanceMember,
  ParentGovernanceOperations,
} from "../nest/api-tokens.js";
import { BindingLeaveService, LocalError } from "./binding-leave.service.js";
import { ConsentService } from "./consent.service.js";
import { PrivacyRequestService } from "./privacy-requests.service.js";
import { memberForActor, studentsForMember, type LocalMember } from "./sessions.js";
import { FeesService } from "./fees.service.js";
import type { LearningSessionService } from "./learning-session.service.js";
import type { MonthlyFeedbackService } from "./monthly-feedback.service.js";
import { NoticeService, type NoticeParentView } from "./notice.service.js";
import type { HealthIncidentService } from "./health-incident.service.js";
import type { PickupService } from "./pickup.service.js";

function safeParentNotice(view: NoticeParentView) {
  return {
    id: view.id,
    version: view.version,
    status: view.status,
    published: view.published,
    title: view.title,
    body: view.body,
    target: view.target,
    requiresAcknowledgment: view.requiresAcknowledgment,
    receiptStatus: view.receiptStatus,
    synthetic: view.synthetic,
  };
}

type ParentHealthIncidentView = ReturnType<HealthIncidentService["parentList"]>[number];

function safeParentHealthIncident(view: ParentHealthIncidentView) {
  return {
    id: view.id,
    version: view.version,
    status: view.status,
    published: view.published,
    date: view.date,
    title: view.title,
    parentSummary: view.parentSummary,
    receiptStatus: view.receiptStatus,
    synthetic: view.synthetic,
  };
}

export class LocalSyntheticNestParentGovernanceAdapter implements ParentGovernanceOperations {
  public constructor(
    private readonly bindings: BindingLeaveService,
    private readonly consents: ConsentService,
    private readonly privacyRequests: PrivacyRequestService,
    private readonly fees: FeesService,
    private readonly learning: LearningSessionService,
    private readonly feedback: MonthlyFeedbackService,
    private readonly notices: NoticeService,
    private readonly health: HealthIncidentService,
    private readonly pickup: PickupService,
  ) {}

  public resolveMember(context: ParentGovernanceContext): ParentGovernanceMember | undefined {
    const member = memberForActor(context.actorId);
    if (
      !member ||
      member.tenantId !== context.tenantId ||
      member.campusId !== context.campusId ||
      !member.profile.startsWith("parent-")
    )
      return undefined;
    return {
      ...member,
      actions: [
        ...member.actions.filter((action) => context.capabilities.includes(action)),
        ...(member.profile.startsWith("parent-")
          ? context.capabilities.filter((capability) => capability === "binding:read")
          : []),
        ...(member.profile.startsWith("parent-") &&
        context.capabilities.some(
          (capability) => capability === "binding:apply" || capability === "binding:read",
        )
          ? member.actions.filter(
              (action) => action === "consent:manage" || action === "privacy:request",
            )
          : []),
        ...(member.profile.startsWith("parent-") && context.capabilities.includes("binding:read")
          ? ["fees:read"]
          : []),
        ...(member.profile.startsWith("parent-") && context.capabilities.includes("binding:read")
          ? ["learning:read"]
          : []),
        ...(member.profile.startsWith("parent-") && context.capabilities.includes("binding:read")
          ? ["feedback:read", "feedback:ack"]
          : []),
        ...(member.profile.startsWith("parent-") && context.capabilities.includes("binding:read")
          ? ["notice:read", "notice:ack"]
          : []),
        ...(member.profile.startsWith("parent-") && context.capabilities.includes("binding:read")
          ? ["health:read", "health:ack"]
          : []),
        ...(member.profile.startsWith("parent-") &&
        context.capabilities.includes("binding:read") &&
        context.capabilities.includes("binding:apply")
          ? ["pickup:read", "pickup:authorize"]
          : []),
        ...(member.profile.startsWith("parent-") && context.capabilities.includes("binding:apply")
          ? ["learning:enable"]
          : []),
      ],
    };
  }

  private localMember(member: ParentGovernanceMember): LocalMember {
    const mapped = memberForActor(member.actorId);
    if (
      !mapped ||
      !mapped.profile.startsWith("parent-") ||
      mapped.tenantId !== member.tenantId ||
      mapped.campusId !== member.campusId ||
      mapped.classIds.length !== member.classIds.length ||
      mapped.classIds.some((classId) => !member.classIds.includes(classId))
    )
      throw new LocalError(403, "UNAVAILABLE");
    return {
      ...mapped,
      actions: mapped.actions.filter((action) => member.actions.includes(action)),
    };
  }

  public studentOptions(member: ParentGovernanceMember) {
    return studentsForMember(this.localMember(member)).map(({ id, alias, label }) => ({
      id,
      alias,
      label,
    }));
  }

  public parentFees(member: ParentGovernanceMember) {
    const local = this.localMember(member);
    return {
      bindingApplications: this.bindings.bindings(local),
      documents: this.fees.list(local),
      ledger: this.fees.ledger(local),
    };
  }

  public parentPickup(member: ParentGovernanceMember) {
    const local = this.localMember(member);
    if (!local.actions.includes("pickup:read") || !local.actions.includes("pickup:authorize"))
      throw new LocalError(403, "UNAVAILABLE");

    const bindings = this.bindings
      .bindings(local)
      .filter((row) => row.status === "APPROVED")
      .map(({ id, version, status, studentId, studentLabel, classLabel }) => ({
        id,
        version,
        status,
        studentId,
        studentLabel,
        classLabel,
      }));
    const bindingIds = new Set(bindings.map(({ id }) => id));
    const authorizations = this.pickup
      .authorizations(local)
      .filter((row) => bindingIds.has(row.bindingId))
      .map(
        ({
          id,
          version,
          status,
          currentlyValid,
          bindingId,
          studentId,
          studentLabel,
          classLabel,
          recipient,
          recipientLabel,
          type,
          startDate,
          endDate,
          startTime,
          endTime,
        }) => ({
          id,
          version,
          status,
          currentlyValid,
          bindingId,
          studentId,
          studentLabel,
          classLabel,
          recipient,
          recipientLabel,
          type,
          startDate,
          endDate,
          startTime,
          endTime,
        }),
      );
    const records = this.pickup
      .records(local)
      .map(({ id, date, time, studentId, studentLabel, recipient, status }) => ({
        id,
        date,
        time,
        studentId,
        studentLabel,
        recipient,
        status,
      }));
    return { bindings, authorizations, records };
  }

  public createParentPickupAuthorization(member: ParentGovernanceMember, value: unknown) {
    return this.pickup.createAuthorization(this.localMember(member), value);
  }

  public activateParentPickupAuthorization(
    member: ParentGovernanceMember,
    id: string,
    value: unknown,
  ) {
    return this.pickup.activate(this.localMember(member), id, value);
  }

  public revokeParentPickupAuthorization(
    member: ParentGovernanceMember,
    id: string,
    value: unknown,
  ) {
    return this.pickup.revoke(this.localMember(member), id, value);
  }

  public issueParentPickupCredential(member: ParentGovernanceMember, id: string, value: unknown) {
    return this.pickup.issueCredential(this.localMember(member), id, value);
  }

  public parentMonthlyFeedback(member: ParentGovernanceMember) {
    return this.feedback.parentList(this.localMember(member));
  }

  public acknowledgeParentMonthlyFeedback(
    member: ParentGovernanceMember,
    id: string,
    value: unknown,
  ) {
    return this.feedback.ack(this.localMember(member), id, value);
  }

  public parentNotices(member: ParentGovernanceMember) {
    return this.notices.notices(this.localMember(member)).map(safeParentNotice);
  }

  public readParentNotice(member: ParentGovernanceMember, id: string, value: unknown) {
    return safeParentNotice(this.notices.read(this.localMember(member), id, value));
  }

  public acknowledgeParentNotice(member: ParentGovernanceMember, id: string, value: unknown) {
    return safeParentNotice(this.notices.ack(this.localMember(member), id, value));
  }

  public parentHealthIncidents(member: ParentGovernanceMember) {
    return this.health.parentList(this.localMember(member)).map(safeParentHealthIncident);
  }

  public readParentHealthIncident(member: ParentGovernanceMember, id: string, value: unknown) {
    return safeParentHealthIncident(this.health.read(this.localMember(member), id, value));
  }

  public acknowledgeParentHealthIncident(
    member: ParentGovernanceMember,
    id: string,
    value: unknown,
  ) {
    return safeParentHealthIncident(this.health.ack(this.localMember(member), id, value));
  }

  public parentLearning(member: ParentGovernanceMember) {
    const local = this.localMember(member);
    const approvedStudents = this.bindings
      .bindings(local)
      .filter((binding) => binding.status === "APPROVED")
      .map(({ studentId, studentLabel, classLabel }) => ({
        studentId,
        studentLabel,
        classLabel,
      }));
    const approvedIds = new Set(approvedStudents.map(({ studentId }) => studentId));
    const projection = this.learning.parentControls(local);
    return {
      approvedStudents,
      parentControls: projection.students.filter(({ studentId }) => approvedIds.has(studentId)),
      parentSummary: projection.parentSummary.filter(({ studentId }) => approvedIds.has(studentId)),
      parentSummaryUpdatedAt: projection.parentSummaryUpdatedAt,
    };
  }

  public updateParentLearningControls(
    member: ParentGovernanceMember,
    studentId: string,
    value: unknown,
  ) {
    return this.learning.updateParentControls(this.localMember(member), studentId, value);
  }

  public recordParentLearningContact(
    member: ParentGovernanceMember,
    studentId: string,
    value: unknown,
  ) {
    return this.learning.contactTeacher(this.localMember(member), studentId, value);
  }

  public policies(member: ParentGovernanceMember) {
    return this.consents.policies(this.localMember(member));
  }

  public listConsents(member: ParentGovernanceMember) {
    return this.consents.list(this.localMember(member));
  }

  public createConsent(member: ParentGovernanceMember, value: unknown) {
    return this.consents.create(this.localMember(member), value);
  }

  public revokeConsent(member: ParentGovernanceMember, id: string, value: unknown) {
    return this.consents.revoke(this.localMember(member), id, value);
  }

  public listPrivacyRequests(member: ParentGovernanceMember) {
    return this.privacyRequests.list(this.localMember(member));
  }

  public createPrivacyRequest(member: ParentGovernanceMember, value: unknown) {
    return this.privacyRequests.create(this.localMember(member), value);
  }

  public withdrawPrivacyRequest(member: ParentGovernanceMember, id: string, value: unknown) {
    return this.privacyRequests.withdraw(this.localMember(member), id, value);
  }
}
