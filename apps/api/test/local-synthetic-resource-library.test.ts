import assert from "node:assert/strict";
import test from "node:test";
import { exactBody } from "../src/local-synthetic/binding-leave.service.js";
import { LocalRepository } from "../src/local-synthetic/repository.js";
import { ResourceLibraryService } from "../src/local-synthetic/resource-library.service.js";
import { memberForActor } from "../src/local-synthetic/sessions.js";

const actor = (id: number) =>
  memberForActor(`00000000-0000-4000-8000-${id.toString(16).padStart(12, "0")}`)!;
const resourceId = (id: number) => `00000000-0000-4000-8000-${id.toString(16).padStart(12, "0")}`;
const now = () => Date.parse("2026-10-07T04:00:00.000Z");

test("exact request bodies accept declared optional fields only", () => {
  const required = ["version", "scope", "expiresOn"];
  const optional = ["classId", "learningSourceAction"];
  const body = { version: 1, scope: "CLASS", expiresOn: "2027-03-31", classId: "class-a" };
  assert.deepEqual(exactBody(body, required, optional), body);
  assert.throws(() => exactBody({ version: 1, scope: "CLASS" }, required, optional));
  assert.throws(() => exactBody({ ...body, campusId: "forged" }, required, optional));
});

test("resource library filters by fixed metadata and actor scope, then hides expired and revoked rows", () => {
  const service = new ResourceLibraryService(new LocalRepository(), now);
  const teacher = actor(3);
  const otherClass = actor(7);
  const list = service.list(teacher, { grade: "三年级", subject: "数学", tag: "小组活动" });
  assert.equal(list.length, 1);
  assert.equal(list[0]?.title, "示例数学活动卡");
  assert.equal(list[0]?.sourceLabel, "校内教研组（合成示例）");
  assert.equal(list[0]?.ownerRole, "机构负责人");
  assert.equal(
    list.some((item) => item.id === resourceId(903) || item.id === resourceId(904)),
    false,
  );
  assert.equal(
    service.list(otherClass, { tag: "阅读引导" }).some((item) => item.id === resourceId(902)),
    false,
  );
  assert.equal(service.detail(teacher, resourceId(903)), undefined);
});

test("resource favorites and recent use are actor-specific, in-memory projections", () => {
  const service = new ResourceLibraryService(new LocalRepository(), now);
  const teacher = actor(3);
  const peer = actor(9);
  const resource = service.list(teacher)[0]!;
  assert.equal(
    service.favorite(teacher, resource.id, { version: resource.version, favorite: true }).favorite,
    true,
  );
  assert.equal(service.use(teacher, resource.id, { version: resource.version }).id, resource.id);
  assert.equal(service.favorites(teacher)[0]?.id, resource.id);
  assert.equal(service.recent(teacher)[0]?.id, resource.id);
  assert.equal(
    service.favorites(peer).some((item) => item.id === resource.id),
    false,
  );
  assert.equal(
    service.recent(peer).some((item) => item.id === resource.id),
    false,
  );
});

test("resource owner updates version and scope, rejects stale and cross-scope management, then revokes", () => {
  const repository = new LocalRepository();
  const service = new ResourceLibraryService(repository, now);
  const owner = actor(4);
  const eastTeacher = actor(3);
  const westTeacher = actor(7);
  const resource = service.managed(owner).find((item) => item.id === resourceId(901))!;
  const updated = service.update(owner, resource.id, {
    version: resource.version,
    scope: "CLASS",
    classId: owner.classIds[0]!,
    expiresOn: "2026-12-31",
  });
  assert.equal(updated.version, resource.version + 1);
  assert.equal(updated.scope, "CLASS");
  assert.equal(
    service.list(eastTeacher).some((item) => item.id === resource.id),
    true,
  );
  assert.equal(
    service.list(westTeacher).some((item) => item.id === resource.id),
    false,
  );
  assert.throws(
    () =>
      service.update(owner, resource.id, {
        version: resource.version,
        scope: "CAMPUS",
        expiresOn: "2026-12-31",
      }),
    { code: "STATE_CONFLICT" },
  );
  assert.throws(
    () =>
      service.update(actor(5), resource.id, {
        version: updated.version,
        scope: "CAMPUS",
        expiresOn: "2026-12-31",
      }),
    { code: "UNAVAILABLE" },
  );
  assert.equal(
    service.favorite(eastTeacher, resource.id, { version: updated.version, favorite: true })
      .favorite,
    true,
  );
  const revoked = service.revoke(owner, resource.id, { version: updated.version });
  assert.equal(revoked.version, updated.version + 1);
  assert.equal(revoked.status, "REVOKED");
  assert.equal(service.detail(eastTeacher, resource.id), undefined);
  assert.equal(
    service.favorites(eastTeacher).some((item) => item.id === resource.id),
    false,
  );
  assert.equal(
    service.recent(eastTeacher).some((item) => item.id === resource.id),
    false,
  );
});

