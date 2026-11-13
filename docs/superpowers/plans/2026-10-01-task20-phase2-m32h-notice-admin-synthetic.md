# TASK20 Phase 2 M32H Notice Admin Synthetic Implementation Plan

> **For agentic workers:** Execute in the existing isolated worktree `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`. Preserve every pre-existing change. No package installation, commit, push, deployment or release.

**Goal:** Add a scoped, fixed-template Admin Web Notice lifecycle for local synthetic demonstrations, while preserving the existing User Web and Mini read/ack projections and making no cross-client-sync claim.

**Architecture:** Add a pure in-memory Notice review model and renderer, connect it to the existing Admin Web shell, and verify its lifecycle with focused tests and a loopback-only browser flow. Reuse the Notice field shape already consumed by `apps/user-web/src/pages/parent-updates.ts`; each client continues to keep independent local sample state.

**Tech Stack:** Existing TypeScript, Node test runner, Admin Web build, Playwright from the user's existing `C:\Users\HU\Tools\task20-browser` installation, existing CSS classes in `apps/admin-web/index.html`.

---

## Authority, baseline and exact write set

- Authority: the user's 2026-10-01 instruction to continue remaining local synthetic V3 goals without repeated per-step authorization.
- V3: `docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md`, SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38B`.
- Gap evidence: `docs/superpowers/plans/2026-10-01-task20-phase2-m32g-coverage-matrix.md`, SHA-256 `07ED05707353D8A3E2DCA384B003270AB363965A0740114AD07C74B724C9D62C`.
- Reuse the existing linked worktree `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign` on branch `codex/task20-mini-brand-redesign`; it already contains the unmerged M32F implementation. Do not make another worktree or move these changes.
- This contract's exact implementation write set is:
  1. `apps/admin-web/src/main.ts` — add navigation and route wiring.
  2. `apps/admin-web/src/pages/notice-review.tsx` — create the Notice model, projection and page renderer.
  3. `apps/admin-web/test/notice-review.test.mjs` — create focused lifecycle, role/scope, version and privacy tests.
  4. `tests/e2e/notice-review.spec.ts` — create loopback-only end-to-end review/publish/revoke and responsive/privacy checks.
- M32H starting state in the isolated worktree: HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`; `apps/admin-web/src/main.ts` SHA-256 `7EC73FCB453CC30F473BE70878A2B9AEB4D2EFFC771EE3971B5DF256E758BC9F` (includes the active M32F integration); the other three M32H implementation paths are absent.
- Main-workspace planning files permitted for this goal: `PLANS.md` and this plan only.
- No User Web, Mini source, page registration/configuration, generated JS, CSS, dependency, lockfile, API, database, authentication or external-service changes.

## Required behavior

- Only two fixed synthetic notice templates can be used; no free-text title/body or contact/personal fields.
- The lifecycle uses the V3 business states `DRAFT`, `SUBMITTED`, `CONFIRMED`, `RETURNED`, `CANCELLED`, and `EXCEPTION_PENDING`; parent receipt states remain separate (`UNREAD`, `READ`, `ACKNOWLEDGED`).
- Confirming a notice and publishing it are separate actions. Revoking publication immediately removes it from the Admin model's parent-consumer projection; business review status and read/ack receipt are not conflated.
- Every create, submit, review, publish, revoke, resubmit and cancel action rechecks active role, tenant, authorized campus, class scope where applicable, legal current state and version. Stale/repeated actions fail without partial changes.
- Campus reviewers may act only on fixed class notices in their authorized class. Institution reviewers may act on fixed institution or in-scope class notices. Platform administrators see anonymous counts only and cannot inspect, create, review, publish or revoke individual notices.
- The output shape must match the existing parent Notice contract: `id`, `target`, `classId`, `version`, `published`, `status`, `validFrom`, `validUntil`, `disabled`, `confirmation`, `title`, `body`, `requiresAcknowledgment`, `tenantId`, and `campusId`.
- Admin Web and parent Web/Mini remain independent in-memory demonstrations. An Admin publish action must not be described as reaching another app, device or real guardian.
- No network or persistent storage; all content and actors are visibly synthetic.

