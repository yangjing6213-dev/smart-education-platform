import { createHmac, randomUUID } from "node:crypto";

export const RESOURCE_CATEGORIES = [
  "LESSON",
  "EXERCISE",
  "READING",
  "REFERENCE",
  "WORKSHEET",
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];
export type ResourceStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

export const RESOURCE_CURSOR_TTL_MS = 5 * 60 * 1000;
export const RESOURCE_READ_INTENT_TTL_MS = 5 * 60 * 1000;

export interface ResourceScope {
  readonly tenantId: string;
  readonly campusId: string;
}

export interface ResourceActorContext {
  readonly trusted: true;
  readonly actorId: string;
  readonly activeMembership: true;
  readonly scope: ResourceScope;
  readonly capabilities: readonly string[];
  readonly roles?: readonly string[];
}

export interface ResourceRecord {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly status: ResourceStatus;
  readonly version: number;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly category: ResourceCategory;
  readonly keywords: readonly string[];
  readonly role_scope: readonly string[];
  readonly file_ref: string | null;
  readonly synthetic_data: true;
  readonly updated_by: string;
  readonly updated_at: string;
}

export interface ResourceSearchInput {
  readonly query?: unknown;
  readonly category?: unknown;
  readonly limit?: unknown;
  readonly cursor?: unknown;
}

export interface ResourceSearchProjection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly category: ResourceCategory;
  readonly keywords: readonly string[];
  readonly version: number;
}

export interface ResourceSearchPage {
  readonly items: readonly ResourceSearchProjection[];
  readonly next_cursor: string | null;
}

export interface ResourceFileReference {
  readonly reference: string;
  readonly display_name: string;
}

export interface ResourceFileReadIntent {
  readonly read_intent: string;
}

export interface ResourceFileAccessPort {
  resolve(scope: ResourceScope, reference: string): ResourceFileReference | undefined;
}

export class InMemoryResourceFileAccessPort implements ResourceFileAccessPort {
  private readonly files = new Map<string, ResourceFileReference>();

  public constructor(
    initialFiles: readonly (ResourceFileReference & {
      readonly tenant_id: string;
      readonly campus_id: string;
    })[] = [],
  ) {
    for (const file of initialFiles) {
      this.files.set(
        storageKey({ tenantId: file.tenant_id, campusId: file.campus_id }, file.reference),
        {
          reference: file.reference,
          display_name: file.display_name,
        },
      );
    }
  }

  public resolve(scope: ResourceScope, reference: string): ResourceFileReference | undefined {
    const file = this.files.get(storageKey(scope, reference));
    return file === undefined ? undefined : { ...file };
  }
}

export interface ResourceRepository {
  get(scope: ResourceScope, resourceId: string): ResourceRecord | undefined;
  list(scope: ResourceScope): readonly ResourceRecord[];
}

export class InMemoryResourceRepository implements ResourceRepository {
  private readonly records = new Map<string, ResourceRecord>();

  public constructor(initialRecords: readonly ResourceRecord[] = []) {
    for (const record of initialRecords) {
      this.records.set(
        storageKey({ tenantId: record.tenant_id, campusId: record.campus_id }, record.id),
        cloneRecord(record),
      );
    }
  }

  public get(scope: ResourceScope, resourceId: string): ResourceRecord | undefined {
    const record = this.records.get(storageKey(scope, resourceId));
    return record === undefined ? undefined : cloneRecord(record);
  }

  public list(scope: ResourceScope): readonly ResourceRecord[] {
    return [...this.records.values()]
      .filter(
        (record) => record.tenant_id === scope.tenantId && record.campus_id === scope.campusId,
      )
      .map(cloneRecord);
  }
}

export type ResourceErrorCode =
  | "FORBIDDEN_SCOPE"
  | "NOT_FOUND_SCOPED"
  | "VALIDATION_FAILED"
  | "CURSOR_INVALID"
  | "SCOPE_STALE"
  | "STALE_VERSION"
  | "FILE_UNAVAILABLE";

export interface ResourceFailure {
  readonly ok: false;
  readonly error: {
    readonly code: ResourceErrorCode;
    readonly message: string;
  };
}

export interface ResourceSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export type ResourceResult<T> = ResourceSuccess<T> | ResourceFailure;

export interface ResourceAuditEvent {
  readonly eventType: "SEARCHED" | "READ";
  readonly tenantId: string;
  readonly campusId: string;
  readonly resourceId?: string;
  readonly actorReference: string;
  readonly eventTime: string;
}

export interface ResourceServiceOptions {
  readonly now?: () => Date;
  readonly onAuditEvent?: (event: ResourceAuditEvent) => void;
  readonly readIntentSecret?: string;
}

export interface ResourceFileProjection extends ResourceFileReference, ResourceFileReadIntent {
  readonly expires_at: string;
}

export interface ResourceDetailProjection extends ResourceSearchProjection {
  readonly body: string;
  readonly file?: ResourceFileProjection;
}

