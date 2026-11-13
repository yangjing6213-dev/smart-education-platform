# TASK20_PHASE_1B_PHASE_1_1_SYNTHETIC_DEMO_CONFIRMATION Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task after separate Owner authorization. This contract is a synthetic local rehearsal only and is not evidence of real institution cooperation.

**Goal:** 在 M1.4 合成合作确认通过后，冻结 V0.1 本地演示包与完整浏览路径，记录可审阅的确认/拒绝项，预置两轮可追踪的合成变更合同，并为每次变更定义受影响端的 focused、视觉、权限和无网络复核门禁。

**Architecture:** 本合同只描述现有 Web、Mini 和 admin-web 本地合成演示的可复核边界，不新增业务页面、路由、接口或数据存储。演示记录使用虚拟机构、虚拟角色和已存在的合成 slug；任何真实机构确认必须另立合同并重新授权。

**Tech Stack:** UTF-8 Markdown、Git worktree、PowerShell、现有 Node 工具链；不安装依赖，不访问网络服务。

---

## 0. Contract boundary

**Task ID:** `TASK20_PHASE_1B_PHASE_1_1_SYNTHETIC_DEMO_CONFIRMATION`

**Authority:** V3 计划 M2（Phase 1.1 机构演示确认）、已通过的 `TASK20_PHASE_1B_COOPERATION_VALIDATION` 合成演练 Owner Review，以及项目方案中的合成数据、隐私、人工复核和审计要求。

**Current authorization:** 负责人已确认 M1.4 Owner Review 通过，并授权实施本 M2 合成演示合同；实施仍限定为本地合成演练，不代表真实机构确认或生产授权。

**Worktree:** `C:\Users\HU\.codex\worktrees\task20-phase1b-phase1-1-synthetic-demo`

**Exact write set for this planning wave:**

- Create: `docs/superpowers/plans/2026-09-27-task20-phase1b-phase1-1-synthetic-demo.md`
- Modify: none outside this contract file
- Main-tree sync: not included; any future sync requires a separate Owner Review Sync authorization

**Forbidden:** 修改业务代码、测试、Mini、user-web、admin-web、API、数据库、迁移、认证、伙伴云、对象存储、外部链接、网络请求、真实机构材料、真实个人数据、依赖、lockfile、commit、push、部署、发布和任何外部写入。

**Stop conditions:**

- 未取得真实负责人、真实试点范围、数据授权和隐私确认时，停止在合成演练边界，不启动真实业务闭环。
- 若需要新增页面、路由、接口、数据库字段、账号、外部服务、真实资料、真实学生字段或白名单外文件，立即停止并建立新合同。
- 若任一演示确认项被拒绝，只能通过新的窄范围变更合同修改，不得降低断言或把合成通过改写成真实接受。

## 1. Freeze the synthetic V0.1 demo package

**Files:**

- Create: `docs/superpowers/plans/2026-09-27-task20-phase1b-phase1-1-synthetic-demo-confirmation.md`

**Synthetic identity:**

```text
SYNTHETIC_REHEARSAL_ONLY=YES
INSTITUTION=模拟同芯托管机构
CAMPUS=模拟东校区
INSTITUTION_OWNER=模拟机构负责人（虚拟角色）
PRODUCT_OWNER=模拟产品负责人（虚拟角色）
PARTICIPANTS=模拟机构管理员、模拟东校区负责人、模拟教师代表、模拟家长代表
```

**Frozen Web paths:**

```text
/visitor
/web/visitor/institution
/web/visitor/day-flow
/visitor/content/teacher-team
/visitor/content/seasonal-activities
/visitor/content/meal-plan
/visitor/content/environment-and-contact
/visitor/content/family-school-cooperation
/visitor/content/a-day-at-same-core
```

**Frozen Mini paths:**

```text
pages/visitor/home
pages/visitor/content?contentKey=teacher-team
pages/visitor/content?contentKey=seasonal-activities
pages/visitor/content?contentKey=meal-plan
pages/visitor/content?contentKey=environment-and-contact
pages/visitor/institution
pages/visitor/home-school
pages/visitor/day-flow
pages/staff/workbench
pages/staff/quick-action
```

**Frozen admin read-only paths:**

```text
/admin/institution
/admin/home-content?mode=readonly
/admin/public-teachers
/admin/activities
/admin/meals
/admin/guides
/admin/resources
/admin/partner-cloud
/admin/staff
/admin/files
/admin/publishing?mode=conflict
/admin/audit-logs?mode=conflict
```

The package must keep all displayed content clearly marked as simulated where the current product already does so. The package does not include upload, export, real login, real contact delivery, real appointment creation, or external navigation.

## 2. Freeze data authorization and privacy review

**Files:**

- Modify: this contract file only

