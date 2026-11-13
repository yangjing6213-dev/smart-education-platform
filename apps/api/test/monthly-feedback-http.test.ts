import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import type { TrustedAuthResult } from "@student-care/auth";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type {
  MonthlyFeedbackContext,
  PrismaMonthlyFeedbackService,
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
  PrismaMonthlyFeedbackService,
  "list" | "create" | "edit" | "submit" | "review" | "publish"
>;
type Report = Extract<Awaited<ReturnType<Operations["create"]>>, { ok: true }>["data"];
type Method = "GET" | "POST" | "PATCH";
type HttpBody = { data?: unknown; error?: { code: string }; request_id?: string };

async function startApi(options: ApiAppOptions = {}) {
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
    identity: { actor_id: ACTOR, display_name: "合成员工" },
    memberships,
  };
}

const routes: {
  path: string;
  method: Method;
  operation: keyof Operations;
  body?: unknown;
  status: number;
}[] = [
  { path: "/staff/monthly-feedback", method: "GET", operation: "list", status: 200 },
  {
    path: "/staff/monthly-feedback",
    method: "POST",
    operation: "create",
    body: { month: "2026-10", supplements },
    status: 201,
  },
  {
    path: `/staff/monthly-feedback/${ID}`,
    method: "PATCH",
    operation: "edit",
    body: { version: 1, supplements },
    status: 200,
  },
  {
    path: `/staff/monthly-feedback/${ID}/submit`,
    method: "POST",
    operation: "submit",
    body: { version: 1 },
    status: 200,
  },
  { path: "/admin/monthly-feedback", method: "GET", operation: "list", status: 200 },
  {
    path: `/admin/monthly-feedback/${ID}/review`,
    method: "POST",
    operation: "review",
    body: { version: 1, action: "CONFIRM" },
    status: 200,
  },
  {
    path: `/admin/monthly-feedback/${ID}/publish`,
    method: "POST",
    operation: "publish",
    body: { version: 1 },
    status: 200,
  },
];