### Data shape and transition table

The consumer projection follows this shape (the implementation may add internal-only metadata but must not add fields to the parent projection):

```ts
interface SyntheticNotice {
  id: string;
  target: "INSTITUTION" | "CLASS";
  classId: string | null;
  version: number;
  published: boolean;
  status: "DRAFT" | "SUBMITTED" | "CONFIRMED" | "RETURNED" | "CANCELLED" | "EXCEPTION_PENDING";
  validFrom: string;
  validUntil: string;
  disabled: boolean;
  confirmation: {
    tenantId: string;
    campusId: string;
    role: "INSTITUTION_ADMIN" | "CAMPUS_LEAD";
    classId: string | null;
  };
  title: string;
  body: string;
  requiresAcknowledgment: boolean;
  tenantId: string;
  campusId: string;
}
```

| Current state               | Action                    | Next state                             | Extra rule                                 |
| --------------------------- | ------------------------- | -------------------------------------- | ------------------------------------------ |
| `DRAFT`                     | Submit                    | `SUBMITTED`                            | Exact author scope and version required    |
| `DRAFT`                     | Cancel                    | `CANCELLED`                            | No publication exists                      |
| `SUBMITTED`                 | Confirm                   | `CONFIRMED`                            | Scoped reviewer; publication remains false |
| `SUBMITTED`                 | Return                    | `RETURNED`                             | Fixed reason code only                     |
| `SUBMITTED`                 | Escalate                  | `EXCEPTION_PENDING`                    | Institution reviewer resolves escalation   |
| `SUBMITTED`                 | Cancel                    | `CANCELLED`                            | Scoped author or reviewer                  |
| `RETURNED`                  | Resubmit                  | `SUBMITTED`                            | Same fixed template, new version           |
| `EXCEPTION_PENDING`         | Confirm / return / cancel | `CONFIRMED` / `RETURNED` / `CANCELLED` | Institution reviewer only                  |
| `CONFIRMED` and unpublished | Publish                   | `CONFIRMED`                            | Separate action; increments version        |
| `CONFIRMED` and published   | Revoke                    | `CONFIRMED`                            | Sets `published=false`; increments version |

Parent receipt state is a separate `UNREAD` → `READ` → `ACKNOWLEDGED` flow; it does not alter the notice business state.

The public model API is fixed for the implementation and tests:

```ts
type NoticeTemplateId = "INSTITUTION_OPEN_DAY" | "CLASS_READING_ACTIVITY"
type NoticeTarget = "INSTITUTION" | "CLASS"
type NoticeAction = "SUBMIT" | "CONFIRM" | "RETURN" | "ESCALATE" | "RESUBMIT" | "CANCEL" | "RESOLVE_CONFIRM" | "RESOLVE_RETURN" | "PUBLISH" | "REVOKE"
createInitialNoticeState(): NoticeState
createSyntheticNoticeActor(role: NoticeRole): NoticeActor
createNoticeDraft(state: NoticeState, actor: NoticeActor, input: { templateId: NoticeTemplateId; target: NoticeTarget }): NoticeResult
applyNoticeAction(state: NoticeState, actor: NoticeActor, input: { id: string; version: number; action: NoticeAction }): NoticeResult
projectAdminNoticeView(state: NoticeState, actor: NoticeActor): NoticeAdminView
projectPublishedNotices(state: NoticeState, viewer: NoticeViewer): readonly SyntheticNotice[]
renderNoticeReview(view: NoticeAdminView, role: NoticeRole, feedback: string): string
```

Every failed `NoticeResult` returns the original unchanged `NoticeState` and one of `FORBIDDEN`, `INVALID_INPUT`, `OUT_OF_SCOPE`, `STALE`, or `INVALID_STATE`; each success returns a new state and increments the target record version exactly once.

## Plan and evidence

