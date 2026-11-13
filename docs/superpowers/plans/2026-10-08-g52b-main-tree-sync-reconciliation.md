# TASK20_G52B_MAIN_TREE_BASELINE_RECONCILIATION

**日期：** 2026-10-08
**状态：** `AUDIT_PASS_NO_WEB_ADMIN_SYNC`
**任务类型：** 主工作树基线核对与路线纠偏；仅文档写入。
**依据：** 项目方案 V2.0、当前 `AGENTS.md`、`PLANS.md`、G5.2B 合同和其已通过的 Owner Review。
**G5.2B 原合同：** `docs/superpowers/plans/2026-10-07-g52b-synthetic-ledger-client-presentation.md`，SHA-256 `1B82CB176918D72BF530E11180606D71267D50216B1E3C77FFE818AD5543B046`。

## 本次精确写集

- CREATE `docs/superpowers/plans/2026-10-08-g52b-main-tree-sync-reconciliation.md`
- MODIFY `PLANS.md`
- MODIFY `docs/superpowers/plans/2026-10-08-g6-roadmap-reconciliation-after-g62.md`
- MODIFY `docs/exec-plans/active/project-completion.md`

不修改产品代码、测试、配置、依赖、lockfile 或任何来源工作树文件。不读取受保护的 `apps/mini-program/src/pages/staff.test.ts`。不提交、推送、部署或发布。

## 核对结果

1. G5.2B 的用户网页、管理网页和小程序功能在隔离工作树通过 Owner Review。原合同明确要求复用既有页面，不新增路由，并将主树业务代码同步留给后续阶段。
2. 主树小程序中的 7 个 G5.2B 目标文件与来源工作树内容逐字节一致：客户端及测试、页面模型及共享费用页面测试、模板和两个生成 JS。主树从仓库根目录运行 `node --test apps/mini-program/src/local-synthetic/client.test.ts apps/mini-program/src/pages/shared-fees.test.ts`，18/18 通过。因此本轮无需重写这些小程序文件。
3. 主树 User Web 目前有访客/员工页面和 `/web/parent/binding` 家长授权页面，但没有 `/web/parent/home`、家长账务页或 `src/local-synthetic` 共享客户端目录。来源网页入口依赖这套共享客户端；直接整份复制 `main.ts` 会覆盖主树已有页面和 G6.4 增量。
4. 主树 Admin Web 没有 G5.2B 来源中的 `ReviewClient`、费用汇总呈现模块或 `/admin/fees` 处理分支。来源 `main.ts` 与主树现有成员、文件生命周期、隐私和同意页面有大面积差异，不能整份覆盖。
5. 因此 G5.2B 网页和管理端不能在原“不得新增路由/只同步现有页面”的合同下安全接入。将它们标记为已完成会把“隔离工作树功能通过”误写成“主工作树可见可用”。

## 路线决定

- G5.2B Owner Review 与隔离工作树自动验证仍为通过；微信开发者工具实际点击仍为 `NOT_RUN`。
- 主树同步状态改为 `PARTIAL_MINI_CONTENT_ALREADY_IDENTICAL;WEB_ADMIN_ENTRY_SURFACES_MISSING`。本轮没有声称网页和管理端同步完成。
- 旧 G5.2B 合同保持原样，不对它的“不新增路由”边界作追溯修改。
- 下一目标转为 G6 家长网页/管理网页运行入口的选择性收敛。须先建立新的精确合同，允许补齐主树缺失但已在批准来源中存在的家长首页和费用入口；只合并完成这些页面所需的代码，逐段保留当前主树 `main.ts`。Mini 不再重复同步。

## 验证记录

- G5.2B 原合同 SHA-256：与 `PLANS.md` 一致。
- Mini G5.2B 内容：7 个目标文件哈希一致；focused tests 18/18 通过。
- 路由基线：主树未找到 `/web/parent/home` 与 `/admin/fees` 页面分支，来源工作树存在对应页面实现。
- 本任务文档写集：仅上方 4 个治理文件；`git diff --check` 和路径范围审计在写入后执行。
- 网页/管理端主树流程、浏览器点击及微信原生操作：`NOT_RUN`，因为相关入口尚未接入主树。
