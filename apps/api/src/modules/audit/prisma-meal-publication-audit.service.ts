import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AuditReadContext } from "./audit.service.js";

export interface MealPublicationAuditEvent {
  readonly event_id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly meal_id: string;
  readonly action: "PUBLISHED" | "UNPUBLISHED";
  readonly resulting_version: number;
  readonly actor_membership_id: string;
  readonly occurred_at: string;
}

export type MealPublicationAuditResult =
  | { readonly ok: true; readonly data: readonly MealPublicationAuditEvent[] }
  | {
      readonly ok: false;
      readonly error: { readonly code: "FORBIDDEN_SCOPE" | "VALIDATION_FAILED" };
    };

export interface MealPublicationAuditOperations {
  list(context: AuditReadContext, limit?: number): Promise<MealPublicationAuditResult>;
}

interface PublicationEventRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly meal_plan_id: string;
  readonly action: "PUBLISHED" | "UNPUBLISHED";
  readonly resulting_version: number;
  readonly actor_membership_id: string;
  readonly occurred_at: Date;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function canRead(context: AuditReadContext): boolean {
  return (
    context.trusted === true &&
    context.activeMembership === true &&
    UUID_PATTERN.test(context.actorId) &&
    UUID_PATTERN.test(context.scope.tenantId) &&
    UUID_PATTERN.test(context.scope.campusId) &&
    context.capabilities.includes("memberships:read")
  );
}

export class PrismaMealPublicationAuditService implements MealPublicationAuditOperations {
  public constructor(private readonly prisma: PrismaClient) {}

  public async list(context: AuditReadContext, limit = 50): Promise<MealPublicationAuditResult> {
    if (!canRead(context)) {
      return { ok: false, error: { code: "FORBIDDEN_SCOPE" } };
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return { ok: false, error: { code: "VALIDATION_FAILED" } };
    }

    const rows = await this.prisma.$queryRaw<readonly PublicationEventRow[]>`
      SELECT
        "id"::text AS "id",
        "tenant_id"::text AS "tenant_id",
        "campus_id"::text AS "campus_id",
        "meal_plan_id"::text AS "meal_plan_id",
        "action",
        "resulting_version",
        "actor_membership_id"::text AS "actor_membership_id",
        "occurred_at"
      FROM "meal_publication_events"
      WHERE "tenant_id" = ${context.scope.tenantId}::uuid
        AND "campus_id" = ${context.scope.campusId}::uuid
      ORDER BY "occurred_at" DESC, "id" DESC
      LIMIT ${limit}
    `;
    return {
      ok: true,
      data: rows.map((row) => ({
        event_id: row.id,
        tenant_id: row.tenant_id,
        campus_id: row.campus_id,
        meal_id: row.meal_plan_id,
        action: row.action,
        resulting_version: row.resulting_version,
        actor_membership_id: row.actor_membership_id,
        occurred_at: new Date(row.occurred_at).toISOString(),
      })),
    };
  }
}
