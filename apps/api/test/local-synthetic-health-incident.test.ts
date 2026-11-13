import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Row = Record<string, unknown> & { id: string; version: number };
type Response = { statusCode: number; body: string; json(): unknown };

async function call(app: App, actor: string, method: "GET" | "POST", url: string, body?: unknown) {
  return app.inject({
    method,
    url,
    headers: { host: "127.0.0.1:4317", ...(actor ? { authorization: `Bearer ${actor}` } : {}) },
    ...(body === undefined ? {} : { payload: body as object }),
  } as never) as unknown as Promise<Response>;
}

async function session(app: App, profile: string) {
  const response = await call(app, "", "POST", "/local/sessions", { profile });
  assert.equal(response.statusCode, 201, response.body);
  return (response.json() as { handle: string }).handle;
}

async function approvedBinding(app: App, parent: string, owner: string) {
  const applied = await call(app, parent, "POST", "/local/binding-applications", {
    student: "student-alpha",
    relationship: "GUARDIAN",
  });
  assert.equal(applied.statusCode, 201, applied.body);
  const pending = applied.json() as Row;
  const approved = await call(
    app,
    owner,
    "POST",
    `/local/binding-applications/${pending.id}/review`,
    { version: pending.version, action: "approve" },
  );
  assert.equal(approved.statusCode, 200, approved.body);
  return approved.json() as Row;
}

