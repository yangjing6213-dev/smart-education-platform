import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { randomUUID } from "node:crypto";
import {
  InMemoryMealRepository,
  MealService,
  mealFailure,
  type MealActorContext,
  type MealDraftPayload,
  type MealOperations,
  type MealRecord,
  type MealResult,
  type MealScope,
  type PublicMealProjection,
} from "./meal.service.js";

const INCLUDE = {
  items: { orderBy: { position: "asc" } },
  updatedBy: { select: { membership: { select: { userId: true } } } },
} as const;
type MealRow = Prisma.MealPlanGetPayload<{ include: typeof INCLUDE }>;

function normalizeContextIds(context: MealActorContext): MealActorContext {
  return {
    ...context,
    actorId: context.actorId.toLowerCase(),
    scope: {
      tenantId: context.scope.tenantId.toLowerCase(),
      campusId: context.scope.campusId.toLowerCase(),
    },
  };
}

function record(row: MealRow): MealRecord {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    campus_id: row.campusId,
    status: row.publishStatus,
    version: row.version,
    meal_date: row.serviceDate.toISOString().slice(0, 10),
    meal_type: row.mealPeriod,
    items: row.items.map((item) => item.itemName),
    notes: row.notes,
    media_ref: null,
    private_notes: "",
    published_at: row.publishedAt?.toISOString() ?? null,
    synthetic_data: true,
    updated_by: row.updatedBy.membership.userId,
    updated_at: row.updatedAt.toISOString(),
  };
}

async function membershipId(database: Prisma.TransactionClient, context: MealActorContext) {
  const rows = await database.membershipCampus.findMany({
    where: {
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      membership: { userId: context.actorId, status: "ACTIVE", user: { status: "ACTIVE" } },
      campus: { status: "ACTIVE", tenant: { status: "ACTIVE" } },
    },
    select: { membershipId: true },
    take: 2,
  });
  return rows.length === 1 ? rows[0]?.membershipId : undefined;
}

class VersionConflict extends Error {}

export class PrismaMealService implements MealOperations {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private rules(records: readonly MealRecord[] = []): MealService {
    return new MealService(new InMemoryMealRepository(records), { now: this.now });
  }

  public async listAdmin(context: MealActorContext): Promise<MealResult<readonly MealRecord[]>> {
    context = normalizeContextIds(context);
    const access = this.rules().listAdmin(context);
    if (!access.ok) return access;
    return this.prisma.$transaction(async (database) => {
      if ((await membershipId(database, context)) === undefined)
        return mealFailure("FORBIDDEN_SCOPE");
      const rows = await database.mealPlan.findMany({
        where: { tenantId: context.scope.tenantId, campusId: context.scope.campusId },
        include: INCLUDE,
        orderBy: [{ serviceDate: "desc" }, { mealPeriod: "asc" }, { id: "asc" }],
      });
      return { ok: true, data: rows.map(record) };
    });
  }

  public async createDraft(
    context: MealActorContext,
    mealId: string,
    payload: MealDraftPayload,
    expectedVersion: number | null = null,
  ): Promise<MealResult<MealRecord>> {
    if (payload?.media_ref !== undefined || payload?.private_notes !== undefined)
      return mealFailure("VALIDATION_FAILED");
    return this.mutate(context, mealId, (rules, actor, id) =>
      rules.createDraft(actor, id, payload, expectedVersion),
    );
  }

  public async updateDraft(
    context: MealActorContext,
    mealId: string,
    payload: MealDraftPayload,
    expectedVersion: number,
  ): Promise<MealResult<MealRecord>> {
    if (payload?.media_ref !== undefined || payload?.private_notes !== undefined)
      return mealFailure("VALIDATION_FAILED");
    return this.mutate(
      context,
      mealId,
      (rules, actor, id) => rules.updateDraft(actor, id, payload, expectedVersion),
      true,
    );
  }

  public publish(
    context: MealActorContext,
    mealId: string,
    expectedVersion: number,
  ): Promise<MealResult<MealRecord>> {
    return this.mutate(context, mealId, (rules, actor, id) =>
      rules.publish(actor, id, expectedVersion),
    );
  }

  public unpublish(
    context: MealActorContext,
    mealId: string,
    expectedVersion: number,
  ): Promise<MealResult<MealRecord>> {
    return this.mutate(context, mealId, (rules, actor, id) =>
      rules.unpublish(actor, id, expectedVersion),
    );
  }

