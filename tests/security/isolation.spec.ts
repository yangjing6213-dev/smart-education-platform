import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type TenantModule = {
  resolveScope(
    input: unknown,
  ):
    | { ok: true; scopeContext: { tenantId: string; campusId?: string } }
    | { ok: false; reason: string };
};

async function loadTenantModule(): Promise<TenantModule> {
  return (await import(
    pathToFileURL(path.join(root, "packages/tenant/dist/src/index.js")).href
  )) as TenantModule;
}

const actorId = "00000000-0000-4000-8000-000000000001";
const tenantId = "00000000-0000-4000-8000-000000000002";
const campusId = "00000000-0000-4000-8000-000000000003";
const foreignTenantId = "00000000-0000-4000-8000-000000000004";
const foreignCampusId = "00000000-0000-4000-8000-000000000005";

test("trusted scope rejects injected tenant and campus identifiers", async () => {
  const { resolveScope } = await loadTenantModule();
  const base = {
    trustedActor: { actorId },
    membership: { tenantId, campusIds: [campusId], status: "ACTIVE" },
  };

  assert.deepEqual(resolveScope({ ...base, requestedTenantId: foreignTenantId }), {
    ok: false,
    reason: "TENANT_SCOPE_MISMATCH",
  });
  assert.deepEqual(
    resolveScope({ ...base, requestedTenantId: tenantId, requestedCampusId: foreignCampusId }),
    { ok: false, reason: "CAMPUS_SCOPE_INVALID" },
  );
  assert.deepEqual(
    resolveScope({ ...base, requestedTenantId: tenantId, requestedCampusId: campusId }),
    {
      ok: true,
      scopeContext: { actorId, tenantId, campusId },
    },
  );
});

test("untrusted client scope claims never become a trusted actor", async () => {
  const { resolveScope } = await loadTenantModule();
  assert.deepEqual(
    resolveScope({
      actor_id: actorId,
      tenant_id: tenantId,
      campus_id: campusId,
      membership: { tenantId, campusIds: [campusId], status: "ACTIVE" },
    }),
    { ok: false, reason: "TRUSTED_PRINCIPAL_MISSING" },
  );
});
