import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { registerHooks } from "node:module";
import { resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

type LocalServer = {
  start(port: number): Promise<string>;
  close(): Promise<void>;
};
type CareRecordWebClient = {
  connect(profile: "teacher-east" | "parent-alpha"): Promise<void>;
  create(values: object, date: string): Promise<void>;
  command(id: string, version: number, action: "submit"): Promise<void>;
  receipt(id: string, version: number, action: "read" | "acknowledge"): Promise<void>;
  refresh(): Promise<void>;
  readonly snapshot: {
    status: string;
    records: readonly { id: string; version: number; status: string }[];
    parentRecords: readonly {
      id: string;
      version: number;
      publicationVersion: number;
      receipt: string;
    }[];
  };
};
type CareRecordAdminClient = {
  connect(profile: "owner-east"): Promise<void>;
  review(id: string, version: number, decision: "CONFIRM"): Promise<void>;
  publish(id: string, version: number): Promise<void>;
  revoke(id: string, version: number): Promise<void>;
  readonly snapshot: {
    status: string;
    records: readonly { id: string; version: number; status: string; published: boolean }[];
  };
};

const projectRoot = resolve(import.meta.dirname, "../..");
const miniRoot = resolve(projectRoot, "apps/mini-program");
const generatedMini = process.env.MINI_SHARED_RUNTIME === "generated";

if (!generatedMini) {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        specifier.endsWith(".js") &&
        context.parentURL?.startsWith(pathToFileURL(miniRoot + sep).href)
      ) {
        const source = fileURLToPath(new URL(specifier, context.parentURL)).replace(
          /\.js$/u,
          ".ts",
        );
        if (source.startsWith(miniRoot + sep) && existsSync(source))
          return nextResolve(pathToFileURL(source).href, context);
      }
      return nextResolve(specifier, context);
    },
  });
}

type MiniCareRecord = {
  id: string;
  version: number;
  status: string;
  bindingId?: string;
  publicationVersion?: number;
  receipt?: string;
  details?: readonly unknown[];
};
type MiniSharedState = {
  status: string;
  profiles: readonly { profile: string }[];
  care: readonly MiniCareRecord[];
};
type MiniPageInstance = {
  data: Record<string, unknown>;
  setData(patch: Record<string, unknown>): void;
  [key: string]: unknown;
};
type MiniRequestOptions = {
  url: string;
  method?: string;
  data?: unknown;
  header?: Record<string, string>;
  success(response: { statusCode: number; data: unknown }): void;
  fail(error: Error): void;
};

let registeredMiniPage: unknown;
let miniServiceBaseUrl = "";
const miniRequests: string[] = [];

function installMiniGlobals() {
  Object.assign(globalThis, {
    Page: (definition: unknown) => {
      registeredMiniPage = definition;
    },
    wx: {
      navigateTo() {},
      redirectTo() {},
      reLaunch() {},
      navigateBack() {},
      request(options: MiniRequestOptions) {
        const original = new URL(options.url);
        assert.equal(original.origin, "http://127.0.0.1:4317");
        const target = new URL(options.url.replace("http://127.0.0.1:4317", miniServiceBaseUrl));
        assert.equal(target.hostname, "127.0.0.1", "Mini requests must stay on loopback");
        miniRequests.push(`${target.origin} ${options.method ?? "GET"} ${target.pathname}`);
        void loopbackHttpFetch(target, {
          method: options.method ?? "GET",
          headers: options.header,
          ...(options.data === undefined ? {} : { body: JSON.stringify(options.data) }),
        })
          .then(async (response) => {
            const body = await response.text();
            options.success({
              statusCode: response.status,
              data: body ? (JSON.parse(body) as unknown) : undefined,
            });
          })
          .catch((error: unknown) => {
            const reason = error instanceof Error ? error.message : String(error);
            options.fail(
              new Error(`${options.method ?? "GET"} ${target.pathname} failed: ${reason}`),
            );
          });
        return { abort() {} };
      },
    },
  });
}

async function loadMiniPage(route: "parent/home" | "staff/quick-action") {
  registeredMiniPage = undefined;
  const extension = generatedMini ? "js" : "ts";
  await import(pathToFileURL(resolve(miniRoot, `pages/${route}/index.${extension}`)).href);
  assert.ok(registeredMiniPage, `Mini page ${route} must register`);
  const page = registeredMiniPage as MiniPageInstance;
  page.data = { ...page.data };
  page.setData = function (patch) {
    this.data = { ...this.data, ...patch };
  };
  return page;
}

