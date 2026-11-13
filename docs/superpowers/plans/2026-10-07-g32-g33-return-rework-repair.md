# TASK20 / G3.2—G3.3 退回与重审流程修复

## 0. 依据与边界

- 项目依据：PDF V2 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`，现行总路线 `2026-10-03-project-progress-and-completion-roadmap.md`。
- 授权：负责人持续自主本地开发要求；本合同记录最小修复范围，不重复等待普通开发批准。
- 仅合成数据、本机共享服务和现有内存会话。不接真实认证、机构、外网、数据库、正式 AI；不安装依赖、修改 lockfile、提交、推送、部署或发布。不整合主树业务，不修改 Mini、Admin 或既有无关现场。
- 本轮只修返工路径；真实业务来源聚合、Mini 日报/月度共享接线、任务分派仍为未完成，不能被本合同的通过覆盖。

## 1. 可验证的目标

1. 日报退回后，教师看到预填原值的固定选项表单，可修改并重新提交同一记录；版本增加，负责人看到实际新内容。不得把退回记录再次送入仅接收草稿的首次提交路径。
2. 月度反馈退回后，教师能修改四个固定补充项并重提，页面必须把表单值传入既有服务。
3. 月度来源版本变化后，旧摘要继续对家长隐藏；教师可对 `REVIEW_REQUIRED` 记录编辑，按当前合成来源版本重新形成 `DRAFT`，清空旧审核、发布和知悉，再提交、负责人确认并发布。保持手动确认和发布分离。
4. 旧版本、跨身份/租户/校区、非法值继续拒绝；不放宽权限。重新发布后新摘要可见，旧知悉不复用。

## 2. 精确写集

### 共享服务：`C:/Users/HU/.codex/worktrees/task20-local-shared-core`

- MODIFY `apps/api/src/local-synthetic/monthly-feedback.service.ts`
- MODIFY `apps/api/test/local-synthetic-monthly-feedback.test.ts`
- CREATE `docs/exec-plans/active/monthly-rework-repair.md`

### 用户网页：`C:/Users/HU/.codex/worktrees/task20-web-completion`

- MODIFY `apps/user-web/src/local-synthetic/client.ts`
- MODIFY `apps/user-web/src/local-synthetic/staff-daily.ts`
- MODIFY `apps/user-web/src/local-synthetic/staff-daily.test.ts`
- MODIFY `apps/user-web/src/local-synthetic/monthly-feedback.ts`
- MODIFY `apps/user-web/src/local-synthetic/monthly-feedback.test.ts`
- MODIFY `apps/user-web/src/main.ts`
- MODIFY `apps/user-web/test/staff-daily-browser.mjs`
- MODIFY `apps/user-web/test/monthly-feedback-browser.mjs`
- CREATE `docs/exec-plans/active/web-rework-repair.md`

### 主树控制面

- CREATE 本合同。
- MODIFY `PLANS.md`。
- MODIFY `docs/exec-plans/active/project-completion.md`。

## 3. 实施与验证

1. 先复现三条失败路径，记录失败结果；服务和 Web 分开工作树实施，保留既有改动。
2. 服务专项测试验证来源变化、家长隐藏、重建草稿、重审发布、旧版本拒绝与范围保护；Web 页面测试验证表单预填、修改、字段传递与重提。
3. 浏览器经实际 `preview.mjs` 和本机共享服务走日报退回修改重提、月度退回重提及来源变更后的完整再发布。不得用路由拦截替代实际代理。运行相关回归、类型检查、Lint、Prettier、`git diff --check` 和本轮写集审计，再独立复核。

## 4. 停止与结果记录

- 需要新增接口、修改写集外路径、依赖或扩大业务目标时先记录范围变化，不静默越界；真实服务、费用、生产和破坏性操作仍须另行确认。
- 每个问题最多两轮自动修复；失败如实记录产品/工具问题，不削弱断言。
- 结果区分已修改、已测试、本机实际浏览器通过与未验证。不宣称所有日报/月度需求已完成；原生 Mini 点击验收不在本合同范围内。
