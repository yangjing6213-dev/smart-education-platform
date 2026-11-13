# TASK20 G2.6.1 主工作树选择性整合合同

## 目标与证据

把已在四个隔离工作树完成自动验证的 G2.6.1 健康观察记录修改、撤回和人工跟进能力，选择性整合到当前主工作树。教师、校区负责人、家长和小程序只操作本机共享服务中的同一条合成记录。

来源合同：`docs/superpowers/plans/2026-10-08-g26-health-observation-edit-escalation-withdrawal.md`，SHA-256 `C0B7A23EED008E17B63080A8611D4DEAD8C2D24DAD53DAE89C94A27A0CA51B86`。来源工作树及其自动验证结果以 `PLANS.md` 的 G26 记录为依据。主工作树有大量既有未提交和未跟踪现场，任何来源文件都不得整份覆盖主树文件；只能按本合同逐文件合并 G26 所需行为。

## 行为范围

- 作者仅能修改自己在当前租户、校区和班级范围内的草稿或退回记录；只能使用固定观察项和处置项。
- 作者可撤回自己尚未完成的草稿、待审或退回记录。撤回保留记录，不进入审核队列，也不显示给家长。
- 校区负责人可将待审核记录标记为“需人工跟进”，之后在同一授权范围内继续确认或退回；重复标记拒绝。
- 家长只可查看已发布的固定摘要，并可分别打开和确认知悉。
- Web 在既有员工日报页和家长服务页承载健康记录内容；Admin 在既有机构概览地址的 `#health-review` 页面状态承载审核视图，不增加新的 pathname；Mini 在既有员工快捷服务页承载共享记录。
- 仅对 `http://127.0.0.1` 或 `http://localhost` 的本机服务发请求。只用虚构资料、内存状态和固定选项；不写入浏览器存储、不连接真实机构、真实健康资料、真实认证或外部服务。

## 精确写集

### 共享本机服务与数据约束

- `packages/contracts/src/health-incident.ts`
- `apps/api/src/local-synthetic/repository.ts`
- `apps/api/src/local-synthetic/health-incident.service.ts`
- `apps/api/src/local-synthetic/routes.ts`
- `apps/api/test/local-synthetic-health-incident.test.ts`

### 用户网页

- `apps/user-web/src/main.ts`
- `apps/user-web/src/local-synthetic/health-incident.ts`（新增）
- `apps/user-web/src/local-synthetic/health-incident.test.ts`（新增）

### 机构管理网页

- `apps/admin-web/src/main.ts`
- `apps/admin-web/src/local-review/health-incident-shared.ts`（新增）
- `apps/admin-web/test/health-incident-shared.test.mjs`（新增）

### 微信小程序

- `apps/mini-program/src/local-synthetic/client.ts`
- `apps/mini-program/src/local-synthetic/page.ts`
- `apps/mini-program/pages/staff/quick-action/index.wxml`
- `apps/mini-program/src/pages/shared-health.test.ts`
- `apps/mini-program/src/local-synthetic/client.js`（仅本次编译内容确有变化时）
- `apps/mini-program/src/local-synthetic/page.js`（仅本次编译内容确有变化时）

### 任务记录

- `PLANS.md`
- `docs/superpowers/plans/2026-10-08-g26-main-tree-selective-sync.md`

其他任何路径都不在写集内。特别不读取、不修改 `apps/mini-program/src/pages/staff.test.ts`，也不修改 `app.json`、`index.json`、项目配置、依赖清单或 lockfile。

## 执行顺序与验收

1. 逐项审阅来源与主树差异，先更新行为测试并看到对应失败，再合并实现；保留目标文件中所有与 G26 无关的当前内容。
2. 运行 contracts/API/User Web/Admin Web/Mini 聚焦测试、类型检查、ESLint、适用文件 Prettier、Mini 页面注册和编译完整性护栏。
3. 在独立本机演示服务验证教师创建/修改/提交 → 负责人人工跟进/审核/发布 → 家长刷新/查看/确认，以及作者撤回后审核和家长页面均不可见；记录外部请求为 0。
4. 运行 `git diff --check`、逐文件范围审计和本地页面/路由 smoke。微信开发者工具实际点击只有在本轮真的完成时才记 `PASS`，否则记 `NOT_RUN`。

## 禁止与停止条件

- 不连接真实身份、真实健康资料、API 以外的任何网络、数据库、伙伴云、正式 AI、外部通知或持久化。
- 不安装依赖、不改 lockfile、不提交、不推送、不部署、不发布，不清理、移动、删除或覆盖其他现场。
- 不改变受保护的 `apps/mini-program/src/pages/staff.test.ts`。
- 如果实现需要写集外文件、依赖写集外页面/配置，或选择性整合会覆盖主树已有独立功能，立即停止该部分，记录阻塞及证据，不扩大范围。

## 完成状态

实施开始前：`PLANNED`。完成状态、命令结果、精确差异和剩余人工复核项只在执行后写入 `PLANS.md`。
