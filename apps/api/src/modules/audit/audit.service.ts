export const AUDIT_ACTIONS = Object.freeze([
  "CONTENT_DRAFT_CREATED",
  "CONTENT_DRAFT_UPDATED",
  "CONTENT_PUBLISHED",
  "CONTENT_UNPUBLISHED",
  "FILE_INTENT_CREATED",
  "PARTNER_LINK_HANDOFF_CREATED",
] as const);

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ADMIN_PERMISSION_MATRIX = Object.freeze({
  read: "memberships:read",
  append: "SERVICE_ONLY",
  update: "DENIED",
  delete: "DENIED",
} as const);

export interface AuditScope {
  readonly tenantId: string;
  readonly campusId: string;
}

export interface AuditActorContext {
  readonly trusted: true;
  readonly actorId: string;
  readonly activeMembership: true;
  readonly scope: AuditScope;
  readonly capabilities: readonly string[];
}

export type AuditReadContext = AuditActorContext;

export type AuditMetadataValue = string | number | boolean;
export type AuditMetadata = Readonly<Record<string, AuditMetadataValue>>;

export interface AuditTarget {
  readonly type: string;
  readonly id: string;
}

export interface AuditEventInput {
  readonly action: AuditAction;
  readonly target: AuditTarget;
  readonly correlationId: string;
  readonly traceId: string;
  readonly metadata: AuditMetadata;
}

export interface AuditEvent {
  readonly event_id: string;
  readonly actor_id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly action: AuditAction;
  readonly target_type: string;
  readonly target_id: string;
  readonly occurred_at: string;
  readonly correlation_id: string;
  readonly trace_id: string;
  readonly metadata: AuditMetadata;
  readonly synthetic_data: true;
}

export interface AuditQuery {
  readonly action?: AuditAction;
  readonly actorReference?: string;
  readonly targetType?: string;
  readonly targetReference?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly occurredFrom?: string;
  readonly occurredTo?: string;
  readonly limit?: number;
}

export interface AuditTransaction {
  getState(key: string): unknown;
  setState(key: string, value: unknown): void;
  deleteState(key: string): void;
}

