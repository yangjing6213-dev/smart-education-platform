import { z } from "zod";
import { ERROR_CODES } from "@student-care/contracts";
import { requestIdSchema } from "./primitives.js";

const forbiddenDetailKeys = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "stack",
  "stack_trace",
  "sql",
  "query",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "password",
  "credential",
  "credentials",
  "prompt",
  "raw_prompt",
  "reasoning",
  "chain_of_thought",
  "hidden_reasoning",
  "child_content",
  "child_text",
  "student_free_text",
]);

const detailScalar = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]);

export const errorDetailsSchema = z
  .record(z.string(), detailScalar)
  .superRefine((details, context) => {
    const entries = Object.entries(details);
    if (entries.length > 20) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "details has too many fields" });
    }
    for (const [key] of entries) {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "invalid detail key",
        });
      }
      if (forbiddenDetailKeys.has(key.toLowerCase())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "forbidden detail key",
        });
      }
    }
  });

const errorSchema = z
  .object({
    code: z.enum(ERROR_CODES),
    message: z.string().min(1).max(500),
    details: errorDetailsSchema.optional(),
  })
  .strict();

export const errorEnvelopeSchema = z
  .object({
    error: errorSchema,
    request_id: requestIdSchema,
  })
  .strict();

export function successEnvelopeSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z
    .object({
      data: dataSchema,
      request_id: requestIdSchema,
    })
    .strict();
}
