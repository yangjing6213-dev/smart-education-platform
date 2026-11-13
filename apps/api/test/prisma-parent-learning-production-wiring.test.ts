import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";
import { ApiModule } from "../src/nest/api.module.js";
import { ParentLearningModule } from "../src/nest/parent-learning.module.js";
import { parseInviteAccountsJson } from "../src/nest/invite-auth.service.js";

test("production API options expose Prisma-backed parent learning operations", () => {
  const options = createProductionApiOptions(
    {} as unknown as PrismaClient,
    parseInviteAccountsJson("[]"),
  );

  const parentLearningOperations = options.parentLearningOperations;
  assert.ok(parentLearningOperations);
  assert.equal(typeof parentLearningOperations.parentLearning, "function");
  assert.equal(typeof parentLearningOperations.updateParentLearningControls, "function");
  assert.equal(typeof parentLearningOperations.recordParentLearningContact, "function");
  assert.equal(typeof parentLearningOperations.submitStaffSummary, "function");

  const module = ApiModule.register(options);
  assert.ok(
    module.imports?.some(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "module" in item &&
        item.module === ParentLearningModule,
    ),
  );
});