async function invokeMini(page: MiniPageInstance, name: string, event?: unknown) {
  const handler = page[name];
  assert.equal(typeof handler, "function", `Mini handler ${name} must exist`);
  await (handler as (event?: unknown) => unknown).call(page, event);
}

function miniShared(page: MiniPageInstance) {
  return page.data.shared as MiniSharedState;
}

async function selectMiniProfile(page: MiniPageInstance, profile: string) {
  await invokeMini(page, "onShow");
  await invokeMini(page, "handleSharedEnable");
  const profiles = miniShared(page).profiles;
  const index = profiles.findIndex((option) => option.profile === profile);
  assert.ok(index >= 0, `Mini profile ${profile} must be available`);
  await invokeMini(page, "handleSharedProfile", { detail: { value: String(index) } });
  assert.equal(miniShared(page).status, "READY");
}

async function miniCareAction(
  page: MiniPageInstance,
  action: string,
  record: Pick<MiniCareRecord, "id" | "version"> &
    Partial<Pick<MiniCareRecord, "bindingId" | "publicationVersion">>,
) {
  await invokeMini(page, "handleSharedCommand", {
    currentTarget: {
      dataset: {
        action,
        id: record.id,
        version: record.version,
        bindingId: record.bindingId,
        publicationVersion: record.publicationVersion,
      },
    },
  });
}

