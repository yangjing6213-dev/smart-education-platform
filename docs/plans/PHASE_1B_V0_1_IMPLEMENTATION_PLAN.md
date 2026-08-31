# Phase 1B V0.1 Implementation Plan

Status: active plan. Task 01, Task 02, and Task 03 are completed and remain
frozen evidence. Task 04 and later tasks are not authorized by this authority.

Current governance authority:
`docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V1.md`
(`SHA-256=FD9DC8D4FA11222B70ED549818C431FD12B7E87B0F045EFAE856991EE008F051`).
The authority uses a whole-file SHA with no self-reference; its current file is
untracked and awaits independent review.

## Dependency authority

The T10/T12 dependency order is governed by
`docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md` with
`SHA-256=B7F7509914399DD660D02F6FFD52E735EDF9EA850C0BF5C92F95698D8104F007`.
The dependency authority is a frozen referenced record. Its approved order is
adopted for current active planning; it does not authorize `/goal`, Task 04,
or any implementation. Task 12 depends only on `T02 -> T03 -> T05`; Task 10
depends only on `T05 -> T08 -> T12`.

## Working contract

Every task follows `red -> green -> focused regression -> explicit commit`. The task owner must use synthetic fixtures, preserve tenant and campus scope, and attach command output to the task record. Task 01—03 are historical completed increments. Task 04 requires a new independent contract and separate implementation authorization.

## Task 01 - Monorepo and quality tools

- Dependencies: none.
- Future files: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `apps/api/src/health/health.route.ts`.
- Input: approved repository structure and selected runtime versions.
- Output: deterministic workspace commands for typecheck, lint, unit test, and build.
- Red test: a fixture invokes each quality command with a deliberately invalid TypeScript file and asserts a non-zero result; a workspace test asserts all required package paths resolve.
- Implementation: create the workspace manifests, strict compiler settings, command aliases, and a health route with no business data.
- Green test: clean synthetic workspace passes typecheck, lint, unit, and build commands.
- Commit step: `chore: establish phase 1b workspace quality baseline`.

## Task 02 - Shared contracts and validation

- Dependencies: Task 01.
- Future files: `packages/contracts/src/index.ts`, `packages/contracts/src/errors.ts`, `packages/validation/src/request.ts`, `packages/validation/src/content.ts`, `packages/contracts/test/schema.test.ts`.
- Input: the six V0.1 contract files and error catalog.
- Output: executable request, response, error, and content validators.
- Red test: malformed UUID, oversized text, unknown enum, missing consent, and extra property cases must be rejected.
- Implementation: encode the approved schemas with strict parsing and stable error paths.
- Green test: valid synthetic content and API envelopes parse identically in API and test utilities.
- Commit step: `feat: add shared v0.1 contracts and validation`.

## Task 03 - Multi-tenant request scope

- Dependencies: Tasks 01-02.
- Future files: `packages/tenant/src/scope-context.ts`, `packages/tenant/src/resolve-scope.ts`, `apps/api/src/plugins/scope.plugin.ts`, `packages/tenant/test/isolation.test.ts`.
- Input: authenticated identity, active memberships, requested campus filter.
- Output: immutable `ScopeContext` or a typed denial.
- Red test: missing membership, suspended membership, foreign tenant, and disallowed campus cases must fail closed.
- Implementation: resolve tenant and campuses server-side and attach context to each request and job envelope.
- Green test: same-tenant allowed reads pass; cross-tenant and cache-key collision tests fail safely.
- Commit step: `feat: enforce tenant and campus request scope`.

## Task 04 - Identity and internal employee login foundation

