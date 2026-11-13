# TASK20 G4.4A：已审核学习资料检索

**状态：** `PASS_LOCAL_SYNTHETIC_SELECTIVE_MAIN_TREE_SYNC;OWNER_REVIEW_PENDING;MANUAL_MINI_DEVTOOLS_NOT_RUN`

**执行依据：** 用户已授权自主继续项目本地开发；沿用 `PLANS.md` 与 `docs/exec-plans/active/project-completion.md` 的唯一长期计划。本切片在现有 G4.1–G4.3 监督式学习页面上补齐 G4.4 的本机合成资料检索，不替代负责人验收。

**权威项目方案：** `student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；实施基线为 `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 的 G4.4。

## 目标

复用现有本机内存资源库，让已审核绑定的家长和有班级权限的教师，在现有陪伴式学习页看到与当前固定年级、学科和知识点相符的已发布资料。资料必须带来源、版本和有效期；撤回、过期、校区/班级不符或未授权给该角色的资料不能显示。用户不需另开页面或输入儿童信息。

这只是 G4.4A 的检索演示。固定资料由合成教研来源预先审核并发布；资源的版本、撤回和有效期复用现有资源生命周期。使用效果统计和更完整的知识来源管理仍是未完成项，不据此宣称 G4.4 全部完成。

## 范围与禁止项

- 只展示固定合成数学资料，不开放自由文本、文件上传或学生独立账号。
- 家长端必须存在当前机构/校区/班级内已审核通过的学生关系；教师端仅限可信成员关系中的负责班级。范围由服务端会话推导，不接受客户端提供租户、校区或班级范围。
- 只读取 `PUBLISHED`、未过期、知识点匹配且明确允许 `PARENT` 或 `TEACHER` 的资料；返回最小资料字段，不返回学生标识、内部审核人标识或范围标识。
- 不新增页面或路由页面；只增加一个本机只读接口，并在现有 Web/Mini 陪伴式学习页展示资料卡片。
- 不接入正式 AI、向量检索、外网搜索、真实服务、数据库或持久化；不安装依赖、修改 lockfile，不修改 `staff.test.ts`、`app.json` 或项目配置；不提交、推送、部署或发布。
- 若实现需要本清单外路径、真实资料/服务、依赖变更或改动受保护文件，停止并先修订任务合同；不得覆盖其他工作树现场。

## 精确写集

### 开工前基线核对

