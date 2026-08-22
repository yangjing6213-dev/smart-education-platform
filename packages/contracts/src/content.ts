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
