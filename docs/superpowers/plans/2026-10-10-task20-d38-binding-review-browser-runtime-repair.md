# TASK20 D38：绑定审核浏览器流程运行时修复

## 目标

恢复 Admin 本机浏览器测试中的家长绑定申请—校区负责人审核—家长刷新闭环验证。只修复测试服务器未提供网页编译产物模块目录的问题，不改变产品页面、API 或业务状态。

## 依据与诊断

- D37 合同：`docs/superpowers/plans/2026-10-10-task20-d37-m61-cross-client-scope-matrix-audit.md`，SHA-256 `7E3962818C738F1228B9CC48B40BA90197FA3C1853BE28C9EB57C309E3C028FA`。
- 可复现失败：`apps/admin-web/test/binding-review-browser.mjs` 在家长页等待“查看与管理授权”标题超时。
- 根因已确认：浏览器测试的本机静态服务器只允许 `/main.js`、`/routes/`、`/styles/`、`/assets/`、`/pages/`，未提供 `/local-synthetic/`；当前 `apps/user-web/dist/main.js` 静态导入多个 `./local-synthetic/*.js` 模块，因此浏览器模块加载中断，页面入口未执行。产品源文件中存在该标题，故不是过时标题断言。
- 最小假设：在现有静态路径白名单中加入精确 `/local-synthetic/` 前缀，且保留现有 `userDistRoot` 路径包含校验后，页面模块可加载并继续执行原端到端流程。

## 精确写集

- `apps/admin-web/test/binding-review-browser.mjs`：仅向现有 User Web 静态资源路径白名单加入 `/local-synthetic/`。
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 本合同文件。

不修改 User Web、Admin 产品源代码、API、配置、依赖或 lockfile；不触碰 `apps/mini-program/src/pages/staff.test.ts`。

## TDD 与验证

1. 先运行现有浏览器流程，确认页面标题等待失败且静态编译产物确有 `/local-synthetic/` 导入；该失败是红灯证据。
2. 只在测试静态服务器路径列表增加 `/local-synthetic/`。
3. 重跑完整 `binding-review-browser.mjs`，必须覆盖家长提交、同校区批准/拒绝、另一校区列表为空、跨校区审核 403、家长刷新；同时要求浏览器错误和外网请求均为零。
4. 重跑 Admin 绑定审核聚焦测试；对改动文件执行 ESLint、Prettier 检查、`git diff --check` 和精确写集审计。

## 边界

- 仅使用隔离的本机内存合成服务，不连接外部网络或真实机构。
- 不提交、推送、部署、上传或发布，不安装依赖、不改 lockfile。
- 若最小测试夹具修复后仍暴露产品页面或 API 缺陷，不在此合同扩大业务改动；另行创建精确修复任务并继续本机工作。

## 当前状态

- `TASK20_D38_STATUS=PASS_LOCAL_SYNTHETIC_BROWSER_FLOW_AND_TEST_HARNESS_REPAIR`
- `TASK20_ACTIVE_TARGET=TASK20_D39_M61_REMAINING_PRODUCTION_BOUNDARIES_AND_MINI_NATIVE_GATE`

## 执行结果（2026-10-10）

- 仅在 User Web 静态资源路由列表加入 `/local-synthetic/`；既有文件路径包含校验和全部审核断言保持不变。
- 完整绑定审核浏览器流程通过：家长提交后可见待审；东校区负责人通过学生甲并拒绝学生乙；西校区待审列表为空；直接越校区审核返回 403；家长刷新后看到通过状态。浏览器错误 `0`、外网请求 `0`，共改写本机 API 请求 15 次。
- Admin 绑定审核聚焦测试 `8/8`；目标文件 ESLint 与 Prettier API 检查通过。
- 未改产品页面/API、配置、依赖或 lockfile；未触碰受保护 `staff.test.ts`。微信开发者工具原生复核仍 `NOT_RUN`。
- `TASK20_D38_STATUS=PASS_LOCAL_SYNTHETIC_BROWSER_FLOW_AND_TEST_HARNESS_REPAIR`；生产认证/数据隔离、对象存储、后台作业与原生验收仍未通过或未验证。
