import assert from "node:assert/strict";
import test from "node:test";

const qr = await import("../src/pickup/credential-qr.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

test("pickup credential QR is a deterministic 29 by 29 boolean matrix with quiet-zone support", () => {
  assert.ok(qr?.encodePickupCredentialQr, "local pickup credential QR encoder must exist");
  assert.ok(qr?.withPickupQrQuietZone, "pickup QR renderer must be able to add a quiet zone");
  const token = "A".repeat(43);
  const matrix = qr.encodePickupCredentialQr(token);
  const repeated = qr.encodePickupCredentialQr(token);

  assert.equal(matrix.length, 29);
  assert.ok(
    matrix.every((row) => row.length === 29 && row.every((cell) => typeof cell === "boolean")),
  );
  assert.deepEqual(repeated, matrix);
  assert.deepEqual(
    matrix.slice(0, 7).map((row) => row.slice(0, 7)),
    [
      [true, true, true, true, true, true, true],
      [true, false, false, false, false, false, true],
      [true, false, true, true, true, false, true],
      [true, false, true, true, true, false, true],
      [true, false, true, true, true, false, true],
      [true, false, false, false, false, false, true],
      [true, true, true, true, true, true, true],
    ],
  );

  const quiet = qr.withPickupQrQuietZone(matrix);
  assert.equal(quiet.length, 37);
  assert.ok(quiet.slice(0, 4).every((row) => row.every((cell) => cell === false)));
  assert.ok(quiet.every((row) => row.length === 37));
});

test("pickup QR encoder rejects anything except the server's 43-character base64url token", () => {
  assert.ok(qr?.encodePickupCredentialQr, "local pickup credential QR encoder must exist");
  for (const value of ["", "A".repeat(42), "A".repeat(44), "A".repeat(42) + "+"]) {
    assert.throws(() => qr.encodePickupCredentialQr(value), /凭证/u);
  }
});
