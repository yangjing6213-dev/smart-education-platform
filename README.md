# 学生托管机构智能化系统平台

本仓库是“同芯学园”试点方向的多租户 SaaS 规划与原型仓库。Batch A、Batch B 已完成并冻结；Phase 1B Task 01—12 已接受并冻结，Task 12 新工作未启动，Task 13+ 未授权。

当前仓库已包含 Phase 1B Task 01—03 的早期基础实现，但尚不是完整生产系统；不连接真实服务，不使用真实学生数据，也不调用正式 AI 模型。

## 当前状态

- 项目根路径：`C:\Users\HU\Documents\student-care-saas-platform`
- 工作分支：`feature/phase-1b-task-04-identity-membership`
- 当前节点：Phase 1B Task 11 C2 accepted and frozen; stopped before Task 12 new work
- 当前治理状态：`PHASE_1B_STARTED=YES_TASK11_C2_ACCEPTED`
- Task 10 锚点：`TASK_10_STAGE_C2_STATUS=ACCEPTED`、
  `TASK_10_STATUS=ACCEPTED_AND_FROZEN`、
  `TASK_10_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_10_ACCEPTANCE.md`、
  `TASK_10_ACCEPTANCE_SHA256=4628B2BADB28CF6E5A065AD252B4A1E934D199A1A911D9DE6DEC07313064B657`
- Task 11 锚点：`TASK_11_STAGE_C2_STATUS=ACCEPTED`、
  `TASK_11_STATUS=ACCEPTED_AND_FROZEN`、
  `TASK_11_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_11_ACCEPTANCE.md`、
  `TASK_11_ACCEPTANCE_SHA256=4482B3B1914B3A78886487854A54C2732CDF688BB59418C88570E32F204B4FCD`
- 禁止阶段：Task 12 new work、Task 12 route repair、Task 13+；后续阶段必须有独立负责人授权
- 远程推送与部署：禁止

## 先读顺序

1. `PHASE_1A_BATCH_B_CODEX_EXECUTION.md`（SHA-256：`8DE2E96EB129E05950F8BC3832C5CEB842A1565BC5512E201F7EB233AC6DE04E`）
2. `AGENTS.md`
3. `docs/project/PHASE_1A_BATCH_A_ACCEPTANCE.md`
4. `docs/project/PHASE_1A_BATCH_B_DECISION_BASELINE.md`
5. `docs/project/PHASE_1A_BATCH_B_SCOPE_AND_NON_SCOPE.md`
6. `docs/plans/PHASE_1A_BATCH_B_EXEC_PLAN.md`
7. Batch A 冻结的产品、架构、AI 和审查文件
8. `phase-inputs/phase1a-batch-b/START_HERE.md` 与四个只读视觉输入

Batch B 合同必须保持字节不变，SHA-256 固定为：

```text
8DE2E96EB129E05950F8BC3832C5CEB842A1565BC5512E201F7EB233AC6DE04E
```

## 三端定位

| 端             | 核心职责                               | 当前批次交付形态   |
| -------------- | -------------------------------------- | ------------------ |
| 微信小程序     | 即时、现场、轻量、拍照上传、快捷处理   | 高保真离线审查原型 |
| 用户网页端     | 完整查看、历史记录、长内容、复杂编辑   | 高保真离线审查原型 |
| 机构管理网页端 | 配置、权限、表格、统计、审核、批量管理 | 高保真离线审查原型 |

三端共享统一账号、权限、后端、数据库、文件与业务规则。所有机构和校区数据必须按 `tenant_id`、`campus_id` 隔离。

## 治理流程

每项任务都必须使用任务合同：批准范围 → 实施 → 自检 → QA/安全审查 → 显式暂存 → 提交 → 证据回执 → 停止。发现合同冲突、真实数据、密钥、越权、验证失败或范围扩张时立即停止，并更新阻塞记录。

模板位于：

- `docs/templates/TASK_CONTRACT.md`
- `docs/templates/REVIEW_RECEIPT.md`

总体历史执行顺序与五个提交节点见 `PLANS.md`。当前活动治理以 `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V24.md` 为准（SHA-256：`209124CDD9FBB355A9C29610E97439CCBC847A3F5CA033575B14646C7974F833`）。历史冻结文件中的旧 `PHASE_1B_STARTED=NO`、`PROJECT_OWNER_ACCEPTANCE=PENDING`、NestJS 和旧阶段语句不回写；当前 API/runtime 为 Fastify 5.12.1、Node 24.14.0、pnpm 11.22.0，T12=`T02 -> T03 -> T05`，T10=`T05 -> T08 -> T12`。Task 01—12 已接受并冻结；Task 12 C2 已接受，但 `apps/api/src/server.ts` 尚未注册 `registerFileIntentRoutes`；Task 12 新工作、Task 12 route repair 与 Task 13+ 未授权。
