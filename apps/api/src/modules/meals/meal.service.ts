export type MealStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
export type MealType = "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER";

export interface MealScope {
  readonly tenantId: string;
  readonly campusId: string;
}

export interface MealActorContext {
  readonly trusted: true;
  readonly actorId: string;
  readonly activeMembership: true;
  readonly scope: MealScope;
  readonly capabilities: readonly string[];
}

export interface MealDraftPayload {
  readonly meal_date: string;
  readonly meal_type: MealType;
  readonly items: readonly string[];
  readonly notes: string;
  readonly media_ref?: string | null;
  readonly private_notes?: string;
}

export interface MealRecord {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly status: MealStatus;
  readonly version: number;
  readonly meal_date: string;
  readonly meal_type: MealType;
  readonly items: readonly string[];
  readonly notes: string;
  readonly media_ref: string | null;
  readonly private_notes: string;
  readonly published_at: string | null;
  readonly synthetic_data: true;
  readonly updated_by: string;
  readonly updated_at: string;
}

export interface PublicMealProjection {
  readonly id: string;
  readonly meal_date: string;
  readonly meal_type: MealType;
  readonly items: readonly string[];
  readonly notes: string;
  readonly media_ref?: string;
  readonly published_at: string;
}

export interface MealPublicationAuditEvent {
  readonly eventType: "PUBLISHED" | "UNPUBLISHED";
  readonly tenantId: string;
  readonly campusId: string;
  readonly mealId: string;
  readonly resultingVersion: number;
  readonly actorReference: string;
  readonly eventTime: string;
}

export interface MealRepository {
  get(scope: MealScope, mealId: string): MealRecord | undefined;
  list(scope: MealScope): readonly MealRecord[];
  save(record: MealRecord): void;
  compareAndSave(
    scope: MealScope,
    mealId: string,
    expectedVersion: number,
    record: MealRecord,
  ): boolean;
}

export class InMemoryMealRepository implements MealRepository {
  private readonly records = new Map<string, MealRecord>();

  public constructor(initialRecords: readonly MealRecord[] = []) {
    for (const record of initialRecords) this.save(record);
  }

  public get(scope: MealScope, mealId: string): MealRecord | undefined {
    const record = this.records.get(storageKey(scope, mealId));
    return record === undefined ? undefined : cloneRecord(record);
  }

  public list(scope: MealScope): readonly MealRecord[] {
    const prefix = JSON.stringify([scope.tenantId, scope.campusId]);
    return [...this.records.entries()]
      .filter(([key]) => key.startsWith(`${prefix.slice(0, -1)},`))
      .map(([, record]) => cloneRecord(record));
  }

  public save(record: MealRecord): void {
    this.records.set(
      storageKey({ tenantId: record.tenant_id, campusId: record.campus_id }, record.id),
      cloneRecord(record),
    );
  }

  public compareAndSave(
    scope: MealScope,
    mealId: string,
    expectedVersion: number,
    record: MealRecord,
  ): boolean {
    const key = storageKey(scope, mealId);
    const current = this.records.get(key);
    if (current === undefined || current.version !== expectedVersion) return false;
    this.records.set(key, cloneRecord(record));
    return true;
  }
}

export type MealErrorCode =
  | "FORBIDDEN_SCOPE"
  | "NOT_FOUND_SCOPED"
  | "VALIDATION_FAILED"
  | "VERSION_MISMATCH"
  | "CONFLICT_STATE";

export interface MealError {
  readonly ok: false;
  readonly error: {
    readonly code: MealErrorCode;
    readonly message: string;
  };
}

export interface MealSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export type MealResult<T> = MealSuccess<T> | MealError;

export interface MealServiceOptions {
  readonly now?: () => Date;
  readonly onPublicationAuditEvent?: (event: MealPublicationAuditEvent) => void;
}

