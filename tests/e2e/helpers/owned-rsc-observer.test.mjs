/* global fetch */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import process from "node:process";
import test from "node:test";
import { gzipSync } from "node:zlib";
import {
  hashValue,
  isCompletedRouteCancellation,
  observeRscResponse,
  routeFingerprint,
} from "./owned-rsc-observer.mjs";

function fixture() {
  const url = "http://127.0.0.1:43121/admin/staff-tasks?_rsc=synthetic";
  const headers = {
    rsc: "1",
    "X-Nextjs-Request-Id": "123abc",
    "Next-Router-State-Tree": "%5B%22%22%5D",
  };
  const fingerprint = routeFingerprint(url, headers);
  return {
    request: {
      role: "admin",
      requestId: "synthetic.1",
      method: "GET",
      resourceType: "Fetch",
      isRsc: true,
      url,
      routeHeaders: headers,
      timestamp: 100,
      wallTime: 1000,
    },
    failure: {
      role: "admin",
      requestId: "synthetic.1",
      type: "Fetch",
      canceled: true,
      error: "net::ERR_ABORTED",
      timestamp: 100.05,
    },
    transfer: { status: 200, mimeType: "text/x-component", contentEncoding: "gzip", bytes: 5500 },
    witnesses: [
      {
        event: "finish",
        fingerprint,
        status: 200,
        writableEnded: true,
        writableFinished: true,
        contentType: "text/x-component",
        encoding: "gzip",
        gzipComplete: true,
        capped: false,
        encodedBytes: 2510,
        decodedBytes: 5500,
        decodedSha256: "a".repeat(64),
      },
    ],
    timings: [
      {
        urlHash: hashValue(url),
        startAt: 1000000,
        endAt: 1000020,
        encodedBodySize: 2510,
        decodedBodySize: 5500,
      },
    ],
    page: {
      pathname: "/admin/staff-tasks",
      timeOrigin: 999000,
      expectedTimeOrigin: 999000,
      committed: true,
      errorCount: 0,
    },
  };
}

test("only an exactly matched complete RSC response can explain a post-completion CDP cancellation", () => {
  assert.equal(isCompletedRouteCancellation(fixture()), true);
});

const invalid = {
  "business JSON cancellation": (value) => {
    value.request.url = "http://127.0.0.1:43121/api/admin/tasks";
  },
  "staff origin cancellation": (value) => {
    value.request.role = "staff";
  },
  "mutation cancellation": (value) => {
    value.request.method = "POST";
  },
  "non-Fetch cancellation": (value) => {
    value.request.resourceType = "Document";
  },
  "non-RSC cancellation": (value) => {
    value.request.isRsc = false;
  },
  "different request": (value) => {
    value.failure.requestId = "another";
  },
  "different role": (value) => {
    value.failure.role = "staff";
  },
  "ordinary network error": (value) => {
    value.failure.error = "net::ERR_CONNECTION_RESET";
  },
  "not canceled": (value) => {
    value.failure.canceled = false;
  },
  "HTTP failure": (value) => {
    value.transfer.status = 503;
  },
  "JSON content type": (value) => {
    value.transfer.mimeType = "application/json";
  },
  "empty received data": (value) => {
    value.transfer.bytes = 0;
  },
  "truncated received data": (value) => {
    value.transfer.bytes--;
  },
  "truncated gzip": (value) => {
    value.witnesses[0].gzipComplete = false;
  },
  "unfinished server response": (value) => {
    value.witnesses[0].writableFinished = false;
  },
  "closed without finish": (value) => {
    value.witnesses[0].event = "close";
  },
  "wrong server fingerprint": (value) => {
    value.witnesses[0].fingerprint = "b".repeat(64);
  },
  "missing server witness": (value) => {
    value.witnesses = [];
  },
  "duplicate server witness": (value) => {
    value.witnesses.push({ ...value.witnesses[0] });
  },
  "capped observation": (value) => {
    value.witnesses[0].capped = true;
  },
  "invalid gzip hash": (value) => {
    value.witnesses[0].decodedSha256 = "invalid";
  },
  "partial browser encoded data": (value) => {
    value.timings[0].encodedBodySize--;
  },
  "partial browser decoded data": (value) => {
    value.timings[0].decodedBodySize--;
  },
  "timing of another URL": (value) => {
    value.timings[0].urlHash = "b".repeat(64);
  },
  "timing of an older same-URL request": (value) => {
    value.timings[0].startAt -= 1000;
  },
  "duplicate timing": (value) => {
    value.timings.push({ ...value.timings[0] });
  },
  "timing still open": (value) => {
    value.timings[0].endAt = 0;
  },
  "canceled before complete": (value) => {
    value.failure.timestamp = 100.001;
  },
  "uncommitted page": (value) => {
    value.page.committed = false;
  },
  "different page": (value) => {
    value.page.pathname = "/admin/meals";
  },
  "document reloaded": (value) => {
    value.page.timeOrigin++;
  },
  "page exception": (value) => {
    value.page.errorCount = 1;
  },
  "untrusted request origin": (value) => {
    value.request.url = value.request.url.replace("127.0.0.1", "example.com");
  },
  "missing RSC header": (value) => {
    delete value.request.routeHeaders.rsc;
  },
  "missing request nonce": (value) => {
    delete value.request.routeHeaders["X-Nextjs-Request-Id"];
  },
  "missing router state": (value) => {
    delete value.request.routeHeaders["Next-Router-State-Tree"];
  },
};
for (const [name, mutate] of Object.entries(invalid))
  test("route transfer remains a failure: " + name, () => {
    const value = fixture();
    mutate(value);
    assert.equal(isCompletedRouteCancellation(value), false);
  });

