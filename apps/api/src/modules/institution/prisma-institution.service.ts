import { randomUUID } from "node:crypto";
import type {
  ContentBody,
  ContentStatus,
  ContentType,
  ContentVisibility,
  PublicContentProjection,
} from "@student-care/contracts";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ContentOperationResult, DraftPayload } from "../content/content.service.js";
import {
  InMemoryContentRepository,
  type ContentRecord,
  type ContentScope,
} from "../content/content.repository.js";
import {
  InstitutionService,
  type InstitutionActorContext,
  type InstitutionContentKind,
  type InstitutionPublicScope,
  type InstitutionServiceOperations,
} from "./institution.service.js";

interface InstitutionContentRow {
  readonly id: string;
  readonly content_key: string;
  readonly tenant_id: string;
  readonly campus_id: string | null;
  readonly type: string;
  readonly status: string;
  readonly title: string;
  readonly version: number;
  readonly visibility: string;
  readonly body: unknown;
  readonly published_at: Date | string | null;
  readonly synthetic_data: boolean;
  readonly editor_note: string;
  readonly moderation_state: string;
  readonly tenant_admin_note: string;
  readonly campus_admin_note: string;
  readonly updated_by: string;
  readonly updated_at: Date | string;
}

interface RawQueryClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

type WriteAction = "CREATE" | "UPDATE" | "PUBLISH" | "UNPUBLISH";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_TYPES = new Set<ContentType>(["INSTITUTION", "HOME_BLOCK"]);
const CONTENT_STATUSES = new Set<ContentStatus>(["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"]);
const CONTENT_VISIBILITIES = new Set<ContentVisibility>(["PUBLIC", "MEMBERS", "STAFF", "ADMIN"]);

function dateValue(value: Date | string | null): string | null | undefined {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isContentBody(value: unknown): value is ContentBody {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.blocks) &&
    candidate.blocks.every(
      (block) =>
        typeof block === "object" &&
        block !== null &&
        !Array.isArray(block) &&
        typeof (block as Record<string, unknown>).kind === "string" &&
        typeof (block as Record<string, unknown>).text === "string",
    )
  );
}

function contentRecord(row: InstitutionContentRow): ContentRecord | undefined {
  const updatedAt = dateValue(row.updated_at);
  const publishedAt = dateValue(row.published_at);
  if (
    !CONTENT_TYPES.has(row.type as ContentType) ||
    !CONTENT_STATUSES.has(row.status as ContentStatus) ||
    !CONTENT_VISIBILITIES.has(row.visibility as ContentVisibility) ||
    !isContentBody(row.body) ||
    updatedAt === undefined ||
    updatedAt === null ||
    publishedAt === undefined ||
    row.synthetic_data !== true ||
    !Number.isInteger(row.version) ||
    row.version < 1
  ) {
    return undefined;
  }
  return {
    id: row.id,
    content_key: row.content_key,
    tenant_id: row.tenant_id,
    campus_id: row.campus_id,
    type: row.type as ContentType,
    status: row.status as ContentStatus,
    title: row.title,
    version: row.version,
    visibility: row.visibility as ContentVisibility,
    body: row.body,
    published_at: publishedAt,
    synthetic_data: true,
    editor_note: row.editor_note,
    moderation_state: row.moderation_state,
    tenant_admin_note: row.tenant_admin_note,
    campus_admin_note: row.campus_admin_note,
    updated_by: row.updated_by,
    updated_at: updatedAt,
  };
}

function normalizedStorageScope(kind: InstitutionContentKind, scope: ContentScope): ContentScope {
  return kind === "INSTITUTION" ? { tenantId: scope.tenantId } : scope;
}

function validScope(scope: ContentScope): boolean {
  return (
    UUID_PATTERN.test(scope.tenantId) &&
    (scope.campusId === undefined || UUID_PATTERN.test(scope.campusId))
  );
}

function trustedContext(context: InstitutionActorContext): boolean {
  return (
    context.trusted === true &&
    context.activeMembership === true &&
    typeof context.actorId === "string" &&
    context.actorId.length > 0 &&
    context.actorId.length <= 128 &&
    validScope(context.scope) &&
    Array.isArray(context.capabilities) &&
    context.capabilities.every((capability) => typeof capability === "string")
  );
}

