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
      const fastifyUrl = pathToFileURL(
        resolve(root, "node_modules/.pnpm/fastify@5.12.1/node_modules/fastify/fastify.js"),
      ).href;
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
const id = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;

async function login(app: App, profile: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/local/sessions",
    headers: HOST,
    payload: { profile },
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json<{ handle: string }>().handle;
}

function request(app: App, handle: string, method: "GET" | "PATCH", url: string, payload?: object) {
  return app.inject({
    method,
    url,
    headers: { ...HOST, authorization: `Bearer ${handle}` },
    ...(payload ? { payload } : {}),
  });
}

test("membership reads and status changes stay inside the manager campus and role boundary", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const owner = await login(app, "owner-east"),
      teacher = await login(app, "teacher-east"),
      westOwner = await login(app, "owner-west"),
      otherTenantOwner = await login(app, "owner-other-tenant"),
      parent = await login(app, "parent-alpha"),
      platform = await login(app, "platform-admin");

    const listed = await request(app, owner, "GET", "/local/memberships");
    assert.equal(listed.statusCode, 200, listed.body);
    const rows = listed.json<
      {
        actorId: string;
        version: number;
        profile: string;
        role: string;
        status: string;
        capabilities: string[];
        tenantId: string;
        campusId: string;
      }[]
    >();
    assert.ok(rows.some((row) => row.profile === "teacher-east" && row.role === "教师"));
    const teacherRow = rows.find((row) => row.profile === "teacher-east");
    assert.equal(teacherRow?.version, 1);
    assert.ok(teacherRow?.capabilities.includes("请假"));
    assert.ok(teacherRow?.capabilities.includes("成长记录"));
    assert.equal(
      teacherRow?.capabilities.some((capability) => capability.includes(":")),
      false,
    );
    assert.ok(rows.every((row) => row.tenantId === id(100) && row.campusId === id(101)));
    assert.ok(
      rows.every((row) => !row.profile.startsWith("parent-") && row.profile !== "platform-admin"),
    );

    for (const deniedHandle of [teacher, parent, platform])
      assert.equal((await request(app, deniedHandle, "GET", "/local/memberships")).statusCode, 403);
    assert.deepEqual((await request(app, westOwner, "GET", "/local/memberships")).json(), []);
    assert.deepEqual(
      (await request(app, otherTenantOwner, "GET", "/local/memberships")).json(),
      [],
    );

    for (const targetId of [id(1), id(4), id(5), id(6)]) {
      assert.equal(
        (
          await request(app, owner, "PATCH", `/local/memberships/${targetId}`, {
            status: "SUSPENDED",
            version: 1,
          })
        ).statusCode,
        403,
      );
    }
    assert.equal(
      (
        await request(app, westOwner, "PATCH", `/local/memberships/${id(3)}`, {
          status: "SUSPENDED",
          version: 1,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await request(app, otherTenantOwner, "PATCH", `/local/memberships/${id(3)}`, {
          status: "SUSPENDED",
          version: 1,
        })
      ).statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});

test("suspending and revoking a member invalidates old sessions; reactivation needs a new one", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const owner = await login(app, "owner-east"),
      oldTeacher = await login(app, "teacher-east");

    const suspended = await request(app, owner, "PATCH", `/local/memberships/${id(3)}`, {
      status: "SUSPENDED",
      version: 1,
    });
    assert.equal(suspended.statusCode, 200, suspended.body);
    assert.deepEqual((({ status, version }) => ({ status, version }))(suspended.json()), {
      status: "SUSPENDED",
      version: 2,
    });
    const staleUpdate = await request(app, owner, "PATCH", `/local/memberships/${id(3)}`, {
      status: "ACTIVE",
      version: 1,
    });
    assert.equal(staleUpdate.statusCode, 409, staleUpdate.body);
    const stillSuspended = await request(app, owner, "GET", "/local/memberships");
    assert.equal(
      stillSuspended
        .json<{ status: string; version: number }[]>()
        .find((row) => row.status === "SUSPENDED")?.version,
      2,
    );
    assert.equal((await request(app, oldTeacher, "GET", "/local/session")).statusCode, 401);
    const audit = await request(app, owner, "GET", "/local/membership-events");
    assert.equal(audit.statusCode, 200, audit.body);
    const events = audit.json<
      {
        actorId: string;
        targetActorId: string;
        fromStatus: string;
        toStatus: string;
        occurredAt: string;
      }[]
    >();
    assert.deepEqual(
      events.map(({ actorId, targetActorId, fromStatus, toStatus }) => ({
        actorId,
        targetActorId,
        fromStatus,
        toStatus,
      })),
      [
        {
          actorId: id(4),
          targetActorId: id(3),
          fromStatus: "ACTIVE",
          toStatus: "SUSPENDED",
        },
      ],
    );
    assert.equal(Number.isNaN(Date.parse(events[0]?.occurredAt ?? "")), false);

    const reactivated = await request(app, owner, "PATCH", `/local/memberships/${id(3)}`, {
      status: "ACTIVE",
      version: 2,
    });
    assert.equal(reactivated.statusCode, 200, reactivated.body);
    assert.equal(reactivated.json<{ version: number }>().version, 3);
    assert.equal((await request(app, oldTeacher, "GET", "/local/session")).statusCode, 401);
    const newTeacher = await login(app, "teacher-east");
    assert.equal((await request(app, newTeacher, "GET", "/local/session")).statusCode, 200);

    const revoked = await request(app, owner, "PATCH", `/local/memberships/${id(3)}`, {
      status: "REVOKED",
      version: 3,
    });
    assert.equal(revoked.statusCode, 200, revoked.body);
    assert.equal((await request(app, newTeacher, "GET", "/local/session")).statusCode, 401);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/local/sessions",
          headers: HOST,
          payload: { profile: "teacher-east" },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await request(app, owner, "PATCH", `/local/memberships/${id(3)}`, {
          status: "ACTIVE",
          version: 4,
        })
      ).statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});

test("membership updates accept only fixed status fields and never collect free text", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const owner = await login(app, "owner-east");
    assert.equal(
      (
        await request(app, owner, "PATCH", `/local/memberships/${id(3)}`, {
          status: "SUSPENDED",
          version: 1,
          reason: "合成自由文本不应被接受",
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await request(app, owner, "PATCH", `/local/memberships/${id(3)}`, {
          status: "INVITED",
          version: 1,
        })
      ).statusCode,
      400,
    );
  } finally {
    await app.close();
  }
});
