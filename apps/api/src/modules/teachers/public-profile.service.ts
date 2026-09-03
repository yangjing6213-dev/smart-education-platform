export type TeacherProfileStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
export type TeacherCapability = "content:write" | "content:publish";

export interface TeacherScope {
  readonly tenantId: string;
  readonly campusId: string;
}

export interface TeacherActorContext {
  readonly trusted: true;
  readonly actorId: string;
  readonly activeMembership: true;
  readonly scope: TeacherScope;
  readonly capabilities: readonly string[];
}

export interface TeacherDraftPayload {
  readonly display_name: string;
  readonly headline: string;
  readonly subjects: readonly string[];
  readonly bio: string;
  readonly photo_ref?: string | null;
  readonly private_email?: string;
  readonly internal_notes?: string;
}

export interface TeacherProfileRecord {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly status: TeacherProfileStatus;
  readonly version: number;
  readonly display_name: string;
  readonly headline: string;
  readonly subjects: readonly string[];
  readonly bio: string;
  readonly photo_ref: string | null;
  readonly private_email: string;
  readonly internal_notes: string;
  readonly published_at: string | null;
  readonly synthetic_data: true;
  readonly updated_by: string;
  readonly updated_at: string;
}

export interface PublicTeacherCard {
  readonly id: string;
  readonly display_name: string;
  readonly headline: string;
  readonly subjects: readonly string[];
  readonly bio: string;
  readonly photo_ref?: string;
  readonly published_at: string;
}

export interface TeacherPublicationAuditEvent {
  readonly eventType: "PUBLISHED" | "UNPUBLISHED";
  readonly tenantId: string;
  readonly campusId: string;
  readonly profileId: string;
  readonly resultingVersion: number;
  readonly actorReference: string;
  readonly eventTime: string;
}

export interface TeacherProfileRepository {
  get(scope: TeacherScope, profileId: string): TeacherProfileRecord | undefined;
  save(record: TeacherProfileRecord): void;
  compareAndSave(
    scope: TeacherScope,
    profileId: string,
    expectedVersion: number,
    record: TeacherProfileRecord,
  ): boolean;
}

export class InMemoryTeacherProfileRepository implements TeacherProfileRepository {
  private readonly records = new Map<string, TeacherProfileRecord>();

  public get(scope: TeacherScope, profileId: string): TeacherProfileRecord | undefined {
    const record = this.records.get(storageKey(scope, profileId));
    return record === undefined ? undefined : cloneRecord(record);
  }

  public save(record: TeacherProfileRecord): void {
    this.records.set(
      storageKey({ tenantId: record.tenant_id, campusId: record.campus_id }, record.id),
      cloneRecord(record),
    );
  }

  public compareAndSave(
    scope: TeacherScope,
    profileId: string,
    expectedVersion: number,
    record: TeacherProfileRecord,
  ): boolean {
    const key = storageKey(scope, profileId);
    const current = this.records.get(key);
    if (current === undefined || current.version !== expectedVersion) return false;
    this.records.set(key, cloneRecord(record));
    return true;
  }
}

export type TeacherProfileErrorCode =
  | "FORBIDDEN_SCOPE"
  | "NOT_FOUND_SCOPED"
  | "VALIDATION_FAILED"
  | "VERSION_MISMATCH"
  | "CONFLICT_STATE";

export interface TeacherProfileError {
  readonly ok: false;
  readonly error: {
    readonly code: TeacherProfileErrorCode;
    readonly message: string;
  };
}

export interface TeacherProfileSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export type TeacherProfileResult<T> = TeacherProfileSuccess<T> | TeacherProfileError;

export interface TeacherProfileServiceOptions {
  readonly now?: () => Date;
  readonly onPublicationAuditEvent?: (event: TeacherPublicationAuditEvent) => void;
}

const ERROR_MESSAGES: Record<TeacherProfileErrorCode, string> = {
  FORBIDDEN_SCOPE: "Teacher profile scope access is not permitted.",
  NOT_FOUND_SCOPED: "Published teacher profile was not found.",
  VALIDATION_FAILED: "Teacher profile input is invalid.",
  VERSION_MISMATCH: "Teacher profile version is stale.",
  CONFLICT_STATE: "Teacher profile state transition is not permitted.",
};

const PROFILE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const PHOTO_REFERENCE_PATTERN = /^file-ref:\/[A-Za-z0-9._/-]{1,200}$/;
const PAYLOAD_KEYS = new Set([
  "display_name",
  "headline",
  "subjects",
  "bio",
  "photo_ref",
  "private_email",
  "internal_notes",
]);

