import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

function findWorkspaceRoot(start: string) {
  let directory = resolve(start);
  while (!existsSync(join(directory, "pnpm-workspace.yaml"))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Could not locate pnpm-workspace.yaml");
    directory = parent;
  }
  return directory;
}

const root = process.env.LOCAL_SYNTHETIC_CORE_ROOT
  ? resolve(process.env.LOCAL_SYNTHETIC_CORE_ROOT)
  : findWorkspaceRoot(fileURLToPath(new URL(".", import.meta.url)));
const workspacePackages: Record<string, string> = {
  "@student-care/auth": "packages/auth/dist/src/index.js",
  "@student-care/contracts": "packages/contracts/dist/src/index.js",
  "@student-care/tenant": "packages/tenant/dist/src/index.js",
  "@student-care/validation": "packages/validation/dist/src/index.js",
  fastify: "node_modules/.pnpm/fastify@5.12.1/node_modules/fastify/fastify.js",
  zod: "node_modules/.pnpm/zod@3.25.76/node_modules/zod/index.js",
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "fastify") {
      const fastifyUrl = pathToFileURL(resolve(root, workspacePackages.fastify ?? "")).href;
      const shim = `data:text/javascript,${encodeURIComponent(`import fastify from ${JSON.stringify(fastifyUrl)}; export default fastify;`)}`;
      return { url: shim, shortCircuit: true };
    }
    const target = workspacePackages[specifier];
    return target
      ? { url: pathToFileURL(resolve(root, target)).href, shortCircuit: true }
      : nextResolve(specifier, context);
  },
});

const { buildLocalSyntheticServer } = await import("../src/local-synthetic/server.js");
const HOST = { host: "127.0.0.1:4317" };
const uuid = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Credential = {
  id: string;
  version: number;
  staffId: string;
  staffLabel: string;
  staffRole: string;
  category: string;
  issueDate: string;
  expiryDate: string;
  expiryStatus: "VALID" | "EXPIRING_SOON" | "EXPIRED";
  responsibleRole: "CAMPUS_OWNER" | "STAFF_MEMBER";
  history: { version: number; expiryDate: string; updatedAt: string }[];
};

async function call(
  app: App,
  handle: string,
  method: "GET" | "POST" | "PATCH",
  url: string,
  body?: object,
) {
  return app.inject({
    method,
    url,
    headers: { ...HOST, ...(handle ? { authorization: `Bearer ${handle}` } : {}) },
    ...(body ? { payload: body } : {}),
  });
}

async function login(app: App, profile: string) {
  const response = await call(app, "", "POST", "/local/sessions", { profile });
  assert.equal(response.statusCode, 201, response.body);
  return response.json<{ handle: string }>().handle;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("credential list and writes use only the trusted manager campus", async () => {
  const now = Date.parse("2099-01-01T12:00:00.000Z");
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", now: () => now });
  try {
    const owner = await login(app, "owner-east");
    const westOwner = await login(app, "owner-west");
    const otherTenantOwner = await login(app, "owner-other-tenant");
    const teacher = await login(app, "teacher-east");
    const parent = await login(app, "parent-alpha");
    const platform = await login(app, "platform-admin");

    assert.equal((await call(app, owner, "GET", "/local/session")).statusCode, 200);
    const east = await call(app, owner, "GET", "/local/staff-credentials");
    assert.equal(east.statusCode, 200, east.body);
    const rows = east.json<Credential[]>();
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(({ staffId }) => staffId).sort(), [uuid(3), uuid(9)].sort());
    assert.ok(rows.every((row) => !("tenantId" in row) && !("campusId" in row)));
    assert.equal(rows.find((row) => row.staffId === uuid(3))?.expiryStatus, "EXPIRING_SOON");
    assert.equal(rows.find((row) => row.staffId === uuid(9))?.expiryStatus, "EXPIRED");

    for (const denied of [teacher, parent, platform])
      assert.equal((await call(app, denied, "GET", "/local/staff-credentials")).statusCode, 403);
    assert.deepEqual((await call(app, westOwner, "GET", "/local/staff-credentials")).json(), []);
    assert.deepEqual(
      (await call(app, otherTenantOwner, "GET", "/local/staff-credentials")).json(),
      [],
    );
    assert.equal(
      (await call(app, owner, "GET", `/local/staff-credentials?campusId=${uuid(102)}`)).statusCode,
      400,
    );
  } finally {
    await app.close();
  }
});

