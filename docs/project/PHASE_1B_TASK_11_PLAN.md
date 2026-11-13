# Phase 1B Task 11 Partner-cloud Security Entry Plan

> **For future implementation workers:** This plan is a Stage A design and
> execution contract with an owner-approved Stage C1 whitelist addendum. Stage
> B uses the exact four implementation files; C1 uses only the exact evidence
> paths listed below. Steps use checkbox syntax for tracking.

**Goal:** Define a scoped internal partner-cloud entry that exposes only an
approved synthetic destination through a short-lived, server-issued,
auditable handoff intent.

**Architecture:** A future API service validates immutable symbolic link
metadata, publication/enabled state, role/capability, and server-derived
tenant/campus membership scope before issuing a short-lived handoff. The route
returns a safe internal projection; the user-web page renders synthetic local
states and never calls a provider. No provider adapter or network operation is
part of this task.

**Tech Stack:** Existing Fastify/TypeScript API patterns, existing auth and
scope contracts, Node test runner, React/TSX user-web patterns, TypeScript,
ESLint, and Prettier. No new dependency is planned.

---

## Current anchors and preconditions

```text
TASK_ID=PHASE_1B_TASK_11
TASK_NAME=PARTNER_CLOUD_SECURITY_ENTRY
STAGE=STAGE_C1_EVIDENCE
STATUS=OWNER_REVIEW_GATE_BEFORE_STAGE_C1
EXECUTION_DATE=2026-09-09
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=c6d3fe41d9cfee7c8cd45426c47dc4336cfa7c25
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V23.md
ACTIVE_GOVERNANCE_SHA256=3BA4616D2081488FB4609B0677314773EC366115DDC28E3F5CCDE7B7163082C2
OWNER_AUTHORIZATION_EVIDENCE_ID=PROJECT_OWNER_EXPLICIT_TASK11_STAGE_A_FORMALIZATION_2026-09-09
OWNER_AUTHORIZATION_SCOPE=STAGE_A_FORMALIZATION_ONLY
STAGE_B_COMMIT=c6d3fe41d9cfee7c8cd45426c47dc4336cfa7c25
STAGE_B_PARENT=9af03352b58c3cb35e6f2782a3ced3057b0d0eca
OWNER_C1_AUTHORIZATION_EVIDENCE_ID=PROJECT_OWNER_EXPLICIT_TASK11_STAGE_C1_WHITELIST_2026-09-09
OWNER_C1_AUTHORIZATION_SCOPE=C1_REVIEW_MANIFEST_DETERMINISTIC_ZIP_ONLY
TASK_04_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_05_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_10_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_11_DEPENDENCY_ORDER=T04|T05|T10
TASK_11_STAGE_A_AUTHORIZATION=GRANTED
TASK_11_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_11_STARTED=YES_STAGE_A_FORMALIZATION_ONLY
TASK_11_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED_AND_OWNER_REVIEW_PASSED
TASK_11_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_11_STAGE_C1_AUTHORIZATION=GRANTED
TASK_11_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
V23_GOVERNANCE_SYNC=UNCHANGED
```

Task 04, Task 05, and Task 10 are the required accepted/frozen dependency
anchors. The existing dependency graph also places Task 11 after
`T04 -> T05 -> T10`. This plan does not rewrite V23 or the graph, does not
claim a globally mounted API route, and records the separate owner
authorization boundaries for Task 11 Stage B and Stage C1.

## Exact files and ownership

### Stage A files

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_11_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_11_PLAN.md
STAGE_A_WRITE_POLICY=CREATE_ONLY_THE_TWO_EXACT_FILES
STAGE_A_GIT_POLICY=NO_ADD|NO_STAGE|NO_COMMIT|NO_PUSH|NO_PR|NO_DEPLOY
```

### Future Stage B files

```text
STAGE_B_EXACT_FILES=apps/api/src/modules/partner-links/partner-link.service.ts|apps/api/src/routes/partner-link.route.ts|apps/user-web/src/pages/partner-link.tsx|apps/api/src/modules/partner-links/partner-link.test.ts
```

Responsibilities:

- `partner-link.service.ts`: trusted-scope resolution, metadata validation,
  publication/enabled checks, handoff issuance/consumption, safe projections,
  and audit decisions.
- `partner-link.route.ts`: internal request parsing, service invocation, safe
  error mapping, and route-local tests or fixtures only as permitted by the
  future contract. It does not register itself in `server.ts` under this plan.
- `partner-link.tsx`: local synthetic list/detail/entry-check states with no
  provider fetch, secret, external URL, or persistent storage.
- `partner-link.test.ts`: service and route-boundary TDD coverage using
  synthetic identities, memberships, allowlists, link states, handoffs, and
  audit observations.

Any need for `server.ts`, shared contracts, auth modules, package manifests,
lockfiles, schemas, migrations, verifiers, or another test/page file is a
fail-closed blocker requiring a new authority and whitelist.

## Domain model and projections

The future service should keep provider-independent records with these
conceptual fields:

```text
PartnerLink:
  id, symbolic_destination, normalized_host, normalized_path
  tenant_id, campus_id, allowed_roles, required_capability
  publication_status, enabled_status, allowlist_policy_version
  description, sort_order, version

