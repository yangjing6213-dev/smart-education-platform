# TASK20 D68：Mini 页面流程测试与当前界面对齐

**状态：** `PARTIAL_SCOPE_DEVIATION; FUNCTIONAL_CHECKS_PASS; OWNER_REVIEW_NOT_PERFORMED`
**任务：** `TASK20_D68_MINI_PAGE_TEST_FLOW_RECONCILIATION`
**日期：** 2026-10-10
**授权依据：** 用户在本线程已明确授权我自主完成项目剩余本地开发，并在本轮要求继续项目目标。此任务只使用现有合成资料，不触及真实服务或发布操作。
**方案依据：** 项目方案 PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。

## 1. 目标与调查结果

D67 只运行了精选 Mini 测试。后续执行 Mini 安全测试入口时，28 个明确列出的测试文件共 197 项中有 4 项失败。逐项对照 WXML 页面、注册页面逻辑和其他页面护栏后，确认失败来自测试沿用了旧操作方式，且一份流程测试与当前页面护栏互相矛盾：

- 当前已实现的员工操作是工作台常驻“查看家长申请”入口，直接跳转到快捷页的“家长”区域；审核角色在快捷页明确选择。`staff-verticals.test.ts` 明确守护这一简单入口结构。
- `mini-workflow-ui.test.ts` 却要求把入口改成仅待审时显示，并要求在工作台选择审核角色；这与当前页面结构和护栏相反。
- 家长共享页面通过身份选择器的 `handleSharedProfile` 建立本机共享连接；`shared-fees.test.ts` 仍调用页面没有、界面也没有绑定的旧 `handleSharedConnect` 方法。

本任务只校正测试以验证实际页面操作，保留权限拒绝、角色限制、关系审核、成长记录发布及按学生隔离费用流水等行为断言。若实际页面操作验证失败，停止本任务并建立后续实现合同；不得在本写集外修复业务源文件。

## 2. 隔离方式与写集

工作树：`C:\Users\HU\.codex\worktrees\task20-d68-mini-page-test-flow-reconciliation`
分支：`codex/task20-d68-mini-page-test-flow-reconciliation`

仅允许修改：

- `apps/mini-program/src/pages/mini-workflow-ui.test.ts`
- `apps/mini-program/src/pages/shared-fees.test.ts`

只读基线输入：当前主工作树中相关页面 TypeScript/WXML、共享流程实现，以及用于确认常驻入口约定的 `apps/mini-program/src/pages/staff-verticals.test.ts`。将这些必要输入复制到新工作树时不修改主工作树；不得读取、复制、运行或修改受保护的 `apps/mini-program/src/pages/staff.test.ts`。

治理记录仅允许修改：

