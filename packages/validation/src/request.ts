import { z } from "zod";
import { CONTENT_TYPES } from "@student-care/contracts";
import {
  contentTitleSchema,
  cursorSchema,
  hintLevelSchema,
  idempotencyKeySchema,
  ifMatchSchema,
  pageSizeSchema,
  uuidSchema,
  consentSchema,
  dailyReportNoteSchema,
  supervisionSchema,
} from "./primitives.js";
import { contentBodySchema } from "./content.js";

export const paginationQuerySchema = z
  .object({
    page_size: pageSizeSchema,
    cursor: cursorSchema.optional(),
  })
  .strict();

export const requestHeadersSchema = z
  .object({
    "Idempotency-Key": idempotencyKeySchema.optional(),
    "If-Match": ifMatchSchema.optional(),
  })
  .strict();

export const contentInputSyntaxSchema = z
  .object({
    type: z.enum(CONTENT_TYPES),
    title: contentTitleSchema,
    body: contentBodySchema,
    campus_id: uuidSchema.nullable().optional(),
  })
  .strict();

export const contentInputSchema = z
  .object({
    type: z.enum(CONTENT_TYPES),
    title: contentTitleSchema,
    body: contentBodySchema,
  })
  .strict();

export function separateContentInputScope(input: unknown) {
  const parsed = contentInputSyntaxSchema.parse(input);
  const { campus_id, ...body } = parsed;
  return {
    body,
    untrusted_scope: campus_id === undefined ? {} : { campus_id },
  } as const;
}

export const dailyReportInputSchema = z
  .object({
    report_id: uuidSchema,
    note: dailyReportNoteSchema,
    version: z.number().int().min(1),
  })
  .strict();

export const relationshipInputSchema = z
  .object({
    student_id: uuidSchema,
    consent: consentSchema,
  })
  .strict();

export const learningStartInputSchema = z
  .object({
    student_id: uuidSchema,
    supervision: supervisionSchema,
  })
  .strict();

export const hintInputSchema = z
  .object({
    session_id: uuidSchema,
    level: hintLevelSchema,
  })
  .strict();
