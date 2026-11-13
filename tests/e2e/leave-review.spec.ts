import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.cwd();

async function load<T>(relativePath: string): Promise<T> {
  return (await import(pathToFileURL(path.join(root, relativePath)).href)) as T;
}

test("staff leave-review route renders scoped history and same-scope batch controls", async () => {
  const routes = await load<{
    selectStaffRoute(access: unknown, key: "leave-review"): { kind: string; path: string };
  }>("apps/user-web/dist/routes/staff.routes.js");
  const page = await load<{
    createSyntheticStaffLeaveState(): { requests: readonly { id: string; version: number }[] };
    projectStaffLeaveReview(input: { access: unknown; state: unknown }): {
      kind: string;
      html: string;
      externalRequests: readonly string[];
    };
    batchReviewStaffLeaveRequests(
      state: unknown,
      access: unknown,
      commands: readonly { requestId: string; version: number; decision: "CONFIRM" | "RETURN" }[],
    ): { ok: boolean; state: unknown };
  }>("apps/user-web/dist/pages/staff-leave-review.js");
  const access = {
    session: "synthetic-staff-session",
    membership: "active",
    role: "teacher",
    capabilities: ["employee:workbench", "teacher:leave-review"],
    tenantId: "tenant-synthetic-a",
    campusId: "campus-synthetic-east",
    classIds: ["class-synthetic-grade3-a"],
  };
  assert.deepEqual(routes.selectStaffRoute(access, "leave-review"), {
    kind: "authorized",
    path: "/staff/report?view=leave-review",
  });
  const state = page.createSyntheticStaffLeaveState();
  const view = page.projectStaffLeaveReview({ access, state });
  assert.equal(view.kind, "ready");
  assert.match(view.html, /批量确认/u);
  assert.match(view.html, /aria-live="polite"/u);
  assert.deepEqual(view.externalRequests, []);

  const rejected = page.batchReviewStaffLeaveRequests(state, access, [
    { requestId: state.requests[0]!.id, version: 1, decision: "CONFIRM" },
    { requestId: "leave-web-synthetic-other-class", version: 1, decision: "CONFIRM" },
  ]);
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, state);
  const mainSource = readFileSync(path.join(root, "apps/user-web/src/main.ts"), "utf8");
  assert.match(mainSource, /URLSearchParams\(window\.location\.search\)\.get\("view"\)/u);
  assert.match(mainSource, /href="\/staff\/report\?view=leave-review"/u);
  assert.match(mainSource, /data-leave-batch/u);
  assert.doesNotMatch(mainSource, /fetch\s*\(|XMLHttpRequest/u);
});
