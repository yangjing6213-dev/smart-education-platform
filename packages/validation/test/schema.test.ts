import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  contentBodySchema,
  contentInputSchema,
  contentInputSyntaxSchema,
  contentItemSchema,
  dailyReportInputSchema,
  errorEnvelopeSchema,
  hintInputSchema,
  learningStartInputSchema,
  paginationQuerySchema,
  relationshipInputSchema,
  requestHeadersSchema,
  separateContentInputScope,
  successEnvelopeSchema,
  uuidSchema,
} from "../src/index.js";

const UUID = "00000000-0000-4000-8000-000000000001";

const contentBody = {
  summary: "模拟摘要",
  blocks: [{ kind: "TEXT", text: "模拟正文", file_id: null, href: null }],
} as const;

const contentItem = {
  id: UUID,
  tenant_id: "00000000-0000-4000-8000-000000000002",
  campus_id: null,
  type: "INSTITUTION",
  status: "DRAFT",
  title: "模拟内容",
  version: 1,
  visibility: "PUBLIC",
  body: contentBody,
  synthetic_data: true,
} as const;

function issuePaths(result: ReturnType<typeof contentItemSchema.safeParse>): PropertyKey[][] {
  assert.equal(result.success, false);
  return result.error.issues.map((issue) => issue.path);
}

function rejects(schema: z.ZodTypeAny, value: unknown): void {
  assert.equal(schema.safeParse(value).success, false);
}

test("validation exports schemas", () => {
  assert.equal(uuidSchema.safeParse("not-a-uuid").success, false);
  assert.equal(typeof contentItemSchema.safeParse, "function");
});

test("canonical UUID accepts lowercase standard UUIDs only", () => {
  assert.equal(uuidSchema.safeParse(UUID).success, true);
  assert.equal(uuidSchema.safeParse("00000000-0000-4000-8000-00000000000Z").success, false);
  assert.equal(uuidSchema.safeParse("00000000-0000-4000-8000-00000000000A").success, false);
  assert.equal(uuidSchema.safeParse("00000000000040008000000000000001").success, false);
});

test("request primitive limits and pagination default are executable", () => {
  assert.deepEqual(paginationQuerySchema.parse({}), { page_size: 20 });
  rejects(paginationQuerySchema, { page_size: 0 });
  rejects(paginationQuerySchema, { page_size: 101 });
  rejects(paginationQuerySchema, { cursor: "x".repeat(501) });
  rejects(requestHeadersSchema, { "Idempotency-Key": "x".repeat(15) });
  rejects(requestHeadersSchema, { "Idempotency-Key": "x".repeat(129) });
  rejects(requestHeadersSchema, { "If-Match": "x".repeat(81) });
  rejects(requestHeadersSchema, { "idempotency-key": "x".repeat(16) });
});

test("oversized content and request fields are rejected", () => {
  rejects(contentInputSchema, { type: "INSTITUTION", title: "x".repeat(121), body: contentBody });
  rejects(contentBodySchema, { ...contentBody, summary: "x".repeat(501) });
  rejects(contentBodySchema, {
    ...contentBody,
    blocks: [{ kind: "TEXT", text: "x".repeat(2001) }],
  });
  rejects(contentBodySchema, {
    ...contentBody,
    blocks: Array.from({ length: 31 }, () => ({ kind: "TEXT", text: "模拟" })),
  });
  rejects(contentBodySchema, {
    ...contentBody,
    blocks: [{ kind: "LINK_REF", text: "模拟", href: "x".repeat(501) }],
  });
  rejects(dailyReportInputSchema, { report_id: UUID, note: "x".repeat(4001), version: 1 });
});

test("unknown enum values are rejected", () => {
  rejects(contentInputSchema, { type: "UNKNOWN", title: "模拟", body: contentBody });
  rejects(contentItemSchema, { ...contentItem, status: "UNKNOWN" });
  rejects(contentItemSchema, { ...contentItem, visibility: "UNKNOWN" });
  rejects(contentBodySchema, { ...contentBody, blocks: [{ kind: "UNKNOWN", text: "模拟" }] });
});

test("approved object boundaries reject extra properties", () => {
  const cases: ReadonlyArray<readonly [z.ZodTypeAny, unknown]> = [
    [paginationQuerySchema, { extra: true }],
    [requestHeadersSchema, { extra: true }],
    [
      contentInputSyntaxSchema,
      { type: "INSTITUTION", title: "模拟", body: contentBody, extra: true },
    ],
    [contentInputSchema, { type: "INSTITUTION", title: "模拟", body: contentBody, extra: true }],
    [contentBodySchema, { ...contentBody, extra: true }],
    [contentBodySchema, { summary: "模拟", blocks: [{ kind: "TEXT", text: "模拟", extra: true }] }],
    [dailyReportInputSchema, { report_id: UUID, note: "模拟", version: 1, extra: true }],
    [relationshipInputSchema, { student_id: UUID, consent: true, extra: true }],
    [learningStartInputSchema, { student_id: UUID, supervision: true, extra: true }],
    [hintInputSchema, { session_id: UUID, level: 0, extra: true }],
    [contentItemSchema, { ...contentItem, extra: true }],
    [
      errorEnvelopeSchema,
      { error: { code: "INTERNAL_ERROR", message: "Safe" }, request_id: "req-1", extra: true },
    ],
    [
      errorEnvelopeSchema,
      { error: { code: "INTERNAL_ERROR", message: "Safe", extra: true }, request_id: "req-1" },
    ],
    [successEnvelopeSchema(z.string()), { data: "ok", request_id: "req-1", extra: true }],
  ];

  for (const [schema, value] of cases) rejects(schema, value);
});

