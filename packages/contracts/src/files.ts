export type FilePurpose = "ACTIVITY_MEDIA" | "GUIDE_ATTACHMENT" | "INSTITUTION_MEDIA";

export type FileMimeType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export type FileScanState = "PENDING" | "SCANNING" | "APPROVED" | "REJECTED";

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

export interface FileUploadIntentRequest {
  readonly declared_purpose: FilePurpose;
  readonly mime_type: FileMimeType;
  readonly size_bytes: number;
  readonly checksum: string;
}

export interface FileCompleteRequest {
  readonly upload_intent: string;
  readonly bytes_base64: string;
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
  readonly bytes_base64: string;
  readonly mime_type: FileMimeType;
  readonly checksum: string;
}

export interface FileEnvelope<T> {
  readonly data: T;
  readonly request_id: string;
}

export interface FileErrorEnvelope {
  readonly error: { readonly code: FileErrorCode; readonly message: string };
  readonly request_id: string;
}
