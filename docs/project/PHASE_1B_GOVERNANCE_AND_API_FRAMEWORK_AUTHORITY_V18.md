# Phase 1B Governance and API Framework Authority V18

This authority supersedes V17 for the post-Task-09 acceptance state and active
Phase 1B governance references. V17 and all earlier authorities remain
HISTORICAL/FROZEN and are not modified.

## Authority

```text
AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V18
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V18.md
AUTHORITY_STATUS=AUTHORIZED_V18_PENDING_OWNER_REVIEW
AUTHORITY_OWNER_DECISION=SYNC_TASK09_STAGE_C2_ACCEPTED_AND_FROZEN_STATE
AUTHORITY_OWNER_APPROVAL_SOURCE=Current explicit project-owner authorization for Phase 1B V18 governance synchronization after Task 09 Stage C2 acceptance
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V17.md
AUTHORITY_SUPERSEDES_SHA256=CF8A20D84EE25F4848E2D3CFE43802AF0BEEE96AE17BF4044038E6B695F92917
CURRENT_HEAD_BEFORE_V18=f13a5f11aa20bb9b0fe793abe9270f707c8562d6
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
PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_09_C2_ACCEPTED_AND_FROZEN
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03|TASK_04|TASK_05|TASK_06|TASK_07|TASK_08|TASK_09
TASK_01_TO_TASK_08_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_08_STATUS=ACCEPTED_AND_FROZEN
TASK_08_STAGE_C2_STATUS=ACCEPTED
TASK_08_STAGE_C2_AUTHORIZATION=GRANTED
TASK_09_STARTED=YES_STAGE_C2_ACCEPTED
TASK_09_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_MODULE_EVIDENCE=EXISTS_IN_ORIGINAL_FOUR_FILES
TASK_09_STAGE_B_ENTRY_REPAIR_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_REPAIR_COMMIT=68d8209e90e48bb3f139173a423f6e768e200fde
TASK_09_STAGE_B_REPAIR_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_09_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_C1_AUTHORIZATION=GRANTED
TASK_09_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_C2_AUTHORIZATION=GRANTED
TASK_09_STAGE_C2_STATUS=ACCEPTED
TASK_09_STATUS=ACCEPTED_AND_FROZEN
TASK_09_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_09_ACCEPTANCE.md
TASK_09_ACCEPTANCE_SHA256=93BC037DEB90D179099F723D86A8409DD486C8D627C1337E734826BC7A70DC62
TASK_09_C2_COMMIT=f13a5f11aa20bb9b0fe793abe9270f707c8562d6
TASK_09_C2_PARENT=dccda0b75a9a69b057126ab44de4c5cdb782fd34
TASK_09_C1_REVIEW_SHA256=11C34F65DC71C458E58E3E79F3F03CFA002398F395123C40BC57C8F07FC3F62A
TASK_09_C1_MANIFEST_SHA256=AB5613C56062E08D32C1A3C3BD2FFB0806D0C068DEFD5D77E44ACAEECEE7AE90
TASK_09_C1_ZIP_SHA256=237DA795845AB4848B3553172830759CDE74728F85C9333ABCA5E33873B8F6D4
GOVERNANCE_SYNC_STATUS=AUTHORIZED_V18_PENDING_OWNER_REVIEW
TASK_10_PLUS_STARTED=NO
TASK_10_PLUS_AUTHORIZATION=NOT_GRANTED
```

Task 09 Stage A formalization, Stage B module evidence and entry repair, C1
review/manifest/deterministic ZIP, and C2 acceptance have separate evidence
and owner gates. The accepted C2 record is frozen at its recorded bytes and
SHA. This authority synchronizes the active references to that accepted state;
it does not rewrite the acceptance record or any C1 evidence.

The historical `scripts/verify_task_06.mjs` boundary failure remains an
independent historical blocker. It is not repaired, weakened, bypassed, or
used to authorize Task 10+.

## Task 09 accepted boundary

Task 09 is **Newcomer guides** and depends on accepted and frozen Tasks 05 and
07 (`T05 -> T07`). Its accepted scope is internal newcomer-guide content with
server-derived tenant and campus isolation, active membership and capability
checks, bounded search, approved publication/version rules, and approved file
references. Visitor access, inactive or suspended membership, foreign tenant
or campus, disallowed campus, unauthorized version, unbounded search, and
unapproved file access fail closed without unintended state changes or a
successful audit result.

The Stage B implementation and repair evidence is limited to the previously
approved original and repair files. C1 evidence is limited to its review,
detached manifest, and deterministic ZIP. C2 is acceptance-only and is
represented by the frozen acceptance record above. No public guide projection,
real personal data, production service, external provider, network, persistent
production database, migration, secret, or credential is authorized.

## Frozen history and future authorization

V17, V16, V15, V14, and all earlier authorities remain HISTORICAL/FROZEN.
Task 01—08 contracts, plans, acceptance records, C1 evidence, and other
frozen evidence remain unchanged. Task 09 contract, plan, Stage B files, C1
evidence, and acceptance record remain unchanged by this governance sync except
for the active references explicitly listed by the V18 whitelist.

The 12 existing Task 04/05/08/09 untracked evidence paths remain protected
inputs and are not read, modified, moved, deleted, staged, packaged, or
committed. Task 10+ has not started and has no implementation authorization.
Any future task requires its own contract, stable authority, owner review and
approval, exact whitelist, and separate implementation authorization. Task 09
C2 acceptance does not authorize Task 10+.

## Active reference and change boundary

```text
V18_ACTIVE_REFERENCE_EXACT_FILES=AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_09_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_09_PLAN.md
V18_EXACT_REPOSITORY_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V18.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_09_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_09_PLAN.md
V18_WRITE_POLICY=EXACT_WHITELIST_ONLY
V18_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
V18_COMMIT_POLICY=ONE_ATOMIC_GOVERNANCE_SYNC_COMMIT
```

Only the V18 authority and the nine active reference files above may change in
this synchronization. Acceptance, C1 artifacts, Task 01—08 frozen evidence,
older authorities, the historical Task 06 verifier, protected untracked
evidence, and any Task 10+ path are excluded.

## Verification and stop gate

```text
NODE_AND_DOTNET_SHA256=REQUIRED_FOR_ALL_TEN_FILES
TEXT_FORMAT=UTF8_NO_BOM_LF_EXACTLY_ONE_TRAILING_LF
NO_SELF_SHA_IN_V18=YES
ACTIVE_REFERENCES_MUST_POINT_TO=V18_AND_EXTERNAL_V18_SHA256
GIT_DIFF_CHECK=REQUIRED
GIT_CACHED_DIFF_CHECK=REQUIRED
EXPLICIT_PATH_STAGING_ONLY=YES
NETWORK_DEPENDENCY_SERVICE_DATABASE_MIGRATION=NO
BRANCH_WORKTREE_GOAL_TASK_DISPATCH=NO
PUSH_PR_DEPLOY=NO
TASK_10_PLUS=NO
```

The synchronization stops at owner review. It does not grant Task 10+ or any
other future implementation permission.

```text
OWNER_REVIEW_GATE=V18_GOVERNANCE_SYNC_BEFORE_TASK10_PLUS
STOP_REASON=V18_GOVERNANCE_SYNC_OWNER_REVIEW_GATE_BEFORE_TASK10
```
