import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaNoticeService } from "../src/modules/notices/prisma-notice.service.js";
import { ApiModule } from "../src/nest/api.module.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";
import type { ApiAppOptions } from "../src/nest/api-tokens.js";

test("production API options mount Prisma-backed notice operations without duplicate parent routes", async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: "postgresql://synthetic@127.0.0.1:55437/synthetic" }),
  });
  try {
    const options = createProductionApiOptions(prisma, []);
    assert.ok(options.staffNoticeOperations instanceof PrismaNoticeService);
    assert.strictEqual(options.parentNoticeOperations, options.staffNoticeOperations);
    assert.equal(options.parentGovernanceOperations, undefined);
    assert.doesNotThrow(() => ApiModule.register(options));
    assert.throws(
      () =>
        ApiModule.register({
          parentGovernanceOperations: {} as NonNullable<
            ApiAppOptions["parentGovernanceOperations"]
          >,
          parentNoticeOperations: {} as NonNullable<ApiAppOptions["parentNoticeOperations"]>,
        }),
      /one operations provider/u,
    );
  } finally {
    await prisma.$disconnect();
  }
});
