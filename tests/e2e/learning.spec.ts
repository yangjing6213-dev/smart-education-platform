import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { evaluateLearningTrace } from "../../scripts/verify-release.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("learning trace rejects skipped hints and guardian summary disclosure", () => {
  const skipped = evaluateLearningTrace({
    role: "guardian",
    attempted: true,
    hintLevels: [0, 2, 3],
    consolidationCount: 1,
    summaryRecipient: "guardian",
    summaryBodyExposed: true,
  });

  assert.equal(skipped.ok, false);
  assert.ok(skipped.blockers.includes("HINT_SEQUENCE_INVALID"));
  assert.ok(skipped.blockers.includes("TEACHER_SUMMARY_EXPOSED_TO_GUARDIAN"));
});

test("learning trace accepts attempt, levels zero through three, and teacher-only summary", () => {
  const result = evaluateLearningTrace({
    role: "teacher",
    attempted: true,
    hintLevels: [0, 1, 2, 3],
    consolidationCount: 1,
    summaryRecipient: "teacher",
    summaryBodyExposed: true,
  });

  assert.deepEqual(result, { ok: true, blockers: [] });
});

test("high-fidelity learning flow contains the locked attempt, hint, and summary guards", () => {
  const source = readFileSync(path.join(root, "prototypes/high-fidelity/scripts/app.js"), "utf8");

  assert.match(source, /!state\.ai\.attempted/u);
  assert.match(source, /layer !== state\.ai\.unlocked/u);
  assert.match(source, /必须先记录学生尝试/u);
  assert.match(source, /家长不接收摘要正文/u);
  assert.match(source, /不调用正式 AI/u);
});
