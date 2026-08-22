import { z } from "zod";

export const uuidSchema = z
  .string()
  .uuid()
  .refine((value) => value === value.toLowerCase(), "UUID must be lowercase");

export const requestIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const pageSizeSchema = z.number().int().min(1).max(100).default(20);
export const cursorSchema = z.string().max(500);
export const idempotencyKeySchema = z.string().min(16).max(128);
export const ifMatchSchema = z.string().max(80);
export const contentTitleSchema = z.string().min(1).max(120);
export const contentSummarySchema = z.string().max(500);
export const dailyReportNoteSchema = z.string().max(4000);
export const hintLevelSchema = z.number().int().min(0).max(3);
export const consentSchema = z.literal(true);
export const supervisionSchema = z.literal(true);
export const dateTimeSchema = z.string().datetime({ offset: true });