  public async listPublic(
    scope: MealScope,
    onDate: string,
  ): Promise<MealResult<readonly PublicMealProjection[]>> {
    scope = { tenantId: scope.tenantId.toLowerCase(), campusId: scope.campusId.toLowerCase() };
    const input = this.rules().listPublic(scope, onDate);
    if (!input.ok) return input;
    const rows = await this.prisma.mealPlan.findMany({
      where: {
        tenantId: scope.tenantId,
        campusId: scope.campusId,
        serviceDate: new Date(`${onDate}T00:00:00.000Z`),
        publishStatus: "PUBLISHED",
        publishedAt: { not: null },
        campus: { status: "ACTIVE", tenant: { status: "ACTIVE" } },
      },
      include: INCLUDE,
    });
    return this.rules(rows.map(record)).listPublic(scope, onDate);
  }

  private async mutate(
    context: MealActorContext,
    mealId: string,
    operation: (rules: MealService, actor: MealActorContext, id: string) => MealResult<MealRecord>,
    replaceItems = false,
  ): Promise<MealResult<MealRecord>> {
    context = normalizeContextIds(context);
    mealId = mealId.toLowerCase();
    const validation = operation(this.rules(), context, mealId);
    if (
      !validation.ok &&
      (validation.error.code === "FORBIDDEN_SCOPE" || validation.error.code === "VALIDATION_FAILED")
    )
      return validation;
    try {
      return await this.prisma.$transaction(async (database) => {
        const updater = await membershipId(database, context);
        if (updater === undefined) return mealFailure("FORBIDDEN_SCOPE");
        const key = {
          tenantId: context.scope.tenantId,
          campusId: context.scope.campusId,
          id: mealId,
        };
        const current = await database.mealPlan.findUnique({
          where: { tenantId_campusId_id: key },
          include: INCLUDE,
        });
        const result = operation(
          this.rules(current === null ? [] : [record(current)]),
          context,
          mealId,
        );
        if (!result.ok) return result;
        const next = result.data;
        const data = {
          serviceDate: new Date(`${next.meal_date}T00:00:00.000Z`),
          mealPeriod: next.meal_type,
          notes: next.notes,
          publishStatus: next.status,
          version: next.version,
          publishedAt: next.published_at === null ? null : new Date(next.published_at),
          updatedByMembershipId: updater,
          updatedAt: new Date(next.updated_at),
        };
        if (current === null) {
          const created = await database.mealPlan.create({
            data: {
              ...key,
              ...data,
              items: { create: next.items.map((itemName, position) => ({ itemName, position })) },
            },
            include: INCLUDE,
          });
          return { ok: true, data: record(created) };
        }
        const changed = await database.mealPlan.updateMany({
          where: { ...key, version: current.version },
          data,
        });
        if (changed.count !== 1) throw new VersionConflict();
        if (replaceItems) {
          const itemScope = { tenantId: key.tenantId, campusId: key.campusId, mealPlanId: key.id };
          await database.mealPlanItem.deleteMany({ where: itemScope });
          await database.mealPlanItem.createMany({
            data: next.items.map((itemName, position) => ({ ...itemScope, itemName, position })),
          });
        }
        const updated = await database.mealPlan.findUnique({
          where: { tenantId_campusId_id: key },
          include: INCLUDE,
        });
        if (updated === null) throw new VersionConflict();
        if (
          current.publishStatus !== next.status &&
          (next.status === "PUBLISHED" || next.status === "UNPUBLISHED")
        ) {
          await database.$executeRaw`
            INSERT INTO "meal_publication_events" (
              "tenant_id", "campus_id", "id", "meal_plan_id", "action",
              "resulting_version", "actor_membership_id", "occurred_at"
            ) VALUES (
              ${key.tenantId}::uuid, ${key.campusId}::uuid, ${randomUUID()}::uuid,
              ${key.id}::uuid, ${next.status}, ${next.version}, ${updater}::uuid,
              ${new Date(next.updated_at)}::timestamptz
            )
          `;
        }
        return { ok: true, data: record(updated) };
      });
    } catch (error) {
      if (
        error instanceof VersionConflict ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      )
        return mealFailure("VERSION_MISMATCH");
      throw error;
    }
  }
}
