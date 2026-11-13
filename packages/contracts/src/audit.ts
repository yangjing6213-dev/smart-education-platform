import type { SuccessEnvelope } from "./errors.js";

export const ADMIN_AUDIT_ACTIONS = Object.freeze([
  "CONTENT_DRAFT_CREATED",
  "CONTENT_DRAFT_UPDATED",
  "CONTENT_PUBLISHED",
  "CONTENT_UNPUBLISHED",
  "FILE_INTENT_CREATED",
  "PARTNER_LINK_HANDOFF_CREATED",
] as const);

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

export interface AdminAuditQueryParameters {
  readonly action?: AdminAuditAction;
  readonly actor_ref?: string;
  readonly target_type?: string;
  readonly target_ref?: string;
  readonly correlation_id?: string;
  readonly trace_id?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: string;
}

export interface AdminAuditMetadata {
  readonly result?: "SUCCESS";
  readonly version?: number;
  readonly status?: "CREATED" | "UPDATED" | "PUBLISHED" | "UNPUBLISHED" | "COMPLETED";
  readonly channel?: "ADMIN_WEB" | "USER_WEB" | "MINI_PROGRAM" | "API";
  readonly operation?:
    | "CREATE"
    | "UPDATE"
    | "PUBLISH"
    | "UNPUBLISH"
    | "CREATE_FILE_INTENT"
    | "CREATE_PARTNER_HANDOFF";
  readonly synthetic_reference?: string;
}

export interface AdminAuditLogRecord {
  readonly event_id: string;
  readonly actor_id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly action: AdminAuditAction;
  readonly target_type: string;
  readonly target_id: string;
  readonly occurred_at: string;
  readonly correlation_id: string;
  readonly trace_id: string;
  readonly metadata: AdminAuditMetadata;
  readonly synthetic_data: true;
}

export type AdminAuditLogsEnvelope = SuccessEnvelope<readonly AdminAuditLogRecord[]>;