test("request fingerprints exclude credentials and distinguish retries and router state", () => {
  const { request } = fixture();
  const fingerprint = routeFingerprint(request.url, request.routeHeaders);
  assert.match(fingerprint, /^[0-9a-f]{64}$/u);
  assert.equal(
    routeFingerprint(request.url, {
      ...request.routeHeaders,
      cookie: "synthetic-secret",
      authorization: "synthetic-secret",
    }),
    fingerprint,
  );
  assert.notEqual(
    routeFingerprint(request.url, { ...request.routeHeaders, "X-Nextjs-Request-Id": "321abc" }),
    fingerprint,
  );
  assert.notEqual(
    routeFingerprint(request.url, {
      ...request.routeHeaders,
      "Next-Router-State-Tree": "different",
    }),
    fingerprint,
  );
});

for (const truncated of [false, true])
  test(
    "owned HTTP observer preserves the real gzip response and rejects truncation: " + truncated,
    async (t) => {
      const root = resolve(
        process.env.USER_WEB_E2E_ARTIFACT_ROOT ??
          "artifacts/task20-a1-276-native-navigation-20261023/observer-unit",
      );
      await mkdir(root, { recursive: true });
      const directory = await mkdtemp(join(root, "wire-unit-"));
      const plain = Buffer.from('0:{"value":"synthetic-only"}\n');
      const compressed = gzipSync(plain),
        bytes = truncated ? compressed.subarray(0, -8) : compressed;
      let written = 0,
        ended = 0;
      const server = createServer((request, response) => {
        observeRscResponse(request, response, directory);
        response.writeHead(200, { "content-type": "text/x-component", "content-encoding": "gzip" });
        response.write(bytes.subarray(0, 12), () => written++);
        response.end(bytes.subarray(12), () => ended++);
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      t.after(() => new Promise((done) => server.close(done)));
      const url = "http://127.0.0.1:" + server.address().port + "/admin/staff-tasks?_rsc=unit";
      const headers = {
        rsc: "1",
        "x-nextjs-request-id": "123abc",
        "next-router-state-tree": "synthetic-state",
        cookie: "synthetic-private-value",
      };
      const response = await fetch(url, { headers });
      if (truncated) await response.arrayBuffer().catch(() => null);
      else assert.deepEqual(Buffer.from(await response.arrayBuffer()), plain);
      assert.equal(written, 1);
      assert.equal(ended, 1);
      const names = await readdir(directory);
      assert.equal(names.length, 1);
      const text = await readFile(join(directory, names[0]), "utf8");
      assert.doesNotMatch(
        text,
        /synthetic-private-value|synthetic-state|synthetic-only|cookie|authorization/u,
      );
      const wire = JSON.parse(text.trim());
      assert.equal(wire.fingerprint, routeFingerprint(url, headers));
      assert.equal(wire.encodedBytes, bytes.length);
      assert.equal(wire.gzipComplete, !truncated);
      assert.equal(wire.writableFinished, true);
      if (!truncated) {
        assert.equal(wire.decodedBytes, plain.length);
        assert.equal(wire.decodedSha256, hashValue(plain));
      } else assert.equal(wire.decodedSha256, null);
    },
  );