test("health incident shares one employee-review-publish-parent flow", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const west = await session(app, "owner-west");
    await approvedBinding(app, parent, owner);

    const created = await call(app, teacher, "POST", "/local/health-incidents", {
      student: "student-alpha",
      observationCode: "NEEDS_FOLLOW_UP",
      dispositionCode: "FOLLOW_UP_SCHEDULED",
    });
    assert.equal(created.statusCode, 201, created.body);
    const draft = created.json() as Row;
    assert.equal(draft.status, "DRAFT");
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/health-incidents/${draft.id}/submit`, {
          version: 1,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      ((await call(app, west, "GET", "/local/health-incident-review")).json() as unknown[]).length,
      0,
    );
    const queue = await call(app, owner, "GET", "/local/health-incident-review");
    assert.equal(queue.statusCode, 200, queue.body);
    assert.equal((queue.json() as Row[])[0]?.id, draft.id);
    const confirmed = await call(app, owner, "POST", `/local/health-incidents/${draft.id}/review`, {
      version: 2,
      action: "CONFIRM",
    });
    assert.equal(confirmed.statusCode, 200, confirmed.body);
    assert.equal((confirmed.json() as { status: string }).status, "CONFIRMED");
    const published = await call(
      app,
      owner,
      "POST",
      `/local/health-incidents/${draft.id}/publish`,
      {
        version: 3,
        summaryCode: "FOLLOW_UP_IN_PROGRESS",
      },
    );
    assert.equal(published.statusCode, 200, published.body);
    const current = published.json() as Row;
    assert.equal(current.status, "PUBLISHED");
    const visible = await call(app, parent, "GET", "/local/health-incidents");
    assert.equal(visible.statusCode, 200, visible.body);
    assert.equal((visible.json() as Row[])[0]?.id, draft.id);
    assert.equal((visible.json() as Row[])[0]?.version, 4);
    assert.equal((visible.json() as Row[])[0]?.receiptStatus, "UNREAD");
    assert.equal(
      (await call(app, parent, "POST", `/local/health-incidents/${draft.id}/ack`, { version: 4 }))
        .statusCode,
      409,
    );
    assert.equal(
      (await call(app, parent, "POST", `/local/health-incidents/${draft.id}/read`, { version: 4 }))
        .statusCode,
      200,
    );
    assert.equal(
      (await call(app, parent, "POST", `/local/health-incidents/${draft.id}/ack`, { version: 4 }))
        .statusCode,
      200,
    );
    assert.equal(
      ((await call(app, parent, "GET", "/local/health-incidents")).json() as Row[])[0]
        ?.receiptStatus,
      "ACKNOWLEDGED",
    );
    const revoked = await call(app, owner, "POST", `/local/health-incidents/${draft.id}/revoke`, {
      version: 4,
    });
    assert.equal(revoked.statusCode, 200, revoked.body);
    assert.equal((revoked.json() as { status: string }).status, "REVOKED");
    assert.deepEqual((await call(app, parent, "GET", "/local/health-incidents")).json(), []);
  } finally {
    await app.close();
  }
});

test("health incident rejects free text, stale versions, invalid scope and unapproved parent", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const platform = await session(app, "platform-admin");
    assert.equal(
      (
        await call(app, teacher, "POST", "/local/health-incidents", {
          student: "student-alpha",
          observationCode: "free text",
        })
      ).statusCode,
      403,
    );
    assert.deepEqual((await call(app, parent, "GET", "/local/health-incidents")).json(), []);
    await approvedBinding(app, parent, owner);
    const created = (
      await call(app, teacher, "POST", "/local/health-incidents", {
        student: "student-alpha",
        observationCode: "ROUTINE_OBSERVATION",
        dispositionCode: "OBSERVATION_RECHECKED",
      })
    ).json() as Row;
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/health-incidents/${created.id}/submit`, {
          version: 99,
        })
      ).statusCode,
      409,
    );
    assert.equal((await call(app, platform, "GET", "/local/health-incidents")).statusCode, 403);
    assert.equal(
      (
        await call(app, owner, "POST", `/local/health-incidents/${created.id}/review`, {
          version: 1,
          action: "CONFIRM",
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("health incident author can edit a draft and a returned record with fixed options", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    await approvedBinding(app, parent, owner);
    const create = async () =>
      (
        await call(app, teacher, "POST", "/local/health-incidents", {
          student: "student-alpha",
          observationCode: "NEEDS_FOLLOW_UP",
          dispositionCode: "FOLLOW_UP_SCHEDULED",
        })
      ).json() as Row;

    const draft = await create();
    const editedDraft = await call(
      app,
      teacher,
      "POST",
      `/local/health-incidents/${draft.id}/edit`,
      {
        version: draft.version,
        observationCode: "URGENT_REVIEW",
        dispositionCode: "OBSERVATION_RECHECKED",
      },
    );
    assert.equal(editedDraft.statusCode, 200, editedDraft.body);
    assert.equal((editedDraft.json() as Row).status, "DRAFT");
    assert.equal((editedDraft.json() as Row).version, 2);
    assert.equal((editedDraft.json() as Row).observationCode, "URGENT_REVIEW");

    const returned = await create();
    await call(app, teacher, "POST", `/local/health-incidents/${returned.id}/submit`, {
      version: 1,
    });
    await call(app, owner, "POST", `/local/health-incidents/${returned.id}/review`, {
      version: 2,
      action: "RETURN",
    });
    const editedReturned = await call(
      app,
      teacher,
      "POST",
      `/local/health-incidents/${returned.id}/edit`,
      {
        version: 3,
        observationCode: "ROUTINE_OBSERVATION",
        dispositionCode: "GUARDIAN_SUMMARY_PREPARED",
      },
    );
    assert.equal(editedReturned.statusCode, 200, editedReturned.body);
    assert.equal((editedReturned.json() as Row).status, "DRAFT");
    assert.equal((editedReturned.json() as Row).version, 4);

    assert.equal(
      (
        await call(app, teacher, "POST", `/local/health-incidents/${draft.id}/edit`, {
          version: 1,
          observationCode: "URGENT_REVIEW",
          dispositionCode: "OBSERVATION_RECHECKED",
        })
      ).statusCode,
      409,
      "stale edit versions must fail",
    );
    assert.ok(
      [400, 403].includes(
        (
          await call(app, teacher, "POST", `/local/health-incidents/${draft.id}/edit`, {
            version: 2,
            observationCode: "URGENT_REVIEW",
            dispositionCode: "OBSERVATION_RECHECKED",
            notes: "free text is forbidden",
          })
        ).statusCode,
      ),
    );
    assert.equal(
      (
        await call(app, owner, "POST", `/local/health-incidents/${draft.id}/edit`, {
          version: 2,
          observationCode: "URGENT_REVIEW",
          dispositionCode: "OBSERVATION_RECHECKED",
        })
      ).statusCode,
      403,
      "a reviewer cannot edit another person's record",
    );
  } finally {
    await app.close();
  }
});

test("health incident withdrawal is explicit, scoped and hidden from review and parent views", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const west = await session(app, "owner-west");
    await approvedBinding(app, parent, owner);
    const created = await call(app, teacher, "POST", "/local/health-incidents", {
      student: "student-alpha",
      observationCode: "NEEDS_FOLLOW_UP",
      dispositionCode: "FOLLOW_UP_SCHEDULED",
    });
    const draft = created.json() as Row;
    await call(app, teacher, "POST", `/local/health-incidents/${draft.id}/submit`, { version: 1 });

    const withdrawn = await call(
      app,
      teacher,
      "POST",
      `/local/health-incidents/${draft.id}/withdraw`,
      {
        version: 2,
      },
    );
    assert.equal(withdrawn.statusCode, 200, withdrawn.body);
    assert.equal((withdrawn.json() as Row).status, "WITHDRAWN");
    assert.equal((withdrawn.json() as Row).version, 3);
    const owned = (await call(app, teacher, "GET", "/local/health-incident-owned")).json() as Row[];
    assert.ok(
      owned.some((row) => row.id === draft.id && row.status === "WITHDRAWN"),
      "the author history keeps the withdrawn record",
    );
    assert.equal(
      ((await call(app, owner, "GET", "/local/health-incident-review")).json() as Row[]).some(
        (row) => row.id === draft.id,
      ),
      false,
    );
    assert.deepEqual((await call(app, parent, "GET", "/local/health-incidents")).json(), []);
    assert.equal(
      (
        await call(app, west, "POST", `/local/health-incidents/${draft.id}/withdraw`, {
          version: 3,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/health-incidents/${draft.id}/submit`, {
          version: 3,
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("health incident escalation marks manual follow-up and the scoped reviewer can continue", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    await approvedBinding(app, parent, owner);
    const created = await call(app, teacher, "POST", "/local/health-incidents", {
      student: "student-alpha",
      observationCode: "URGENT_REVIEW",
      dispositionCode: "FOLLOW_UP_SCHEDULED",
    });
    const draft = created.json() as Row;
    await call(app, teacher, "POST", `/local/health-incidents/${draft.id}/submit`, { version: 1 });

    const escalated = await call(app, owner, "POST", `/local/health-incidents/${draft.id}/review`, {
      version: 2,
      action: "ESCALATE",
    });
    assert.equal(escalated.statusCode, 200, escalated.body);
    assert.equal((escalated.json() as Row).status, "EXCEPTION_PENDING");
    assert.deepEqual((await call(app, parent, "GET", "/local/health-incidents")).json(), []);
    const queue = (await call(app, owner, "GET", "/local/health-incident-review")).json() as Row[];
    assert.ok(queue.some((row) => row.id === draft.id && row.status === "EXCEPTION_PENDING"));
    assert.equal(
      (
        await call(app, owner, "POST", `/local/health-incidents/${draft.id}/review`, {
          version: 3,
          action: "ESCALATE",
        })
      ).statusCode,
      409,
      "manual follow-up cannot be escalated repeatedly",
    );

    const confirmed = await call(app, owner, "POST", `/local/health-incidents/${draft.id}/review`, {
      version: 3,
      action: "CONFIRM",
    });
    assert.equal(confirmed.statusCode, 200, confirmed.body);
    assert.equal((confirmed.json() as Row).status, "CONFIRMED");
    const published = await call(
      app,
      owner,
      "POST",
      `/local/health-incidents/${draft.id}/publish`,
      {
        version: 4,
        summaryCode: "FOLLOW_UP_IN_PROGRESS",
      },
    );
    assert.equal(published.statusCode, 200, published.body);
    const visible = (await call(app, parent, "GET", "/local/health-incidents")).json() as Row[];
    assert.deepEqual(
      visible.map((row) => [row.id, row.version, row.status]),
      [[draft.id, 5, "PUBLISHED"]],
    );
  } finally {
    await app.close();
  }
});

test("fresh reviewers recover all actionable health states without exposing author drafts", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parent = await session(app, "parent-alpha");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    await approvedBinding(app, parent, owner);
    const create = async () =>
      (
        await call(app, teacher, "POST", "/local/health-incidents", {
          student: "student-alpha",
          observationCode: "NEEDS_FOLLOW_UP",
          dispositionCode: "FOLLOW_UP_SCHEDULED",
        })
      ).json() as Row;
    const draft = await create();
    const returned = await create();
    await call(app, teacher, "POST", `/local/health-incidents/${returned.id}/submit`, {
      version: returned.version,
    });
    await call(app, owner, "POST", `/local/health-incidents/${returned.id}/review`, {
      version: 2,
      action: "RETURN",
    });
    const submitted = await create();
    await call(app, teacher, "POST", `/local/health-incidents/${submitted.id}/submit`, {
      version: 1,
    });
    const confirmed = await create();
    await call(app, teacher, "POST", `/local/health-incidents/${confirmed.id}/submit`, {
      version: 1,
    });
    await call(app, owner, "POST", `/local/health-incidents/${confirmed.id}/review`, {
      version: 2,
      action: "CONFIRM",
    });
    const published = await create();
    await call(app, teacher, "POST", `/local/health-incidents/${published.id}/submit`, {
      version: 1,
    });
    await call(app, owner, "POST", `/local/health-incidents/${published.id}/review`, {
      version: 2,
      action: "CONFIRM",
    });
    await call(app, owner, "POST", `/local/health-incidents/${published.id}/publish`, {
      version: 3,
      summaryCode: "FOLLOW_UP_IN_PROGRESS",
    });
    const freshOwner = await session(app, "owner-east");
    const queue = (
      await call(app, freshOwner, "GET", "/local/health-incident-review")
    ).json() as Row[];
    assert.deepEqual(
      queue.map((row) => [row.id, row.status, row.version]),
      [
        [submitted.id, "SUBMITTED", 2],
        [confirmed.id, "CONFIRMED", 3],
        [published.id, "PUBLISHED", 4],
      ],
    );
    assert.ok(!queue.some((row) => row.id === draft.id || row.id === returned.id));
    for (const profile of ["owner-west", "owner-other-tenant"]) {
      const foreign = await session(app, profile);
      assert.deepEqual(
        (await call(app, foreign, "GET", "/local/health-incident-review")).json(),
        [],
      );
      assert.equal(
        (
          await call(app, foreign, "POST", `/local/health-incidents/${confirmed.id}/supplement`, {
            version: 3,
            dispositionCode: "OBSERVATION_RECHECKED",
          })
        ).statusCode,
        403,
      );
    }
    assert.equal(
      (await call(app, teacher, "GET", "/local/health-incident-review")).statusCode,
      403,
    );
    assert.equal(
      (await call(app, freshOwner, "GET", "/local/health-incident-owned")).statusCode,
      403,
    );
    const supplemented = await call(
      app,
      freshOwner,
      "POST",
      `/local/health-incidents/${confirmed.id}/supplement`,
      { version: 3, dispositionCode: "OBSERVATION_RECHECKED" },
    );
    assert.equal(supplemented.statusCode, 200);
    assert.equal(
      (
        await call(app, freshOwner, "POST", `/local/health-incidents/${confirmed.id}/publish`, {
          version: 3,
          summaryCode: "FOLLOW_UP_IN_PROGRESS",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call(app, freshOwner, "POST", `/local/health-incidents/${confirmed.id}/publish`, {
          version: 4,
          summaryCode: "FOLLOW_UP_IN_PROGRESS",
        })
      ).statusCode,
      200,
    );
    await call(app, freshOwner, "POST", `/local/health-incidents/${published.id}/revoke`, {
      version: 4,
    });
    assert.ok(
      !((await call(app, freshOwner, "GET", "/local/health-incident-review")).json() as Row[]).some(
        (row) => row.id === published.id,
      ),
    );
  } finally {
    await app.close();
  }
});

test("parent health projection anchors one approved binding and clears obsolete publication receipts", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const alpha = await session(app, "parent-alpha");
    const beta = await session(app, "parent-beta");
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const binding = await approvedBinding(app, alpha, owner);
    await approvedBinding(app, beta, owner);
    const created = (
      await call(app, teacher, "POST", "/local/health-incidents", {
        student: "student-alpha",
        bindingId: binding.id,
        observationCode: "ROUTINE_OBSERVATION",
        dispositionCode: "OBSERVATION_RECHECKED",
      })
    ).json() as Row;
    await call(app, teacher, "POST", `/local/health-incidents/${created.id}/submit`, {
      version: 1,
    });
    await call(app, owner, "POST", `/local/health-incidents/${created.id}/review`, {
      version: 2,
      action: "CONFIRM",
    });
    assert.deepEqual((await call(app, alpha, "GET", "/local/health-incidents")).json(), []);
    await call(app, owner, "POST", `/local/health-incidents/${created.id}/publish`, {
      version: 3,
      summaryCode: "FOLLOW_UP_IN_PROGRESS",
    });
    const visible = (
      (await call(app, alpha, "GET", "/local/health-incidents")).json() as Row[]
    )[0]!;
    assert.equal(visible.studentId, created.studentId);
    assert.equal(visible.bindingId, binding.id);
    assert.equal(visible.bindingVersion, binding.version);
    assert.equal(visible.version, 4);
    for (const key of [
      "observationCode",
      "dispositionCode",
      "reviewedBy",
      "createdBy",
      "tenantId",
      "campusId",
    ])
      assert.equal(Object.hasOwn(visible, key), false);
    assert.deepEqual((await call(app, beta, "GET", "/local/health-incidents")).json(), []);
    assert.equal(
      (await call(app, beta, "POST", `/local/health-incidents/${created.id}/read`, { version: 4 }))
        .statusCode,
      403,
    );
    await call(app, alpha, "POST", `/local/health-incidents/${created.id}/read`, { version: 4 });
    await call(app, alpha, "POST", `/local/health-incidents/${created.id}/ack`, { version: 4 });
    await call(app, owner, "POST", `/local/health-incidents/${created.id}/supplement`, {
      version: 4,
      dispositionCode: "GUARDIAN_SUMMARY_PREPARED",
    });
    assert.deepEqual((await call(app, alpha, "GET", "/local/health-incidents")).json(), []);
    await call(app, owner, "POST", `/local/health-incidents/${created.id}/publish`, {
      version: 5,
      summaryCode: "FOLLOW_UP_COMPLETED",
    });
    const latest = ((await call(app, alpha, "GET", "/local/health-incidents")).json() as Row[])[0]!;
    assert.equal(latest.version, 6);
    assert.equal(latest.receiptStatus, "UNREAD");
    assert.equal(
      (await call(app, alpha, "POST", `/local/health-incidents/${created.id}/ack`, { version: 4 }))
        .statusCode,
      409,
    );
    await call(app, alpha, "POST", `/local/binding-applications/${binding.id}/release`, {
      version: binding.version,
    });
    await approvedBinding(app, alpha, owner);
    assert.deepEqual(
      (await call(app, alpha, "GET", "/local/health-incidents")).json(),
      [],
      "new relation does not inherit the old bound incident",
    );
  } finally {
    await app.close();
  }
});
