# 学生托管机构智能化系统平台

本仓库是“同芯学园”试点方向的多租户 SaaS 规划与原型仓库。当前仅执行 **Phase 1A 批次A**，用于把已批准方案转化为可审查、可追踪、可继续执行的规格、低保真原型、技术草案和证据包。

当前内容不是正式系统，不包含正式业务代码，不连接真实服务，不使用真实学生数据，不调用正式 AI 模型。

## 当前状态

- 项目根路径：`C:\Users\HU\Documents\student-care-saas-platform`
- 工作分支：`planning/phase-1a-batch-a`
- 当前节点：A1 Git 与项目治理基线
- 允许阶段：Phase 1A 批次A
- 禁止阶段：Phase 1A 批次B、Phase 1B
- 远程推送与部署：禁止

## 先读顺序

1. `PHASE_1A_BATCH_A_CODEX_EXECUTION.md`
2. `docs/project/DECISION_BASELINE.md`
3. `docs/project/SCOPE_AND_NON_SCOPE.md`
4. `docs/project/TERMINOLOGY.md`
5. `docs/plans/PHASE_1A_BATCH_A_EXEC_PLAN.md`
6. `AGENTS.md`
7. `docs/reviews/BLOCKERS.md`
8. 当前任务合同

源合同必须保持字节不变，SHA-256 固定为：

```text
892521A36DF3A3A1E76C3923E00705E6F9405515020701279F2AB328F00436AC
```

## 三端定位

| 端 | 核心职责 | 当前批次交付形态 |
|---|---|---|
| 微信小程序 | 即时、现场、轻量、拍照上传、快捷处理 | 页面规格与低保真原型 |
| 用户网页端 | 完整查看、历史记录、长内容、复杂编辑 | 页面规格与低保真原型 |
| 机构管理网页端 | 配置、权限、表格、统计、审核、批量管理 | 页面规格与低保真原型 |

三端共享统一账号、权限、后端、数据库、文件与业务规则。所有机构和校区数据必须按 `tenant_id`、`campus_id` 隔离。

## 治理流程

每项任务都必须使用任务合同：批准范围 → 实施 → 自检 → QA/安全审查 → 显式暂存 → 提交 → 证据回执 → 停止。发现合同冲突、真实数据、密钥、越权、验证失败或范围扩张时立即停止，并更新阻塞记录。

模板位于：

- `docs/templates/TASK_CONTRACT.md`
- `docs/templates/REVIEW_RECEIPT.md`

总体执行顺序与四个提交节点见 `PLANS.md`。`PASS` 仅表示内部证据门禁通过，最终验收权属于项目负责人。
