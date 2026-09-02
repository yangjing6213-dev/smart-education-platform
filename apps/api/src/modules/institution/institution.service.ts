import {
  CONTENT_TYPES,
  CONTENT_VISIBILITIES,
  type ContentType,
  type PublicContentProjection,
} from "@student-care/contracts";
import { contentInputSchema } from "@student-care/validation";
import {
  ContentService,
  type ContentActorContext,
  type ContentOperationResult,
  type DraftPayload,
  type PublicationAuditEvent,
} from "../content/content.service.js";
import {
  InMemoryContentRepository,
  type ContentRepository,
  type ContentRecord,
} from "../content/content.repository.js";

export type InstitutionActorContext = ContentActorContext;
export type InstitutionContentKind = "INSTITUTION" | "HOME_BLOCK";

export interface InstitutionPublicScope {
  readonly tenantId: string;
  readonly campusId?: string;
}

export interface InstitutionServiceOptions {
  readonly now?: () => Date;
  readonly onPublicationAuditEvent?: (event: PublicationAuditEvent) => void;
}

const ERROR_MESSAGES = {
  FORBIDDEN_SCOPE: "Content scope access is not permitted.",
  NOT_FOUND_SCOPED: "Published content was not found.",
  VALIDATION_FAILED: "Content input is invalid.",
  CONFLICT_STATE: "Content state transition is not permitted.",
} as const;

const CONTENT_TYPE_SET = new Set<string>(CONTENT_TYPES);
const CONTENT_VISIBILITY_SET = new Set<string>(CONTENT_VISIBILITIES);
const CONTENT_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const PAYLOAD_KEYS = new Set([
  "title",
  "type",
  "visibility",
  "body",
  "editor_note",
  "moderation_state",
  "tenant_admin_note",
  "campus_admin_note",
]);

