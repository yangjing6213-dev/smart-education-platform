# TASK20 D86：主工作树 User Web/Admin Web 回归复核

## 目标

在主工作树上重新验证 User Web 与 Admin Web 当前源码的测试、类型检查和 ESLint；D83/D78 的隔离工作树或旧主树结果不替代本次证据。此任务为只读产品审计，不修复业务代码；若发现失败，记录最小复现后再开单独修复项。

## 基线

- 工作树：`C:/Users/HU/Documents/student-care-saas-platform`，HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。
- PDF v2.0 SHA-256：`4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。
- 仅运行现有包脚本，不安装依赖、不运行 install/frozen-lockfile 命令。
- 两个测试脚本会由现有 TypeScript 编译器生成 JS；允许的生成写入仅限 `apps/user-web/dist/` 与 `apps/admin-web/dist/`。不允许生成或修改这两个目录之外的产品、配置、依赖或 lockfile 文件。

## 精确治理写集

- CREATE：`docs/superpowers/plans/2026-10-10-task20-d86-main-web-admin-regression-recheck.md`。
- MODIFY：`PLANS.md`，记录 D86 结果和下一目标。
- MODIFY：`docs/exec-plans/active/project-completion.md`，同步 D86 结果。
- 所有 User Web/Admin Web 源码、测试、配置、依赖与 lockfile 均只读。`apps/user-web/dist/` 与 `apps/admin-web/dist/` 仅作为测试脚本产生的编译输出，不手工编辑、不纳入业务修改。

## 验证顺序

1. 串行执行 `pnpm --filter @student-care/user-web test` 与 `pnpm --filter @student-care/admin-web test`，记录各自测试数、通过数、失败数、退出码；两项均不并行。
2. 串行执行两个包的 `typecheck` 与 `lint` 脚本，记录结果。
3. 执行 `git diff --check`；审核 `git status --short`，确认本任务未改变治理写集及两个 dist 输出目录之外的任何状态。依赖清单与 lockfile 必须保持本轮前状态。
4. 如测试因源码缺陷失败，停止 D86，不修改业务代码；将失败归类为已复现问题，并建立 D87 最小修复任务。

## 禁止事项与边界

- 不安装依赖、不修改 lockfile，不运行 build/deploy/release，不提交或推送。
- 不连接真实数据、认证、API、数据库、伙伴云或正式 AI，不调用外部服务。
- 不覆盖、清理或同步其他工作树现场；不改 Mini、API 或任意 Web/Admin 源文件。
- D86 自动化证据不代表真实浏览器人工验收、微信开发者工具点按或 Owner Review。

## 结果与状态

`PASS_MAIN_TREE_USER_WEB_AND_ADMIN_WEB_REGRESSION`

- `pnpm --filter @student-care/user-web test`：118/118 通过，退出码 0；包脚本先用现有 TypeScript 编译器输出到 `apps/user-web/dist/`，再以并发 1 运行测试。
- `pnpm --filter @student-care/admin-web test`：139/139 通过，退出码 0；包脚本先输出到 `apps/admin-web/dist/`，再以并发 1 运行测试。
- 两包 `typecheck` 均通过；User Web `eslint src` 与 Admin Web `eslint src test` 均通过。
- 测试编译输出限于合同允许的两个 dist 目录；没有运行安装命令。User Web/Admin Web 源文件、测试、配置、依赖和 lockfile 未修改。D86 未重新执行浏览器人工视觉检查；已有浏览器证据保持其原有日期与范围，不升级为本轮新验收。
- 本次结果仅证明主工作树现有网页测试、类型和 ESLint 状态；不代表真实服务、部署或负责人验收。
