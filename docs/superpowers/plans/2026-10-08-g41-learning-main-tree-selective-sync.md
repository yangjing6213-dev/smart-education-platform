# TASK20 G4.1–G4.3 受监督学习网页与管理端选择性整合合同

## 目标

把已在隔离工作树中完成并验证的固定题库学习闭环、安全监督和回归护栏，选择性整合到主工作树现有网页与管理端。小程序和共享合成 API 先核对现有状态；只有目标内容不一致且合同允许时才补入。全部使用虚构示例、固定题目和本机内存服务，不接正式 AI。

## 依据

- G4.1：`docs/superpowers/plans/2026-10-07-g4-supervised-fixed-question-learning.md`，SHA-256 `5949B468A6D8D2E3B08957DE8FF3F9AE5BB0CF1D6898FDCFB75634F16C40CA2C`。
- G4.2：`docs/superpowers/plans/2026-10-07-g42-learning-safety-and-supervision-controls.md`，SHA-256 `E037DF0DD26BC86D2BBBA852E16C629D95662586F920208D9617CF1D0572AED8`。
- G4.3：`docs/superpowers/plans/2026-10-07-g43-learning-safety-regression-guards.md`，SHA-256 `FCEA10232453DACBE43D2E92DF95E1E30992D682CFD380F56F3F2DEE9302AC64`。
- 本地工作树完整性基线：主树与四个来源树均以 `bd0001faa8e2fd7bbabe86e3d778ba24431107e8` 为基底；现有未提交和未跟踪现场全部保留。

## 允许的主工作树写集

### 用户网页

- MODIFY `apps/user-web/src/main.ts`：只接入现有家长首页、员工日报入口和新的学习页路由/交互，保留当前 G3.3/G3.5/G6 页面与逻辑。
- MODIFY `apps/user-web/preview.mjs`：仅增加学习会话、教师摘要与安全所需的固定本机请求白名单。
- MODIFY `apps/user-web/src/styles/user-web.css`：只追加学习页必要样式。
- CREATE `apps/user-web/src/local-synthetic/learning.ts`。
- CREATE `apps/user-web/src/pages/parent-learning.ts`。
- CREATE `apps/user-web/src/pages/parent-learning.test.ts`。
- CREATE `apps/user-web/test/learning-session-browser.mjs`。

### 管理网页

- MODIFY `apps/admin-web/src/main.ts`：仅接入匿名学习安全汇总入口，保留现有统计、资源、隐私、同意、员工和文件页面。
- MODIFY `apps/admin-web/preview.mjs`：仅为 `/admin/learning-safety` 增加页面回退。
- MODIFY `apps/admin-web/src/local-proxy.mjs`：仅允许读取 `/local/learning-safety-summary`。
- CREATE `apps/admin-web/src/local-review/learning-safety.ts`。
- CREATE `apps/admin-web/test/learning-safety.test.mjs`。
- CREATE `apps/admin-web/test/learning-safety-browser.mjs`。

### 控制面

- MODIFY `PLANS.md`。
- MODIFY `docs/exec-plans/active/project-completion.md`。
- 本合同仅追加实际执行和验证结果。

## 只读核验范围

- 来源树：`C:\Users\HU\.codex\worktrees\task20-local-shared-core`、`C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`、`C:\Users\HU\.codex\worktrees\task20-web-completion`、`C:\Users\HU\.codex\worktrees\task20-admin-completion`。
- 核对 G4 API 与 Mini 的现有主树文件、生成 JS、页面注册和来源树内容。只读文件不得为“整齐”而复制；记录目标与来源的哈希和差异结论。
- 来源树在本任务保持只读，主树仅逐文件选择网页和管理端增量，不以来源树整个入口文件覆盖主树。

## 验证

1. 先运行新增页面测试，确认路由不可用或断言失败，再实施适配。
2. 用户网页与管理网页 focused tests、typecheck、build、ESLint、Prettier（新文件及确切编辑区段）、真实本机浏览器角色流程与 `git diff --check`。
3. 家长流程覆盖成人同意、固定题目作答、顺序提示、巩固、结束；教师只查看负责班级摘要并接手；管理端只呈现匿名数字。浏览器不访问外网、无页面错误、失败请求或横向溢出。
4. Mini 运行时新鲜度和注册护栏、API/Mini 相关回归按实际差异与现存证据复核，不触碰 `apps/mini-program/src/pages/staff.test.ts`。
5. 精确路径审计并检查所有现有主树现场均被保留。

## 禁止项与停止条件

- 禁止真实 AI、真实儿童或机构数据、真实认证、外部通知、数据库、云服务、持久化、支付、外链、依赖或 lockfile 变更。
- 禁止新增小程序路由、页面或配置，禁止修改 `staff.test.ts`。
- 禁止整文件覆盖主树 `main.ts`、`preview.mjs` 或样式；若当前主树结构不能通过局部适配安全接入，立即停止并记录具体冲突。
- 禁止清理、暂存、覆盖、提交、推送、部署、上传或发布任何其他现场。

