import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createApiApp } from "../src/nest/api-app.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";
import { createInvitePasswordHash } from "../src/nest/invite-auth.service.js";
import type { InviteAccountConfiguration } from "../src/nest/invite-auth.service.js";
import type { TrustedAuthResult } from "@student-care/auth";
import { listenOnFetchSafePort } from "./support/fetch-safe-port.js";
import type { StaffTaskAssignmentChoice, InvitedStaffTaskView } from "@student-care/contracts";

const databaseUrl = process.env.DATABASE_URL;
const employeeCaps = [
  "identity:read",
  "task:read",
  "task:claim",
  "task:start",
  "task:complete",
  "daily:read",
  "daily:create",
] as const;
const managerCaps = [
  "identity:read",
  "task:read",
  "task:assign",
  "task:check",
  "task:cancel",
] as const;
test(
  "persistent task HTTP lifecycle validates trusted current scope, concurrency, restart and daily sources",
  { skip: databaseUrl === undefined },
  async () => {
    const url = new URL(databaseUrl!);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.port, "55434");
    assert.equal(url.pathname, "/synthetic");
    const tenantId = randomUUID(),
      otherTenantId = randomUUID(),
      campusId = randomUUID(),
      westId = randomUUID(),
      outsideCampusId = randomUUID();
    const people = [
      { key: "teacher", tenantId, campusId, classRefs: ["class-a", "class-b"], caps: employeeCaps },
      {
        key: "peer",
        tenantId,
        campusId,
        classRefs: ["class-a"],
        caps: [...employeeCaps, "task:check"] as const,
      },
      { key: "owner", tenantId, campusId, classRefs: ["class-a", "class-b"], caps: managerCaps },
      { key: "otherclass", tenantId, campusId, classRefs: ["class-c"], caps: managerCaps },
      { key: "west", tenantId, campusId: westId, classRefs: ["class-a"], caps: managerCaps },
      {
        key: "outside",
        tenantId: otherTenantId,
        campusId: outsideCampusId,
        classRefs: ["class-a"],
        caps: managerCaps,
      },
      {
        key: "parent",
        tenantId,
        campusId,
        classRefs: ["class-a"],
        caps: ["identity:read"] as const,
      },
      { key: "multicampus", tenantId, campusId, classRefs: ["class-a"], caps: employeeCaps },
      { key: "ambiguous", tenantId, campusId, classRefs: ["class-a"], caps: employeeCaps },
      { key: "duplicatedb", tenantId, campusId, classRefs: ["class-a"], caps: employeeCaps },
    ].map((row) => ({ ...row, userId: randomUUID(), membershipId: randomUUID() }));
    const teacher = people[0]!,
      peer = people[1]!,
      owner = people[2]!;
    const passwordHash = await createInvitePasswordHash("Synthetic-Only-Tasks-2030!");
    const accounts: InviteAccountConfiguration[] = people.map((person) => ({
      username: "synthetic." + person.key,
      password_hash: passwordHash,
      identity: { actor_id: person.userId, display_name: "合成" + person.key },
      memberships: [
        {
          tenant_id: person.tenantId,
          campus_ids: person.key === "multicampus" ? [person.campusId, westId] : [person.campusId],
          status: "ACTIVE",
          capabilities: person.caps,
        },
        ...(person.key === "ambiguous"
          ? [
              {
                tenant_id: person.tenantId,
                campus_ids: [westId],
                status: "ACTIVE" as const,
                capabilities: person.caps,
              },
            ]
          : []),
      ],
    }));
    const sessions = new Map(
      people.map((person) => [
        person.key,
        {
          trusted: true,
          session: {
            trusted: true,
            status: "ACTIVE",
            actor_id: person.userId,
            expires_at: "2099-01-01T00:00:00.000Z",
          },
          identity: { actor_id: person.userId, display_name: "合成" + person.key },
          memberships: accounts.find((account) => account.identity.actor_id === person.userId)!
            .memberships,
        } as TrustedAuthResult,
      ]),
    );
    const client = () =>
      new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    let prisma = client();
    const start = async () => {
      const app = await createApiApp({
        ...createProductionApiOptions(prisma, accounts),
        getTrustedAuthResult: (request) => {
          const header = request.headers.authorization;
          return typeof header === "string"
            ? sessions.get(header.replace(/^Bearer /u, ""))
            : undefined;
        },
      });
      await listenOnFetchSafePort((port) => app.listen(port, "127.0.0.1"));
      return app;
    };
    let api: Awaited<ReturnType<typeof start>> | undefined;
    try {
      await prisma.tenant.createMany({
        data: [
          { id: tenantId, name: "合成任务机构", slug: "synthetic-" + tenantId, status: "ACTIVE" },
          {
            id: otherTenantId,
            name: "合成外部机构",
            slug: "synthetic-" + otherTenantId,
            status: "ACTIVE",
          },
        ],
      });
      await prisma.campus.createMany({
        data: [
          { id: campusId, tenantId, name: "合成东校区", status: "ACTIVE" },
          { id: westId, tenantId, name: "合成西校区", status: "ACTIVE" },
          { id: outsideCampusId, tenantId: otherTenantId, name: "合成外部校区", status: "ACTIVE" },
        ],
      });
      await prisma.user.createMany({
        data: people.map((person) => ({ id: person.userId, status: "ACTIVE" })),
      });
      await prisma.membership.createMany({
        data: people.map((person) => ({
          id: person.membershipId,
          userId: person.userId,
          tenantId: person.tenantId,
          status: "ACTIVE",
        })),
      });
      await prisma.membershipCampus.createMany({
        data: people.map((person) => ({
          tenantId: person.tenantId,
          campusId: person.campusId,
          membershipId: person.membershipId,
        })),
      });
      await prisma.membershipClass.createMany({
        data: people.flatMap((person) =>
          person.classRefs.map((classRef) => ({
            tenantId: person.tenantId,
            campusId: person.campusId,
            membershipId: person.membershipId,
            classRef,
          })),
        ),
      });
      const duplicate = people.find((person) => person.key === "duplicatedb")!;
      const duplicateMembershipId = randomUUID();
      await prisma.membership.create({
        data: { id: duplicateMembershipId, tenantId, userId: duplicate.userId, status: "ACTIVE" },
      });
      await prisma.membershipCampus.create({
        data: { tenantId, campusId, membershipId: duplicateMembershipId },
      });
      await prisma.membershipClass.create({
        data: { tenantId, campusId, membershipId: duplicateMembershipId, classRef: "class-hidden" },
      });
      const studentA = await prisma.student.create({
        data: {
          tenantId,
          campusId,
          classRef: "class-a",
          status: "ACTIVE",
          displayRef: "合成学生甲",
        },
      });
      await prisma.student.create({
        data: {
          tenantId,
          campusId,
          classRef: "class-b",
          status: "ACTIVE",
          displayRef: "合成学生乙",
        },
      });
      api = await start();
      let baseUrl = await api.getUrl();
      const request = async (
        role: string,
        path: string,
        body?: unknown,
        headers: Record<string, string> = {},
      ) => {
        const response = await fetch(baseUrl + path, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            authorization: "Bearer " + role,
            ...(body === undefined ? {} : { "content-type": "application/json" }),
            ...headers,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return {
          status: response.status,
          body: (await response.json()) as { data: Record<string, unknown> },
        };
      };
      const taskOf = (result: Awaited<ReturnType<typeof request>>) =>
        result.body.data as unknown as InvitedStaffTaskView;
      const list = await request("owner", "/admin/tasks");
      assert.equal(list.status, 200);
      const choices = list.body.data.choices as StaffTaskAssignmentChoice[];
      const teacherChoices = choices.filter(
        (choice) => choice.assigneeRef === teacher.membershipId && choice.classRef === "class-a",
      );
      assert.equal(teacherChoices.length, 6);
      assert.deepEqual(
        new Set(teacherChoices.map((choice) => choice.targetType)),
        new Set(["CLASS", "STUDENT", "ACTIVITY", "CAMPUS"]),
      );
      assert.equal(
        choices.some((choice) => choice.assigneeRef === people[6]!.membershipId),
        false,
        "database membership alone does not make a parent an assignable employee",
      );
      for (const key of ["multicampus", "ambiguous", "duplicatedb"]) {
        const person = people.find((person) => person.key === key)!;
        assert.equal(
          choices.some((choice) => choice.assigneeRef === person.membershipId),
          false,
          key + " cannot execute tasks and must not be offered",
        );
        assert.equal((await request(key, "/staff/tasks")).status, 403);
      }
      const choice = teacherChoices.find((item) => item.targetType === "CLASS")!;
      const draft = {
        code: "DAILY_CHECK",
        assigneeRef: choice.assigneeRef,
        classRef: choice.classRef,
        targetType: choice.targetType,
        targetRef: choice.targetRef,
        dueDate: "2026-10-19",
        priority: "URGENT",
      };
      for (const key of ["multicampus", "ambiguous", "duplicatedb"]) {
        const person = people.find((person) => person.key === key)!;
        assert.equal(
          (await request("owner", "/admin/tasks", { ...draft, assigneeRef: person.membershipId }))
            .status,
          403,
        );
      }
      assert.equal((await request("unknown", "/admin/tasks")).status, 401);
      assert.equal((await request("parent", "/admin/tasks")).status, 403);
      assert.equal((await request("teacher", "/admin/tasks")).status, 403);
      assert.equal((await request("owner", "/admin/tasks?campusId=forged")).status, 400);
      assert.equal(
        (await request("owner", "/admin/tasks", undefined, { "x-campus-id": westId })).status,
        400,
      );
      for (const body of [
        { ...draft, tenantId },
        { ...draft, dueDate: "2030-02-30" },
        { ...draft, priority: "OTHER" },
      ])
        assert.equal((await request("owner", "/admin/tasks", body)).status, 400);
      for (const body of [
        { ...draft, classRef: "class-c" },
        { ...draft, assigneeRef: people[6]!.membershipId },
        { ...draft, targetRef: "forged" },
      ])
        assert.equal((await request("owner", "/admin/tasks", body)).status, 403);
      let row = taskOf(await request("owner", "/admin/tasks", draft));
      assert.equal(row.status, "ASSIGNED");
      assert.deepEqual(row.actions, ["cancel"]);
      const id = row.id;
      const ordinary = await request("teacher", "/staff/tasks");
      assert.equal(ordinary.status, 200);
      assert.deepEqual(
        (ordinary.body.data.tasks as InvitedStaffTaskView[]).map((task) => task.id),
        [id],
      );
      assert.doesNotMatch(
        JSON.stringify(ordinary.body.data),
        /actor_id|tenantId|campusId|classRef|assigneeId|MembershipId|createdBy|synthetic/,
      );
      assert.deepEqual((await request("peer", "/staff/tasks")).body.data.tasks, []);
      assert.equal((await request("peer", `/staff/tasks/${id}/claim`, { version: 1 })).status, 404);
      for (const role of ["otherclass", "west", "outside"]) {
        assert.deepEqual((await request(role, "/admin/tasks")).body.data.tasks, []);
        assert.equal(
          (await request(role, `/admin/tasks/${id}/cancel`, { version: 1 })).status,
          404,
        );
      }
      const claims = await Promise.all([
        request("teacher", `/staff/tasks/${id}/claim`, { version: 1 }),
        request("teacher", `/staff/tasks/${id}/claim`, { version: 1 }),
      ]);
      assert.deepEqual(claims.map((item) => item.status).sort(), [200, 409]);
      assert.equal(
        (await request("teacher", `/staff/tasks/${id}/start`, { version: 1 })).status,
        409,
      );
      row = taskOf(await request("teacher", `/staff/tasks/${id}/start`, { version: 2 }));
      assert.equal(row.status, "IN_PROGRESS");
      row = taskOf(
        await request("teacher", `/staff/tasks/${id}/complete`, { version: 3, result: "BLOCKED" }),
      );
      assert.equal(row.result, "BLOCKED");
      row = taskOf(
        await request("owner", `/admin/tasks/${id}/check`, { version: 4, action: "RETURN" }),
      );
      assert.equal(row.status, "RETURNED");
      assert.equal(row.result, "BLOCKED");
      for (const [action, body, version] of [
        ["claim", {}, 5],
        ["start", {}, 6],
        ["complete", { result: "FOLLOW_UP_REQUIRED" }, 7],
      ] as const)
        assert.equal(
          (await request("teacher", `/staff/tasks/${id}/${action}`, { version, ...body })).status,
          200,
        );
      row = taskOf(
        await request("owner", `/admin/tasks/${id}/check`, { version: 8, action: "CONFIRM" }),
      );
      assert.equal(row.status, "CHECKED");
      assert.equal(row.result, "FOLLOW_UP_REQUIRED");
      assert.equal(row.overdue, false);
      assert.deepEqual(row.actions, []);
      assert.equal(
        (await request("owner", `/admin/tasks/${id}/cancel`, { version: 9 })).status,
        409,
      );
      const otherTask = taskOf(
        await request("owner", "/admin/tasks", {
          ...draft,
          code: "SAFETY_RESPONSE",
          priority: "NORMAL",
        }),
      );
      row = taskOf(await request("owner", `/admin/tasks/${otherTask.id}/cancel`, { version: 1 }));
      assert.equal(row.status, "CANCELLED");
      assert.equal(row.result, null);
      assert.equal(row.overdue, false);
      const future = taskOf(
        await request("owner", "/admin/tasks", {
          ...draft,
          dueDate: "2030-01-02",
          code: "TEMPORARY_SUPPORT",
          priority: "IMPORTANT",
          classRef: "class-b",
          targetRef: "class-b",
        }),
      );
      assert.equal(future.dueDate, "2030-01-02");
      const targeted = taskOf(
        await request("owner", "/admin/tasks", {
          ...draft,
          targetType: "STUDENT",
          targetRef: studentA.id,
          code: "STUDENT_FOLLOW_UP",
        }),
      );
      await prisma.student.update({
        where: { tenantId_campusId_id: { tenantId, campusId, id: studentA.id } },
        data: { status: "INACTIVE" },
      });
      assert.equal(
        (await request("teacher", `/staff/tasks/${targeted.id}/claim`, { version: 1 })).status,
        403,
      );
      const ownChoice = choices.find(
        (item) => item.assigneeRef === peer.membershipId && item.targetType === "CLASS",
      )!;
      const ownTask = taskOf(
        await request("owner", "/admin/tasks", { ...draft, assigneeRef: ownChoice.assigneeRef }),
      );
      for (const [action, body, version] of [
        ["claim", {}, 1],
        ["start", {}, 2],
        ["complete", { result: "COMPLETED_AS_PLANNED" }, 3],
      ] as const)
        assert.equal(
          (await request("peer", `/staff/tasks/${ownTask.id}/${action}`, { version, ...body }))
            .status,
          200,
        );
      assert.equal(
        (
          await request("peer", `/admin/tasks/${ownTask.id}/check`, {
            version: 4,
            action: "CONFIRM",
          })
        ).status,
        403,
      );
      row = taskOf(await request("owner", `/admin/tasks/${ownTask.id}/cancel`, { version: 4 }));
      assert.equal(row.result, "COMPLETED_AS_PLANNED");
      // Only the checked, same-date, same-class task can enter the existing daily snapshot.
      await prisma.membershipClass.deleteMany({
        where: { tenantId, campusId, membershipId: teacher.membershipId, classRef: "class-b" },
      });
      const daily = await request("teacher", "/staff/daily-reports", {
        date: "2026-10-19",
        values: {
          arrival: "ARRIVED_AS_PLANNED",
          homework: "COMPLETED",
          activity: "PARTICIPATED",
          classroom: "ROUTINE",
          followUp: "NONE",
        },
      });
      assert.equal(daily.status, 201);
      assert.equal((daily.body.data.sourceCounts as { TASK: number }).TASK, 1);
      await prisma.membershipClass.create({
        data: { tenantId, campusId, membershipId: teacher.membershipId, classRef: "class-b" },
      });
      await prisma.membershipClass.deleteMany({
        where: { tenantId, campusId, membershipId: teacher.membershipId, classRef: "class-a" },
      });
      assert.equal(
        (await request("teacher", `/staff/tasks/${id}/start`, { version: 9 })).status,
        404,
      );
      assert.equal((ordinary.body.data.tasks as InvitedStaffTaskView[]).length, 1);
      await prisma.membershipClass.create({
        data: { tenantId, campusId, membershipId: teacher.membershipId, classRef: "class-a" },
      });
      for (const kind of ["membership", "user", "campus", "tenant"] as const) {
        if (kind === "membership")
          await prisma.membership.update({
            where: { tenantId_id: { tenantId, id: teacher.membershipId } },
            data: { status: "SUSPENDED" },
          });
        if (kind === "user")
          await prisma.user.update({ where: { id: teacher.userId }, data: { status: "DISABLED" } });
        if (kind === "campus")
          await prisma.campus.update({
            where: { tenantId_id: { tenantId, id: campusId } },
            data: { status: "INACTIVE" },
          });
        if (kind === "tenant")
          await prisma.tenant.update({ where: { id: tenantId }, data: { status: "INACTIVE" } });
        assert.equal(
          (await request("teacher", "/staff/tasks")).status,
          403,
          kind + " inactive rejects stale trusted session",
        );
        if (kind === "membership")
          await prisma.membership.update({
            where: { tenantId_id: { tenantId, id: teacher.membershipId } },
            data: { status: "ACTIVE" },
          });
        if (kind === "user")
          await prisma.user.update({ where: { id: teacher.userId }, data: { status: "ACTIVE" } });
        if (kind === "campus")
          await prisma.campus.update({
            where: { tenantId_id: { tenantId, id: campusId } },
            data: { status: "ACTIVE" },
          });
        if (kind === "tenant")
          await prisma.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE" } });
      }
      await api.close();
      api = undefined;
      await prisma.$disconnect();
      prisma = client();
      api = await start();
      baseUrl = await api.getUrl();
      const persisted = (await request("teacher", "/staff/tasks")).body.data
        .tasks as InvitedStaffTaskView[];
      assert.equal(persisted.find((task) => task.id === id)?.status, "CHECKED");
      assert.equal(persisted.find((task) => task.id === id)?.version, 9);
      assert.equal(
        persisted.find((task) => task.id === ownTask.id),
        undefined,
      );
      const stored = await prisma.workTask.findFirstOrThrow({ where: { tenantId, campusId, id } });
      assert.equal(stored.classRef, "class-a");
      assert.equal(stored.checkedByMembershipId, owner.membershipId);
    } finally {
      await api?.close();
      await prisma.$disconnect();
    }
  },
);
