import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { InviteSession } from "../../apps/mini-program-taro/src/auth/invite-session.ts";
import { mountStaffMonthlyPage } from "../../apps/mini-program-taro/test/helpers/staff-monthly-page-harness.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const apiRuntime =
  process.env.TASK20_API_RUNTIME ??
  join(
    repositoryRoot,
    "artifacts/task20-a1-344-monthly-feedback-http-20261025/api-dist/runtime/src",
  );
assert.ok(isAbsolute(apiRuntime), "TASK20_API_RUNTIME must identify the existing compiled API.");
const [
  { createApiApp },
  { createProductionApiOptions },
  { createInvitePasswordHash },
  { PrismaClient },
] = await Promise.all([
  import(pathToFileURL(join(apiRuntime, "nest/api-app.js")).href),
  import(pathToFileURL(join(apiRuntime, "nest/production-api-options.js")).href),
  import(pathToFileURL(join(apiRuntime, "nest/invite-auth.service.js")).href),
  import(pathToFileURL(join(apiRuntime, "generated/prisma/client.js")).href),
]);

async function waitPage(page, predicate, message) {
  const deadline = Date.now() + 12_000;
  do {
    await page.settle();
    page.render();
    if (predicate()) return;
    await delay(15);
  } while (Date.now() < deadline);
  assert.fail(message);
}

function hasState(page, state) {
  return page.nodes().some((node) => node.props?.["data-monthly-state"] === state);
}

async function waitRow(page, id, status) {
  await waitPage(
    page,
    () =>
      hasState(page, "READY") &&
      page
        .nodes()
        .some(
          (node) =>
            node.props?.["data-monthly-row"] === id &&
            node.props?.["data-monthly-status"] === status,
        ),
    `The real page must display its persisted ${status} report.`,
  );
}

function assertNoRecords(page) {
  assert.equal(
    page.nodes().some((node) => node.props?.["data-monthly-row"]),
    false,
  );
  assert.equal(
    page.nodes().some((node) => node.props?.["data-monthly-form"]),
    false,
  );
}

function invitedClient(baseUrl, trace) {
  const storage = { value: null, clears: 0 };
  const session = new InviteSession({
    baseUrl,
    allowLocalHttp: true,
    sessionStore: {
      load: () => storage.value,
      save: (value) => {
        storage.value = value;
      },
      clear: () => {
        storage.value = null;
        storage.clears += 1;
      },
    },
    request: async (url, options) => {
      const target = new URL(url);
      assert.equal(target.origin, baseUrl, "Only the owned loopback API may receive requests.");
      assert.equal(target.search, "");
      assert.match(
        target.pathname,
        /^\/(?:identity\/(?:login|logout)|me|(?:staff|admin)\/monthly-feedback(?:\/[0-9a-f-]{36}(?:\/(?:submit|review|publish))?)?)$/u,
      );
      const response = await globalThis.fetch(target, {
        method: options.method,
        headers: options.headers,
        ...(options.data === undefined ? {} : { body: JSON.stringify(options.data) }),
        redirect: "error",
        signal: globalThis.AbortSignal.timeout(8000),
      });
      // Keep only synthetic business bodies; never retain passwords, headers or tokens.
      trace.push({
        path: target.pathname,
        method: options.method,
        status: response.status,
        authenticated: typeof options.headers.Authorization === "string",
        ...(target.pathname.includes("monthly-feedback") && options.data !== undefined
          ? { body: globalThis.structuredClone(options.data) }
          : {}),
      });
      return { statusCode: response.status, data: await response.json() };
    },
  });
  return { session, storage };
}