Handoff:
  id, partner_link_id, tenant_id, campus_id, membership_id
  role, capability, scope_fingerprint, policy_version
  issued_at, expires_at, consumed_at, status

EntryProjection:
  link_id, display_label, normalized_host, normalized_path
  symbolic_destination, handoff_id, expires_at
```

The external destination is represented by an allowlisted symbolic destination
and normalized display fields. The projection must not expose provider
credentials, raw API responses, storage keys, bearer tokens, long-lived signed
URLs, or unapproved query/fragment data.

## Scope, validation, and failure policy

The service derives tenant/campus scope from trusted identity, active
membership, current role, allowed campus scope, and capability. It ignores or
rejects client claims that attempt to supply or widen these values.

Validation must fail closed for:

- arbitrary URL or destination not present in the exact allowlist;
- non-HTTPS scheme, userinfo, empty/ambiguous host, unapproved port, path
  traversal, unexpected query, fragment, or unsafe normalization;
- draft, unpublished, disabled, stale-version, deleted, or foreign link;
- visitor, wrong role, missing capability, inactive/suspended membership,
  foreign tenant, or disallowed campus;
- missing, malformed, expired, reused, foreign-scope, wrong-role, or
  policy-version-mismatched handoff;
- client-supplied audit result, provider URL, expiry, or normalized target.

Safe failures should use the repository's existing error envelope and avoid
revealing whether a foreign link exists. A denied call must not consume a valid
handoff, mutate link state, or produce a successful access audit event.

Approved entry must:

1. re-check publication, enabled state, current scope, capability, policy
   version, and expiry;
2. issue or consume a short-lived server-owned handoff exactly once;
3. expose only the approved synthetic destination projection;
4. append a minimal audit event containing actor, trusted scope, symbolic
   object, action, result, timestamp, and request correlation ID;
5. avoid provider calls, redirects followed by the server, credential access,
   and raw external responses.

## User-web behavior boundary

The future `partner-link.tsx` page is a local staff-facing simulation. It may
show:

- a searchable list of clearly fictional approved links;
- empty results for a bounded query;
- a detail view with normalized host/path and publication/enabled state;
- a confirmation state for a short-lived synthetic handoff;
- denied, expired, wrong-role, and unavailable states.

It must not make HTTP requests, call a partner provider, open a real external
destination, persist data, expose credentials, or imply that the API is
globally mounted. The page is not evidence of live route reachability.

## Future Stage B TDD and verification plan

### Task 1: Confirm implementation preconditions

Files: none.

- [ ] Confirm branch, HEAD, active V23 SHA, dependency statuses, and clean
      tracked/index state.
- [ ] Confirm a separate owner authorization names exactly the four Stage B
      files and grants Stage B, not merely Stage A.
- [ ] Confirm no protected evidence, V23, package manifest, lockfile, schema,
      migration, verifier, or unknown path drift exists.

Expected result: all preconditions are true. Any mismatch blocks Stage B.

### Task 2: Add the failing API tests first

File: `apps/api/src/modules/partner-links/partner-link.test.ts`

- [ ] Add synthetic authorized staff, wrong-role, inactive-membership,
      foreign-tenant, wrong-campus, visitor, published/enabled, draft,
      unpublished, disabled, expired, reused-handoff, unsafe-URL, and
      arbitrary-destination fixtures.
- [ ] Assert arbitrary URL, unpublished link, wrong role, expired handoff,
      foreign tenant/campus, inactive membership, unsafe scheme, and
      unapproved host/path are rejected.
- [ ] Assert denied calls do not consume a handoff, mutate link state, or
      append a successful audit event.
- [ ] Assert an approved synthetic destination returns only the safe projection,
      with a short expiry and one audit event.
- [ ] Assert no result includes provider API data, credentials, raw token,
      storage key, or a long-lived external URL.

Run the RED check after adding only the test:

```text
corepack pnpm --filter @student-care/api build
node --test apps/api/dist/src/modules/partner-links/partner-link.test.js
```

Expected RED: the compiled test cannot resolve the not-yet-created service or
route boundary. Record the actual failure; do not weaken the assertions.

### Task 3: Implement the scoped service

File: `apps/api/src/modules/partner-links/partner-link.service.ts`

- [ ] Define typed link metadata, trusted scope, handoff record, audit event,
      safe projection, and explicit failure result.
- [ ] Normalize and validate only allowlisted HTTPS host/path values.
- [ ] Enforce publication/enabled state and required role/capability.
- [ ] Bind handoff issuance and consumption to trusted tenant/campus,
      membership, role, scope fingerprint, policy version, and expiry.
- [ ] Make expiry and reuse invalid, and preserve state on denied requests.
- [ ] Keep all data in deterministic in-memory synthetic fixtures; use no
      provider adapter, network, credential, or production store.

### Task 4: Implement the route boundary

File: `apps/api/src/routes/partner-link.route.ts`

- [ ] Define the existing Fastify-style route registration function without
      changing `server.ts` or any other entrypoint.
- [ ] Parse only allowlisted query/body fields and reject client scope claims.
- [ ] Map denied scope, state, validation, expiry, and stale-policy results to
      the existing fail-closed error envelope.
- [ ] Return only the safe entry projection and no provider details.
- [ ] Keep route registration/global reachability explicitly unverified.

### Task 5: Implement the local user-web projection

File: `apps/user-web/src/pages/partner-link.tsx`

- [ ] Render synthetic searchable list, empty result, detail, confirmation,
      expired, and denied states.
- [ ] Keep all values local and clearly fictional.
- [ ] Do not add provider URLs, fetch calls, storage, new dependencies, or
      route-registration changes.

### Task 6: Run GREEN and focused regression checks

Run exactly:

```text
corepack pnpm --filter @student-care/api typecheck
corepack pnpm --filter @student-care/api lint
corepack pnpm --filter @student-care/api build
corepack pnpm --filter @student-care/api build && node --test apps/api/dist/src/modules/partner-links/partner-link.test.js
corepack pnpm --filter @student-care/user-web typecheck
corepack pnpm --filter @student-care/user-web lint
corepack pnpm --filter @student-care/user-web build
corepack pnpm exec prettier --check apps/api/src/modules/partner-links/partner-link.service.ts apps/api/src/routes/partner-link.route.ts apps/api/src/modules/partner-links/partner-link.test.ts apps/user-web/src/pages/partner-link.tsx
```

Expected GREEN: all commands exit zero; focused tests cover both denial and
approved synthetic handoff; no network/provider request occurs; no dependency
or lockfile changes occur. The checks do not prove global API or user-web
mounting, and that residual risk must remain in the review record.

### Task 7: Review the boundary and commit only after new authorization

- [ ] Run `git diff --check` and `git diff --cached --check`.
- [ ] Confirm exactly the four future Stage B paths changed.
- [ ] Confirm no `server.ts`, shared contract, package, lockfile, schema,
      migration, verifier, provider credential, real URL, or real personal
      data changed.
- [ ] Explicitly stage the four exact Stage B paths only after owner review and
      all focused checks pass.
- [ ] Commit with:

```text
feat: add controlled partner link entry
```

Stage A does not stage or commit this future work.

## Owner-approved Stage C1 whitelist addendum

The owner explicitly authorized Task 11 Stage C1 on 2026-09-09 after Stage B
repair review passed. This addendum supersedes only the earlier C1
`NOT_GRANTED` placeholder. It does not modify V23, frozen evidence, or the
Stage B implementation files, and it does not authorize C2 or Task 13+.

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

C1 may read only the four Stage B implementation paths needed for the review
package and may create only the three exact repository evidence files and the
exact external JSON receipt above. It must not alter the four Stage B files,
V23, any frozen evidence, or any protected untracked path. The C1 review must
retain the residual limitation that global route reachability and provider
connectivity are unverified.

## Evidence lifecycle

```text
STAGE_C1=REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP_AFTER_STAGE_B_OWNER_REVIEW
STAGE_C1_AUTHORIZATION=GRANTED_BY_OWNER_ADDENDUM
STAGE_C2=ACCEPTANCE_RECORD_ONLY_AFTER_C1_OWNER_PASS
STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_11_STATUS=NOT_ACCEPTED
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK11_STAGE_C1_OWNER_REVIEW_GATE
STOP_REASON=TASK11_STAGE_C1_OWNER_REVIEW_GATE
```
## Stage C1 format and stop gate

The three exact C1 repository evidence files must be created without modifying
the four Stage B files. The detached manifest must be excluded from the ZIP;
the ZIP must contain exactly the four listed Stage B members, use the declared
case-folded Unicode ordinal order, and use the declared fixed timestamp. The
external JSON must be UTF-8 without BOM, LF-only, exactly one trailing LF, and
must report independent Node crypto and .NET SHA256 results without a
self-reference. Run:

```text
git diff --check
git diff --cached --check
git status --short --branch --untracked-files=all
git diff --name-only
git diff --cached --name-only
```

Expected C1 result: exactly the three C1 evidence paths are newly created in
the repository, nothing is staged, no tracked file is modified, no Stage B
file or protected path drifts, and no remote operation occurs. The external
JSON above is the sole repository-external receipt.

Final Stage A state:

```text
TASK_11_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_11_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED_AND_OWNER_REVIEW_PASSED
TASK_11_STARTED=YES_STAGE_A_AND_STAGE_B_COMPLETE
TASK_11_STAGE_C1_AUTHORIZATION=GRANTED_BY_OWNER_ADDENDUM
TASK_11_STAGE_C1_STATUS=AUTHORIZED_PENDING_EXECUTION
TASK_13_PLUS_STARTED=NO
OWNER_REVIEW_GATE=TASK11_STAGE_C1_OWNER_REVIEW_GATE
STOP_REASON=TASK11_STAGE_C1_OWNER_REVIEW_GATE
```
