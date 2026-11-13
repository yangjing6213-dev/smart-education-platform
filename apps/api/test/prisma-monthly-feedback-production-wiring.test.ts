import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMonthlyFeedbackService } from "../src/modules/monthly-feedback/prisma-monthly-feedback.service.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";

test("production API registers persistent monthly feedback operations", async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: "postgresql://synthetic@127.0.0.1:55444/synthetic" }),
  });
  try {
    const options = createProductionApiOptions(prisma, []);
    assert.ok("monthlyFeedbackOperations" in options);
    assert.ok(options.monthlyFeedbackOperations instanceof PrismaMonthlyFeedbackService);
    for (const method of ["list", "create", "edit", "submit", "review", "publish"] as const) {
      assert.equal(typeof options.monthlyFeedbackOperations[method], "function");
    }
  } finally {
    await prisma.$disconnect();
  }
});