## 初始状态

`READY_FOR_LOCAL_SYNTHETIC_SELECTIVE_SYNC`；负责人已授权自主继续本地合成开发。本合同不构成 Owner Review、真实服务接入或发布验收。

## 实施与验证结果（2026-10-08）

- 状态：`PASS_LOCAL_SYNTHETIC_SELECTIVE_SYNC`；G4.1 Owner Review 仍按既有记录为通过；G4.2/G4.3 Owner Review 仍为 `PENDING`；微信开发者工具人工验收为 `NOT_RUN`。
- TDD 红灯已记录：在加入页面模块前，User Web 类型检查因缺少 `parent-learning.js` 失败；Admin 页面测试因缺少 `learning-safety.js` 失败。实现后相应检查转绿。
- 用户网页：仅选择性新增固定题库学习客户端/页面和页面测试、浏览器测试；在既有家长首页与员工工作台追加入口；接入 `/web/parent/learning`、`/staff/learning` 和严格本机预览白名单。保留主树原有费用、日报、资源、健康等功能。
- 管理网页：选择性新增匿名安全汇总客户端与测试；在现有管理导航和路由加入 `/admin/learning-safety`；代理仅增加无查询参数的 `GET /local/learning-safety-summary`。`apps/admin-web/preview.mjs` 未修改，因为现有 `/admin/*` 通用页面回退已覆盖新页面。
- 只读差异复核：API `learning-session.service.ts` 主树/来源 SHA-256 均为 `540B1E85422AA49B79F7EFBD743ABCE0648C9B5B9DEE4B7ACBF6FD754F47E038`；API `routes.ts` 主树为 `762105DA21B92E0710663CF5D7AA74B94F58D5884E6BCCC375670C8C992D45D2`、来源为 `909C66F40F8A142CC5C6EC6640B1B23C761D65F3A860A70C75EBC73454EF5414`，全文件差异来自主树其他已集成路由，所需学习端点在主树已存在，因此没有复制。Mini 学习模型、页面 TypeScript、WXML 和生成 JS 分别与来源树一致，SHA-256 为 `8D2C98FB2606E943900AD3808C592723520F4684406B756494B0EA65339DBDDB`、`7426E454B2F06468CC2A13291300841F8D2ECE822C5E39A74368A80E7DE17DD0`、`819CC5A952CCBB7D199350CA6045C7A4B9CF28895508635EA25C5239E30C9394`、`E6937790DD8E2ADCECAA771F06B09A296EB1850728BF12ED983E80DFB4CB66FE`；没有复制或修改 API/Mini 产品文件。
- 验证：User Web 与 Admin Web TypeScript 构建通过；用户学习页面测试 `4/4`、管理安全页面测试 `2/2`；两端实际浏览器流程通过家长成人同意、固定题目、顺序提示、巩固、结束/删除、教师班级摘要与接手、管理端匿名汇总、角色范围、无横向滚动、无页面错误、无失败响应、无外网请求检查。API TypeScript 构建及学习服务测试 `4/4` 通过；Mini TypeScript 检查及页面注册护栏通过（`MINI_PAGE_REGISTRATION_PASS generatedJs=not-required`）；ESLint、作者文件和本次修改区段 Prettier、`git diff --check` 通过。
- 工具限制：仓库要求 pnpm `>=11.22.0 <12`，当前为 `11.19.0`，故未调用 pnpm 脚本；改用已经安装的 TypeScript、Node、ESLint、Prettier 和 Playwright 工具执行以上验证，没有安装依赖或修改 lockfile。Admin 主入口整文件 Prettier 仍报告既有格式漂移；本次精确编辑区段均通过检查，未整文件重排。
- 浏览器隔离修正：最初的 User Web 浏览器脚本路径错误，已改为通过 `USERPROFILE` 定位只读 G4 API 来源树。复核又发现旧工作台面板会尝试访问默认回环端口 `127.0.0.1:4317`；最终浏览器测试在浏览器层拦截该请求，只用隔离测试服务完成学习流程，不触碰当前常驻演示服务。重跑的两端浏览器测试均通过。
- 本次实际写入仅限上述 User/Admin 学习页面与入口、`PLANS.md`、本执行记录和活动进度文档；来源工作树保持只读。未修改锁文件、`staff.test.ts`、Mini/API 产品代码或 `apps/admin-web/preview.mjs`；未提交、推送、部署、上传或发布。
- 按用户“允许重启”的授权，使用项目本机演示启动器刷新了主树运行实例。启动前小程序生成文件新鲜度护栏通过；旧本机进程退出后，新服务就绪于 API `127.0.0.1:4317`、User Web `127.0.0.1:13452`、Admin Web `127.0.0.1:13453`，小程序导入目录可用。实时浏览器 smoke 打开家长学习、教师学习和匿名安全汇总，三页无错误、失败请求、外网访问或横向溢出。重启清空的是易失合成演示状态。
