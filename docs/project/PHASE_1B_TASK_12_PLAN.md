# Phase 1B Task 12 File Upload and COS Adapter Boundary Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define a server-scoped file upload boundary with deterministic fake
storage, safe scan state, short-lived upload intent, and scoped read links.

**Architecture:** A future API service will validate file metadata and resolve
tenant/campus scope from trusted identity and active membership before creating
pending records or intents. A narrow storage port will be exercised first by a
deterministic provider fake; a future COS adapter will implement the same port
without placing credentials or provider URLs in domain responses.

**Tech Stack:** Existing Fastify/TypeScript API patterns, existing auth and scope
contracts, existing in-memory synthetic fixtures, Node test runner, TypeScript,
ESLint, and Prettier. No new dependency is planned.

---

## Current anchors and preconditions

```text
TASK_ID=PHASE_1B_TASK_12
TASK_NAME=FILE_UPLOAD_AND_COS_ADAPTER_BOUNDARY
STAGE=STAGE_C2_ACCEPTANCE
STATUS=ACCEPTED_AND_FROZEN
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=e0cefee6417835ee7af24f572dfa76c82a5c3e63
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V20.md
ACTIVE_GOVERNANCE_SHA256=364E3A1C92CEED9400288B2D158497FFD207DA73F6E3F19CA17475D4208C52FC
DEPENDENCY_AUTHORITY_PATH=docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md
DEPENDENCY_AUTHORITY_SHA256=B7F7509914399DD660D02F6FFD52E735EDF9EA850C0BF5C92F95698D8104F007
TASK_02_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_03_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_05_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_12_DEPENDENCY_ORDER=T02|T03|T05
TASK_10_STAGE_B_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_10_STAGE_B_STATUS=NOT_STARTED_OWNER_AUTHORIZATION_REQUIRED
TASK_12_STAGE_A_AUTHORIZATION=GRANTED
TASK_12_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_B_AUTHORIZATION=GRANTED
TASK_12_STAGE_B_COMMIT=e0cefee6417835ee7af24f572dfa76c82a5c3e63
TASK_12_STAGE_B_PARENT=b856fd809b2ee00e12907d1fd28a5c6186e6b8a2
TASK_12_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_C1_AUTHORIZATION=GRANTED
TASK_12_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_C2_AUTHORIZATION=GRANTED
TASK_12_STAGE_C2_STATUS=ACCEPTED
TASK_12_STATUS=ACCEPTED_AND_FROZEN
TASK_12_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_12_ACCEPTANCE.md
TASK_12_ACCEPTANCE_SHA256=909A8153FA681F3C5951B236755A0147049F0FA13A9828F8BBB0381D2AA04908
TASK_12_STARTED=YES_STAGE_C2_ACCEPTED
TASK_12_ROUTE_REPAIR_AUTHORIZATION=NOT_GRANTED
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
```

Task 12 Stage A passed owner review. Stage B was separately authorized,
implemented in commit `e0cefee6417835ee7af24f572dfa76c82a5c3e63` with parent
`b856fd809b2ee00e12907d1fd28a5c6186e6b8a2`, and passed owner review. Under V20,
Task 12 C2 is accepted and frozen. The dependency order remains
`T02 -> T03 -> T05`; Task 02, Task 03, and Task 05 remain accepted and frozen.
Task 10 Stage B, Task 11, Task 12 route repair, and Task 13+ remain
unauthorized. The C1 evidence and C2 acceptance remain protected inputs.

## Exact files

### Stage A files

