import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

test("media lifecycle enforces actor scope, reference conflicts, expiry, versioning and anonymous platform summary", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-08T04:00:00.000Z"),
  });
  const base = await app.start(0);
  async function request(handle, method, path, body) {
    const response = await globalThis.fetch(base + path, {
      method,
      headers: {
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  async function session(profile) {
    const result = await request(null, "POST", "/local/sessions", { profile });
    assert.equal(result.status, 201);
    return result.body.handle;
  }

  try {
    const [east, west, otherTenant, teacher, parent, platform] = await Promise.all([
      session("owner-east"),
      session("owner-west"),
      session("owner-other-tenant"),
      session("teacher-east"),
      session("parent-alpha"),
      session("platform-admin"),
    ]);
    const listed = await request(east, "GET", "/local/media-assets");
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    assert.ok(Array.isArray(listed.body.assets));
    assert.equal((await request(east, "GET", "/local/memberships")).status, 200);
    assert.equal((await request(east, "GET", "/local/staff-credentials")).status, 200);
    assert.equal((await request(teacher, "GET", "/local/staff-credentials")).status, 403);
    const teacherPhoto = listed.body.assets.find(
      (row) => row.alias === "teacher-profile-placeholder",
    );
    const activityImage = listed.body.assets.find(
      (row) => row.alias === "activity-cover-placeholder",
    );
    const familyGuide = listed.body.assets.find((row) => row.alias === "family-guide-placeholder");
    const expired = listed.body.assets.find((row) => row.alias === "expired-placeholder");
    assert.ok(teacherPhoto && activityImage && familyGuide && expired);
    assert.equal(teacherPhoto.references.length, 1);
    assert.equal(activityImage.status, "AVAILABLE");

    const deniedTeacher = await request(teacher, "GET", "/local/media-assets");
    const deniedParent = await request(parent, "GET", "/local/media-assets");
    assert.equal(deniedTeacher.status, 403);
    assert.equal(deniedParent.status, 403);
    assert.equal((await request(platform, "GET", "/local/media-assets")).status, 403);
    const westAssets = await request(west, "GET", "/local/media-assets");
    const otherTenantAssets = await request(otherTenant, "GET", "/local/media-assets");
    assert.equal(westAssets.status, 200);
    assert.equal(otherTenantAssets.status, 200);
    assert.equal(
      westAssets.body.assets.some((row) => row.id === teacherPhoto.id),
      false,
    );
    assert.equal(
      otherTenantAssets.body.assets.some((row) => row.id === teacherPhoto.id),
      false,
    );

    const referenceConflict = await request(
      east,
      "POST",
      `/local/media-assets/${teacherPhoto.id}/archive`,
      { version: teacherPhoto.version },
    );
    assert.equal(referenceConflict.status, 409);

    const replaced = await request(
      east,
      "POST",
      `/local/media-assets/${teacherPhoto.id}/replace-reference`,
      {
        version: teacherPhoto.version,
        referenceId: teacherPhoto.references[0].id,
        targetAssetId: activityImage.id,
        targetVersion: activityImage.version,
      },
    );
    assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
    assert.equal(replaced.body.source.references.length, 0);
    assert.equal(replaced.body.target.references.length, 1);
    assert.equal(replaced.body.source.version, teacherPhoto.version + 1);
    assert.equal(replaced.body.target.version, activityImage.version + 1);

    const staleArchive = await request(
      east,
      "POST",
      `/local/media-assets/${teacherPhoto.id}/archive`,
      { version: teacherPhoto.version },
    );
    assert.equal(staleArchive.status, 409);
    const archived = await request(east, "POST", `/local/media-assets/${teacherPhoto.id}/archive`, {
      version: replaced.body.source.version,
    });
    assert.equal(archived.status, 200);
    assert.equal(archived.body.status, "ARCHIVED");
    const deleted = await request(east, "POST", `/local/media-assets/${teacherPhoto.id}/delete`, {
      version: archived.body.version,
    });
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.status, "DELETED");

    const blockedRevoke = await request(
      east,
      "POST",
      `/local/media-assets/${familyGuide.id}/revoke`,
      { version: familyGuide.version, confirmReferences: false },
    );
    assert.equal(blockedRevoke.status, 409);
    const revoked = await request(east, "POST", `/local/media-assets/${familyGuide.id}/revoke`, {
      version: familyGuide.version,
      confirmReferences: true,
    });
    assert.equal(revoked.status, 200);
    const accessRevoked = await request(
      east,
      "POST",
      `/local/media-assets/${familyGuide.id}/access-check`,
      { version: revoked.body.version },
    );
    assert.equal(accessRevoked.status, 200);
    assert.equal(accessRevoked.body.allowed, false);

    const accessExpired = await request(
      east,
      "POST",
      `/local/media-assets/${expired.id}/access-check`,
      { version: expired.version },
    );
    assert.equal(accessExpired.status, 200);
    assert.equal(accessExpired.body.allowed, false);
    const accessAllowed = await request(
      east,
      "POST",
      `/local/media-assets/${replaced.body.target.id}/access-check`,
      { version: replaced.body.target.version },
    );
    assert.equal(accessAllowed.status, 200);
    assert.deepEqual(Object.keys(accessAllowed.body).sort(), ["allowed", "message", "recorded"]);
    assert.equal(accessAllowed.body.allowed, true);
    assert.doesNotMatch(JSON.stringify(accessAllowed.body), /url|path|objectKey|bytes|content/iu);

    const audit = await request(east, "GET", "/local/media-asset-events");
    assert.equal(audit.status, 200);
    assert.ok(audit.body.length >= 7);
    assert.doesNotMatch(JSON.stringify(audit.body), /url|path|objectKey|studentName|phone|email/iu);

    const summary = await request(platform, "GET", "/local/media-asset-summary");
    assert.equal(summary.status, 200);
    assert.equal("assets" in summary.body, false);
    assert.deepEqual(Object.keys(summary.body).sort(), [
      "archived",
      "available",
      "deleted",
      "expired",
      "referenced",
      "revoked",
      "total",
    ]);
    assert.equal((await request(east, "GET", "/local/media-asset-summary")).status, 403);
    assert.doesNotMatch(JSON.stringify(listed.body), /objectKey|downloadUrl|signedUrl|filePath/iu);
  } finally {
    await app.close();
  }
});
