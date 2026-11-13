# TASK20 G4.4C：合成学习资料来源复核

**状态：** `PLANNED_LOCAL_SYNTHETIC_ONLY`

**执行依据：** 用户已授权自主继续本地项目开发；本任务沿用 `PLANS.md`、项目完成计划和 G4.4 路线图。只为现有合成学习资料补充明确的来源复核门，不代表正式 AI、教材授权或真实机构治理。

**权威项目方案：** `C:\Users\HU\Desktop\同芯机构项目\开发方案\student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；第 38 页要求模型不可用时退回受控知识资料，第 39 页要求机构维护资源白名单，第 44 页的供应商准入与数据处理核验仍属于正式 AI 启用前的独立门禁。

## 目标与行为

- 复用现有资源管理页和版本更新接口，为明确标记为学习资料的资源记录合成资料集版本、复核状态和复核时间。
- 机构负责人只能在可信租户/校区/班级范围内，对 `PENDING_REVIEW` 资料作出固定选择：通过或退回。操作递增资源版本并写入现有本机审计记录。
- 家长/教师学习资料接口只返回已发布、未过期、受众和班级匹配且 `APPROVED` 的资料。没有来源治理记录或仍待复核/已退回的资料不得进入学习资料白名单。
- 不在学习资料响应中返回来源审核人或机构/校区/班级/学生标识。管理页可读取必要的复核状态和日期。
- 仅本机合成资料；不上传、链接或复制真实教材、网页、教师材料，不宣称获得真实版权或供应商审核。

## 精确写集

API 隔离工作树 `C:\Users\HU\.codex\worktrees\task20-local-shared-core`：

- `packages/contracts/src/resource-library.ts`
- `apps/api/src/local-synthetic/repository.ts`
- `apps/api/src/local-synthetic/resource-library.service.ts`
- `apps/api/src/local-synthetic/learning-session.service.ts`
- `apps/api/src/local-synthetic/routes.ts`
- `apps/api/test/local-synthetic-resource-library.test.ts`
- `apps/api/test/local-synthetic-learning-session.test.ts`

管理网页隔离工作树 `C:\Users\HU\.codex\worktrees\task20-admin-completion`：

- `apps/admin-web/src/local-review/resource-library.ts`
- `apps/admin-web/src/main.ts`（仅在现有资源管理流程中接入来源复核按钮事件）
- `apps/admin-web/test/learning-source-governance.test.mjs`（新增）
- `apps/admin-web/test/learning-source-governance-browser.mjs`（新增）

主工作树逐文件选择性同步上述代码路径，不整文件覆盖任何与来源不同的现有文件；本轮基线已发现 API `routes.ts`、Admin `main.ts`、Admin 资源模块与资源测试和主树存在既有差异，必须只移植本任务的最小新增代码块。治理记录只允许修改 `PLANS.md`、`docs/exec-plans/active/project-completion.md`、`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 及本合同。

## 禁止范围

- 不新增页面、路由或代理权限；复用现有资源 PATCH 请求和管理入口。
- 不修改 Mini、User Web、`staff.test.ts`、`app.json`、项目配置、依赖或 lockfile。
- 不接入真实身份、教材、儿童资料、外网、模型、数据库、持久化或伙伴云。
- 不提交、推送、部署或发布。
- 若实现需要白名单外路径、破坏现有路由/预览保护，或改变资源管理以外的业务语义，停止并记录原因。

## 验收与验证

1. 先新增失败用例：待复核与退回资料不能出现在家长学习检索结果；负责人通过复核后可以检索；越范围、教师审核、重复操作、错误版本和非法字段均拒绝。
2. 管理端页面测试覆盖来源集版本、复核状态、固定按钮与日期显示；实际本机浏览器流程覆盖负责人通过复核、学习检索随之可见、无越权/外网/页面错误/横向溢出。
3. API/合同/管理端 typecheck、聚焦测试、ESLint、Prettier、`git diff --check`、准确路径与来源差异审计通过后才同步主树；同步后在主树复验。
4. 本地复核只证明合成状态流转；不代表负责人 Owner Review、素材授权审核或正式运营通过。

## 2026-10-10 实施记录

- 状态：PASS_LOCAL_SYNTHETIC_SELECTIVELY_SYNCED；Owner Review 仍待负责人审阅。
- API：为合成学习资料增加固定资料集版本与复核状态；负责人在可信范围内选择通过或退回，版本递增并写入本机审计；学习检索要求资料已发布、未过期、范围匹配且来源复核通过。
- 管理网页：在现有资源管理页显示待复核状态、复核日期和固定通过/退回按钮；使用现有 PATCH 接口，不新增页面或代理权限；复核人和学生身份不进入学习响应。
- 同步审计：6 个 API/合同/测试文件在修改前与主树逐字节一致后才整文件选择性同步；API routes、Admin 资源模块与 Admin main.ts 因基线不同，只移植本任务的最小代码块；新增两个管理页测试文件。未触及 Mini、User Web、配置、依赖、lockfile 或合同外业务文件。
- 验证：API 11/11、Admin 渲染 3/3；API/合同/Admin 类型检查和构建通过；ESLint、API 与 Admin 实现/测试文件 Prettier 检查、git diff --check、范围/空白/lockfile 审计通过。主树 Admin main.ts 全文件 Prettier 仍会报告原有无关格式差异；未为此重排其它功能代码，新增事件处理器符合 Prettier 输出。
- 主树 API 默认 TypeScript 检查先遇到现有 workspace 链接差异：apps/api/node_modules/@student-care/contracts 指向 API 隔离工作树，该工作树 contracts index 未导出 main-tree consent.service 所需的类型。未更改该链接或项目配置；使用临时 TypeScript 配置把类型解析指向主树已构建的 contracts 声明后，主树 API 检查与构建通过。
- 主树真实本地浏览器流程：待复核资料审核前不出现在教师学习检索；负责人通过后显示为可检索资料；学习响应不含来源复核对象；无外网请求、页面错误、失败请求或横向溢出。仅属本机合成演示，不证明真实素材授权、试点效果或正式 AI 运营条件。
