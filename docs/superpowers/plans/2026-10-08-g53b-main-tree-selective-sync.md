# TASK20 G5.3B 管理端员工工作材料与招聘跟进主树选择性整合合同

**日期：** 2026-10-08  
**自主执行依据：** 用户已明确授权继续完成项目剩余阶段，不要求逐阶段重复授权；本合同锁定本批次实际写集。  
**来源实施合同：** `docs/superpowers/plans/2026-10-08-g53b-staff-performance-recruitment.md`，SHA-256 `6D5BC9F1DBE9B44F4301847E669B7DEE2FD3237892C28A29F935CD4CC55D5F28`。

## 1. 目标

把已完成的 G5.3B 员工工作材料与招聘跟进本机合成模块接入主工作树已有的 `/admin/staff` 页面。来源工作树只读；逐文件比较后仅选择性新增独立模块，并在主树现有页面中追加入口，不复制整个 `main.ts`，避免覆盖主树既有的员工资格材料、数据授权和隐私申请功能。

只记录虚构员工与候选人、固定类别和人工跟进状态；不评分、不排名、不自动决定录用或影响员工权益。数据只存在页面内存，刷新恢复预置样例。

## 2. 精确写集

来源只读目录：`C:\Users\HU\.codex\worktrees\task20-admin-completion`。

实施前基线：

- 主树 `apps/admin-web/src/main.ts` SHA-256：`643268E823CC40F5DE48BBB98A96A2B71F1E82EC402F6EDA85985F2D093D99DE`。
- 来源 `apps/admin-web/src/main.ts` SHA-256：`2FB15375AEE6A4749C5DAAD19F88BA99FF1ECBF19C95BBB203CB56957F362B60`；因两文件含有不同的既有功能，禁止整份复制。
- 来源模型 `staff-operations.ts` SHA-256：`71ACEB1A9E5590548F6B217C704BB616D682248779719F93EB6955FFF3AAD4B3`。
- 来源页面 `staff-operations.ts` SHA-256：`73B4943FDC493D0695295677DB734B04A861F2D603F28489D7D0834A8538FCA2`。
- 来源聚焦测试 `staff-operations.test.mjs` SHA-256：`F0ED3A521CF75F244975B8A8C60B8A3F315E5EB9BEF1683651F9A4AA110A187F`。
- 上述三个模块/测试目标在主树开始时不存在。

主树仅允许：

- CREATE `apps/admin-web/src/local-synthetic/staff-operations.ts`。
- CREATE `apps/admin-web/src/pages/staff-operations.ts`。
- CREATE `apps/admin-web/test/staff-operations.test.mjs`。
- MODIFY `apps/admin-web/src/main.ts`：仅添加上述两个模块的 import、一个固定内存 store，并将员工工作材料区域追加到现有员工页面；保留现有员工资格材料、路由、隐私申请、授权复核和所有其他入口。
- MODIFY `PLANS.md`：记录本合同、结果、验证和后续任务状态。
- CREATE 本合同文件。

不复制来源浏览器脚本：它依赖另一个工作树的 API 与依赖目录，并会启动独立 Edge 调试进程；当前仅使用源模型测试、构建和 HTTP 路由 smoke。真实网页点击继续单独标记 `NOT_RUN`，不将 HTTP 200 说成视觉验收。

## 3. 禁止范围与停止条件

- 不修改来源工作树，不覆盖主树任何现有页面或未提交现场。
- 不修改 API、数据库、Mini、User Web、配置、依赖、lockfile、`staff.test.ts` 或任何浏览器自动化工具。
- 不接入真实员工/候选人资料、认证、网络服务、文件上传、数据库或持久化。
- 不提交、推送、部署或发布。
- 若主树员工页无法在仅追加调用的方式下保留所有现有模块，或需增加白名单外文件，立即停止并记录原因。

## 4. 验证

- 管理端 TypeScript `--noEmit` 和本地编译。
- G5.3B 模型聚焦测试，以及员工资格、同意复核和隐私申请相关管理端回归测试。
- 目标 ESLint；新文件完整 Prettier，`main.ts` 只格式化本次追加区域。
- 管理端 `/admin/staff` 本地 HTTP 路由 smoke、`git diff --check` 和精确路径审计。
- 实际浏览器点击当前标记 `NOT_RUN`（Browser 控制组件所需运行文件在本机缺失）；微信开发者工具不属于本合同范围。
