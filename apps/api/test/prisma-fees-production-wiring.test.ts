import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { ApiModule } from "../src/nest/api.module.js";
import { FEES_OPERATIONS } from "../src/nest/api-tokens.js";
import { FeesModule } from "../src/nest/fees.module.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";

test("production API registers scoped persistent fee operations without granting capabilities", async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: "postgresql://synthetic@127.0.0.1:55440/task20_a1313_fees" }),
  });
  try {
    const options = createProductionApiOptions(prisma, []);
    assert.equal(options.feesOperations?.constructor.name, "PrismaFeesService");
    const registered = ApiModule.register(options);
    assert.equal(registered.module, ApiModule);
    assert.ok(registered.imports?.some((module) =>
      typeof module === "object" && "module" in module && module.module === FeesModule,
    ));
    const feesModule = FeesModule.register(options);
    assert.ok(feesModule.providers?.some((provider) =>
      typeof provider === "object" && "provide" in provider && provider.provide === FEES_OPERATIONS,
    ));
  } finally {
    await prisma.$disconnect();
  }
});
