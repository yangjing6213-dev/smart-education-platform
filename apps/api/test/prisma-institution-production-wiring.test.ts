import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { ApiModule } from "../src/nest/api.module.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";

test("production API uses the persistent institution content service", () => {
  const options = createProductionApiOptions({} as PrismaClient, []);

  assert.equal(options.institutionService?.constructor.name, "PrismaInstitutionService");
  assert.doesNotThrow(() => ApiModule.register(options));
});
