# Phase 1B Task 11 Codex Execution Contract

This contract formalizes Task 11 Stage A and the owner-approved Stage C1
whitelist addendum. The addendum authorizes only bounded C1 evidence
generation after the separately reviewed Stage B implementation; it does not
authorize C2 acceptance or any later task.

## Contract status and authorization

```text
TASK_ID=PHASE_1B_TASK_11
TASK_NAME=PARTNER_CLOUD_SECURITY_ENTRY
STAGE=STAGE_C1_EVIDENCE
STATUS=OWNER_REVIEW_GATE_BEFORE_STAGE_C1
EXECUTION_DATE=2026-09-09
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
TARGET_BRANCH=CURRENT_CHECKOUT_NO_NEW_BRANCH_OR_WORKTREE
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=c6d3fe41d9cfee7c8cd45426c47dc4336cfa7c25
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V23.md
ACTIVE_GOVERNANCE_SHA256=3BA4616D2081488FB4609B0677314773EC366115DDC28E3F5CCDE7B7163082C2
OWNER_AUTHORIZATION_EVIDENCE_ID=PROJECT_OWNER_EXPLICIT_TASK11_STAGE_A_FORMALIZATION_2026-09-09
OWNER_AUTHORIZATION_THREAD_ID=01a05b8d-22d2-7c21-a058-3b074499b89e
OWNER_AUTHORIZATION_SCOPE=STAGE_A_FORMALIZATION_ONLY
STAGE_B_COMMIT=c6d3fe41d9cfee7c8cd45426c47dc4336cfa7c25
STAGE_B_PARENT=9af03352b58c3cb35e6f2782a3ced3057b0d0eca
OWNER_C1_AUTHORIZATION_EVIDENCE_ID=PROJECT_OWNER_EXPLICIT_TASK11_STAGE_C1_WHITELIST_2026-09-09
OWNER_C1_AUTHORIZATION_SCOPE=C1_REVIEW_MANIFEST_DETERMINISTIC_ZIP_ONLY
TASK_04_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_05_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_10_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_11_STAGE_A_AUTHORIZATION=GRANTED
TASK_11_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_11_STARTED=YES_STAGE_A_AND_STAGE_B_COMPLETE
TASK_11_IMPLEMENTATION_AUTHORIZATION=GRANTED_AND_OWNER_REVIEW_PASSED
TASK_11_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED_AND_OWNER_REVIEW_PASSED
TASK_11_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_11_STAGE_C1_AUTHORIZATION=GRANTED
TASK_11_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
V23_GOVERNANCE_SYNC=UNCHANGED
```

V23 remains the active governance authority and is not modified by this
contract amendment. Its baseline still records the pre-Task-11 stop state;
this task-scoped contract records the owner's later Stage B review result and
Stage C1 whitelist authorization. It does not perform a governance
synchronization, authorize Stage C2, or authorize Task 13+.

