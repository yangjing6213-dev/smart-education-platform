/* global document, innerWidth, innerHeight, localStorage, sessionStorage, requestAnimationFrame, window */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";
import test from "node:test";
import { pathToFileURL, URL } from "node:url";
import {
  apiRuntimeRoot,
  artifactRoot,
  repositoryRoot,
  startIsolatedBrowser,
} from "./helpers/child-monthly-web-browser.mjs";

const apiRequire = createRequire(resolve(repositoryRoot, "apps/api/package.json"));
const { PrismaPg } = apiRequire("@prisma/adapter-pg");
const { PrismaClient } = await import(
  pathToFileURL(resolve(apiRuntimeRoot, "generated/prisma/client.js"))
);
const { createApiApp } = await import(pathToFileURL(resolve(apiRuntimeRoot, "nest/api-app.js")));
const { createProductionApiOptions } = await import(
  pathToFileURL(resolve(apiRuntimeRoot, "nest/production-api-options.js"))
);
const { createInvitePasswordHash } = await import(
  pathToFileURL(resolve(apiRuntimeRoot, "nest/invite-auth.service.js"))
);
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "PROGRESSING",
  familySchoolCollaboration: "FOLLOW_UP",
};

async function seed(db) {
  const tenantId = randomUUID(),
    east = randomUUID(),
    west = randomUUID();
  const classRef = "synthetic-a1351-class";
  const person = (campuses, staff = false) => ({
    userId: randomUUID(),
    membershipId: randomUUID(),
    campuses,
    staff,
  });
  const people = {
    writer: person([east], true),
    reviewer: person([east], true),
    parent: person([east, west]),
    otherParent: person([east]),
  };
  await db.tenant.create({
    data: {
      id: tenantId,
      name: "模拟数据个人月报机构",
      slug: `synthetic-a1351-${tenantId}`,
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
      .map((p) => ({ tenantId, campusId: east, membershipId: p.membershipId, classRef })),
  });
  const child = await db.student.create({
    data: {
      id: randomUUID(),
      tenantId,
      campusId: east,
      classRef,
      status: "ACTIVE",
      displayRef: "模拟数据孩子甲",
    },
  });
  const other = await db.student.create({
    data: {
      id: randomUUID(),
      tenantId,
      campusId: west,
      classRef,
      status: "ACTIVE",
      displayRef: "模拟数据孩子乙",
    },
  });
  const peer = await db.student.create({
    data: {
      id: randomUUID(),
      tenantId,
      campusId: east,
      classRef,
      status: "ACTIVE",
      displayRef: "模拟数据其他家庭孩子",
    },
  });
  const source = await db.attendanceRecord.create({
    data: {
      tenantId,
      campusId: east,
      id: randomUUID(),
      studentId: child.id,
      classRef,
      serviceDate: new Date("2026-10-01T00:00:00.000Z"),
      status: "ARRIVED",
      arrivalTime: "08:30",
      recordedByMembershipId: people.writer.membershipId,
      updatedByMembershipId: people.writer.membershipId,
    },
  });
  const relationship = async (student, guardian) => {
    // The synthetic reviewer also owns the west-campus approval used only by this fixture.
    if (student.campusId === west)
      await db.membershipCampus.create({
        data: { tenantId, campusId: west, membershipId: people.reviewer.membershipId },
      });
    const application = await db.bindingApplication.create({
      data: {
        tenantId,
        campusId: student.campusId,
        id: randomUUID(),
        applicantUserId: guardian.userId,
        onboardingScopeRef: randomUUID(),
        studentCandidateRef: student.id,
        status: "APPROVED",
        reviewedByMembershipId: people.reviewer.membershipId,
        reviewedAt: new Date(),
      },
    });
    return db.guardianRelationship.create({
      data: {
        tenantId,
        campusId: student.campusId,
        id: randomUUID(),
        bindingApplicationId: application.id,
        guardianUserId: guardian.userId,
        studentId: student.id,
        status: "ACTIVE",
        version: 1,
        approvedByMembershipId: people.reviewer.membershipId,
        approvedAt: new Date(),
      },
    });
  };
  const relation = await relationship(child, people.parent);
  const otherRelation = await relationship(other, people.parent);
  const peerRelation = await relationship(peer, people.otherParent);
  const password = `Synthetic-${randomUUID()}!`;
  const passwordHash = await createInvitePasswordHash(password);
  const accounts = Object.entries(people).map(([name, p]) => ({
    username: `synthetic.${name.toLowerCase()}`,
    password_hash: passwordHash,
    identity: { actor_id: p.userId, display_name: `模拟数据${name}` },
    memberships: [
      {
        tenant_id: tenantId,
        campus_ids: p.campuses,
        status: "ACTIVE",
        capabilities: p.staff
          ? [
              "identity:read",
              "feedback:read",
              "feedback:create",
              "feedback:submit",
              "feedback:review",
              "feedback:publish",
            ]
          : ["identity:read", "binding:read"],
      },
    ],
  }));
  return {
    tenantId,
    east,
    people,
    child,
    other,
    peer,
    source,
    relation,
    otherRelation,
    peerRelation,
    password,
    accounts,
  };
}

async function login(page, origin, role, password) {
  const admin = role === "reviewer";
  const next = admin
    ? "/admin/child-monthly-review"
    : role === "writer"
      ? "/web/staff/child-monthly"
      : "/web/parent/monthly";
  await page.goto(`${origin}${admin ? "/admin" : "/web"}/login?next=${encodeURIComponent(next)}`);
  await page
    .locator(admin ? "#admin-login-username" : "input[name=username]")
    .fill(`synthetic.${role}`);
  await page.locator(admin ? "#admin-login-password" : "input[name=password]").fill(password);
  await page.locator("button[type=submit]").click();
  await page.waitForURL(origin + next);
}

async function ready(page, type) {
  const attr =
    type === "teacher"
      ? "data-staff-child-monthly-state"
      : type === "admin"
        ? "data-child-monthly-review-state"
        : "data-parent-monthly-state";
  await page.locator(`[${attr}=READY]`).waitFor();
}

async function editorFocused(page) {
  await page.waitForFunction(() => {
    const title = document.activeElement;
    if (title?.tagName !== "H3" || title.textContent !== "编辑孩子月报") return false;
    const rect = title.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  });
  const bounds = await page
    .getByRole("heading", { name: "编辑孩子月报", exact: true })
    .boundingBox();
  assert.ok(
    bounds && bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize().height,
    "进入编辑后，编辑标题应获得焦点且在视口内。",
  );
}

async function layout(page, name) {
  for (const width of [1365, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () => {
      await new Promise((resolveFrame) =>
        requestAnimationFrame(() => requestAnimationFrame(resolveFrame)),
      );
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.playState === "running" &&
              animation.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    if (name === "admin" && width < 1365)
      await page.waitForFunction(
        () => document.querySelector(".admin-sidebar").getBoundingClientRect().right <= 0,
      );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    assert.equal(
      await page.evaluate(() => window.scrollY),
      0,
      "整页截图前应回到页首，避免固定元素在整页截图中错位。",
    );
    if (name !== "admin") {
      const skip = await page.evaluate(() => {
        const link = document.querySelector(".skip-link");
        return link
          ? {
              focused: link === document.activeElement,
              bottom: link.getBoundingClientRect().bottom,
            }
          : null;
      });
      if (skip && !skip.focused) assert.ok(skip.bottom <= 0, "未聚焦的跳转链接应保持在视口外。");
    }
    const size = await page.evaluate(() => ({
      viewport: innerWidth,
      page: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    assert.ok(
      size.page <= size.viewport && size.body <= size.viewport,
      `${name} ${width}px出现横向溢出: ${JSON.stringify(size)}`,
    );
    if (name === "admin" && width === 1365) {
      const positions = await page.evaluate(() => {
        const nav = document.querySelector(".admin-sidebar").getBoundingClientRect();
        const main = document.querySelector(".admin-main").getBoundingClientRect();
        return { navRight: nav.right, mainLeft: main.left };
      });
      assert.ok(positions.navRight <= positions.mainLeft + 1, "管理页应保持左导航、右内容。");
    }
    if (name === "parent") {
      const centers = await page.locator("[data-parent-monthly-action=ack]").evaluate((button) => {
        const control = button.getBoundingClientRect();
        const card = button.closest("[data-parent-monthly-row]").getBoundingClientRect();
        return { control: control.left + control.width / 2, card: card.left + card.width / 2 };
      });
      assert.ok(
        Math.abs(centers.control - centers.card) <= 2,
        `确认按钮在${width}px应居中：${JSON.stringify(centers)}`,
      );
    }
    await page.screenshot({
      path: resolve(artifactRoot, "screenshots", `child-monthly-${name}-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1365, height: 1000 });
}

test(
  "A351 real invited child monthly browser workflow persists independent review and version-bound guardian receipts",
  { timeout: 180000 },
  async (t) => {
    assert.ok(process.env.DATABASE_URL, "需要root先启动本任务PostgreSQL。");
    const adminUrl = new URL(process.env.DATABASE_URL);
    assert.equal(adminUrl.hostname, "127.0.0.1");
    assert.equal(adminUrl.port, "55451");
    const databaseName = `student_care_a1351_${randomUUID().replaceAll("-", "")}`;
    const isolatedUrl = new URL(adminUrl);
    isolatedUrl.pathname = `/${databaseName}`;
    const client = (connectionString) =>
      new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const admin = client(adminUrl.href);
    let db,
      api,
      created = false;
    t.after(async () => {
      try {
        await api?.close();
      } finally {
        try {
          await db?.$disconnect();
        } finally {
          try {
            if (created) {
              await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
              const remaining = await admin.$queryRawUnsafe(
                "SELECT EXISTS(SELECT FROM pg_database WHERE datname = $1) AS present",
                databaseName,
              );
              assert.equal(remaining[0].present, false);
              t.diagnostic("本测试随机数据库已删除，数据库目录查询确认无残留。");
            }
          } finally {
            await admin.$disconnect();
          }
        }
      }
    });
    await admin.$connect();
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    execFileSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "prisma7.config.ts"],
      {
        cwd: resolve(repositoryRoot, "apps/api"),
        env: { ...process.env, DATABASE_URL: isolatedUrl.href },
        stdio: "pipe",
        windowsHide: true,
      },
    );
    db = client(isolatedUrl.href);
    await db.$connect();
    const fixture = await seed(db);
    t.diagnostic("本任务随机数据库、双校区合成孩子关系和邀请账号已创建。");
    api = await createApiApp(createProductionApiOptions(db, fixture.accounts));
    await api.listen(0, "127.0.0.1");
    const apiOrigin = `http://127.0.0.1:${api.getHttpServer().address().port}`;
    const runtime = await startIsolatedBrowser(t, { apiOrigin, withAdmin: true });
    t.diagnostic(
      "用户网页使用隔离production build启动；管理网页先验证production BUILD_ID，再以隔离next dev --webpack和独立缓存运行本机代理。",
    );
    const teacher = await runtime.context.newPage();
    const reviewerContext = await runtime.browser.newContext({
      viewport: { width: 1365, height: 1000 },
    });
    const parentContext = await runtime.browser.newContext({
      viewport: { width: 1365, height: 1000 },
    });
    t.after(() => Promise.all([reviewerContext.close(), parentContext.close()]));
    const reviewer = await reviewerContext.newPage(),
      parent = await parentContext.newPage();
    const errors = [],
      requests = [],
      consoleErrors = [],
      failedResponses = [];
    for (const page of [teacher, reviewer, parent]) {
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error")
          consoleErrors.push({ text: message.text(), url: message.location().url });
      });
      page.on("response", (response) => {
        if (response.status() >= 400)
          failedResponses.push({ url: response.url(), status: response.status() });
      });
      page.on("request", (request) =>
        requests.push({
          url: request.url(),
          method: request.method(),
          authorization: request.headers().authorization,
          body: request.postData(),
        }),
      );
    }
    await login(teacher, runtime.baseUrl, "writer", fixture.password);
    await ready(teacher, "teacher");
    await login(reviewer, runtime.adminBaseUrl, "reviewer", fixture.password);
    await ready(reviewer, "admin");
    await login(parent, runtime.baseUrl, "parent", fixture.password);
    await ready(parent, "parent");
    t.diagnostic("教师、负责人、家长分别通过真实邀请账号登录。");
    await parent.locator("select[name=studentId]").selectOption(fixture.relation.id);
    await ready(parent, "parent");
    assert.equal(await parent.locator("[data-parent-monthly-row]").count(), 0);
    await teacher.locator("select[name=studentId]").selectOption(fixture.child.id);
    await teacher.locator("input[name=month]").fill("2026-10");
    for (const [key, value] of Object.entries(supplements))
      await teacher.locator(`select[name=${key}]`).selectOption(value);
    await teacher.locator("[data-staff-child-monthly-action=save]").click();
    await ready(teacher, "teacher");
    const saved = await db.childMonthlyReport.findFirstOrThrow({
      where: { tenantId: fixture.tenantId, studentId: fixture.child.id },
    });
    assert.equal(saved.status, "DRAFT");
    await teacher.locator("[data-staff-child-monthly-action=submit]").click();
    await ready(teacher, "teacher");
    await reviewer.locator("[data-child-monthly-review-refresh]").click();
    await ready(reviewer, "admin");
    await reviewer.locator("[data-child-monthly-review-action=return]").click();
    await ready(reviewer, "admin");
    assert.equal(
      (
        await db.childMonthlyReport.findUniqueOrThrow({
          where: {
            tenantId_campusId_id: {
              tenantId: fixture.tenantId,
              campusId: fixture.east,
              id: saved.id,
            },
          },
        })
      ).status,
      "RETURNED",
    );
    await teacher.locator("[data-staff-child-monthly-refresh]").click();
    await ready(teacher, "teacher");
    await teacher.locator("[data-staff-child-monthly-action=edit]").click();
    await editorFocused(teacher);
    await teacher.locator("select[name=dailyHabits]").last().selectOption("PROGRESSING");
    await teacher.locator("[data-staff-child-monthly-action=save]").click();
    await ready(teacher, "teacher");
    await teacher.locator("[data-staff-child-monthly-action=submit]").click();
    await ready(teacher, "teacher");
    await reviewer.locator("[data-child-monthly-review-refresh]").click();
    await ready(reviewer, "admin");
    await reviewer.locator("[data-child-monthly-review-action=confirm]").click();
    await ready(reviewer, "admin");
    await parent.locator("[data-parent-monthly-refresh]").click();
    await ready(parent, "parent");
    assert.equal(
      await parent.locator("[data-parent-monthly-row]").count(),
      0,
      "负责人确认后仍须单独发布。",
    );
    await reviewer.locator("[data-child-monthly-review-action=publish]").click();
    await ready(reviewer, "admin");
    await parent.locator("[data-parent-monthly-refresh]").click();
    await ready(parent, "parent");
    assert.equal(await parent.locator("[data-parent-monthly-row]").count(), 1);
    t.diagnostic("教师提交、负责人退回、教师编辑重提、负责人确认及单独发布已完成。");
    assert.match(await parent.locator("[data-parent-monthly-row]").innerText(), /模拟数据孩子甲/u);
    const parentHtml = await parent
      .locator("[data-parent-monthly-row]")
      .evaluate((el) => el.outerHTML);
    for (const hidden of [
      fixture.tenantId,
      fixture.east,
      fixture.peer.id,
      fixture.source.id,
      fixture.people.writer.membershipId,
    ])
      assert.ok(!parentHtml.includes(hidden));
    assert.doesNotMatch(parentHtml, /sourceVersion|reviewedBy|createdBy|classRef|sourceSummary/u);
    for (const [page, name] of [
      [teacher, "teacher"],
      [reviewer, "admin"],
      [parent, "parent"],
    ])
      await layout(page, name);

    // Switching to another approved child clears the old child's report immediately.
    await parent.locator("select[name=studentId]").selectOption(fixture.otherRelation.id);
    await ready(parent, "parent");
    assert.equal(await parent.locator("[data-parent-monthly-row]").count(), 0);
    await parent.locator("select[name=studentId]").selectOption(fixture.relation.id);
    await ready(parent, "parent");
    const ackUrl = `${runtime.baseUrl}/api-local/parent/relationships/${fixture.relation.id}/monthly-reports/${saved.id}/ack`;
    let observed;
    const paused = new Promise((resolvePause) => {
      observed = resolvePause;
    });
    await parent.route(ackUrl, (route) => observed(route));
    const beforeAck = requests.filter((r) => r.url === ackUrl && r.method === "POST").length;
    const acknowledgementControl = parent.locator("[data-parent-monthly-action=ack]");
    await acknowledgementControl.scrollIntoViewIfNeeded();
    await parent.waitForFunction(async () => {
      const button = document.querySelector("[data-parent-monthly-action=ack]");
      if (!button) return false;
      const before = button.getBoundingClientRect();
      await new Promise((resolveFrame) =>
        requestAnimationFrame(() => requestAnimationFrame(resolveFrame)),
      );
      const after = button.getBoundingClientRect();
      return (
        after.top >= 0 && after.bottom <= innerHeight && Math.abs(before.top - after.top) < 0.5
      );
    });
    const point = await parent.locator("[data-parent-monthly-action=ack]").boundingBox();
    assert.ok(
      point && point.y >= 0 && point.y + point.height <= parent.viewportSize().height,
      "确认按钮须在视口中再真实双击。",
    );
    const acknowledgementStarted = parent.waitForRequest(
      (request) => request.url() === ackUrl && request.method() === "POST",
    );
    await parent.mouse.dblclick(point.x + point.width / 2, point.y + point.height / 2);
    await acknowledgementStarted;
    const acknowledgementRoute = await paused;
    assert.equal(await parent.locator("[data-parent-monthly-row]").count(), 0);
    assert.equal(await parent.locator("[data-parent-monthly-refresh]").isDisabled(), true);
    await acknowledgementRoute.continue();
    await parent.unroute(ackUrl);
    await ready(parent, "parent");
    assert.equal(
      requests.filter((r) => r.url === ackUrl && r.method === "POST").length,
      beforeAck + 1,
    );
    assert.deepEqual(
      JSON.parse(requests.filter((r) => r.url === ackUrl && r.method === "POST").at(-1).body),
      { publicationVersion: 1, relationshipVersion: 1 },
    );
    assert.equal(await db.childMonthlyReceipt.count({ where: { reportId: saved.id } }), 1);
    assert.equal(await parent.locator("[data-parent-monthly-action=ack]").count(), 0);

    // A real concurrent relationship revision makes the displayed receipt stale.
    await db.guardianRelationship.update({
      where: {
        tenantId_campusId_id: {
          tenantId: fixture.tenantId,
          campusId: fixture.east,
          id: fixture.relation.id,
        },
      },
      data: { version: { increment: 1 } },
    });
    await parent.locator("[data-parent-monthly-refresh]").click();
    await ready(parent, "parent");
    await db.guardianRelationship.update({
      where: {
        tenantId_campusId_id: {
          tenantId: fixture.tenantId,
          campusId: fixture.east,
          id: fixture.relation.id,
        },
      },
      data: { version: { increment: 1 } },
    });
    const conflict = parent.waitForResponse(
      (response) => response.url() === ackUrl && response.status() === 409,
    );
    const conflictBefore = requests.filter((r) => r.url === ackUrl && r.method === "POST").length;
    const relationshipListUrl = `${runtime.baseUrl}/api-local/guardian-relationships`;
    const monthlyListUrl = ackUrl.slice(0, ackUrl.lastIndexOf("/" + saved.id));
    const readsBefore = [relationshipListUrl, monthlyListUrl].map(
      (url) => requests.filter((r) => r.url === url && r.method === "GET").length,
    );
    await parent.locator("[data-parent-monthly-action=ack]").click();
    await conflict;
    await ready(parent, "parent");
    assert.equal(
      requests.filter((r) => r.url === ackUrl && r.method === "POST").length,
      conflictBefore + 1,
      "409只能刷新，不能自动重发确认。",
    );
    assert.deepEqual(
      [relationshipListUrl, monthlyListUrl].map(
        (url) => requests.filter((r) => r.url === url && r.method === "GET").length,
      ),
      readsBefore.map((count) => count + 1),
      "冲突后关系和月报各刷新一次。",
    );
    assert.equal(await db.childMonthlyReceipt.count({ where: { reportId: saved.id } }), 1);
    await parent.locator("[data-parent-monthly-action=ack]").click();
    await ready(parent, "parent");
    assert.deepEqual(
      JSON.parse(requests.filter((r) => r.url === ackUrl && r.method === "POST").at(-1).body),
      { publicationVersion: 1, relationshipVersion: 3 },
    );
    assert.equal(await db.childMonthlyReceipt.count({ where: { reportId: saved.id } }), 2);
    t.diagnostic("家长切换孩子、忙态防重复确认、真实关系冲突409及单次刷新已验证。");
    // A source revision must hide the old publication until a new independent
    // confirmation and publish action; old receipts cannot cover publication 2.
    await db.attendanceRecord.updateMany({
      where: { tenantId: fixture.tenantId, campusId: fixture.east, id: fixture.source.id },
      data: { version: { increment: 1 } },
    });
    await parent.locator("[data-parent-monthly-refresh]").click();
    await ready(parent, "parent");
    assert.equal(await parent.locator("[data-parent-monthly-row]").count(), 0);
    await teacher.locator("[data-staff-child-monthly-refresh]").click();
    await ready(teacher, "teacher");
    await teacher.locator("[data-staff-child-monthly-status=REVIEW_REQUIRED]").waitFor();
    await teacher.locator("[data-staff-child-monthly-action=edit]").click();
    await editorFocused(teacher);
    await teacher.locator("[data-staff-child-monthly-action=save]").click();
    await ready(teacher, "teacher");
    await teacher.locator("[data-staff-child-monthly-action=submit]").click();
    await ready(teacher, "teacher");
    await reviewer.locator("[data-child-monthly-review-refresh]").click();
    await ready(reviewer, "admin");
    await reviewer.locator("[data-child-monthly-review-action=confirm]").click();
    await ready(reviewer, "admin");
    await parent.locator("[data-parent-monthly-refresh]").click();
    await ready(parent, "parent");
    assert.equal(await parent.locator("[data-parent-monthly-row]").count(), 0);
    await reviewer.locator("[data-child-monthly-review-action=publish]").click();
    await ready(reviewer, "admin");
    await parent.locator("[data-parent-monthly-refresh]").click();
    await ready(parent, "parent");
    await parent.locator("[data-parent-monthly-action=ack]").click();
    await ready(parent, "parent");
    assert.deepEqual(
      JSON.parse(requests.filter((r) => r.url === ackUrl && r.method === "POST").at(-1).body),
      { publicationVersion: 2, relationshipVersion: 3 },
    );
    assert.equal(await db.childMonthlyReceipt.count({ where: { reportId: saved.id } }), 3);
    t.diagnostic("来源更新后旧发布已隐藏，重新审核发布后使用新的发布版本确认。");
    assert.equal(
      (await parentContext.cookies()).find((cookie) => cookie.name === "student_care_local_session")
        ?.httpOnly,
      true,
    );
    assert.equal(await parent.evaluate(() => localStorage.length + sessionStorage.length), 0);
    await db.inviteAuthSession.updateMany({
      where: { userId: fixture.people.parent.userId },
      data: { expiresAt: new Date("2000-01-01T00:00:00.000Z") },
    });
    await parent.locator("[data-parent-monthly-refresh]").click();
    await parent.locator("[data-parent-monthly-state=DENIED]").waitFor();
    assert.equal(await parent.locator("[data-parent-monthly-row]").count(), 0);
    assert.equal(
      (await parentContext.cookies()).filter(
        (cookie) => cookie.name === "student_care_local_session",
      ).length,
      0,
    );
    await parent.screenshot({
      path: resolve(artifactRoot, "screenshots", "child-monthly-expired-session.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    const expectedFailure = (response) =>
      (response.status === 401 &&
        ["/api-local/me", "/api/admin/me", "/api-local/guardian-relationships"].includes(
          new URL(response.url).pathname,
        )) ||
      (response.status === 409 && response.url === ackUrl);
    assert.deepEqual(
      failedResponses.filter((response) => !expectedFailure(response)),
      [],
      "不得隐藏未预期的网页或接口失败。",
    );
    assert.deepEqual(
      consoleErrors.filter(
        (error) =>
          !/^Failed to load resource: the server responded with a status of (?:401|409)\b/u.test(
            error.text,
          ) ||
          !failedResponses.some(
            (response) => response.url === error.url && expectedFailure(response),
          ),
      ),
      [],
      "不得隐藏未预期的浏览器控制台错误。",
    );
    assert.ok(
      requests.every((r) =>
        [runtime.baseUrl, runtime.adminBaseUrl].includes(new URL(r.url).origin),
      ),
    );
    assert.ok(
      requests.every((r) => !r.authorization),
      "浏览器只能使用同源Cookie，不能携带Bearer凭据。",
    );
    assert.deepEqual(
      (
        await db.childMonthlyEvent.findMany({
          where: { reportId: saved.id },
          orderBy: { version: "asc" },
        })
      ).map((event) => event.action),
      [
        "CREATE",
        "SUBMIT",
        "RETURN",
        "EDIT",
        "SUBMIT",
        "CONFIRM",
        "PUBLISH",
        "SOURCES_CHANGED",
        "EDIT",
        "SUBMIT",
        "CONFIRM",
        "PUBLISH",
      ],
    );
  },
);