export interface ProtectedCommandSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export interface ProtectedCommandFailure {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export type ProtectedCommandResult<T> = ProtectedCommandSuccess<T> | ProtectedCommandFailure;
export type ProtectedCommand<T> = (transaction: AuditTransaction) => ProtectedCommandResult<T>;

export type AuditErrorCode = "FORBIDDEN_SCOPE" | "VALIDATION_FAILED" | "COMMAND_FAILED";

export interface AuditFailure {
  readonly ok: false;
  readonly error: {
    readonly code: AuditErrorCode;
    readonly message: string;
  };
}

export interface AuditSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export type AuditResult<T> = AuditSuccess<T> | AuditFailure;

export interface AuditServiceOptions {
  readonly now?: () => Date;
  readonly createEventId?: () => string;
}

const ERROR_MESSAGES: Record<AuditErrorCode, string> = {
  FORBIDDEN_SCOPE: "Audit scope access is not permitted.",
  VALIDATION_FAILED: "Audit event input is invalid.",
  COMMAND_FAILED: "Protected command did not complete.",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const TARGET_TYPE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const SYNTHETIC_REFERENCE_PATTERN = /^synthetic-[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const AUDIT_METADATA_STATUSES = new Set([
  "CREATED",
  "UPDATED",
  "PUBLISHED",
  "UNPUBLISHED",
  "COMPLETED",
]);
const AUDIT_METADATA_CHANNELS = new Set(["ADMIN_WEB", "USER_WEB", "MINI_PROGRAM", "API"]);
const AUDIT_METADATA_OPERATIONS = new Set([
  "CREATE",
  "UPDATE",
  "PUBLISH",
  "UNPUBLISH",
  "CREATE_FILE_INTENT",
  "CREATE_PARTNER_HANDOFF",
]);
const METADATA_KEYS = new Set([
  "result",
  "version",
  "status",
  "channel",
  "operation",
  "synthetic_reference",
]);
const EVENT_INPUT_KEYS = new Set(["action", "target", "correlationId", "traceId", "metadata"]);
const TARGET_KEYS = new Set(["type", "id"]);
const QUERY_KEYS = new Set([
  "action",
  "actorReference",
  "targetType",
  "targetReference",
  "correlationId",
  "traceId",
  "occurredFrom",
  "occurredTo",
  "limit",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(code: AuditErrorCode, message = ERROR_MESSAGES[code]): AuditFailure {
  return { ok: false, error: { code, message } };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isReference(value: unknown): value is string {
  return typeof value === "string" && REFERENCE_PATTERN.test(value);
}

function isTrustedContext(value: unknown): value is AuditActorContext {
  if (!isRecord(value) || !isRecord(value.scope)) return false;
  return (
    value.trusted === true &&
    value.activeMembership === true &&
    isUuid(value.actorId) &&
    isUuid(value.scope.tenantId) &&
    isUuid(value.scope.campusId) &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every((capability) => typeof capability === "string")
  );
}

function isAuditReader(value: unknown): value is AuditReadContext {
  return isTrustedContext(value) && value.capabilities.includes(AUDIT_ADMIN_PERMISSION_MATRIX.read);
}

function isValidMetadataValue(key: string, value: unknown): value is AuditMetadataValue {
  switch (key) {
    case "result":
      return value === "SUCCESS";
    case "version":
      return (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= 1_000_000_000
      );
    case "status":
      return typeof value === "string" && AUDIT_METADATA_STATUSES.has(value);
    case "channel":
      return typeof value === "string" && AUDIT_METADATA_CHANNELS.has(value);
    case "operation":
      return typeof value === "string" && AUDIT_METADATA_OPERATIONS.has(value);
    case "synthetic_reference":
      return typeof value === "string" && SYNTHETIC_REFERENCE_PATTERN.test(value);
    default:
      return false;
  }
}

function isValidMetadata(value: unknown): value is AuditMetadata {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= METADATA_KEYS.size &&
    entries.every(
      ([key, metadataValue]) => METADATA_KEYS.has(key) && isValidMetadataValue(key, metadataValue),
    )
  );
}

function isValidTarget(value: unknown): value is AuditTarget {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => TARGET_KEYS.has(key)) &&
    Object.keys(value).length === TARGET_KEYS.size &&
    typeof value.type === "string" &&
    TARGET_TYPE_PATTERN.test(value.type) &&
    isReference(value.id)
  );
}

function isValidEventInput(value: unknown): value is AuditEventInput {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => EVENT_INPUT_KEYS.has(key)) &&
    Object.keys(value).length === EVENT_INPUT_KEYS.size &&
    typeof value.action === "string" &&
    AUDIT_ACTIONS.includes(value.action as AuditAction) &&
    isValidTarget(value.target) &&
    isReference(value.correlationId) &&
    isReference(value.traceId) &&
    isValidMetadata(value.metadata)
  );
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = new Date(value);
  return !Number.isNaN(timestamp.valueOf()) && timestamp.toISOString() === value;
}

function isValidQuery(value: unknown): value is AuditQuery {
  if (!isRecord(value) || Object.keys(value).some((key) => !QUERY_KEYS.has(key))) return false;
  if (
    (value.action !== undefined &&
      (typeof value.action !== "string" || !AUDIT_ACTIONS.includes(value.action as AuditAction))) ||
    (value.actorReference !== undefined && !isUuid(value.actorReference)) ||
    (value.targetType !== undefined &&
      (typeof value.targetType !== "string" || !TARGET_TYPE_PATTERN.test(value.targetType))) ||
    (value.targetReference !== undefined && !isReference(value.targetReference)) ||
    (value.correlationId !== undefined && !isReference(value.correlationId)) ||
    (value.traceId !== undefined && !isReference(value.traceId)) ||
    (value.occurredFrom !== undefined && !isIsoTimestamp(value.occurredFrom)) ||
    (value.occurredTo !== undefined && !isIsoTimestamp(value.occurredTo)) ||
    (value.limit !== undefined &&
      (typeof value.limit !== "number" ||
        !Number.isInteger(value.limit) ||
        value.limit < 1 ||
        value.limit > 100))
  ) {
    return false;
  }
  return !(
    typeof value.occurredFrom === "string" &&
    typeof value.occurredTo === "string" &&
    value.occurredFrom > value.occurredTo
  );
}

function freezeEvent(event: AuditEvent): AuditEvent {
  const metadata = Object.freeze({ ...event.metadata });
  return Object.freeze({ ...event, metadata });
}

export class InMemoryAuditStore {
  private readonly events: AuditEvent[] = [];
  private protectedState = new Map<string, unknown>();