- 本合同
- `PLANS.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `docs/exec-plans/active/project-completion.md`

禁止修改业务源文件、WXML/WXSS、配置、生成 JS、其他测试、依赖和 lockfile；禁止安装依赖、连接外部服务、提交、推送、部署或发布。保留主工作树所有既有及未跟踪现场。

## 3. 验收标准

1. 工作台测试验证入口始终可见、点击进入快捷页家长审核区域；测试不得要求工作台承担快捷页已有的角色选择。
2. 关系审核页面级测试通过真实页面处理顺序验证：默认教师无权审核，选择机构负责人后只能查看当前合成校区的待审申请；伪造/过期操作仍被拒绝，合法审核保留审计角色证据。
3. 成长记录草稿、提交、退回、重新提交、负责人确认、显式发布及家长查看/知悉的原有断言全部保留并通过。
4. 费用页面测试通过显示的合成身份选择器连接家长资料；多学生流水与汇总仍按当前已审核学生隔离，切换非家长角色后清空费用视图；测试不得依赖不存在的连接按钮方法。
5. 不降低或删除权限、隔离、无网络、版本检查和发布门槛断言；不改产品逻辑来迎合测试。

## 4. 验证

在隔离工作树中依次执行：

1. `node scripts/mini-safe-test-runner.mjs --dry-run`，显式列出两个修改测试和常驻入口护栏测试；检查路径列表不含受保护文件。
2. 通过 `scripts/mini-safe-test-runner.mjs` 运行上述三项测试，再运行明确列出的 28 个 Mini 安全测试文件；共享核心位置使用已有 `LOCAL_SYNTHETIC_CORE_ROOT`。
3. 对两个改动测试运行 ESLint、Prettier 检查、针对性 TypeScript 检查和 `git diff --check`；检查隔离工作树的精确差异。
4. 经逐文件基线比较后，只把两个测试文件及本合同允许的治理记录选择性同步到主工作树；验证主工作树对应文件仍与隔离结果一致且其他现场未变化。

若当前页面流程不能通过现有角色与范围检查，或必须改写页面/服务、修改写集外文件才能通过，立即停止并记录证据，建立新的独立合同，不扩大 D68 写集。

28 个安全页面测试文件清单：

```text
apps/mini-program/src/pages/visitor.test.ts
apps/mini-program/src/pages/task-assignment.test.ts
apps/mini-program/src/pages/supply-request.test.ts
apps/mini-program/src/pages/staff-verticals.test.ts
apps/mini-program/src/pages/staff-parent-binding-review.test.ts
apps/mini-program/src/pages/staff-daily.test.ts
apps/mini-program/src/pages/staff/leave-review.test.ts
apps/mini-program/src/pages/shared-pickup.test.ts
apps/mini-program/src/pages/shared-parent-workflows.test.ts
apps/mini-program/src/pages/shared-notice.test.ts
apps/mini-program/src/pages/shared-health.test.ts
apps/mini-program/src/pages/shared-fees.test.ts
apps/mini-program/src/pages/pickup.test.ts
apps/mini-program/src/pages/parent-entry.test.ts
apps/mini-program/src/pages/parent/updates.test.ts
apps/mini-program/src/pages/parent/leave.test.ts
apps/mini-program/src/pages/parent/learning.test.ts
apps/mini-program/src/pages/parent/health.test.ts
apps/mini-program/src/pages/parent/consent.test.ts
apps/mini-program/src/pages/parent/binding.test.ts
apps/mini-program/src/pages/notifications.test.ts
apps/mini-program/src/pages/monthly-feedback.test.ts
apps/mini-program/src/pages/mini-workflow-ui.test.ts
apps/mini-program/src/pages/mini-ui-polish.test.ts
apps/mini-program/src/pages/mini-brand-ui.test.ts
apps/mini-program/src/pages/health-incidents.test.ts
apps/mini-program/src/pages/fees.test.ts
apps/mini-program/src/pages/care-records.test.ts
```

## 5. 初始验证证据

- 主工作树首次运行安全入口明确列出的 28 个 Mini 测试文件：`197` 项中 `193` 项通过、`4` 项失败；退出码 `1`。输出保存在系统临时目录 `task20-mini-safe-suite-output.txt`，未纳入项目。
- 失败对应：`mini-workflow-ui.test.ts` 中 3 项旧工作台断言/事件路径；`shared-fees.test.ts` 中 1 项调用不存在的 `handleSharedConnect`。`staff-verticals.test.ts` 现有断言要求工作台入口常驻并只负责跳转，与前述旧要求形成直接冲突。
- User Web 已通过现有 Edge 的本机访客页面 smoke：访客首页及 `teacher-team` 内容跳转均返回成功，390px 视口没有横向溢出；没有外部请求、浏览器控制台错误或页面异常。该证据不代表 Mini 微信开发者工具人工验收。

## 6. 最终验证与范围回执

- 隔离工作树三项聚焦测试 `18/18`；主工作树上述 28 个安全 Mini 页面测试 `197/197`。测试入口只接收显式路径，未读取、复制、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- Mini 产品 TypeScript 检查 `tsc --noEmit -p apps/mini-program/tsconfig.json` 通过；两份修改测试使用显式 `--module ESNext --moduleResolution Bundler` 的 TypeScript 检查通过。目标 ESLint 与 Prettier API 格式检查通过。
- Prettier CLI 因已安装 `bin/prettier.cjs` 文件首部存在异常字节无法启动；使用同一已存在 Prettier 包的 API 完成格式化及检查，没有修补依赖文件。
- 执行检查时误用 `pnpm exec`，pnpm 在隔离工作树安装了 185 个现有开发工具包；此操作违反“禁止安装依赖”。没有修改 package 清单、lockfile 或项目源码；安装内容仅落在该隔离工作树的忽略目录 `node_modules`。后续没有再使用可能自动安装的命令，改用主工作树现有工具。该偏差如实保留，不将其记作符合范围。
- 访客网页的 Edge 桌面/手机 smoke 和四张公开内容卡片跳转已在本轮前段通过；旧 D67 对“Playwright 未安装”的结论已由实际可用的 Python Playwright 与 Edge 证据纠正。Admin 浏览器 smoke 和微信开发者工具手工点按仍未完成。
- 只选择性同步两份获准测试文件及本合同、`PLANS.md`、路线图、活动完成记录。没有产品业务源码变化、lockfile 变化、提交、推送、部署或发布。
- 隔离树 `package.json` 和 `pnpm-lock.yaml` 的 Git 差异为空；主工作树当前有 `package.json` 修改状态，本轮没有触碰且无法用 D68 起始哈希证明其来源。
