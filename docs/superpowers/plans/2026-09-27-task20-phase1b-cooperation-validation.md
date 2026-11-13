# TASK20_PHASE_1B_COOPERATION_VALIDATION Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task after separate Owner authorization. This plan is a synthetic rehearsal only and is not evidence of real institution cooperation.

**Goal:** 建立符合正式项目方案的机构确认、试点范围、数据授权、隐私、两轮反馈和验收门禁工件，同时保持真实业务闭环未启动。

**Architecture:** 用一个可审计的 Markdown 合同保存虚拟机构、校区、负责人和角色，再用明确的合成数据与隐私规则约束反馈和验收。此阶段只生成计划工件，不修改产品代码、不接入服务、不上传资料；真实合作必须另立合同。

**Tech Stack:** UTF-8 Markdown、Git worktree、PowerShell、现有 Node 运行时；不安装依赖，不使用网络服务。

---

## 0. Contract boundary

**Task ID:** `TASK20_PHASE_1B_COOPERATION_VALIDATION`

**Authority:** `docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md` M1.4 and the project solution's privacy, synthetic-data, audit, and human-review rules.

**Current authorization:** Owner supplied virtual institution owner, institution, campus, and role values and requested continuation under the project solution's data and privacy rules on 2026-09-27.

**Exact write set for this planning wave:**

- Create: `docs/superpowers/plans/2026-09-27-task20-phase1b-cooperation-validation.md`
- Modify: none outside this plan file
- Main-tree sync: not included; it requires a separate Owner Review Sync authorization

**Forbidden:** product code, tests, Mini, user-web, admin-web, API, database, migrations, authentication, partner cloud, storage, network requests, real personal data, real institution materials, dependency or lockfile changes, commit, push, deployment, release, and any external write.

**Stop conditions:** stop before real-business activity if a real owner, real pilot scope, data authorization, privacy confirmation, or external service permission is requested but not separately authorized.

## Task 1: Freeze the synthetic institution and pilot scope

**Files:**

- Create: `docs/superpowers/plans/2026-09-27-task20-phase1b-cooperation-validation.md`

- [ ] **Step 1: Record the virtual confirmation identity**

Use these values exactly and label every record `SYNTHETIC_REHEARSAL_ONLY`:

```text
机构名称：模拟同芯托管机构
校区：模拟东校区
机构负责人：模拟机构负责人（虚拟角色）
项目负责人：模拟产品负责人（虚拟角色）
```

- [ ] **Step 2: Record the virtual participant roles**

```text
机构管理员：模拟机构管理员（虚拟角色）
校区负责人：模拟东校区负责人（虚拟角色）
教师代表：模拟教师代表（虚拟角色）
家长代表：模拟家长代表（虚拟角色）
```

- [ ] **Step 3: Record the synthetic pilot surface**

The rehearsal covers visitor public content, staff verticals, admin read-only projection, contact/appointment intent, content publish/unpublish projection, audit summary, and local visual routes. It excludes real authentication, student records, payment, AI, partner-cloud calls, and production deployment.

## Task 2: Freeze data authorization and privacy rules

**Files:**

- Modify: `docs/superpowers/plans/2026-09-27-task20-phase1b-cooperation-validation.md`

- [ ] **Step 1: Record the data authorization decision**

```text
DATA_AUTHORIZATION=SIMULATED_DATA_ONLY
AUTHORIZED_SOURCE=新生成的虚构数据与项目内既有合成演示数据
REAL_PERSONAL_DATA=PROHIBITED
REAL_INSTITUTION_MATERIALS=PROHIBITED
EXTERNAL_UPLOAD=PROHIBITED
PERSISTENT_STORAGE=PROHIBITED_FOR_THIS_REHEARSAL
```

- [ ] **Step 2: Record mandatory privacy controls**

The confirmation must require minimum collection, no real minor data, synthetic contact/appointment values, teacher or parent human review before public projection, close/delete/audit controls, and no formal authentication, API, database, partner cloud, object storage, or AI.

- [ ] **Step 3: Record authorization expiry and escalation**

```text
AUTHORIZATION_SCOPE=本地合成确认与演示
AUTHORIZATION_EXPIRY=本次 Owner Review 结束
REAL_BUSINESS_ESCALATION=必须新建任务合同并重新确认
```

## Task 3: Record two synthetic feedback rounds

**Files:**

- Modify: `docs/superpowers/plans/2026-09-27-task20-phase1b-cooperation-validation.md`

- [ ] **Step 1: Record round one**

