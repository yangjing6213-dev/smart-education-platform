export type GuideStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
export type GuideCategory = "ORIENTATION" | "POLICY" | "SAFETY";

export interface GuideScope {
  readonly tenantId: string;
  readonly campusId: string;
}

export interface GuideActorContext {
  readonly trusted: true;
  readonly actorId: string;
  readonly activeMembership: true;
  readonly scope: GuideScope;
  readonly capabilities: readonly string[];
}

export interface GuideRecord {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly status: GuideStatus;
  readonly version: number;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly category: GuideCategory;
  readonly tags: readonly string[];
  readonly file_ref: string | null;
  readonly synthetic_data: true;
  readonly updated_by: string;
  readonly updated_at: string;
}

export interface GuideSearchInput {
  readonly query?: unknown;
  readonly category?: unknown;
  readonly limit?: unknown;
}

export interface GuideSearchProjection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly category: GuideCategory;
  readonly tags: readonly string[];
  readonly version: number;
}

export interface GuideFileReference {
  readonly reference: string;
  readonly display_name: string;
}

export interface GuideDetailProjection extends GuideSearchProjection {
  readonly body: string;
  readonly file?: GuideFileReference;
}

export interface GuideReadAuditEvent {
  readonly eventType: "SEARCHED" | "READ";
  readonly tenantId: string;
  readonly campusId: string;
  readonly guideId?: string;
  readonly actorReference: string;
  readonly eventTime: string;
}

export interface GuideRepository {
  get(scope: GuideScope, guideId: string): GuideRecord | undefined;
  list(scope: GuideScope): readonly GuideRecord[];
}

export class InMemoryGuideRepository implements GuideRepository {
  private readonly records = new Map<string, GuideRecord>();

  public constructor(initialRecords: readonly GuideRecord[] = []) {
    for (const record of initialRecords) {
      this.records.set(
        storageKey({ tenantId: record.tenant_id, campusId: record.campus_id }, record.id),
        {
          ...record,
          tags: [...record.tags],
        },
      );
    }
  }

  public get(scope: GuideScope, guideId: string): GuideRecord | undefined {
    const record = this.records.get(storageKey(scope, guideId));
    return record === undefined ? undefined : cloneRecord(record);
  }

  public list(scope: GuideScope): readonly GuideRecord[] {
    return [...this.records.values()]
      .filter(
        (record) => record.tenant_id === scope.tenantId && record.campus_id === scope.campusId,
      )
      .map(cloneRecord);
  }
}

export interface GuideFileAccessPort {
  resolve(scope: GuideScope, reference: string): GuideFileReference | undefined;
}

export class InMemoryGuideFileAccessPort implements GuideFileAccessPort {
  private readonly files = new Map<string, GuideFileReference>();

  public constructor(
    initialFiles: readonly (GuideFileReference & {
      readonly tenant_id: string;
      readonly campus_id: string;
    })[] = [],
  ) {
    for (const file of initialFiles) {
      this.files.set(
        storageKey({ tenantId: file.tenant_id, campusId: file.campus_id }, file.reference),
        { reference: file.reference, display_name: file.display_name },
      );
    }
  }

  public resolve(scope: GuideScope, reference: string): GuideFileReference | undefined {
    const file = this.files.get(storageKey(scope, reference));
    return file === undefined ? undefined : { ...file };
  }
}

export type GuideErrorCode = "FORBIDDEN_SCOPE" | "NOT_FOUND_SCOPED" | "VALIDATION_FAILED";

export interface GuideError {
  readonly ok: false;
  readonly error: {
    readonly code: GuideErrorCode;
    readonly message: string;
  };
}

export interface GuideSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export type GuideResult<T> = GuideSuccess<T> | GuideError;

export interface GuideServiceOptions {
  readonly now?: () => Date;
  readonly onReadAuditEvent?: (event: GuideReadAuditEvent) => void;
}

const ERROR_MESSAGES: Record<GuideErrorCode, string> = {
  FORBIDDEN_SCOPE: "Guide scope access is not permitted.",
  NOT_FOUND_SCOPED: "Guide was not found in the allowed scope.",
  VALIDATION_FAILED: "Guide request is invalid.",
};

const GUIDE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_FILE_REFERENCE_PATTERN = /^file-ref:\/[A-Za-z0-9._/-]{1,200}$/;
const SEARCH_KEYS = new Set(["query", "category", "limit"]);
const CATEGORIES = new Set<GuideCategory>(["ORIENTATION", "POLICY", "SAFETY"]);

function storageKey(scope: GuideScope, key: string): string {
  return JSON.stringify([scope.tenantId, scope.campusId, key]);
}