  public execute<T>(event: AuditEvent, command: ProtectedCommand<T>): AuditResult<T> {
    const stagedState = new Map(this.protectedState);
    const transaction: AuditTransaction = {
      getState: (key) => stagedState.get(key),
      setState: (key, value) => {
        stagedState.set(key, value);
      },
      deleteState: (key) => {
        stagedState.delete(key);
      },
    };

    try {
      const result = command(transaction);
      if (!result.ok) return failure("COMMAND_FAILED");
      this.protectedState = stagedState;
      this.events.push(freezeEvent(event));
      return { ok: true, data: result.data };
    } catch {
      return failure("COMMAND_FAILED");
    }
  }

  public listEvents(): readonly AuditEvent[] {
    return this.events.map((event) => freezeEvent(event));
  }

  public getProtectedState(key: string): unknown {
    return this.protectedState.get(key);
  }
}

export class AuditService {
  public readonly store: InMemoryAuditStore;
  private readonly now: () => Date;
  private readonly createEventId: () => string;

  public constructor(
    store: InMemoryAuditStore = new InMemoryAuditStore(),
    options: AuditServiceOptions = {},
  ) {
    this.store = store;
    this.now = options.now ?? (() => new Date());
    this.createEventId =
      options.createEventId ??
      (() => `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`);
  }

  public executeProtectedCommand<T>(
    context: AuditActorContext,
    input: AuditEventInput,
    command: ProtectedCommand<T>,
  ): AuditResult<T> {
    if (!isTrustedContext(context)) return failure("FORBIDDEN_SCOPE");
    if (!isValidEventInput(input) || typeof command !== "function") {
      return failure("VALIDATION_FAILED");
    }

    const eventId = this.createEventId();
    const occurredAt = this.now().toISOString();
    if (!isReference(eventId) || !isIsoTimestamp(occurredAt)) {
      return failure("VALIDATION_FAILED");
    }

    return this.store.execute(
      freezeEvent({
        event_id: eventId,
        actor_id: context.actorId,
        tenant_id: context.scope.tenantId,
        campus_id: context.scope.campusId,
        action: input.action,
        target_type: input.target.type,
        target_id: input.target.id,
        occurred_at: occurredAt,
        correlation_id: input.correlationId,
        trace_id: input.traceId,
        metadata: input.metadata,
        synthetic_data: true,
      }),
      command,
    );
  }

  public listEvents(
    context: AuditReadContext,
    query: AuditQuery,
  ): AuditResult<readonly AuditEvent[]> {
    if (!isAuditReader(context)) return failure("FORBIDDEN_SCOPE");
    if (!isValidQuery(query)) {
      return failure("VALIDATION_FAILED", "Audit query is invalid.");
    }

    const limit = query.limit ?? 50;
    const events = this.store
      .listEvents()
      .filter(
        (event) =>
          event.tenant_id === context.scope.tenantId && event.campus_id === context.scope.campusId,
      )
      .filter((event) => query.action === undefined || event.action === query.action)
      .filter(
        (event) => query.actorReference === undefined || event.actor_id === query.actorReference,
      )
      .filter((event) => query.targetType === undefined || event.target_type === query.targetType)
      .filter(
        (event) => query.targetReference === undefined || event.target_id === query.targetReference,
      )
      .filter(
        (event) =>
          query.correlationId === undefined || event.correlation_id === query.correlationId,
      )
      .filter((event) => query.traceId === undefined || event.trace_id === query.traceId)
      .filter(
        (event) => query.occurredFrom === undefined || event.occurred_at >= query.occurredFrom,
      )
      .filter((event) => query.occurredTo === undefined || event.occurred_at <= query.occurredTo)
      .sort(
        (left, right) =>
          right.occurred_at.localeCompare(left.occurred_at) ||
          right.event_id.localeCompare(left.event_id),
      )
      .slice(0, limit);

    return { ok: true, data: events };
  }
}
