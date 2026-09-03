export type ActivityStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

export interface ActivityScope {
  readonly tenantId: string;
  readonly campusId: string;
}

export interface ActivityActorContext {
  readonly trusted: true;
  readonly actorId: string;
  readonly activeMembership: true;
  readonly scope: ActivityScope;
  readonly capabilities: readonly string[];
}

export interface ActivityDraftPayload {
  readonly title: string;
  readonly summary: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly location: string;
  readonly media_ref?: string | null;
  readonly private_notes?: string;
}

export interface ActivityProfileRecord {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly status: ActivityStatus;
  readonly version: number;
  readonly title: string;
  readonly summary: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly location: string;
  readonly media_ref: string | null;
  readonly private_notes: string;
  readonly published_at: string | null;
  readonly synthetic_data: true;
  readonly updated_by: string;
  readonly updated_at: string;
}

export type ActivityRecord = ActivityProfileRecord;

export interface PublicActivityProjection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly location: string;
  readonly media_ref?: string;
  readonly published_at: string;
}

export interface ActivityPublicationAuditEvent {
  readonly eventType: "PUBLISHED" | "UNPUBLISHED";
  readonly tenantId: string;
  readonly campusId: string;
  readonly activityId: string;
  readonly resultingVersion: number;
  readonly actorReference: string;
  readonly eventTime: string;
}

export interface ActivityProfileRepository {
  get(scope: ActivityScope, activityId: string): ActivityProfileRecord | undefined;
  list(scope: ActivityScope): readonly ActivityProfileRecord[];
  save(record: ActivityProfileRecord): void;
  compareAndSave(
    scope: ActivityScope,
    activityId: string,
    expectedVersion: number,
    record: ActivityProfileRecord,
  ): boolean;
}

export type ActivityRepository = ActivityProfileRepository;

export class InMemoryActivityRepository implements ActivityProfileRepository {
  private readonly records = new Map<string, ActivityProfileRecord>();

  public constructor(initialRecords: readonly ActivityProfileRecord[] = []) {
    for (const record of initialRecords) this.save(record);
  }

  public get(scope: ActivityScope, activityId: string): ActivityProfileRecord | undefined {
    const record = this.records.get(storageKey(scope, activityId));
    return record === undefined ? undefined : cloneRecord(record);
  }

  public list(scope: ActivityScope): readonly ActivityProfileRecord[] {
    const prefix = JSON.stringify([scope.tenantId, scope.campusId]);
    return [...this.records.entries()]
      .filter(([key]) => key.startsWith(`${prefix.slice(0, -1)},`))
      .map(([, record]) => cloneRecord(record));
  }

  public save(record: ActivityProfileRecord): void {
    this.records.set(
      storageKey({ tenantId: record.tenant_id, campusId: record.campus_id }, record.id),
      cloneRecord(record),
    );
  }

  public compareAndSave(
    scope: ActivityScope,
    activityId: string,
    expectedVersion: number,
    record: ActivityProfileRecord,
  ): boolean {
    const key = storageKey(scope, activityId);
    const current = this.records.get(key);
    if (current === undefined || current.version !== expectedVersion) return false;
    this.records.set(key, cloneRecord(record));
    return true;
  }
}

export type ActivityErrorCode =
  | "FORBIDDEN_SCOPE"
  | "NOT_FOUND_SCOPED"
  | "VALIDATION_FAILED"
  | "VERSION_MISMATCH"
  | "CONFLICT_STATE";

export interface ActivityError {
  readonly ok: false;
  readonly error: {
    readonly code: ActivityErrorCode;
    readonly message: string;
  };
}

export interface ActivitySuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export type ActivityResult<T> = ActivitySuccess<T> | ActivityError;

export interface ActivityServiceOptions {
  readonly now?: () => Date;
  readonly onPublicationAuditEvent?: (event: ActivityPublicationAuditEvent) => void;
}

const ERROR_MESSAGES: Record<ActivityErrorCode, string> = {
  FORBIDDEN_SCOPE: "Activity scope access is not permitted.",
  NOT_FOUND_SCOPED: "Published activity was not found.",
  VALIDATION_FAILED: "Activity input is invalid.",
  VERSION_MISMATCH: "Activity version is stale.",
  CONFLICT_STATE: "Activity state transition is not permitted.",
};

const ACTIVITY_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_MEDIA_PATTERN = /^file-ref:\/[A-Za-z0-9._/-]{1,200}$/;
const PAYLOAD_KEYS = new Set([
  "title",
  "summary",
  "start_date",
  "end_date",
  "location",
  "media_ref",
  "private_notes",
]);