```text
DATA_AUTHORIZATION=SIMULATED_DATA_ONLY
AUTHORIZED_SOURCE=新生成的虚构数据与项目内既有合成演示数据
REAL_INSTITUTION_CONFIRMATION=NOT_OBTAINED
REAL_PERSONAL_DATA=PROHIBITED
REAL_MINOR_DATA=PROHIBITED
REAL_INSTITUTION_MATERIALS=PROHIBITED
EXTERNAL_UPLOAD=PROHIBITED
PERSISTENT_STORAGE=PROHIBITED_FOR_REHEARSAL
NETWORK_REQUESTS=PROHIBITED
```

The review must check minimum collection, synthetic contact/appointment values, human review before public projection, close/delete/audit semantics, and the absence of formal authentication, API, database, partner cloud, object storage and AI calls. No field may identify a real child, guardian, teacher, institution or campus.

## 3. Record synthetic confirmation and rejection decisions

The records below are rehearsal inputs only. They describe the review shape without claiming that a real institution has accepted the product.

**Round 1 — simulated institution administrator:**

```text
FEEDBACK_ROUND=1
REVIEWER=模拟机构管理员（虚拟角色）
RESULT=PASS_WITH_SYNTHETIC_ADJUSTMENTS
CONFIRMATION=机构/校区范围、访客公开卡片、教师/活动/餐食入口和联系意向表单可理解
REJECTION=无真实业务拒绝；仅提出模拟状态标签和公开字段边界需保持清楚
OWNER=模拟产品负责人（虚拟角色）
RECHECK=REQUIRED
```

**Round 2 — simulated campus lead:**

```text
FEEDBACK_ROUND=2
REVIEWER=模拟东校区负责人（虚拟角色）
RESULT=PASS_WITH_BOUNDARY_CONFIRMATION
CONFIRMATION=资源、伙伴云、文件、审计和员工账号保持只读
REJECTION=禁止外部链接、真实账号、真实学生字段和网络提交
OWNER=模拟产品负责人（虚拟角色）
RECHECK=REQUIRED
```

Every rejection or adjustment record must include the affected route, pre-change behavior, requested post-change behavior, reason, owner, scope, and recheck command set. These records are synthetic acceptance rehearsals and cannot replace real institution approval, real data authorization, real privacy approval or a pilot decision.

## 4. Define two narrow synthetic change contracts

**Change contract A — public wording/status boundary:**

```text
CHANGE_ID=SYNTH-M2-001
AFFECTED_SURFACE=Web/Mini visitor public content and contact-intent display
BEFORE=模拟内容可见，但演示状态说明可能不够集中
AFTER=保留合成标签、公开范围、草稿/发布/下架/冲突状态说明
REAL_SERVICE=PROHIBITED
```

**Change contract B — read-only staff/admin boundary:**

```text
CHANGE_ID=SYNTH-M2-002
AFFECTED_SURFACE=staff/admin guides, resources, files, partner-cloud and audit summaries
BEFORE=只读演示入口已存在
AFTER=明确禁止外链、真实账号、真实学生字段和外部提交
REAL_SERVICE=PROHIBITED
```

Neither contract authorizes implementation by itself. If implementation is later authorized, its contract must list exact files, tests, route coverage, visual checks, permission checks and network audit before any edit.

## 5. Revalidation matrix for any future synthetic change

For each approved synthetic change, run only the affected client checks:

```text
WEB_FOCUSED_TESTS=REQUIRED_WHEN_WEB_PATHS_CHANGE
MINI_FOCUSED_TESTS=REQUIRED_WHEN_MINI_PATHS_CHANGE
ADMIN_FOCUSED_TESTS=REQUIRED_WHEN_ADMIN_PATHS_CHANGE
TYPECHECK=REQUIRED_FOR_AFFECTED_CLIENT
ESLINT=REQUIRED_FOR_AFFECTED_FILES
PRETTIER=REQUIRED_FOR_AFFECTED_FILES
STATIC_ROUTE_SMOKE=REQUIRED_FOR_AFFECTED_ROUTES
VISUAL_REVIEW=REQUIRED_FOR_AFFECTED_VIEWPORTS
PERMISSION_REVIEW=REQUIRED_FOR_PUBLIC_AND_READONLY_BOUNDARIES
NO_NETWORK_AUDIT=REQUIRED
PAGE_REGISTRATION_GUARD=REQUIRED_WHEN_MINI_PATHS_CHANGE
GIT_DIFF_CHECK=REQUIRED
SCOPE_AUDIT=REQUIRED
```

A missing verifier is `NOT_RUN`, not `PASS`. Existing unrelated failures, including protected staff tests, must remain separately classified and must not be repaired under this contract.

## 6. Implementation record (2026-09-27)

