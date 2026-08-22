# 学生托管机构智能化系统平台

本仓库是“同芯学园”试点方向的多租户 SaaS 规划与原型仓库。Batch A 已完成并冻结；当前执行 **Phase 1A 批次B**，用于产出可审查的品牌设计系统、高保真离线原型、V0.1 技术基线、验证证据和 Phase 1B 实施计划。

当前内容不是正式系统，不包含正式业务代码，不连接真实服务，不使用真实学生数据，不调用正式 AI 模型。

## 当前状态

- 项目根路径：`C:\Users\HU\Documents\student-care-saas-platform`
- 工作分支：`planning/phase-1a-batch-b`
- 当前节点：B1 批次B治理基线
- 允许阶段：Phase 1A 批次B
- 禁止阶段：Phase 1B 正式开发及后续阶段
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

| 端 | 核心职责 | 当前批次交付形态 |
|---|---|---|
| 微信小程序 | 即时、现场、轻量、拍照上传、快捷处理 | 高保真离线审查原型 |
| 用户网页端 | 完整查看、历史记录、长内容、复杂编辑 | 高保真离线审查原型 |
| 机构管理网页端 | 配置、权限、表格、统计、审核、批量管理 | 高保真离线审查原型 |

三端共享统一账号、权限、后端、数据库、文件与业务规则。所有机构和校区数据必须按 `tenant_id`、`campus_id` 隔离。

## 治理流程

每项任务都必须使用任务合同：批准范围 → 实施 → 自检 → QA/安全审查 → 显式暂存 → 提交 → 证据回执 → 停止。发现合同冲突、真实数据、密钥、越权、验证失败或范围扩张时立即停止，并更新阻塞记录。

模板位于：

- `docs/templates/TASK_CONTRACT.md`
- `docs/templates/REVIEW_RECEIPT.md`

总体执行顺序与五个提交节点见 `PLANS.md`。`PASS` 仅表示内部证据门禁通过，`PROJECT_OWNER_ACCEPTANCE` 必须保持 `PENDING`，最终验收权属于项目负责人。
