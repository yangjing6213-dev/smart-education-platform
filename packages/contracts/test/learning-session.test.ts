import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("OpenAPI declares the trusted fixed-question parent learning session routes", () => {
  const document = JSON.parse(readFileSync("packages/contracts/openapi/v1.json", "utf8")) as {
    paths: Record<string, Record<string, unknown>>;
  };
  const required = [
    "/parent/students/{studentId}/learning-sessions",
    "/parent/learning-sessions/{sessionId}",
    "/parent/learning-sessions/{sessionId}/answer",
    "/parent/learning-sessions/{sessionId}/hint",
    "/parent/learning-sessions/{sessionId}/close",
  ];

  for (const path of required) {
    assert.ok(document.paths[path], `OpenAPI is missing ${path}`);
  }
  assert.ok(document.paths[required[0]!]?.get);
  assert.ok(document.paths[required[0]!]?.post);
  assert.ok(document.paths[required[1]!]?.get);
  assert.ok(document.paths[required[2]!]?.post);
  assert.ok(document.paths[required[3]!]?.post);
  assert.ok(document.paths[required[4]!]?.post);
});
