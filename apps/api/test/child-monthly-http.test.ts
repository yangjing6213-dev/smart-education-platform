import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import type { TrustedAuthResult } from "@student-care/auth";
import type { ScopeContext } from "@student-care/tenant";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { PrismaChildMonthlyService } from "../src/modules/monthly-feedback/prisma-child-monthly.service.js";
import type {
  MonthlyFeedbackContext,
  MonthlyFeedbackResult,
} from "../src/modules/monthly-feedback/prisma-monthly-feedback.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import type { ApiAppOptions } from "../src/nest/api-tokens.js";
import {
  createInvitePasswordHash,
  type InviteAccountConfiguration,
} from "../src/nest/invite-auth.service.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";
import { listenOnFetchSafePort } from "./support/fetch-safe-port.js";

const TENANT = "00000000-0000-4000-8000-000000000001";
const EAST = "00000000-0000-4000-8000-000000000002";
const WEST = "00000000-0000-4000-8000-000000000003";
const ACTOR = "00000000-0000-4000-8000-000000000004";
const ID = "00000000-0000-4000-8000-000000000005";
const CHILD = "00000000-0000-4000-8000-000000000006";
const RELATION = "00000000-0000-4000-8000-000000000007";
const WEST_RELATION = "00000000-0000-4000-8000-000000000008";
const OTHER_TENANT = "00000000-0000-4000-8000-000000000009";
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "PROGRESSING",
  familySchoolCollaboration: "FOLLOW_UP",
} as const;
const capabilities = [
  "feedback:read",
  "feedback:create",
  "feedback:submit",
  "feedback:review",
  "feedback:publish",
] as const;
type Operations = Pick<
  PrismaChildMonthlyService,
  "list" | "create" | "edit" | "submit" | "review" | "publish" | "listParent" | "acknowledgeParent"
> & {
  resolveParentScope(
    context: { readonly scopes: readonly ScopeContext[] },
    relationshipId: string,
  ): Promise<MonthlyFeedbackResult<ScopeContext>>;
};
type Report = Extract<Awaited<ReturnType<Operations["create"]>>, { ok: true }>["data"];
type ParentReport = Extract<
  Awaited<ReturnType<Operations["listParent"]>>,
  { ok: true }
>["data"]["records"][number];
type Method = "GET" | "POST" | "PATCH";
type HttpBody = { data?: unknown; error?: { code: string }; request_id?: string };
type TestOptions = ApiAppOptions & { readonly childMonthlyOperations?: Operations };

async function startApi(options: TestOptions = {}) {
  const app = await createApiApp(options);
  try {
    await listenOnFetchSafePort((port) => app.listen(port, "127.0.0.1"));
    const address = app.getHttpServer().address() as AddressInfo;
    return { base: `http://127.0.0.1:${address.port}`, close: () => app.close() };
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function request(
  base: string,
  path: string,
  method: Method = "GET",
  token?: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      connection: "close",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...extraHeaders,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as HttpBody };
}

function trusted(memberships: TrustedAuthResult["memberships"]): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: ACTOR,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: ACTOR, display_name: "模拟数据员工" },
    memberships,
  };
}

const routes: {
  path: string;
  method: Method;
  operation: Exclude<keyof Operations, "resolveParentScope">;
  body?: unknown;
  status: number;
  parent?: boolean;
}[] = [
  { path: "/staff/child-monthly-reports", method: "GET", operation: "list", status: 200 },
  {
    path: "/staff/child-monthly-reports",
    method: "POST",
    operation: "create",
    body: { studentId: CHILD, month: "2026-10", supplements },
    status: 201,
  },
  {
    path: `/staff/child-monthly-reports/${ID}`,
    method: "PATCH",
    operation: "edit",
    body: { version: 1, supplements },
    status: 200,
  },
  {
    path: `/staff/child-monthly-reports/${ID}/submit`,
    method: "POST",
    operation: "submit",
    body: { version: 1 },
    status: 200,
  },
  { path: "/admin/child-monthly-reports", method: "GET", operation: "list", status: 200 },
  {
    path: `/admin/child-monthly-reports/${ID}/review`,
    method: "POST",
    operation: "review",
    body: { version: 1, action: "CONFIRM" },
    status: 200,
  },
  {
    path: `/admin/child-monthly-reports/${ID}/publish`,
    method: "POST",
    operation: "publish",
    body: { version: 1 },
    status: 200,
  },
  {
    path: `/parent/relationships/${RELATION}/monthly-reports`,
    method: "GET",
    operation: "listParent",
    status: 200,
    parent: true,
  },
  {
    path: `/parent/relationships/${RELATION}/monthly-reports/${ID}/ack`,
    method: "POST",
    operation: "acknowledgeParent",
    body: { publicationVersion: 1, relationshipVersion: 1 },
    status: 200,
    parent: true,
  },
];