```text
FEEDBACK_ROUND=1
REVIEWER=模拟机构管理员（虚拟角色）
RESULT=PASS_WITH_SYNTHETIC_ADJUSTMENTS
FEEDBACK=机构和校区范围、访客公开卡片、教师/活动/餐食入口与联系意向表单可被理解；发布动作必须显示本地模拟状态。
CHANGE_RECORD=保留模拟机构/模拟东校区标签；保留草稿、发布、下架、无权限和冲突状态。
RECHECK=REQUIRED
```

- [ ] **Step 2: Record round two**

```text
FEEDBACK_ROUND=2
REVIEWER=模拟校区负责人（虚拟角色）
RESULT=PASS_WITH_BOUNDARY_CONFIRMATION
FEEDBACK=资源、伙伴云、文件、审计和员工账号页面必须只读；不得出现外部链接、真实账号或真实学生字段。
CHANGE_RECORD=伙伴云为不可交互说明；文件为合成占位引用；审计为范围内只读摘要。
RECHECK=REQUIRED
```

- [ ] **Step 3: Record feedback limits**

State explicitly that both records are synthetic acceptance rehearsals and cannot replace real institution confirmation, data authorization, privacy approval, or pilot sign-off.

## Task 4: Record the rehearsal acceptance receipt

**Files:**

- Modify: `docs/superpowers/plans/2026-09-27-task20-phase1b-cooperation-validation.md`

- [ ] **Step 1: Write the acceptance state**

```text
SYNTHETIC_REHEARSAL_STATUS=INTERNAL_PASS_OWNER_REVIEWED
REAL_INSTITUTION_ACCEPTANCE=NOT_OBTAINED
REAL_PILOT_DECISION=NOT_STARTED
PRODUCTION_READINESS=NO
```

- [ ] **Step 2: Write the next gate**

Passing this plan's Owner Review may authorize a local synthetic demonstration package only. It does not authorize real data, external services, deployment, release, or a parent-binding contract.

- [ ] **Step 3: Write rejection handling**

If either round rejects scope, record the rejection and create a new narrow change contract before editing code. Do not weaken tests or convert synthetic approval into real cooperation evidence.

## Task 5: Verify the plan artifact

**Files:**

- Test: `docs/superpowers/plans/2026-09-27-task20-phase1b-cooperation-validation.md`

- [ ] **Step 1: Check required markers**

Run from the repository root:

```powershell
rg -n "SYNTHETIC_REHEARSAL_ONLY|DATA_AUTHORIZATION=SIMULATED_DATA_ONLY|REAL_PERSONAL_DATA=PROHIBITED|FEEDBACK_ROUND=1|FEEDBACK_ROUND=2|INTERNAL_PASS_PENDING_OWNER_REVIEW|REAL_INSTITUTION_ACCEPTANCE=NOT_OBTAINED|PRODUCTION_READINESS=NO" docs/superpowers/plans/2026-09-27-task20-phase1b-cooperation-validation.md
```

Expected: every marker is found.

- [ ] **Step 2: Check prohibited integrations and secrets**

Run:

```powershell
rg -n "https?://|fetch\s*\(|wx\.request|生产密钥|真实姓名|手机号|身份证" docs/superpowers/plans/2026-09-27-task20-phase1b-cooperation-validation.md
```

Expected: only policy wording is found; no endpoint, credential, or real-person value exists.

- [ ] **Step 3: Check whitespace and scope**

Run:

```powershell
git diff --check -- docs/superpowers/plans/2026-09-27-task20-phase1b-cooperation-validation.md
git diff --name-only -- docs/superpowers/plans/2026-09-27-task20-phase1b-cooperation-validation.md
```

Expected: no whitespace error and exactly this plan path is listed.

## Completion boundary

This plan is complete when its synthetic identity, pilot scope, privacy boundaries, two feedback rounds, acceptance state, and verification evidence are present. Completion does not authorize real institution cooperation, external integration, deployment, release, or the next M3 parent-binding contract.

## Owner Review receipt (2026-09-27)

```text
OWNER_REVIEW=PASS_USER_CONFIRMED_SYNTHETIC_ONLY
OWNER_REVIEW_SCOPE=M1.4 合成演练计划完整性与边界
REAL_INSTITUTION_CONFIRMATION=NOT_OBTAINED
REAL_PILOT_DECISION=NOT_STARTED
NEXT_GATE=TASK20_PHASE_1B_PHASE_1_1_SYNTHETIC_DEMO_CONFIRMATION
```

负责人确认本计划的合成身份、试点表面、数据授权、隐私边界、两轮合成反馈和停止条件完整。该确认只允许创建下一阶段的合成演示合同，不允许将虚拟记录解释为真实机构确认，也不允许进入真实业务闭环。
