import assert from "node:assert/strict";
import test from "node:test";

const pickup = await import("../src/pickup/parent-pickup.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

const id = "00000000-0000-4000-8000-000000000801";
const bindingId = "00000000-0000-4000-8000-000000000802";
const credential = "A".repeat(43);
const authorization = {
  id,
  version: 2,
  status: "ACTIVE",
  currentlyValid: true,
  bindingId,
  studentId: "00000000-0000-4000-8000-000000000803",
  studentLabel: "合成学生甲",
  classLabel: "合成班级甲",
  recipient: "pickup-alpha",
  recipientLabel: "示例接送人甲",
  type: "TEMPORARY",
  startDate: "2026-10-25",
  endDate: "2026-10-25",
  startTime: "15:00",
  endTime: "19:00",
};

test("parent pickup reader accepts only the scoped API projection", async () => {
  assert.ok(pickup?.loadParentPickup, "parent pickup reader must exist");
  const projection = {
    bindings: [
      {
        id: bindingId,
        version: 1,
        studentId: authorization.studentId,
        studentLabel: "合成学生甲",
        classLabel: "合成班级甲",
        status: "APPROVED",
      },
    ],
    authorizations: [authorization],
    records: [
      {
        id: "00000000-0000-4000-8000-000000000804",
        date: "2026-10-24",
        time: "18:20",
        studentId: authorization.studentId,
        studentLabel: "合成学生甲",
        recipient: "示例接送人甲",
        status: "COMPLETED",
      },
    ],
  };
  const paths = [];
  const result = await pickup.loadParentPickup(async (path) => {
    paths.push(path);
    return projection;
  });

  assert.deepEqual(paths, ["/parent/pickup"]);
  assert.deepEqual(result, projection);
});

test("parent pickup actions send selected version and return only credential data", async () => {
  assert.ok(pickup?.createParentPickupAuthorization, "authorization creation must exist");
  assert.ok(pickup?.activateParentPickupAuthorization, "authorization activation must exist");
  assert.ok(pickup?.revokeParentPickupAuthorization, "authorization revocation must exist");
  assert.ok(pickup?.issueParentPickupCredential, "credential issuance must exist");
  const calls = [];
  const post = async (path, body) => {
    calls.push({ path, body });
    if (path.endsWith("/credential")) return { credential, expiresAt: "2026-10-25T06:05:00.000Z" };
    return authorization;
  };
  const input = {
    bindingId,
    recipient: "pickup-alpha",
    type: "TEMPORARY",
    startDate: "2026-10-25",
    endDate: "2026-10-25",
    startTime: "15:00",
    endTime: "19:00",
  };

  await pickup.createParentPickupAuthorization(post, input);
  await pickup.activateParentPickupAuthorization(post, id, 2);
  await pickup.revokeParentPickupAuthorization(post, id, 2);
  const issued = await pickup.issueParentPickupCredential(post, id, 2);

  assert.deepEqual(calls, [
    { path: "/parent/pickup/authorizations", body: input },
    { path: `/parent/pickup/authorizations/${id}/activate`, body: { version: 2 } },
    { path: `/parent/pickup/authorizations/${id}/revoke`, body: { version: 2 } },
    { path: `/parent/pickup/authorizations/${id}/credential`, body: { version: 2 } },
  ]);
  assert.deepEqual(issued, { credential, expiresAt: "2026-10-25T06:05:00.000Z" });
});

test("staff preview returns only labels and confirmation requires all three checks", async () => {
  assert.ok(pickup?.previewStaffPickupCredential, "staff credential preview must exist");
  assert.ok(pickup?.confirmStaffPickupCredential, "staff credential confirmation must exist");
  const calls = [];
  const post = async (path, body) => {
    calls.push({ path, body });
    return path.endsWith("/preview")
      ? { studentLabel: "合成学生甲", classLabel: "合成班级甲", recipientLabel: "示例接送人甲" }
      : { id, status: "COMPLETED" };
  };

  const preview = await pickup.previewStaffPickupCredential(post, credential);
  const completed = await pickup.confirmStaffPickupCredential(post, credential, {
    student: true,
    recipient: true,
    authorization: true,
  });

  assert.deepEqual(preview, {
    studentLabel: "合成学生甲",
    classLabel: "合成班级甲",
    recipientLabel: "示例接送人甲",
  });
  assert.deepEqual(completed, { id, status: "COMPLETED" });
  assert.deepEqual(calls, [
    { path: "/staff/pickup/credentials/preview", body: { credential } },
    {
      path: "/staff/pickup/credentials/confirm",
      body: { credential, checks: { student: true, recipient: true, authorization: true } },
    },
  ]);
});

test("pickup client rejects malformed or over-shared service responses and invalid credentials", async () => {
  assert.ok(pickup?.loadParentPickup, "parent pickup reader must exist");
  assert.ok(pickup?.previewStaffPickupCredential, "staff credential preview must exist");
  await assert.rejects(
    pickup.loadParentPickup(async () => ({
      bindings: [],
      authorizations: [],
      records: [],
      modelLog: "must not reach the page",
    })),
    /格式/u,
  );
  await assert.rejects(
    pickup.previewStaffPickupCredential(
      async () => ({
        studentLabel: "合成学生甲",
        classLabel: "合成班级甲",
        recipientLabel: "示例接送人甲",
        guardianPhone: "must not reach the page",
      }),
      credential,
    ),
    /格式/u,
  );
  await assert.rejects(
    pickup.previewStaffPickupCredential(async () => ({}), "short"),
    /凭证/u,
  );
});
