import type { AuditService } from "../audit/audit.service.js";

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
  readonly membershipId: string;
  readonly membershipStatus: "ACTIVE";
  readonly membershipTenantId: string;
  readonly membershipCampusIds: readonly string[];
  readonly scopeFingerprint: string;
  readonly capabilities: readonly string[];
  readonly roles?: readonly string[];
  readonly requestCorrelationId: string;
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

export type PartnerLinkAuditAction =
  | "SEARCH"
  | "ISSUE_ENTRY"
  | "CONSUME_HANDOFF"
  | "ROUTE_QUERY_VALIDATION"
  | "ROUTE_SCOPE_VALIDATION";

export interface PartnerLinkAuditEvent {
  readonly eventType: "SEARCHED" | "ENTRY_ISSUED" | "ENTRY_CONSUMED" | "DENIED";
  readonly action: PartnerLinkAuditAction;
  readonly result: "ALLOWED" | PartnerLinkErrorCode;
  readonly tenantId: string;
  readonly campusId: string;
  readonly actorReference: string;
  readonly linkId?: string;
  readonly requestCorrelationId: string;
  readonly eventTime: string;
}

export interface PartnerLinkRepository {
  get(scope: PartnerLinkScope, linkId: string): PartnerLinkRecord | undefined;
  list(scope: PartnerLinkScope): readonly PartnerLinkRecord[];
}

export interface PartnerLinkScopeFingerprintInput {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly allowedScopes: readonly PartnerLinkScope[];
  readonly membershipId: string;
  readonly membershipStatus: "ACTIVE";
  readonly membershipTenantId: string;
  readonly membershipCampusIds: readonly string[];
  readonly capabilities: readonly string[];
  readonly roles?: readonly string[];
}

export interface PartnerLinkMembershipIdentityInput {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusIds: readonly string[];
  readonly membershipStatus: "ACTIVE";
  readonly capabilities: readonly string[];
}

export function createPartnerLinkMembershipId(input: PartnerLinkMembershipIdentityInput): string {
  return `membership:${JSON.stringify({
    actorId: input.actorId,
    tenantId: input.tenantId,
    campusIds: [...input.campusIds].sort(),
    membershipStatus: input.membershipStatus,
    capabilities: [...input.capabilities].sort(),
  })}`;
}

export function createPartnerLinkScopeFingerprint(input: PartnerLinkScopeFingerprintInput): string {
  return JSON.stringify({
    actorId: input.actorId,
    tenantId: input.tenantId,
    campusId: input.campusId,
    allowedScopes: input.allowedScopes
      .map((scope) => [scope.tenantId, scope.campusId])
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    membershipId: input.membershipId,
    membershipStatus: input.membershipStatus,
    membershipTenantId: input.membershipTenantId,
    membershipCampusIds: [...input.membershipCampusIds].sort(),
    capabilities: [...input.capabilities].sort(),
    roles: [...(input.roles ?? input.capabilities)].sort(),
  });
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
  readonly auditService?: AuditService;
}

