import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { ApiModule } from "../src/nest/api.module.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";
import { resolvePublicCampusScope } from "../src/nest/public-campus-scope.js";

test("production API explicitly supplies persistent meal operations", async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: "postgresql://synthetic@127.0.0.1:55439/synthetic_admin_meals",
    }),
  });
  try {
    const options = createProductionApiOptions(prisma, []);
    assert.equal(options.mealService?.constructor.name, "PrismaMealService");
    assert.equal(
      options.mealPublicationAuditService?.constructor.name,
      "PrismaMealPublicationAuditService",
    );
    assert.doesNotThrow(() => ApiModule.register(options));
    assert.equal(typeof options.getPublicMealScope, "function");
    assert.equal(typeof options.getPublicInstitutionScope, "function");
  } finally {
    await prisma.$disconnect();
  }
});

test("public campus references resolve only one active server-side campus", async () => {
  const matches = [
    {
      tenantId: "00000000-0000-4000-8000-000000000001",
      id: "00000000-0000-4000-8000-000000000002",
      status: "ACTIVE",
      tenant: { status: "ACTIVE" },
    },
  ];
  let queryCount = 0;
  let queryArguments: unknown;
  const prisma = {
    campus: {
      findMany: async (args: unknown) => {
        queryCount += 1;
        queryArguments = args;
        return matches;
      },
    },
  } as unknown as InstanceType<typeof PrismaClient>;
  const request = (query: Record<string, unknown>) => ({ query, headers: {}, params: {} });

  assert.deepEqual(
    await resolvePublicCampusScope(
      prisma,
      request({ public_ref: "campus-east", date: "2026-10-22" }),
    ),
    {
      tenantId: "00000000-0000-4000-8000-000000000001",
      campusId: "00000000-0000-4000-8000-000000000002",
    },
  );
  assert.deepEqual(queryArguments, {
    where: { publicProfileRef: "campus-east" },
    select: { tenantId: true, id: true, status: true, tenant: { select: { status: true } } },
    take: 2,
  });
  assert.equal(
    await resolvePublicCampusScope(
      prisma,
      request({ public_ref: "campus-east", tenant_id: "forged" }),
    ),
    undefined,
  );
  assert.equal(await resolvePublicCampusScope(prisma, request({})), undefined);
  assert.equal(queryCount, 1);

  matches.splice(0, 1, {
    tenantId: "00000000-0000-4000-8000-000000000001",
    id: "00000000-0000-4000-8000-000000000002",
    status: "INACTIVE",
    tenant: { status: "ACTIVE" },
  });
  assert.equal(
    await resolvePublicCampusScope(prisma, request({ public_ref: "campus-east" })),
    undefined,
  );

  matches.splice(0, 1, {
    tenantId: "00000000-0000-4000-8000-000000000001",
    id: "00000000-0000-4000-8000-000000000002",
    status: "ACTIVE",
    tenant: { status: "INACTIVE" },
  });
  assert.equal(
    await resolvePublicCampusScope(prisma, request({ public_ref: "campus-east" })),
    undefined,
  );

  matches.push({
    tenantId: "00000000-0000-4000-8000-000000000003",
    id: "00000000-0000-4000-8000-000000000004",
    status: "INACTIVE",
    tenant: { status: "INACTIVE" },
  });
  assert.equal(
    await resolvePublicCampusScope(prisma, request({ public_ref: "campus-east" })),
    undefined,
  );
});