function storageKey(scope: ActivityScope, activityId: string): string {
  return JSON.stringify([scope.tenantId, scope.campusId, activityId]);
}

function cloneRecord(record: ActivityProfileRecord): ActivityProfileRecord {
  return { ...record };
}

function failure(code: ActivityErrorCode): ActivityError {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidScope(value: unknown): value is ActivityScope {
  return (
    isRecord(value) &&
    typeof value.tenantId === "string" &&
    value.tenantId.length > 0 &&
    typeof value.campusId === "string" &&
    value.campusId.length > 0
  );
}

function isAuthorized(
  value: unknown,
  capability?: "content:write" | "content:publish",
): value is ActivityActorContext {
  if (!isRecord(value)) return false;
  if (
    value.trusted !== true ||
    value.activeMembership !== true ||
    typeof value.actorId !== "string" ||
    !isValidScope(value.scope) ||
    !Array.isArray(value.capabilities) ||
    !value.capabilities.every((item) => typeof item === "string")
  ) {
    return false;
  }
  return capability === undefined || value.capabilities.includes(capability);
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}

function isSafeMedia(value: unknown): value is string | null | undefined {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" &&
      SAFE_MEDIA_PATTERN.test(value) &&
      !value.split("/").includes(".."))
  );
}

function isValidPayload(value: unknown): value is ActivityDraftPayload {
  if (!isRecord(value) || Object.keys(value).some((key) => !PAYLOAD_KEYS.has(key))) return false;
  if (
    typeof value.title !== "string" ||
    value.title.length < 1 ||
    value.title.length > 160 ||
    typeof value.summary !== "string" ||
    value.summary.length < 1 ||
    value.summary.length > 500 ||
    !isValidDate(value.start_date) ||
    !isValidDate(value.end_date) ||
    value.start_date > value.end_date ||
    typeof value.location !== "string" ||
    value.location.length < 1 ||
    value.location.length > 120 ||
    !isSafeMedia(value.media_ref) ||
    (value.private_notes !== undefined && typeof value.private_notes !== "string")
  ) {
    return false;
  }
  return true;
}

function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function projectPublic(record: ActivityProfileRecord): PublicActivityProjection {
  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    start_date: record.start_date,
    end_date: record.end_date,
    location: record.location,
    ...(record.media_ref === null ? {} : { media_ref: record.media_ref }),
    published_at: record.published_at!,
  };
}

export class ActivityService {
  public readonly repository: ActivityProfileRepository;
  private readonly now: () => Date;
  private readonly onPublicationAuditEvent: (event: ActivityPublicationAuditEvent) => void;

  public constructor(
    repository: ActivityProfileRepository = new InMemoryActivityRepository(),
    options: ActivityServiceOptions = {},
  ) {
    this.repository = repository;
    this.now = options.now ?? (() => new Date());
    this.onPublicationAuditEvent = options.onPublicationAuditEvent ?? (() => undefined);
  }

  public createDraft(
    context: ActivityActorContext,
    activityId: string,
    payload: ActivityDraftPayload,
    expectedVersion: number | null = null,
  ): ActivityResult<ActivityProfileRecord> {
    if (!isAuthorized(context, "content:write")) return failure("FORBIDDEN_SCOPE");
    if (!ACTIVITY_ID_PATTERN.test(activityId) || !isValidPayload(payload)) {
      return failure("VALIDATION_FAILED");
    }
    const existing = this.repository.get(context.scope, activityId);
    if (existing !== undefined) {
      if (!isVersion(expectedVersion) || existing.version !== expectedVersion) {
        return failure("VERSION_MISMATCH");
      }
      return failure("CONFLICT_STATE");
    }
    if (expectedVersion !== null) return failure("VERSION_MISMATCH");
    const now = this.now().toISOString();
    const record: ActivityProfileRecord = {
      id: activityId,
      tenant_id: context.scope.tenantId,
      campus_id: context.scope.campusId,
      status: "DRAFT",
      version: 1,
      title: payload.title,
      summary: payload.summary,
      start_date: payload.start_date,
      end_date: payload.end_date,
      location: payload.location,
      media_ref: payload.media_ref ?? null,
      private_notes: payload.private_notes ?? "",
      published_at: null,
      synthetic_data: true,
      updated_by: context.actorId,
      updated_at: now,
    };
    this.repository.save(record);
    return { ok: true, data: record };
  }

