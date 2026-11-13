import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CARE_RECORD_ACTIONS } from "../src/care-record.js";

test("care record actions are limited to actions supported by the API", () => {
  assert.deepEqual(CARE_RECORD_ACTIONS, [
    "edit",
    "submit",
    "resubmit",
    "review",
    "publish",
    "withdraw",
    "revoke-publication",
  ]);
});

test("OpenAPI exposes the scoped care-record, attendance, and leave workflows", async () => {
  const document = JSON.parse(
    await readFile(new URL("../openapi/v1.json", import.meta.url), "utf8"),
  ) as { paths?: Record<string, unknown> };
  const paths = document.paths ?? {};

  for (const path of [
    "/staff/care-record-students",
    "/staff/care-records",
    "/staff/care-records/{recordId}/submit",
    "/staff/care-records/{recordId}/review",
    "/staff/care-records/{recordId}/publish",
    "/staff/care-records/{recordId}/withdraw",
    "/staff/care-records/{recordId}/revoke-publication",
    "/parent/care-records",
    "/parent/care-records/{recordId}/receipt",
    "/staff/attendance-records",
    "/staff/leave-requests",
    "/parent/leave-requests",
  ]) {
    assert.ok(paths[path], `OpenAPI path ${path} exists`);
  }
});