interface CursorState {
  readonly scope: ResourceScope;
  readonly query: string;
  readonly category?: ResourceCategory;
  readonly limit: number;
  readonly offset: number;
  readonly expiresAt: number;
}

const ERROR_MESSAGES: Record<ResourceErrorCode, string> = {
  FORBIDDEN_SCOPE: "Resource scope access is not permitted.",
  NOT_FOUND_SCOPED: "Resource was not found in the allowed scope.",
  VALIDATION_FAILED: "Resource request is invalid.",
  CURSOR_INVALID: "Resource cursor is invalid.",
  SCOPE_STALE: "Resource scope or search cursor is stale.",
  STALE_VERSION: "Resource version is stale.",
  FILE_UNAVAILABLE: "The resource attachment is unavailable.",
};

const RESOURCE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_FILE_REFERENCE_PATTERN = /^file-ref:\/[A-Za-z0-9._/-]{1,200}$/;
const SEARCH_KEYS = new Set(["query", "category", "limit", "cursor"]);
const CATEGORY_SET = new Set<string>(RESOURCE_CATEGORIES);

function storageKey(scope: ResourceScope, key: string): string {
  return JSON.stringify([scope.tenantId, scope.campusId, key]);
}

function cloneRecord(record: ResourceRecord): ResourceRecord {
  return {
    ...record,
    keywords: [...record.keywords],
    role_scope: [...record.role_scope],
  };
}

function failure<T = never>(code: ResourceErrorCode): ResourceResult<T> {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidScope(value: unknown): value is ResourceScope {
  return (
    isRecord(value) &&
    typeof value.tenantId === "string" &&
    value.tenantId.length > 0 &&
    typeof value.campusId === "string" &&
    value.campusId.length > 0
  );
}

function isAuthorized(value: unknown): value is ResourceActorContext {
  return (
    isRecord(value) &&
    value.trusted === true &&
    value.activeMembership === true &&
    typeof value.actorId === "string" &&
    value.actorId.length > 0 &&
    isValidScope(value.scope) &&
    Array.isArray(value.capabilities) &&
    value.capabilities.includes("content:write")
  );
}

function sameScope(left: ResourceScope, right: ResourceScope): boolean {
  return left.tenantId === right.tenantId && left.campusId === right.campusId;
}

function isSafeFileReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SAFE_FILE_REFERENCE_PATTERN.test(value) &&
    !value.split("/").includes("..")
  );
}

function isValidResourceId(value: unknown): value is string {
  return typeof value === "string" && RESOURCE_ID_PATTERN.test(value);
}

function parseSearchInput(value: unknown):
  | {
      readonly query: string;
      readonly category?: ResourceCategory;
      readonly limit: number;
      readonly cursor?: string;
    }
  | undefined {
  if (!isRecord(value) || Object.keys(value).some((key) => !SEARCH_KEYS.has(key))) return undefined;
  if (typeof value.query !== "string" || value.query.trim().length < 1 || value.query.length > 80) {
    return undefined;
  }
  if (
    value.category !== undefined &&
    (typeof value.category !== "string" || !CATEGORY_SET.has(value.category))
  ) {
    return undefined;
  }
  if (
    value.limit !== undefined &&
    (typeof value.limit !== "number" ||
      !Number.isInteger(value.limit) ||
      value.limit < 1 ||
      value.limit > 25)
  ) {
    return undefined;
  }
  if (
    value.cursor !== undefined &&
    (typeof value.cursor !== "string" || value.cursor.length < 1 || value.cursor.length > 200)
  ) {
    return undefined;
  }
  return {
    query: value.query.trim(),
    ...(value.category === undefined ? {} : { category: value.category as ResourceCategory }),
    limit: value.limit === undefined ? 20 : value.limit,
    ...(value.cursor === undefined ? {} : { cursor: value.cursor }),
  };
}

function projectSearch(record: ResourceRecord): ResourceSearchProjection {
  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    category: record.category,
    keywords: [...record.keywords],
    version: record.version,
  };
}

function rolesFor(context: ResourceActorContext): readonly string[] {
  return context.roles ?? context.capabilities;
}

function roleAllows(record: ResourceRecord, context: ResourceActorContext): boolean {
  return (
    record.role_scope.length === 0 ||
    record.role_scope.some((role) => rolesFor(context).includes(role))
  );
}

function searchable(
  record: ResourceRecord,
  context: ResourceActorContext,
  parsed: {
    readonly query: string;
    readonly category?: ResourceCategory;
  },
): boolean {
  if (
    record.status !== "PUBLISHED" ||
    record.version < 1 ||
    !roleAllows(record, context) ||
    (record.file_ref !== null && !isSafeFileReference(record.file_ref))
  ) {
    return false;
  }
  if (parsed.category !== undefined && record.category !== parsed.category) return false;
  return [record.title, record.summary, ...record.keywords]
    .join(" ")
    .toLocaleLowerCase()
    .includes(parsed.query.toLocaleLowerCase());
}

