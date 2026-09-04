# Phase 1B Governance and API Framework Authority V15

This authority supersedes V14 for the Task 09 authorization state.
V14 and all earlier authorities remain HISTORICAL/FROZEN and are not
modified.

## Authority

```text
AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V15
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V15.md
AUTHORITY_STATUS=READY_FOR_OWNER_REVIEW
AUTHORITY_OWNER_DECISION=RECORD_TASK09_STAGE_A_REVIEW_AND_STAGE_B_AUTHORIZATION
AUTHORITY_OWNER_APPROVAL_SOURCE=Current explicit project-owner delegation for Task 09 V15 governance synchronization dated 2026-09-04; no separate evidence identifier supplied
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V14.md
AUTHORITY_SUPERSEDES_SHA256=34323408892CC933F96DF1EA95F92F7A4F64D530B1851A24608BD78CE872B339
AUTHORITY_SHA256=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
AUTHORITY_SHA256_SCOPE=WHOLE_FILE
AUTHORITY_ENCODING=UTF-8
AUTHORITY_BOM=NO
AUTHORITY_LINE_ENDING=LF
AUTHORITY_TRAILING_LF=EXACTLY_ONE
```

## Current active governance

```text
BATCH_B_PROJECT_OWNER_ACCEPTANCE=PASS
PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_08_C2_ACCEPTANCE_AND_TASK_09_STAGE_B_AUTHORIZATION_ONLY
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03|TASK_04|TASK_05|TASK_06|TASK_07|TASK_08
TASK_01_TO_TASK_08_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_08_STATUS=ACCEPTED_AND_FROZEN
TASK_08_STAGE_C2_STATUS=ACCEPTED
TASK_08_STAGE_C2_AUTHORIZATION=GRANTED
TASK_09_STARTED=NO
TASK_09_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_STATUS=NOT_STARTED
TASK_09_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_09_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_10_PLUS_STARTED=NO
TASK_10_PLUS_AUTHORIZATION=NOT_GRANTED
```

Task 09 Stage A contract and plan formalization was reviewed and passed by
the project owner. The current owner delegation records Task 09 Stage B
implementation as authorized, but no Task 09 implementation has started in
this synchronization. Stage B remains limited to its exact four-file
implementation and test whitelist. Task 09 C1 and C2 remain separately
unauthorized.

The historical `scripts/verify_task_06.mjs` boundary failure remains an
independent historical blocker. It is not repaired, weakened, bypassed, or
used to authorize any later task.

## Task 09 Stage B boundary

Task 09 is **Newcomer guides**. It depends on accepted and frozen Tasks 05
and 07 (`T05 -> T07`). The authorized Stage B implementation/test whitelist
is exactly:

```text
TASK_09_STAGE_B_EXACT_FILES=apps/api/src/modules/guides/guide.service.ts|apps/api/src/routes/staff-guides.route.ts|apps/user-web/src/pages/staff-guides.tsx|apps/api/src/modules/guides/guide.test.ts
TASK_09_STAGE_B_WRITE_POLICY=EXACT_WHITELIST_ONLY
TASK_09_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_STATUS=NOT_STARTED
TASK_09_STAGE_B_COMMIT_REFERENCE=feat: add scoped newcomer guides
```

The approved slice accepts staff role policy, versioned content, and a file
access port as inputs and produces a searchable internal guide list and
detail projection. Visitor access, suspended membership, and guides outside
the allowed campus scope must fail closed. Authorized synthetic staff may
search and read only allowed versions using bounded filters.

No other repository path is included in this Stage B whitelist. If the
implementation requires a shared entry point, contract, verifier, package
script, lockfile, schema, migration, or other path, execution must stop and
obtain a new explicit authority and exact whitelist.

## API, data, and safety boundary

The API remains Fastify 5.12.1 on Node 24.14.0 with pnpm 11.22.0. Every
institution and campus object remains tenant and campus isolated. The server
must derive trusted identity, active membership, allowed campus scope,
capability, publication, version, ownership, and file access scope. Client
claims cannot widen access or authorize writes.

Guides are internal staff content. Visitor access, inactive or suspended
membership, foreign tenant or campus, disallowed campus, missing capability,
unauthorized versions, unbounded search, and unapproved file references must
fail closed without unintended state changes or successful audit results.
Internal management, membership, tenant/campus, moderation, audit, provider,
and unsafe file details must not leak.

Only clearly synthetic fixtures and fictional labels are permitted. No real
personal data, credentials, production data, network service, external
provider, production database, migration, deployment, or production login is
authorized.

## Lifecycle and next-task boundary

```text
TASK_09_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_STATUS=NOT_STARTED
TASK_09_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_09_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_09_STARTED=NO
TASK_10_PLUS_STARTED=NO
TASK_10_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V15_BEFORE_TASK09_STAGE_B
STOP_REASON=OWNER_REVIEW_GATE_BEFORE_TASK09_STAGE_B
```

Task 09 Stage B authorization does not authorize C1, C2, Task 10+, or any
implementation outside the exact whitelist. Task 09 C1 requires a separate
owner review gate; Task 09 C2 is an acceptance record only after an explicit
owner pass. Task 10+ remains not started and not authorized.

V15 is a whole-file authority with no self-reference. Its actual SHA-256 is
reported only after the file and all active references are stable and have
passed independent Node and .NET verification. V14 and earlier authorities,
Task 01-08 frozen evidence, the Task 08 C1 evidence, the Task 08 C2
acceptance, the old verifier, and the six existing Task 04/05 untracked
evidence paths remain untouched.
