export type PartnerLinkPublicationStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
export type PartnerLinkEnabledStatus = "ENABLED" | "DISABLED";

export interface PartnerLinkScope {
  readonly tenantId: string;
  readonly campusId: string;
}

export interface PartnerLinkActorContext {
  readonly trusted: true;
  readonly actorId: string;
  readonly activeMembership: true;
  readonly scope: PartnerLinkScope;
  readonly allowedScopes: readonly PartnerLinkScope[];
  readonly capabilities: readonly string[];
  readonly roles?: readonly string[];
}

export interface PartnerLinkRecord {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly symbolic_destination: string;
  readonly normalized_host: string;
  readonly normalized_path: string;
  readonly allowed_roles: readonly string[];
  readonly required_capability: string;
  readonly publication_status: PartnerLinkPublicationStatus;
  readonly enabled_status: PartnerLinkEnabledStatus;
  readonly allowlist_policy_version: string;
  readonly title: string;
  readonly description: string;
  readonly version: number;
  readonly synthetic_data: true;
}

export interface PartnerLinkSearchInput {
  readonly query?: unknown;
  readonly limit?: unknown;
}

export interface PartnerLinkProjection {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly symbolicDestination: string;
  readonly normalizedHost: string;
  readonly normalizedPath: string;
  readonly publicationStatus: PartnerLinkPublicationStatus;
  readonly enabledStatus: PartnerLinkEnabledStatus;
  readonly policyVersion: string;
  readonly version: number;
}

export interface PartnerLinkEntryProjection extends PartnerLinkProjection {
  readonly handoffToken: string;
  readonly expiresAt: string;
}

export interface PartnerLinkAuditEvent {
  readonly eventType: "SEARCHED" | "ENTRY_ISSUED" | "ENTRY_CONSUMED";
  readonly tenantId: string;
  readonly campusId: string;
  readonly actorReference: string;
  readonly linkId?: string;
  readonly eventTime: string;
}

export interface PartnerLinkRepository {
  get(scope: PartnerLinkScope, linkId: string): PartnerLinkRecord | undefined;
  list(scope: PartnerLinkScope): readonly PartnerLinkRecord[];
}

export class InMemoryPartnerLinkRepository implements PartnerLinkRepository {
  private readonly records = new Map<string, PartnerLinkRecord>();

  public constructor(initialRecords: readonly PartnerLinkRecord[] = []) {
    for (const record of initialRecords) {
      this.records.set(storageKey(record.tenant_id, record.campus_id, record.id), {
        ...record,
        allowed_roles: [...record.allowed_roles],
      });
    }
  }

  public get(scope: PartnerLinkScope, linkId: string): PartnerLinkRecord | undefined {
    const record = this.records.get(storageKey(scope.tenantId, scope.campusId, linkId));
    return record === undefined ? undefined : cloneRecord(record);
  }

  public list(scope: PartnerLinkScope): readonly PartnerLinkRecord[] {
    return [...this.records.values()]
      .filter(
        (record) => record.tenant_id === scope.tenantId && record.campus_id === scope.campusId,
      )
      .map(cloneRecord);
  }
}

export type PartnerLinkErrorCode =
  | "FORBIDDEN_SCOPE"
  | "NOT_FOUND_SCOPED"
  | "VALIDATION_FAILED"
  | "HANDOFF_EXPIRED"
  | "HANDOFF_REUSED";

export interface PartnerLinkError {
  readonly ok: false;
  readonly error: {
    readonly code: PartnerLinkErrorCode;
    readonly message: string;
  };
}

export interface PartnerLinkSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export type PartnerLinkResult<T> = PartnerLinkSuccess<T> | PartnerLinkError;

export interface PartnerLinkServiceOptions {
  readonly now?: () => Date;
  readonly onAuditEvent?: (event: PartnerLinkAuditEvent) => void;
}

interface HandoffRecord {
  readonly token: string;
  readonly linkId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly actorId: string;
  readonly role: string;
  readonly capability: string;
  readonly policyVersion: string;
  readonly expiresAt: number;
  consumed: boolean;
}

const ERROR_MESSAGES: Record<PartnerLinkErrorCode, string> = {
  FORBIDDEN_SCOPE: "Partner link scope access is not permitted.",
  NOT_FOUND_SCOPED: "Partner link was not found in the allowed scope.",
  VALIDATION_FAILED: "Partner link input is invalid.",
  HANDOFF_EXPIRED: "Partner link handoff has expired.",
  HANDOFF_REUSED: "Partner link handoff has already been used.",
};

