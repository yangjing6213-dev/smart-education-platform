import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCK_KINDS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  CONTENT_VISIBILITIES,
  ERROR_CODES,
  type ContentItem,
  type ErrorEnvelope,
  type SuccessEnvelope,
} from "../src/index.js";

test("contracts exports stable values", () => {
  assert.deepEqual(CONTENT_TYPES, [
    "INSTITUTION",
    "HOME_BLOCK",
    "PUBLIC_TEACHER",
    "ACTIVITY",
    "MEAL",
    "GUIDE",
    "RESOURCE",
    "PARTNER_LINK",
  ]);
  assert.deepEqual(CONTENT_STATUSES, ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"]);
  assert.deepEqual(CONTENT_VISIBILITIES, ["PUBLIC", "MEMBERS", "STAFF", "ADMIN"]);
  assert.deepEqual(BLOCK_KINDS, ["TEXT", "HEADING", "IMAGE_REF", "LINK_REF", "LIST"]);
  assert.equal(ERROR_CODES.length, 16);
  assert.deepEqual(ERROR_CODES, [
    "UNAUTHENTICATED",
    "FORBIDDEN_ROLE",
    "FORBIDDEN_SCOPE",
    "NOT_FOUND_SCOPED",
    "VALIDATION_FAILED",
    "CONSENT_REQUIRED",
    "CONFLICT_STATE",
    "VERSION_MISMATCH",
    "IDEMPOTENCY_REPLAY_MISMATCH",
    "RATE_LIMITED",
    "FILE_TYPE_REJECTED",
    "FILE_SCAN_PENDING",
    "AI_SAFETY_BLOCKED",
    "PROVIDER_UNAVAILABLE",
    "DELETION_PENDING",
    "INTERNAL_ERROR",
  ]);
});

test("contracts expose source-supported readonly shapes", () => {
  const item = {
    id: "00000000-0000-4000-8000-000000000001",
    tenant_id: "00000000-0000-4000-8000-000000000002",
    type: "INSTITUTION",
    status: "DRAFT",
    title: "模拟内容",
    version: 1,
    visibility: "PUBLIC",
    body: { summary: "模拟摘要", blocks: [] },
    synthetic_data: true,
  } as const satisfies ContentItem;
  const success = {
    data: item,
    request_id: "req-synthetic-001",
  } satisfies SuccessEnvelope<ContentItem>;
  const error = {
    error: { code: "VALIDATION_FAILED", message: "Invalid input" },
    request_id: "req-synthetic-002",
  } satisfies ErrorEnvelope;

  assert.equal(success.data.synthetic_data, true);
  assert.equal(error.error.code, "VALIDATION_FAILED");
});
