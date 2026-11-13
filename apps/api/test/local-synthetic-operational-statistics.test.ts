import assert from "node:assert/strict";
import test from "node:test";
import { LocalError } from "../src/local-synthetic/binding-leave.service.js";
import { LocalRepository } from "../src/local-synthetic/repository.js";
import { memberForActor } from "../src/local-synthetic/sessions.js";
import { OperationalStatisticsService } from "../src/local-synthetic/operational-statistics.service.js";

const uuid = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
const owner = memberForActor(uuid(4))!;
const period = { from: "2026-10-06", to: "2026-10-07", campusId: owner.campusId };

function repositoryWithRows() {
  const repository = new LocalRepository();
  const base = { tenantId: owner.tenantId, campusId: owner.campusId, classId: owner.classIds[0]! };
  repository.insert({
    ...base,
    id: uuid(500),
    version: 2,
    kind: "staffTask",
    code: "DAILY_CHECK",
    targetType: "CLASS",
    targetId: base.classId,
    dueDate: "2026-10-06",
    priority: "NORMAL",
    status: "CHECKED",
    createdBy: owner.actorId,
    assigneeId: uuid(3),
    claimedBy: uuid(3),
    completedBy: uuid(3),
    result: "COMPLETED_AS_PLANNED",
    checkerId: owner.actorId,
    updatedBy: owner.actorId,
    updatedAt: "2026-10-06T08:00:00.000Z",
  });
  repository.insert({
    ...base,
    id: uuid(501),
    version: 1,
    kind: "attendance",
    studentId: "PRIVATE_STUDENT_ALPHA",
    date: "2026-10-07",
    status: "ARRIVED",
    arrivalTime: "09:00",
    departureTime: null,
    corrected: false,
    updatedBy: owner.actorId,
    updatedAt: "2026-10-07T01:00:00.000Z",
    correction: null,
    history: [],
  });
  repository.insert({
    ...base,
    id: uuid(502),
    version: 1,
    kind: "pickupException",
    studentId: "PRIVATE_STUDENT_BETA",
    date: "2026-10-07",
    category: "OVERDUE",
    status: "OPEN",
    createdBy: owner.actorId,
    createdAt: "2026-10-07T02:00:00.000Z",
    reviewedBy: null,
    reviewedAt: null,
    outcome: null,
  });
  repository.insert({
    ...base,
    id: uuid(503),
    version: 3,
    kind: "healthIncident",
    studentId: "PRIVATE_STUDENT_GAMMA",
    bindingId: uuid(600),
    bindingVersion: 1,
    observationCode: "NEEDS_FOLLOW_UP",
    dispositionCode: "FOLLOW_UP_SCHEDULED",
    summaryCode: null,
    status: "CONFIRMED",
    published: false,
    createdBy: uuid(3),
    reviewedBy: owner.actorId,
    updatedBy: owner.actorId,
    updatedAt: "2026-10-06T18:30:00.000Z",
  });
  repository.insert({
    ...base,
    id: uuid(504),
    version: 1,
    kind: "staffTask",
    code: "DAILY_CHECK",
    targetType: "CLASS",
    targetId: uuid(104),
    classId: uuid(104),
    dueDate: "2026-10-07",
    priority: "NORMAL",
    status: "ASSIGNED",
    createdBy: uuid(5),
    assigneeId: uuid(8),
    claimedBy: null,
    completedBy: null,
    result: null,
    checkerId: null,
    updatedBy: uuid(5),
    updatedAt: "2026-10-07T03:00:00.000Z",
  });
  repository.insert({
    tenantId: uuid(110),
    campusId: uuid(111),
    classId: uuid(113),
    id: uuid(505),
    version: 1,
    kind: "pickupException",
    studentId: "PRIVATE_OTHER_TENANT",
    date: "2026-10-07",
    category: "NO_AUTHORIZATION",
    status: "OPEN",
    createdBy: uuid(6),
    createdAt: "2026-10-07T03:00:00.000Z",
    reviewedBy: null,
    reviewedAt: null,
    outcome: null,
  });
  return repository;
}

test("scoped statistics aggregate source counts by date, class, type and status with opaque references", () => {
  const service = new OperationalStatisticsService(repositoryWithRows());
  const result = service.read(owner, period);

  assert.equal(result.mode, "SCOPED");
  assert.deepEqual(result.totals, {
    tasks: 1,
    attendance: 1,
    pickupExceptions: 1,
    healthIncidents: 1,
    total: 4,
  });
  assert.equal(result.groups.length, 4);
  assert.deepEqual(result.groups.find((group) => group.kind === "TASK")?.sources, [
    { kind: "TASK", id: uuid(500), version: 2, date: "2026-10-06" },
  ]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /PRIVATE_STUDENT|studentId|observationCode|targetId/u,
  );
});

test("class and date filters stay within the current member scope", () => {
  const service = new OperationalStatisticsService(repositoryWithRows());
  const filtered = service.read(owner, {
    ...period,
    classId: owner.classIds[0]!,
    from: "2026-10-07",
  });
  assert.equal(filtered.totals.tasks, 0);
  assert.equal(filtered.totals.total, 3);
  assert.throws(
    () => service.read(owner, { ...period, classId: uuid(104) }),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
  assert.throws(
    () => service.read(owner, { ...period, campusId: uuid(102) }),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
  assert.throws(() => service.read(owner, { ...period, unexpected: "x" } as never));
});

test("invalid or excessive date ranges are rejected instead of returning partial statistics", () => {
  const service = new OperationalStatisticsService(repositoryWithRows());
  assert.throws(() => service.read(owner, { ...period, from: "2026-02-30" }));
  assert.throws(() => service.read(owner, { ...period, from: "2026-09-01" }));
  assert.throws(() => service.read(owner, { ...period, from: "2026-10-08" }));
});

test("platform summary is global only as anonymous fixed totals and has no source or scope fields", () => {
  const service = new OperationalStatisticsService(repositoryWithRows());
  const result = service.anonymousSummary(memberForActor(uuid(10))!);

  assert.deepEqual(result, {
    mode: "ANONYMOUS",
    totals: { tasks: 2, attendance: 1, pickupExceptions: 2, healthIncidents: 1, total: 6 },
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /PRIVATE_STUDENT|studentId|sources|campus|class|date|status/u,
  );
  assert.throws(
    () => service.read(memberForActor(uuid(3))!, period),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
  assert.throws(
    () => service.anonymousSummary(owner),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
});
