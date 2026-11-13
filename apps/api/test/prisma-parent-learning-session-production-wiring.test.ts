import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaParentLearningSessionService } from "../src/modules/learning/prisma-parent-learning-session.service.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";

test("production API options register the persistent parent learning session service", () => {
  const options = createProductionApiOptions({} as PrismaClient, []);
  assert.ok(options.parentLearningSessionOperations instanceof PrismaParentLearningSessionService);
  assert.equal(typeof options.parentLearningSessionOperations?.createSession, "function");
  assert.equal(typeof options.parentLearningSessionOperations?.answerSession, "function");
});