## Exact write boundary

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_11_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_11_PLAN.md
STAGE_A_WRITE_POLICY=CREATE_ONLY_THE_TWO_EXACT_FILES
STAGE_A_GIT_POLICY=NO_ADD|NO_STAGE|NO_COMMIT|NO_PUSH|NO_PR|NO_DEPLOY
STAGE_A_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
EXTERNAL_RECEIPT_PATH=C:/Users/HU.codex/execution-receipts/student-care/phase1b-task11-stage-a-20260909.json
```

No existing repository file may be modified by Stage A. This includes V23 and
all active references, Task 01-10 and Task 12 contracts/plans/acceptance/C1
evidence, frozen evidence, the old Task 06 verifier, and every existing
untracked protected path. The owner-approved C1 addendum below is the only
exception for the three exact C1 evidence files and one external receipt.

## Task identity and bounded product slice

Task 11 is **Partner-cloud security entry**. The bounded goal is to define an
internal staff entry that can expose only an approved synthetic destination
through a server-issued, short-lived handoff intent. The system does not call
the partner provider, proxy provider traffic, scrape provider content, store
provider credentials, or claim global route reachability.

The approved Stage B boundary is exactly:

```text
STAGE_B_EXACT_FILES=apps/api/src/modules/partner-links/partner-link.service.ts|apps/api/src/routes/partner-link.route.ts|apps/user-web/src/pages/partner-link.tsx|apps/api/src/modules/partner-links/partner-link.test.ts
```

These four paths are future implementation inputs, not current write
permission. No server entrypoint, shared contract, auth type, package
manifest, lockfile, schema, migration, verifier, configuration, or additional
page/test file may be added without a new owner-approved authority and
explicit whitelist.

## Inputs and outputs

The future service consumes:

- approved synthetic link metadata and symbolic destination;
- an explicit HTTPS host/path allowlist and policy version;
- publication and enabled state;
- allowed staff role/capability;
- server-derived tenant and campus scope;
- trusted identity and active membership;
- a server-owned handoff expiry and audit context.

The future service returns:

- a searchable or directly selected internal link projection with no provider
  credentials or raw provider metadata;
- an entry-check projection containing only an approved symbolic destination,
  normalized display host/path, and short-lived handoff intent;
- explicit empty and denied outcomes that do not reveal foreign object
  existence;
- an audit event for every approved entry attempt and every denied security
  decision required by the audit policy.

Client-supplied tenant, campus, role, membership, capability, publication,
destination, allowlist result, expiry, handoff, provider URL, or audit result is
untrusted and cannot widen access.

## Security and fail-closed rules

The future implementation must:

1. Resolve tenant and campus only from trusted identity plus active membership
   and the allowed campus scope.
2. Require the staff role/capability required by the approved link metadata.
3. Accept only normalized HTTPS host/path values that match the explicit
   allowlist and policy version.
4. Reject arbitrary URLs, `javascript:`, `data:`, `file:`, userinfo,
   malformed/empty hosts, unapproved ports, path traversal, unexpected query
   strings, fragments, and non-approved redirect targets.
5. Require `PUBLISHED` and `ENABLED` state before issuing any handoff.
6. Bind every handoff to tenant, campus, membership, role/capability,
   symbolic destination, policy version, request scope, and a short expiry.
7. Reject expired, reused, malformed, foreign-scope, wrong-role, inactive-
   membership, and client-forged handoffs without revealing the destination.
8. Record a minimal audit event for accepted entry and security-relevant
   denials without storing credentials, bearer tokens, signed URLs, or
   sensitive query data.
9. Return only an approved synthetic destination or normalized display
   projection. Never return provider credentials, API responses, internal
   storage keys, or a long-lived direct provider token.

Denied requests must not consume a valid handoff, mutate publication state,
change an allowlist, or create a successful access audit event. All fixtures
must be clearly fictional and local.

## Non-goals and explicit prohibitions

This contract does not authorize:

- partner-cloud API calls, OAuth, SDKs, webhooks, scraping, proxying, or
  follow-redirect network checks;
- real partner URLs, provider credentials, production data, or external
  traffic;
- a server entrypoint change or proof that the route is globally mounted;
- database persistence, migrations, schema edits, package or lockfile changes;
- Task 11 Stage C2, Task 13+, governance synchronization, or deployment. Stage
  B is already complete and Stage C1 is permitted only by the exact addendum;
- reading, modifying, deleting, moving, staging, or packaging protected
  untracked evidence.

## Stage A acceptance criteria

Stage A is ready for owner review only when:

1. Both exact Stage A files exist and no other repository path was written.
2. The active V23 path and SHA, current branch, current HEAD, and the owner
   authorization scope are recorded without changing V23.
3. The four future Stage B paths are listed exactly and no fifth path is
   implied as an implementation requirement.
4. Inputs, outputs, scope derivation, allowlist rules, publication/enabled
   guards, short-lived handoff, audit boundary, and fail-closed denials are
   concrete enough for a future TDD implementation.
5. C2, Task 13+, network, provider, dependency, and production operations
   remain explicitly unauthorized; C1 is permitted only by the exact addendum
   below.
6. Both files are UTF-8 without BOM, LF-only, and have exactly one trailing LF.
7. Node crypto and .NET SHA256 independently agree for both file byte streams.
8. The external JSON receipt is valid, contains the actual file hashes and Git
   state, and is the only write outside the repository.

`PASS` for the Stage A portion means its contract and plan are ready for owner
review. The C1 addendum is separately authorized by the owner's explicit
instruction recorded below; it does not authorize C2.

## Owner-approved Stage C1 whitelist addendum

This addendum records the owner's explicit Task 11 Stage C1 authorization on
2026-09-09. It supersedes only the earlier C1 `NOT_GRANTED` placeholders in
this contract and plan. It does not modify V23, grant governance
synchronization, or change any frozen evidence.

```text
TASK_11_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_11_STAGE_C1_AUTHORIZATION=GRANTED
TASK_11_STAGE_C1_STATUS=AUTHORIZED_PENDING_EXECUTION
TASK_11_STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_11_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_11.txt|artifacts/review-package/student-care-platform-phase1b-task-11-review-pack-v1.0.zip
TASK_11_STAGE_C1_EXTERNAL_RECEIPT_PATH=C:/Users/HU.codex/execution-receipts/student-care/phase1b-task11-stage-c1-20260909.json
TASK_11_STAGE_C1_ZIP_MEMBER_COUNT=4
TASK_11_STAGE_C1_ZIP_MEMBERS=apps/api/src/modules/partner-links/partner-link.service.ts|apps/api/src/routes/partner-link.route.ts|apps/user-web/src/pages/partner-link.tsx|apps/api/src/modules/partner-links/partner-link.test.ts
TASK_11_STAGE_C1_ZIP_ORDER=CASE_FOLDED_UNICODE_ORDINAL_ASCENDING
TASK_11_STAGE_C1_ZIP_TIMESTAMP=1980-01-01T00:00:00Z
TASK_11_STAGE_C1_MANIFEST_POLICY=DETACHED_AND_EXCLUDED_FROM_ZIP
TASK_11_STAGE_C1_ZIP_EXCLUSIONS=REVIEW|MANIFEST|ZIP|C2_ACCEPTANCE|GOVERNANCE|FROZEN_EVIDENCE|PROTECTED_UNTRACKED_PATHS
TASK_11_STAGE_C1_WRITE_POLICY=CREATE_ONLY_THE_THREE_EXACT_REPOSITORY_FILES_AND_ONE_EXTERNAL_RECEIPT
TASK_11_STAGE_C1_GIT_POLICY=NO_STAGE|NO_COMMIT|NO_PUSH|NO_PR|NO_DEPLOY
TASK_11_STAGE_C1_C2_AUTHORIZATION=NOT_GRANTED
TASK_11_STAGE_C1_TASK_13_PLUS=NOT_STARTED_AND_NOT_GRANTED
TASK_11_STAGE_C1_OWNER_REVIEW_GATE=TASK11_STAGE_C1_OWNER_REVIEW_GATE
```

C1 may read only the four Stage B implementation paths needed for the
review package and may create only the three exact repository evidence files
and the exact external JSON receipt above. It must not alter the four Stage B
files, any governance reference, any frozen evidence, or any protected
untracked path. The C1 review file must record that global route reachability
and provider connectivity remain unverified.

## Future lifecycle gates

```text
STAGE_A=CONTRACT_AND_PLAN_FORMALIZATION_COMPLETE
STAGE_A_STATUS=OWNER_REVIEW_PASSED
STAGE_A_OWNER_REVIEW=PASSED
STAGE_B=IMPLEMENTATION_AND_FOCUSED_VERIFICATION
STAGE_B_AUTHORIZATION=GRANTED_AND_OWNER_REVIEW_PASSED
STAGE_C1=REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP
STAGE_C1_AUTHORIZATION=GRANTED_BY_OWNER_ADDENDUM
STAGE_C2=ACCEPTANCE_RECORD_ONLY
STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK11_STAGE_C1_OWNER_REVIEW_GATE
STOP_REASON=TASK11_STAGE_C1_OWNER_REVIEW_GATE
```
