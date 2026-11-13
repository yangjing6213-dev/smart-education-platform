import assert from "node:assert/strict";
import test from "node:test";
import { MediaAssetsService } from "../src/local-synthetic/media-assets.service.js";
import { memberForActor } from "../src/local-synthetic/sessions.js";

const actor = (id: number) =>
  memberForActor(`00000000-0000-4000-8000-${id.toString(16).padStart(12, "0")}`)!;
const fixedNow = () => Date.parse("2026-10-08T04:00:00.000Z");

test("media assets expose only same-tenant campus metadata and anonymous platform totals", () => {
  const service = new MediaAssetsService(fixedNow);
  const east = service.list(actor(4)).assets;
  assert.ok(east.length > 0);
  assert.equal(
    east.some((row) => row.alias === "west-activity-placeholder"),
    false,
  );
  assert.equal(
    east.some((row) => row.alias === "other-tenant-placeholder"),
    false,
  );
  assert.ok(east.some((row) => row.status === "REFERENCED"));
  assert.ok(east.some((row) => row.status === "EXPIRED"));
  assert.throws(() => service.list(actor(3)), { code: "UNAVAILABLE" });
  assert.throws(() => service.list(actor(1)), { code: "UNAVAILABLE" });
  const summary = service.summary(actor(10));
  assert.equal(summary.total, 10);
  assert.equal(
    summary.total,
    summary.available +
      summary.referenced +
      summary.expired +
      summary.archived +
      summary.revoked +
      summary.deleted,
  );
  assert.equal("assets" in summary, false);
  assert.throws(() => service.summary(actor(4)), { code: "UNAVAILABLE" });
});

test("media reference replacement requires same type, scope and current versions", () => {
  const service = new MediaAssetsService(fixedNow);
  const owner = actor(4);
  const initial = service.list(owner).assets;
  const source = initial.find((row) => row.alias === "teacher-profile-placeholder")!;
  const target = initial.find((row) => row.alias === "activity-cover-placeholder")!;
  const changed = service.replaceReference(owner, source.id, {
    version: source.version,
    referenceId: source.references[0]!.id,
    targetAssetId: target.id,
    targetVersion: target.version,
  });
  assert.equal(changed.source.references.length, 0);
  assert.equal(changed.target.references.length, 1);
  assert.throws(
    () =>
      service.replaceReference(owner, source.id, {
        version: source.version,
        referenceId: source.references[0]!.id,
        targetAssetId: target.id,
        targetVersion: target.version,
      }),
    { code: "STATE_CONFLICT" },
  );
});

test("expired and revoked references can be moved to same-type available assets", () => {
  const service = new MediaAssetsService(fixedNow);
  const owner = actor(4);
  const initial = service.list(owner).assets;
  const cases = [
    ["expired-placeholder", "alternate-activity-cover-placeholder"],
    ["revoked-placeholder", "available-guide-placeholder"],
  ] as const;

  for (const [sourceAlias, targetAlias] of cases) {
    const source = initial.find((row) => row.alias === sourceAlias)!;
    const target = initial.find((row) => row.alias === targetAlias)!;
    assert.equal(source.references.length, 1);
    const changed = service.replaceReference(owner, source.id, {
      version: source.version,
      referenceId: source.references[0]!.id,
      targetAssetId: target.id,
      targetVersion: target.version,
    });
    assert.equal(changed.source.references.length, 0);
    assert.equal(changed.source.status, source.status);
    assert.equal(changed.target.status, "REFERENCED");
  }
});

test("referenced and expired assets fail access/archive checks; unreferenced archive is a soft tombstone", () => {
  const service = new MediaAssetsService(fixedNow);
  const owner = actor(4);
  const rows = service.list(owner).assets;
  const referenced = rows.find((row) => row.alias === "family-guide-placeholder")!;
  const expired = rows.find((row) => row.alias === "expired-placeholder")!;
  const available = rows.find((row) => row.alias === "activity-cover-placeholder")!;
  assert.throws(() => service.archive(owner, referenced.id, { version: referenced.version }), {
    code: "STATE_CONFLICT",
  });
  assert.equal(service.accessCheck(owner, expired.id, { version: expired.version }).allowed, false);
  assert.equal(
    service.accessCheck(owner, available.id, { version: available.version }).allowed,
    true,
  );
  const archived = service.archive(owner, available.id, { version: available.version });
  const deleted = service.softDelete(owner, archived.id, { version: archived.version });
  assert.equal(deleted.status, "DELETED");
  assert.equal(service.accessCheck(owner, deleted.id, { version: deleted.version }).allowed, false);
  assert.ok(service.events(owner).length >= 5);
});
