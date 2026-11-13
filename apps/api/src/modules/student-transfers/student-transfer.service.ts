import type {
  StudentTransferCreateInput,
  StudentTransferReviewInput,
} from "@student-care/contracts";

export interface StudentTransferContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}
export interface StudentTransferOperations {
  list(context: StudentTransferContext): Promise<unknown>;
  create(context: StudentTransferContext, input: unknown): Promise<unknown>;
  review(context: StudentTransferContext, id: string, input: unknown): Promise<unknown>;
}
export class StudentTransferFailure extends Error {
  public constructor(
    public readonly code:
      "VALIDATION_FAILED" | "FORBIDDEN_SCOPE" | "NOT_FOUND_SCOPED" | "CONFLICT_STATE",
    public readonly statusCode: 400 | 403 | 404 | 409,
  ) {
    super(code);
  }
}
export const TRANSFER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export function parseTransferCreate(value: unknown): StudentTransferCreateInput {
  if (
    !exact(value, ["student_id", "destination_class_ref"]) ||
    typeof value.student_id !== "string" ||
    !TRANSFER_UUID.test(value.student_id) ||
    typeof value.destination_class_ref !== "string" ||
    value.destination_class_ref.length > 80 ||
    value.destination_class_ref.trim() !== value.destination_class_ref ||
    !value.destination_class_ref ||
    /[\p{Cc}\p{Cf}]/u.test(value.destination_class_ref)
  )
    throw new StudentTransferFailure("VALIDATION_FAILED", 400);
  return {
    student_id: value.student_id.toLowerCase(),
    destination_class_ref: value.destination_class_ref,
  };
}
export function parseTransferReview(value: unknown): StudentTransferReviewInput {
  if (
    !exact(value, ["expected_version", "decision"]) ||
    !Number.isSafeInteger(value.expected_version) ||
    Number(value.expected_version) < 1 ||
    Number(value.expected_version) >= 2_147_483_647 ||
    (value.decision !== "APPROVE" && value.decision !== "REJECT")
  )
    throw new StudentTransferFailure("VALIDATION_FAILED", 400);
  return { expected_version: Number(value.expected_version), decision: value.decision };
}
