# TASK20_G6_PARENT_ADMIN_FEES_ENTRY_SELECTIVE_IMPLEMENTATION

**日期：** 2026-10-08  
**状态：** `AUTHORIZED_LOCAL_SYNTHETIC_IMPLEMENTATION`  
**授权依据：** 用户已明确委托继续完成项目本地开发；当前 `AGENTS.md` 要求按精确写集实施、使用隔离工作树并验证。  
**项目方案：** `student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。  
**前置核对：** G5.2B 原合同 SHA-256 `1B82CB176918D72BF530E11180606D71267D50216B1E3C77FFE818AD5543B046`；主树 Mini 七个文件已相同且 focused tests 18/18 通过。网页与管理端缺少费用入口，整文件复制会覆盖主树现有功能。

## 目标

在现有本机合成服务上补齐两个可从界面找到的只读入口：家长查看自己已审核关系范围内的合成费用与流水；机构负责人查看当前校区费用汇总；平台管理员仅看匿名数量与类型，不显示金额或学生/账单明细。家长页在关系未审核通过时不显示费用数据。员工端入口从管理首页可达。

## 边界

- 仅使用预置合成资料。家长范围固定为演示身份 `parent-alpha`；服务端返回仍须经过当前已审核关系过滤。
- 仅对既有本机接口发送请求。家长和管理端均按既有本机流程使用 POST `/local/sessions` 创建合成会话，并 GET `/local/session` 校验会话；家长随后 GET `/local/binding-applications`，仅在当前学生关系已审核时 GET `/local/fees` 与 `/local/fee-ledger`；管理端随后 GET `/local/fee-summary` 与 `/local/fee-ledger-summary`。为验证已审核关系的隔离，只允许在一次性内存服务实例中用合成身份 POST `/local/binding-applications` 和对应 `/review` 建立测试关系，测试后关闭服务并丢弃状态；产品页面不增加任何关系或费用写入操作。
- 费用页面只读。无支付、退款、签署、上传或数据修改按钮；刷新后仍由内存服务提供数据。
- 传输只允许 `127.0.0.1` 和 `/local/*`；不请求外部网络。
- 保留主树现有访客、家长授权/隐私、员工、管理、文件生命周期和其他页面。不得整份替换主树 `main.ts`。
- 不改 API、Mini、数据库、认证、配置、依赖或 lockfile；不读写受保护的 `apps/mini-program/src/pages/staff.test.ts`；不提交、推送、部署或发布。
- 开发位置：新建隔离工作树 `C:\Users\HU\.codex\worktrees\task20-g6-parent-admin-fees-entry`；只将下方写集中的本轮增量选择性接回主树。

## 精确产品写集

### User Web

- `CREATE apps/user-web/src/pages/parent-fees.ts` — 家长本机服务客户端、严格解析与只读费用页面。
- `CREATE apps/user-web/src/pages/parent-fees.test.ts` — 页面解析、绑定范围、错误和无外网行为测试。
- `MODIFY apps/user-web/src/main.ts` — 接入 `/web/parent/home` 并管理页面连接/离开清理。
- `MODIFY apps/user-web/src/pages/parent-consent.ts` — 关系已审核时显示通往家长费用页的入口。
- `MODIFY apps/user-web/src/pages/parent-consent.test.ts` — 验证仅审核通过时出现费用入口。
- `MODIFY apps/user-web/preview.mjs` — 让 `/web/parent/home` 返回现有单页入口。

### Admin Web

- `CREATE apps/admin-web/src/local-review/fees.ts` — 使用现有本机 loopback transport 的费用汇总客户端和呈现。
- `CREATE apps/admin-web/test/fees.test.mjs` — 固定角色、范围、匿名平台视图、只读传输和渲染行为测试。
- `MODIFY apps/admin-web/src/main.ts` — 增加 `/admin/fees` 路由和管理首页入口，不覆盖已有页面。

以上九条为完整产品写集。治理只允许额外修改 `PLANS.md`、`docs/superpowers/plans/2026-10-08-g6-roadmap-reconciliation-after-g62.md`、`docs/exec-plans/active/project-completion.md`，并新建本合同文件；不得扩展到其他路径。

## 验收与验证

1. 先为 Web/Admin 入口与数据边界添加测试，确认测试因入口或客户端缺失而失败，再实现。
2. User Web：focused 测试、现有家长授权回归、typecheck、build、ESLint、目标文件 Prettier；启动本地 preview，以 HTTP 确认 `/web/parent/home` 可打开。
3. Admin Web：费用 focused 测试、typecheck、build、ESLint、目标文件 Prettier；确认现有 preview 对 `/admin/fees` 返回管理页。
4. 通过本机 API 实际请求验证家长未绑定/待审核时无流水、已审核时仅见当前绑定数据；校区负责人可见校区金额；平台管理员仅见匿名计数。若本机服务未运行，只能启动现有本机合成服务；不得连接外部服务。
5. 执行 `git diff --check`、精确写集审计及主树/来源逐文件差异复核。没有可用网页交互控制器时，将人工页面点击与视觉验收记为 `NOT_RUN`。

## 停止条件

若既有服务响应形状、会话权限或审核关系无法满足上述范围；若测试表明服务会返回未授权学生数据；若必须改动白名单外路径、引入依赖/持久化/外网，或无法安全保留主树现场，停止对应部分并说明证据，不得用放宽断言或整文件覆盖来通过。
