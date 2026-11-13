# TASK20 G4.3 学习安全回归护栏（2026-10-07）

**状态：** `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`

**依据：** 项目方案 `student-care-platform-complete-plan-v2.0.pdf` 第 37–39、44 页；`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 的 G4.3；G4.2 合同 `docs/superpowers/plans/2026-10-07-g42-learning-safety-and-supervision-controls.md`（SHA-256 `E037DF0DD26BC86D2BBBA852E16C629D95662586F920208D9617CF1D0572AED8`）。

## 目标

把 G4 的安全边界变成持续可复查的回归检查：越级提示、结束后继续操作、额外/敏感输入、家长和教师越权查看、教师跨班接手，以及管理端个人明细泄露都必须被测试拦住。G4.2 已覆盖大部分行为，本切片只补强“拒绝审计不包含请求正文”的直接断言，并复跑已有跨端安全验证。

## 范围与写集

只允许修改以下代码文件：

- `tests/local-synthetic/learning-session.test.mjs`：新增错误同意版本与被拒绝自由文本不进入审计记录的明确断言；保留已有提示顺序、退出、删除、跨范围和匿名摘要断言。

治理记录只允许：

- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- 本合同，仅记录验证结果与状态

测试代码仍在 `task20-local-shared-core` 隔离工作树内修改；不触碰其它隔离树源文件。若新断言揭示产品实现缺陷，先更新本合同的最小写集再修复，不扩展真实服务或数据。

## 验收标准

1. 拒绝未知题目、错误同意版本和自由文本字段；在机构负责人可见的审计记录中只有必要元数据，绝不包含提交的自由文本内容。
2. 必须按“先答错、再看当前层提示、再答题”顺序推进；正常结束、超时或教师接手后，旧会话不能继续答题或取提示。
3. 家长不能读取未授权学生会话；教师摘要和接手动作仅能覆盖本校区、本班级；跨班身份应收到拒绝或空结果。
4. 平台管理页面只呈现匿名数字，不呈现学生、班级、会话明细或审计原文。
5. API/Mini/Web/Admin 的 G4.2 现有聚焦测试和本机浏览器验证继续通过；不新增依赖，不修改 `staff.test.ts`。

## 验证

- API 隔离源码类型检查（仅通过 TypeScript 编译器内存路径映射解决 workspace junction 指向旧主树源码的问题，不改配置）。
- `node --test tests/local-synthetic/learning-session.test.mjs`
- Mini `tsc --noEmit`、学习状态测试与运行时新鲜度检查。
- Web/Admin typecheck、学习页面聚焦测试及其本机预览浏览器测试。
- 目标路径 ESLint、Prettier、`git diff --check` 与写集审计。

## 不做事项

- 不改 API 或任何产品实现；不接真实 AI、真实儿童/机构数据、外部服务、数据库、持久化或真实认证。
- 不安装依赖、不改 lockfile、不修改 `staff.test.ts`、不整合主树业务代码。
- 不提交、推送、部署或发布；不清理或覆盖既有工作树现场。

## 验证结果（2026-10-07）

- API loopback 回归 `node --test tests/local-synthetic/learning-session.test.mjs`：1/1 通过。新增错误同意版本应拒绝；员工可见的范围内审计仅含动作/结果/操作者/范围等必要元数据，没有包含被拒绝的自由文本正文。
- 同一测试继续覆盖固定题目、按顺序提示、退出和超时后的旧会话拒绝、家长越权读取、教师跨班摘要/接手、匿名平台汇总。
- Mini/Web/Admin 未改源文件，复用本轮刚通过的 G4.2 证据：Mini 类型及状态 6/6、运行时 10 页/33 输出无陈旧文件；Web 类型/页面 4/4/教师接手浏览器流程；Admin 类型/页面 2/2/匿名汇总浏览器流程。各端目标 ESLint、Prettier、`git diff --check` 已通过。
- 本切片只改动合同列出的一个 API loopback 测试文件；未修改业务实现、`staff.test.ts`、依赖、lockfile或主树业务文件，也未安装依赖、提交、推送、部署或发布。
- Owner Review：`PENDING`；微信开发者工具点击：`NOT_RUN`；主工作树业务同步：`NOT_EXECUTED`。