function failure(code: "FORBIDDEN_SCOPE" | "VERSION_MISMATCH") {
  return {
    ok: false as const,
    error: {
      code,
      message:
        code === "FORBIDDEN_SCOPE"
          ? "Content scope access is not permitted."
          : "Content version is stale.",
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const value = error as { readonly code?: unknown; readonly meta?: { readonly code?: unknown } };
  return value.code === "23505" || value.code === "P2002" || value.meta?.code === "23505";
}

function publicProjection(
  operation: (service: InstitutionService) => ContentOperationResult<PublicContentProjection>,
  record?: ContentRecord,
): ContentOperationResult<PublicContentProjection> {
  const repository = new InMemoryContentRepository(record === undefined ? [] : [record]);
  return operation(new InstitutionService(repository));
}

export class PrismaInstitutionService implements InstitutionServiceOperations {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly now = () => new Date(),
  ) {}

  public createInstitutionDraft(
    context: InstitutionActorContext,
    contentKey: string,
    payload: DraftPayload,
    expectedVersion: number | null = null,
  ): Promise<ContentOperationResult<ContentRecord>> {
    return this.write("INSTITUTION", "CREATE", context, contentKey, payload, expectedVersion);
  }

  public updateInstitutionDraft(
    context: InstitutionActorContext,
    contentKey: string,
    payload: DraftPayload,
    expectedCurrentVersion: number,
  ): Promise<ContentOperationResult<ContentRecord>> {
    return this.write(
      "INSTITUTION",
      "UPDATE",
      context,
      contentKey,
      payload,
      expectedCurrentVersion,
    );
  }

  public publishInstitution(
    context: InstitutionActorContext,
    contentKey: string,
    expectedCurrentVersion: number,
  ): Promise<ContentOperationResult<ContentRecord>> {
    return this.write(
      "INSTITUTION",
      "PUBLISH",
      context,
      contentKey,
      undefined,
      expectedCurrentVersion,
    );
  }

  public unpublishInstitution(
    context: InstitutionActorContext,
    contentKey: string,
    expectedCurrentVersion: number,
  ): Promise<ContentOperationResult<ContentRecord>> {
    return this.write(
      "INSTITUTION",
      "UNPUBLISH",
      context,
      contentKey,
      undefined,
      expectedCurrentVersion,
    );
  }

  public readInstitutionDraft(
    context: InstitutionActorContext,
    contentKey: string,
  ): Promise<ContentOperationResult<ContentRecord>> {
    return this.readDraft("INSTITUTION", context, contentKey);
  }

  public readInstitutionPublic(
    context: InstitutionActorContext,
    contentKey: string,
  ): Promise<ContentOperationResult<PublicContentProjection>> {
    return this.readPublic("INSTITUTION", context, contentKey);
  }

  public readInstitutionPublicForVisitor(
    scope: InstitutionPublicScope,
    contentKey: string,
  ): Promise<ContentOperationResult<PublicContentProjection>> {
    if (!validScope(scope)) return Promise.resolve(failure("FORBIDDEN_SCOPE"));
    return this.readOne("INSTITUTION", scope, contentKey);
  }

  public listInstitutionPublicForVisitor(
    scope: InstitutionPublicScope,
  ): Promise<ContentOperationResult<readonly PublicContentProjection[]>> {
    return this.listPublic("INSTITUTION", scope);
  }

  public createHomeDraft(
    context: InstitutionActorContext,
    contentKey: string,
    payload: DraftPayload,
    expectedVersion: number | null = null,
  ): Promise<ContentOperationResult<ContentRecord>> {
    return this.write("HOME_BLOCK", "CREATE", context, contentKey, payload, expectedVersion);
  }

  public updateHomeDraft(
    context: InstitutionActorContext,
    contentKey: string,
    payload: DraftPayload,
    expectedCurrentVersion: number,
  ): Promise<ContentOperationResult<ContentRecord>> {
    return this.write("HOME_BLOCK", "UPDATE", context, contentKey, payload, expectedCurrentVersion);
  }

  public publishHome(
    context: InstitutionActorContext,
    contentKey: string,
    expectedCurrentVersion: number,
  ): Promise<ContentOperationResult<ContentRecord>> {
    return this.write(
      "HOME_BLOCK",
      "PUBLISH",
      context,
      contentKey,
      undefined,
      expectedCurrentVersion,
    );
  }

  public unpublishHome(
    context: InstitutionActorContext,
    contentKey: string,
    expectedCurrentVersion: number,
  ): Promise<ContentOperationResult<ContentRecord>> {
    return this.write(
      "HOME_BLOCK",
      "UNPUBLISH",
      context,
      contentKey,
      undefined,
      expectedCurrentVersion,
    );
  }

  public readHomeDraft(
    context: InstitutionActorContext,
    contentKey: string,
  ): Promise<ContentOperationResult<ContentRecord>> {
    return this.readDraft("HOME_BLOCK", context, contentKey);
  }

  public readHomePublic(
    context: InstitutionActorContext,
    contentKey: string,
  ): Promise<ContentOperationResult<PublicContentProjection>> {
    return this.readPublic("HOME_BLOCK", context, contentKey);
  }

  public readHomePublicForVisitor(
    scope: InstitutionPublicScope,
    contentKey: string,
  ): Promise<ContentOperationResult<PublicContentProjection>> {
    if (!validScope(scope)) return Promise.resolve(failure("FORBIDDEN_SCOPE"));
    return this.readOne("HOME_BLOCK", scope, contentKey);
  }

  public listHomePublicForVisitor(
    scope: InstitutionPublicScope,
  ): Promise<ContentOperationResult<readonly PublicContentProjection[]>> {
    return this.listPublic("HOME_BLOCK", scope);
  }

  private async readDraft(
    kind: InstitutionContentKind,
    context: InstitutionActorContext,
    contentKey: string,
  ): Promise<ContentOperationResult<ContentRecord>> {
    if (!trustedContext(context)) return failure("FORBIDDEN_SCOPE");
    const record = await this.findOne(normalizedStorageScope(kind, context.scope), contentKey);
    const service = new InstitutionService(new InMemoryContentRepository(record ? [record] : []));
    return kind === "INSTITUTION"
      ? service.readInstitutionDraft(context, contentKey)
      : service.readHomeDraft(context, contentKey);
  }

  private async readPublic(
    kind: InstitutionContentKind,
    context: InstitutionActorContext,
    contentKey: string,
  ): Promise<ContentOperationResult<PublicContentProjection>> {
    if (!trustedContext(context)) return failure("FORBIDDEN_SCOPE");
    const record = await this.findOne(normalizedStorageScope(kind, context.scope), contentKey);
    return publicProjection(
      (service) =>
        kind === "INSTITUTION"
          ? service.readInstitutionPublic(context, contentKey)
          : service.readHomePublic(context, contentKey),
      record,
    );
  }

  private async readOne(
    kind: InstitutionContentKind,
    scope: InstitutionPublicScope,
    contentKey: string,
  ): Promise<ContentOperationResult<PublicContentProjection>> {
    if (!validScope(scope)) return failure("FORBIDDEN_SCOPE");
    const record = await this.findOne(normalizedStorageScope(kind, scope), contentKey);
    return publicProjection(
      (service) =>
        kind === "INSTITUTION"
          ? service.readInstitutionPublicForVisitor(scope, contentKey)
          : service.readHomePublicForVisitor(scope, contentKey),
      record,
    );
  }

  private async listPublic(
    kind: InstitutionContentKind,
    scope: InstitutionPublicScope,
  ): Promise<ContentOperationResult<readonly PublicContentProjection[]>> {
    if (!validScope(scope)) return failure("FORBIDDEN_SCOPE");
    const records = await this.findPublished(normalizedStorageScope(kind, scope), kind, 100);
    const repository = new InMemoryContentRepository(records);
    const service = new InstitutionService(repository);
    return kind === "INSTITUTION"
      ? service.listInstitutionPublicForVisitor(scope)
      : service.listHomePublicForVisitor(scope);
  }

  private async findOne(
    scope: ContentScope,
    contentKey: string,
  ): Promise<ContentRecord | undefined> {
    if (!validScope(scope)) return undefined;
    const rows = await this.queryClient(this.prisma).$queryRaw<readonly InstitutionContentRow[]>`
      SELECT
        "id"::text AS "id",
        "content_key" AS "content_key",
        "tenant_id"::text AS "tenant_id",
        "campus_id"::text AS "campus_id",
        "content_type" AS "type",
        "status",
        "title",
        "version",
        "visibility",
        "body",
        "published_at",
        "synthetic_data",
        "editor_note",
        "moderation_state",
        "tenant_admin_note",
        "campus_admin_note",
        "updated_by",
        "updated_at"
      FROM "institution_content_records"
      WHERE "tenant_id" = ${scope.tenantId}::uuid
        AND "campus_id" IS NOT DISTINCT FROM ${scope.campusId ?? null}::uuid
        AND "content_key" = ${contentKey}
    `;
    const row = rows[0];
    return row === undefined ? undefined : contentRecord(row);
  }

  private async findPublished(
    scope: ContentScope,
    kind: InstitutionContentKind,
    limit: number,
  ): Promise<ContentRecord[]> {
    if (!validScope(scope)) return [];
    const rows = await this.queryClient(this.prisma).$queryRaw<readonly InstitutionContentRow[]>`
      SELECT
        "id"::text AS "id",
        "content_key" AS "content_key",
        "tenant_id"::text AS "tenant_id",
        "campus_id"::text AS "campus_id",
        "content_type" AS "type",
        "status",
        "title",
        "version",
        "visibility",
        "body",
        "published_at",
        "synthetic_data",
        "editor_note",
        "moderation_state",
        "tenant_admin_note",
        "campus_admin_note",
        "updated_by",
        "updated_at"
      FROM "institution_content_records"
      WHERE "tenant_id" = ${scope.tenantId}::uuid
        AND "campus_id" IS NOT DISTINCT FROM ${scope.campusId ?? null}::uuid
        AND "content_type" = ${kind}
        AND "status" = 'PUBLISHED'
        AND "visibility" = 'PUBLIC'
        AND "published_at" IS NOT NULL
        AND "synthetic_data" = TRUE
      ORDER BY "published_at" DESC, "content_key" ASC
      LIMIT ${limit}
    `;
    return rows.flatMap((row) => {
      const record = contentRecord(row);
      return record === undefined ? [] : [record];
    });
  }

  private async write(
    kind: InstitutionContentKind,
    action: WriteAction,
    context: InstitutionActorContext,
    contentKey: string,
    payload: DraftPayload | undefined,
    expectedVersion: number | null | undefined,
  ): Promise<ContentOperationResult<ContentRecord>> {
    if (!trustedContext(context)) return failure("FORBIDDEN_SCOPE");
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const raw = this.queryClient(transaction);
        const scope = normalizedStorageScope(kind, context.scope);
        const existing = await this.findOneWith(raw, scope, contentKey);
        const repository = new InMemoryContentRepository(existing === undefined ? [] : [existing]);
        const service = new InstitutionService(repository, { now: this.now });
        const result = this.runWrite(
          service,
          kind,
          action,
          context,
          contentKey,
          payload,
          expectedVersion,
        );
        if (!result.ok) return result;

        const record = action === "CREATE" ? { ...result.data, id: randomUUID() } : result.data;
        if (action === "CREATE") {
          await raw.$executeRaw`
            INSERT INTO "institution_content_records" (
              "id", "tenant_id", "campus_id", "content_key", "content_type", "status",
              "title", "version", "visibility", "body", "published_at", "synthetic_data",
              "editor_note", "moderation_state", "tenant_admin_note", "campus_admin_note",
              "updated_by", "updated_at"
            ) VALUES (
              ${record.id}::uuid, ${record.tenant_id}::uuid, ${record.campus_id}::uuid,
              ${record.content_key}, ${record.type}, ${record.status}, ${record.title},
              ${record.version}, ${record.visibility}, ${JSON.stringify(record.body)}::jsonb,
              ${record.published_at}::timestamptz, TRUE, ${record.editor_note},
              ${record.moderation_state}, ${record.tenant_admin_note}, ${record.campus_admin_note},
              ${record.updated_by}, ${record.updated_at}::timestamptz
            )
          `;
        } else {
          const count = await raw.$executeRaw`
            UPDATE "institution_content_records"
            SET "content_type" = ${record.type},
                "status" = ${record.status},
                "title" = ${record.title},
                "version" = ${record.version},
                "visibility" = ${record.visibility},
                "body" = ${JSON.stringify(record.body)}::jsonb,
                "published_at" = ${record.published_at}::timestamptz,
                "synthetic_data" = TRUE,
                "editor_note" = ${record.editor_note},
                "moderation_state" = ${record.moderation_state},
                "tenant_admin_note" = ${record.tenant_admin_note},
                "campus_admin_note" = ${record.campus_admin_note},
                "updated_by" = ${record.updated_by},
                "updated_at" = ${record.updated_at}::timestamptz
            WHERE "tenant_id" = ${record.tenant_id}::uuid
              AND "campus_id" IS NOT DISTINCT FROM ${record.campus_id}::uuid
              AND "id" = ${record.id}::uuid
              AND "version" = ${existing?.version ?? -1}
          `;
          if (count !== 1) return failure("VERSION_MISMATCH");
        }

        if (action === "PUBLISH" || action === "UNPUBLISH") {
          await raw.$executeRaw`
            INSERT INTO "institution_content_publication_events" (
              "id", "tenant_id", "campus_id", "content_id", "content_key", "action",
              "resulting_version", "actor_reference", "occurred_at"
            ) VALUES (
              ${randomUUID()}::uuid, ${record.tenant_id}::uuid, ${record.campus_id}::uuid,
              ${record.id}::uuid, ${record.content_key}, ${record.status}, ${record.version},
              ${context.actorId}, ${record.updated_at}::timestamptz
            )
          `;
        }
        return { ok: true, data: record };
      });
    } catch (error) {
      if (action === "CREATE" && isUniqueViolation(error)) return failure("VERSION_MISMATCH");
      throw error;
    }
  }

  private runWrite(
    service: InstitutionService,
    kind: InstitutionContentKind,
    action: WriteAction,
    context: InstitutionActorContext,
    contentKey: string,
    payload: DraftPayload | undefined,
    expectedVersion: number | null | undefined,
  ): ContentOperationResult<ContentRecord> {
    if (kind === "INSTITUTION") {
      if (action === "CREATE")
        return service.createInstitutionDraft(
          context,
          contentKey,
          payload!,
          expectedVersion ?? null,
        );
      if (action === "UPDATE")
        return service.updateInstitutionDraft(context, contentKey, payload!, expectedVersion!);
      if (action === "PUBLISH")
        return service.publishInstitution(context, contentKey, expectedVersion!);
      return service.unpublishInstitution(context, contentKey, expectedVersion!);
    }
    if (action === "CREATE")
      return service.createHomeDraft(context, contentKey, payload!, expectedVersion ?? null);
    if (action === "UPDATE")
      return service.updateHomeDraft(context, contentKey, payload!, expectedVersion!);
    if (action === "PUBLISH") return service.publishHome(context, contentKey, expectedVersion!);
    return service.unpublishHome(context, contentKey, expectedVersion!);
  }

  private async findOneWith(
    raw: RawQueryClient,
    scope: ContentScope,
    contentKey: string,
  ): Promise<ContentRecord | undefined> {
    const rows = await raw.$queryRaw<readonly InstitutionContentRow[]>`
      SELECT
        "id"::text AS "id", "content_key" AS "content_key", "tenant_id"::text AS "tenant_id",
        "campus_id"::text AS "campus_id", "content_type" AS "type", "status", "title",
        "version", "visibility", "body", "published_at", "synthetic_data", "editor_note",
        "moderation_state", "tenant_admin_note", "campus_admin_note", "updated_by", "updated_at"
      FROM "institution_content_records"
      WHERE "tenant_id" = ${scope.tenantId}::uuid
        AND "campus_id" IS NOT DISTINCT FROM ${scope.campusId ?? null}::uuid
        AND "content_key" = ${contentKey}
      FOR UPDATE
    `;
    const row = rows[0];
    return row === undefined ? undefined : contentRecord(row);
  }

  private queryClient(value: PrismaClient | RawQueryClient): RawQueryClient {
    return value as unknown as RawQueryClient;
  }
}
