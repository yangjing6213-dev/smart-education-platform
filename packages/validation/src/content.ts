import { z } from "zod";
import {
  BLOCK_KINDS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  CONTENT_VISIBILITIES,
} from "@student-care/contracts";
import {
  contentSummarySchema,
  contentTitleSchema,
  dateTimeSchema,
  uuidSchema,
} from "./primitives.js";

export const contentBlockSchema = z
  .object({
    kind: z.enum(BLOCK_KINDS),
    text: z.string().max(2000),
    file_id: uuidSchema.nullable().optional(),
    href: z.string().max(500).nullable().optional(),
  })
  .strict();

export const contentBodySchema = z
  .object({
    summary: contentSummarySchema,
    blocks: z.array(contentBlockSchema).max(30),
  })
  .strict();

export const contentItemSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    campus_id: uuidSchema.nullable().optional(),
    type: z.enum(CONTENT_TYPES),
    status: z.enum(CONTENT_STATUSES),
    title: contentTitleSchema,
    version: z.number().int().min(1),
    visibility: z.enum(CONTENT_VISIBILITIES),
    body: contentBodySchema,
    published_at: dateTimeSchema.nullable().optional(),
    synthetic_data: z.literal(true),
    created_at: dateTimeSchema.optional(),
    updated_at: dateTimeSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "PUBLISHED" && !value.published_at) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["published_at"],
        message: "published_at is required for published content",
      });
    }
  });
