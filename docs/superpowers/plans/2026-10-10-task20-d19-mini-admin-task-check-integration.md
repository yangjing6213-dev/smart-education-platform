# TASK20 D19 Mini 到管理端任务检查跨端集成

- 任务标识：`TASK20_D19_MINI_ADMIN_TASK_CHECK_INTEGRATION`
- 状态：`PASS_LOCAL_SYNTHETIC_SOURCE_AND_GENERATED`
- 依据：V2 项目方案第 31–32、50、55 页与 V3 G3.1。D18 已验证 Mini 员工页面完成任务并进入负责人待检查队列；管理端客户端已有检查动作，但尚未通过同一临时共享服务验证 Mini 完成→管理端检查→Mini 更新。
- 目标：以一条合成任务通过 Mini quick-action 实际页面事件领取、开始、完成；再由实际管理端任务客户端检查同一任务；最后让 Mini 重新读取并显示检查后的状态/版本。
- 基线：`tests/mini-shared-service.test.mjs` SHA-256 `F30324D153B68E6E8B5CCF4558B10D5175A7D8AA3EDED21B4DD19D8C0104040A`；D18 源码/生成模式各 6/6 通过。
- 本机编译：测试前运行管理端既有 TypeScript build，确保实际来源模块编译为可导入 JS；该输出仅作本地测试产物，不纳入源文件写集。

## 精确写集

1. `tests/mini-shared-service.test.mjs`：扩展现有 Mini 任务流程回归，让管理端客户端对同 ID、当前版本执行检查通过，并验证 Mini 刷新后的状态。
2. `PLANS.md`：更新 D18/D19 控制状态与证据。
3. `docs/exec-plans/active/project-completion.md`：记录跨端验证结果。
4. `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`：记录 G3.1 当前证据与剩余事项。
5. 本合同。

## 禁止项

- 不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 不修改业务源代码、页面、API、数据库、编译生成产品 JS、配置、依赖或 lockfile。
- 不使用真实数据、真实认证、外部服务、持久化或外网；不提交、推送、部署或发布。
- 管理端 build 仅生成既有 `dist` 本地验证输出；如需改动任何源代码或其他持久化路径，停止并先更新任务范围。

## 验收

- Mini 通过真实 Page 处理器将分派任务推进至 `COMPLETED`；管理端实际 `StaffTaskAssignmentClient` 从同一临时共享服务读取同一 ID/版本并确认；Mini 再刷新后读取 `CHECKED` 和新增版本。
- 源码页面与编译页面模式均通过；所有 HTTP 请求仅发往 `127.0.0.1`。
- 管理端 TypeScript build/typecheck、Mini typecheck、目标 ESLint/Prettier、Mini 页面注册护栏、`git diff --check` 和范围审计通过；不改变 lockfile。

## 实施结果与验证

- Mini quick-action 页面经真实 Page 处理器把任务推进到 `COMPLETED`；管理端实际 `StaffTaskAssignmentClient` 从同一临时服务读取同一任务并执行 `CONFIRM` 检查；Mini 再刷新后读取同一任务的 `CHECKED` 状态和新版本。
- 服务端对象版本按创建、领取、开始、完成、检查递增；人员范围来自本机合成身份，不由页面自报。所有请求仅发往 `127.0.0.1`。
- `corepack pnpm --filter @student-care/admin-web build` 成功；Mini 共享页面回归源码模式 6/6、编译页面模式 6/6；管理端任务聚焦测试 4/4。
- 管理端和 Mini TypeScript 检查、目标 ESLint、Prettier API 格式核验、Mini 页面注册护栏及 `git diff --check` 均通过。
- 本批只扩展 `tests/mini-shared-service.test.mjs` 并更新治理记录；没有业务源代码、依赖或 lockfile 变更。`staff.test.ts` 未读取、运行或修改。
