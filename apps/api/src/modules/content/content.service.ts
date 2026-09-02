import {
  CONTENT_TYPES,
  CONTENT_VISIBILITIES,
  type ContentBody,
  type ContentStatus,
  type ContentType,
  type ContentVisibility,
  type PublicContentBlock,
  type PublicContentProjection,
} from "@student-care/contracts";
import {
  type ContentRecord,
  type ContentRepository,
  type ContentScope,
  InMemoryContentRepository,
} from "./content.repository.js";

export type ContentCapability = "content:write" | "content:publish";

export interface ContentActorContext {
  readonly trusted: true;
  readonly actorId: string;
  readonly activeMembership: true;
  readonly scope: ContentScope;
  readonly capabilities: readonly string[];
}

export interface DraftPayload {
  readonly title: string;
  readonly type: ContentType;
  readonly visibility: ContentVisibility;
  readonly body: ContentBody;
  readonly editor_note?: string;
  readonly moderation_state?: string;
  readonly tenant_admin_note?: string;
  readonly campus_admin_note?: string;
}

export interface PublicationAuditEvent {
  readonly eventType: "PUBLISHED" | "UNPUBLISHED";
  readonly tenantId: string;
  readonly campusId?: string;
  readonly contentKey: string;
  readonly resultingVersion: number;
  readonly actorReference: string;
  readonly eventTime: string;
}

export type ContentErrorCode =
  | "FORBIDDEN_SCOPE"
  | "NOT_FOUND_SCOPED"
  | "VALIDATION_FAILED"
  | "VERSION_MISMATCH"
  | "CONFLICT_STATE";

export interface ContentOperationError {
  readonly ok: false;
  readonly error: {
    readonly code: ContentErrorCode;
    readonly message: string;
  };
}

export interface ContentOperationSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export type ContentOperationResult<T> = ContentOperationSuccess<T> | ContentOperationError;

export interface ContentServiceOptions {
  readonly now?: () => Date;
  readonly onPublicationAuditEvent?: (event: PublicationAuditEvent) => void;
}

const ERROR_MESSAGES: Record<ContentErrorCode, string> = {
  FORBIDDEN_SCOPE: "Content scope access is not permitted.",
  NOT_FOUND_SCOPED: "Published content was not found.",
  VALIDATION_FAILED: "Content input is invalid.",
  VERSION_MISMATCH: "Content version is stale.",
  CONFLICT_STATE: "Content state transition is not permitted.",
};

const CONTENT_TYPE_SET = new Set<string>(CONTENT_TYPES);
const CONTENT_VISIBILITY_SET = new Set<string>(CONTENT_VISIBILITIES);
const CONTENT_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function failure(code: ContentErrorCode): ContentOperationError {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

function isAuthorized(
  context: unknown,
  capability?: ContentCapability,
): context is ContentActorContext {
  if (typeof context !== "object" || context === null || Array.isArray(context)) return false;
  const candidate = context as Record<string, unknown>;
  const scope = candidate.scope;
  if (
    candidate.trusted !== true ||
    candidate.activeMembership !== true ||
    typeof candidate.actorId !== "string" ||
    typeof scope !== "object" ||
    scope === null ||
    Array.isArray(scope)
  ) {
    return false;
  }
  const scopeRecord = scope as Record<string, unknown>;
  if (
    typeof scopeRecord.tenantId !== "string" ||
    (scopeRecord.campusId !== undefined && typeof scopeRecord.campusId !== "string") ||
    !Array.isArray(candidate.capabilities)
  ) {
    return false;
  }
  return capability === undefined || candidate.capabilities.includes(capability);
}

function validDraftPayload(payload: DraftPayload): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof payload.title === "string" &&
    payload.title.length > 0 &&
    CONTENT_TYPE_SET.has(payload.type) &&
    CONTENT_VISIBILITY_SET.has(payload.visibility) &&
    typeof payload.body === "object" &&
    payload.body !== null &&
    typeof payload.body.summary === "string" &&
    Array.isArray(payload.body.blocks) &&
    payload.body.blocks.every(
      (block) =>
        typeof block === "object" &&
        block !== null &&
        typeof block.kind === "string" &&
        typeof block.text === "string",
    )
  );
}

function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function projectPublic(record: ContentRecord): PublicContentProjection {
  const blocks: PublicContentBlock[] = record.body.blocks.map((block) => {
    return block.href !== undefined && block.href !== null
      ? { kind: block.kind, text: block.text, href: block.href }
      : { kind: block.kind, text: block.text };
  });

  return {
    id: record.id,
    content_key: record.content_key,
    type: record.type,
    title: record.title,
    version: record.version,
    visibility: record.visibility,
    summary: record.body.summary,
    blocks,
    published_at: record.published_at!,
  };
}

export class ContentService {
  public readonly repository: ContentRepository;
  private readonly now: () => Date;
  private readonly onPublicationAuditEvent: (event: PublicationAuditEvent) => void;

  public constructor(
    repository: ContentRepository = new InMemoryContentRepository(),
    options: ContentServiceOptions = {},
  ) {
    this.repository = repository;
    this.now = options.now ?? (() => new Date());
    this.onPublicationAuditEvent = options.onPublicationAuditEvent ?? (() => undefined);
  }

