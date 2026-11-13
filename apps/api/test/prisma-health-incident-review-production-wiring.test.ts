import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaHealthIncidentReviewService } from "../src/modules/health-incidents/prisma-health-incident-review.service.js";
import { ApiModule } from "../src/nest/api.module.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";
import type { ApiAppOptions } from "../src/nest/api-tokens.js";

test("production API options register Prisma-backed health incident review operations", async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: "postgresql://synthetic@127.0.0.1:55436/synthetic" }),
  });
  try {
    const options = createProductionApiOptions(prisma, []);
    assert.ok(
      options.staffHealthIncidentReviewOperations instanceof PrismaHealthIncidentReviewService,
    );
    assert.strictEqual(
      options.parentHealthIncidentOperations,
      options.staffHealthIncidentReviewOperations,
    );
    assert.equal(options.parentGovernanceOperations, undefined);
    assert.throws(
      () =>
        ApiModule.register({
          parentGovernanceOperations: {} as NonNullable<
            ApiAppOptions["parentGovernanceOperations"]
          >,
          parentHealthIncidentOperations: {} as NonNullable<
            ApiAppOptions["parentHealthIncidentOperations"]
          >,
        }),
      /one operations provider/u,
    );
  } finally {
    await prisma.$disconnect();
  }
});