```text
IMPLEMENTATION_STATUS=COMPLETED_SYNTHETIC_REHEARSAL
IMPLEMENTATION_WRITE_SET=THIS_CONTRACT_FILE_ONLY
ROUTE_FREEZE_STATUS=PASS
DATA_PRIVACY_STATUS=PASS_SYNTHETIC_ONLY
FEEDBACK_RECORD_STATUS=PASS_SYNTHETIC_ONLY
CHANGE_CONTRACTS_STATUS=READY_FOR_SEPARATE_AUTHORIZATION
WEB_VALIDATION=PASS_24_FOCUSED_3_VISITOR_E2E_1_RUNTIME_E2E
MINI_VALIDATION=PASS_21_VISITOR_4_STAFF_VERTICALS_TYPECHECK_PAGE_GUARD
ADMIN_VALIDATION=PASS_5_FOCUSED
STAFF_PERMISSION_VALIDATION=PASS_3_E2E
VISUAL_VALIDATION=PASS_14_ROUTE_VIEWPORT_COMBINATIONS
NO_NETWORK_VALIDATION=PASS_NO_EXTERNAL_REQUESTS
REAL_INSTITUTION_CONFIRMATION=NOT_OBTAINED
```

Implementation evidence confirms that the existing local Web/Mini/admin demonstration surfaces match the frozen route inventory, use synthetic content, keep contact intent local, preserve read-only staff/admin boundaries, and pass the affected-client regression matrix. No product source, test, configuration, dependency, generated runtime file, or external service was changed during this contract implementation. The mobile visitor-home screenshot is stored outside the repository at `C:\Users\HU\AppData\Local\Temp\task20-m2-visual\visitor-home-mobile.png`.

## 6. Owner Review and next gate

```text
PHASE_1_1_SYNTHETIC_STATUS=IMPLEMENTED_PENDING_OWNER_REVIEW
PHASE_1_1_OWNER_REVIEW=NOT_STARTED
REAL_INSTITUTION_ACCEPTANCE=NOT_OBTAINED
REAL_PILOT_DECISION=NOT_STARTED
M3_PARENT_CLOSURE=NOT_AUTHORIZED
PRODUCTION_READINESS=NO
```

Owner Review may accept the completeness of this synthetic demonstration contract only. It cannot authorize M3 parent binding, real authentication, real student data, external services, deployment, release or upload to a WeChat environment.

If `PHASE_1_1_OWNER_REVIEW` is not accepted, return to M1.4 and record the rejection. If it is accepted, the next task must still be a separately authorized synthetic implementation contract with an exact file allowlist.

## 7. Verify this contract artifact

Run from the contract worktree:

```powershell
rg -n "TASK20_PHASE_1B_PHASE_1_1_SYNTHETIC_DEMO_CONFIRMATION|SYNTHETIC_REHEARSAL_ONLY=YES|DATA_AUTHORIZATION=SIMULATED_DATA_ONLY|REAL_INSTITUTION_CONFIRMATION=NOT_OBTAINED|FEEDBACK_ROUND=1|FEEDBACK_ROUND=2|CHANGE_ID=SYNTH-M2-001|CHANGE_ID=SYNTH-M2-002|PHASE_1_1_OWNER_REVIEW=NOT_STARTED|M3_PARENT_CLOSURE=NOT_AUTHORIZED" docs/superpowers/plans/2026-09-27-task20-phase1b-phase1-1-synthetic-demo.md
rg -n "https?://[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?i)\b(fetch|axios)\s*\(|wx\.request\s*\(|BEGIN (RSA|OPENSSH|PRIVATE)|sk-[A-Za-z0-9]{20,}" docs/superpowers/plans/2026-09-27-task20-phase1b-phase1-1-synthetic-demo.md
node_modules/.bin/prettier.cmd --check docs/superpowers/plans/2026-09-27-task20-phase1b-phase1-1-synthetic-demo.md
git diff --check
git status --short
```

Expected results: required markers found; no executable network or secret pattern; Prettier passes; no whitespace error; the only untracked path is this contract file.

## Completion boundary

This contract is complete when the synthetic demo package, route inventory, privacy boundary, two feedback rounds, two narrow change contracts, revalidation matrix and Owner Review gate are written and verified. Completion does not claim real institution confirmation, real pilot approval, M3 authorization, deployment, release or production readiness.

## 8. 后续 Owner Review 回执（D75 状态校准）

本节补录合同实施后用户明确给出的审阅结论。原第 6 节的 PHASE_1_1_OWNER_REVIEW=NOT_STARTED 保留为合同制定时点快照；当前审阅状态以本节为准。

PHASE_1_1_OWNER_REVIEW=PASS_USER_CONFIRMED_SYNTHETIC_ONLY
OWNER_REVIEW_SCOPE=本地合成演示完整性
REAL_INSTITUTION_ACCEPTANCE=NOT_OBTAINED
REAL_PILOT_DECISION=NOT_STARTED
PRODUCTION_READINESS=NO

该回执只确认虚构机构、合成数据和本地演示计划通过审阅；没有真实机构合作、个人数据授权、真实试点、外部服务或生产发布授权。
