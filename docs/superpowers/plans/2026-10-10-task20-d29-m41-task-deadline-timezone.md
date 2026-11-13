# TASK20 D29：M4.1 任务截止日期与逾期状态

## 目标与依据

V2 方案第 32 页要求任务有截止时间，并区分待处理、进行中、完成、逾期和取消；V3 M4.1 要求逾期任务可见、任务状态清楚。本轮复核发现服务端以 UTC 日期判断逾期，而管理端“默认明天”将北京时间日历日转成 UTC 日期；在北京时间午夜后到早上 8 点前，两处都可能早/晚一天。

修复仅针对固定的中国机构日历 `Asia/Shanghai`。本地演示仍使用合成任务；不接真实机构、账号或任务，不改变任务状态流程和权限。

## 精确写集

- `apps/api/src/local-synthetic/task-assignment.service.ts`
- `apps/api/test/local-synthetic-task-assignment.test.ts`
- `apps/admin-web/src/local-review/task-assignment.ts`
- `apps/admin-web/test/task-assignment.test.mjs`
- `apps/user-web/src/local-synthetic/task-assignment.test.ts`
- `apps/mini-program/src/pages/mini-workflow-ui.test.ts`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 本合同

## 实施与验收

1. 先以固定时刻测试证明北京时间跨日时，服务端逾期值与管理端默认截止日不正确。
2. 服务端按 `Asia/Shanghai` 当前日判断逾期；管理端的“默认明天”按相同日历计算，不用 UTC 截断改变日期。
3. 验证截止日当天/未来不算逾期、已完成检查/已取消任务不显示逾期；User Web 与 Mini 保留清晰的逾期提示。
4. 运行 API 任务测试、Admin 任务测试、User Web 任务测试、Mini 工作流页面测试，以及相关 typecheck、build、ESLint、Prettier API、页面注册护栏、`git diff --check` 和精确写集审计。
5. 不修改 `apps/mini-program/src/pages/staff.test.ts`，不安装依赖、不改 lockfile，不连接外网，不提交、推送、部署或发布。

## 完成记录

- **复现：** `2026-10-12T17:00:00.000Z` 对应北京时间 `2026-10-13 01:00`。旧 API 认为业务日期仍是 10 月 12 日，导致 10 月 12 日到期任务未标逾期；旧 Admin 次日默认值是 10 月 13 日，正确应为 10 月 14 日。
- **实现：** API 的全部任务视图统一按 `Asia/Shanghai` 判断逾期；Admin 支持传入当前时刻供固定测试，默认截止日按同一日历生成。User Web 与 Mini 原有逾期提示保持不变并有页面测试保护。
- **TDD：** API 逾期边界和 Admin 默认日期断言先失败；实现后均通过。
- **验证：** API 任务 `4/4`、Admin 任务 `5/5`、User Web 任务 `4/4`、Mini 工作流 UI `10/10`。API/Admin/User Web build、三端 Web/API typecheck、Mini typecheck、目标 ESLint、Mini 页面注册护栏和改动块 Prettier API 检查通过。
- `git diff --check` 与目标路径审计通过；锁文件和依赖未改。微信开发者工具及负责人验收为 `NOT_RUN`。没有真实数据、外网、真实身份、部署或发布。
