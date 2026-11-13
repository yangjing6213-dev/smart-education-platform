# TASK20 D41：路径安全的小程序测试入口

## 背景与目标

D39 的验证命令曾在 Windows 上使用路径排除条件，但工具把路径显示为反斜杠，排除未生效，意外把受保护的 `apps/mini-program/src/pages/staff.test.ts` 传给测试运行器。本任务修复验证入口，不读取、运行或修改该受保护文件。

新增一个无需安装依赖的 Node 脚本。它只接受明确列出的 Mini `*.test.ts` 文件，在启动任何测试进程前将路径统一规范化、限定在 Mini 测试目录，并拒绝受保护文件、目录、glob、越界路径和重复路径。脚本可在 Windows 和 POSIX 路径分隔符下工作；只运行明确输入的清单，不自动扫描或扩展测试集合。

## 精确写集

- CREATE `scripts/mini-safe-test-runner.mjs`
- CREATE `tests/workspace/mini-safe-test-runner.test.mjs`
- CREATE `docs/superpowers/plans/2026-10-10-task20-d41-path-safe-mini-test-entrypoint.md`
- MODIFY `PLANS.md`（仅追加 D41 状态/验证）
- MODIFY `docs/exec-plans/active/project-completion.md`（仅追加 D41 状态/验证）
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`（仅追加 D41 状态/验证）

禁止修改产品页面、业务逻辑、`staff.test.ts`、其他测试、Mini 注册配置、依赖或 lockfile；不得提交、推送、部署或发布。

## 验收

1. 先写测试并观察失败，再实现入口。
2. 对安全路径、Windows 反斜杠、绝对路径、路径越界、glob、重复输入、空清单和受保护路径建立行为验证。
3. 受保护路径必须在启动子进程前被拒绝；测试通过命令行观察其退出码，并确认没有启动测试的输出。该拒绝验证不会读取被保护文件内容。
4. 用该新入口运行明确列出的安全 Mini 页面测试，确认 Node 24 当前内置 TypeScript 支持可用；测试文件只传入精确路径，不使用通配符。
5. 运行新增测试、目标 ESLint、Prettier API、目标路径 `git diff --check` 和写集审计；不执行 Mini 全量测试。
6. 不连接真实服务或网络，不改变运行中服务，不清理或覆盖既有现场。

## 停止条件

若 Node 运行时无法执行本地 TypeScript 测试、需要新增依赖/lockfile、需要修改清单以外路径，或任何命令可能读取/运行受保护文件，立即停止该验证并保留安全入口的独立测试证据。
