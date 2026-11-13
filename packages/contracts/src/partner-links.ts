export const PARTNER_LINK_PUBLICATION_STATUSES = ["DRAFT", "PUBLISHED", "UNPUBLISHED"] as const;
export type PartnerLinkPublicationStatus = (typeof PARTNER_LINK_PUBLICATION_STATUSES)[number];

export const PARTNER_LINK_ENABLED_STATUSES = ["ENABLED", "DISABLED"] as const;
export type PartnerLinkEnabledStatus = (typeof PARTNER_LINK_ENABLED_STATUSES)[number];

export interface PartnerLinkProjectionDto {
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

export interface PartnerLinkEntryProjectionDto extends PartnerLinkProjectionDto {
  readonly handoffToken: string;
  readonly expiresAt: string;
}

export interface PartnerLinkSearchEnvelopeDto {
  readonly data: readonly PartnerLinkProjectionDto[];
  readonly request_id: string;
}

export interface PartnerLinkEntryEnvelopeDto {
  readonly data: PartnerLinkEntryProjectionDto;
  readonly request_id: string;
}
