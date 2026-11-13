# TASK20 D18 Mini 员工任务真实页面接线回归

- 任务标识：`TASK20_D18_MINI_TASK_ASSIGNMENT_PAGE_INTEGRATION`
- 状态：`PASS_LOCAL_SYNTHETIC_SOURCE_AND_GENERATED`
- 依据：V2 项目方案第 31–32、50、55 页与 V3 G3.1；当前状态已有任务模型/API、Mini 页面按钮和操作权限规则，但主工作树 Mini 实际页面/共享服务集成测试没有覆盖任务领取、开始、完成三个按钮。
- 目标：在主工作树的跨页面 Mini 本机回归中，使用负责人创建的合成任务，由教师通过真实 Mini Page 事件领取、开始、选择固定结果并提交；验证同一任务 ID/版本和页面刷新。
- 基线：`tests/mini-shared-service.test.mjs` SHA-256 `F5B0A3124EDF217E77224A52F993EDD2372607A9397AB3286C121F94A614EBC7`；源码/生成模式既有回归各 5/5 通过（D17）。
- 数据与服务：仅合成机构/角色/任务和临时本机回环服务，任务服务来自 `C:\Users\HU\.codex\worktrees\task20-local-shared-core`，运行完成后关闭。

## 精确写集

1. `tests/mini-shared-service.test.mjs`：新增 Mini 真实页面任务领取/开始/完成集成回归。
2. `PLANS.md`：更新本批控制状态和结果。
3. `docs/exec-plans/active/project-completion.md`：追加执行证据。
4. `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`：记录 V3 G3.1 Mini 任务验收证据。
5. 本合同。

初始不授权修改产品源文件；若新回归复现产品问题，先记录证据并在合同中精确增加必要文件后再修复。

## 禁止项

- 不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 不修改 API、数据库、业务页面、编译生成 JS、配置、依赖或 lockfile。
- 不使用真实数据、认证、外部服务、存储或网络；不提交、推送、部署或发布。

## 验收

- 新集成测试必须通过真实 Mini 页面事件处理器及临时共享服务执行，而不是直接调用任务模型。
- 源码模式与 `MINI_SHARED_RUNTIME=generated` 编译模式均通过；任务 ID一致，状态顺序为 `ASSIGNED → CLAIMED → IN_PROGRESS → COMPLETED`，完成结果来自固定选项。
- 非分配对象/旧版本操作不产生写请求（若该测试场景由本批纳入）。
- Mini TypeScript、目标测试 ESLint/Prettier、现有 Mini 页面注册护栏、`git diff --check` 和精确范围审计通过。

## 实施结果与验证

- 新增的真实 Mini Page 集成用例通过：教师从被分配状态领取任务、开始处理、从固定选项选择结果并完成；负责人审核队列显示相同任务 ID 和版本。旧版本按钮不产生请求。
- `corepack pnpm test:mini-shared-service`：源码模式 6/6 通过；设置 `MINI_SHARED_RUNTIME=generated` 后编译页面模式 6/6 通过。
- `corepack pnpm exec tsc --noEmit --project apps/mini-program/tsconfig.json`、`corepack pnpm exec eslint tests/mini-shared-service.test.mjs`、Mini 页面注册护栏与 `git diff --check` 均通过。
- Prettier API 格式核验对新增测试与本合同均通过。仓库 Prettier CLI 入口运行时报语法错误，因此未改动依赖，并使用已安装的 Prettier API 完成等效格式检查。
- 首次测试数据准备曾错误假设人员列表返回角色详情；该接口按最小披露原则只返回人员 ID/标签/校区/班级。测试已改用合成人员 ID，不涉及产品缺陷或产品代码改动。
- 本批实际代码改动仅 `tests/mini-shared-service.test.mjs`；治理记录按本合同写集更新。无依赖、lockfile、真实数据、外网或持久化变更，受保护的 `staff.test.ts` 未读取、运行或修改。
