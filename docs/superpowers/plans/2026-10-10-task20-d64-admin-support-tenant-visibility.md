# TASK20 D64：管理端支持事项显示所属机构

**状态：** `CONTRACT_READY`
**目标任务：** `TASK20_D64_ADMIN_SUPPORT_TENANT_VISIBILITY`
**日期：** 2026-10-10
**依据：** PDF v2.0、V3 M6.1/M6.2、D62 管理端范围审计与 D63 支持事项租户关联。
**授权依据：** 负责人已明确要求执行者自主继续本地开发；本任务只让既有平台支持事项的模拟租户关系可见并加页面验证。

## 1. 目标与边界

D63 已为账号支持和配额咨询记录增加固定模拟租户编号，但当前管理端卡片只显示事项编号、类别和状态，工作人员无法从画面识别由哪家模拟机构提出。每张支持事项卡片应增加“所属机构：模拟机构名称”一行，通过 `supportCase.tenantId` 与同页租户目录匹配；找不到匹配项时显示“机构关联缺失”，不得猜测或显示其他租户。

只使用现有虚构机构资料，不添加真实工单、个人信息、网络请求或持久化；不改变处理状态、只读/拒绝权限及租户套餐流程。不修改模型、路由、API、Mini、User Web、依赖、lockfile、生成构建输出，不提交、推送、部署或发布。受保护的 Mini 测试保持未读取、未运行、未复制、未修改。

## 2. 精确写集

隔离实现工作树使用已有 `C:\Users\HU\.codex\worktrees\task20-d63-admin-object-scope`；该树保留 D63 范围模型。实施前将主树当前平台运营页逐文件哈希核对后复制到隔离树；目标缺失时才复制，目标存在且哈希不同时停止。

- MODIFY `apps/admin-web/src/pages/platform-operations.ts`
- CREATE `apps/admin-web/test/platform-support-tenant-visibility.test.mjs`

主树选择性整合仅限以上两个路径，另可修改 `PLANS.md`、`docs/exec-plans/active/project-completion.md`、`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 和本合同。已有的 `platform-operations.test.mjs` 不改。

## 3. 实施顺序

1. 在隔离树先增加页面回归断言，验证支持事项卡片按租户编号显示匹配的模拟机构，并明确缺失关联时显示错误状态；先运行确认失败。
2. 在支持事项卡片中查找对应租户目录项，展示其固定名称；未匹配时显示“机构关联缺失”。不改租户来源和状态更新逻辑。
3. 对隔离树页面做内存 TypeScript 编译，并用现有 TypeScript API 在内存中执行页面模块的假 DOM 渲染检查，确认两种机构均显示正确、缺失关联不串到其他租户；运行专用 Node 测试、ESLint、Prettier API 与范围检查。
4. 哈希核对后仅同步两条代码/测试路径，在主树运行专用测试、Admin TypeScript `--noEmit`、ESLint、Prettier API、`git diff --check` 与精确范围审计。不执行会写入 `dist` 的构建。

## 4. 验收标准

- 两张种子支持事项卡片分别显示 `模拟机构一号`、`模拟机构二号`，匹配关系依据 `tenantId` 而不是数组顺序或硬编码卡片位置。
- 若关联租户不存在，卡片显示“机构关联缺失”，不会回退到其他机构名称。
- 既有固定状态、版本冲突、只读模式和合成数据边界不变。
- 专用测试先红后绿；假 DOM 运行复核、Admin 类型检查、ESLint、Prettier API、差异检查和范围审计通过。
- 只修改第 2 节白名单；不生成构建文件、不触及任何外部服务。

## 5. 停止条件

若隔离页出现不同哈希的既有内容、需要修改白名单外路径、要新增依赖/生成文件/外部服务，或需要改租户角色权限，停止并记录原因，不扩大范围。