Only these two files may be created during this formalization:

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md
STAGE_A_WRITE_POLICY=CREATE_ONLY_THE_TWO_EXACT_FILES
STAGE_A_GIT_POLICY=NO_ADD|NO_STAGE|NO_COMMIT|NO_PUSH|NO_PR|NO_DEPLOY
```

### Future Stage B files

The future implementation and test boundary is exactly:

```text
STAGE_B_EXACT_FILES=apps/api/src/modules/files/file.service.ts|apps/api/src/adapters/cos.storage.ts|apps/api/src/routes/file-intent.route.ts|apps/api/src/modules/files/file.test.ts
```

These four paths must not be created, modified, staged, or committed in Stage A.
Stage B may not add route registration, shared contracts, auth types, package
configuration, schemas, migrations, verifiers, or other paths without a new
authority and explicit owner approval.

## Scope contract

Task 12 consumes a file storage baseline, declared purpose, checksum, and
server-derived scope. It produces a pending file record, short-lived upload
intent, scan state, and scoped read link. It does not authorize public file
content, arbitrary downloads, direct provider access, file upload from a real
client, production persistence, or a COS deployment.

The service must preserve:

- server-derived `tenant_id` and `campus_id` from trusted identity;
- active membership, allowed campus scope, and required capability;
- declared-purpose and file-metadata allowlists;
- checksum validation over the accepted bytes;
- pending, scanning, approved, and rejected lifecycle states;
- short-lived, scope-bound, purpose-bound upload intents;
- scoped read links issued only after an approved scan;
- explicit responses that exclude provider URLs and internal storage metadata.

The exact red intent from the approved Phase 1B plan is preserved: disallowed
MIME, oversized file, foreign key, expired link, and unsigned access must fail.
The exact green intent is also preserved: a valid synthetic image passes the fake
scan and foreign object access remains denied. The planned commit description is
`feat: add scoped file storage adapter boundary`.

## Trust, privacy, and fail-closed rules

The future service must resolve `tenant_id` and `campus_id` from trusted identity,
active membership, allowed campus scope, and capability before accepting any file
operation. Client claims for tenant, campus, role, membership, file ownership,
purpose, checksum, MIME, file key, scan state, expiry, signature, or provider URL
are untrusted and cannot widen access.

Every record and storage operation must be bound to the server-derived scope.
Foreign tenant or campus keys, disallowed campus, missing/inactive/suspended
membership, missing capability, unknown purpose, disallowed MIME, oversized
content, checksum mismatch, malformed or foreign key, expired or reused intent,
pending or failed scan state, expired link, and unsigned access must fail closed.

Denied operations must not mutate the pending record, consume an intent, alter
scan state, issue a read link, write a successful audit event, or leak provider
details. A valid file becomes readable only after the fake scan reaches the
approved state and the caller passes the same scope, membership, capability, and
purpose checks.

Only clearly fictional synthetic fixtures may be used. No real child or family
data, contact details, photographs, credentials, secrets, provider tokens,
external URLs, network requests, production database, persistent production
state, or migration is permitted. COS credentials must remain outside source,
fixtures, logs, review artifacts, and Git.

## Storage port and provider fake design

The domain service owns validation, scope, lifecycle, and audit decisions. It
depends on a narrow storage port with operations sufficient to stage bytes,
inspect metadata, issue a scoped read intent, and keep provider details behind
the adapter boundary.

The provider fake is the first implementation and must be deterministic and
in-memory. It should record only synthetic object metadata and bytes needed by
the tests. A future COS adapter may implement the same port, but no live COS
request, credential loading, registry access, or deployment belongs in Stage B.

The port must keep these concerns separate:

1. Metadata validation: declared purpose, allowlisted MIME, bounded byte size,
   checksum, and server-derived scope.
2. Pending lifecycle: pending file record, short-lived intent, scan state, and
   approved/rejected outcome.
3. Upload intent: short-lived, purpose-bound, scope-bound, single-use, and
   invalid after expiry or consumption.
4. Read access: scoped read link or read intent only for an approved file and an
   authorized caller.
5. Provider implementation: deterministic fake now; COS adapter later, with
   credentials supplied outside source code.

## Future Stage B execution plan

### Task 1: Confirm Stage B preconditions

Files: none.

- [ ] Confirm the live branch is `feature/phase-1b-task-04-identity-membership`.
- [ ] Confirm Task 02, Task 03, and Task 05 remain accepted and frozen.
- [ ] Confirm the dependency order is exactly `T02 -> T03 -> T05`.
- [ ] Confirm Task 12 has a separate owner authorization naming exactly the four
      Stage B files.
- [ ] Confirm Task 10 Stage B remains unauthorized and no Task 11+ work started.
- [ ] Confirm no unknown path, dependency change, package/config change, schema,
      migration, verifier, or protected evidence drift exists.

Run:

```text
git status --short --branch --untracked-files=all
git rev-parse HEAD
git diff --check
git diff --cached --check
```

Expected: the authorized checkout is current, protected inputs remain unchanged,
and no unapproved path is present. Any failed precondition blocks Stage B.

### Task 2: Write the failing storage and service tests

File: `apps/api/src/modules/files/file.test.ts`

- [ ] Add synthetic fixtures for an authorized staff identity, inactive or
      suspended membership, a foreign tenant, a disallowed campus, an approved
      campus, a valid synthetic image, a draft/pending file, an oversized file,
      a disallowed MIME, a checksum mismatch, an expired intent, and an unsafe
      or foreign key.
- [ ] Assert disallowed MIME, oversized file, foreign key, expired link, and
      unsigned access fail as required by the source plan.
- [ ] Assert missing/inactive/suspended membership, missing capability, foreign
      tenant/campus, disallowed purpose, checksum mismatch, reused intent,
      pending/failed scan, client scope escalation, and invalid metadata fail.
- [ ] Assert denied calls do not change file state, consume an intent, issue a
      read link, or append a successful audit event.
- [ ] Assert a valid synthetic image passes the provider fake scan and a scoped
      authorized caller receives only an approved read projection/link.
- [ ] Assert responses do not include provider URLs, credentials, bucket names,
      storage keys, or raw provider metadata.

Run before implementation:

```text
corepack pnpm --filter @student-care/api build
node --test apps/api/dist/src/modules/files/file.test.js
```

Expected before implementation: the new test fails because the resource service,
storage port, and route do not yet exist. Record the real RED output and do not
weaken assertions to obtain a pass.

### Task 3: Implement the scoped file service

File: `apps/api/src/modules/files/file.service.ts`

- [ ] Define typed synthetic metadata, pending record, scan state, and explicit
      response projections.
- [ ] Resolve server-side tenant/campus scope and active membership/capability
      before accepting bytes or looking up a file key.
- [ ] Validate declared purpose, MIME, size, checksum, key ownership, expiry,
      and scope before delegating to the storage port.
- [ ] Create a short-lived, scope-bound, purpose-bound, single-use upload intent.
- [ ] Keep state transitions explicit: pending -> scanning -> approved or
      rejected; do not make pending or rejected files readable.
- [ ] Return a scoped read link only for an approved file and authorized caller;
      never expose a raw provider URL or storage credential.
- [ ] Keep all denied operations state-preserving and audit-fail-closed.

### Task 4: Implement the storage port and COS adapter boundary

File: `apps/api/src/adapters/cos.storage.ts`

- [ ] Define the narrow adapter interface used by the service.
- [ ] Implement the deterministic in-memory provider fake required by tests.
- [ ] Keep provider-specific URL, bucket, object key, credential, and response
      details private to the adapter boundary.
- [ ] Do not call COS, read credentials, access a registry, or add a production
      provider configuration in this task.

### Task 5: Implement the file-intent route

File: `apps/api/src/routes/file-intent.route.ts`

- [ ] Expose only the approved internal intent/read operations required by the
      service contract.
- [ ] Map validation, scope, expiry, signature, and scan failures to the
      repository's existing fail-closed status/error envelope.
- [ ] Reject visitor/public access and client-supplied scope or ownership claims.
- [ ] Keep route responses to explicit safe projections with no provider URL.

### Task 6: Run focused GREEN and regression checks

Run exactly:

```text
corepack pnpm --filter @student-care/api typecheck
corepack pnpm --filter @student-care/api lint
corepack pnpm --filter @student-care/api build
corepack pnpm --filter @student-care/api build && node --test apps/api/dist/src/modules/files/file.test.js
corepack pnpm exec prettier --check apps/api/src/modules/files/file.service.ts apps/api/src/adapters/cos.storage.ts apps/api/src/routes/file-intent.route.ts apps/api/src/modules/files/file.test.ts
```

Expected GREEN evidence: all commands exit zero, the focused tests pass, the
provider fake is deterministic, and no COS/network/credential access occurs.
Any existing unrelated verifier failure must be reported as-is; do not repair or
bypass it within Task 12.

### Task 7: Inspect the Stage B boundary and commit

- [ ] Run `git diff --check` and `git diff --cached --check`.
- [ ] Confirm only the four exact Stage B files changed.
- [ ] Confirm no provider URL, secret, real personal data, dependency, package
      change, schema, migration, verifier change, or unrelated route was added.
- [ ] Explicitly stage only the four Stage B paths after all focused checks pass.
- [ ] Inspect the staged diff and commit with:

```text
feat: add scoped file storage adapter boundary
```

The Stage B execution record above is complete and owner-reviewed. The current
The historical V19 C1 execution boundary remains a protected evidence record:

```text
TASK_12_STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_12_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_12.txt|artifacts/review-package/student-care-platform-phase1b-task-12-review-pack-v1.0.zip
TASK_12_STAGE_C1_GIT_POLICY=CREATE_UNCOMMITTED_EVIDENCE_ONLY
TASK_12_STAGE_C1_MEMBER_COUNT=10
TASK_12_STAGE_C1_MEMBER_ORDER=POSIX_RELATIVE_PATHS_CASEFOLDED_UNICODE_ORDINAL_ASCENDING
TASK_12_STAGE_C1_FIRST_MEMBER=apps/api/package.json
TASK_12_STAGE_C1_FIXED_TIMESTAMP=1980-01-01T00:00:00
TASK_12_STAGE_C2_AUTHORIZATION=GRANTED
TASK_12_STAGE_C2_STATUS=ACCEPTED
TASK_12_STATUS=ACCEPTED_AND_FROZEN
TASK_12_ROUTE_REPAIR_AUTHORIZATION=NOT_GRANTED
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK12_STAGE_C1_BEFORE_C2
STOP_REASON=TASK12_STAGE_C1_OWNER_REVIEW_GATE_BEFORE_C2
```

The C1 review recorded that `apps/api/src/server.ts` does not register the
Task 12 route module; no global endpoint reachability may be claimed. C2
acceptance does not authorize route repair or Task 13+.

## Future evidence lifecycle placeholders

The original lifecycle design is retained here as historical context; the active
status is governed by V20:

```text
STAGE_C1=REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP_AFTER_STAGE_B_OWNER_REVIEW
STAGE_C1_AUTHORIZATION=GRANTED
STAGE_C2=ACCEPTANCE_RECORD_ONLY_AFTER_C1_OWNER_PASS
STAGE_C2_AUTHORIZATION=GRANTED
STAGE_C2_STATUS=ACCEPTED
TASK_12_STATUS=ACCEPTED_AND_FROZEN
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
```

The three C1 evidence files and the C2 acceptance record are protected evidence.
No Task 10 Stage B, Task 11, route repair, or Task 13+ implementation is
authorized.

## Current C1 stop condition

After the review, detached manifest, and deterministic ZIP pass all required
checks, leave them uncommitted for owner review. The final status is:

```text
TASK_12_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_B_AUTHORIZATION=GRANTED
TASK_12_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_C1_AUTHORIZATION=GRANTED
TASK_12_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_C2_AUTHORIZATION=GRANTED
TASK_12_STAGE_C2_STATUS=ACCEPTED
TASK_12_STARTED=YES_STAGE_C2_ACCEPTED
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
TASK_12_STATUS=ACCEPTED_AND_FROZEN
TASK_12_ROUTE_REPAIR_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V20_GOVERNANCE_SYNC_BEFORE_TASK10_STAGE_B
STOP_REASON=V20_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```