test("child monthly HTTP rejects untrusted input and preserves membership capability boundaries", async (t) => {
  const calls: {
    operation: keyof Operations;
    context: MonthlyFeedbackContext | ScopeContext | { readonly scopes: readonly ScopeContext[] };
    id?: string;
    relationshipId?: string;
    body?: unknown;
  }[] = [];
  const view: Report = {
    id: ID,
    studentId: CHILD,
    studentLabel: "模拟数据孩子甲",
    classRef: "synthetic-child-class",
    month: "2026-10",
    status: "DRAFT",
    version: 1,
    sourceVersion: 1,
    publicationVersion: 0,
    supplements,
    sourceCounts: { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 1 },
    actions: ["edit", "submit"],
  };
  const parentView: ParentReport = {
    id: ID,
    studentId: CHILD,
    studentLabel: "模拟数据孩子甲",
    month: "2026-10",
    publicationVersion: 1,
    relationshipVersion: 1,
    supplements,
    sourceCounts: { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 1 },
    acknowledged: false,
  };
  let failure:
    "FORBIDDEN_SCOPE" | "VALIDATION_FAILED" | "NOT_FOUND_SCOPED" | "CONFLICT_STATE" | undefined;
  let resolverFailure: typeof failure;
  const failed = () => ({
    ok: false as const,
    error: { code: failure!, message: "Synthetic failure" },
  });
  const reportReply = () => (failure ? failed() : { ok: true as const, data: view });
  const operations: Operations = {
    list: async (context) => {
      calls.push({ operation: "list", context });
      return failure
        ? failed()
        : {
            ok: true,
            data: {
              records: [view],
              students: [{ id: CHILD, displayRef: view.studentLabel, classRef: view.classRef }],
            },
          };
    },
    create: async (context, body) => {
      calls.push({ operation: "create", context, body });
      return reportReply();
    },
    edit: async (context, id, body) => {
      calls.push({ operation: "edit", context, id, body });
      return reportReply();
    },
    submit: async (context, id, body) => {
      calls.push({ operation: "submit", context, id, body });
      return reportReply();
    },
    review: async (context, id, body) => {
      calls.push({ operation: "review", context, id, body });
      return reportReply();
    },
    publish: async (context, id, body) => {
      calls.push({ operation: "publish", context, id, body });
      return reportReply();
    },
    resolveParentScope: async (context, relationshipId) => {
      calls.push({ operation: "resolveParentScope", context, relationshipId });
      if (resolverFailure)
        return { ok: false, error: { code: resolverFailure, message: "Synthetic scope failure" } };
      const scope = context.scopes.find(
        (candidate) => candidate.campusId === (relationshipId === WEST_RELATION ? WEST : EAST),
      );
      return scope
        ? { ok: true, data: scope }
        : {
            ok: false,
            error: { code: "NOT_FOUND_SCOPED", message: "Synthetic missing relationship" },
          };
    },
    listParent: async (context, relationshipId) => {
      calls.push({ operation: "listParent", context, relationshipId });
      return failure ? failed() : { ok: true, data: { records: [parentView] } };
    },
    acknowledgeParent: async (context, relationshipId, id, body) => {
      calls.push({ operation: "acknowledgeParent", context, relationshipId, id, body });
      return failure ? failed() : { ok: true, data: { acknowledged: true } };
    },
  };
  const membership = (
    campusIds: string[],
    caps: TrustedAuthResult["memberships"][number]["capabilities"],
    tenantId = TENANT,
  ) => ({
    tenant_id: tenantId,
    campus_ids: campusIds,
    status: "ACTIVE" as const,
    capabilities: caps,
  });
  const sessions: Record<string, TrustedAuthResult> = {
    staff: trusted([membership([EAST], capabilities)]),
    parent: trusted([membership([EAST], ["binding:read"])]),
    mixed: trusted([membership([EAST], capabilities), membership([WEST], ["feedback:read"])]),
    split: trusted([
      membership([EAST], ["feedback:read"]),
      membership([WEST], ["feedback:review"]),
    ]),
    samecampussplit: trusted([
      membership([EAST], ["feedback:read"]),
      membership([EAST], ["feedback:review"]),
    ]),
    submitwest: trusted([
      membership([EAST], ["feedback:read"]),
      membership([WEST], ["feedback:submit"]),
    ]),
    multicampus: trusted([membership([EAST, WEST], ["binding:read"])]),
    multitenant: trusted([
      membership([EAST], ["binding:read"]),
      membership([WEST], ["binding:read"], OTHER_TENANT),
    ]),
    splitparent: trusted([
      membership([EAST], ["binding:read"]),
      membership([WEST], ["identity:read"]),
    ]),
    nocampus: trusted([membership([], ["binding:read"])]),
    suspended: trusted([{ ...membership([EAST], ["binding:read"]), status: "SUSPENDED" }]),
  };
  const api = await startApi({
    childMonthlyOperations: operations,
    getTrustedAuthResult: (req) => {
      const header = req.headers.authorization;
      return typeof header === "string" ? sessions[header.replace(/^Bearer /u, "")] : undefined;
    },
  });
  try {
    await t.test("all nine routes expose validated data through trusted scopes", async () => {
      for (const route of routes) {
        const before = calls.length;
        const response = await request(
          api.base,
          route.path,
          route.method,
          route.parent ? "parent" : "staff",
          route.body,
        );
        assert.equal(response.status, route.status, route.path);
        assert.equal(calls.length, before + (route.parent ? 2 : 1));
        const call = calls.at(-1)!;
        assert.equal(call.operation, route.operation);
        assert.deepEqual(call.body, route.body);
        assert.equal(typeof response.body.request_id, "string");
        if (route.parent) {
          assert.deepEqual(call.context, { actorId: ACTOR, tenantId: TENANT, campusId: EAST });
          assert.equal(call.relationshipId, RELATION);
          assert.deepEqual(
            response.body.data,
            route.operation === "listParent" ? { records: [parentView] } : { acknowledged: true },
          );
        } else {
          assert.deepEqual(
            (call.context as MonthlyFeedbackContext).scopes.map(({ scope }) => scope),
            [{ actorId: ACTOR, tenantId: TENANT, campusId: EAST }],
          );
          assert.deepEqual(
            response.body.data,
            route.operation === "list"
              ? {
                  records: [view],
                  students: [{ id: CHILD, displayRef: view.studentLabel, classRef: view.classRef }],
                }
              : view,
          );
        }
        if (route.path.includes(ID)) assert.equal(call.id, ID);
      }
    });
    await t.test(
      "unauthenticated callers cannot invoke any route and unrelated capabilities are denied",
      async () => {
        const before = calls.length;
        for (const route of routes) {
          assert.equal(
            (await request(api.base, route.path, route.method, undefined, route.body)).status,
            401,
          );
          assert.equal(
            (
              await request(
                api.base,
                route.path,
                route.method,
                route.parent ? "staff" : "parent",
                route.body,
              )
            ).status,
            403,
          );
        }
        for (const name of ["nocampus", "suspended"])
          for (const route of routes.filter((entry) => entry.parent))
            assert.equal(
              (await request(api.base, route.path, route.method, name, route.body)).status,
              403,
            );
        assert.equal(calls.length, before);
      },
    );
    await t.test(
      "staff actions retain each membership scope without combining read and review grants",
      async () => {
        for (const route of routes.filter((entry) => !entry.parent)) {
          assert.equal(
            (await request(api.base, route.path, route.method, "mixed", route.body)).status,
            route.status,
          );
          assert.deepEqual(
            (calls.at(-1)!.context as MonthlyFeedbackContext).scopes.map(
              ({ scope }) => scope.campusId,
            ),
            route.path === "/staff/child-monthly-reports" && route.method === "GET"
              ? [EAST, WEST]
              : [EAST],
          );
        }
        const before = calls.length;
        for (const name of ["split", "samecampussplit"])
          assert.equal(
            (await request(api.base, "/admin/child-monthly-reports", "GET", name)).status,
            403,
          );
        assert.equal(calls.length, before);
        assert.equal(
          (
            await request(
              api.base,
              `/staff/child-monthly-reports/${ID}/submit`,
              "POST",
              "submitwest",
              { version: 1 },
            )
          ).status,
          200,
        );
        assert.deepEqual(
          (calls.at(-1)!.context as MonthlyFeedbackContext).scopes.map(
            ({ scope }) => scope.campusId,
          ),
          [WEST],
        );
      },
    );
    await t.test(
      "parents resolve authorized tenant-campus pairs without borrowing a different campus grant",
      async () => {
        const path = `/parent/relationships/${WEST_RELATION}/monthly-reports`;
        for (const name of ["multicampus", "multitenant"]) {
          assert.equal((await request(api.base, path, "GET", name)).status, 200);
          const scopes = (calls.at(-2)!.context as { scopes: readonly ScopeContext[] }).scopes;
          assert.deepEqual(scopes, [
            { actorId: ACTOR, tenantId: TENANT, campusId: EAST },
            {
              actorId: ACTOR,
              tenantId: name === "multitenant" ? OTHER_TENANT : TENANT,
              campusId: WEST,
            },
          ]);
          assert.deepEqual(calls.at(-1)!.context, scopes[1]);
        }
        const before = calls.length;
        assert.equal((await request(api.base, path, "GET", "splitparent")).status, 404);
        assert.equal(
          calls.length,
          before + 1,
          "A missing relationship must not call parent listing as a scope probe.",
        );
        assert.equal(calls.at(-1)!.operation, "resolveParentScope");
        assert.deepEqual((calls.at(-1)!.context as { scopes: readonly ScopeContext[] }).scopes, [
          { actorId: ACTOR, tenantId: TENANT, campusId: EAST },
        ]);
      },
    );
    await t.test(
      "strict bodies, UUIDs, months and versions reject extra fields and client scope before persistence",
      async () => {
        const before = calls.length;
        for (const route of routes) {
          const token = route.parent ? "parent" : "staff";
          assert.equal(
            (await request(api.base, `${route.path}?unexpected=1`, route.method, token, route.body))
              .status,
            400,
          );
          for (const header of ["x-campus-id", "x-tenant-id"])
            assert.equal(
              (
                await request(api.base, route.path, route.method, token, route.body, {
                  [header]: WEST,
                })
              ).status,
              400,
            );
          assert.equal(
            (
              await request(api.base, route.path, route.method, token, route.body, {
                "x-actor-id": ACTOR,
              })
            ).status,
            401,
          );
          if (route.body !== undefined) {
            for (const body of [
              null,
              [],
              "invalid",
              { ...(route.body as object), unexpected: true },
              { ...(route.body as object), tenantId: TENANT },
              { ...(route.body as object), actorId: ACTOR },
            ])
              assert.equal(
                (await request(api.base, route.path, route.method, token, body)).status,
                400,
              );
            assert.equal((await request(api.base, route.path, route.method, token)).status, 400);
          }
          for (const id of [ID, RELATION].filter((value) => route.path.includes(value)))
            assert.equal(
              (
                await request(
                  api.base,
                  route.path.replace(id, "not-a-uuid"),
                  route.method,
                  token,
                  route.body,
                )
              ).status,
              400,
            );
        }
        for (const body of [
          { studentId: "not-a-uuid", month: "2026-10", supplements },
          { month: "2026-10", supplements },
          ...["2026-00", "2026-13", "1899-12", "2200-01", "2026-1", ["2026-10"]].map((month) => ({
            studentId: CHILD,
            month,
            supplements,
          })),
          {
            studentId: CHILD,
            month: "2026-10",
            supplements: { ...supplements, dailyHabits: ["PROGRESSING"] },
          },
          {
            studentId: CHILD,
            month: "2026-10",
            supplements: { ...supplements, dailyHabits: "UNKNOWN" },
          },
          {
            studentId: CHILD,
            month: "2026-10",
            supplements: { ...supplements, extra: "PROGRESSING" },
          },
          { studentId: CHILD, month: "2026-10" },
        ])
          assert.equal(
            (await request(api.base, "/staff/child-monthly-reports", "POST", "staff", body)).status,
            400,
          );
        for (const route of routes.filter(
          (entry) => entry.body !== undefined && entry.operation !== "create",
        )) {
          const keys = route.parent ? ["publicationVersion", "relationshipVersion"] : ["version"];
          for (const key of keys)
            for (const version of [0, -1, 1.5, "1", [1], Number.MAX_SAFE_INTEGER + 1])
              assert.equal(
                (
                  await request(
                    api.base,
                    route.path,
                    route.method,
                    route.parent ? "parent" : "staff",
                    { ...(route.body as object), [key]: version },
                  )
                ).status,
                400,
              );
        }
        assert.equal(
          (
            await request(api.base, `/staff/child-monthly-reports/${ID}`, "PATCH", "staff", {
              version: 1,
              supplements: { ...supplements, dailyHabits: ["PROGRESSING"] },
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(api.base, `/admin/child-monthly-reports/${ID}/review`, "POST", "staff", {
              version: 1,
              action: "PUBLISH",
            })
          ).status,
          400,
        );
        assert.equal(
          calls.length,
          before,
          "Rejected input must not reach the scope resolver or business operation.",
        );
      },
    );
    await t.test(
      "service and scope-resolution failures retain their public error status",
      async () => {
        for (const [code, status] of [
          ["VALIDATION_FAILED", 400],
          ["FORBIDDEN_SCOPE", 403],
          ["NOT_FOUND_SCOPED", 404],
          ["CONFLICT_STATE", 409],
        ] as const) {
          failure = code;
          for (const route of routes) {
            const response = await request(
              api.base,
              route.path,
              route.method,
              route.parent ? "parent" : "staff",
              route.body,
            );
            assert.equal(response.status, status);
            assert.equal(response.body.error?.code, code);
            assert.equal(typeof response.body.request_id, "string");
          }
          failure = undefined;
          resolverFailure = code;
          for (const route of routes.filter((entry) => entry.parent)) {
            const before = calls.length;
            const response = await request(
              api.base,
              route.path,
              route.method,
              "parent",
              route.body,
            );
            assert.equal(response.status, status);
            assert.equal(response.body.error?.code, code);
            assert.equal(calls.length, before + 1);
            assert.equal(calls.at(-1)!.operation, "resolveParentScope");
          }
          resolverFailure = undefined;
        }
        failure = undefined;
      },
    );
    await t.test("supported month boundaries and returning a review are accepted", async () => {
      for (const month of ["1900-01", "2199-12"])
        assert.equal(
          (
            await request(api.base, "/staff/child-monthly-reports", "POST", "staff", {
              studentId: CHILD,
              month,
              supplements,
            })
          ).status,
          201,
        );
      assert.equal(
        (
          await request(api.base, `/admin/child-monthly-reports/${ID}/review`, "POST", "staff", {
            version: 1,
            action: "RETURN",
          })
        ).status,
        200,
      );
    });
  } finally {
    await api.close();
  }
});

test("child monthly routes are absent when the operations module is not configured", async () => {
  const api = await startApi();
  try {
    for (const route of routes)
      assert.equal(
        (await request(api.base, route.path, route.method, undefined, route.body)).status,
        404,
      );
  } finally {
    await api.close();
  }
});

const databaseUrl = process.env.DATABASE_URL;
test(
  "production child monthly HTTP persists invited review, cross-campus guardian access and version-bound receipts",
  { skip: databaseUrl === undefined },
  async (t) => {
    const adminUrl = new URL(databaseUrl!);
    assert.equal(adminUrl.hostname, "127.0.0.1");
    assert.equal(adminUrl.port, "55450");
    const databaseName = `student_care_a1350_${randomUUID().replaceAll("-", "")}`;
    const isolatedUrl = new URL(adminUrl);
    isolatedUrl.pathname = `/${databaseName}`;
    const client = (connectionString: string) =>
      new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const admin = client(adminUrl.href);
    let created = false;
    let prisma: PrismaClient | undefined;
    let api: Awaited<ReturnType<typeof startApi>> | undefined;
    try {
      await admin.$connect();
      await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
      created = true;
      const apiDirectory = [resolve(process.cwd(), "apps/api"), process.cwd()].find((path) =>
        existsSync(resolve(path, "prisma/schema.prisma")),
      );
      assert.ok(apiDirectory);
      execFileSync(
        process.execPath,
        [
          "node_modules/prisma/build/index.js",
          "migrate",
          "deploy",
          "--config",
          "prisma7.config.ts",
        ],
        {
          cwd: apiDirectory,
          env: { ...process.env, DATABASE_URL: isolatedUrl.href },
          stdio: "pipe",
        },
      );
      prisma = client(isolatedUrl.href);
      await prisma.$connect();
      const db = prisma;
      const tenantId = randomUUID(),
        east = randomUUID(),
        west = randomUUID();
      const classRef = "synthetic-child-monthly-http-class";
      const person = (campuses: string[], staff = false) => ({
        userId: randomUUID(),
        membershipId: randomUUID(),
        campuses,
        staff,
      });
      const people = {
        writer: person([east], true),
        reviewer: person([east], true),
        westWriter: person([west], true),
        westReviewer: person([west], true),
        parent: person([east, west]),
        restrictedParent: person([east, west]),
        otherParent: person([east]),
      };
      type Person = typeof people.writer;
      await db.tenant.create({
        data: {
          id: tenantId,
          name: "模拟数据月报机构",
          slug: `synthetic-child-http-${tenantId}`,
          status: "ACTIVE",
        },
      });
      await db.campus.createMany({
        data: [east, west].map((id) => ({ id, tenantId, name: "模拟数据校区", status: "ACTIVE" })),
      });
      await db.user.createMany({
        data: Object.values(people).map((p) => ({ id: p.userId, status: "ACTIVE" })),
      });
      await db.membership.createMany({
        data: Object.values(people).map((p) => ({
          id: p.membershipId,
          tenantId,
          userId: p.userId,
          status: "ACTIVE",
        })),
      });
      await db.membershipCampus.createMany({
        data: Object.values(people).flatMap((p) =>
          p.campuses.map((campusId) => ({ tenantId, campusId, membershipId: p.membershipId })),
        ),
      });
      await db.membershipClass.createMany({
        data: Object.values(people)
          .filter((p) => p.staff)
          .flatMap((p) =>
            p.campuses.map((campusId) => ({
              tenantId,
              campusId,
              membershipId: p.membershipId,
              classRef,
            })),
          ),
      });
      const student = (campusId: string, label: string) =>
        db.student.create({
          data: {
            tenantId,
            campusId,
            id: randomUUID(),
            classRef,
            status: "ACTIVE",
            displayRef: label,
          },
        });
      const child = await student(east, "模拟数据孩子甲");
      const peer = await student(east, "模拟数据孩子乙");
      const westChild = await student(west, "模拟数据孩子丙");
      type Child = typeof child;
      const attendance = (target: Child, writer: Person) =>
        db.attendanceRecord.create({
          data: {
            tenantId,
            campusId: target.campusId,
            id: randomUUID(),
            studentId: target.id,
            classRef,
            serviceDate: new Date("2026-10-01T00:00:00.000Z"),
            status: "ARRIVED",
            arrivalTime: "08:30",
            recordedByMembershipId: writer.membershipId,
            updatedByMembershipId: writer.membershipId,
          },
        });
      const source = await attendance(child, people.writer);
      await attendance(peer, people.writer);
      await attendance(westChild, people.westWriter);
      const relationship = async (target: Child, guardian: Person) => {
        const reviewer = target.campusId === east ? people.reviewer : people.westReviewer;
        const application = await db.bindingApplication.create({
          data: {
            tenantId,
            campusId: target.campusId,
            id: randomUUID(),
            applicantUserId: guardian.userId,
            onboardingScopeRef: randomUUID(),
            studentCandidateRef: target.id,
            status: "APPROVED",
            reviewedByMembershipId: reviewer.membershipId,
            reviewedAt: new Date(),
          },
        });
        return db.guardianRelationship.create({
          data: {
            tenantId,
            campusId: target.campusId,
            id: randomUUID(),
            bindingApplicationId: application.id,
            guardianUserId: guardian.userId,
            studentId: target.id,
            status: "ACTIVE",
            version: 1,
            approvedByMembershipId: reviewer.membershipId,
            approvedAt: new Date(),
          },
        });
      };
      const relation = await relationship(child, people.parent);
      const westRelation = await relationship(westChild, people.parent);
      const peerRelation = await relationship(peer, people.otherParent);
      const restrictedRelation = await relationship(westChild, people.restrictedParent);
      const password = `Synthetic-${randomUUID()}!`;
      const passwordHash = await createInvitePasswordHash(password);
      const accounts: InviteAccountConfiguration[] = Object.entries(people).map(([name, p]) => ({
        username: `synthetic.${name.toLowerCase()}`,
        password_hash: passwordHash,
        identity: { actor_id: p.userId, display_name: "模拟数据邀请账号" },
        memberships:
          p === people.restrictedParent
            ? [
                {
                  tenant_id: tenantId,
                  campus_ids: [east],
                  status: "ACTIVE",
                  capabilities: ["identity:read", "binding:read"],
                },
                {
                  tenant_id: tenantId,
                  campus_ids: [west],
                  status: "ACTIVE",
                  capabilities: ["identity:read"],
                },
              ]
            : [
                {
                  tenant_id: tenantId,
                  campus_ids: p.campuses,
                  status: "ACTIVE",
                  capabilities: p.staff
                    ? ["identity:read", ...capabilities]
                    : ["identity:read", "binding:read"],
                },
              ],
      }));
      api = await startApi(createProductionApiOptions(db, accounts));
      const base = api.base;
      const login = async (name: keyof typeof people) => {
        const response = await request(base, "/identity/login", "POST", undefined, {
          username: `synthetic.${name.toLowerCase()}`,
          password,
        });
        assert.equal(
          response.status,
          200,
          "The synthetic invited account must log in through HTTP.",
        );
        const token = (response.body.data as { access_token: string }).access_token;
        assert.equal(typeof token, "string");
        return token;
      };
      const tokens = {
        writer: await login("writer"),
        reviewer: await login("reviewer"),
        westWriter: await login("westWriter"),
        westReviewer: await login("westReviewer"),
        parent: await login("parent"),
        restrictedParent: await login("restrictedParent"),
        otherParent: await login("otherParent"),
      };
      const parentPath = (relationshipId = relation.id) =>
        `/parent/relationships/${relationshipId}/monthly-reports`;
      const ackPath = (id: string, relationshipId = relation.id) =>
        `${parentPath(relationshipId)}/${id}/ack`;
      const act = async (
        path: string,
        method: Method,
        token: string,
        body: unknown,
        status = 200,
      ): Promise<Report> => {
        const response = await request(base, path, method, token, body);
        assert.equal(response.status, status, `${method} ${path}`);
        assert.doesNotMatch(
          JSON.stringify(response.body.data),
          /"(?:tenantId|campusId|sources|createdByMembershipId|reviewedByMembershipId|updatedByMembershipId)"/u,
        );
        return response.body.data as Report;
      };
      const rows = async (relationshipId = relation.id, token = tokens.parent) => {
        const response = await request(base, parentPath(relationshipId), "GET", token);
        assert.equal(response.status, 200);
        return (response.body.data as { records: ParentReport[] }).records;
      };
      const stored = (id: string, campusId = east) =>
        db.childMonthlyReport.findFirstOrThrow({ where: { tenantId, campusId, id } });
      const receipts = (id: string) =>
        db.childMonthlyReceipt.findMany({
          where: { tenantId, reportId: id },
          orderBy: { guardianRelationshipVersion: "asc" },
        });
      let report: Report;
      let peerReport: Report;
      let westReport: Report;

      await t.test(
        "draft editing, return and independent review publish only the selected child's sources",
        async () => {
          for (const route of routes) {
            assert.equal(
              (await request(base, route.path, route.method, undefined, route.body)).status,
              401,
            );
            assert.equal(
              (
                await request(
                  base,
                  route.path,
                  route.method,
                  route.parent ? tokens.writer : tokens.parent,
                  route.body,
                )
              ).status,
              403,
            );
          }
          const listed = await request(base, "/staff/child-monthly-reports", "GET", tokens.writer);
          assert.equal(listed.status, 200);
          assert.deepEqual(
            (listed.body.data as { students: { id: string }[] }).students.map((s) => s.id).sort(),
            [child.id, peer.id].sort(),
          );
          report = await act(
            "/staff/child-monthly-reports",
            "POST",
            tokens.writer,
            { studentId: child.id, month: "2026-10", supplements },
            201,
          );
          assert.equal(report.status, "DRAFT");
          assert.deepEqual(report.sourceCounts, { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 1 });
          assert.deepEqual(await rows(), []);
          const staffPath = `/staff/child-monthly-reports/${report.id}`;
          const adminPath = `/admin/child-monthly-reports/${report.id}`;
          report = await act(staffPath, "PATCH", tokens.writer, {
            version: report.version,
            supplements,
          });
          report = await act(`${staffPath}/submit`, "POST", tokens.writer, {
            version: report.version,
          });
          assert.equal(report.status, "SUBMITTED");
          assert.equal(
            (
              await request(base, `${adminPath}/review`, "POST", tokens.writer, {
                version: report.version,
                action: "CONFIRM",
              })
            ).status,
            404,
            "Authors cannot approve their own report even with review capability.",
          );
          assert.equal(
            (
              await request(base, `${adminPath}/publish`, "POST", tokens.reviewer, {
                version: report.version,
              })
            ).status,
            409,
          );
          report = await act(`${adminPath}/review`, "POST", tokens.reviewer, {
            version: report.version,
            action: "RETURN",
          });
          assert.equal(report.status, "RETURNED");
          const revised = { ...supplements, dailyHabits: "PROGRESSING" };
          report = await act(staffPath, "PATCH", tokens.writer, {
            version: report.version,
            supplements: revised,
          });
          report = await act(`${staffPath}/submit`, "POST", tokens.writer, {
            version: report.version,
          });
          report = await act(`${adminPath}/review`, "POST", tokens.reviewer, {
            version: report.version,
            action: "CONFIRM",
          });
          assert.equal(report.status, "CONFIRMED");
          assert.deepEqual(await rows(), [], "Review alone must not expose a report to a parent.");
          report = await act(`${adminPath}/publish`, "POST", tokens.reviewer, {
            version: report.version,
          });
          assert.equal(report.status, "PUBLISHED");
          assert.equal(report.publicationVersion, 1);
          const published = await rows();
          assert.equal(published.length, 1);
          assert.deepEqual(
            Object.keys(published[0]!).sort(),
            [
              "id",
              "studentId",
              "studentLabel",
              "month",
              "publicationVersion",
              "relationshipVersion",
              "supplements",
              "sourceCounts",
              "acknowledged",
            ].sort(),
          );
          assert.equal(published[0]!.id, report.id);
          assert.equal(published[0]!.studentId, child.id);
          assert.equal(published[0]!.acknowledged, false);
          assert.deepEqual(published[0]!.supplements, revised);
          for (const hidden of [
            peer.id,
            source.id,
            people.writer.userId,
            people.writer.membershipId,
            tenantId,
            east,
          ])
            assert.equal(JSON.stringify(published).includes(hidden), false);
          const persisted = await stored(report.id);
          assert.equal(persisted.status, "PUBLISHED");
          assert.equal(persisted.reviewedByMembershipId, people.reviewer.membershipId);
          assert.deepEqual(persisted.sources, [
            { kind: "ATTENDANCE_OVERVIEW", id: source.id, date: "2026-10-01", version: 1 },
          ]);
          assert.deepEqual(
            (
              await db.childMonthlyEvent.findMany({
                where: { tenantId, campusId: east, reportId: report.id },
                orderBy: { version: "asc" },
              })
            ).map((event) => event.action),
            ["CREATE", "EDIT", "SUBMIT", "RETURN", "EDIT", "SUBMIT", "CONFIRM", "PUBLISH"],
          );
          const adminList = await request(
            base,
            "/admin/child-monthly-reports",
            "GET",
            tokens.reviewer,
          );
          assert.equal(adminList.status, 200);
          assert.equal((adminList.body.data as { records: Report[] }).records[0]!.id, report.id);
        },
      );

      await t.test(
        "acknowledgements persist once per current relationship and publication version",
        async () => {
          const body = { publicationVersion: 1, relationshipVersion: 1 };
          const first = await request(base, ackPath(report.id), "POST", tokens.parent, body);
          assert.equal(first.status, 200);
          assert.deepEqual(first.body.data, { acknowledged: true });
          const before = await receipts(report.id);
          assert.equal(before.length, 1);
          assert.equal(before[0]!.guardianUserId, people.parent.userId);
          assert.equal(before[0]!.guardianRelationshipId, relation.id);
          assert.equal(before[0]!.studentId, child.id);
          assert.equal(
            (await request(base, ackPath(report.id), "POST", tokens.parent, body)).status,
            200,
          );
          assert.deepEqual(await receipts(report.id), before);
          assert.equal((await rows())[0]!.acknowledged, true);
          assert.equal(
            (
              await request(base, ackPath(report.id), "POST", tokens.parent, {
                publicationVersion: 99,
                relationshipVersion: 1,
              })
            ).status,
            409,
          );
          await db.guardianRelationship.updateMany({
            where: { tenantId, campusId: east, id: relation.id },
            data: { version: { increment: 1 } },
          });
          assert.equal((await rows())[0]!.relationshipVersion, 2);
          assert.equal((await rows())[0]!.acknowledged, false);
          assert.equal(
            (await request(base, ackPath(report.id), "POST", tokens.parent, body)).status,
            409,
          );
          assert.equal(
            (
              await request(base, ackPath(report.id), "POST", tokens.parent, {
                publicationVersion: 1,
                relationshipVersion: 2,
              })
            ).status,
            200,
          );
          assert.equal((await receipts(report.id)).length, 2);
        },
      );

      await t.test(
        "valid cross-campus bindings work while child, campus and capability substitution is rejected",
        async () => {
          peerReport = await act(
            "/staff/child-monthly-reports",
            "POST",
            tokens.writer,
            { studentId: peer.id, month: "2026-10", supplements },
            201,
          );
          westReport = await act(
            "/staff/child-monthly-reports",
            "POST",
            tokens.westWriter,
            { studentId: westChild.id, month: "2026-10", supplements },
            201,
          );
          westReport = await act(
            `/staff/child-monthly-reports/${westReport.id}/submit`,
            "POST",
            tokens.westWriter,
            { version: westReport.version },
          );
          westReport = await act(
            `/admin/child-monthly-reports/${westReport.id}/review`,
            "POST",
            tokens.westReviewer,
            { version: westReport.version, action: "CONFIRM" },
          );
          westReport = await act(
            `/admin/child-monthly-reports/${westReport.id}/publish`,
            "POST",
            tokens.westReviewer,
            { version: westReport.version },
          );
          assert.deepEqual(
            (await rows(westRelation.id)).map((entry) => entry.studentId),
            [westChild.id],
          );
          assert.equal(
            (
              await request(base, ackPath(westReport.id, westRelation.id), "POST", tokens.parent, {
                publicationVersion: 1,
                relationshipVersion: 1,
              })
            ).status,
            200,
          );
          assert.equal((await receipts(westReport.id))[0]!.campusId, west);
          for (const [relationshipId, token] of [
            [relation.id, tokens.otherParent],
            [peerRelation.id, tokens.parent],
            [restrictedRelation.id, tokens.restrictedParent],
          ])
            assert.equal(
              (await request(base, parentPath(relationshipId), "GET", token)).status,
              404,
            );
          for (const id of [peerReport.id, westReport.id])
            assert.equal(
              (
                await request(base, ackPath(id), "POST", tokens.parent, {
                  publicationVersion: 1,
                  relationshipVersion: 2,
                })
              ).status,
              404,
            );
          assert.equal(
            (
              await request(
                base,
                `/staff/child-monthly-reports/${report.id}`,
                "PATCH",
                tokens.westWriter,
                { version: report.version, supplements },
              )
            ).status,
            404,
          );
          for (const [studentId, token] of [
            [child.id, tokens.westWriter],
            [westChild.id, tokens.writer],
          ])
            assert.equal(
              (
                await request(base, "/staff/child-monthly-reports", "POST", token, {
                  studentId,
                  month: "2026-11",
                  supplements,
                })
              ).status,
              404,
            );
          assert.equal(
            (
              await request(base, parentPath(), "GET", tokens.parent, undefined, {
                "x-campus-id": west,
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request(base, ackPath(report.id), "POST", tokens.parent, {
                publicationVersion: 1,
                relationshipVersion: 2,
                tenantId,
              })
            ).status,
            400,
          );
          assert.equal((await receipts(report.id)).length, 2);
          assert.equal((await receipts(peerReport.id)).length, 0);
        },
      );

      await t.test(
        "changed sources hide prior publication and require a new independent review and receipt",
        async () => {
          await db.attendanceRecord.updateMany({
            where: { tenantId, campusId: east, id: source.id },
            data: { version: { increment: 1 } },
          });
          assert.deepEqual(await rows(), []);
          const invalid = await stored(report.id);
          assert.equal(invalid.status, "REVIEW_REQUIRED");
          assert.equal(invalid.reviewedByMembershipId, null);
          assert.equal(invalid.sourceVersion, 2);
          assert.equal(
            (
              await request(base, ackPath(report.id), "POST", tokens.parent, {
                publicationVersion: 1,
                relationshipVersion: 2,
              })
            ).status,
            409,
          );
          report = await act(`/staff/child-monthly-reports/${report.id}`, "PATCH", tokens.writer, {
            version: invalid.version,
            supplements,
          });
          report = await act(
            `/staff/child-monthly-reports/${report.id}/submit`,
            "POST",
            tokens.writer,
            { version: report.version },
          );
          report = await act(
            `/admin/child-monthly-reports/${report.id}/review`,
            "POST",
            tokens.reviewer,
            { version: report.version, action: "CONFIRM" },
          );
          report = await act(
            `/admin/child-monthly-reports/${report.id}/publish`,
            "POST",
            tokens.reviewer,
            { version: report.version },
          );
          assert.equal(report.publicationVersion, 2);
          assert.equal((await rows())[0]!.acknowledged, false);
          assert.equal(
            (
              await request(base, ackPath(report.id), "POST", tokens.parent, {
                publicationVersion: 1,
                relationshipVersion: 2,
              })
            ).status,
            409,
          );
          assert.equal(
            (
              await request(base, ackPath(report.id), "POST", tokens.parent, {
                publicationVersion: 2,
                relationshipVersion: 2,
              })
            ).status,
            200,
          );
          assert.equal((await receipts(report.id)).length, 3);
        },
      );

      await t.test(
        "database member ambiguity, released bindings and expired or revoked sessions fail closed",
        async () => {
          await db.membership.updateMany({
            where: { tenantId, id: people.parent.membershipId },
            data: { status: "SUSPENDED" },
          });
          assert.equal((await request(base, parentPath(), "GET", tokens.parent)).status, 403);
          await db.membership.updateMany({
            where: { tenantId, id: people.parent.membershipId },
            data: { status: "ACTIVE" },
          });
          const duplicate = randomUUID();
          await db.membership.create({
            data: { tenantId, id: duplicate, userId: people.parent.userId, status: "ACTIVE" },
          });
          await db.membershipCampus.create({
            data: { tenantId, campusId: east, membershipId: duplicate },
          });
          assert.equal((await request(base, parentPath(), "GET", tokens.parent)).status, 403);
          assert.equal(
            (
              await request(base, ackPath(report.id), "POST", tokens.parent, {
                publicationVersion: 2,
                relationshipVersion: 2,
              })
            ).status,
            403,
          );
          await db.membership.updateMany({
            where: { tenantId, id: duplicate },
            data: { status: "SUSPENDED" },
          });
          await db.guardianRelationship.updateMany({
            where: { tenantId, campusId: east, id: relation.id },
            data: { status: "RELEASED", releasedAt: new Date(), version: { increment: 1 } },
          });
          assert.equal((await request(base, parentPath(), "GET", tokens.parent)).status, 404);
          assert.equal(
            (
              await request(base, ackPath(report.id), "POST", tokens.parent, {
                publicationVersion: 2,
                relationshipVersion: 2,
              })
            ).status,
            404,
          );
          assert.equal((await receipts(report.id)).length, 3);
          assert.equal(
            (await rows(westRelation.id)).length,
            1,
            "Releasing one child's binding must not release a different campus binding.",
          );
          await db.inviteAuthSession.updateMany({
            where: { tokenHash: createHash("sha256").update(tokens.writer).digest("hex") },
            data: { expiresAt: new Date("2000-01-01T00:00:00.000Z") },
          });
          assert.equal(
            (await request(base, "/staff/child-monthly-reports", "GET", tokens.writer)).status,
            401,
          );
          assert.equal(
            (await request(base, "/identity/logout", "POST", tokens.parent)).status,
            200,
          );
          assert.equal(
            (await request(base, parentPath(westRelation.id), "GET", tokens.parent)).status,
            401,
          );
        },
      );
    } finally {
      try {
        await api?.close();
      } finally {
        await prisma?.$disconnect();
        try {
          if (created)
            await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
        } finally {
          await admin.$disconnect();
        }
      }
    }
  },
);