const LINK_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SYMBOLIC_DESTINATION_PATTERN = /^[A-Z][A-Z0-9_:-]{1,80}$/;
const NORMALIZED_HOST = "synthetic.partner.invalid";
const NORMALIZED_PATH_PATTERN = /^\/approved\/[A-Za-z0-9/_-]{1,120}$/;
const SEARCH_KEYS = new Set(["query", "limit"]);
const HANDOFF_TTL_MS = 60_000;
const REQUIRED_STAFF_CAPABILITY = "content:write";

function storageKey(tenantId: string, campusId: string, linkId: string): string {
  return JSON.stringify([tenantId, campusId, linkId]);
}

function cloneRecord(record: PartnerLinkRecord): PartnerLinkRecord {
  return { ...record, allowed_roles: [...record.allowed_roles] };
}

function failure(code: PartnerLinkErrorCode): PartnerLinkError {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAuthorized(context: unknown): context is PartnerLinkActorContext {
  if (!isRecord(context)) return false;
  const scope = context.scope;
  return (
    context.trusted === true &&
    context.activeMembership === true &&
    typeof context.actorId === "string" &&
    context.actorId.length > 0 &&
    isRecord(scope) &&
    typeof scope.tenantId === "string" &&
    scope.tenantId.length > 0 &&
    typeof scope.campusId === "string" &&
    scope.campusId.length > 0 &&
    Array.isArray(context.allowedScopes) &&
    context.allowedScopes.some(
      (allowed) =>
        isRecord(allowed) &&
        allowed.tenantId === scope.tenantId &&
        allowed.campusId === scope.campusId,
    ) &&
    Array.isArray(context.capabilities) &&
    context.capabilities.includes(REQUIRED_STAFF_CAPABILITY)
  );
}

function rolesFor(context: PartnerLinkActorContext): readonly string[] {
  return context.roles ?? context.capabilities;
}

function roleAllows(record: PartnerLinkRecord, context: PartnerLinkActorContext): boolean {
  return (
    record.allowed_roles.length === 0 ||
    record.allowed_roles.some((role) => rolesFor(context).includes(role))
  );
}

function isSafeRecord(record: PartnerLinkRecord): boolean {
  return (
    LINK_ID_PATTERN.test(record.id) &&
    record.synthetic_data === true &&
    SYMBOLIC_DESTINATION_PATTERN.test(record.symbolic_destination) &&
    record.normalized_host === NORMALIZED_HOST &&
    NORMALIZED_PATH_PATTERN.test(record.normalized_path) &&
    !record.normalized_path.split("/").includes("..") &&
    record.required_capability.length > 0 &&
    Array.isArray(record.allowed_roles) &&
    record.allowlist_policy_version.length > 0 &&
    record.title.length > 0 &&
    record.description.length > 0 &&
    Number.isInteger(record.version) &&
    record.version > 0
  );
}

function parseSearchInput(
  value: PartnerLinkSearchInput,
): { readonly query: string; readonly limit: number } | undefined {
  if (!isRecord(value) || Object.keys(value).some((key) => !SEARCH_KEYS.has(key))) {
    return undefined;
  }
  const query = value.query === undefined ? "" : value.query;
  if (typeof query !== "string" || query.length > 80) return undefined;
  const limit = value.limit === undefined ? 20 : value.limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 25) {
    return undefined;
  }
  return { query: query.trim().toLocaleLowerCase(), limit };
}

function project(record: PartnerLinkRecord): PartnerLinkProjection {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    symbolicDestination: record.symbolic_destination,
    normalizedHost: record.normalized_host,
    normalizedPath: record.normalized_path,
    publicationStatus: record.publication_status,
    enabledStatus: record.enabled_status,
    policyVersion: record.allowlist_policy_version,
    version: record.version,
  };
}

function searchText(record: PartnerLinkRecord): string {
  return [record.title, record.description, record.symbolic_destination]
    .join(" ")
    .toLocaleLowerCase();
}

export class PartnerLinkService {
  public readonly repository: PartnerLinkRepository;
  private readonly now: () => Date;
  private readonly onAuditEvent: (event: PartnerLinkAuditEvent) => void;
  private readonly handoffs = new Map<string, HandoffRecord>();
  private handoffSequence = 0;