function storageKey(scope: TeacherScope, profileId: string): string {
  return JSON.stringify([scope.tenantId, scope.campusId, profileId]);
}

function cloneRecord(record: TeacherProfileRecord): TeacherProfileRecord {
  return { ...record, subjects: [...record.subjects] };
}

function failure(code: TeacherProfileErrorCode): TeacherProfileError {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isValidScope(value: unknown): value is TeacherScope {
  if (!isRecord(value)) return false;
  return typeof value.tenantId === "string" && typeof value.campusId === "string";
}

function isAuthorized(
  value: unknown,
  capability?: TeacherCapability,
): value is TeacherActorContext {
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

function validProfileId(profileId: unknown): profileId is string {
  return typeof profileId === "string" && PROFILE_ID_PATTERN.test(profileId);
}

function validPayload(value: unknown): value is TeacherDraftPayload {
  if (!isRecord(value) || [...Object.keys(value)].some((key) => !PAYLOAD_KEYS.has(key))) {
    return false;
  }
  if (
    typeof value.display_name !== "string" ||
    value.display_name.length < 1 ||
    value.display_name.length > 100 ||
    typeof value.headline !== "string" ||
    value.headline.length < 1 ||
    value.headline.length > 160 ||
    typeof value.bio !== "string" ||
    value.bio.length < 1 ||
    value.bio.length > 1000 ||
    !Array.isArray(value.subjects) ||
    value.subjects.length < 1 ||
    value.subjects.length > 6 ||
    !value.subjects.every(
      (subject) => typeof subject === "string" && subject.length >= 1 && subject.length <= 60,
    )
  ) {
    return false;
  }
  if (
    value.photo_ref !== undefined &&
    value.photo_ref !== null &&
    (typeof value.photo_ref !== "string" || !PHOTO_REFERENCE_PATTERN.test(value.photo_ref))
  ) {
    return false;
  }
  if (value.private_email !== undefined && typeof value.private_email !== "string") return false;
  if (value.internal_notes !== undefined && typeof value.internal_notes !== "string") return false;
  return true;
}

function projectPublic(record: TeacherProfileRecord): PublicTeacherCard {
  return {
    id: record.id,
    display_name: record.display_name,
    headline: record.headline,
    subjects: [...record.subjects],
    bio: record.bio,
    ...(record.photo_ref === null ? {} : { photo_ref: record.photo_ref }),
    published_at: record.published_at!,
  };
}

export class TeacherProfileService {
  public readonly repository: TeacherProfileRepository;
  private readonly now: () => Date;
  private readonly onPublicationAuditEvent: (event: TeacherPublicationAuditEvent) => void;

  public constructor(
    repository: TeacherProfileRepository = new InMemoryTeacherProfileRepository(),
    options: TeacherProfileServiceOptions = {},
  ) {
    this.repository = repository;
    this.now = options.now ?? (() => new Date());
    this.onPublicationAuditEvent = options.onPublicationAuditEvent ?? (() => undefined);
  }

  public createDraft(
    context: TeacherActorContext,
    profileId: string,
    payload: TeacherDraftPayload,
    expectedVersion: number | null = null,
  ): TeacherProfileResult<TeacherProfileRecord> {
    if (!isAuthorized(context, "content:write")) return failure("FORBIDDEN_SCOPE");
    if (!validProfileId(profileId) || !validPayload(payload)) return failure("VALIDATION_FAILED");

    const existing = this.repository.get(context.scope, profileId);
    if (existing !== undefined) {
      if (!isVersion(expectedVersion) || existing.version !== expectedVersion) {
        return failure("VERSION_MISMATCH");
      }
      return failure("CONFLICT_STATE");
    }
    if (expectedVersion !== null) return failure("VERSION_MISMATCH");

    const now = this.now().toISOString();
    const record: TeacherProfileRecord = {
      id: profileId,
      tenant_id: context.scope.tenantId,
      campus_id: context.scope.campusId,
      status: "DRAFT",
      version: 1,
      display_name: payload.display_name,
      headline: payload.headline,
      subjects: [...payload.subjects],
      bio: payload.bio,
      photo_ref: payload.photo_ref ?? null,
      private_email: payload.private_email ?? "",
      internal_notes: payload.internal_notes ?? "",
      published_at: null,
      synthetic_data: true,
      updated_by: context.actorId,
      updated_at: now,
    };
    this.repository.save(record);
    return { ok: true, data: record };
  }

  public updateDraft(
    context: TeacherActorContext,
    profileId: string,
    payload: TeacherDraftPayload,
    expectedCurrentVersion: number,
  ): TeacherProfileResult<TeacherProfileRecord> {
    if (!isAuthorized(context, "content:write")) return failure("FORBIDDEN_SCOPE");
    if (!validProfileId(profileId) || !validPayload(payload)) return failure("VALIDATION_FAILED");

    const existing = this.repository.get(context.scope, profileId);
    if (existing === undefined) return failure("NOT_FOUND_SCOPED");
    if (!isVersion(expectedCurrentVersion) || existing.version !== expectedCurrentVersion) {
      return failure("VERSION_MISMATCH");
    }

    const record: TeacherProfileRecord = {
      ...existing,
      status: "DRAFT",
      version: existing.version + 1,
      display_name: payload.display_name,
      headline: payload.headline,
      subjects: [...payload.subjects],
      bio: payload.bio,
      photo_ref: payload.photo_ref ?? null,
      private_email: payload.private_email ?? "",
      internal_notes: payload.internal_notes ?? "",
      published_at: null,
      updated_by: context.actorId,
      updated_at: this.now().toISOString(),
    };
    if (!this.repository.compareAndSave(context.scope, profileId, expectedCurrentVersion, record)) {
      return failure("VERSION_MISMATCH");
    }
    return { ok: true, data: record };
  }

  public readDraft(
    context: TeacherActorContext,
    profileId: string,
  ): TeacherProfileResult<TeacherProfileRecord> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    if (!validProfileId(profileId)) return failure("VALIDATION_FAILED");

    const record = this.repository.get(context.scope, profileId);
    return record === undefined ? failure("NOT_FOUND_SCOPED") : { ok: true, data: record };
  }

  public publish(
    context: TeacherActorContext,
    profileId: string,
    expectedCurrentVersion: number,
  ): TeacherProfileResult<TeacherProfileRecord> {
    return this.transitionPublication(context, profileId, expectedCurrentVersion, "PUBLISHED");
  }

  public unpublish(
    context: TeacherActorContext,
    profileId: string,
    expectedCurrentVersion: number,
  ): TeacherProfileResult<TeacherProfileRecord> {
    return this.transitionPublication(context, profileId, expectedCurrentVersion, "UNPUBLISHED");
  }

  public readPublic(
    scope: TeacherScope,
    profileId: string,
  ): TeacherProfileResult<PublicTeacherCard> {
    if (!isValidScope(scope)) return failure("FORBIDDEN_SCOPE");
    if (!validProfileId(profileId)) return failure("VALIDATION_FAILED");

    const record = this.repository.get(scope, profileId);
    if (record === undefined || record.status !== "PUBLISHED" || record.published_at === null) {
      return failure("NOT_FOUND_SCOPED");
    }
    return { ok: true, data: projectPublic(record) };
  }

  private transitionPublication(
    context: TeacherActorContext,
    profileId: string,
    expectedCurrentVersion: number,
    targetStatus: Extract<TeacherProfileStatus, "PUBLISHED" | "UNPUBLISHED">,
  ): TeacherProfileResult<TeacherProfileRecord> {
    if (!isAuthorized(context, "content:publish")) return failure("FORBIDDEN_SCOPE");
    if (!validProfileId(profileId) || !isVersion(expectedCurrentVersion)) {
      return failure("VALIDATION_FAILED");
    }

    const existing = this.repository.get(context.scope, profileId);
    if (existing === undefined) return failure("NOT_FOUND_SCOPED");
    if (existing.version !== expectedCurrentVersion) return failure("VERSION_MISMATCH");
    if (
      (targetStatus === "PUBLISHED" && existing.status === "PUBLISHED") ||
      (targetStatus === "UNPUBLISHED" && existing.status !== "PUBLISHED")
    ) {
      return failure("CONFLICT_STATE");
    }

    const now = this.now().toISOString();
    const record: TeacherProfileRecord = {
      ...existing,
      status: targetStatus,
      version: existing.version + 1,
      published_at: targetStatus === "PUBLISHED" ? now : null,
      updated_by: context.actorId,
      updated_at: now,
    };
    if (!this.repository.compareAndSave(context.scope, profileId, expectedCurrentVersion, record)) {
      return failure("VERSION_MISMATCH");
    }
    this.onPublicationAuditEvent({
      eventType: targetStatus,
      tenantId: record.tenant_id,
      campusId: record.campus_id,
      profileId: record.id,
      resultingVersion: record.version,
      actorReference: context.actorId,
      eventTime: now,
    });
    return { ok: true, data: record };
  }
}
