import assert from "node:assert/strict";
import test from "node:test";

const roleGate = await import("../src/auth/role-gate.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

test("a single-role session may enter only its server-approved role", () => {
  assert.ok(roleGate?.hasRoleAccess, "Taro needs a verified role gate");
  const parent = { status: "READY", roles: ["PARENT"] };

  assert.equal(roleGate.hasRoleAccess(parent, "PARENT"), true);
  assert.equal(roleGate.hasRoleAccess(parent, "STAFF"), false);
});

test("a dual-role session may enter either role returned by the server", () => {
  assert.ok(roleGate?.hasRoleAccess, "Taro needs a verified role gate");
  const dualRole = { status: "READY", roles: ["PARENT", "STAFF"] };

  assert.equal(roleGate.hasRoleAccess(dualRole, "PARENT"), true);
  assert.equal(roleGate.hasRoleAccess(dualRole, "STAFF"), true);
});

test("signed-out and unverified session states cannot enter role pages", () => {
  assert.ok(roleGate?.hasRoleAccess, "Taro needs a verified role gate");

  for (const status of ["SIGNED_OUT", "CHECKING", "BUSY", "ERROR"]) {
    assert.equal(roleGate.hasRoleAccess({ status, roles: ["PARENT", "STAFF"] }, "PARENT"), false);
    assert.equal(roleGate.hasRoleAccess({ status, roles: ["PARENT", "STAFF"] }, "STAFF"), false);
  }
});
