# TASK20 G5.2B 合成账务流水三端只读展示（2026-10-07）

**状态：** `AUTHORIZED_IN_PROGRESS`
**前置：** G5.2A 固定合成 CNY 流水只读核心已通过独立复核；接口仅有 GET，使用当前有效的已审核关系、机构/校区权限。
**授权依据：** 用户已委托继续完成本项目剩余本地开发，并确认复核通过后进入下一步。按当前 `AGENTS.md`，只在精确写集内工作；本地演示仍只用合成数据。

## 目标与验收

1. User Web 和小程序在现有家长首页/费用区域展示当前已选、仍有效关系学生的收费、入账、退款固定样例及本地对账金额。页面明确标为合成示例，不代表真实收付款；无关系或无流水时显示清楚的空/不可用状态。
2. 管理网页复用既有 `/admin/fees`：当前校区负责人可查看本校区合计和类型数量；平台管理员只看匿名总数与类型数量，页面和客户端状态都不得出现金额或学生/账单明细。
3. 客户端只读取既有 `GET /local/fee-ledger` 与 `GET /local/fee-ledger-summary`；代理只增加精确 GET 白名单。不得新增路由或写入动作。
4. 先增加能证明当前问题的失败测试，再实现。验证数据字段/金额为安全整数分、类型枚举固定、当前选中学生隔离、断开或角色切换清空、负责人/平台视图权限差异、无付款/退款按钮及无外部请求。
5. 复用现有品牌和卡片样式，不另加图片、图标或依赖。完成 focused tests、各端 TypeScript 检查、ESLint、Prettier、`git diff --check`、精确范围审计；有现成浏览器检查时做本地视觉复核。微信开发者工具人工点击单独记录，不以自动测试替代。

## 精确写集

### User Web 隔离工作树 `C:\Users\HU\.codex\worktrees\task20-web-completion`

- `apps/user-web/src/local-synthetic/client.ts`
- `apps/user-web/src/local-synthetic/client.test.ts`
- `apps/user-web/src/local-synthetic/fees.ts`
- `apps/user-web/src/local-synthetic/fees.test.ts`
- `apps/user-web/preview.mjs`
- `apps/user-web/test/preview.test.mjs`

### 管理网页隔离工作树 `C:\Users\HU\.codex\worktrees\task20-admin-completion`

- `apps/admin-web/src/local-review/client.ts`
- `apps/admin-web/src/local-review/fees-view.ts`
- `apps/admin-web/src/local-proxy.mjs`
- `apps/admin-web/src/main.ts`
- `apps/admin-web/test/fees.test.mjs`
- `apps/admin-web/test/preview.test.mjs`

### 微信小程序隔离工作树 `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`

- `apps/mini-program/src/local-synthetic/client.ts`
- `apps/mini-program/src/local-synthetic/client.test.ts`
- `apps/mini-program/src/local-synthetic/page.ts`
- `apps/mini-program/src/pages/shared-fees.test.ts`
- `apps/mini-program/templates/local-synthetic.wxml`
- `apps/mini-program/src/local-synthetic/client.js`（仅前述 TS 编译后内容确有变化时）
- `apps/mini-program/src/local-synthetic/page.js`（仅前述 TS 编译后内容确有变化时）

### 主工作树治理记录

- `docs/superpowers/plans/2026-10-07-g52b-synthetic-ledger-client-presentation.md`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`

产品代码必须留在相应隔离工作树；本阶段不向主工作树同步业务代码。

## 明确不做

- 不新增页面、路由、API、权限或业务写入动作；不接真实支付/退款、银行、微信支付、网络服务、数据库、持久化或正式 AI。
- 不向管理网页暴露家长流水行、学生姓名、文档 ID 或任何平台级金额；平台端返回字段必须是匿名数量与类型计数。
- 不修改主工作树产品代码，不改其他 worktree 现场；不安装依赖、不改 lockfile，不触碰 `staff.test.ts`、`app.json` 或小程序项目配置。
- 不提交、推送、部署、上传或发布；自动浏览器测试不视为微信开发者工具人工验收。

## 验证和停止条件

- Core 接口只读复用：对照 G5.2A 合同及现有本机 loopback 测试确认两个端点的实际响应形状，不改 Core 写集。
- Web：费用渲染/解析与客户端 focused tests；预览代理 GET 允许、POST 拒绝；typecheck、ESLint、Prettier；如现有本地浏览器脚本可用，验证选中孩子切换、显示流水和页面无外部请求。
- Admin：费用投影/渲染与 ReviewClient focused tests；预览代理仅允许 GET 流水汇总并拒绝 POST；平台匿名字段负测；typecheck、ESLint、Prettier；可用时在本地预览视觉复核。
- Mini：客户端解析、已选孩子投影、家长页 WXML 与真实注册 Page focused tests；TypeScript 检查；只刷新本合同列出的两个生成 JS；页面注册/运行时护栏、ESLint、Prettier、WXML 检查及范围审计。
- 任一现有数据模型无法在不扩展服务端写集的情况下承载显示、需要新增页面/路由/配置/依赖、发现真实个人或财务数据、无法保留既有 worktree 现场，立即停止并报告。
- 微信开发者工具人工视觉及点击状态如本轮无法直接完成，记录为 `NOT_RUN`，不得宣称已验收；后续由真实 DevTools 证据单独闭合。
