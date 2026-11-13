import type { SuccessEnvelope } from "./errors.js";

export const CONTENT_TYPES = [
  "INSTITUTION",
  "HOME_BLOCK",
  "PUBLIC_TEACHER",
  "ACTIVITY",
  "MEAL",
  "GUIDE",
  "RESOURCE",
  "PARTNER_LINK",
] as const;

export const CONTENT_STATUSES = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const;
export const CONTENT_VISIBILITIES = ["PUBLIC", "MEMBERS", "STAFF", "ADMIN"] as const;
export const BLOCK_KINDS = ["TEXT", "HEADING", "IMAGE_REF", "LINK_REF", "LIST"] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type ContentVisibility = (typeof CONTENT_VISIBILITIES)[number];
export type BlockKind = (typeof BLOCK_KINDS)[number];

export type PublicInstitutionRouteKind = "profile" | "home";

export interface PublicInstitutionRouteParameters {
  readonly kind: PublicInstitutionRouteKind;
  readonly contentKey: string;
}

export type InstitutionAdminRouteKind = PublicInstitutionRouteKind;

export interface InstitutionAdminRouteParameters {
  readonly kind: InstitutionAdminRouteKind;
  readonly contentKey: string;
}

export interface ContentBlock {
  readonly kind: BlockKind;
  readonly text: string;
  readonly file_id?: string | null;
  readonly href?: string | null;
}

export interface ContentBody {
  readonly summary: string;
  readonly blocks: readonly ContentBlock[];
}

export interface ContentItem {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id?: string | null;
  readonly type: ContentType;
  readonly status: ContentStatus;
  readonly title: string;
  readonly version: number;
  readonly visibility: ContentVisibility;
  readonly body: ContentBody;
  readonly published_at?: string | null;
  readonly synthetic_data: true;
  readonly created_at?: string;
  readonly updated_at?: string;
}

export interface InstitutionDraftPayload {
  readonly title: string;
  readonly type: "INSTITUTION" | "HOME_BLOCK";
  readonly visibility: ContentVisibility;
  readonly body: ContentBody;
  readonly editor_note?: string;
  readonly moderation_state?: string;
  readonly tenant_admin_note?: string;
  readonly campus_admin_note?: string;
}

export interface InstitutionDraftRequest {
  readonly payload: InstitutionDraftPayload;
  readonly expected_version?: number | null;
}

export interface InstitutionDraftUpdateRequest {
  readonly payload: InstitutionDraftPayload;
  readonly expected_version: number;
}

export interface InstitutionPublicationRequest {
  readonly expected_version: number;
}

export interface InstitutionAdminContentRecord {
  readonly id: string;
  readonly content_key: string;
  readonly tenant_id: string;
  readonly campus_id: string | null;
  readonly type: "INSTITUTION" | "HOME_BLOCK";
  readonly status: ContentStatus;
  readonly title: string;
  readonly version: number;
  readonly visibility: ContentVisibility;
  readonly body: ContentBody;
  readonly published_at: string | null;
  readonly synthetic_data: true;
  readonly editor_note: string;
  readonly moderation_state: string;
  readonly tenant_admin_note: string;
  readonly campus_admin_note: string;
  readonly updated_by: string;
  readonly updated_at: string;
}

export type InstitutionAdminContentEnvelope = SuccessEnvelope<InstitutionAdminContentRecord>;
