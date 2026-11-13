# TASK20 D53：G2.3 管理端接送异常入口选择性整合

## 任务边界

- 任务 ID：`TASK20_D53_G23_ADMIN_PICKUP_REVIEW_MAIN_INTEGRATION`
- 目标：把 V3 M3.3 所需的机构管理端接送摘要/异常处理入口补到当前主工作树。当前主树没有 `/admin/pickup-review` 页面、导航或接送代理许可；已知隔离来源 `C:\Users\HU\.codex\worktrees\task20-admin-completion` 中的 G2.3 页面和浏览器流程经复验通过，但其整份 `main.ts` 含有与主树不一致的其他功能，不得整文件复制。
- 流程深度：`LONG_HORIZON`。本阶段跨越管理端页面、同源本机代理、权限边界和浏览器流程，按一个共享合同推进，不另起平行计划。
- 依据：项目方案 PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`；现有 G2.3 合同 `docs/superpowers/plans/2026-10-03-g23-pickup-authorization-and-verification.md`。
- 基线 Git HEAD：`bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。主树现有 `apps/admin-web/src/main.ts` 修改必须保留；本合同记录创建前哈希：`C5439E233B0684C7417F16CAB5C1406B09C4732366EA19D2002B78103330A33A`。当前代理基线 SHA-256：`685773BF7A9FF8E41C7D435E9E3C1991BE8F0AB41593B78EA24C25DE6EAE77F3`；`PLANS.md` 基线 SHA-256：`C42303AA9156A7B5EA84512C2B50A8D42590379598EA6BA89DFD8AB2F55C505E`。

## 精确写集

- MODIFY `apps/admin-web/src/main.ts`：只增加接送审核入口、页面连接/刷新/跟进/解决事件和离开页面时清理；保留现有现场。
- MODIFY `apps/admin-web/src/local-proxy.mjs`：仅允许本页所需的接送摘要 GET 和固定异常 review POST 路径，不放宽其他 API。
- CREATE `apps/admin-web/src/local-review/pickup-review.ts`：本机合成接送审核专用客户端及安全页面投影，不复用会额外读取关系、请假、成长、考勤或费用的通用审核客户端。
- CREATE `apps/admin-web/test/pickup-review.test.mjs`：权限、范围、投影、固定状态动作、版本冲突和敏感字段不进入页面状态的行为测试。
- CREATE `apps/admin-web/test/pickup-review-browser.mjs`：浏览器实际打开新入口并完成人工跟进/解决操作，同时检查只访问 loopback、无页面错误/横向溢出及代理拒绝未授权路径。
- MODIFY `PLANS.md`：记录合同、验证结果和保留的 Owner/微信原生阶段门。
- CREATE 本合同。

## 禁止范围

- 不修改 API、数据库、用户网页、小程序、其他管理功能、配置、依赖或 lockfile；不读取、运行、复制或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 不复制已存在隔离树的整份 `main.ts` 或通用审核客户端；不覆盖、清理或回退主树/任何现存工作树现场。
- 不接入真实身份、机构数据、通知、外部网络或持久化；不 commit、push、部署或发布。
- 如发现本机 API 没有现成的授权范围/异常处理接口，或需要增加白名单外文件，停止并记录具体原因。

## 行为与验收标准

1. `/admin/pickup-review` 可从管理端导航进入，也可直接打开；只用现有本机合成 API。
2. 只有具备 `pickup:review` 的负责人角色能跟进或解决异常；平台角色只看到不含学生明细的说明，受限模式没有可执行按钮。每个动作携带当前版本，跟进与解决使用固定结果，不存在绕过现场人工核验的放行操作。
3. 页面只显示负责人处理所需的学生合成标签、日期、固定异常类别、状态/结果版本和有限授权摘要；凭证、接送核验步骤、教师身份、设备和内部检查内容不得进入可渲染状态或 HTML。
4. 同源代理严格限定：`GET /local/pickup-authorizations`、`GET /local/pickup-records`、`GET /local/pickup-exceptions`、现有 session 建立/读取，以及 `POST /local/pickup-exceptions/<UUID>/review`。其他 pickup 写入（如 credential、confirm、创建异常）和任意外部地址均拒绝。
5. 接送列表的租户/校区/班级范围由本机 API 的成员权限和服务端过滤作为权威边界；相关摘要 DTO 有意省略内部范围编号。页面不伪造缺失编号，若返回内容含范围编号则必须与会话一致。API 现有 `PickupService.authorizations()`、`records()`、`exceptions()` 按当前成员范围过滤；本任务只读验证这些既有规则，不改 API。
6. 单元测试和浏览器实际点击通过；至少覆盖负责人跟进→解决、非负责人无写动作、过期版本和服务端 409 冲突失败闭合、代理路径拒绝、无外部请求；手机与桌面宽度均无横向溢出。
7. Admin typecheck、ESLint、目标格式检查、`git diff --check`、精确范围审计通过。主树既有差异和未跟踪文件保持原样；本任务不把 Admin 自动验证称为 Owner Review 或微信原生验收。

## 执行步骤

1. 先写行为测试并观察预期失败，再以最小实现使其通过。
2. 增加专用 Admin 客户端、页面入口和严格代理白名单。
3. 运行单元/浏览器测试、类型、Lint、格式、差异与范围审计；委托独立代码审查并修复有效发现。
4. 复核主树差异，只保留上述写集；同步 D53 状态到 `PLANS.md`。不提交或发布。

## 来源验证证据

- 隔离来源 HEAD 与主树基线相同：`bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。
- 来源 Admin `typecheck`、`build` 通过；接送页面定向测试 `2/2`、浏览器点击 `1/1` 通过。该证据只证明隔离来源实现；主树本阶段仍以 D53 复验结果为准。

## 当前状态

`PASS_LOCAL_SYNTHETIC;MAIN_TREE_ADMIN_PICKUP_ENTRY_IMPLEMENTED_AND_VERIFIED;OWNER_AND_NATIVE_ACCEPTANCE_NOT_CLAIMED`

## 主树验证结果

- Admin TypeScript build/typecheck：PASS；Admin ESLint：PASS。
- 专项单元测试：`node --test apps/admin-web/test/pickup-review.test.mjs`，8/8 PASS。
- 浏览器实际点击：`node --test apps/admin-web/test/pickup-review-browser.mjs`，1/1 PASS；负责人跟进后解决、员工只读、平台角色无学生明细、代理拒绝未授权路径、390/1280 宽度无溢出、无外部请求/页面错误/浏览器存储均通过。
- 本机 API pickup 回归：先 `pnpm --dir apps/api run build`，再 `node --test --test-concurrency=1 apps/api/dist/test/local-synthetic-pickup.test.js`，6/6 PASS。该检查确认现有 API 授权和固定异常状态规则；API 源文件未修改。
- Prettier 3.9.6 包 API：新客户端、两个专项测试和本合同通过。主 `main.ts` 的仓库 HEAD 原始版本本身未通过整文件 Prettier 检查；只格式化本任务新增代码块，避免重排主树既有大量未格式化修改。`local-proxy.mjs` 也是本任务开始前已有的未跟踪本机文件，仅验证新增白名单语句的格式，不重排整个文件。
- `git diff --check`、合同写集和主树现场保留审计：PASS；没有修改 API、Mini、User Web、配置、依赖/lockfile，也没有读取、运行、复制或修改 `staff.test.ts`；未 commit、push、部署或发布。
- 独立代码审查：两条范围/409 反馈已处理；API 作为权威范围过滤边界的现有实现由 `local-synthetic-pickup.test.js` 6/6 回归确认。Owner Review 与微信开发者工具人工验收仍未完成。
