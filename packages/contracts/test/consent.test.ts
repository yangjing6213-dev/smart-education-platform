import assert from "node:assert/strict";
import test from "node:test";
import type { ConsentPurposeDefinition, ConsentPurposeKey } from "../src/consent.js";

test("consent purpose contract keeps the three fixed demo keys", () => {
  const purposeTitles = {
    CARE_RECORD: "成长记录",
    HEALTH_SUPPORT: "健康协助",
    LEARNING_SUPPORT: "学习支持",
  } satisfies Record<ConsentPurposeKey, string>;
  assert.deepEqual(Object.keys(purposeTitles), [
    "CARE_RECORD",
    "HEALTH_SUPPORT",
    "LEARNING_SUPPORT",
  ]);
});

test("learning consent contract pins the synthetic purpose and policy versions", () => {
  const learningVersions = {
    consentVersion: "LEARNING_DEMO_V2",
    policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1",
  } satisfies Pick<ConsentPurposeDefinition, "consentVersion" | "policyVersion">;
  assert.deepEqual(learningVersions, {
    consentVersion: "LEARNING_DEMO_V2",
    policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1",
  });
});