const ERROR_MESSAGES: Record<MealErrorCode, string> = {
  FORBIDDEN_SCOPE: "Meal scope access is not permitted.",
  NOT_FOUND_SCOPED: "Published meal was not found.",
  VALIDATION_FAILED: "Meal input is invalid.",
  VERSION_MISMATCH: "Meal version is stale.",
  CONFLICT_STATE: "Meal state transition is not permitted.",
};

const MEAL_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_MEDIA_PATTERN = /^file-ref:\/[A-Za-z0-9._/-]{1,200}$/;
const MEAL_TYPES = new Set<MealType>(["BREAKFAST", "LUNCH", "SNACK", "DINNER"]);
const PAYLOAD_KEYS = new Set([
  "meal_date",
  "meal_type",
  "items",
  "notes",
  "media_ref",
  "private_notes",
]);

function storageKey(scope: MealScope, mealId: string): string {
  return JSON.stringify([scope.tenantId, scope.campusId, mealId]);
}

function cloneRecord(record: MealRecord): MealRecord {
  return { ...record, items: [...record.items] };
}

function failure(code: MealErrorCode): MealError {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidScope(value: unknown): value is MealScope {
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
): value is MealActorContext {
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

function isValidPayload(value: unknown): value is MealDraftPayload {
  if (!isRecord(value) || Object.keys(value).some((key) => !PAYLOAD_KEYS.has(key))) return false;
  return (
    isValidDate(value.meal_date) &&
    typeof value.meal_type === "string" &&
    MEAL_TYPES.has(value.meal_type as MealType) &&
    Array.isArray(value.items) &&
    value.items.length >= 1 &&
    value.items.length <= 12 &&
    value.items.every(
      (item) => typeof item === "string" && item.length >= 1 && item.length <= 120,
    ) &&
    typeof value.notes === "string" &&
    value.notes.length <= 500 &&
    isSafeMedia(value.media_ref) &&
    (value.private_notes === undefined || typeof value.private_notes === "string")
  );
}

function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function projectPublic(record: MealRecord): PublicMealProjection {
  return {
    id: record.id,
    meal_date: record.meal_date,
    meal_type: record.meal_type,
    items: [...record.items],
    notes: record.notes,
    ...(record.media_ref === null ? {} : { media_ref: record.media_ref }),
    published_at: record.published_at!,
  };
}

export class MealService {
  public readonly repository: MealRepository;
  private readonly now: () => Date;
  private readonly onPublicationAuditEvent: (event: MealPublicationAuditEvent) => void;

  public constructor(
    repository: MealRepository = new InMemoryMealRepository(),
    options: MealServiceOptions = {},
  ) {
    this.repository = repository;
    this.now = options.now ?? (() => new Date());
    this.onPublicationAuditEvent = options.onPublicationAuditEvent ?? (() => undefined);
  }

  public createDraft(
    context: MealActorContext,
    mealId: string,
    payload: MealDraftPayload,
    expectedVersion: number | null = null,
  ): MealResult<MealRecord> {
    if (!isAuthorized(context, "content:write")) return failure("FORBIDDEN_SCOPE");
    if (!MEAL_ID_PATTERN.test(mealId) || !isValidPayload(payload))
      return failure("VALIDATION_FAILED");
    const existing = this.repository.get(context.scope, mealId);
    if (existing !== undefined) {
      if (!isVersion(expectedVersion) || existing.version !== expectedVersion)
        return failure("VERSION_MISMATCH");
      return failure("CONFLICT_STATE");
    }
    if (expectedVersion !== null) return failure("VERSION_MISMATCH");
    const now = this.now().toISOString();
    const record: MealRecord = {
      id: mealId,
      tenant_id: context.scope.tenantId,
      campus_id: context.scope.campusId,
      status: "DRAFT",
      version: 1,
      meal_date: payload.meal_date,
      meal_type: payload.meal_type,
      items: [...payload.items],
      notes: payload.notes,
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
    context: MealActorContext,
    mealId: string,
    payload: MealDraftPayload,
    expectedCurrentVersion: number,
  ): MealResult<MealRecord> {
    if (!isAuthorized(context, "content:write")) return failure("FORBIDDEN_SCOPE");
    if (!MEAL_ID_PATTERN.test(mealId) || !isValidPayload(payload))
      return failure("VALIDATION_FAILED");
    const existing = this.repository.get(context.scope, mealId);
    if (existing === undefined) return failure("NOT_FOUND_SCOPED");
    if (!isVersion(expectedCurrentVersion) || existing.version !== expectedCurrentVersion)
      return failure("VERSION_MISMATCH");
    const record: MealRecord = {
      ...existing,
      status: "DRAFT",
      version: existing.version + 1,
      meal_date: payload.meal_date,
      meal_type: payload.meal_type,
      items: [...payload.items],
      notes: payload.notes,
      media_ref: payload.media_ref ?? null,
      private_notes: payload.private_notes ?? "",
      published_at: null,
      updated_by: context.actorId,
      updated_at: this.now().toISOString(),
    };
    if (!this.repository.compareAndSave(context.scope, mealId, expectedCurrentVersion, record))
      return failure("VERSION_MISMATCH");
    return { ok: true, data: record };
  }

  public publish(
    context: MealActorContext,
    mealId: string,
    expectedCurrentVersion: number,
  ): MealResult<MealRecord> {
    return this.transitionPublication(context, mealId, expectedCurrentVersion, "PUBLISHED");
  }

  public unpublish(
    context: MealActorContext,
    mealId: string,
    expectedCurrentVersion: number,
  ): MealResult<MealRecord> {
    return this.transitionPublication(context, mealId, expectedCurrentVersion, "UNPUBLISHED");
  }

  public listPublic(scope: MealScope, onDate: string): MealResult<readonly PublicMealProjection[]> {
    if (!isValidScope(scope) || !isValidDate(onDate)) return failure("VALIDATION_FAILED");
    const data = this.repository
      .list(scope)
      .filter(
        (record) =>
          record.status === "PUBLISHED" &&
          record.published_at !== null &&
          record.meal_date === onDate,
      )
      .sort(
        (left, right) =>
          left.meal_type.localeCompare(right.meal_type) || left.id.localeCompare(right.id),
      )
      .map(projectPublic);
    return { ok: true, data };
  }

  private transitionPublication(
    context: MealActorContext,
    mealId: string,
    expectedCurrentVersion: number,
    targetStatus: Extract<MealStatus, "PUBLISHED" | "UNPUBLISHED">,
  ): MealResult<MealRecord> {
    if (!isAuthorized(context, "content:publish")) return failure("FORBIDDEN_SCOPE");
    if (!MEAL_ID_PATTERN.test(mealId) || !isVersion(expectedCurrentVersion))
      return failure("VALIDATION_FAILED");
    const existing = this.repository.get(context.scope, mealId);
    if (existing === undefined) return failure("NOT_FOUND_SCOPED");
    if (existing.version !== expectedCurrentVersion) return failure("VERSION_MISMATCH");
    if (
      (targetStatus === "PUBLISHED" && existing.status === "PUBLISHED") ||
      (targetStatus === "UNPUBLISHED" && existing.status !== "PUBLISHED")
    )
      return failure("CONFLICT_STATE");
    const now = this.now().toISOString();
    const record: MealRecord = {
      ...existing,
      status: targetStatus,
      version: existing.version + 1,
      published_at: targetStatus === "PUBLISHED" ? now : null,
      updated_by: context.actorId,
      updated_at: now,
    };
    if (!this.repository.compareAndSave(context.scope, mealId, expectedCurrentVersion, record))
      return failure("VERSION_MISMATCH");
    this.onPublicationAuditEvent({
      eventType: targetStatus,
      tenantId: record.tenant_id,
      campusId: record.campus_id,
      mealId: record.id,
      resultingVersion: record.version,
      actorReference: context.actorId,
      eventTime: now,
    });
    return { ok: true, data: record };
  }
}
