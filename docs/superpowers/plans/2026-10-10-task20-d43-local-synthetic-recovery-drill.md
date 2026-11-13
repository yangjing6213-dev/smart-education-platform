# TASK20 D43：本机合成文件恢复演练

## 目标

在 V3 M6.3 真实备份/恢复仍未就绪的前提下，用 Node.js 内置模块做一次**只针对临时虚构文件**的校验、恢复和损坏拒绝演练。演练不读取、复制或恢复项目文件、机构资料、应用服务状态或任何真实数据；结果只证明本机临时文件流程，不代表数据库/对象存储恢复或生产就绪。

## 依据与现状

- 项目方案 PDF v2.0 SHA-256：`4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。
- V3 实施计划 SHA-256：`ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。
- 既有 M6.3 只读审计：`docs/superpowers/plans/2026-10-10-task20-m63-local-recovery-readiness.md`。它确认当前服务仅有内存状态，真实持久化备份、隔离恢复、生产回滚和联网供应链审计都没有证据。
- 此批只补充一个本机合成文件演练；M6.3 总体仍为 `PARTIAL`。

## 精确写集

1. 新增 `scripts/local-synthetic-recovery-drill.mjs`：只使用 `node:crypto`、`node:fs`、`node:fs/promises`、`node:os`、`node:path`、`node:url`，导出可测试的演练函数并提供直接运行入口。
2. 新增 `scripts/local-synthetic-recovery-drill.test.mjs`：用 Node 内置 `node:test` 验证完整演练结果与清理边界。
3. 新增本合同文件。
4. 主工作树只局部更新 `PLANS.md`、`docs/exec-plans/active/project-completion.md` 和 `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 的 D43 状态、证据与剩余门槛。

除此六条路径外不创建或修改文件。不得改包脚本、配置、锁文件、API、数据库、Admin、User Web、Mini 页面、历史验证器或架构基线。

## 设计与安全边界

- 不接受任意源目录、备份目录、恢复目录、环境变量或命令行路径；所有文件必须位于当前运行新建的 `os.tmpdir()` 唯一目录内。
- 演练自行创建固定、明显虚构的 JSON 记录；禁止包含姓名、联系方式、机构、学生、账号、令牌或服务数据。
- 对演练文件计算 SHA-256 清单；恢复前先验证文件清单和内容。校验失败必须在写入恢复目标前拒绝，不能覆盖任何目标。
- 成功路径把通过校验的合成文件写入同一临时根目录下的全新恢复子目录，并逐字节校验恢复结果。
- 失败路径只损坏本轮生成的临时备份副本，确认拒绝恢复且恢复目标仍不存在。
- `finally` 仅删除本轮 `mkdtemp` 生成且仍位于系统临时目录内的专属根目录；清理失败必须作为演练失败报告，不能扩大删除路径。
- 脚本不建立网络连接、不启动服务、不访问项目文件、不写浏览器存储、不输出虚构记录正文或临时绝对路径。
- 终端只输出不含数据的状态摘要，例如 `syntheticOnly`、`backupVerified`、`restoreVerified`、`corruptBackupRejected`、`cleanupCompleted`。

## 验收标准

1. 先新增测试并运行，观察预期的“演练模块不存在”失败，再添加最小实现。
2. 通过 `node --test scripts/local-synthetic-recovery-drill.test.mjs`；断言校验、成功恢复、损坏拒绝、拒绝发生在目标写入前和临时目录清理。
3. `node --check scripts/local-synthetic-recovery-drill.mjs` 与测试文件通过；已有 Node.js，无需安装依赖。
4. 使用已安装 Prettier API 检查两个脚本和本合同；不可用时记录 `NOT_RUN`，不得安装工具。
5. 六路径差异空白与范围审计通过；不执行全仓测试、Mini 测试或历史发布验证器。
6. 报告严格称为“本机临时合成文件演练通过”；真实数据库/对象存储备份恢复、RTO/RPO、生产回滚、密钥/告警和供应链审计仍为未完成。

## 禁止项与停止条件

- 不读取或写入任何非本轮创建的临时数据；不探测用户文件或真实备份。
- 不触碰数据库、对象存储、服务进程、网络、生产配置、凭据、部署/上传/发布。
- 不安装依赖或修改 lockfile，不 commit、push、部署或发布。
- 若实现需要任意目录输入、覆盖现有文件、使用外部命令/依赖或触及精确写集之外的路径，立即停止并报告。

## 验证记录

- 初始工作树：独立 worktree `C:\Users\HU\.codex\worktrees\task20-d43-local-recovery-drill`，`HEAD=bd0001faa8e2fd7bbabe86e3d778ba24431107e8`，开工时 `git status --short` 为空。
- TDD 红灯：先创建测试并运行 `node --test scripts/local-synthetic-recovery-drill.test.mjs`，因实现模块尚不存在而以 `ERR_MODULE_NOT_FOUND` 失败；随后补最小实现。
- 定向测试：`node --test scripts/local-synthetic-recovery-drill.test.mjs` 通过，1/1；直接运行 `node scripts/local-synthetic-recovery-drill.mjs` 返回七项全为 `true` 的状态摘要。
- 语法检查：`node --check scripts/local-synthetic-recovery-drill.mjs` 与 `node --check scripts/local-synthetic-recovery-drill.test.mjs` 均退出 0。
- Prettier：使用仓库已安装的 Prettier API 格式化并复核两份脚本及本合同；没有运行异常的 Prettier 命令入口，也没有安装或改动依赖。
- 独立只读复审：Critical、Important、Minor 均无；复审确认损坏备份只接受预期校验错误，拒绝发生在恢复目录创建前，且既存目标内容保持不变。
- 隔离 worktree 范围审计：仅有本合同、演练脚本和定向测试三个新增文件；无跟踪文件改动。主树三份进度记录按原内容局部追加 D43 证据，不覆盖其他现场。未提交、未产生外部写入。
- D43 状态为本机临时合成文件演练通过；V3 M6.3 总体仍为 `PARTIAL`。真实数据库/对象存储备份恢复、RTO/RPO、生产回滚、密钥/告警和供应链审计仍未完成；微信开发者工具复核与 Owner Review 也不由本演练替代。
