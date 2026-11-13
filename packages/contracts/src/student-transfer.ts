export type StudentTransferStatus = "PENDING" | "APPROVED" | "REJECTED";
export interface StudentTransferCreateInput {
  readonly student_id: string;
  readonly destination_class_ref: string;
}
export interface StudentTransferReviewInput {
  readonly expected_version: number;
  readonly decision: "APPROVE" | "REJECT";
}
export interface StudentTransferAuditDto {
  readonly action: "CREATED" | "APPROVED" | "REJECTED";
  readonly actorId: string;
  readonly version: number;
  readonly occurredAt: string;
}
export interface StudentTransferDto {
  readonly id: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly sourceClassRef: string;
  readonly destinationClassRef: string;
  readonly status: StudentTransferStatus;
  readonly version: number;
  readonly requestedAt: string;
  readonly reviewedAt: string | null;
  readonly isOwnRequest: boolean;
  readonly canReview: boolean;
  readonly canApprove: boolean;
  readonly events: readonly StudentTransferAuditDto[];
}
export interface StudentTransferListing {
  readonly canRequest: boolean;
  readonly canReview: boolean;
  readonly students: readonly {
    readonly id: string;
    readonly label: string;
    readonly classRef: string;
  }[];
  readonly destinationClasses: readonly string[];
  readonly requests: readonly StudentTransferDto[];
}