三个隔离工作树与主树均基于 `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。对本合同已有的 20 个实现/生成文件逐项比较，16 个与主树字节一致；以下 4 个在本任务开始前已存在差异，且均未被本任务修改：

- API `routes.ts`：隔离树缺少主树已有的同意管理路由及成员版本校验。
- API `local-synthetic-learning-session.test.ts`：一项既有会话数量断言分别为 1 和 2。
- Web `preview.mjs`：隔离树缺少主树现有的路径规范化保护，并与访客内容路由不同。
- Web `learning-session-browser.mjs`：隔离树少了主树已有的横向溢出和本机请求隔离断言。

这些差异不阻止本任务继续，但禁止整文件复制：隔离树只用于实现和测试；主树整合时仅移植本任务新增的精确代码块，保留主树上述既有保护和断言。新增 Mini 客户端测试文件在开工时两边均不存在。

### API 隔离工作树 `C:\Users\HU\.codex\worktrees\task20-local-shared-core`

- `apps/api/src/local-synthetic/repository.ts`
- `apps/api/src/local-synthetic/resource-library.service.ts`
- `apps/api/src/local-synthetic/learning-session.service.ts`
- `apps/api/src/local-synthetic/routes.ts`
- `apps/api/test/local-synthetic-learning-session.test.ts`

### Web 隔离工作树 `C:\Users\HU\.codex\worktrees\task20-web-completion`

- `apps/user-web/preview.mjs`
- `apps/user-web/src/local-synthetic/learning.ts`
- `apps/user-web/src/pages/parent-learning.ts`
- `apps/user-web/src/pages/parent-learning.test.ts`
- `apps/user-web/test/learning-session-browser.mjs`

### Mini 隔离工作树 `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`

- `apps/mini-program/src/local-synthetic/client.ts`
- `apps/mini-program/src/local-synthetic/learning-client.ts`
- `apps/mini-program/src/local-synthetic/learning-client.test.ts`
- `apps/mini-program/src/pages/parent/learning.ts`
- `apps/mini-program/src/pages/parent/learning.test.ts`
- `apps/mini-program/pages/parent/learning/index.ts`
- `apps/mini-program/pages/parent/learning/index.wxml`
- `apps/mini-program/src/local-synthetic/client.js`（仅编译且内容变化时）
- `apps/mini-program/src/local-synthetic/learning-client.js`（仅编译且内容变化时）
- `apps/mini-program/src/pages/parent/learning.js`（仅编译且内容变化时）
- `apps/mini-program/pages/parent/learning/index.js`（仅编译且内容变化时）

### 主工作树选择性整合与记录

仅在三个隔离实现均通过各自验证、逐文件基线核对后，才选择性整合上列业务路径；主树可能变化的文件必须先比较，不得整文件覆盖不一致现场。治理记录仅限：

- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 本合同文件

## 验收与验证

1. API 聚焦测试覆盖家长无审核关系被拒绝、有效关系可读、教师仅读负责班级、跨校区/班级资料不可见、未发布/撤回/过期资料不可见、来源/版本/有效期字段可读及响应不含学生/范围标识。
2. Web 聚焦页面测试和实际本机浏览器流程确认资料卡片出现在现有学习页、来源信息清楚、无外部请求/页面错误/横向溢出；预览代理只允许该精确只读路径。
3. Mini 客户端/页面测试覆盖相同资料与状态；运行 Mini typecheck、定向测试、页面注册完整性护栏、编译和生成 JS 一致性检查。实际微信开发者工具操作仅在可用时记录；自动测试不冒充人工点击。
4. 按受影响范围运行 typecheck、ESLint、Prettier、`git diff --check` 和精确路径审计；不得为格式通过而重排写集外文件。
5. 只记录实际执行的命令和结果；`G4.4A` 本地验证不代表负责人验收或正式运营能力。

## 实施记录（2026-10-09）

- API：聚焦测试 5/5；隔离工作树 typecheck、ESLint、Prettier 通过。主工作树 API 使用临时 TypeScript 路径映射指向主树现有 workspace 源码后，typecheck 与聚焦测试 5/5 通过；主 API 构建产物参与 Web 浏览器流程并通过。默认共享 workspace 链接当时解析到隔离 API 工作树的合约源码，故直接主树 typecheck 的首次结果不作为代码失败依据；没有修改包源码、项目配置或 lockfile。
- Web：页面测试 5/5；家长和教师本机浏览器流程通过，断言没有外部请求、页面错误或横向溢出；typecheck、ESLint、Prettier 通过。主预览器继续保留原路径规范化与真实路径边界检查；代理仅新增精确只读 GET。
- Mini：定向测试 11/11；`mini-runtime.mjs --mini-root apps/mini-program` 通过，`pages=11 outputs=34 updated=0`，确认页面注册、编译与生成 JS 一致；ESLint 和源码/WXML Prettier 通过。
- 主树已选择性同步合同中 21 个产品代码路径，保留四项预先存在的差异与主树现有路由安全/浏览器断言。`git diff --check`、精确范围及尾随空白审计通过；未改 lockfile、受保护测试或配置。主树既有 `app.json` 与 `staff.test.ts` 改动保持原样。
- 未运行微信开发者工具人工点击；自动验证不替代原生人工复核。Owner Review 尚未进行，`G4.4A` 不代表整个 G4.4 已完成。

## 停止条件

源工作树关键基线与主树不一致且无法安全合并、需要白名单外文件、需扩大到自由文本/模型/存储/外部服务，或任何验证发现必须调整受保护配置时，停止该分支并记录具体影响。G2.5 微信开发者工具人工通知流程继续保持未闭合，不通过本任务宣称完成。