test("monthly feedback HTTP routes validate exact input, trusted scope and error mappings before calling operations", async (t) => {
  const calls: {
    operation: keyof Operations;
    context: MonthlyFeedbackContext;
    id?: string;
    body?: unknown;
  }[] = [];
  const view: Report = {
    id: ID,
    version: 1,
    sourceVersion: 1,
    status: "DRAFT",
    month: "2026-10",
    classRef: "synthetic-class",
    audience: "STAFF_INTERNAL",
    supplements,
    sourceCounts: { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 0, STAFF_DAILY: 0 },
    actions: [],
  };
  let failure:
    "FORBIDDEN_SCOPE" | "VALIDATION_FAILED" | "NOT_FOUND_SCOPED" | "CONFLICT_STATE" | undefined;
  const reply = () =>
    failure
      ? { ok: false as const, error: { code: failure, message: "Synthetic failure" } }
      : { ok: true as const, data: view };
  const operations: Operations = {
    list: async (context) => {
      calls.push({ operation: "list", context });
      return failure
        ? { ok: false, error: { code: failure, message: "Synthetic failure" } }
        : { ok: true, data: { records: [view], canCreate: true } };
    },
    create: async (context, body) => {
      calls.push({ operation: "create", context, body });
      return reply();
    },
    edit: async (context, id, body) => {
      calls.push({ operation: "edit", context, id, body });
      return reply();
    },
    submit: async (context, id, body) => {
      calls.push({ operation: "submit", context, id, body });
      return reply();
    },
    review: async (context, id, body) => {
      calls.push({ operation: "review", context, id, body });
      return reply();
    },
    publish: async (context, id, body) => {
      calls.push({ operation: "publish", context, id, body });
      return reply();
    },
  };
  const membership = (
    campus: string,
    caps: TrustedAuthResult["memberships"][number]["capabilities"],
  ) => ({ tenant_id: TENANT, campus_ids: [campus], status: "ACTIVE" as const, capabilities: caps });
  const sessions: Record<string, TrustedAuthResult> = {
    staff: trusted([membership(EAST, capabilities)]),
    parent: trusted([membership(EAST, ["binding:read"])]),
    mixed: trusted([membership(EAST, capabilities), membership(WEST, ["feedback:read"])]),
    split: trusted([membership(EAST, ["feedback:read"]), membership(WEST, ["feedback:review"])]),
    submitwest: trusted([
      membership(EAST, ["feedback:read"]),
      membership(WEST, ["feedback:submit"]),
    ]),
  };
  const api = await startApi({
    monthlyFeedbackOperations: operations,
    getTrustedAuthResult: (req) => {
      const header = req.headers.authorization;
      return typeof header === "string" ? sessions[header.replace(/^Bearer /u, "")] : undefined;
    },
  });
  try {
    await t.test(
      "all seven routes forward validated bodies and trusted campus scopes",
      async () => {
        for (const route of routes) {
          const before = calls.length;
          const response = await request(api.base, route.path, route.method, "staff", route.body);
          assert.equal(response.status, route.status, route.path);
          assert.equal(calls.length, before + 1);
          const call = calls.at(-1)!;
          assert.equal(call.operation, route.operation);
          assert.deepEqual(
            call.context.scopes.map(({ scope }) => scope),
            [{ actorId: ACTOR, tenantId: TENANT, campusId: EAST }],
          );
          assert.deepEqual(call.body, route.body);
          if (route.path.includes(ID)) assert.equal(call.id, ID);
          assert.equal(typeof response.body.request_id, "string");
          assert.deepEqual(
            response.body.data,
            route.operation === "list" ? { records: [view], canCreate: true } : view,
          );
        }
        for (const month of ["1900-01", "2199-12"])
          assert.equal(
            (
              await request(api.base, "/staff/monthly-feedback", "POST", "staff", {
                month,
                supplements,
              })
            ).status,
            201,
          );
        assert.equal(
          (
            await request(api.base, `/admin/monthly-feedback/${ID}/review`, "POST", "staff", {
              version: 2,
              action: "RETURN",
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "unauthenticated and parent accounts cannot invoke any staff or admin route",
      async () => {
        const before = calls.length;
        for (const route of routes) {
          assert.equal(
            (await request(api.base, route.path, route.method, undefined, route.body)).status,
            401,
          );
          assert.equal(
            (await request(api.base, route.path, route.method, "parent", route.body)).status,
            403,
          );
        }
        assert.equal(calls.length, before);
      },
    );
    await t.test(
      "each action filters capabilities per campus and admin read cannot borrow review from a different campus",
      async () => {
        for (const route of routes) {
          assert.equal(
            (await request(api.base, route.path, route.method, "mixed", route.body)).status,
            route.status,
          );
          const expected =
            route.path === "/staff/monthly-feedback" && route.method === "GET"
              ? [EAST, WEST]
              : [EAST];
          assert.deepEqual(
            calls.at(-1)!.context.scopes.map(({ scope }) => scope.campusId),
            expected,
          );
        }
        const before = calls.length;
        assert.equal(
          (await request(api.base, "/admin/monthly-feedback", "GET", "split")).status,
          403,
        );
        assert.equal(calls.length, before);
        assert.equal(
          (
            await request(api.base, `/staff/monthly-feedback/${ID}/submit`, "POST", "submitwest", {
              version: 1,
            })
          ).status,
          200,
        );
        assert.deepEqual(
          calls.at(-1)!.context.scopes.map(({ scope }) => scope.campusId),
          [WEST],
        );
      },
    );
    await t.test(
      "unknown fields, invalid types, spoofed identity, scope headers and all query parameters are rejected",
      async () => {
        const before = calls.length;
        for (const route of routes) {
          assert.equal(
            (
              await request(
                api.base,
                `${route.path}?unexpected=1`,
                route.method,
                "staff",
                route.body,
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await request(api.base, route.path, route.method, "staff", route.body, {
                "x-campus-id": WEST,
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request(api.base, route.path, route.method, "staff", route.body, {
                "x-actor-id": ACTOR,
              })
            ).status,
            401,
          );
          if (route.body !== undefined)
            assert.equal(
              (
                await request(api.base, route.path, route.method, "staff", {
                  ...(route.body as object),
                  unexpected: true,
                })
              ).status,
              400,
            );
        }
        for (const body of [
          { month: "2026-00", supplements },
          { month: "2026-13", supplements },
          { month: "1899-12", supplements },
          { month: "2200-01", supplements },
          { month: "2026-1", supplements },
          { month: ["2026-10"], supplements },
          { month: "2026-10", supplements: { ...supplements, dailyHabits: ["PROGRESSING"] } },
          { month: "2026-10", supplements: { ...supplements, dailyHabits: "UNKNOWN" } },
          { month: "2026-10", supplements: { ...supplements, extra: "PROGRESSING" } },
          { month: "2026-10" },
        ])
          assert.equal(
            (await request(api.base, "/staff/monthly-feedback", "POST", "staff", body)).status,
            400,
          );
        for (const version of [0, -1, 1.5, "1", [1], Number.MAX_SAFE_INTEGER + 1])
          assert.equal(
            (
              await request(api.base, `/staff/monthly-feedback/${ID}/submit`, "POST", "staff", {
                version,
              })
            ).status,
            400,
          );
        assert.equal(
          (
            await request(api.base, `/staff/monthly-feedback/${ID}`, "PATCH", "staff", {
              version: 1,
              supplements: { ...supplements, dailyHabits: ["PROGRESSING"] },
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(api.base, `/admin/monthly-feedback/${ID}/review`, "POST", "staff", {
              version: 1,
              action: "PUBLISH",
            })
          ).status,
          400,
        );
        for (const route of routes.filter((entry) => entry.path.includes(ID)))
          assert.equal(
            (
              await request(
                api.base,
                route.path.replace(ID, "not-a-uuid"),
                route.method,
                "staff",
                route.body,
              )
            ).status,
            400,
          );
        assert.equal(
          calls.length,
          before,
          "Invalid input must not reach a permissive operation stub.",
        );
      },
    );
    await t.test(
      "service failures preserve their 400, 403, 404 and 409 response meanings",
      async () => {
        for (const [code, status] of [
          ["VALIDATION_FAILED", 400],
          ["FORBIDDEN_SCOPE", 403],
          ["NOT_FOUND_SCOPED", 404],
          ["CONFLICT_STATE", 409],
        ] as const) {
          failure = code;
          const response = await request(
            api.base,
            `/admin/monthly-feedback/${ID}/publish`,
            "POST",
            "staff",
            { version: 1 },
          );
          assert.equal(response.status, status);
          assert.equal(response.body.error?.code, code);
          assert.equal(typeof response.body.request_id, "string");
        }
        failure = undefined;
      },
    );
  } finally {
    await api.close();
  }
});

test("monthly feedback routes are not registered without the operations module", async () => {
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
  "production monthly feedback uses real invited sessions, scoped Prisma persistence and source reapproval",
  { skip: databaseUrl === undefined },
  async () => {
    const adminUrl = new URL(databaseUrl!);
    assert.equal(adminUrl.hostname, "127.0.0.1");
    assert.equal(adminUrl.port, "55444");
    const databaseName = `student_care_a1344_${randomUUID().replaceAll("-", "")}`;
    const isolatedUrl = new URL(adminUrl);
    isolatedUrl.pathname = `/${databaseName}`;
    const newClient = (connectionString: string) =>
      new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const admin = newClient(adminUrl.href);
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
      prisma = newClient(isolatedUrl.href);
      await prisma.$connect();
      const tenantId = randomUUID(),
        campusId = randomUUID(),
        classRef = "synthetic-monthly-class";
      const people = ["writer", "reviewer", "parent"].map((name) => ({
        name,
        userId: randomUUID(),
        membershipId: randomUUID(),
      }));
      const writer = people[0]!,
        reviewer = people[1]!,
        parent = people[2]!;
      await prisma.tenant.create({
        data: { id: tenantId, name: "合成月报机构", slug: `monthly-${tenantId}`, status: "ACTIVE" },
      });
      await prisma.campus.create({
        data: { id: campusId, tenantId, name: "合成校区", status: "ACTIVE" },
      });
      await prisma.user.createMany({
        data: people.map((person) => ({ id: person.userId, status: "ACTIVE" })),
      });
      await prisma.membership.createMany({
        data: people.map((person) => ({
          id: person.membershipId,
          tenantId,
          userId: person.userId,
          status: "ACTIVE",
        })),
      });
      await prisma.membershipCampus.createMany({
        data: people.map((person) => ({ tenantId, campusId, membershipId: person.membershipId })),
      });
      await prisma.membershipClass.createMany({
        data: [writer, reviewer].map((person) => ({
          tenantId,
          campusId,
          membershipId: person.membershipId,
          classRef,
        })),
      });
      const daily = await prisma.staffDailyReport.create({
        data: {
          tenantId,
          campusId,
          id: randomUUID(),
          classRef,
          date: new Date("2026-10-25T00:00:00.000Z"),
          arrival: "ARRIVED_AS_PLANNED",
          homework: "COMPLETED",
          activity: "PARTICIPATED",
          classroom: "ROUTINE",
          followUp: "NONE",
          status: "CONFIRMED",
          createdByMembershipId: writer.membershipId,
          reviewedByMembershipId: reviewer.membershipId,
          updatedByMembershipId: reviewer.membershipId,
        },
      });
      const password = `Synthetic-${randomUUID()}!`;
      const passwordHash = await createInvitePasswordHash(password);
      const accounts: InviteAccountConfiguration[] = people.map((person) => ({
        username: `synthetic.${person.name}`,
        password_hash: passwordHash,
        identity: { actor_id: person.userId, display_name: `合成${person.name}` },
        memberships: [
          {
            tenant_id: tenantId,
            campus_ids: [campusId],
            status: "ACTIVE",
            capabilities:
              person === parent
                ? ["identity:read", "binding:read"]
                : ["identity:read", ...capabilities],
          },
        ],
      }));
      api = await startApi(createProductionApiOptions(prisma, accounts));
      const base = api.base;
      const login = async (name: string) => {
        const response = await request(base, "/identity/login", "POST", undefined, {
          username: `synthetic.${name}`,
          password,
        });
        assert.equal(response.status, 200);
        const token = (response.body.data as { access_token: string }).access_token;
        assert.equal(typeof token, "string");
        return token;
      };
      const writerToken = await login("writer"),
        reviewerToken = await login("reviewer"),
        parentToken = await login("parent");
      assert.equal((await request(base, "/staff/monthly-feedback")).status, 401);
      assert.equal(
        (await request(base, "/staff/monthly-feedback", "GET", parentToken)).status,
        403,
      );
      assert.equal(
        (await request(base, "/admin/monthly-feedback", "GET", parentToken)).status,
        403,
      );
      const act = async (
        path: string,
        method: Method,
        token: string,
        body: unknown,
        expectedStatus = 200,
      ): Promise<Report> => {
        const response = await request(base, path, method, token, body);
        assert.equal(response.status, expectedStatus);
        const report = response.body.data as Report;
        assert.equal(report.audience, "STAFF_INTERNAL");
        assert.doesNotMatch(
          JSON.stringify(report),
          /"(?:tenantId|campusId|sources|createdByMembershipId|reviewedByMembershipId|updatedByMembershipId)"/u,
        );
        return report;
      };
      let report = await act(
        "/staff/monthly-feedback",
        "POST",
        writerToken,
        { month: "2026-10", supplements },
        201,
      );
      assert.equal(report.status, "DRAFT");
      assert.equal(report.sourceCounts.STAFF_DAILY, 1);
      const staffPath = `/staff/monthly-feedback/${report.id}`,
        adminPath = `/admin/monthly-feedback/${report.id}`;
      report = await act(staffPath, "PATCH", writerToken, { version: report.version, supplements });
      report = await act(`${staffPath}/submit`, "POST", writerToken, { version: report.version });
      assert.equal(report.status, "SUBMITTED");
      const list = await request(base, "/admin/monthly-feedback", "GET", reviewerToken);
      assert.equal(list.status, 200);
      assert.equal(
        (list.body.data as { records: Report[] }).records.some((row) => row.id === report.id),
        true,
      );
      assert.equal(
        (
          await request(base, `${adminPath}/review`, "POST", writerToken, {
            version: report.version,
            action: "CONFIRM",
          })
        ).status,
        404,
      );
      report = await act(`${adminPath}/review`, "POST", reviewerToken, {
        version: report.version,
        action: "CONFIRM",
      });
      assert.equal(report.status, "CONFIRMED");
      await prisma.staffDailyReport.updateMany({
        where: { tenantId, campusId, id: daily.id },
        data: { version: { increment: 1 } },
      });
      const stale = await request(base, `${adminPath}/publish`, "POST", reviewerToken, {
        version: report.version,
      });
      assert.equal(stale.status, 409);
      assert.equal(stale.body.error?.code, "CONFLICT_STATE");
      const invalidated = await prisma.monthlyFeedbackReport.findFirstOrThrow({
        where: { tenantId, campusId, id: report.id },
      });
      assert.equal(invalidated.status, "REVIEW_REQUIRED");
      assert.equal(invalidated.reviewedByMembershipId, null);
      assert.equal(invalidated.version, report.version + 1);
      report = await act(staffPath, "PATCH", writerToken, {
        version: invalidated.version,
        supplements,
      });
      report = await act(`${staffPath}/submit`, "POST", writerToken, { version: report.version });
      report = await act(`${adminPath}/review`, "POST", reviewerToken, {
        version: report.version,
        action: "CONFIRM",
      });
      report = await act(`${adminPath}/publish`, "POST", reviewerToken, {
        version: report.version,
      });
      assert.equal(report.status, "PUBLISHED");
      assert.equal(
        (
          await prisma.monthlyFeedbackReport.findFirstOrThrow({
            where: { tenantId, campusId, id: report.id },
          })
        ).status,
        "PUBLISHED",
      );
      await prisma.membership.updateMany({
        where: { tenantId, id: reviewer.membershipId },
        data: { status: "SUSPENDED" },
      });
      assert.equal(
        (await request(base, "/admin/monthly-feedback", "GET", reviewerToken)).status,
        403,
        "An active invited token cannot bypass a revoked database membership.",
      );
      await prisma.inviteAuthSession.updateMany({
        where: { tokenHash: createHash("sha256").update(writerToken).digest("hex") },
        data: { expiresAt: new Date("2000-01-01T00:00:00.000Z") },
      });
      assert.equal(
        (await request(base, "/staff/monthly-feedback", "GET", writerToken)).status,
        401,
      );
    } finally {
      await api?.close();
      await prisma?.$disconnect();
      if (created)
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await admin.$disconnect();
    }
  },
);
