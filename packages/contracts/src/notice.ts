export const NOTICE_TEMPLATES = ["INSTITUTION_ANNOUNCEMENT", "CLASS_ACTIVITY"] as const;
export type NoticeTemplate = (typeof NOTICE_TEMPLATES)[number];

export const NOTICE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "PUBLISHED",
  "REVOKED",
] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

export type NoticeTarget = "INSTITUTION" | "CLASS";
export type NoticeReceiptStatus = "UNREAD" | "READ" | "ACKNOWLEDGED";

/** Shared local-synthetic notice projection. It never represents real delivery. */
export interface NoticeProjection {
  readonly id: string;
  readonly version: number;
  readonly status: NoticeStatus;
  readonly published: boolean;
  readonly title: string;
  readonly body: string;
  readonly target: NoticeTarget;
  readonly classId: string;
  readonly requiresAcknowledgment: boolean;
  readonly receiptStatus: NoticeReceiptStatus;
  readonly synthetic_data: true;
}