function waitForPreview(child: ChildProcess): Promise<{ baseUrl: string }> {
  return new Promise((resolveStartup, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => reject(new Error("Local preview did not start.")), 8000);
    child.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      for (const line of buffer.split(/\r?\n/u)) {
        if (!line.trim().startsWith("{")) continue;
        try {
          const event = JSON.parse(line) as { event?: string; baseUrl?: string };
          if (event.event === "startup" && event.baseUrl) {
            clearTimeout(timeout);
            resolveStartup({ baseUrl: event.baseUrl });
            return;
          }
        } catch {
          // Wait until the child writes a complete JSON line.
        }
      }
      buffer = buffer.slice(buffer.lastIndexOf("\n") + 1);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Local preview exited before startup (${code}).`));
    });
  });
}

async function startPreview(packageRoot: string, servicePort: string) {
  const child = spawn(
    process.execPath,
    [resolve(packageRoot, "preview.mjs"), "--local-service-port", servicePort],
    { cwd: packageRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  const { baseUrl } = await waitForPreview(child);
  return {
    child,
    baseUrl,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await Promise.race([
        once(child, "exit"),
        new Promise((resolvePromise) => setTimeout(resolvePromise, 2500)),
      ]);
      if (child.exitCode === null) child.kill();
    },
  };
}

function loopbackHttpFetch(input: URL | RequestInfo, init: RequestInit = {}): Promise<Response> {
  const source = input instanceof Request ? input.url : String(input);
  const url = new URL(source);
  assert.equal(url.hostname, "127.0.0.1", "integration requests must stay on loopback");
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const body = init.body;
  if (body !== undefined && typeof body !== "string" && !(body instanceof Uint8Array))
    throw new TypeError("Integration test only supports buffered local request bodies.");

  return new Promise((resolveResponse, rejectResponse) => {
    const request = httpRequest(
      url,
      { method: init.method ?? "GET", headers, agent: false },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const status = response.statusCode ?? 200;
          const responseBody = Buffer.concat(chunks);
          resolveResponse(
            new Response(status === 204 || status === 304 ? null : responseBody, { status }),
          );
        });
      },
    );
    request.once("error", rejectResponse);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

async function createSession(baseUrl: string, profile: string) {
  const response = await fetch(`${baseUrl}/local/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  assert.equal(response.status, 201);
  return ((await response.json()) as { handle: string }).handle;
}

async function serviceRequest(
  baseUrl: string,
  handle: string,
  path: string,
  method = "GET",
  body?: object,
) {
  return loopbackHttpFetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${handle}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("Mini, User Web, and Admin share one care-record ID through independent receipts and restart", async (t) => {
  const coreRoot = process.env.LOCAL_SYNTHETIC_CORE_ROOT;
  assert.ok(
    coreRoot,
    "set LOCAL_SYNTHETIC_CORE_ROOT to the existing local-synthetic service worktree",
  );
  const serverUrl = pathToFileURL(
    resolve(coreRoot, "apps/api/dist/src/local-synthetic/server.js"),
  ).href;
  const { buildLocalSyntheticServer } = (await import(serverUrl)) as {
    buildLocalSyntheticServer(input: { mode: "local-synthetic" }): Promise<LocalServer>;
  };
  let service = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const serviceBaseUrl = await service.start(0);
  const servicePort = new URL(serviceBaseUrl).port;
  miniServiceBaseUrl = serviceBaseUrl;
  installMiniGlobals();
  let user = await startPreview(resolve(projectRoot, "apps/user-web"), servicePort);
  let admin = await startPreview(resolve(projectRoot, "apps/admin-web"), servicePort);
  t.after(async () => {
    await Promise.all([user.stop(), admin.stop(), service.close()]);
  });

  for (const [baseUrl, route] of [
    [user.baseUrl, "/staff/report"],
    [user.baseUrl, "/web/parent/home"],
    [admin.baseUrl, "/admin/care-record-review"],
  ]) {
    const page = await fetch(`${baseUrl}${route}`);
    assert.equal(page.status, 200, `${route} must resolve in its local preview`);
    assert.match(page.headers.get("content-type") ?? "", /^text\/html/u);
  }

  const userRequests: string[] = [];
  const adminRequests: string[] = [];
  const loopbackFetcher =
    (seen: string[], previewOrigin: string) =>
    async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.hostname, "127.0.0.1", "care-record clients must stay on loopback");
      seen.push(`${init?.method ?? "GET"} ${url.pathname}`);
      const headers = new Headers(init?.headers);
      if (init?.method && init.method !== "GET") headers.set("Origin", previewOrigin);
      return loopbackHttpFetch(input, { ...init, headers });
    };
  const webModule = (await import(
    pathToFileURL(resolve(projectRoot, "apps/user-web/dist/local-synthetic/care-record-client.js"))
      .href
  )) as {
    CareRecordClient: new (options: {
      baseUrl: string;
      fetcher: typeof fetch;
    }) => CareRecordWebClient;
  };
  const adminModule = (await import(
    pathToFileURL(resolve(projectRoot, "apps/admin-web/dist/local-review/care-record-client.js"))
      .href
  )) as {
    CareRecordReviewClient: new (options: {
      baseUrl: string;
      fetcher: typeof fetch;
    }) => CareRecordAdminClient;
  };

  const parentHandle = await createSession(serviceBaseUrl, "parent-alpha");
  const ownerHandle = await createSession(serviceBaseUrl, "owner-east");
  const bindingResponse = await serviceRequest(
    serviceBaseUrl,
    parentHandle,
    "/local/binding-applications",
    "POST",
    { student: "student-alpha", relationship: "GUARDIAN" },
  );
  assert.equal(bindingResponse.status, 201);
  const binding = (await bindingResponse.json()) as { id: string; version: number };
  const approved = await serviceRequest(
    serviceBaseUrl,
    ownerHandle,
    `/local/binding-applications/${binding.id}/review`,
    "POST",
    { version: binding.version, action: "approve" },
  );
  assert.equal(approved.status, 200);
  const secondParentHandle = await createSession(serviceBaseUrl, "parent-beta");
  const secondBindingResponse = await serviceRequest(
    serviceBaseUrl,
    secondParentHandle,
    "/local/binding-applications",
    "POST",
    { student: "student-alpha", relationship: "GUARDIAN" },
  );
  assert.equal(secondBindingResponse.status, 201);
  const secondBinding = (await secondBindingResponse.json()) as { id: string; version: number };
  const secondApproved = await serviceRequest(
    serviceBaseUrl,
    ownerHandle,
    `/local/binding-applications/${secondBinding.id}/review`,
    "POST",
    { version: secondBinding.version, action: "approve" },
  );
  assert.equal(secondApproved.status, 200);
  const employee = new webModule.CareRecordClient({
    baseUrl: user.baseUrl,
    fetcher: loopbackFetcher(userRequests, user.baseUrl),
  });
  await employee.connect("teacher-east");
  assert.equal(employee.snapshot.status, "READY");
  await employee.create(
    {
      arrival: "ARRIVED_AS_PLANNED",
      homework: "COMPLETED",
      meal: "FINISHED",
      rest: "RESTED",
      activity: "PARTICIPATED",
      wellbeing: "ROUTINE",
    },
    "2026-10-10",
  );
  const draft = employee.snapshot.records[0]!;
  await employee.command(draft.id, draft.version, "submit");
  const submitted = employee.snapshot.records[0]!;
  assert.equal(submitted.id, draft.id);
  assert.equal(submitted.status, "SUBMITTED");
  assert.equal(submitted.version, draft.version + 1);

  const miniStaff = await loadMiniPage("staff/quick-action");
  await selectMiniProfile(miniStaff, "teacher-east");
  await invokeMini(miniStaff, "handleSharedRefresh");
  const miniSubmitted = miniShared(miniStaff).care.find((record) => record.id === draft.id);
  assert.equal(miniSubmitted?.id, draft.id);
  assert.equal(miniSubmitted?.status, "SUBMITTED");
  assert.equal(miniSubmitted?.version, submitted.version);
  const reviewer = new adminModule.CareRecordReviewClient({
    baseUrl: admin.baseUrl,
    fetcher: loopbackFetcher(adminRequests, admin.baseUrl),
  });
  await reviewer.connect("owner-east");
  const reviewRow = reviewer.snapshot.records.find((record) => record.id === draft.id);
  assert.equal(reviewRow?.status, "SUBMITTED");
  assert.equal(reviewRow?.version, submitted.version);
  await reviewer.review(draft.id, reviewRow!.version, "CONFIRM");
  const confirmed = reviewer.snapshot.records.find((record) => record.id === draft.id)!;
  assert.equal(confirmed.status, "CONFIRMED");
  assert.equal(confirmed.version, reviewRow!.version + 1);
  await reviewer.publish(draft.id, confirmed.version);
  const published = reviewer.snapshot.records.find((record) => record.id === draft.id)!;
  assert.equal(published.published, true);
  assert.equal(published.version, confirmed.version + 1);
  const parent = new webModule.CareRecordClient({
    baseUrl: user.baseUrl,
    fetcher: loopbackFetcher(userRequests, user.baseUrl),
  });
  await parent.connect("parent-alpha");
  const visible = parent.snapshot.parentRecords.find((record) => record.id === draft.id);
  assert.equal(visible?.id, draft.id);
  assert.equal(visible?.version, published.version);
  assert.equal(visible?.receipt, "UNREAD");
  await parent.receipt(draft.id, visible!.version, "read");
  assert.equal(parent.snapshot.parentRecords[0]?.receipt, "READ");
  assert.equal(parent.snapshot.parentRecords[0]?.id, draft.id);
  await parent.receipt(draft.id, visible!.version, "acknowledge");
  assert.equal(parent.snapshot.parentRecords[0]?.receipt, "ACKNOWLEDGED");
  assert.equal(parent.snapshot.parentRecords[0]?.id, draft.id);
  assert.equal(parent.snapshot.parentRecords[0]?.version, visible!.version);
  const miniParent = await loadMiniPage("parent/home");
  await selectMiniProfile(miniParent, "parent-alpha");
  const miniAlpha = miniShared(miniParent).care.find((record) => record.id === draft.id);
  assert.equal(miniAlpha?.id, draft.id);
  assert.equal(miniAlpha?.version, published.version);
  assert.equal(miniAlpha?.receipt, "ACKNOWLEDGED", "Mini sees the User Web parent's receipt");

  await selectMiniProfile(miniParent, "parent-beta");
  const miniVisible = miniShared(miniParent).care.find((record) => record.id === draft.id);
  assert.equal(miniVisible?.id, draft.id);
  assert.equal(miniVisible?.version, published.version);
  assert.equal(
    miniVisible?.receipt,
    "UNREAD",
    "the second guardian does not inherit the first receipt",
  );
  await miniCareAction(miniParent, "care-read", miniVisible!);
  const miniRead = miniShared(miniParent).care.find((record) => record.id === draft.id)!;
  assert.equal(miniRead.receipt, "READ");
  assert.ok((miniRead.details?.length ?? 0) > 0);
  await miniCareAction(miniParent, "care-acknowledge", miniRead);
  const miniAcknowledged = miniShared(miniParent).care.find((record) => record.id === draft.id)!;
  assert.equal(miniAcknowledged.receipt, "ACKNOWLEDGED");
  assert.ok(userRequests.some((request) => request.includes("/local/care-records")));
  assert.ok(adminRequests.some((request) => request.includes("/local/care-records")));

  const revokeVersion = reviewer.snapshot.records.find((record) => record.id === draft.id)!.version;
  await reviewer.revoke(draft.id, revokeVersion);
  await parent.refresh();
  assert.deepEqual(parent.snapshot.parentRecords, []);
  await invokeMini(miniParent, "handleSharedRefresh");
  assert.equal(miniShared(miniParent).care.length, 0);
  const notAllowedUser = await fetch(`${user.baseUrl}/local/care-records/${draft.id}/review`, {
    method: "POST",
    headers: { origin: user.baseUrl, "content-type": "application/json" },
    body: JSON.stringify({ version: 1, action: "confirm" }),
  });
  assert.equal(notAllowedUser.status, 404);
  const notAllowedAdmin = await fetch(`${admin.baseUrl}/local/care-records/${draft.id}/submit`, {
    method: "POST",
    headers: { origin: admin.baseUrl, "content-type": "application/json" },
    body: JSON.stringify({ version: 1 }),
  });
  assert.equal(notAllowedAdmin.status, 404);

  await Promise.all([user.stop(), admin.stop()]);
  await service.close();
  service = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const restartedBaseUrl = await service.start(Number(servicePort));
  assert.equal(new URL(restartedBaseUrl).port, servicePort);
  miniServiceBaseUrl = restartedBaseUrl;
  const expiredSession = await serviceRequest(restartedBaseUrl, ownerHandle, "/local/session");
  assert.equal(expiredSession.status, 401, "service restart invalidates previous local sessions");

  user = await startPreview(resolve(projectRoot, "apps/user-web"), servicePort);
  admin = await startPreview(resolve(projectRoot, "apps/admin-web"), servicePort);
  const restartedEmployee = new webModule.CareRecordClient({
    baseUrl: user.baseUrl,
    fetcher: loopbackFetcher(userRequests, user.baseUrl),
  });
  await restartedEmployee.connect("teacher-east");
  assert.deepEqual(restartedEmployee.snapshot.records, []);
  const restartedParent = new webModule.CareRecordClient({
    baseUrl: user.baseUrl,
    fetcher: loopbackFetcher(userRequests, user.baseUrl),
  });
  await restartedParent.connect("parent-alpha");
  assert.deepEqual(restartedParent.snapshot.parentRecords, []);
  const restartedReviewer = new adminModule.CareRecordReviewClient({
    baseUrl: admin.baseUrl,
    fetcher: loopbackFetcher(adminRequests, admin.baseUrl),
  });
  await restartedReviewer.connect("owner-east");
  assert.deepEqual(restartedReviewer.snapshot.records, []);

  await invokeMini(miniParent, "handleSharedRefresh");
  assert.equal(miniShared(miniParent).status, "DISCONNECTED");
  assert.equal(miniShared(miniParent).care.length, 0);
  assert.equal(miniShared(miniStaff).status, "DISCONNECTED");
  assert.equal(miniShared(miniStaff).care.length, 0);
  await selectMiniProfile(miniStaff, "teacher-east");
  assert.equal(miniShared(miniStaff).care.length, 0);
  assert.equal(miniShared(miniParent).care.length, 0);
  await selectMiniProfile(miniParent, "parent-alpha");
  assert.equal(miniShared(miniParent).care.length, 0);
  assert.ok(miniRequests.length > 0);
  assert.ok(miniRequests.every((request) => request.startsWith("http://127.0.0.1:")));
  t.diagnostic(
    `${draft.id}: draft v${draft.version} -> submitted v${submitted.version} -> confirmed v${confirmed.version} -> published v${published.version}; Web parent ACKNOWLEDGED; Mini parent-alpha ACKNOWLEDGED; Mini parent-beta UNREAD -> READ -> ACKNOWLEDGED; revoke hides both parent projections; restarted service rejects old session and all new projections are empty; loopback-only requests (${miniRequests.length} Mini calls).`,
  );
});
