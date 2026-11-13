# TASK20 G4.1 监督式固定题库学习流程合同

**状态：** `PASS_LOCAL_SYNTHETIC_PENDING_NATIVE_AND_MAIN_TREE_SYNC`

**负责人指示：** 负责人已确认 G3.6 Owner Review 通过并要求进入下一步；此前已授权我自主推进项目剩余开发。普通本地合成实现与验证不再逐项请求授权。本合同只界定当前 G4.1 实施切片，不扩大到正式 AI、真实服务或发布。

**权威依据：**

- 项目方案：`student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`，第 37–39、44 页。
- 实施路线：`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`，G4.1–G4.4。
- 当前控制面：`PLANS.md` 与 `docs/exec-plans/active/project-completion.md`。

**2026-10-07 复核及收尾记录：**负责人已明确确认复核通过并允许进入下一步。独立代码复核随后发现 G4.1 的实现尚有四个可验证缺口：每层提示没有强制新的错误尝试；Mini 会把一次同意沿用到下一次练习；教师虽有服务端开题/摘要权限，却没有 Mini/Web 的实际入口和摘要页面；共享服务运行测试引用了本合同未列明的编译目录。随后网页浏览器复核又发现教师权限动作未加入网页共享客户端白名单，导致员工工作台入口无法显示。现将该既有网页客户端文件纳入写集并补验。为不把状态误报成完整，本轮先收敛这些缺口，再进入 G4.2。

**收尾验收点：**每层提示后必须再作答一次且仍需错误才可进入下一层；每次新 Mini 会话重新取得成人同意；教师从员工工作台进入班级范围学习页、可开启练习并查看仅限负责班级的摘要；本机编译产物逐路径列明且不纳入主树同步。对照隔离工作树检查时，`apps/api/.g4-dist/` 已有 356 个未跟踪生成文件，生成时间/归属无法由 Git 确认，故视为既存现场保护；收尾只允许更新下列两个确切输出，其余不触碰。

## 目标和流程

用固定、合成的小学数学题完成一条可操作的监督式学习闭环：家长或教师在授权关系/班级范围内同意并开启限时学习空间；学生在同一受监督页面先选择作答，再依次解锁第 0、1、2、3 层提示，最后完成 1–3 道固定巩固题；教师可查看负责范围内的学习摘要；管理端只查看不含个人或学生明细的安全汇总。家长网页能查看和关闭/删除自己的会话，小程序提供最短练习入口。

页面明确标注本地合成演示、无正式 AI、无独立学生账号。首批只显示预置题目和选项，不开放自由输入、拍照或文件上传；点击完成的作答始终由当前受监督成人会话授权，不创建学生登录。服务数据只在本地进程内存中，服务重启即清空。

## 范围边界

- 实施 G4.1：固定题库、`LearningSession`、家长/教师开启、先尝试与递进提示、巩固题、教师摘要、家长网页历史/控制、管理端匿名安全汇总。
- 同时实现最小用途同意、固定时限、退出和删除，避免学习会话无控制地持续；G4.2 后续仍需补齐安全事件处理、拒答/转人工策略审计、输入防护验证及更完整的教师接管记录。
- 固定样例不得宣称模型理解、AI 生成或真实学习成效；无正式模型调用或外部请求。
- 不实现真实账号、学生独立登录、真实儿童资料、云端/API 对接、数据库、伙伴云、持久化、文件/相机、正式 AI 或模型供应商接入。
- 不安装依赖、不修改 lockfile，不修改 `staff.test.ts`，不提交、推送、部署或发布；不整合业务代码到主工作树。

## 实现设计与验收条件

1. 共享本机服务以固定题库和授权会话产生学习会话。创建请求只接受题目、授权学生和时限的白名单字段；服务器按家长已审核关系或员工班级范围验证学生，不信任客户端的租户/校区/班级。会话只能由其创建者关闭/删除，教师摘要仅返回授权班级，平台摘要只返回聚合计数。
2. 每题先有一次作答才可请求第 0 层；后续提示必须按顺序解锁并各自经过一次重做。第 3 层需多次尝试且第 2 层已查看。完成首题后提供两道固定同类巩固题；答错可结束并标记“需教师跟进”，不作能力或纪律判断。
3. 每个会话有显式用途同意和固定时长，过期/关闭后旧会话不可作答或请求提示。删除后成人列表、教师摘要和匿名汇总按实现定义即时更新；审计只保留不含自由文本和学生具体内容的动作记录。
4. Mini 页面可从家长首页进入；网页家长页展示自己的历史、开启状态和关闭/删除动作；管理网页为平台示例角色显示匿名安全汇总。页面入口、错误/空状态和返回路径均可操作。
5. focused tests 覆盖关系/班级/租户拒绝、同意和时限、先答后提示、跳级拒绝、巩固题数量、关闭/过期/删除、教师摘要隔离及平台无明细。实际预览浏览器流程无页面错误、失败响应或外网请求。Mini 运行时注册和生成文件护栏通过；未获得原生自动化控制器时，微信开发者工具点击状态必须记 `NOT_RUN`。

