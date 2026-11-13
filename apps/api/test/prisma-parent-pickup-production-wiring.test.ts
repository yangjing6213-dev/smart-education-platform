import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaParentPickupService } from "../src/modules/pickup/prisma-parent-pickup.service.js";
import { ApiModule } from "../src/nest/api.module.js";
import { ParentPickupModule } from "../src/nest/parent-pickup.module.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";

test("production options wire persistent pickup authorization and credential operations", () => {
  const options = createProductionApiOptions({} as PrismaClient, []);
  assert.ok(options.parentPickupOperations instanceof PrismaParentPickupService);
  for (const operation of ["issueCredential", "previewCredential", "confirmCredential"] as const)
    assert.equal(typeof options.parentPickupOperations[operation], "function");

  const api = ApiModule.register(options);
  assert.ok(
    api.imports?.some(
      (entry) =>
        typeof entry === "object" && "module" in entry && entry.module === ParentPickupModule,
    ),
  );
  assert.equal(
    api.imports?.some(
      (entry) =>
        typeof entry === "object" &&
        "module" in entry &&
        entry.module.name === "ParentGovernanceModule",
    ),
    false,
  );
});
