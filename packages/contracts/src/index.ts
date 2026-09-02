import type { BlockKind, ContentType, ContentVisibility } from "./content.js";

export * from "./content.js";
export * from "./errors.js";
export * from "./identity.js";
export * from "./requests.js";

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
