import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";
import { ApiModule } from "../src/nest/api.module.js";
import { LearningInstitutionSettingModule } from "../src/nest/learning-institution-setting.module.js";
import { PrismaLearningInstitutionSettingService } from "../src/modules/learning/prisma-learning-institution-setting.service.js";

test("production institution settings use Prisma and no unconfigured memory fallback", () => {
  const options = createProductionApiOptions({} as PrismaClient, []);
  assert.ok(
    options.learningInstitutionSettingOperations instanceof PrismaLearningInstitutionSettingService,
  );
  const registered = (options: Parameters<typeof ApiModule.register>[0]) =>
    ApiModule.register(options).imports?.some(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "module" in item &&
        item.module === LearningInstitutionSettingModule,
    );
  assert.equal(registered(options), true);
  assert.equal(registered({}), false);
});
