# 新账号接管指令：学生托管 SaaS / Task 19 R1

> 本文件直接提取自 $sourcePath 的第 10 节。它必须与完整交接文件一起使用，不构成新的开发、验收、push、部署或发布授权。

```text
你现在接管 C:\Users\HU\Documents\student-care-saas-platform。请先读取 docs/HANDOFF_TASK19_R1_2026-09-22.md，再读取 AGENTS.md、PLANS.md、V42 治理文件和 R1 contract/plan。

当前现场：分支 feature/phase-1b-task-19-final-delivery-acceptance，HEAD 为 bd0001faa8e2fd7bbabe86e3d778ba24431107e8。2026-09-23 10:46 +08:00 最新快照有 13 个已跟踪小程序文件未暂存修改、暂存区为 0、883 条未跟踪路径；现场仍可能被另一个本地进程或账号继续修改，接管时先重新计数。R1 合同另有 71 条保护基线子集。保留全部现场，不读取保护未跟踪内容，不删除、移动、覆盖、清理、格式化、暂存或提交这些变化。

先只读执行：
1. 核对 branch、HEAD、origin、Git status、未跟踪数量和 V42 SHA-256。
2. 核对 ACTIVE_GOVERNANCE=V42、ACTIVE_TASK=TASK19_R1_STAGE_A_FORMALIZATION、R1_IMPLEMENTATION_AUTHORIZED=NO、Task19 Stage B/C1/C2=NOT_GRANTED、Task20+=NOT_GRANTED。
3. 把当前状态标记为 BLOCKED / CONTROL_PLANE_DRIFT：HEAD 已包含 user-web 与 mini-program 实现，但治理文件没有给这些实现当前授权，不能自动验收、回退、继续开发或发布。
4. 忽略旧 `PHASE_1B_TASK_19_CODEX_EXECUTION.md` 中可能出现的 Stage B `GRANTED/IN_PROGRESS` continuation snapshot；它是历史冻结字段，不能覆盖当前 R1 `NOT_GRANTED` 控制面。
5. 记录当前 dirty wave：最新快照 13 个 tracked 小程序文件在修改 import/tsconfig/tests/WXML/WXSS，另有编译 JavaScript 和 project config 未跟踪现场；作者、授权和测试结果未知，保持 `IN_PROGRESS_UNVERIFIED`，不要接着改或回退。
6. 记录阶段状态：Phase 1A 与 Phase 1B Task01-18 是历史接受/冻结证据；Task19 final delivery 未闭合；R1 Stage A 等负责人 review；mini-program visitor/staff 代码存在但未当前复验/验收。
7. 记录小程序事实：当前只有 4 个原生页面代码（visitor home/content、staff workbench/quick-action）；V0.1 页面清单规划 20 个 A 级小程序页面和 12 个 B 流程，因此剩余页面/流程未完成。project.config.json 与 project.private.config.json 虽存在但属于未跟踪保护内容，不能读取其 AppID 或私有值。
8. 记录发布事实：没有经核验的微信开发者工具编译、模拟器、真机、体验版、审核、生产发布；没有经核验的腾讯云服务器、域名、DNS/TLS、COS、备份、回滚、监控或线上版本。历史候选服务器规格（4核/8GB/180GB SSD/12Mbps/2000GB/月）只是 V0.1 候选，不是上线证据。

负责人没有明确授权前：不安装依赖、不运行产品测试/构建/浏览器/微信开发者工具、不接入 API/微信登录/云开发/COS、不连接腾讯云、不上传体验版、不部署、不 push、不 release、不修改 lockfile，不处理保护未跟踪路径。

只有在负责人签发新的阶段合同后，才按授权范围执行本地验证；微信体验版/审核/生产发布和腾讯云部署必须分别授权，并单独记录目标环境、最小权限、域名/合法域名、隐私合规、备份、回滚、健康检查、人工验收和停止条件。

完成只读预检后回执：
HANDOFF_RECEIVED=YES
HEAD=<actual sha>
ACTIVE_TASK=<actual value>
CONTROL_PLANE_DRIFT=YES|NO
MINI_PROGRAM_NATIVE_PAGES=4_OF_20_PLANNED
MINI_PROGRAM_WORKTREE=DIRTY_IN_PROGRESS_UNVERIFIED
WECHAT_DEVTOOLS_STATUS=NOT_RUN|PASS|BLOCKED
WECHAT_EXPERIENCE_RELEASE=NOT_AUTHORIZED
TENCENT_CLOUD_DEPLOYMENT=NOT_VERIFIED_AND_NOT_AUTHORIZED
STATUS=BLOCKED|READY_FOR_OWNER_REVIEW
NEXT_ACTION=<one bounded action>
```

