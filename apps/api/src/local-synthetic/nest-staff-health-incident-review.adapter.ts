import { LocalError } from "./binding-leave.service.js";
import { memberForActor, type LocalMember } from "./sessions.js";
import { HealthIncidentService } from "./health-incident.service.js";
import type {
  StaffHealthIncidentReviewContext,
  StaffHealthIncidentReviewOperations,
} from "../nest/api-tokens.js";

const HEALTH_CAPABILITIES = [
  "health:create",
  "health:submit",
  "health:review",
  "health:supplement",
  "health:publish",
  "health:revoke",
] as const;

export class LocalSyntheticNestStaffHealthIncidentReviewAdapter implements StaffHealthIncidentReviewOperations {
  public constructor(private readonly incidents: HealthIncidentService) {}

  public listStudents(context: StaffHealthIncidentReviewContext) {
    return this.incidents.listStudents(this.member(context, "health:create"));
  }

  public listDrafts(context: StaffHealthIncidentReviewContext) {
    return this.incidents.listDrafts(this.member(context, "health:create"));
  }

  public create(context: StaffHealthIncidentReviewContext, body: unknown) {
    if (typeof body !== "object" || body === null || Array.isArray(body))
      throw new LocalError(400, "INVALID_REQUEST");
    const input = body as Record<string, unknown>;
    return this.incidents.create(this.member(context, "health:create"), {
      student: input.studentId,
      observationCode: input.observationCode,
      dispositionCode: input.dispositionCode,
    });
  }

  public submit(context: StaffHealthIncidentReviewContext, incidentId: string, body: unknown) {
    return this.incidents.submit(this.member(context, "health:submit"), incidentId, body);
  }

  public list(context: StaffHealthIncidentReviewContext) {
    return this.incidents.reviewQueue(this.member(context));
  }

  public review(context: StaffHealthIncidentReviewContext, incidentId: string, body: unknown) {
    return this.incidents.review(this.member(context), incidentId, body);
  }

  public supplement(context: StaffHealthIncidentReviewContext, incidentId: string, body: unknown) {
    return this.incidents.supplement(this.member(context), incidentId, body);
  }

  public publish(context: StaffHealthIncidentReviewContext, incidentId: string, body: unknown) {
    return this.incidents.publish(this.member(context), incidentId, body);
  }

  public revoke(context: StaffHealthIncidentReviewContext, incidentId: string, body: unknown) {
    return this.incidents.revoke(this.member(context), incidentId, body);
  }

  private member(
    context: StaffHealthIncidentReviewContext,
    requiredAction: "health:create" | "health:submit" | "health:review" = "health:review",
  ): LocalMember {
    const profile = memberForActor(context.actorId);
    if (
      !profile ||
      profile.tenantId !== context.tenantId ||
      profile.campusId !== context.campusId
    ) {
      throw new LocalError(403, "UNAVAILABLE");
    }
    const capabilities = new Set(context.capabilities);
    const actions = profile.actions.filter(
      (action) =>
        (HEALTH_CAPABILITIES as readonly string[]).includes(action) && capabilities.has(action),
    );
    if (!actions.includes(requiredAction)) throw new LocalError(403, "UNAVAILABLE");
    return { ...profile, actions };
  }
}
