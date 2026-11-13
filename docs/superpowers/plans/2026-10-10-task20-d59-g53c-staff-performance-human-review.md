# TASK20 D59：员工工作回顾合成记录

**状态：** `CONTRACT_READY`
**目标任务：** `TASK20_D59_G53C_STAFF_PERFORMANCE_HUMAN_REVIEW_SYNTHETIC`
**日期：** 2026-10-10
**产品依据：** V3 M6.2 的 `StaffPerformance` 领域对象，以及 PDF v2.0 对管理端员工经营工作和个人权益人工复核的边界。
**授权依据：** 负责人已明确要求由执行者自主继续本地开发；本合同仅落实本地合成 Admin 功能，不扩张至真实运营。

## 1. 目标与边界

在现有 Admin `/admin/staff` 的员工经营区域增加独立的“员工工作回顾”合成记录，补齐 V3 M6.2 中缺少的 `StaffPerformance` 对象。仅使用现有虚构员工代号与固定选项。负责人手工建立及审核记录；不计分、不排名、不自动评价或建议任用，不改变薪酬、岗位、排班、录用或其他个人权益。

数据仅保存在页面内存，刷新恢复固定样例。不得连接 API、数据库、伙伴云、真实认证、外部服务或持久化。不得新增依赖、修改 lockfile、读取/运行/修改 `apps/mini-program/src/pages/staff.test.ts`，不得提交、推送、部署或发布。

## 2. 精确写集

### 隔离实现工作树

使用现有 `C:\Users\HU\.codex\worktrees\task20-admin-completion`，当前基线 HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。开始前逐文件核对当前内容，保留此树其他已有现场。

已核对的实施前 SHA-256：隔离树 `staff-operations.ts` `71ACEB1A9E5590548F6B217C704BB616D682248779719F93EB6955FFF3AAD4B3`、`staff-operations` 页面 `73B4943FDC493D0695295677DB734B04A861F2D603F28489D7D0834A8538FCA2`、模型测试 `F0ED3A521CF75F244975B8A8C60B8A3F315E5EB9BEF1683651F9A4AA110A187F`、浏览器验证脚本 `A12823A147DEB8C982A18EEECBF223958A910C2E45C96C762C928899077D2834`。主树模型与页面和隔离树逐字节一致，哈希分别为 `71ACEB1A9E5590548F6B217C704BB616D682248779719F93EB6955FFF3AAD4B3`、`73B4943FDC493D0695295677DB734B04A861F2D603F28489D7D0834A8538FCA2`；主树现有模型测试与隔离树不同，故新增独立测试文件，不覆盖该测试；主树原先没有该浏览器脚本，且本项不需要同步它。主树 `main.ts` 不在写集内，哈希差异也不影响本任务。

- MODIFY `apps/admin-web/src/local-synthetic/staff-operations.ts`
- MODIFY `apps/admin-web/src/pages/staff-operations.ts`
- CREATE `apps/admin-web/test/staff-performance.test.mjs`
- MODIFY `apps/admin-web/test/staff-operations-browser.mjs`（仅用于验证新流程）

不修改 `apps/admin-web/src/main.ts`：当前 `/admin/staff` 已挂载 `createStaffOperationsSection`，新增面板应接入该既有区域。

### 主工作树选择性整合

- MODIFY `apps/admin-web/src/local-synthetic/staff-operations.ts`
- MODIFY `apps/admin-web/src/pages/staff-operations.ts`
- CREATE `apps/admin-web/test/staff-performance.test.mjs`
- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- MODIFY 本合同

主树仅在逐文件核对源增量后选择性同步上述产品和测试路径；不得覆盖 `main.ts` 或其他现场。浏览器验证脚本只需在隔离树运行，不要求同步到主树。

## 3. 实施顺序

1. 先在隔离树新增独立模型测试并确认因功能缺失而失败。覆盖固定选项/合成人员校验、非法额外字段拒绝、创建记录、人工复核和支持措施、版本历史与旧版本冲突、只读/无权页面不可操作、刷新后恢复初始样例。
2. 在现有 `staff-operations.ts` 中新增有版本的 `StaffPerformanceReview` 内存记录，并在 `staff-operations.ts` 页面中增加固定字段工作回顾表单与历史列表。内容仅限人工结构化记录；不得显示数字分数、名次、系统生成评价或自动人事结论。
3. 扩展既有 Admin 浏览器操作脚本，验证授权负责人创建/复核、只读模式不可操作、无权模式不展示、刷新复位、无浏览器存储/外部请求/页面错误。
4. 通过独立差异复核后，选择性将模型、页面和新测试整合到主树。对合并后主树实际运行测试、类型检查、构建、ESLint、格式检查及 `git diff --check`，逐条审计写集。

## 4. 验收标准与验证

- M6.2 `StaffPerformance` 由独立类型与记录承载，不借用工作材料状态冒充。
- 负责人可通过固定选项记录虚构员工在指定月份的工作领域、人工回顾结论及支持措施；可查看状态变更历史，记录内容建立后固定，不支持自由文本编辑。
- 非法值、自由文本/多余输入、旧版本写入均被拒绝；只读/无权状态不能改动数据。
- 页面刷新后回到合成样例；不向网络发出请求、不写入浏览器存储。
- 在隔离树运行 Admin 聚焦模型测试、既有员工经营测试、浏览器操作脚本、Admin typecheck/build、ESLint、Prettier API、`git diff --check`；主树选择性同步后复跑聚焦测试、typecheck/build、ESLint、格式/API 与范围审计。

## 5. 停止条件

若代码要求真实员工身份/资料、自由文本档案、自动评价/评分/排名、人事决策、API/数据库/持久化、外部服务、依赖或白名单外业务文件，立即停止超出部分并记录原因。不要通过弱化断言或权限使验证通过。Owner Review、实际微信复核和真实 SaaS 运行仍分别保持原状态。
