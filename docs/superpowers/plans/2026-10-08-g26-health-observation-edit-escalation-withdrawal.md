# TASK20 G2.6.1：健康观察记录修改、升级与撤回

## 目标与依据

依据项目 V2.0 方案、G2.6 共享健康记录合同，以及当前隔离工作树核查结果，补齐共享流程的三项缺口：作者修改草稿/退回记录、作者撤回未完成记录、负责人标记人工跟进并继续审核。网页、管理端和小程序必须操作同一条本机合成记录。

现状已确认：共享服务只支持确认/退回；网页离线模型和小程序离线模型另有本地状态，不能代替共享记录。管理端的“校区负责人”和“机构负责人”当前映射到同一个 `owner-east` 身份，因此本任务不把升级伪装成跨角色移交，也不扩大权限范围。

## 行为约定

- 作者可用现有 `health:create` 能力修改自己处于 `DRAFT` 或 `RETURNED` 的记录；只能提交既有固定观察项和固定处置项。保存后进入 `DRAFT` 并增加版本。
- 作者可用现有 `health:submit` 能力撤回自己处于 `DRAFT`、`SUBMITTED` 或 `RETURNED` 的记录。记录保留为 `WITHDRAWN`，不删除、不进入审核队列、不对家长显示。
- 有当前校区/班级范围的负责人可将 `SUBMITTED` 标记为 `EXCEPTION_PENDING`（需人工跟进）。同一授权范围的负责人可以继续确认或退回；重复升级拒绝。此状态不是医疗判断、诊断、通知或自动升级到另一个角色。
- 管理端只显示已有服务身份实际支持的校区负责人审核角色；不把映射到同一身份的重复选项标作机构负责人。
- 家长仍只能看 `PUBLISHED` 摘要；发布撤回、关系解绑和现有范围校验规则保持不变。
- 不增加新页面或产品路由；仅扩展现有本地合成服务命令和现有页面。无自由文本、真实健康资料、真实认证、外部通知、持久化、依赖、lockfile、提交、推送、部署或发布。

## 精确写集

### 共享本地服务：`C:\Users\HU\.codex\worktrees\task20-local-shared-core`

- `packages/contracts/src/health-incident.ts`
- `apps/api/src/local-synthetic/repository.ts`
- `apps/api/src/local-synthetic/health-incident.service.ts`
- `apps/api/src/local-synthetic/routes.ts`
- `apps/api/test/local-synthetic-health-incident.test.ts`

### 用户网页：`C:\Users\HU\.codex\worktrees\task20-web-completion`

- `apps/user-web/src/local-synthetic/client.ts`
- `apps/user-web/src/local-synthetic/health-incident.ts`
- `apps/user-web/src/local-synthetic/health-incident.test.ts`
- `apps/user-web/src/main.ts`
- `apps/user-web/preview.mjs`
- `apps/user-web/test/health-incident-browser.mjs`

### 管理网页：`C:\Users\HU\.codex\worktrees\task20-admin-completion`

- `apps/admin-web/src/main.ts`
- `apps/admin-web/src/local-review/health-incident-shared.ts`
- `apps/admin-web/test/health-incident-shared.test.mjs`

### 微信小程序：`C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`

- `apps/mini-program/src/local-synthetic/client.ts`
- `apps/mini-program/src/local-synthetic/page.ts`
- `apps/mini-program/pages/staff/quick-action/index.wxml`
- `apps/mini-program/src/pages/shared-health.test.ts`
- `apps/mini-program/src/local-synthetic/client.js`（仅本次编译确有变化时）
- `apps/mini-program/src/local-synthetic/page.js`（仅本次编译确有变化时）

除上述文件外不修改任何路径。尤其不修改 `apps/mini-program/src/pages/staff.test.ts`、`app.json`、`index.json`、项目配置和其他页面。

## 验收与验证

1. 先增加失败用例，再实现：固定选项修改、退回后修改、作者撤回、错误版本/跨范围/非作者拒绝、升级后负责人继续确认或退回、重复升级拒绝、已撤回和未发布记录对家长不可见。
2. API、网页、管理端和小程序源/生成模式的 focused tests、类型检查、ESLint、Prettier 与差异检查通过；Mini 注册护栏无变化。若编译改变白名单外生成文件，立即停止并报告。
3. 在隔离本地服务上完成同一 ID 的教师修改/提交 → 负责人升级/确认/单独发布 → 家长刷新查看；另验证作者撤回后审核队列与家长页均无此记录。仅允许回环本地请求，外部请求数必须为 0。
4. 微信开发者工具人工点击仍记录为 `NOT_RUN`，除非本轮工具可用且实际完成点击；自动化测试不能替代人工验收。
5. 最后审计四个 worktree 的精确差异范围和主工作树差异；不整合主工作树业务代码，不提交、不推送、不部署、不发布。

## 停止条件

若现有基线与上述行为/写集不符、需要新增真实服务/角色/路由/依赖、需要改写集外路径，或不能安全保留 worktree 中的既有改动，停止对应部分并记录证据；不得扩大权限或放宽测试。

状态：`IN_PROGRESS`（2026-10-08，本机合成演示）。