### Task 1: Verify current consumer and worktree contracts

- [x] Read `apps/user-web/src/pages/parent-updates.ts` and capture the consumed Notice fields and validity/scope rules.
- [x] Verify the existing linked worktree and preserve the current M32F workspace.
- [x] Verify that the M32H Admin source paths do not already contain a Notice workflow; inspect only the listed source files.

### Task 2: Add failing Notice model tests

**Files:** Create `apps/admin-web/test/notice-review.test.mjs`.

- [x] Assert only the fixed institution/class templates can create a draft; arbitrary text, missing scope and platform role return failure with state unchanged.
- [x] Assert the legal six-state transitions, return/resubmit, cancel-before-publication, exception escalation/resolution and invalid-state rejection.
- [x] Assert each review/publish/revoke action checks active role, exact tenant/campus/class, version and publication state; stale replay and foreign scope do not mutate records.
- [x] Assert published parent projection matches the existing Notice field shape and excludes drafts, returned, revoked, expired, disabled or out-of-scope records.
- [x] Assert platform projection contains anonymous counts only and the source has no network/persistent-storage APIs.
- [x] Run `node --test apps/admin-web/test/notice-review.test.mjs` and observe the expected RED before implementation.

### Task 3: Implement the pure Notice model and projection

**Files:** Create `apps/admin-web/src/pages/notice-review.tsx`.

- [x] Export typed synthetic state/context constructors, create/submit/review/resubmit/cancel/publish/revoke functions, scoped projection, parent-shape projection and HTML renderer.
- [x] Return new state objects; do not mutate input arrays or share data through global storage.
- [x] Use the existing notice template strings and dates as fixed enums; validate scope before any transition.
- [x] Run the focused tests and make all valid RED cases pass without weakening assertions.

### Task 4: Wire the Admin Web page

**Files:** Modify `apps/admin-web/src/main.ts`.

- [x] Add a link from the existing Admin home and a `/admin/notice-review` route.
- [x] Render fixed template/target choices, a scoped queue, role control, status feedback and state-appropriate buttons using the existing `.shell`, `.topbar`, `.panel`, `.field`, `.actions` styles.
- [x] Store the page state only in a module-local variable; present explicit text that publication is a local sample and does not deliver or synchronize notifications.
- [x] Re-render after each operation; platform mode must show counts and no notice rows, identifiers, titles or body text.
- [x] Run `corepack pnpm --filter @student-care/admin-web typecheck` and `corepack pnpm --filter @student-care/admin-web build`.

### Task 5: Verify browser flow and existing parent consumers

**Files:** Create `tests/e2e/notice-review.spec.ts`.

- [x] Start the built Admin preview only on loopback; exercise fixed draft → submit → confirm → publish → revoke and return/resubmit paths.
- [x] Assert the consumer-shaped projection contains only published matching records; assert publication/revoke does not alter independent User Web/Mini fixture state.
- [x] Block external requests and assert none are attempted; assert localStorage and sessionStorage remain empty.
- [x] Check 320×568, 390×844 and 1365×900 for horizontal overflow; assert no page errors.
- [x] Re-run Admin focused tests, User Web `parent-updates` tests, Mini `parent/updates` tests and the Mini registration guard assertions.
- [x] Run ESLint and Prettier on authored M32H sources, `git diff --check`, and the exact four-path M32H scope audit in the implementation worktree.

### Task 6: Update M32H control status

- [x] Record exact test/build/type/lint/format/E2E outcomes in main `PLANS.md`; keep Owner Review `PENDING`, Mini DevTools visual `NOT_RUN`, and main-tree business sync `NOT_EXECUTED`.
- [x] Verify the M32H contract SHA-256 and that main-workspace changes for this goal are limited to `PLANS.md` and this contract.

## Stop conditions

Stop and report if the feature needs another implementation path, free-form sensitive content, browser storage, cross-app synchronization, external services, a package/lockfile change, or a change to the current M32F work outside the shared `apps/admin-web/src/main.ts` integration point.
