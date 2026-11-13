# TASK20 G2.6：健康与异常共享合成切片

## 0. 依据与边界

- 产品依据：`C:/Users/HU/Desktop/同芯机构项目/开发方案/student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。
- 路线依据：`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 的 G2.6。
- 当前问题：Web、Admin、Mini 已各自有健康异常模型，但尚未共享同一对象、版本、范围和发布状态；员工上报、负责人审核、家长查看之间仍可能各自展示内存样例。
- 本合同只做本地内存合成演示。禁止真实健康资料、医疗判断、真实认证、网络通知、数据库、伙伴云、正式 AI、持久化、依赖或 lockfile 变更，以及 commit、push、部署、发布。

## 1. 行为目标

1. 员工只能从固定观察项和固定处置选项创建事件；不开放自由文本，不推导疾病、诊断或风险结论。
2. 状态固定为 `DRAFT → SUBMITTED → CONFIRMED → PUBLISHED`，允许 `RETURNED` 重提和 `REVOKED` 撤回；审核与发布分离。
3. 服务端按可信合成成员的 `tenantId/campusId/classId/studentId` 注入范围；跨租户、跨校区、跨班级、解绑、过期身份、家长未审核关系和未发布记录均拒绝或空结果。
4. 员工提交后，负责人审核队列显示同一事件 ID 和版本；发布后，已审核家长只看到同一事件的公开摘要；打开、已读、家长知悉分别记录，升级只表示人工跟进，不表示医疗结论。
5. 新版本发布清除旧家长回执；撤回或解绑立即清除家长摘要。所有操作使用精确版本号并保留最小匿名审计字段。

## 2. 隔离写集

### 共享本地服务：`C:\Users\HU\.codex\worktrees\task20-local-shared-core`

- `packages/contracts/src/health-incident.ts`
- `packages/contracts/src/index.ts`
- `apps/api/src/local-synthetic/repository.ts`
- `apps/api/src/local-synthetic/sessions.ts`
- `apps/api/src/local-synthetic/routes.ts`
- `apps/api/src/local-synthetic/server.ts`
- `apps/api/src/local-synthetic/health-incident.service.ts`
- `apps/api/test/local-synthetic-health-incident.test.ts`
- `tests/local-synthetic/health-incident.test.mjs`
- `docs/exec-plans/active/health-incident-core.md`

### User Web：`C:\Users\HU\.codex\worktrees\task20-web-completion`

- `apps/user-web/src/local-synthetic/client.ts`
- `apps/user-web/src/local-synthetic/health-incident.ts`
- `apps/user-web/src/local-synthetic/health-incident.test.ts`
- `apps/user-web/src/main.ts`
- `apps/user-web/src/styles/user-web.css`
- `apps/user-web/test/health-incident-browser.mjs`
- `docs/exec-plans/active/web-health-incident.md`

### Admin Web：`C:\Users\HU\.codex\worktrees\task20-admin-completion`

- `apps/admin-web/src/main.ts`
- `apps/admin-web/src/local-review/health-incident-shared.ts`
- `apps/admin-web/src/local-proxy.mjs`
- `apps/admin-web/preview.mjs`
- `apps/admin-web/test/health-incident-shared.test.mjs`
- `docs/exec-plans/active/admin-health-incident.md`

### Mini：`C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`

- `apps/mini-program/src/pages/health-incidents.ts`
- `apps/mini-program/src/pages/health-incidents.test.ts`
- `apps/mini-program/pages/parent/home/index.ts`
- `apps/mini-program/pages/parent/home/index.wxml`
- `apps/mini-program/pages/parent/home/index.js`（仅现有编译器生成且内容变化时）
- `docs/exec-plans/active/mini-health-incident.md`

不新增页面路由，不修改 `app.json`、`index.json`、受保护的 `apps/mini-program/src/pages/staff.test.ts` 或其他页面配置；如需扩大写集必须先停止并记录原因。

## 3. 必须覆盖的负向场景

- 未审核、跨租户/校区/班级/学生、平台管理员、错误版本、重复提交、重复审核、重复发布、撤回后读取、解绑后读取、自由文本或未知固定选项：全部 fail closed。
- 家长只读发布摘要，不可看到员工内部观察、审核意见或升级记录；发布前和撤回后不可见。
- Mini 仍是轻量投影，不宣称已完成真实跨设备通知；必须明确本机合成和无网络边界。

## 4. 验证顺序

1. 先运行服务合同测试、类型检查、ESLint、Prettier 和 `git diff --check`。
2. Web/Admin 运行 focused tests、预览构建和至少 390×844、1365×900 的无外部请求浏览器流程；保留 G2.4 费用和 G2.5 通知回归。
3. Mini 运行 TypeScript、健康 focused/source tests、全部串行源测试（排除受保护 `staff.test.ts`）、现有 runtime 生成护栏和页面静态检查；WXML 使用静态断言，不把生成 JS 当作原生验收。
4. 端到端本地流程必须从员工上报开始，经负责人审核、发布，再由家长读取和知悉；记录同一 ID、版本和范围。微信开发者工具原生逐按钮点击仍单独记 `NOT_RUN`，不能用自动化替代。

## 5. 完成条件

只有服务、Web、Admin、Mini 的本地合成证据全部通过，且 G2.4/G2.5 回归通过，才能把 G2.6 标为 `PASS_LOCAL_SYNTHETIC;NATIVE_NOT_RUN`。这不代表真实医疗能力、正式通知、生产发布或主工作树已整合。

状态：`PLANNED`（2026-10-04，G2.5 收敛后实施）。