  public constructor(
    repository: PartnerLinkRepository = new InMemoryPartnerLinkRepository(),
    options: PartnerLinkServiceOptions = {},
  ) {
    this.repository = repository;
    this.now = options.now ?? (() => new Date());
    this.onAuditEvent = options.onAuditEvent ?? (() => undefined);
  }

  public search(
    context: PartnerLinkActorContext,
    input: PartnerLinkSearchInput,
  ): PartnerLinkResult<readonly PartnerLinkProjection[]> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    const parsed = parseSearchInput(input);
    if (parsed === undefined) return failure("VALIDATION_FAILED");

    const data = this.repository
      .list(context.scope)
      .filter(
        (record) =>
          isSafeRecord(record) &&
          record.publication_status === "PUBLISHED" &&
          record.enabled_status === "ENABLED" &&
          record.required_capability === REQUIRED_STAFF_CAPABILITY &&
          roleAllows(record, context) &&
          searchText(record).includes(parsed.query),
      )
      .sort(
        (left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
      )
      .slice(0, parsed.limit)
      .map(project);

    this.onAuditEvent({
      eventType: "SEARCHED",
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      actorReference: context.actorId,
      eventTime: this.now().toISOString(),
    });
    return { ok: true, data };
  }

  public issueEntry(
    context: PartnerLinkActorContext,
    linkId: string,
    clientClaims?: unknown,
  ): PartnerLinkResult<PartnerLinkEntryProjection> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    if (clientClaims !== undefined) return failure("VALIDATION_FAILED");
    if (!LINK_ID_PATTERN.test(linkId)) return failure("VALIDATION_FAILED");

    const record = this.repository.get(context.scope, linkId);
    if (record === undefined) return failure("NOT_FOUND_SCOPED");
    if (!isSafeRecord(record)) return failure("VALIDATION_FAILED");
    if (
      record.publication_status !== "PUBLISHED" ||
      record.enabled_status !== "ENABLED" ||
      record.required_capability !== REQUIRED_STAFF_CAPABILITY ||
      !roleAllows(record, context)
    ) {
      return failure("NOT_FOUND_SCOPED");
    }

    const now = this.now();
    const expiresAt = new Date(now.getTime() + HANDOFF_TTL_MS);
    const token = `handoff:${record.id}:${++this.handoffSequence}`;
    const role = rolesFor(context)[0] ?? REQUIRED_STAFF_CAPABILITY;
    this.handoffs.set(token, {
      token,
      linkId: record.id,
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      actorId: context.actorId,
      role,
      capability: record.required_capability,
      policyVersion: record.allowlist_policy_version,
      expiresAt: expiresAt.getTime(),
      consumed: false,
    });

    this.onAuditEvent({
      eventType: "ENTRY_ISSUED",
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      actorReference: context.actorId,
      linkId: record.id,
      eventTime: now.toISOString(),
    });
    return {
      ok: true,
      data: {
        ...project(record),
        handoffToken: token,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  public consumeHandoff(
    context: PartnerLinkActorContext,
    token: string,
  ): PartnerLinkResult<PartnerLinkProjection> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    if (typeof token !== "string" || token.length < 12) return failure("VALIDATION_FAILED");

    const handoff = this.handoffs.get(token);
    if (handoff === undefined) return failure("VALIDATION_FAILED");
    if (handoff.consumed) return failure("HANDOFF_REUSED");
    if (this.now().getTime() >= handoff.expiresAt) return failure("HANDOFF_EXPIRED");
    if (
      handoff.tenantId !== context.scope.tenantId ||
      handoff.campusId !== context.scope.campusId ||
      handoff.actorId !== context.actorId ||
      handoff.capability !== REQUIRED_STAFF_CAPABILITY ||
      !rolesFor(context).includes(handoff.role)
    ) {
      return failure("FORBIDDEN_SCOPE");
    }

    const record = this.repository.get(context.scope, handoff.linkId);
    if (
      record === undefined ||
      !isSafeRecord(record) ||
      record.publication_status !== "PUBLISHED" ||
      record.enabled_status !== "ENABLED" ||
      record.allowlist_policy_version !== handoff.policyVersion
    ) {
      return failure("NOT_FOUND_SCOPED");
    }

    handoff.consumed = true;
    this.onAuditEvent({
      eventType: "ENTRY_CONSUMED",
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      actorReference: context.actorId,
      linkId: record.id,
      eventTime: this.now().toISOString(),
    });
    return { ok: true, data: project(record) };
  }
}
