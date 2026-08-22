# Phase 1A 批次B决策基线

## 1. 冻结标识

- 项目根：`C:\Users\HU\Documents\student-care-saas-platform`
- 当前阶段：`PHASE_1A_BATCH_B`
- 源分支：`planning/phase-1a-batch-a`
- 源 HEAD：`f698f87150dce3376fb96d1bbb330d28d0d73b81`
- 目标分支：`planning/phase-1a-batch-b`
- 权威合同：`PHASE_1A_BATCH_B_CODEX_EXECUTION.md`
- 合同 SHA-256：`8DE2E96EB129E05950F8BC3832C5CEB842A1565BC5512E201F7EB233AC6DE04E`
- Batch A 验收：`PASS`，日期 `2026-08-22`
- Batch B 项目负责人验收：`PROJECT_OWNER_ACCEPTANCE=PENDING`

合同、Batch A 最终提交、Batch A 审查包及本批次批准的视觉输入共同构成执行权威。Batch A 的旧决策基线、产品规格、架构草案和 AI 安全草案继续作为输入，不因本文件创建而被覆盖。

## 2. 范围决策

1. Batch B 只产出治理、设计系统、离线高保真原型、原创本地 SVG、V0.1 基线、Phase 1B 计划、验证证据、截图和审查包。
2. 高保真原型必须保持 47 个 A 级页面、12 个 B 级流程和 10 个 C 级未来预留的可追踪映射；可执行路由总数为 59。
3. 三条完整闭环保持可操作：家长与学生绑定；教师任务至工作日报；监督式同芯 AI 学习至授权教师摘要。
4. AI 原型只允许小学作业引导和错题巩固，顺序为学生先尝试、第 0/1/2/3 层提示、1 至 3 道巩固题、转教师或关闭。
5. 三端职责不变：小程序用于即时、现场、轻量操作；用户网页用于完整查看和复杂编辑；机构管理只使用管理网页。
6. 所有内容均为明确标注的模拟数据；不使用真实个人资料、生产密钥、正式模型或外部业务 API。

## 3. 视觉与原创性决策

批准视觉输入只用于分析布局、卡片、留白、信息层级和跨端结构。不得复制输入图片中的原配色、人物、机器人、图标、水印、文字或完整页面。机构 Logo 是唯一允许直接使用的输入图像；其余儿童插画和图标均由本项目本地原创 SVG 提供。

## 4. 文件与冻结决策

- `phase-inputs/phase1a-batch-b/` 只读、被 `.gitignore` 忽略、不提交、不进入 ZIP；
- `docs/reviews/BLOCKERS.md` 是 Batch A 冻结文件，Batch B 不得修改；
- Batch A ZIP、`SHA256SUMS.txt`、评审报告、文件清单、验证器、低保真原型、截图、既有产品/架构/AI文档均不得修改、覆盖、重新生成或删除；
- B1 之后发生阻塞时，只能创建或更新合同白名单中的 `docs/reviews/PHASE_1A_BATCH_B_REVIEW.md`，记录事实、证据、影响和最小解除条件后停止；
- 目标分支已由 B0 后按指定源 HEAD 创建，本批次不得删除、重建、切换到其他分支或配置 remote。

## 5. 技术边界决策

高保真原型使用原生 HTML、CSS Custom Properties、JavaScript、hash 路由、内存模拟数据和本地 PNG/SVG。禁止框架、依赖安装、`package.json`、应用脚手架、网络请求、外部字体、外部图标、持久化存储、正式后端、支付、正式 AI 和数据库迁移。

Phase 1B 只写 18 个独立 TDD 任务的实施计划，不执行任何任务，不创建 `apps/`、`packages/` 或正式业务代码。

## 6. 证据与提交决策

固定五次提交信息依次为：

1. `chore: activate phase 1a batch b design baseline`
2. `docs: define tongxin cross-end design system`
3. `feat: add phase 1a high fidelity prototypes`
4. `docs: finalize v0.1 technical baseline and phase 1b plan`
5. `test: add phase 1a batch b review evidence`

审查 ZIP 必须为合同列出的 86 项精确白名单，成员名单 SHA-256 为 `B6ED195F1F41AB731F53AFA65071037BE23A56F3547B543160A41F0CE6A33C30`。不匹配即阻塞，禁止生成或覆盖 ZIP。Batch B 使用独立 `SHA256SUMS_PHASE_1A_BATCH_B.txt`，不得覆盖 Batch A 根清单。

## 7. 停止不变量

```text
PHASE_1B_STARTED=NO
PRODUCTION_DEPLOYMENT_EXECUTED=NO
GIT_PUSH_EXECUTED=NO
REAL_PERSONAL_DATA_USED=NO
LIVE_AI_MODEL_USED=NO
PROJECT_OWNER_ACCEPTANCE=PENDING
```

内部 `PASS` 只表示证据门禁通过，不表示项目负责人已验收或授权下一阶段。
