import { createHash, randomUUID } from "node:crypto";
import {
  InMemoryCosStorage,
  type CosStoragePort,
  type StorageScope,
} from "../../adapters/cos.storage.js";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const UPLOAD_INTENT_TTL_MS = 10 * 60 * 1000;
export const READ_LINK_TTL_MS = 5 * 60 * 1000;

export type FilePurpose = "ACTIVITY_MEDIA" | "GUIDE_ATTACHMENT" | "INSTITUTION_MEDIA";
export type FileMimeType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
export type FileScanState = "PENDING" | "SCANNING" | "APPROVED" | "REJECTED";

export interface FileScope {
  readonly tenantId: string;
  readonly campusId: string;
}

export interface FileActorContext {
  readonly trusted: true;
  readonly actorId: string;
  readonly activeMembership: true;
  readonly scope: FileScope;
  readonly capabilities: readonly string[];
}

export interface FileUploadIntentInput {
  readonly declaredPurpose: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
}

export interface FileRecordProjection {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly declared_purpose: FilePurpose;
  readonly mime_type: FileMimeType;
  readonly size_bytes: number;
  readonly checksum: string;
  readonly scan_state: FileScanState;
  readonly synthetic_data: true;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface FileUploadIntentProjection {
  readonly file_id: string;
  readonly token: string;
  readonly declared_purpose: FilePurpose;
  readonly expires_at: string;
}

export interface FileReadLinkProjection {
  readonly file_id: string;
  readonly read_link: string;
  readonly expires_at: string;
}

export interface FileReadProjection {
  readonly file_id: string;
  readonly bytes: Uint8Array;
  readonly mime_type: FileMimeType;
  readonly checksum: string;
}

export type FileErrorCode =
  | "FORBIDDEN_SCOPE"
  | "NOT_FOUND_SCOPED"
  | "VALIDATION_FAILED"
  | "MIME_NOT_ALLOWED"
  | "SIZE_NOT_ALLOWED"
  | "CHECKSUM_MISMATCH"
  | "MIME_MISMATCH"
  | "UPLOAD_INTENT_INVALID"
  | "UPLOAD_INTENT_EXPIRED"
  | "UPLOAD_INTENT_CONSUMED"
  | "READ_LINK_INVALID"
  | "READ_LINK_EXPIRED"
  | "UNSIGNED_ACCESS"
  | "SCAN_NOT_APPROVED"
  | "STORAGE_UNAVAILABLE";

export interface FileFailure {
  readonly ok: false;
  readonly data?: never;
  readonly error: {
    readonly code: FileErrorCode;
    readonly message: string;
  };
}

export interface FileSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export type FileResult<T> = FileSuccess<T> | FileFailure;

export interface FileServiceOptions {
  readonly now?: () => Date;
  readonly onAuditEvent?: (event: FileAuditEvent) => void;
}

export interface FileAuditEvent {
  readonly eventType:
    | "UPLOAD_INTENT_ISSUED"
    | "UPLOAD_APPROVED"
    | "UPLOAD_REJECTED"
    | "READ_LINK_ISSUED"
    | "FILE_READ";
  readonly tenantId: string;
  readonly campusId: string;
  readonly fileId: string;
  readonly actorReference: string;
  readonly eventTime: string;
}

type InternalFileRecord = FileRecordProjection;

interface InternalUploadIntent {
  readonly file_id: string;
  readonly token: string;
  readonly declared_purpose: FilePurpose;
  readonly scope: FileScope;
  readonly expires_at: number;
  consumed: boolean;
}

interface InternalReadLink {
  readonly file_id: string;
  readonly token: string;
  readonly scope: FileScope;
  readonly expires_at: number;
}

const ALLOWED_PURPOSES = new Set<FilePurpose>([
  "ACTIVITY_MEDIA",
  "GUIDE_ATTACHMENT",
  "INSTITUTION_MEDIA",
]);
const ALLOWED_MIME_TYPES = new Set<FileMimeType>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const ALLOWED_MIME_TYPES_BY_PURPOSE: Readonly<Record<FilePurpose, ReadonlySet<FileMimeType>>> = {
  ACTIVITY_MEDIA: new Set(["image/jpeg", "image/png", "image/webp"]),
  GUIDE_ATTACHMENT: ALLOWED_MIME_TYPES,
  INSTITUTION_MEDIA: new Set(["image/jpeg", "image/png", "image/webp"]),
};
const INPUT_KEYS = new Set(["declaredPurpose", "mimeType", "sizeBytes", "checksum"]);
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/i;
const FILE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

const ERROR_MESSAGES: Record<FileErrorCode, string> = {
  FORBIDDEN_SCOPE: "File scope access is not permitted.",
  NOT_FOUND_SCOPED: "File was not found in the allowed scope.",
  VALIDATION_FAILED: "File input is invalid.",
  MIME_NOT_ALLOWED: "The file MIME type is not allowed.",
  SIZE_NOT_ALLOWED: "The file size is not allowed.",
  CHECKSUM_MISMATCH: "The file checksum does not match.",
  MIME_MISMATCH: "The file content does not match its MIME type.",
  UPLOAD_INTENT_INVALID: "The upload intent is invalid.",
  UPLOAD_INTENT_EXPIRED: "The upload intent has expired.",
  UPLOAD_INTENT_CONSUMED: "The upload intent has already been consumed.",
  READ_LINK_INVALID: "The file read link is invalid.",
  READ_LINK_EXPIRED: "The file read link has expired.",
  UNSIGNED_ACCESS: "A signed file read token is required.",
  SCAN_NOT_APPROVED: "The file is not approved for reading.",
  STORAGE_UNAVAILABLE: "File storage is unavailable.",
};

function failure<T = never>(code: FileErrorCode): FileResult<T> {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidScope(value: unknown): value is FileScope {
  return (
    isRecord(value) &&
    typeof value.tenantId === "string" &&
    value.tenantId.length > 0 &&
    typeof value.campusId === "string" &&
    value.campusId.length > 0
  );
}

function isAuthorized(value: unknown): value is FileActorContext {
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

function isFileId(value: unknown): value is string {
  return typeof value === "string" && FILE_ID_PATTERN.test(value);
}

function isPurpose(value: unknown): value is FilePurpose {
  return typeof value === "string" && ALLOWED_PURPOSES.has(value as FilePurpose);
}

function isMimeType(value: unknown): value is FileMimeType {
  return typeof value === "string" && ALLOWED_MIME_TYPES.has(value as FileMimeType);
}

function maxBytesFor(mimeType: FileMimeType): number {
  return mimeType === "application/pdf" ? MAX_DOCUMENT_BYTES : MAX_FILE_BYTES;
}

function checksum(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function scopeKey(scope: FileScope, fileId: string): string {
  return JSON.stringify([scope.tenantId, scope.campusId, fileId]);
}

function sameScope(left: FileScope, right: FileScope): boolean {
  return left.tenantId === right.tenantId && left.campusId === right.campusId;
}

function cloneScope(scope: FileScope): FileScope {
  return { tenantId: scope.tenantId, campusId: scope.campusId };
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function contentMatchesMime(mimeType: FileMimeType, bytes: Uint8Array): boolean {
  if (mimeType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}

function projectFile(record: InternalFileRecord): FileRecordProjection {
  return { ...record };
}

function projectIntent(intent: InternalUploadIntent): FileUploadIntentProjection {
  return {
    file_id: intent.file_id,
    token: intent.token,
    declared_purpose: intent.declared_purpose,
    expires_at: new Date(intent.expires_at).toISOString(),
  };
}

export class FileService {
  private readonly storage: CosStoragePort;
  private readonly now: () => Date;
  private readonly onAuditEvent: (event: FileAuditEvent) => void;
  private readonly records = new Map<string, InternalFileRecord>();
  private readonly recordsById = new Map<string, InternalFileRecord>();
  private readonly intents = new Map<string, InternalUploadIntent>();
  private readonly readLinks = new Map<string, InternalReadLink>();

  public constructor(
    storage: CosStoragePort = new InMemoryCosStorage(),
    options: FileServiceOptions = {},
  ) {
    this.storage = storage;
    this.now = options.now ?? (() => new Date());
    this.onAuditEvent = options.onAuditEvent ?? (() => undefined);
  }

  public createUploadIntent(
    context: FileActorContext,
    input: FileUploadIntentInput,
  ): FileResult<{ file: FileRecordProjection; intent: FileUploadIntentProjection }> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    if (!isRecord(input) || Object.keys(input).some((key) => !INPUT_KEYS.has(key))) {
      return failure("VALIDATION_FAILED");
    }
    if (!isPurpose(input.declaredPurpose)) return failure("VALIDATION_FAILED");
    if (
      !isMimeType(input.mimeType) ||
      !ALLOWED_MIME_TYPES_BY_PURPOSE[input.declaredPurpose].has(input.mimeType)
    ) {
      return failure("MIME_NOT_ALLOWED");
    }
    if (
      !Number.isInteger(input.sizeBytes) ||
      input.sizeBytes < 1 ||
      input.sizeBytes > maxBytesFor(input.mimeType)
    ) {
      return failure("SIZE_NOT_ALLOWED");
    }
    if (typeof input.checksum !== "string" || !CHECKSUM_PATTERN.test(input.checksum)) {
      return failure("VALIDATION_FAILED");
    }

    const now = this.now().getTime();
    const fileId = randomUUID();
    const record: InternalFileRecord = {
      id: fileId,
      tenant_id: context.scope.tenantId,
      campus_id: context.scope.campusId,
      declared_purpose: input.declaredPurpose,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      checksum: input.checksum.toLowerCase(),
      scan_state: "PENDING",
      synthetic_data: true,
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    };
    const token = `upload:${randomUUID()}`;
    const intent: InternalUploadIntent = {
      file_id: fileId,
      token,
      declared_purpose: record.declared_purpose,
      scope: cloneScope(context.scope),
      expires_at: now + UPLOAD_INTENT_TTL_MS,
      consumed: false,
    };
    this.records.set(scopeKey(context.scope, fileId), record);
    this.recordsById.set(fileId, record);
    this.intents.set(token, intent);
    this.emitAuditEvent("UPLOAD_INTENT_ISSUED", context, fileId, new Date(now));
    return {
      ok: true,
      data: { file: projectFile(record), intent: projectIntent(intent) },
    };
  }

  public getFileRecord(
    context: FileActorContext,
    fileId: string,
  ): FileResult<FileRecordProjection> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    const record = this.resolveRecord(context.scope, fileId);
    return record.ok ? { ok: true, data: projectFile(record.data) } : record;
  }

  public completeUpload(
    context: FileActorContext,
    fileId: string,
    uploadIntent: string,
    bytes: Uint8Array,
  ): FileResult<FileRecordProjection> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    const recordResult = this.resolveRecord(context.scope, fileId);
    if (!recordResult.ok) return recordResult;
    if (typeof uploadIntent !== "string" || uploadIntent.length === 0) {
      return failure("UPLOAD_INTENT_INVALID");
    }
    const intent = this.intents.get(uploadIntent);
    if (
      intent === undefined ||
      intent.file_id !== fileId ||
      !sameScope(intent.scope, context.scope) ||
      intent.declared_purpose !== recordResult.data.declared_purpose
    ) {
      return failure("UPLOAD_INTENT_INVALID");
    }
    if (intent.consumed) return failure("UPLOAD_INTENT_CONSUMED");
    if (this.now().getTime() >= intent.expires_at) return failure("UPLOAD_INTENT_EXPIRED");
    if (!(bytes instanceof Uint8Array)) return failure("VALIDATION_FAILED");
    if (checksum(bytes) !== recordResult.data.checksum) return failure("CHECKSUM_MISMATCH");
    if (bytes.byteLength !== recordResult.data.size_bytes) return failure("SIZE_NOT_ALLOWED");
    if (!contentMatchesMime(recordResult.data.mime_type, bytes)) return failure("MIME_MISMATCH");

    let scanResult: "APPROVED" | "REJECTED";
    try {
      const scope: StorageScope = cloneScope(context.scope);
      scanResult = this.storage.put(scope, fileId, {
        bytes,
        mimeType: recordResult.data.mime_type,
        checksum: recordResult.data.checksum,
      });
    } catch {
      return failure("STORAGE_UNAVAILABLE");
    }

    const scanning: InternalFileRecord = {
      ...recordResult.data,
      scan_state: "SCANNING",
      updated_at: this.now().toISOString(),
    };
    const completed: InternalFileRecord = {
      ...scanning,
      scan_state: scanResult,
      updated_at: this.now().toISOString(),
    };
    this.records.set(scopeKey(context.scope, fileId), completed);
    this.recordsById.set(fileId, completed);
    intent.consumed = true;
    this.emitAuditEvent(
      scanResult === "APPROVED" ? "UPLOAD_APPROVED" : "UPLOAD_REJECTED",
      context,
      fileId,
    );
    return { ok: true, data: projectFile(completed) };
  }

  public issueReadLink(
    context: FileActorContext,
    fileId: string,
  ): FileResult<FileReadLinkProjection> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    const recordResult = this.resolveRecord(context.scope, fileId);
    if (!recordResult.ok) return recordResult;
    if (recordResult.data.scan_state !== "APPROVED") return failure("SCAN_NOT_APPROVED");
    const token = `read:${randomUUID()}`;
    const expiresAt = this.now().getTime() + READ_LINK_TTL_MS;
    this.readLinks.set(token, {
      file_id: fileId,
      token,
      scope: cloneScope(context.scope),
      expires_at: expiresAt,
    });
    this.emitAuditEvent("READ_LINK_ISSUED", context, fileId);
    return {
      ok: true,
      data: { file_id: fileId, read_link: token, expires_at: new Date(expiresAt).toISOString() },
    };
  }

  public readFile(
    context: FileActorContext,
    fileId: string,
    readToken: string,
  ): FileResult<FileReadProjection> {
    if (!isAuthorized(context)) return failure("FORBIDDEN_SCOPE");
    if (typeof readToken !== "string" || readToken.length === 0) {
      return failure("UNSIGNED_ACCESS");
    }
    const recordResult = this.resolveRecord(context.scope, fileId);
    if (!recordResult.ok) return recordResult;
    if (recordResult.data.scan_state !== "APPROVED") return failure("SCAN_NOT_APPROVED");
    const link = this.readLinks.get(readToken);
    if (link === undefined || link.file_id !== fileId || !sameScope(link.scope, context.scope)) {
      return failure("READ_LINK_INVALID");
    }
    if (this.now().getTime() >= link.expires_at) return failure("READ_LINK_EXPIRED");
    const object = this.storage.read(context.scope, fileId);
    if (object === undefined) return failure("STORAGE_UNAVAILABLE");
    this.emitAuditEvent("FILE_READ", context, fileId);
    return {
      ok: true,
      data: {
        file_id: fileId,
        bytes: cloneBytes(object.bytes),
        mime_type: recordResult.data.mime_type,
        checksum: recordResult.data.checksum,
      },
    };
  }

  private resolveRecord(scope: FileScope, fileId: string): FileResult<InternalFileRecord> {
    if (!isFileId(fileId)) return failure("VALIDATION_FAILED");
    const record = this.records.get(scopeKey(scope, fileId));
    if (record !== undefined) return { ok: true, data: record };
    return this.recordsById.has(fileId) ? failure("FORBIDDEN_SCOPE") : failure("NOT_FOUND_SCOPED");
  }

  private emitAuditEvent(
    eventType: FileAuditEvent["eventType"],
    context: FileActorContext,
    fileId: string,
    eventTime = this.now(),
  ): void {
    this.onAuditEvent({
      eventType,
      tenantId: context.scope.tenantId,
      campusId: context.scope.campusId,
      fileId,
      actorReference: context.actorId,
      eventTime: eventTime.toISOString(),
    });
  }
}