interface HandoffRecord {
  readonly token: string;
  readonly linkId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly actorId: string;
  readonly membershipId: string;
  readonly scopeFingerprint: string;
  readonly role: string;
  readonly capability: string;
  readonly policyVersion: string;
  readonly version: number;
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

function isPartnerLinkScope(value: unknown): value is PartnerLinkScope {
  return (
    isRecord(value) &&
    typeof value.tenantId === "string" &&
    value.tenantId.length > 0 &&
    typeof value.campusId === "string" &&
    value.campusId.length > 0
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

function isAuthorized(context: unknown): context is PartnerLinkActorContext {
  if (!isRecord(context)) return false;
  const scope = context.scope;
  if (
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
    context.allowedScopes.every(isPartnerLinkScope) &&
    context.allowedScopes.some(
      (allowed) => allowed.tenantId === scope.tenantId && allowed.campusId === scope.campusId,
    ) &&
    isStringArray(context.capabilities) &&
    context.capabilities.includes(REQUIRED_STAFF_CAPABILITY) &&
    typeof context.membershipId === "string" &&
    context.membershipId.length > 0 &&
    context.membershipStatus === "ACTIVE" &&
    typeof context.membershipTenantId === "string" &&
    context.membershipTenantId === scope.tenantId &&
    isStringArray(context.membershipCampusIds) &&
    context.membershipCampusIds.includes(scope.campusId) &&
    typeof context.scopeFingerprint === "string" &&
    typeof context.requestCorrelationId === "string" &&
    context.requestCorrelationId.length > 0 &&
    (context.roles === undefined || isStringArray(context.roles))
  ) {
    return (
      context.scopeFingerprint ===
      createPartnerLinkScopeFingerprint({
        actorId: context.actorId,
        tenantId: scope.tenantId,
        campusId: scope.campusId,
        allowedScopes: context.allowedScopes as PartnerLinkScope[],
        membershipId: context.membershipId,
        membershipStatus: context.membershipStatus,
        membershipTenantId: context.membershipTenantId,
        membershipCampusIds: context.membershipCampusIds,
        capabilities: context.capabilities,
        roles: Array.isArray(context.roles) ? context.roles : context.capabilities,
      })
    );
  }
  return false;
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
  private readonly auditService: AuditService | undefined;
  private readonly handoffs = new Map<string, HandoffRecord>();
  private handoffSequence = 0;

  public constructor(
    repository: PartnerLinkRepository = new InMemoryPartnerLinkRepository(),
    options: PartnerLinkServiceOptions = {},
  ) {
    this.repository = repository;
    this.now = options.now ?? (() => new Date());
    this.onAuditEvent = options.onAuditEvent ?? (() => undefined);
    this.auditService = options.auditService;
  }

  private auditDenied(
    context: unknown,
    action: PartnerLinkAuditAction,
    result: PartnerLinkErrorCode,
    linkId?: string,
    requestCorrelationId?: string,
  ): void {
    const record = isRecord(context) ? context : undefined;
    const scope = record !== undefined && isRecord(record.scope) ? record.scope : undefined;
    this.onAuditEvent({
      eventType: "DENIED",
      action,
      result,
      tenantId: typeof scope?.tenantId === "string" ? scope.tenantId : "unknown",
      campusId: typeof scope?.campusId === "string" ? scope.campusId : "unknown",
      actorReference: typeof record?.actorId === "string" ? record.actorId : "unknown",
      ...(linkId === undefined ? {} : { linkId }),
      requestCorrelationId:
        requestCorrelationId ??
        (typeof record?.requestCorrelationId === "string"
          ? record.requestCorrelationId
          : "unavailable"),
      eventTime: this.now().toISOString(),
    });
  }

  public recordDenial(
    requestCorrelationId: string,
    action: PartnerLinkAuditAction,
    result: PartnerLinkErrorCode,
    context?: unknown,
    linkId?: string,
  ): void {
    this.auditDenied(context, action, result, linkId, requestCorrelationId);
  }

  private denied(
    context: unknown,
    action: PartnerLinkAuditAction,
    result: PartnerLinkErrorCode,
    linkId?: string,
  ): PartnerLinkError {
    this.auditDenied(context, action, result, linkId);
    return failure(result);
  }

  public search(
    context: PartnerLinkActorContext,
    input: PartnerLinkSearchInput,
  ): PartnerLinkResult<readonly PartnerLinkProjection[]> {
    if (!isAuthorized(context)) return this.denied(context, "SEARCH", "FORBIDDEN_SCOPE");
    const parsed = parseSearchInput(input);
    if (parsed === undefined) return this.denied(context, "SEARCH", "VALIDATION_FAILED");

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
      action: "SEARCH",
      result: "ALLOWED",
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      actorReference: context.actorId,
      requestCorrelationId: context.requestCorrelationId,
      eventTime: this.now().toISOString(),
    });
    return { ok: true, data };
  }

  public issueEntry(
    context: PartnerLinkActorContext,
    linkId: string,
    clientClaims?: unknown,
  ): PartnerLinkResult<PartnerLinkEntryProjection> {
    if (!isAuthorized(context)) return this.denied(context, "ISSUE_ENTRY", "FORBIDDEN_SCOPE");
    if (clientClaims !== undefined) {
      return this.denied(context, "ISSUE_ENTRY", "VALIDATION_FAILED", linkId);
    }
    if (!LINK_ID_PATTERN.test(linkId)) {
      return this.denied(context, "ISSUE_ENTRY", "VALIDATION_FAILED", linkId);
    }

    const record = this.repository.get(context.scope, linkId);
    if (record === undefined) {
      return this.denied(context, "ISSUE_ENTRY", "NOT_FOUND_SCOPED", linkId);
    }
    if (!isSafeRecord(record)) {
      return this.denied(context, "ISSUE_ENTRY", "VALIDATION_FAILED", linkId);
    }
    if (
      record.publication_status !== "PUBLISHED" ||
      record.enabled_status !== "ENABLED" ||
      record.required_capability !== REQUIRED_STAFF_CAPABILITY ||
      !roleAllows(record, context)
    ) {
      return this.denied(context, "ISSUE_ENTRY", "NOT_FOUND_SCOPED", linkId);
    }

    const now = this.now();
    const expiresAt = new Date(now.getTime() + HANDOFF_TTL_MS);
    const nextHandoffSequence = this.handoffSequence + 1;
    const token = `handoff:${record.id}:${nextHandoffSequence}`;
    const role = rolesFor(context)[0] ?? REQUIRED_STAFF_CAPABILITY;
    const command = () => {
      this.handoffSequence = nextHandoffSequence;
      this.handoffs.set(token, {
        token,
        linkId: record.id,
        tenantId: context.scope.tenantId,
        campusId: context.scope.campusId,
        actorId: context.actorId,
        membershipId: context.membershipId,
        scopeFingerprint: context.scopeFingerprint,
        role,
        capability: record.required_capability,
        policyVersion: record.allowlist_policy_version,
        version: record.version,
        expiresAt: expiresAt.getTime(),
        consumed: false,
      });

      this.onAuditEvent({
        eventType: "ENTRY_ISSUED",
        action: "ISSUE_ENTRY",
        result: "ALLOWED",
        tenantId: context.scope.tenantId,
        campusId: context.scope.campusId,
        actorReference: context.actorId,
        linkId: record.id,
        requestCorrelationId: context.requestCorrelationId,
        eventTime: now.toISOString(),
      });
      return {
        ok: true as const,
        data: {
          ...project(record),
          handoffToken: token,
          expiresAt: expiresAt.toISOString(),
        },
      };
    };
    if (this.auditService === undefined) return command();
    const result = this.auditService.executeProtectedCommand(
      context,
      {
        action: "PARTNER_LINK_HANDOFF_CREATED",
        target: { type: "PARTNER_LINK", id: record.id },
        correlationId: context.requestCorrelationId,
        traceId: context.requestCorrelationId,
        metadata: {
          result: "SUCCESS",
          version: record.version,
          status: "CREATED",
          channel: "API",
          operation: "CREATE_PARTNER_HANDOFF",
          synthetic_reference: "synthetic-partner-link",
        },
      },
      () => command(),
    );
    if (result.ok) return result;
    return result.error.code === "FORBIDDEN_SCOPE"
      ? this.denied(context, "ISSUE_ENTRY", "FORBIDDEN_SCOPE", linkId)
      : this.denied(context, "ISSUE_ENTRY", "VALIDATION_FAILED", linkId);
  }

  public consumeHandoff(
    context: PartnerLinkActorContext,
    token: string,
  ): PartnerLinkResult<PartnerLinkProjection> {
    if (!isAuthorized(context)) return this.denied(context, "CONSUME_HANDOFF", "FORBIDDEN_SCOPE");
    if (typeof token !== "string" || token.length < 12) {
      return this.denied(context, "CONSUME_HANDOFF", "VALIDATION_FAILED");
    }

    const handoff = this.handoffs.get(token);
    if (handoff === undefined) {
      return this.denied(context, "CONSUME_HANDOFF", "VALIDATION_FAILED");
    }
    if (handoff.consumed) {
      return this.denied(context, "CONSUME_HANDOFF", "HANDOFF_REUSED", handoff.linkId);
    }
    if (this.now().getTime() >= handoff.expiresAt) {
      return this.denied(context, "CONSUME_HANDOFF", "HANDOFF_EXPIRED", handoff.linkId);
    }
    if (
      handoff.tenantId !== context.scope.tenantId ||
      handoff.campusId !== context.scope.campusId ||
      handoff.actorId !== context.actorId ||
      handoff.membershipId !== context.membershipId ||
      handoff.scopeFingerprint !== context.scopeFingerprint ||
      handoff.capability !== REQUIRED_STAFF_CAPABILITY ||
      !rolesFor(context).includes(handoff.role)
    ) {
      return this.denied(context, "CONSUME_HANDOFF", "FORBIDDEN_SCOPE", handoff.linkId);
    }

    const record = this.repository.get(context.scope, handoff.linkId);
    if (
      record === undefined ||
      !isSafeRecord(record) ||
      record.publication_status !== "PUBLISHED" ||
      record.enabled_status !== "ENABLED" ||
      record.allowlist_policy_version !== handoff.policyVersion ||
      record.version !== handoff.version
    ) {
      return this.denied(context, "CONSUME_HANDOFF", "NOT_FOUND_SCOPED", handoff.linkId);
    }

    handoff.consumed = true;
    this.onAuditEvent({
      eventType: "ENTRY_CONSUMED",
      action: "CONSUME_HANDOFF",
      result: "ALLOWED",
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      actorReference: context.actorId,
      linkId: record.id,
      requestCorrelationId: context.requestCorrelationId,
      eventTime: this.now().toISOString(),
    });
    return { ok: true, data: project(record) };
  }
}
