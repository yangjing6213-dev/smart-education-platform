export type MediaAssetType = "IMAGE" | "DOCUMENT";

export type MediaAssetStatus =
  "AVAILABLE" | "REFERENCED" | "EXPIRED" | "ARCHIVED" | "REVOKED" | "DELETED";

export interface MediaAssetReference {
  readonly id: string;
  readonly label: string;
  readonly kind: "TEACHER_INTRO" | "FAMILY_GUIDE" | "ACTIVITY";
}

export interface MediaAssetView {
  readonly id: string;
  readonly alias: string;
  readonly title: string;
  readonly version: number;
  readonly type: MediaAssetType;
  readonly status: MediaAssetStatus;
  readonly expiresOn: string;
  readonly references: readonly MediaAssetReference[];
}

export interface MediaAssetSummary {
  readonly total: number;
  readonly available: number;
  readonly referenced: number;
  readonly expired: number;
  readonly archived: number;
  readonly revoked: number;
  readonly deleted: number;
}
