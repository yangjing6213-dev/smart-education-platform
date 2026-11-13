import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createHealthApp } from "../src/nest/health-app.js";

test("Nest health app returns the OpenAPI health response on loopback only", async () => {
  const app = await createHealthApp();
  const server = app.getHttpServer();

  try {
    await app.listen(0, "127.0.0.1");
    const address = server.address() as AddressInfo;
    assert.equal(address.address, "127.0.0.1");

    const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
      headers: { connection: "close" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });

    const unsupportedRoute = await fetch(`http://127.0.0.1:${address.port}/me`, {
      headers: { connection: "close" },
    });
    assert.equal(unsupportedRoute.status, 404);
  } finally {
    await app.close();
  }

  assert.equal(server.address(), null);
});
