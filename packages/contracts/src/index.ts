import type { BlockKind, ContentType, ContentVisibility } from "./content.js";

export * from "./content.js";
export * from "./care-record.js";
export * from "./child-monthly.js";
export * from "./audit.js";
export * from "./attendance.js";
export * from "./consent.js";
export * from "./errors.js";
export * from "./files.js";
export * from "./finance.js";
export * from "./health-incident.js";
export * from "./identity.js";
export * from "./learning-session.js";
export * from "./leave.js";
export * from "./media-asset.js";
export * from "./monthly-feedback.js";
export * from "./notice.js";
export * from "./operational-statistics.js";
export * from "./partner-links.js";
export * from "./requests.js";
export * from "./resource-library.js";
export * from "./staff-daily.js";
export * from "./staff-tasks.js";
export * from "./supply-request.js";
export * from "./student-transfer.js";

export interface PublicContentBlock {
  readonly kind: BlockKind;
  readonly text: string;
  readonly href?: string;
}

export interface PublicContentProjection {
  readonly id: string;
  readonly content_key: string;
  readonly type: ContentType;
  readonly title: string;
  readonly version: number;
  readonly visibility: ContentVisibility;
  readonly summary: string;
  readonly blocks: readonly PublicContentBlock[];
  readonly published_at: string;
}
