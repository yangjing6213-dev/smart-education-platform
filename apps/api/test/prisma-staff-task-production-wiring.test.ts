import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaStaffTaskWorkbenchService } from "../src/modules/tasks/prisma-staff-task-workbench.service.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";

test("production registers persistent task assignment, staff lifecycle, check and cancellation", async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: "postgresql://synthetic@127.0.0.1:55434/synthetic" }),
  });
  try {
    const service = createProductionApiOptions(prisma, []).staffTaskWorkbenchOperations;
    assert.ok(service instanceof PrismaStaffTaskWorkbenchService);
    for (const action of [
      "list",
      "adminList",
      "create",
      "claim",
      "start",
      "complete",
      "check",
      "cancel",
    ] as const)
      assert.equal(typeof service[action], "function");
  } finally {
    await prisma.$disconnect();
  }
});

test("staff list reads related records sequentially within its scope and keeps task order and actions", async () => {
  const scope = { tenantId: "tenant", campusId: "campus" };
  const context = { ...scope, actorId: "staff-user", capabilities: ["task:read", "task:claim"] };
  const date = new Date("2026-11-01T00:00:00Z");
  const base = {
    assigneeMembershipId: "staff",
    createdByMembershipId: "manager",
    claimedByMembershipId: null,
    completedByMembershipId: null,
    checkedByMembershipId: null,
    classRef: "A",
    dueDate: date,
    updatedAt: date,
    priority: "NORMAL",
    status: "ASSIGNED",
    code: "STUDENT_FOLLOW_UP",
    version: 1,
    result: null,
    targetType: "STUDENT",
  };
  const stages: string[] = [];
  let inQuery = false;
  const read = async <T>(name: string, value: T) => {
    assert.equal(inQuery, false, "transaction reads must complete in sequence");
    inQuery = true;
    stages.push(name);
    await Promise.resolve();
    inQuery = false;
    return value;
  };
  const transaction = {
    membershipCampus: {
      findMany(args: Prisma.MembershipCampusFindManyArgs) {
        if (args.where?.membership) {
          assert.deepEqual(args.where, {
            ...scope,
            campus: { status: "ACTIVE" },
            membership: {
              userId: "staff-user",
              status: "ACTIVE",
              user: { status: "ACTIVE" },
              tenant: { status: "ACTIVE" },
            },
          });
          return read("scope", [{ membershipId: "staff", classAssignments: [{ classRef: "A" }] }]);
        }
        assert.deepEqual(args.where, {
          ...scope,
          membershipId: { in: ["staff", "manager", "gone"] },
        });
        return read(
          "people",
          ["staff", "manager"].map((membershipId) => ({
            membershipId,
            membership: {
              userId: membershipId + "-user",
              status: "ACTIVE",
              user: { status: "ACTIVE" },
            },
          })),
        );
      },
    },
    workTask: {
      findMany(args: Prisma.WorkTaskFindManyArgs) {
        assert.deepEqual(args.where, {
          ...scope,
          classRef: { in: ["A"] },
          assigneeMembershipId: "staff",
        });
        assert.deepEqual(args.orderBy, [{ dueDate: "asc" }, { id: "asc" }]);
        assert.deepEqual(
          Object.keys(args.include ?? {}),
          ["student"],
          "avoid sibling relations on one transaction connection",
        );
        return read("tasks", [
          {
            ...base,
            id: "first",
            student: { classRef: "A", status: "ACTIVE", displayRef: "示例甲" },
          },
          {
            ...base,
            id: "second",
            checkedByMembershipId: "manager",
            student: { classRef: "A", status: "INACTIVE", displayRef: "示例乙" },
          },
          { ...base, id: "third", checkedByMembershipId: "gone", status: "CHECKED", student: null },
        ]);
      },
    },
    membershipClass: {
      findMany(args: Prisma.MembershipClassFindManyArgs) {
        assert.deepEqual(args.where, { ...scope, membershipId: "staff" });
        return read("classes", [{ classRef: "A" }]);
      },
    },
  };
  const client = { $transaction: (run: (db: typeof transaction) => unknown) => run(transaction) };
  const directory = ["staff", "manager"].map((ref) => ({
    identity: { actor_id: ref + "-user", display_name: ref },
    memberships: [],
  }));
  const service = new PrismaStaffTaskWorkbenchService(client as unknown as PrismaClient, directory);
  const result = await service.list(context);
  assert.deepEqual(stages, ["scope", "tasks", "people", "classes"]);
  assert.ok(
    result && typeof result === "object" && "tasks" in result && Array.isArray(result.tasks),
  );
  assert.deepEqual(
    result.tasks.map(({ id, targetLabel, assigneeLabel, creatorLabel, checkerLabel, actions }) => [
      id,
      targetLabel,
      assigneeLabel,
      creatorLabel,
      checkerLabel,
      actions,
    ]),
    [
      ["first", "示例甲", "staff", "manager", null, ["claim"]],
      ["second", "示例乙", "staff", "manager", "manager", []],
      ["third", "已停用学生", "staff", "manager", null, []],
    ],
  );
});
