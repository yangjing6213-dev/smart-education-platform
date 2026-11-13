# TASK20 G2.5：通知统一服务与跨端只读确认合成切片

## 0. 依据与边界

- 产品依据：`student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。
- 路线依据：`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 的 G2.5。
- 当前事实：Web、Mini、Admin 已分别有通知演示，但各自持有内存样例，尚未证明员工发布后家长在另一端看到同一对象。
- 目标：先建立本机、内存、合成的统一 Notice 来源；再让网页员工审核/发布、网页家长读取/知悉共享同一 ID、版本、租户、校区和班级范围。Mini 与 Admin 先完成同一投影形状和越权负测，原生点击与主树整合仍单独记账。
- 禁止：真实认证、手机号、未成年人真实数据、外部通知、数据库、伙伴云、正式 AI、持久化、依赖/lockfile、commit、push、部署和发布；不修改受保护的 `apps/mini-program/src/pages/staff.test.ts`。

## 1. 实施原则

1. 只允许固定的机构公告和班级活动两个模板，不开放自由标题、正文或联系人字段。
2. 状态分离：`DRAFT → SUBMITTED → CONFIRMED → PUBLISHED`，可退回、重提、撤回；家长回执独立为 `UNREAD → READ → ACKNOWLEDGED`。新版本不能继承旧回执。
3. 服务端从合成成员关系注入 `tenantId/campusId/classId/studentId` 范围；客户端自报范围、旧版本、跨租户、跨校区和解除关系全部拒绝。
4. 发布只代表本机共享演示中的可读投影，不代表真实送达；撤回立即移除家长投影。所有动作留最小匿名审计，不写学生敏感内容。

## 2. 隔离写集

### 共享本地服务：`C:\Users\HU\.codex\worktrees\task20-local-shared-core`

- `packages/contracts/src/notice.ts`
- `packages/contracts/src/index.ts`
- `apps/api/src/local-synthetic/repository.ts`
- `apps/api/src/local-synthetic/sessions.ts`
- `apps/api/src/local-synthetic/routes.ts`
- `apps/api/src/local-synthetic/server.ts`
- `apps/api/src/local-synthetic/notice.service.ts`
- `apps/api/test/local-synthetic-notice.test.ts`
- `tests/local-synthetic/notice.test.mjs`
- `docs/exec-plans/active/notice-core.md`

### User Web：`C:\Users\HU\.codex\worktrees\task20-web-completion`

- `apps/user-web/src/local-synthetic/client.ts`
- `apps/user-web/src/local-synthetic/notice.ts`
- `apps/user-web/src/local-synthetic/notice.test.ts`
- `apps/user-web/src/local-synthetic/projections.ts`
- `apps/user-web/src/main.ts`
- `apps/user-web/src/styles/user-web.css`
- `apps/user-web/preview.mjs`
- `apps/user-web/test/notice-browser.mjs`
- `docs/exec-plans/active/web-notice.md`

### Admin Web：`C:\Users\HU\.codex\worktrees\task20-admin-completion`

- `apps/admin-web/src/main.ts`
- `apps/admin-web/src/local-review/notice-shared.ts`
- `apps/admin-web/src/local-proxy.mjs`
- `apps/admin-web/preview.mjs`
- `apps/admin-web/test/notice-shared.test.mjs`
- `docs/exec-plans/active/admin-notice-shared.md`

### Mini：`C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`

- `apps/mini-program/src/pages/notifications.ts`
- `apps/mini-program/src/pages/notifications.test.ts`
- `apps/mini-program/pages/parent/home/index.ts`
- `apps/mini-program/pages/parent/home/index.wxml`
- `apps/mini-program/pages/parent/home/index.js`（仅由现有编译器生成且内容变化时）
- `docs/exec-plans/active/mini-notice-shared.md`

不新增路由页面，不修改 `app.json`、`index.json`、其他页面或业务配置；若实际需要扩大写集，先暂停并在本合同记录原因。

## 3. 必须验证

- 服务 TypeScript、模型/回环测试、公共契约检查、ESLint、Prettier、`git diff --check`。
- Web/Admin focused tests、预览深链、浏览器流程、320×568/390×844/1365×900、0 页面错误、0 外部请求、0 storage。
- Mini TypeScript、通知源测试、家长页面测试、9 页注册/生成 JS 护栏、ESLint、Prettier（WXML 无解析器时采用静态断言）。
- 端到端最小流程：员工提交固定模板 → 同范围审核 → 发布 → 家长刷新看到同一 Notice ID/版本 → 阅读后单独确认 → 发布新版本时旧确认清除 → 撤回后家长不可见。
- 负测：未审核、平台管理员、错误租户/校区/班级、解绑、旧版本、重复确认和外部请求均 fail closed。

## 4. 完成门

只有服务、Web、Admin、Mini 的本地合成证据均通过，才能将 G2.5 标记为 `PASS_LOCAL_SYNTHETIC;NATIVE_NOT_RUN`。微信开发者工具原生点击、主树业务整合和真实通知仍不得以自动测试替代。

状态：`PLANNED`（2026-10-04；G2.4 收敛后执行）。