test(
  "A346 real Taro page events use invited API and persistent monthly workflow",
  { timeout: 120_000 },
  async () => {
    assert.ok(process.env.DATABASE_URL, "A loopback synthetic PostgreSQL server is required.");
    const rootUrl = new URL(process.env.DATABASE_URL);
    assert.equal(rootUrl.hostname, "127.0.0.1");
    assert.equal(rootUrl.port, "55446");
    assert.ok(["postgresql:", "postgres:"].includes(rootUrl.protocol));
    const databaseName = `student_care_a1346_${randomUUID().replaceAll("-", "")}`;
    assert.match(databaseName, /^student_care_a1346_[a-f0-9]{32}$/u);
    const isolatedUrl = new URL(rootUrl);
    isolatedUrl.pathname = "/" + databaseName;
    assert.notEqual(isolatedUrl.pathname, rootUrl.pathname);
    const newClient = (connectionString) =>
      new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const adminDatabase = newClient(rootUrl.href);
    let created = false,
      prisma,
      api,
      page;
    try {
      await adminDatabase.$connect();
      await adminDatabase.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
      created = true;
      try {
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
            cwd: join(repositoryRoot, "apps/api"),
            env: { ...process.env, DATABASE_URL: isolatedUrl.href },
            stdio: "pipe",
            windowsHide: true,
          },
        );
      } catch {
        throw new Error(
          "A346 synthetic database migration failed; connection credentials were not logged.",
        );
      }
      prisma = newClient(isolatedUrl.href);
      await prisma.$connect();
      const tenantId = randomUUID(),
        campusId = randomUUID(),
        classRef = "合成月度小程序甲班";
      const month = "2026-09";
      const writer = {
        userId: randomUUID(),
        membershipId: randomUUID(),
        username: "synthetic.taro.writer",
      };
      const reviewer = {
        userId: randomUUID(),
        membershipId: randomUUID(),
        username: "synthetic.taro.reviewer",
      };
      const people = [writer, reviewer];
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: "合成小程序月度机构",
          slug: `monthly-${tenantId}`,
          status: "ACTIVE",
        },
      });
      await prisma.campus.create({
        data: { id: campusId, tenantId, name: "合成小程序校区", status: "ACTIVE" },
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
        data: people.map((person) => ({
          tenantId,
          campusId,
          membershipId: person.membershipId,
          classRef,
        })),
      });
      const daily = await prisma.staffDailyReport.create({
        data: {
          id: randomUUID(),
          tenantId,
          campusId,
          classRef,
          date: new Date(`${month}-01T00:00:00.000Z`),
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
      const accounts = people.map((person) => ({
        username: person.username,
        password_hash: passwordHash,
        identity: {
          actor_id: person.userId,
          display_name: person === writer ? "合成小程序填写员工" : "合成审核负责人",
        },
        memberships: [
          {
            tenant_id: tenantId,
            campus_ids: [campusId],
            status: "ACTIVE",
            capabilities: [
              "identity:read",
              "memberships:read",
              "feedback:read",
              ...(person === writer
                ? ["feedback:create", "feedback:submit"]
                : ["feedback:review", "feedback:publish"]),
            ],
          },
        ],
      }));
      api = await createApiApp(createProductionApiOptions(prisma, accounts));
      await api.listen(0, "127.0.0.1");
      const address = api.getHttpServer().address();
      assert.ok(address && typeof address !== "string");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const writerTrace = [],
        reviewerTrace = [];
      const employee = invitedClient(baseUrl, writerTrace),
        owner = invitedClient(baseUrl, reviewerTrace);
      await employee.session.login(writer.username, password);
      await owner.session.login(reviewer.username, password);
      assert.equal(employee.session.snapshot.status, "READY");
      assert.equal(owner.session.snapshot.status, "READY");
      assert.deepEqual(
        employee.session.snapshot.roles,
        ["STAFF"],
        "Monthly capabilities alone identify an employee, never a parent.",
      );
      assert.equal(employee.session.snapshot.canReadMonthlyFeedback, true);
      assert.equal(employee.session.snapshot.canWriteCareRecords, false);
      page = await mountStaffMonthlyPage({ session: employee.session });
      await waitPage(
        page,
        () => hasState(page, "READY"),
        "An invited employee must enter the actual monthly page.",
      );
      page.change("month", month);
      page.change("learningParticipation", 1);
      page.change("dailyHabits", 0);
      page.change("activityParticipation", 2);
      page.change("familySchoolCollaboration", 1);
      page.click("保存总结草稿");
      await waitPage(
        page,
        () =>
          hasState(page, "READY") && page.nodes().some((node) => node.props?.["data-monthly-row"]),
        "The saved draft must return to the actual page.",
      );
      let report = await prisma.monthlyFeedbackReport.findFirstOrThrow({
        where: { tenantId, campusId, classRef, month },
      });
      const reportId = report.id;
      let version = 1;
      await waitRow(page, reportId, "DRAFT");
      assert.equal(report.version, version);
      assert.equal(report.createdByMembershipId, writer.membershipId);
      assert.equal(report.learningParticipation, "PROGRESSING");
      assert.equal(report.dailyHabits, "KEEP_WATCHING");
      assert.equal(report.activityParticipation, "FOLLOW_UP");
      assert.equal(report.familySchoolCollaboration, "PROGRESSING");
      assert.deepEqual(
        writerTrace.find(
          ({ method, path }) => method === "POST" && path === "/staff/monthly-feedback",
        ).body,
        {
          month,
          supplements: {
            learningParticipation: "PROGRESSING",
            dailyHabits: "KEEP_WATCHING",
            activityParticipation: "FOLLOW_UP",
            familySchoolCollaboration: "PROGRESSING",
          },
        },
      );

      page.click("编辑草稿");
      page.change("dailyHabits", 2);
      assert.equal(page.button("提交负责人审核").props.disabled, true);
      const beforeGuard = writerTrace.length;
      page.button("提交负责人审核").props.onClick();
      await page.settle();
      assert.equal(
        writerTrace.length,
        beforeGuard,
        "Even a direct event cannot submit unsaved edits.",
      );
      page.click("保存修改");
      await waitRow(page, reportId, "DRAFT");
      version += 1;
      assert.equal(
        (await prisma.monthlyFeedbackReport.findFirstOrThrow({ where: { id: reportId } })).version,
        version,
      );
      page.click("提交负责人审核");
      await waitRow(page, reportId, "SUBMITTED");
      version += 1;
      let response = await owner.session.postAuthenticated(
        `/admin/monthly-feedback/${reportId}/review`,
        { version, action: "RETURN" },
      );
      assert.equal(response.status, "RETURNED");
      assert.equal(response.version, ++version);
      page.click("刷新");
      await waitRow(page, reportId, "RETURNED");
      assert.equal(page.button("提交负责人审核"), undefined);
      page.click("核对并修改");
      page.change("activityParticipation", 1);
      page.click("保存修改");
      await waitRow(page, reportId, "DRAFT");
      version += 1;
      page.click("提交负责人审核");
      await waitRow(page, reportId, "SUBMITTED");
      version += 1;
      response = await owner.session.postAuthenticated(
        `/admin/monthly-feedback/${reportId}/review`,
        { version, action: "CONFIRM" },
      );
      assert.equal(response.status, "CONFIRMED");
      assert.equal(response.version, ++version);

      await prisma.staffDailyReport.updateMany({
        where: { tenantId, campusId, id: daily.id },
        data: { version: { increment: 1 } },
      });
      const beforeConflict = reviewerTrace.length;
      await assert.rejects(
        owner.session.postAuthenticated(`/admin/monthly-feedback/${reportId}/publish`, { version }),
        (error) => error?.statusCode === 409,
      );
      assert.equal(
        reviewerTrace.length,
        beforeConflict + 1,
        "A source conflict must not replay the publish request.",
      );
      report = await prisma.monthlyFeedbackReport.findFirstOrThrow({
        where: { tenantId, campusId, id: reportId },
      });
      assert.equal(report.status, "REVIEW_REQUIRED");
      assert.equal(report.reviewedByMembershipId, null);
      assert.equal(report.version, ++version);
      assert.equal(report.sourceVersion, 2);
      page.click("刷新");
      await waitRow(page, reportId, "REVIEW_REQUIRED");
      assert.equal(page.button("提交负责人审核"), undefined);
      page.click("核对并修改");
      page.change("familySchoolCollaboration", 2);
      page.click("保存修改");
      await waitRow(page, reportId, "DRAFT");
      version += 1;
      page.click("提交负责人审核");
      await waitRow(page, reportId, "SUBMITTED");
      version += 1;
      response = await owner.session.postAuthenticated(
        `/admin/monthly-feedback/${reportId}/review`,
        { version, action: "CONFIRM" },
      );
      assert.equal(response.version, ++version);
      response = await owner.session.postAuthenticated(
        `/admin/monthly-feedback/${reportId}/publish`,
        { version },
      );
      assert.equal(response.status, "PUBLISHED");
      assert.equal(response.audience, "STAFF_INTERNAL");
      assert.equal(response.version, ++version);
      page.click("刷新");
      await waitRow(page, reportId, "PUBLISHED");
      assert.equal(page.button("提交负责人审核"), undefined);
      report = await prisma.monthlyFeedbackReport.findFirstOrThrow({
        where: { tenantId, campusId, id: reportId },
      });
      assert.equal(report.version, version);
      assert.equal(report.status, "PUBLISHED");
      assert.equal(report.reviewedByMembershipId, reviewer.membershipId);
      assert.equal(report.dailyHabits, "FOLLOW_UP");
      assert.equal(report.activityParticipation, "PROGRESSING");
      assert.equal(report.familySchoolCollaboration, "FOLLOW_UP");
      const events = await prisma.monthlyFeedbackEvent.findMany({
        where: { tenantId, campusId, reportId },
        orderBy: { version: "asc" },
      });
      assert.deepEqual(
        events.map((event) => event.version),
        Array.from({ length: version }, (_, index) => index + 1),
      );
      assert.deepEqual(
        events.map((event) => event.action),
        [
          "CREATE",
          "EDIT",
          "SUBMIT",
          "RETURN",
          "EDIT",
          "SUBMIT",
          "CONFIRM",
          "SOURCES_CHANGED",
          "EDIT",
          "SUBMIT",
          "CONFIRM",
          "PUBLISH",
        ],
      );

      const expired = await prisma.inviteAuthSession.updateMany({
        where: { userId: writer.userId },
        data: { expiresAt: new Date("2000-01-01T00:00:00.000Z") },
      });
      assert.ok(expired.count > 0);
      page.click("刷新");
      await waitPage(
        page,
        () => ["DENIED", "ERROR"].some((state) => hasState(page, state)),
        "Expired employee sessions must close the page.",
      );
      assertNoRecords(page);
      assert.equal(employee.storage.value, null, "401 must remove the current stored session.");
      assert.notEqual(employee.session.snapshot.status, "READY");
      assert.equal(writerTrace.at(-1).status, 401);

      await employee.session.login(writer.username, password);
      assert.equal(employee.session.snapshot.status, "READY");
      page.events.show();
      await waitRow(page, reportId, "PUBLISHED");
      await prisma.membership.updateMany({
        where: { tenantId, id: writer.membershipId },
        data: { status: "SUSPENDED" },
      });
      page.click("刷新");
      await waitPage(
        page,
        () => ["DENIED", "ERROR"].some((state) => hasState(page, state)),
        "Revoked membership must clear the monthly page.",
      );
      assertNoRecords(page);
      assert.equal(writerTrace.at(-1).status, 403);
      const business = writerTrace.filter(({ path }) => path.startsWith("/staff/monthly-feedback"));
      assert.ok(business.every((call) => call.authenticated));
      assert.deepEqual(
        new Set(business.map(({ method }) => method)),
        new Set(["GET", "POST", "PATCH"]),
      );
      assert.equal(
        writerTrace.some(({ path }) => path.startsWith("/admin/")),
        false,
      );
      assert.equal(
        [...writerTrace, ...reviewerTrace].some(({ path }) =>
          /\/local\/|source-refresh|resubmit/u.test(path),
        ),
        false,
      );
    } finally {
      page?.events.unload();
      try {
        await api?.close();
      } finally {
        try {
          await prisma?.$disconnect();
        } finally {
          try {
            if (created)
              await adminDatabase.$executeRawUnsafe(
                `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
              );
          } finally {
            await adminDatabase.$disconnect();
          }
        }
      }
    }
  },
);
