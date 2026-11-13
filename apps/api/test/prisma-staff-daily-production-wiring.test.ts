import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaStaffDailyService } from "../src/modules/staff-daily/prisma-staff-daily.service.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";

test("production API options register the Prisma-backed staff daily operations", async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: "postgresql://synthetic@127.0.0.1:55434/synthetic" }),
  });
  try {
    const options = createProductionApiOptions(prisma, []);
    assert.ok(options.staffDailyOperations instanceof PrismaStaffDailyService);
    assert.equal(typeof options.staffDailyOperations.reviewList, "function");
    assert.equal(typeof options.staffDailyOperations.review, "function");
    assert.equal(typeof options.staffDailyOperations.withdraw, "function");
  } finally {
    await prisma.$disconnect();
  }
});