test("fixed-date reminders, create/update history, exact fields, and versions are enforced", async () => {
  const now = Date.parse("2099-01-01T12:00:00.000Z");
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", now: () => now });
  try {
    const owner = await login(app, "owner-east");
    const membershipBefore = await call(app, owner, "GET", "/local/memberships");
    const issueDate = "2098-01-01";
    const today = "2099-01-01";

    for (const [expiryDate, expected] of [
      [today, "EXPIRING_SOON"],
      [addDays(today, 30), "EXPIRING_SOON"],
      [addDays(today, 31), "VALID"],
      [addDays(today, -1), "EXPIRED"],
    ] as const) {
      const created = await call(app, owner, "POST", "/local/staff-credentials", {
        staffId: uuid(7),
        category: "FIRST_AID_TRAINING",
        issueDate,
        expiryDate,
        responsibleRole: "CAMPUS_OWNER",
      });
      assert.equal(created.statusCode, 201, created.body);
      assert.equal(created.json<Credential>().expiryStatus, expected);
    }

    assert.equal(
      (
        await call(app, owner, "POST", "/local/staff-credentials", {
          staffId: uuid(7),
          category: "UNLISTED_CERTIFICATE",
          issueDate,
          expiryDate: addDays(today, 10),
          responsibleRole: "CAMPUS_OWNER",
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await call(app, owner, "POST", "/local/staff-credentials", {
          staffId: uuid(3),
          category: "FIRST_AID_TRAINING",
          issueDate,
          expiryDate: addDays(today, 10),
          responsibleRole: "CAMPUS_OWNER",
          tenantId: uuid(100),
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await call(app, owner, "POST", "/local/staff-credentials", {
          staffId: uuid(3),
          category: "FIRST_AID_TRAINING",
          issueDate: "2099-12-01",
          expiryDate: today,
          responsibleRole: "CAMPUS_OWNER",
        })
      ).statusCode,
      400,
    );

    const westOwner = await login(app, "owner-west");
    const target = (await call(app, owner, "GET", "/local/staff-credentials")).json<
      Credential[]
    >()[0];
    assert.ok(target);
    assert.equal(
      (
        await call(app, westOwner, "PATCH", `/local/staff-credentials/${target.id}`, {
          version: target.version,
          issueDate,
          expiryDate: addDays(today, 20),
          responsibleRole: "STAFF_MEMBER",
        })
      ).statusCode,
      403,
    );

    const updated = await call(app, owner, "PATCH", `/local/staff-credentials/${target.id}`, {
      version: target.version,
      issueDate,
      expiryDate: addDays(today, 20),
      responsibleRole: "STAFF_MEMBER",
    });
    assert.equal(updated.statusCode, 200, updated.body);
    assert.equal(updated.json<Credential>().version, target.version + 1);
    assert.equal(updated.json<Credential>().history.length, 1);
    assert.equal(
      (
        await call(app, owner, "PATCH", `/local/staff-credentials/${target.id}`, {
          version: target.version,
          issueDate,
          expiryDate: addDays(today, 20),
          responsibleRole: "STAFF_MEMBER",
        })
      ).statusCode,
      409,
    );
    assert.deepEqual(
      (await call(app, owner, "GET", "/local/memberships")).json(),
      membershipBefore.json(),
    );
  } finally {
    await app.close();
  }
});