  public createDraft(
    context: ContentActorContext,
    contentKey: string,
    payload: DraftPayload,
    expectedVersion: number | null = null,
  ): ContentOperationResult<ContentRecord> {
    if (!isAuthorized(context, "content:write")) return failure("FORBIDDEN_SCOPE");
    if (!CONTENT_KEY_PATTERN.test(contentKey) || !validDraftPayload(payload)) {
      return failure("VALIDATION_FAILED");
    }

    const existing = this.repository.get(context.scope, contentKey);
    if (existing !== undefined) {
      if (expectedVersion === null || existing.version !== expectedVersion) {
        return failure("VERSION_MISMATCH");
      }
      return failure("CONFLICT_STATE");
    }

    const now = this.now().toISOString();
    const record: ContentRecord = {
      id: contentKey,
      content_key: contentKey,
      tenant_id: context.scope.tenantId,
      campus_id: context.scope.campusId ?? null,
      type: payload.type,
      status: "DRAFT",
      title: payload.title,
      version: 1,
      visibility: payload.visibility,
      body: payload.body,
      published_at: null,
      synthetic_data: true,
      editor_note: payload.editor_note ?? "",
      moderation_state: payload.moderation_state ?? "UNREVIEWED",
      tenant_admin_note: payload.tenant_admin_note ?? "",
      campus_admin_note: payload.campus_admin_note ?? "",
      updated_by: context.actorId,
      updated_at: now,
    };
    this.repository.save(record);
    return { ok: true, data: record };
  }

  public updateDraft(
    context: ContentActorContext,
    contentKey: string,
    payload: DraftPayload,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    if (!isAuthorized(context, "content:write")) return failure("FORBIDDEN_SCOPE");
    if (!CONTENT_KEY_PATTERN.test(contentKey) || !validDraftPayload(payload)) {
      return failure("VALIDATION_FAILED");
    }
    const existing = this.repository.get(context.scope, contentKey);
    if (existing === undefined) return failure("NOT_FOUND_SCOPED");
    if (!isVersion(expectedCurrentVersion) || existing.version !== expectedCurrentVersion) {
      return failure("VERSION_MISMATCH");
    }

    const record: ContentRecord = {
      ...existing,
      type: payload.type,
      status: "DRAFT",
      title: payload.title,
      version: existing.version + 1,
      visibility: payload.visibility,
      body: payload.body,
      published_at: null,
      editor_note: payload.editor_note ?? "",
      moderation_state: payload.moderation_state ?? "UNREVIEWED",
      tenant_admin_note: payload.tenant_admin_note ?? "",
      campus_admin_note: payload.campus_admin_note ?? "",
      updated_by: context.actorId,
      updated_at: this.now().toISOString(),
    };
    this.repository.save(record);
    return { ok: true, data: record };
  }

  public publish(
    context: ContentActorContext,
    contentKey: string,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    return this.transitionPublication(context, contentKey, expectedCurrentVersion, "PUBLISHED");
  }

  public unpublish(
    context: ContentActorContext,
    contentKey: string,
    expectedCurrentVersion: number,
  ): ContentOperationResult<ContentRecord> {
    return this.transitionPublication(context, contentKey, expectedCurrentVersion, "UNPUBLISHED");
  }

  public readPublic(
    context: ContentActorContext,
    contentKey: string,
  ): ContentOperationResult<PublicContentProjection> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    if (!CONTENT_KEY_PATTERN.test(contentKey)) return failure("VALIDATION_FAILED");
    const record = this.repository.get(context.scope, contentKey);
    if (
      record === undefined ||
      record.status !== "PUBLISHED" ||
      record.visibility !== "PUBLIC" ||
      record.published_at === null
    ) {
      return failure("NOT_FOUND_SCOPED");
    }
    return { ok: true, data: projectPublic(record) };
  }

  private transitionPublication(
    context: ContentActorContext,
    contentKey: string,
    expectedCurrentVersion: number,
    targetStatus: Extract<ContentStatus, "PUBLISHED" | "UNPUBLISHED">,
  ): ContentOperationResult<ContentRecord> {
    if (!isAuthorized(context, "content:publish")) return failure("FORBIDDEN_SCOPE");
    if (!CONTENT_KEY_PATTERN.test(contentKey) || !isVersion(expectedCurrentVersion)) {
      return failure("VALIDATION_FAILED");
    }
    const existing = this.repository.get(context.scope, contentKey);
    if (existing === undefined) return failure("NOT_FOUND_SCOPED");
    if (existing.version !== expectedCurrentVersion) return failure("VERSION_MISMATCH");
    if (
      (targetStatus === "PUBLISHED" && existing.status === "PUBLISHED") ||
      (targetStatus === "UNPUBLISHED" && existing.status !== "PUBLISHED")
    ) {
      return failure("CONFLICT_STATE");
    }

    const now = this.now().toISOString();
    const record: ContentRecord = {
      ...existing,
      status: targetStatus,
      version: existing.version + 1,
      published_at: targetStatus === "PUBLISHED" ? now : null,
      updated_by: context.actorId,
      updated_at: now,
    };
    this.repository.save(record);
    this.onPublicationAuditEvent({
      eventType: targetStatus,
      tenantId: record.tenant_id,
      ...(record.campus_id === null ? {} : { campusId: record.campus_id }),
      contentKey: record.content_key,
      resultingVersion: record.version,
      actorReference: context.actorId,
      eventTime: now,
    });
    return { ok: true, data: record };
  }
}
