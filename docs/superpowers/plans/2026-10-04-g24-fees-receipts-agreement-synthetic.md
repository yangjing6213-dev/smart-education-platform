# TASK20 G2.4：费用、收据与协议只读合成切片

## 0. 依据与边界

- 产品依据：`student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。
- 路线依据：`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 的 G2.4。
- 目标：在现有三端本地合成轨道增加家长费用/收据/协议只读查看，明确孩子范围、版本、有效期和撤回状态。
- 本批只使用固定虚构学生、金额和文档；所有状态内存保存；不收款、不生成真实账单、不下载外部文件、不发送通知。
- 禁止：真实认证、真实手机号或学生资料、数据库/伙伴云/支付/外部存储、依赖或 lockfile 变更、commit、push、部署和发布。
- `apps/mini-program/src/pages/staff.test.ts` 为受保护历史测试，不修改。

## 1. 交付目标

1. 家长只能查看已批准关系下的固定合成 `FeeItem`、`Bill`、`Receipt`、`Agreement`；切换学生、解绑、撤回或过期后立即清空详情。
2. 网页提供完整只读列表、状态、金额/币种、账期、来源版本、协议有效期与不可用原因；小程序提供当天摘要和详情入口；管理网页只显示范围内的合成汇总，不显示支付写入控件。
3. 所有对象使用同一 `tenant_id/campus_id/student_id` 范围和版本校验；跨租户/校区/孩子、过期、撤回和未知状态均 fail closed。
4. “下载”只返回带“合成数据”标记的本地文本摘要，不访问网络、不写文件；无效或撤回文档没有可操作按钮。

## 2. 隔离写集

### 共享本地服务（`task20-local-shared-core`）

- `packages/contracts/src/finance.ts`（新增）
- `packages/contracts/src/index.ts`
- `apps/api/src/local-synthetic/repository.ts`
- `apps/api/src/local-synthetic/sessions.ts`
- `apps/api/src/local-synthetic/routes.ts`
- `apps/api/src/local-synthetic/server.ts`
- `apps/api/src/local-synthetic/fees.service.ts`（新增）
- `apps/api/test/local-synthetic-fees.test.ts`（新增）
- `tests/local-synthetic/fees.test.mjs`（新增）
- `docs/exec-plans/active/fees-core.md`（新增）

### User Web（`task20-web-completion`）

- `apps/user-web/src/local-synthetic/fees.ts`（新增）
- `apps/user-web/src/local-synthetic/fees.test.ts`（新增）
- `apps/user-web/src/local-synthetic/client.ts`
- `apps/user-web/src/main.ts`
- `apps/user-web/src/styles/user-web.css`
- `apps/user-web/test/fees-browser.mjs`（新增）
- `apps/user-web/test/preview.test.mjs`
- `docs/exec-plans/active/web-fees.md`（新增）

### Admin Web（`task20-admin-completion`）

- `apps/admin-web/src/local-review/fees-view.ts`（新增）
- `apps/admin-web/src/local-review/client.ts`
- `apps/admin-web/src/local-review/view.ts`
- `apps/admin-web/src/main.ts`
- `apps/admin-web/local-proxy.mjs`
- `apps/admin-web/preview.mjs`
- `apps/admin-web/test/fees.test.mjs`（新增）
- `apps/admin-web/test/fees-browser.mjs`（新增）
- `apps/admin-web/test/preview.test.mjs`
- `docs/exec-plans/active/admin-fees.md`（新增）

### Mini（`task20-mini-brand-redesign`）

- `apps/mini-program/src/pages/fees.ts`（新增）
- `apps/mini-program/src/pages/fees.js`（仅由现有编译器生成且内容变化时）
- `apps/mini-program/src/pages/fees.test.ts`（新增）
- `apps/mini-program/pages/parent/home/index.ts`
- `apps/mini-program/pages/parent/home/index.wxml`
- `apps/mini-program/pages/parent/home/index.js`（仅由现有编译器生成且内容变化时）
- `apps/mini-program/src/pages/mini-workflow-ui.test.ts`
- `docs/exec-plans/active/mini-fees.md`（新增）

## 3. 最小状态与安全规则

- 文档类别固定为 `FEE_ITEM`、`BILL`、`RECEIPT`、`AGREEMENT`；状态固定为 `AVAILABLE`、`PAID`、`VOIDED`、`EXPIRED`、`REVOKED`。
- 家长只读角色只能看到 `AVAILABLE/PAID` 且在有效期内、同租户同校区同学生的投影；`VOIDED/EXPIRED/REVOKED` 只显示原因，不返回敏感正文。
- 管理角色只能查看本校区汇总和审计元数据，平台角色仅匿名计数；任何 POST/支付/退款/签署动作均不存在。
- 版本或关系发生变化时，旧按钮和旧详情必须返回冲突/不可用，不得沿用旧确认。
- 文本和金额均固定为合成样例，页面显式显示“合成数据，仅用于本机演示”。

## 4. 验证矩阵

- 先写失败测试：跨学生/校区、撤回/过期、未知状态、旧版本和下载网络调用均被拒绝。
- 共享服务：TypeScript、focused model/loopback tests、ESLint、Prettier、`git diff --check`。
- User Web/Admin Web：focused tests、浏览器点击列表/详情/不可用状态、320×568/390×844/1365×900、无外部请求/存储/页面错误。
- Mini：类型检查、`fees.test.ts`、相关父页面测试、9 页注册/生成 JS 护栏、ESLint、Prettier（WXML 若无解析器只做静态断言）、`git diff --check`。
- 每个工作树逐文件检查写集；不整合主工作树业务代码，不用自动化测试冒充真实微信工具点击。

## 5. 完成门

- 只有三端本地合成证据全部通过，才将 G2.4 标为 `PASS_LOCAL_SYNTHETIC;NATIVE_NOT_RUN`。
- 真实支付、正式账单、外部下载、跨设备持久化和正式运营仍标为未实现。
- 若实现需要白名单外文件或外部服务，停止该切片并记录原因，转到下一项不依赖目标。

状态：`IN_PROGRESS`（2026-10-04；先完成共享服务与三端只读适配，再回写 `PLANS.md`）。
