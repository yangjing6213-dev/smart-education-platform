import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaStaffLibraryOperations } from "../src/modules/staff-library/prisma-staff-library.js";

const url = process.env.STAFF_LIBRARY_TEST_DATABASE_URL;
test(
  "published library preserves personal activity and enforces scope, expiry, version and revocation",
  { skip: !url },
  async () => {
    const address = new URL(url!);
    assert.equal(address.hostname, "127.0.0.1");
    assert.equal(address.pathname, "/a1611_synthetic");
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    const tenantId = randomUUID(),
      campusId = randomUUID(),
      actorId = randomUUID(),
      membershipId = randomUUID();
    const otherUser = randomUUID(),
      otherMember = randomUUID();
    const owner = {
      tenantId,
      campusId,
      actorId,
      capabilities: ["library:manage", "library:read", "library:summary"],
    };
    const peer = { ...owner, actorId: otherUser, capabilities: ["library:read"] };
    const library = new PrismaStaffLibraryOperations(db);
    try {
      await db.tenant.create({
        data: { id: tenantId, name: "合成机构", slug: tenantId, status: "ACTIVE" },
      });
      await db.campus.create({
        data: { tenantId, id: campusId, name: "合成校区", status: "ACTIVE" },
      });
      for (const [user, member, classRef] of [
        [actorId, membershipId, "class-a"],
        [otherUser, otherMember, "class-b"],
      ] as const) {
        await db.user.create({ data: { id: user, status: "ACTIVE" } });
        await db.membership.create({
          data: { tenantId, id: member, userId: user, status: "ACTIVE" },
        });
        await db.membershipCampus.create({ data: { tenantId, membershipId: member, campusId } });
        await db.membershipClass.create({
          data: { tenantId, membershipId: member, campusId, classRef },
        });
      }
      const campus = {
        kind: "RESOURCE",
        scope: "CAMPUS",
        classId: null,
        title: "合成课件",
        summary: "摘要",
        body: "仅详情可见正文",
        category: "LESSON",
        grade: "三年级",
        subject: "数学",
        tags: ["数感练习"],
        expiresOn: "2099-12-31",
      } as const;
      const item = await library.create(owner, { ...campus, tags: [...campus.tags] });
      assert.equal((await library.list(peer, "RESOURCE")).items.length, 1);
      const secondCampus = randomUUID();
      await db.campus.create({
        data: { tenantId, id: secondCampus, name: "合成第二校区", status: "ACTIVE" },
      });
      await db.membershipCampus.create({
        data: { tenantId, membershipId: otherMember, campusId: secondCampus },
      });
      const atSecondCampus = { ...peer, campusId: secondCampus };
      assert.deepEqual((await library.list(atSecondCampus, "RESOURCE")).items, []);
      await assert.rejects(library.detail(atSecondCampus, "RESOURCE", item.id), {
        code: "NOT_FOUND_SCOPED",
      });
      await assert.rejects(library.use(atSecondCampus, item.id, 1), { code: "NOT_FOUND_SCOPED" });
      assert.equal("body" in (await library.list(peer, "RESOURCE")).items[0]!, false);
      assert.equal((await library.detail(peer, "RESOURCE", item.id)).body, campus.body);
      await library.favorite(peer, item.id, 1, true);
      await library.use(peer, item.id, 1);
      const reloaded = await new PrismaStaffLibraryOperations(db).detail(peer, "RESOURCE", item.id);
      assert.equal(reloaded.favorite, true);
      assert.ok(reloaded.lastUsedAt);
      assert.equal((await library.detail(owner, "RESOURCE", item.id)).favorite, false);
      const change = {
        version: 1,
        scope: "CLASS",
        classId: "class-a",
        expiresOn: campus.expiresOn,
      } as const;
      await assert.rejects(
        library.update(owner, item.id, { ...change, version: Number.MAX_SAFE_INTEGER }),
        { code: "VERSION_MISMATCH" },
      );
      const concurrent = await Promise.allSettled([
        library.update(owner, item.id, change),
        library.update(owner, item.id, change),
      ]);
      assert.deepEqual(concurrent.map((outcome) => outcome.status).sort(), [
        "fulfilled",
        "rejected",
      ]);
      assert.equal((await library.list(peer, "RESOURCE")).items.length, 0);
      await assert.rejects(library.detail(peer, "RESOURCE", item.id));
      await assert.rejects(library.use(peer, item.id, 2));
      await assert.rejects(library.managed(peer));
      await assert.rejects(library.managed({ ...owner, tenantId: randomUUID() }));
      const managed = await library.managed(owner);
      assert.deepEqual(managed.classIds, ["class-a"]);
      assert.equal("favorite" in managed.items[0]!, false);
      await library.update(owner, item.id, { ...change, version: 2, expiresOn: "2001-01-01" });
      assert.equal((await library.list(owner, "RESOURCE")).items.length, 0);
      assert.equal((await library.summary(owner)).expired, 1);
      await library.revoke(owner, item.id, 3);
      assert.equal((await library.summary(owner)).revoked, 1);
      await assert.rejects(library.update(owner, item.id, { ...change, version: 4 }));
      await db.membership.update({
        where: { tenantId_id: { tenantId, id: membershipId } },
        data: { status: "SUSPENDED" },
      });
      await assert.rejects(library.list(owner, "RESOURCE"));
    } finally {
      await db.$disconnect();
    }
  },
);