  public updateDraft(
    context: ActivityActorContext,
    activityId: string,
    payload: ActivityDraftPayload,
    expectedCurrentVersion: number,
  ): ActivityResult<ActivityProfileRecord> {
    if (!isAuthorized(context, "content:write")) return failure("FORBIDDEN_SCOPE");
    if (!ACTIVITY_ID_PATTERN.test(activityId) || !isValidPayload(payload)) {
      return failure("VALIDATION_FAILED");
    }
    const existing = this.repository.get(context.scope, activityId);
    if (existing === undefined) return failure("NOT_FOUND_SCOPED");
    if (!isVersion(expectedCurrentVersion) || existing.version !== expectedCurrentVersion) {
      return failure("VERSION_MISMATCH");
    }
    const record: ActivityProfileRecord = {
      ...existing,
      status: "DRAFT",
      version: existing.version + 1,
      title: payload.title,
      summary: payload.summary,
      start_date: payload.start_date,
      end_date: payload.end_date,
      location: payload.location,
      media_ref: payload.media_ref ?? null,
      private_notes: payload.private_notes ?? "",
      published_at: null,
      updated_by: context.actorId,
      updated_at: this.now().toISOString(),
    };
    if (
      !this.repository.compareAndSave(context.scope, activityId, expectedCurrentVersion, record)
    ) {
      return failure("VERSION_MISMATCH");
    }
    return { ok: true, data: record };
  }

  public publish(
    context: ActivityActorContext,
    activityId: string,
    expectedCurrentVersion: number,
  ): ActivityResult<ActivityProfileRecord> {
    return this.transitionPublication(context, activityId, expectedCurrentVersion, "PUBLISHED");
  }

  public unpublish(
    context: ActivityActorContext,
    activityId: string,
    expectedCurrentVersion: number,
  ): ActivityResult<ActivityProfileRecord> {
    return this.transitionPublication(context, activityId, expectedCurrentVersion, "UNPUBLISHED");
  }

  public readPublic(
    scope: ActivityScope,
    activityId: string,
    onDate: string,
  ): ActivityResult<PublicActivityProjection> {
    const result = this.listPublic(scope, onDate);
    if (!result.ok) return result;
    const match = result.data.find((activity) => activity.id === activityId);
    return match === undefined ? failure("NOT_FOUND_SCOPED") : { ok: true, data: match };
  }

  public listPublic(
    scope: ActivityScope,
    onDate: string,
  ): ActivityResult<readonly PublicActivityProjection[]> {
    if (!isValidScope(scope) || !isValidDate(onDate)) return failure("VALIDATION_FAILED");
    const data = this.repository
      .list(scope)
      .filter(
        (record) =>
          record.status === "PUBLISHED" &&
          record.published_at !== null &&
          record.start_date <= onDate &&
          record.end_date >= onDate,
      )
      .sort(
        (left, right) =>
          left.start_date.localeCompare(right.start_date) || left.id.localeCompare(right.id),
      )
      .map(projectPublic);
    return { ok: true, data };
  }

  private transitionPublication(
    context: ActivityActorContext,
    activityId: string,
    expectedCurrentVersion: number,
    targetStatus: Extract<ActivityStatus, "PUBLISHED" | "UNPUBLISHED">,
  ): ActivityResult<ActivityProfileRecord> {
    if (!isAuthorized(context, "content:publish")) return failure("FORBIDDEN_SCOPE");
    if (!ACTIVITY_ID_PATTERN.test(activityId) || !isVersion(expectedCurrentVersion)) {
      return failure("VALIDATION_FAILED");
    }
    const existing = this.repository.get(context.scope, activityId);
    if (existing === undefined) return failure("NOT_FOUND_SCOPED");
    if (existing.version !== expectedCurrentVersion) return failure("VERSION_MISMATCH");
    if (
      (targetStatus === "PUBLISHED" && existing.status === "PUBLISHED") ||
      (targetStatus === "UNPUBLISHED" && existing.status !== "PUBLISHED")
    ) {
      return failure("CONFLICT_STATE");
    }
    const now = this.now().toISOString();
    const record: ActivityProfileRecord = {
      ...existing,
      status: targetStatus,
      version: existing.version + 1,
      published_at: targetStatus === "PUBLISHED" ? now : null,
      updated_by: context.actorId,
      updated_at: now,
    };
    if (
      !this.repository.compareAndSave(context.scope, activityId, expectedCurrentVersion, record)
    ) {
      return failure("VERSION_MISMATCH");
    }
    this.onPublicationAuditEvent({
      eventType: targetStatus,
      tenantId: record.tenant_id,
      campusId: record.campus_id,
      activityId: record.id,
      resultingVersion: record.version,
      actorReference: context.actorId,
      eventTime: now,
    });
    return { ok: true, data: record };
  }
}