function cloneRecord(record: GuideRecord): GuideRecord {
  return { ...record, tags: [...record.tags] };
}

function failure(code: GuideErrorCode): GuideError {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidScope(value: unknown): value is GuideScope {
  return (
    isRecord(value) &&
    typeof value.tenantId === "string" &&
    value.tenantId.length > 0 &&
    typeof value.campusId === "string" &&
    value.campusId.length > 0
  );
}

function isAuthorized(value: unknown): value is GuideActorContext {
  if (!isRecord(value)) return false;
  return (
    value.trusted === true &&
    value.activeMembership === true &&
    typeof value.actorId === "string" &&
    value.actorId.length > 0 &&
    isValidScope(value.scope) &&
    Array.isArray(value.capabilities) &&
    value.capabilities.includes("content:write")
  );
}

function isSafeFileReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SAFE_FILE_REFERENCE_PATTERN.test(value) &&
    !value.split("/").includes("..")
  );
}

function validGuideId(value: unknown): value is string {
  return typeof value === "string" && GUIDE_ID_PATTERN.test(value);
}

function parseSearchInput(value: unknown):
  | {
      readonly query: string;
      readonly category?: GuideCategory;
      readonly limit: number;
    }
  | undefined {
  if (!isRecord(value) || Object.keys(value).some((key) => !SEARCH_KEYS.has(key))) return undefined;
  if (typeof value.query !== "string" || value.query.trim().length < 1 || value.query.length > 80) {
    return undefined;
  }
  if (
    value.category !== undefined &&
    (typeof value.category !== "string" || !CATEGORIES.has(value.category as GuideCategory))
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
  return {
    query: value.query,
    ...(value.category === undefined ? {} : { category: value.category as GuideCategory }),
    limit: value.limit === undefined ? 20 : value.limit,
  };
}

function projectSearch(record: GuideRecord): GuideSearchProjection {
  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    category: record.category,
    tags: [...record.tags],
    version: record.version,
  };
}

function projectDetail(
  record: GuideRecord,
  file: GuideFileReference | undefined,
): GuideDetailProjection {
  return {
    ...projectSearch(record),
    body: record.body,
    ...(file === undefined ? {} : { file }),
  };
}

export class GuideService {
  public readonly repository: GuideRepository;
  private readonly fileAccess: GuideFileAccessPort;
  private readonly now: () => Date;
  private readonly onReadAuditEvent: (event: GuideReadAuditEvent) => void;

  public constructor(
    repository: GuideRepository = new InMemoryGuideRepository(),
    fileAccess: GuideFileAccessPort = new InMemoryGuideFileAccessPort(),
    options: GuideServiceOptions = {},
  ) {
    this.repository = repository;
    this.fileAccess = fileAccess;
    this.now = options.now ?? (() => new Date());
    this.onReadAuditEvent = options.onReadAuditEvent ?? (() => undefined);
  }

  public search(
    context: GuideActorContext,
    input: GuideSearchInput,
  ): GuideResult<readonly GuideSearchProjection[]> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    const parsed = parseSearchInput(input);
    if (!parsed) return failure("VALIDATION_FAILED");

    const query = parsed.query.trim().toLocaleLowerCase();
    const data = this.repository
      .list(context.scope)
      .filter(
        (record) =>
          record.status === "PUBLISHED" &&
          record.version > 0 &&
          (parsed.category === undefined || record.category === parsed.category) &&
          [record.title, record.summary, ...record.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query),
      )
      .sort(
        (left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
      )
      .slice(0, parsed.limit)
      .map(projectSearch);

    this.onReadAuditEvent({
      eventType: "SEARCHED",
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      actorReference: context.actorId,
      eventTime: this.now().toISOString(),
    });
    return { ok: true, data };
  }

  public readDetail(
    context: GuideActorContext,
    guideId: string,
    expectedVersion: number,
  ): GuideResult<GuideDetailProjection> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    if (!validGuideId(guideId) || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return failure("VALIDATION_FAILED");
    }

    const record = this.repository.get(context.scope, guideId);
    if (
      record === undefined ||
      record.status !== "PUBLISHED" ||
      record.version !== expectedVersion ||
      (record.file_ref !== null && !isSafeFileReference(record.file_ref))
    ) {
      return failure("NOT_FOUND_SCOPED");
    }

    const file =
      record.file_ref === null
        ? undefined
        : this.fileAccess.resolve(context.scope, record.file_ref);
    if (record.file_ref !== null && file === undefined) return failure("NOT_FOUND_SCOPED");

    this.onReadAuditEvent({
      eventType: "READ",
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      guideId: record.id,
      actorReference: context.actorId,
      eventTime: this.now().toISOString(),
    });
    return { ok: true, data: projectDetail(record, file) };
  }
}