function failure(
  code: "FORBIDDEN_SCOPE" | "NOT_FOUND_SCOPED" | "VALIDATION_FAILED" | "CONFLICT_STATE",
) {
  return { ok: false as const, error: { code, message: ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAuthorizedContext(
  context: unknown,
  capability?: "content:write" | "content:publish",
): context is InstitutionActorContext {
  if (!isRecord(context) || context.trusted !== true || context.activeMembership !== true) {
    return false;
  }
  if (typeof context.actorId !== "string" || !isRecord(context.scope)) return false;
  if (typeof context.scope.tenantId !== "string") return false;
  if (context.scope.campusId !== undefined && typeof context.scope.campusId !== "string") {
    return false;
  }
  if (
    !Array.isArray(context.capabilities) ||
    !context.capabilities.every((item) => typeof item === "string")
  ) {
    return false;
  }
  return capability === undefined || context.capabilities.includes(capability);
}

function contentTypeFor(kind: InstitutionContentKind): ContentType {
  return kind;
}

function normalizeContext(
  context: unknown,
  kind: InstitutionContentKind,
): InstitutionActorContext | undefined {
  if (!isAuthorizedContext(context)) return undefined;
  if (kind === "INSTITUTION") {
    return { ...context, scope: { tenantId: context.scope.tenantId } };
  }
  return context;
}

function validPayload(payload: unknown, kind: InstitutionContentKind): payload is DraftPayload {
  if (!isRecord(payload)) return false;
  if ([...Object.keys(payload)].some((key) => !PAYLOAD_KEYS.has(key))) return false;
  if (payload.type !== contentTypeFor(kind)) return false;
  if (payload.visibility !== undefined && typeof payload.visibility !== "string") return false;
  for (const key of ["editor_note", "moderation_state", "tenant_admin_note", "campus_admin_note"]) {
    if (payload[key] !== undefined && typeof payload[key] !== "string") return false;
  }
  return (
    CONTENT_TYPE_SET.has(payload.type as string) &&
    CONTENT_VISIBILITY_SET.has(payload.visibility as string) &&
    contentInputSchema.safeParse({
      type: payload.type,
      title: payload.title,
      body: payload.body,
    }).success
  );
}

function validContentKey(contentKey: unknown): contentKey is string {
  return typeof contentKey === "string" && CONTENT_KEY_PATTERN.test(contentKey);
}

export class InstitutionService {
  public readonly repository: ContentRepository;
  private readonly contentService: ContentService;

  public constructor(
    repository: ContentRepository = new InMemoryContentRepository(),
    options: InstitutionServiceOptions = {},
  ) {
    this.repository = repository;
    this.contentService = new ContentService(repository, options);
  }

  public createInstitutionDraft(
    context: InstitutionActorContext,
    contentKey: string,
    payload: DraftPayload,
    expectedVersion: number | null = null,
  ): ContentOperationResult<ContentRecord> {
    return this.createDraft("INSTITUTION", context, contentKey, payload, expectedVersion);
  }

  public updateInstitutionDraft(
    context: InstitutionActorContext,
    contentKey: string,
    payload: DraftPayload,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    return this.updateDraft("INSTITUTION", context, contentKey, payload, expectedCurrentVersion);
  }

  public publishInstitution(
    context: InstitutionActorContext,
    contentKey: string,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    return this.publish("INSTITUTION", context, contentKey, expectedCurrentVersion);
  }

  public unpublishInstitution(
    context: InstitutionActorContext,
    contentKey: string,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    return this.unpublish("INSTITUTION", context, contentKey, expectedCurrentVersion);
  }

  public readInstitutionDraft(
    context: InstitutionActorContext,
    contentKey: string,
  ): ContentOperationResult<ContentRecord> {
    return this.readDraft("INSTITUTION", context, contentKey);
  }

  public readInstitutionPublic(
    context: InstitutionActorContext,
    contentKey: string,
  ): ContentOperationResult<PublicContentProjection> {
    return this.readPublic("INSTITUTION", context, contentKey);
  }

  public readInstitutionPublicForVisitor(
    scope: InstitutionPublicScope,
    contentKey: string,
  ): ContentOperationResult<PublicContentProjection> {
    return this.readPublic("INSTITUTION", visitorContext(scope), contentKey);
  }

  public createHomeDraft(
    context: InstitutionActorContext,
    contentKey: string,
    payload: DraftPayload,
    expectedVersion: number | null = null,
  ): ContentOperationResult<ContentRecord> {
    return this.createDraft("HOME_BLOCK", context, contentKey, payload, expectedVersion);
  }

  public updateHomeDraft(
    context: InstitutionActorContext,
    contentKey: string,
    payload: DraftPayload,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    return this.updateDraft("HOME_BLOCK", context, contentKey, payload, expectedCurrentVersion);
  }

  public publishHome(
    context: InstitutionActorContext,
    contentKey: string,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    return this.publish("HOME_BLOCK", context, contentKey, expectedCurrentVersion);
  }

  public unpublishHome(
    context: InstitutionActorContext,
    contentKey: string,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    return this.unpublish("HOME_BLOCK", context, contentKey, expectedCurrentVersion);
  }

  public readHomeDraft(
    context: InstitutionActorContext,
    contentKey: string,
  ): ContentOperationResult<ContentRecord> {
    return this.readDraft("HOME_BLOCK", context, contentKey);
  }

  public readHomePublic(
    context: InstitutionActorContext,
    contentKey: string,
  ): ContentOperationResult<PublicContentProjection> {
    return this.readPublic("HOME_BLOCK", context, contentKey);
  }

  public readHomePublicForVisitor(
    scope: InstitutionPublicScope,
    contentKey: string,
  ): ContentOperationResult<PublicContentProjection> {
    return this.readPublic("HOME_BLOCK", visitorContext(scope), contentKey);
  }

  private createDraft(
    kind: InstitutionContentKind,
    context: unknown,
    contentKey: string,
    payload: DraftPayload,
    expectedVersion: number | null,
  ): ContentOperationResult<ContentRecord> {
    const normalized = normalizeContext(context, kind);
    if (!isAuthorizedContext(normalized, "content:write")) return failure("FORBIDDEN_SCOPE");
    if (!validContentKey(contentKey) || !validPayload(payload, kind)) {
      return failure("VALIDATION_FAILED");
    }
    const existing = this.repository.get(normalized.scope, contentKey);
    if (existing !== undefined && existing.type !== contentTypeFor(kind)) {
      return failure("CONFLICT_STATE");
    }
    return this.contentService.createDraft(normalized, contentKey, payload, expectedVersion);
  }

  private updateDraft(
    kind: InstitutionContentKind,
    context: unknown,
    contentKey: string,
    payload: DraftPayload,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    const normalized = normalizeContext(context, kind);
    if (!isAuthorizedContext(normalized, "content:write")) return failure("FORBIDDEN_SCOPE");
    if (!validContentKey(contentKey) || !validPayload(payload, kind)) {
      return failure("VALIDATION_FAILED");
    }
    if (this.isOtherContentKind(normalized, contentKey, kind)) {
      return failure("NOT_FOUND_SCOPED");
    }
    return this.contentService.updateDraft(normalized, contentKey, payload, expectedCurrentVersion);
  }

  private publish(
    kind: InstitutionContentKind,
    context: unknown,
    contentKey: string,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    const normalized = normalizeContext(context, kind);
    if (!isAuthorizedContext(normalized, "content:publish")) return failure("FORBIDDEN_SCOPE");
    if (!validContentKey(contentKey)) return failure("VALIDATION_FAILED");
    if (this.isOtherContentKind(normalized, contentKey, kind)) {
      return failure("NOT_FOUND_SCOPED");
    }
    return this.contentService.publish(normalized, contentKey, expectedCurrentVersion);
  }

  private unpublish(
    kind: InstitutionContentKind,
    context: unknown,
    contentKey: string,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    const normalized = normalizeContext(context, kind);
    if (!isAuthorizedContext(normalized, "content:publish")) return failure("FORBIDDEN_SCOPE");
    if (!validContentKey(contentKey)) return failure("VALIDATION_FAILED");
    if (this.isOtherContentKind(normalized, contentKey, kind)) {
      return failure("NOT_FOUND_SCOPED");
    }
    return this.contentService.unpublish(normalized, contentKey, expectedCurrentVersion);
  }

  private readDraft(
    kind: InstitutionContentKind,
    context: unknown,
    contentKey: string,
  ): ContentOperationResult<ContentRecord> {
    const normalized = normalizeContext(context, kind);
    if (!isAuthorizedContext(normalized)) return failure("FORBIDDEN_SCOPE");
    if (!validContentKey(contentKey)) return failure("VALIDATION_FAILED");
    if (this.isOtherContentKind(normalized, contentKey, kind)) {
      return failure("NOT_FOUND_SCOPED");
    }
    const record = this.repository.get(normalized.scope, contentKey);
    return record === undefined ? failure("NOT_FOUND_SCOPED") : { ok: true, data: record };
  }

  private readPublic(
    kind: InstitutionContentKind,
    context: unknown,
    contentKey: string,
  ): ContentOperationResult<PublicContentProjection> {
    const normalized = normalizeContext(context, kind);
    if (!isAuthorizedContext(normalized)) return failure("FORBIDDEN_SCOPE");
    if (!validContentKey(contentKey)) return failure("VALIDATION_FAILED");
    if (this.isOtherContentKind(normalized, contentKey, kind)) {
      return failure("NOT_FOUND_SCOPED");
    }
    return this.contentService.readPublic(normalized, contentKey);
  }

  private isOtherContentKind(
    context: InstitutionActorContext,
    contentKey: string,
    kind: InstitutionContentKind,
  ): boolean {
    const existing = this.repository.get(context.scope, contentKey);
    return existing !== undefined && existing.type !== contentTypeFor(kind);
  }
}

function visitorContext(scope: InstitutionPublicScope): InstitutionActorContext {
  return {
    trusted: true,
    actorId: "visitor",
    activeMembership: true,
    scope,
    capabilities: [],
  };
}