- Dependencies: Tasks 02-03.
- Future files: `packages/auth/src/identity.ts`, `packages/auth/src/membership-policy.ts`, `apps/api/src/routes/me.route.ts`, `apps/api/src/routes/memberships.route.ts`, `packages/auth/test/policy.test.ts`.
- Input: identity adapter contract, membership states, role matrix.
- Output: verified identity, active membership, and internal employee capability checks.
- Red test: forged role claim, revoked membership, and absent session must be denied.
- Implementation: add a provider-independent adapter, secure session boundary, and policy evaluation sequence.
- Green test: synthetic teacher and staff identities can read only their scoped internal resources.
- Commit step: `feat: add identity and membership foundation`.

## Task 05 - Content and publishing model

- Dependencies: Tasks 02-04.
- Future files: `apps/api/src/modules/content/content.service.ts`, `apps/api/src/modules/content/content.repository.ts`, `apps/api/src/routes/public-content.route.ts`, `apps/api/src/modules/content/content.test.ts`.
- Input: content schema, tenant scope, publication states.
- Output: versioned draft, publish, unpublish, and public read operations.
- Red test: a draft must not appear publicly; a foreign tenant and stale version must be rejected.
- Implementation: add scoped commands, publication versioning, and public projection queries.
- Green test: only published synthetic content is returned on public routes and every transition creates an audit event.
- Commit step: `feat: add scoped content publication model`.

## Task 06 - Institution profile and home content management

- Dependencies: Task 05.
- Future files: `apps/api/src/modules/institution/institution.service.ts`, `apps/api/src/routes/admin-institution.route.ts`, `apps/admin-web/src/pages/home-content.tsx`, `apps/api/src/modules/institution/institution.test.ts`.
- Input: tenant profile fields, content version rules, admin permissions.
- Output: scoped admin editing and published visitor projection.
- Red test: staff cannot publish, foreign campus cannot edit, and an invalid content block is rejected.
- Implementation: map bounded fields to the content model and expose separate draft and publish commands.
- Green test: tenant admin can publish synthetic institution content and visitor reads the published version only.
- Commit step: `feat: add institution and home content management`.

## Task 07 - Public teacher introductions

- Dependencies: Tasks 05-06.
- Future files: `apps/api/src/modules/teachers/public-profile.service.ts`, `apps/api/src/routes/public-teachers.route.ts`, `apps/admin-web/src/pages/public-teachers.tsx`, `apps/api/src/modules/teachers/public-profile.test.ts`.
- Input: approved public fields and file reference contract.
- Output: filtered public teacher cards and scoped admin editing.
- Red test: private fields, unpublished profiles, and foreign tenant profiles must never be returned.
- Implementation: create an explicit public projection and publication policy.
- Green test: public route returns only approved synthetic fields in stable order.
- Commit step: `feat: add public teacher profile projections`.

## Task 08 - Activities and meals

- Dependencies: Task 05.
- Future files: `apps/api/src/modules/activities/activity.service.ts`, `apps/api/src/modules/meals/meal.service.ts`, `apps/api/src/routes/public-activities.route.ts`, `apps/admin-web/src/pages/meals.tsx`, `apps/api/src/modules/activities/activity.test.ts`.
- Input: date-bounded content schema and publication rules.
- Output: public activity and meal reads plus scoped admin edits.
- Red test: invalid dates, unpublished entries, cross-campus writes, and unsafe media references must fail.
- Implementation: use typed date and meal structures with tenant and campus predicates.
- Green test: date filtering and publication state remain consistent across web and mini clients.
- Commit step: `feat: add activity and meal content`.

## Task 09 - Newcomer guides

- Dependencies: Tasks 05 and 07.
- Future files: `apps/api/src/modules/guides/guide.service.ts`, `apps/api/src/routes/staff-guides.route.ts`, `apps/user-web/src/pages/staff-guides.tsx`, `apps/api/src/modules/guides/guide.test.ts`.
- Input: staff role policy, versioned content, file access port.
- Output: searchable internal guide list and detail projection.
- Red test: visitor access, suspended membership, and a guide outside campus scope must be denied.
- Implementation: add internal visibility and bounded search filters.
- Green test: an authorized synthetic staff member can search and read only allowed versions.
- Commit step: `feat: add scoped newcomer guides`.