export class ResourceService {
  private readonly repository: ResourceRepository;
  private readonly fileAccess: ResourceFileAccessPort;
  private readonly now: () => Date;
  private readonly onAuditEvent: (event: ResourceAuditEvent) => void;
  private readonly readIntentSecret: string;
  private readonly cursors = new Map<string, CursorState>();

  public constructor(
    repository: ResourceRepository = new InMemoryResourceRepository(),
    fileAccess: ResourceFileAccessPort = new InMemoryResourceFileAccessPort(),
    options: ResourceServiceOptions = {},
  ) {
    this.repository = repository;
    this.fileAccess = fileAccess;
    this.now = options.now ?? (() => new Date());
    this.onAuditEvent = options.onAuditEvent ?? (() => undefined);
    this.readIntentSecret = options.readIntentSecret ?? randomUUID();
  }

  public search(
    context: ResourceActorContext,
    input: ResourceSearchInput,
  ): ResourceResult<ResourceSearchPage> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    const parsed = parseSearchInput(input);
    if (parsed === undefined) return failure("VALIDATION_FAILED");

    let offset = 0;
    if (parsed.cursor !== undefined) {
      const cursor = this.cursors.get(parsed.cursor);
      if (cursor === undefined) return failure("CURSOR_INVALID");
      if (this.now().getTime() >= cursor.expiresAt) {
        this.cursors.delete(parsed.cursor);
        return failure("CURSOR_INVALID");
      }
      if (!sameScope(cursor.scope, context.scope)) return failure("SCOPE_STALE");
      if (
        cursor.query !== parsed.query ||
        cursor.category !== parsed.category ||
        cursor.limit !== parsed.limit
      ) {
        return failure("CURSOR_INVALID");
      }
      offset = cursor.offset;
    }

    const matches = this.repository
      .list(context.scope)
      .filter((record) => searchable(record, context, parsed))
      .sort(
        (left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
      );
    const items = matches.slice(offset, offset + parsed.limit).map(projectSearch);
    const nextOffset = offset + items.length;
    const nextCursor =
      nextOffset < matches.length
        ? this.createCursor({
            scope: context.scope,
            query: parsed.query,
            ...(parsed.category === undefined ? {} : { category: parsed.category }),
            limit: parsed.limit,
            offset: nextOffset,
            expiresAt: this.now().getTime() + RESOURCE_CURSOR_TTL_MS,
          })
        : null;

    this.onAuditEvent({
      eventType: "SEARCHED",
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      actorReference: context.actorId,
      eventTime: this.now().toISOString(),
    });
    return { ok: true, data: { items, next_cursor: nextCursor } };
  }

  public readDetail(
    context: ResourceActorContext,
    resourceId: string,
    expectedVersion: number,
  ): ResourceResult<ResourceDetailProjection> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    if (
      !isValidResourceId(resourceId) ||
      !Number.isInteger(expectedVersion) ||
      expectedVersion < 1
    ) {
      return failure("VALIDATION_FAILED");
    }

    const record = this.repository.get(context.scope, resourceId);
    if (record === undefined || !roleAllows(record, context) || record.status !== "PUBLISHED") {
      return failure("NOT_FOUND_SCOPED");
    }
    if (record.version !== expectedVersion) return failure("STALE_VERSION");
    if (record.file_ref !== null && !isSafeFileReference(record.file_ref)) {
      return failure("NOT_FOUND_SCOPED");
    }

    const now = this.now();
    const file =
      record.file_ref === null
        ? undefined
        : this.fileAccess.resolve(context.scope, record.file_ref);
    if (record.file_ref !== null && file === undefined) return failure("FILE_UNAVAILABLE");

    const projection: ResourceDetailProjection = {
      ...projectSearch(record),
      body: record.body,
      ...(file === undefined
        ? {}
        : {
            file: {
              reference: file.reference,
              display_name: file.display_name,
              read_intent: this.createReadIntent(
                context.scope,
                file.reference,
                now.getTime() + RESOURCE_READ_INTENT_TTL_MS,
              ),
              expires_at: new Date(now.getTime() + RESOURCE_READ_INTENT_TTL_MS).toISOString(),
            },
          }),
    };
    this.onAuditEvent({
      eventType: "READ",
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      resourceId: record.id,
      actorReference: context.actorId,
      eventTime: now.toISOString(),
    });
    return { ok: true, data: projection };
  }

  private createCursor(state: CursorState): string {
    const token = `resource-cursor:${randomUUID()}`;
    this.cursors.set(token, state);
    return token;
  }

  private createReadIntent(scope: ResourceScope, reference: string, expiresAt: number): string {
    const payload = JSON.stringify({
      campus_id: scope.campusId,
      expires_at: expiresAt,
      reference,
      tenant_id: scope.tenantId,
    });
    const encodedPayload = Buffer.from(payload).toString("base64url");
    const signature = createHmac("sha256", this.readIntentSecret)
      .update(encodedPayload)
      .digest("base64url");
    return `read-intent.${encodedPayload}.${signature}`;
  }
}