test("only an in-scope owner can approve or return a pending learning source", () => {
  const repository = new LocalRepository();
  const service = new ResourceLibraryService(repository, now);
  const owner = actor(4);
  const pending = service.managed(owner).find((item) => item.id === resourceId(907))!;
  assert.equal(pending.learningSourceGovernance?.reviewStatus, "PENDING_REVIEW");

  const approved = service.update(owner, pending.id, {
    version: pending.version,
    scope: pending.scope,
    classId: pending.classId,
    expiresOn: pending.expiresOn as "2026-10-31" | "2026-12-31" | "2027-03-31",
    learningSourceAction: "APPROVE",
  });
  assert.equal(approved.version, pending.version + 1);
  assert.equal(approved.learningSourceGovernance?.reviewStatus, "APPROVED");
  assert.equal(approved.learningSourceGovernance?.reviewedAt, new Date(now()).toISOString());
  assert.equal(repository.audits().at(-1)?.action, "resource.learning-source.approve");
  assert.throws(
    () =>
      service.update(owner, pending.id, {
        version: pending.version,
        scope: pending.scope,
        classId: pending.classId,
        expiresOn: pending.expiresOn as "2026-10-31" | "2026-12-31" | "2027-03-31",
        learningSourceAction: "APPROVE",
      }),
    { code: "STATE_CONFLICT" },
  );
  assert.throws(
    () =>
      service.update(actor(3), pending.id, {
        version: pending.version,
        scope: pending.scope,
        classId: pending.classId,
        expiresOn: pending.expiresOn as "2026-10-31" | "2026-12-31" | "2027-03-31",
        learningSourceAction: "APPROVE",
      }),
    { code: "UNAVAILABLE" },
  );
  assert.throws(
    () =>
      service.update(actor(5), pending.id, {
        version: pending.version,
        scope: pending.scope,
        classId: pending.classId,
        expiresOn: pending.expiresOn as "2026-10-31" | "2026-12-31" | "2027-03-31",
        learningSourceAction: "APPROVE",
      }),
    { code: "UNAVAILABLE" },
  );

  const returnService = new ResourceLibraryService(new LocalRepository(), now);
  const returnable = returnService.managed(owner).find((item) => item.id === resourceId(907))!;
  const returned = returnService.update(owner, returnable.id, {
    version: returnable.version,
    scope: returnable.scope,
    classId: returnable.classId,
    expiresOn: returnable.expiresOn as "2026-10-31" | "2026-12-31" | "2027-03-31",
    learningSourceAction: "RETURN",
  });
  assert.equal(returned.learningSourceGovernance?.reviewStatus, "RETURNED");
  assert.equal(returned.learningSourceGovernance?.reviewedAt, new Date(now()).toISOString());
});

test("platform resource summary exposes anonymous counts only to an explicitly authorized role", () => {
  const service = new ResourceLibraryService(new LocalRepository(), now);
  const summary = service.summary(actor(10));
  assert.deepEqual(Object.keys(summary).sort(), ["expired", "published", "revoked", "total"]);
  assert.equal(summary.total, 7);
  assert.throws(() => service.summary(actor(4)), { code: "UNAVAILABLE" });
  assert.throws(() => service.list(actor(1)), { code: "UNAVAILABLE" });
});
