# TASK20 G4.4B：受监督学习过程匿名评估

**状态：** `PASS_LOCAL_SYNTHETIC_SELECTIVE_MAIN_TREE_SYNC;OWNER_REVIEW_PENDING`

**执行依据：** 用户已授权自主继续本地项目开发；沿用 `PLANS.md` 和 `docs/exec-plans/active/project-completion.md` 的唯一长期计划。本切片只补充现有 G4.1–G4.4A 固定题库学习流程的匿名过程指标，不代表正式学习效果验证。

**权威项目方案：** `C:\Users\HU\Desktop\同芯机构项目\开发方案\student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；相关要求见第 37–39、44 页。

## 目标与边界

- 在现有平台匿名学习安全汇总中加入固定练习过程计数：首次作答正确的会话数、使用提示后完成主题的会话数、主问题作答总次数、巩固题作答数和答对数。
- 只从现有本机内存会话计算合计；不增加事件采集、不新增持久化、不返回学生、家长、教师、校区、班级、会话或资源标识。
- 管理页说明这些数字是合成练习过程计数，不是独立学生人数，也不能证明学习提升、因果效果、答案准确率或教师减负。
- 本切片不评估正式 AI；正式试点仍需经负责人确认范围，以代表性题集和人工复核持续评估安全、学习行为和教师价值。

## 精确写集

API 隔离工作树 `C:\Users\HU\.codex\worktrees\task20-local-shared-core`：

- `packages/contracts/src/learning-session.ts`
- `apps/api/src/local-synthetic/learning-session.service.ts`
- `apps/api/test/local-synthetic-learning-session.test.ts`

管理网页隔离工作树 `C:\Users\HU\.codex\worktrees\task20-admin-completion`：

- `apps/admin-web/src/local-review/learning-safety.ts`
- `apps/admin-web/test/learning-safety.test.mjs`

选择性同步与治理记录：

- 主工作树仅选择性同步以上 5 个代码文件；逐文件保留既有主树保护和差异，不整文件覆盖其他现场。
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 本合同文件

## 禁止范围

- 不修改 Mini、家长或教师学习页面、API 路由/身份/权限、管理页面入口/预览代理、`staff.test.ts`、`app.json`、项目配置或其他路径。
- 不接入真实儿童或机构数据、正式 AI、网络、外部服务、数据库或持久化；不增加自由文本或个人反馈字段。
- 不安装依赖、不修改 lockfile，不提交、推送、部署或发布。
- 如精确写集不足、隔离基线不符或发现必须越界，停止并记录原因，不扩大范围。

## 验收和验证

1. API 先用测试证明汇总指标来自现有固定学习会话，首次答对与提示后答对互斥正确，巩固题只统计已作答项目；结果没有任何个人或班级标识。
2. API 与管理页聚焦测试覆盖合法数值、缺字段/负数拒绝，以及匿名指标解释文案。
3. 运行受影响的 API/管理端 typecheck、聚焦测试、ESLint、Prettier、主工作树本地浏览器复核、`git diff --check` 和精确范围审计。
4. 只在 API 与管理端隔离验证通过后，逐文件将本合同代码路径选择性同步主工作树，再在主树复验。
5. 微信开发者工具人工点击不在本切片范围；不得将本地过程指标宣称为效果证明或 Owner Review。

## 实施记录（2026-10-10）

- 开始前核对主树与 API/管理端隔离工作树中的 5 个代码文件，全部逐字节一致；仅修改本合同的 5 个代码路径并选择性同步，未触碰路由、身份许可、Mini、User Web、配置或其他差异现场。
- API：先新增失败断言，再实现首次作答/提示后作答及巩固题合计；API 聚焦测试 6/6、typecheck、ESLint、Prettier 通过。主工作树 API 来源编译后的聚焦测试 6/6 通过；共享合同 typecheck 通过。
- 管理网页：匿名汇总校验、指标文案与“不能证明学习提升/教师减负”的限制说明测试 2/2；typecheck、编译、ESLint、Prettier 通过。实际本机浏览器检查通过：零页面错误、失败响应、外网请求和横向溢出。
- `git diff --check`、5 代码路径的逐字节同步和范围审计通过；没有修改 lockfile、依赖、真实数据或外部服务。一次在 contracts 目录通过 pnpm 启动的检查因工作区链接 `EEXIST` 自动整理失败；未完成依赖安装、未改 lockfile，随后用已安装的 TypeScript 编译器完成 typecheck。
- 验证产物只写入既有忽略的构建目录和 `node_modules/.cache`。Owner Review 尚未进行；本地聚合计数不代表学习效果证据。