test("campus scope is parsed as untrusted syntax and separated from the trusted body", () => {
  const input = { type: "INSTITUTION", title: "模拟", body: contentBody, campus_id: UUID };
  assert.deepEqual(separateContentInputScope(input), {
    body: { type: "INSTITUTION", title: "模拟", body: contentBody },
    untrusted_scope: { campus_id: UUID },
  });
  rejects(contentInputSchema, input);
});

test("consent, supervision, and hint level enforce their locked bounds", () => {
  rejects(relationshipInputSchema, { student_id: UUID });
  rejects(relationshipInputSchema, { student_id: UUID, consent: false });
  rejects(learningStartInputSchema, { student_id: UUID });
  rejects(learningStartInputSchema, { student_id: UUID, supervision: false });
  rejects(hintInputSchema, { session_id: UUID, level: -1 });
  rejects(hintInputSchema, { session_id: UUID, level: 4 });
  rejects(hintInputSchema, { session_id: UUID, level: 1.5 });
});

test("content state, timestamps, and synthetic marker are strict", () => {
  assert.equal(contentItemSchema.safeParse(contentItem).success, true);
  assert.equal(
    contentItemSchema.safeParse({
      ...contentItem,
      status: "PUBLISHED",
      published_at: "2026-08-22T08:00:00Z",
    }).success,
    true,
  );
  assert.deepEqual(
    issuePaths(contentItemSchema.safeParse({ ...contentItem, status: "PUBLISHED" })),
    [["published_at"]],
  );
  assert.deepEqual(
    issuePaths(
      contentItemSchema.safeParse({ ...contentItem, status: "PUBLISHED", published_at: null }),
    ),
    [["published_at"]],
  );
  assert.equal(contentItemSchema.safeParse({ ...contentItem, published_at: null }).success, true);
  assert.deepEqual(
    issuePaths(contentItemSchema.safeParse({ ...contentItem, created_at: "not-a-date-time" })),
    [["created_at"]],
  );
  assert.deepEqual(
    issuePaths(contentItemSchema.safeParse({ ...contentItem, updated_at: "2026-08-22 08:00:00" })),
    [["updated_at"]],
  );
  rejects(contentItemSchema, { ...contentItem, synthetic_data: false });
});

test("error details accept safe scalars and reject unsafe material", () => {
  const valid = {
    error: {
      code: "VALIDATION_FAILED",
      message: "Invalid input",
      details: { field: "title", retryable: false, limit: 120, current: null },
    },
    request_id: "req-synthetic-001",
  };
  assert.equal(errorEnvelopeSchema.safeParse(valid).success, true);
  rejects(errorEnvelopeSchema, { ...valid, error: { ...valid.error, code: "UNKNOWN" } });
  rejects(errorEnvelopeSchema, { ...valid, error: { ...valid.error, message: "x".repeat(501) } });
  rejects(errorEnvelopeSchema, {
    ...valid,
    error: { ...valid.error, details: { stack: "hidden" } },
  });
  rejects(errorEnvelopeSchema, { ...valid, error: { ...valid.error, details: { BadKey: true } } });
  rejects(errorEnvelopeSchema, {
    ...valid,
    error: { ...valid.error, details: { student_free_text: "not allowed" } },
  });
  rejects(errorEnvelopeSchema, {
    ...valid,
    error: { ...valid.error, details: { nested: { value: true } } },
  });
  rejects(errorEnvelopeSchema, { ...valid, error: { ...valid.error, details: { list: [1] } } });
  rejects(errorEnvelopeSchema, {
    ...valid,
    error: { ...valid.error, details: { explanation: "x".repeat(501) } },
  });
  rejects(errorEnvelopeSchema, {
    ...valid,
    error: { ...valid.error, details: { amount: Infinity } },
  });
  rejects(errorEnvelopeSchema, {
    ...valid,
    error: { ...valid.error, details: { amount: Number.NaN } },
  });
  rejects(errorEnvelopeSchema, {
    ...valid,
    error: {
      ...valid.error,
      details: Object.fromEntries(
        Array.from({ length: 21 }, (_, index) => [`field_${index}`, index]),
      ),
    },
  });
});

test("success and error envelopes require deterministic request IDs", () => {
  const successSchema = successEnvelopeSchema(z.object({ value: z.literal("synthetic") }).strict());
  assert.equal(
    successSchema.safeParse({ data: { value: "synthetic" }, request_id: "req-001" }).success,
    true,
  );
  rejects(successSchema, { data: { value: "synthetic" }, request_id: "" });
  rejects(successSchema, { data: { value: "synthetic" }, request_id: "x".repeat(129) });
  rejects(successSchema, { data: { value: "synthetic" }, request_id: "bad request id" });
  const errorResult = errorEnvelopeSchema.safeParse({
    error: { code: "INTERNAL_ERROR", message: "Safe" },
    request_id: "bad request id",
  });
  assert.equal(errorResult.success, false);
  assert.deepEqual(
    errorResult.error.issues.map((issue) => issue.path),
    [["request_id"]],
  );
});
