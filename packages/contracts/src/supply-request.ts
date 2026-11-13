export type SupplyRequestCatalogCode =
  "STATIONERY_SET" | "ART_ACTIVITY_SET" | "CLEANING_SET" | "FIRST_AID_SET";
export type SupplyRequestPurposeCode = "CLASS_ACTIVITY" | "DAILY_OPERATION" | "EMERGENCY_STOCK";
export type SupplyRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CONFIRMED"
  | "RETURNED"
  | "READY"
  | "OUT_OF_STOCK"
  | "CANCELLED"
  | "CLAIMED";

export interface SupplyRequestInput {
  readonly catalog: SupplyRequestCatalogCode;
  readonly quantity: number;
  readonly purpose: SupplyRequestPurposeCode;
}

export interface SupplyRequest extends SupplyRequestInput {
  readonly id: string;
  readonly version: number;
  readonly kind: "supplyRequest";
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly status: SupplyRequestStatus;
  readonly createdBy: string;
  readonly reviewedBy: string | null;
  readonly claimedBy: string | null;
  readonly updatedBy: string;
  readonly updatedAt: string;
}