## 隔离工作树与精确写集

继续使用已存在的隔离工作树；其中 G2/G3 现场属于既有基线，本任务只添加/修改下列路径，不清理或重写此前修改：

### 共享本机服务：`C:/Users/HU/.codex/worktrees/task20-local-shared-core`

- MODIFY `packages/contracts/src/index.ts`
- CREATE `packages/contracts/src/learning-session.ts`
- MODIFY `apps/api/src/local-synthetic/sessions.ts`
- MODIFY `apps/api/src/local-synthetic/routes.ts`
- MODIFY `apps/api/src/local-synthetic/server.ts`
- CREATE `apps/api/src/local-synthetic/learning-session.service.ts`
- CREATE `apps/api/test/local-synthetic-learning-session.test.ts`
- CREATE `tests/local-synthetic/learning-session.test.mjs`
- GENERATED `apps/api/.g4-dist/apps/api/src/local-synthetic/learning-session.service.js`（只为本地运行授权测试）
- GENERATED `apps/api/.g4-dist/apps/api/src/local-synthetic/sessions.js`（只为本地运行授权测试）

### 微信小程序：`C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign`

- MODIFY `apps/mini-program/app.json`
- MODIFY `apps/mini-program/pages/parent/home/index.wxml`
- MODIFY `apps/mini-program/pages/staff/workbench/index.wxml`（新增教师学习入口）
- MODIFY `apps/mini-program/pages/staff/workbench/index.ts`
- MODIFY `apps/mini-program/src/pages/staff/workbench.ts`
- MODIFY `apps/mini-program/src/local-synthetic/client.ts`（仅增加学习路径白名单）
- MODIFY `apps/mini-program/src/local-synthetic/client.js`（仅由本轮编译生成器同步上述白名单）
- CREATE `apps/mini-program/src/local-synthetic/learning-client.ts`
- CREATE `apps/mini-program/src/local-synthetic/learning-client.js`（仅编译生成）
- CREATE `apps/mini-program/src/pages/parent/learning.ts`
- CREATE `apps/mini-program/src/pages/parent/learning.js`（仅编译生成）
- CREATE `apps/mini-program/src/pages/parent/learning.test.ts`
- CREATE `apps/mini-program/pages/parent/learning/index.ts`
- CREATE `apps/mini-program/pages/parent/learning/index.js`（仅编译生成）
- CREATE `apps/mini-program/pages/parent/learning/index.wxml`
- CREATE `apps/mini-program/pages/parent/learning/index.wxss`
- CREATE `apps/mini-program/pages/parent/learning/index.json`
- GENERATED `apps/mini-program/pages/staff/workbench/index.js`（仅本轮生成且内容确有变化时）
- GENERATED `apps/mini-program/src/pages/staff/workbench.js`（仅本轮生成且内容确有变化时）

### 用户网页：`C:/Users/HU/.codex/worktrees/task20-web-completion`

- MODIFY `apps/user-web/src/main.ts`
- MODIFY `apps/user-web/src/local-synthetic/client.ts`（仅识别学习服务权限动作）
- MODIFY `apps/user-web/src/pages/parent-home.ts`
- MODIFY `apps/user-web/src/styles/user-web.css`
- MODIFY `apps/user-web/preview.mjs`
- CREATE `apps/user-web/src/local-synthetic/learning.ts`
- CREATE `apps/user-web/src/pages/parent-learning.ts`
- CREATE `apps/user-web/src/pages/parent-learning.test.ts`
- CREATE `apps/user-web/test/learning-session-browser.mjs`

### 管理网页：`C:/Users/HU/.codex/worktrees/task20-admin-completion`

- MODIFY `apps/admin-web/src/main.ts`
- MODIFY `apps/admin-web/preview.mjs`
- MODIFY `apps/admin-web/src/local-proxy.mjs`
- CREATE `apps/admin-web/src/local-review/learning-safety.ts`
- CREATE `apps/admin-web/test/learning-safety.test.mjs`
- CREATE `apps/admin-web/test/learning-safety-browser.mjs`

### 主工作树控制面：`C:/Users/HU/Documents/student-care-saas-platform`

- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY 本合同，记录实际进度与验证结果
- 不修改主工作树业务代码

若实现确需超出此清单，先将相关切片记为 `BLOCKED`，再由我结合当前全权开发授权更新合同写集；不得顺手扩写其他路径。

## 执行和验证

按 TDD 分段执行：先为共享服务生命周期/授权、Mini 流程、网页控制、管理匿名页分别写一个最小失败测试并确认失败，再写最少实现。运行 API 类型与单元/loopback 测试；Mini source tests、Mini typecheck、`node scripts/mini-runtime.mjs` 与 `node scripts/mini-runtime.mjs --write`、生成页测试和页面注册护栏；Web/Admin focused tests、typecheck、ESLint、Prettier、本地浏览器测试；最后逐树核对写集和 `git diff --check`。不为本批未变化路径重复运行完整仓库回归。

所有浏览器请求须由本机预览代理转发到 loopback 服务；测试显式拒绝其他源站。Mini 运行时检查确认，更新白名单源码后既有 `client.js` 也会变更；已将其作为受限生成文件加入本合同。Mini 变更 JS 时只接受编译器报告变化且已列入合同的输出。API `.g4-dist` 中的 356 个现存未跟踪文件全部保留；只可更新上列两个 API 输出，禁止目录级重编译、清理或主树整合。

## 停止条件

- 需要任何真实儿童/机构数据、真实账号、自由输入/照片、外部服务、正式 AI、数据库或持久化时立即停止该需求并保留合成版本。
- 需要修改白名单外业务路径或新增依赖时停止并报告。
- 现有工作树基线发生变化、同一验证失败两轮仍无确定原因、范围隔离失败或出现外网请求时停止相关切片；不要覆盖既有工作。

## 当前阶段状态

- G3.6 Owner Review：`PASS`（负责人 2026-10-07 明确确认）；Mini 原生不适用；主工作树业务整合仍为 `NOT_EXECUTED`。
- G4.1 负责人复核：`PASS_USER_CONFIRMED_2026-10-07`；复核缺口已修复，本地合成验证：`PASS_LOCAL_SYNTHETIC_PENDING_NATIVE_AND_MAIN_TREE_SYNC`。
- G4.1 微信开发者工具人工点击：`NOT_RUN`；主工作树业务整合：`NOT_EXECUTED`。
- 正式 AI、真实数据、主树业务整合、commit/push/deploy/release：不在本合同范围内。
- 写集校正：Mini 编译护栏在源码检查通过后明确报告 4 条变化输出；仅将 `client.js` 增补为本轮授权生成物，其余路径仍保持原清单。

## 验证结果（2026-10-07）

- 共享服务：TypeScript 检查通过；隔离 worktree 的 `@student-care/contracts` 目录链接到主工作树旧版源码，因此检查通过时将模块路径精确指向本 worktree 的 `packages/contracts/src/index.ts`。学习服务单测 4/4，真实 loopback HTTP 测试 1/1。
- API：使用 TypeScript 编译器路径覆盖读取隔离合同源码，类型检查通过；聚焦 loopback 测试 1/1。隔离包管理器 `pnpm exec` 因本机 pnpm 11.19.0 低于仓库要求 11.22.0 而拒绝执行；未安装或更新依赖，改用工作树已有 ESLint/Prettier 程序直跑并通过。
- Mini：typecheck 通过；学习状态测试 6/6；运行时检查输出 `MINI_RUNTIME_PASS pages=10 outputs=33 updated=0`。页面注册按本任务既有静态检查通过；本轮没有生成 JS。
- User Web：typecheck/build 通过；页面测试 3/3；真实本机预览浏览器覆盖家长固定流程与教师工作台入口、班级摘要及学习启动，退出码 0；未发现页面错误、失败响应或外网请求。
- Admin Web：typecheck 通过；匿名汇总渲染测试 2/2；本机预览浏览器退出码 0，仅显示匿名汇总。
- 四个 worktree 的合同范围 ESLint、Prettier 和 `git diff --check` 通过；WXML 由页面模板/注册检查验证（Prettier 本身不识别 WXML）。现存无关差异与未跟踪文件保持原样。未改 `staff.test.ts`，未安装依赖、修改 lockfile、主工作树业务代码，也未执行提交、推送、部署或发布。
- G4.1 Owner Review：`PASS_USER_CONFIRMED_2026-10-07`；复核缺口修复：`PASS_LOCAL_SYNTHETIC`；微信开发者工具人工点击：`NOT_RUN`；主工作树业务同步：`NOT_EXECUTED`。