## Task 10 - Teaching resources and search

- Dependencies: Tasks 05, 08, and 12 (`T05 -> T08 -> T12`).
- Dependency authority: `docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md`.
- Future files: `apps/api/src/modules/resources/resource.service.ts`, `apps/api/src/routes/staff-resources.route.ts`, `apps/user-web/src/pages/resources.tsx`, `apps/api/src/modules/resources/resource.test.ts`.
- Input: resource categories, file metadata, role and campus scope.
- Output: filtered resource list, detail, and empty-result behavior.
- Red test: unsafe file, unknown category, unrestricted search, and foreign tenant access must fail.
- Implementation: use allowlisted filters, bounded cursor pagination, and signed file reads.
- Green test: search returns scoped, published resources and emits no provider URL to unauthorized callers.
- Commit step: `feat: add scoped teaching resources and search`.

## Task 11 - Partner-cloud security entry

- Dependencies: Tasks 04-05 and 10.
- Future files: `apps/api/src/modules/partner-links/partner-link.service.ts`, `apps/api/src/routes/partner-link.route.ts`, `apps/user-web/src/pages/partner-link.tsx`, `apps/api/src/modules/partner-links/partner-link.test.ts`.
- Input: approved link metadata and allowlist policy.
- Output: a controlled, published, auditable redirect intent without provider API integration.
- Red test: arbitrary URL, unpublished link, wrong role, and expired link must be rejected.
- Implementation: store an allowlisted symbolic destination and require a server-issued short-lived handoff.
- Green test: only an approved synthetic destination is exposed and every access is audited.
- Commit step: `feat: add controlled partner link entry`.

## Task 12 - File upload and COS adapter boundary

- Dependencies: Tasks 02, 03, and 05 (`T02 -> T03 -> T05`).
- Dependency authority: `docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md`.
- Future files: `apps/api/src/modules/files/file.service.ts`, `apps/api/src/adapters/cos.storage.ts`, `apps/api/src/routes/file-intent.route.ts`, `apps/api/src/modules/files/file.test.ts`.
- Input: file storage baseline, declared purpose, checksum, and scope.
- Output: pending file record, short-lived upload intent, scan state, and scoped read link.
- Red test: disallowed MIME, oversized file, foreign key, expired link, and unsigned access must fail.
- Implementation: implement a storage port with a provider fake first; keep COS credentials outside source.
- Green test: valid synthetic image passes fake scan and foreign object access remains denied.
- Commit step: `feat: add scoped file storage adapter boundary`.

## Task 13 - Visitor user web

- Dependencies: Tasks 05-08 and 12.
- Future files: `apps/user-web/src/routes/visitor.routes.tsx`, `apps/user-web/src/pages/visitor-home.tsx`, `apps/user-web/src/pages/visitor-content.tsx`, `apps/user-web/src/pages/visitor.test.tsx`.
- Input: public API contracts, web UI package, responsive rules.
- Output: long-form visitor pages with accessible loading, empty, error, and published states.
- Red test: private content must not render from a public response; keyboard navigation and narrow viewport checks must fail before implementation.
- Implementation: compose web-only pages around contract data and no direct provider calls.
- Green test: public routes render synthetic published content with zero unexpected requests.
- Commit step: `feat: add visitor web surface`.

## Task 14 - Visitor mini program

- Dependencies: Tasks 05-08 and 13.
- Future files: `apps/mini-program/src/pages/visitor/home.ts`, `apps/mini-program/src/pages/visitor/content.ts`, `apps/mini-program/src/navigation/routes.ts`, `apps/mini-program/src/pages/visitor.test.ts`.
- Input: same contracts, mini UI package,现场操作 layout rules.
- Output: compact visitor flow using platform navigation and shared business semantics.
- Red test: a mini page must not import web components or server adapters; route and back-navigation checks fail initially.
- Implementation: add native page adapters and scoped data hooks.
- Green test: visitor routes navigate correctly at phone dimensions with no external resource.
- Commit step: `feat: add visitor mini-program surface`.

