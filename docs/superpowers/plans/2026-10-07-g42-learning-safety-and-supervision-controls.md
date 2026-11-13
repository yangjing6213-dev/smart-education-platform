# TASK20 G4.2 学习安全与成人监督控制

**状态：** `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW_NATIVE_AND_MAIN_TREE_SYNC`

**负责人授权：** 用户此前已明确取消逐阶段授权、授权我全权负责完成项目开发；本轮又确认复核通过并进入下一步。本合同仅界定 G4.2 本地合成切片，不包含真实机构、真实未成年人资料、正式 AI 或发布动作。

**依据：** 项目方案 `student-care-platform-complete-plan-v2.0.pdf` 第 37–39、44 页；`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 的 G4.2；G4.1 合同及本地验证记录。

## 目标

在 G4.1 固定题库闭环上补齐可验证的成人监督和安全处理：用途明确且带版本的成人同意；只接受固定三年级数学题、固定选项和 5/10/15 分钟时限；越界或多余输入被拒绝并留下不含输入内容的拒绝记录；当前无正式 AI，页面明确只提供本机固定讲解；教师可在授权班级范围内接手进行中的练习；家长不能在教师接手后继续答题；管理端只看拒绝、教师接手和固定题库模式的匿名合计数。

教师接手复用现有关闭接口，使用固定字段 `{ handoff: true }`；服务端重新检查教师身份、校区、班级及进行中状态，不增加新路由。普通家长结束仍使用空请求体并作为撤回本次同意处理。

## 不做事项

- 不接正式 AI、外部服务、API 云端、数据库、持久化或网络模型；不把固定提示描述成 AI 输出。
- 不开放自由输入、上传、拍照或儿童独立账号；不记录被拒绝请求的正文、选项文本、个人资料或原始输入。
- 不新增业务路由，不改变既有角色权限边界；教师接手只允许自身已授权的班级范围。
- 不安装依赖、不修改 lockfile、不修改 `staff.test.ts`；不整合主树业务代码，不 commit、push、部署或发布。

## 精确写集

### 共享 API / 合同

- MODIFY `packages/contracts/src/learning-session.ts`
- MODIFY `apps/api/src/local-synthetic/learning-session.service.ts`
- MODIFY `apps/api/test/local-synthetic-learning-session.test.ts`
- MODIFY `tests/local-synthetic/learning-session.test.mjs`
- GENERATED `apps/api/.g4-dist/apps/api/src/local-synthetic/learning-session.service.js`（只允许本轮编译器确认变化时写入）

### 微信小程序

- MODIFY `apps/mini-program/src/pages/parent/learning.ts`
- MODIFY `apps/mini-program/src/pages/parent/learning.test.ts`
- MODIFY `apps/mini-program/src/local-synthetic/learning-client.ts`
- MODIFY `apps/mini-program/pages/parent/learning/index.ts`
- MODIFY `apps/mini-program/pages/parent/learning/index.wxml`
- GENERATED `apps/mini-program/src/pages/parent/learning.js`（仅编译生成且变化时）
- GENERATED `apps/mini-program/src/local-synthetic/learning-client.js`（仅编译生成且变化时）
- GENERATED `apps/mini-program/pages/parent/learning/index.js`（仅编译生成且变化时）

### 用户网页

- MODIFY `apps/user-web/src/local-synthetic/learning.ts`
- MODIFY `apps/user-web/src/pages/parent-learning.ts`
- MODIFY `apps/user-web/src/pages/parent-learning.test.ts`
- MODIFY `apps/user-web/src/main.ts`
- MODIFY `apps/user-web/test/learning-session-browser.mjs`

### 管理网页

- MODIFY `apps/admin-web/src/local-review/learning-safety.ts`
- MODIFY `apps/admin-web/test/learning-safety.test.mjs`
- MODIFY `apps/admin-web/test/learning-safety-browser.mjs`

### 控制面

- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY 本合同，仅记录实际验证结果与当前状态

各源文件只在其所属隔离 worktree 修改：`task20-local-shared-core`、`task20-mini-brand-redesign`、`task20-web-completion`、`task20-admin-completion`。既有的其他 G2/G3 现场均视为基线，禁止清理或覆盖。

## 验收与验证

1. API 拒绝不支持题目、额外自由文本字段、无效同意版本和越权教师接手；拒绝审计只保存动作、结果、操作者与范围标识，不保存请求正文。
2. 新同意记录版本和时间；家长结束后旧会话不可继续作答；时限仍限于 5/10/15 分钟。
3. 教师可接手自身授权班级的进行中会话并产生 `HANDED_OFF` 状态和审计事件；其他班级/校区教师不能接手；家长接手后不能继续答题。
4. Mini/Web 教师摘要显示接手状态并提供仅对进行中会话可用的按钮；家长端明确显示固定题库/成人陪伴，无自由输入；管理端新增安全汇总只显示匿名数字。
5. 运行 API 聚焦测试及隔离源码类型检查；Mini 状态测试、typecheck、运行时新鲜度和页面注册检查；Web/Admin 聚焦测试与真实本机预览浏览器流程；精确路径 ESLint、Prettier、`git diff --check` 与范围审计。
6. 浏览器验证确认无页面错误、失败响应和外网请求。微信开发者工具人工点击若无自动化控制器则保持 `NOT_RUN`，不得伪称已验收。

## 停止条件

如果必须修改本合同写集外路径、引入新依赖/锁文件、扩展到真实 AI/真实数据/外部服务，或当前隔离基线不能保留，则停止该切片并记录原因；不得借修复越界扩大业务范围。

## 实施记录

- G4.1 已完成隔离工作树本地验证；微信开发者工具人工点击 `NOT_RUN`，主工作树业务整合 `NOT_EXECUTED`。
- G4.2 本地合成实现和自动验证通过；负责人复核尚未记录。微信开发者工具人工点击 `NOT_RUN`，主工作树业务整合 `NOT_EXECUTED`。

## 验证结果（2026-10-07）

- 共享 API：本机 TypeScript 编译器检查通过；检查时将四个 workspace 包路径映射到本隔离树源码，并将 `zod` 类型路径指向已安装包目录，没有改写配置。固定题目、版本化同意、拒绝请求、教师接手、跨班拒绝、接手后不可答题和匿名计数的 loopback HTTP 测试 1/1 通过。
- Mini：typecheck 通过；学习状态测试 6/6；运行时护栏 `MINI_RUNTIME_PASS pages=10 outputs=33 updated=0`；WXML 静态检查确认没有自由文本输入控件；ESLint、Prettier 和 `git diff --check` 通过。
- 用户网页：typecheck/build 通过；学习页测试 4/4；真实本机预览浏览器流程通过，覆盖教师接手并复核家长停止答题；浏览器断言无页面错误、失败响应或外网请求；ESLint、Prettier 和 `git diff --check` 通过。
- 管理网页：typecheck/build 通过；匿名安全汇总测试 2/2；真实本机预览浏览器流程通过；页面仅显示合计数字，浏览器断言无页面错误、失败响应或外网请求；ESLint、Prettier 和 `git diff --check` 通过。
- 四个工作树的 G4.2 目标源码及测试都在本合同写集内；已有其他阶段现场未清理或覆盖。未修改 `staff.test.ts`、依赖或 lockfile，未安装依赖、整合业务代码、提交、推送、部署或发布。
- 微信开发者工具人工点击：`NOT_RUN`；主工作树业务同步：`NOT_EXECUTED`；负责人复核：`PENDING`。