## Task 15 - Internal employee user web

- Dependencies: Tasks 04, 09-12, and 13.
- Future files: `apps/user-web/src/routes/staff.routes.tsx`, `apps/user-web/src/pages/staff-workbench.tsx`, `apps/user-web/src/pages/staff-report.tsx`, `apps/user-web/src/pages/staff.test.tsx`.
- Input: membership policy, guide/resource contracts, daily report contract.
- Output: complete staff web workbench, long content, task and report views.
- Red test: visitor and suspended staff access, cross-campus search, and teacher-only summary denial must fail.
- Implementation: use web-specific layouts and server-enforced capabilities.
- Green test: authorized synthetic teacher completes the report flow and sees only the permitted AI summary.
- Commit step: `feat: add internal employee web surface`.

## Task 16 - Internal employee mini program

- Dependencies: Tasks 04, 09-11, and 15.
- Future files: `apps/mini-program/src/routes/staff.routes.ts`, `apps/mini-program/src/pages/staff/workbench.ts`, `apps/mini-program/src/pages/staff/quick-action.ts`, `apps/mini-program/src/pages/staff.test.ts`.
- Input: staff capability contract and quick-action interaction rules.
- Output: on-site task, pickup, and resource actions with compact state.
- Red test: long-form web-only content, foreign campus actions, and missing membership must be rejected.
- Implementation: provide mini adapters that call the same API contracts without duplicating domain logic.
- Green test: touch targets, back navigation, and quick actions pass on the approved phone matrix.
- Commit step: `feat: add internal employee mini-program surface`.

## Task 17 - Operation logs and audit views

- Dependencies: Tasks 03-16.
- Future files: `apps/api/src/modules/audit/audit.service.ts`, `apps/api/src/routes/admin-audit.route.ts`, `apps/admin-web/src/pages/audit-logs.tsx`, `apps/api/src/modules/audit/audit.test.ts`.
- Input: audit baseline, event taxonomy, and admin permission matrix.
- Output: append-only events and scoped metadata view.
- Red test: mutable audit event, missing actor or scope, child content in an event, and unauthorized read must fail.
- Implementation: write events transactionally with state changes and expose redacted filters.
- Green test: every protected command produces one traceable event and administrators see only their scope.
- Commit step: `feat: add scoped audit event trail`.

## Task 18 - E2E, security, and release candidate validation

- Dependencies: Tasks 01-17.
- Future files: `tests/e2e/visitor.spec.ts`, `tests/e2e/staff.spec.ts`, `tests/e2e/learning.spec.ts`, `tests/security/isolation.spec.ts`, `tests/release/acceptance.spec.ts`, `scripts/verify-release.mjs`.
- Input: all contracts, browser matrix, migration plan, and release thresholds.
- Output: reproducible release-candidate report with route, security, privacy, performance smoke, and rollback checks.
- Red test: inject a cross-tenant identifier, skip an AI hint step, request a private summary as a guardian, and corrupt an artifact; each must fail the release suite.
- Implementation: compose synthetic environment fixtures, browser flows, deny tests, and artifact checks.
- Green test: all critical flows and deny tests pass with zero unexpected requests and a recorded rollback target.
- Commit step: `test: certify phase 1b v0.1 release candidate`.

## Historical Phase 1B start gate

The original Task 01 start gate remains a historical record and is not rewritten.
Current active governance recognizes only Task 01—03:

```text
PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_03_ONLY
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03
TASK_04_STARTED=NO
TASK_04_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_04_PRECONDITION=NEW_INDEPENDENT_CONTRACT_AND_SEPARATE_IMPLEMENTATION_AUTHORIZATION
```
