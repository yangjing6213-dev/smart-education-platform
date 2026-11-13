# TASK20 G5.4 平台租户、套餐配额与支持概览合成实施合同

**状态：** `LOCAL_IMPLEMENTATION_VERIFIED_PENDING_OWNER_REVIEW`  
**日期：** 2026-10-08  
**项目权威：** `C:\Users\HU\Desktop\同芯机构项目\开发方案\student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。路线图 G5.4 对应平台租户开停用、套餐/配额、支持事项，以及匿名化成本和安全汇总；平台管理员默认不查看学生明细。  
**授权依据：** `PLANS.md` 当前自主执行控制面，用户已明确取消普通本地阶段逐项授权，要求持续完成项目；本合同只覆盖合成页面与验证，不代表负责人验收或真实运营授权。

## 1. 目标与边界

在隔离 Admin 工作树新增“平台运营”页面，展示固定虚构租户的开通状态、套餐/用量上限、支持事项，以及不关联个人或学生的合成成本/安全汇总。授权模式下仅可手动切换固定状态、固定套餐/配额和支持事项阶段；只读模式禁用修改，无权模式沿用现有拒绝页。全部变更只保存在内存，刷新恢复固定样例。

- 页面明确标记“合成数据/本地演示”，不得声称真实租户已开通、停用、收费或处理了支持请求。
- 仅使用固定虚构的租户代号、套餐、配额、支持分类和状态；不录入姓名、联系方式、真实租户标识、自由文本或客户提交内容。
- 成本与安全内容只显示预置的聚合演示数字，不连接日志、模型、费用系统或真实安全事件，也不提供学生、家长、员工的明细或可反查标识。
- 状态和配额由页面使用者手动维护；不自动封禁、判定风险、限制真实服务或作出商业/个人权益结论。
- 不接入真实认证、API、数据库、伙伴云、正式 AI、网络服务或浏览器持久化，不新增依赖。

## 2. 精确写集

隔离工作树：`C:\Users\HU\.codex\worktrees\task20-admin-completion`  
分支：`codex/task20-admin-completion`  
基线 HEAD：`bd0001faa8e2fd7bbabe86e3d778ba24431107e8`  
本任务开始时 `apps/admin-web/src/main.ts` SHA-256：`A42672396E78DE8AECAD271F92321973D00AF6AECF107EF3C53AC9690993A5BC`。
既有本地预览器 `apps/admin-web/preview.mjs` SHA-256：`08B46F1A5979B8914DE3AB196A3E67975A5BFD4A887BDD4CF9B195AD4CD618A6`；为让白名单内的新路由可在本地浏览器验证，只能在其页面清单中新增这一条路由。

仅允许本任务以下增量：

- CREATE `apps/admin-web/src/local-synthetic/platform-operations.ts`
- CREATE `apps/admin-web/src/pages/platform-operations.ts`
- MODIFY `apps/admin-web/src/main.ts`：只增加本页面的导航入口、内存 store、导入和路由接入
- MODIFY `apps/admin-web/preview.mjs`：只在本地预览页面清单中注册 `/admin/platform-operations`
- CREATE `apps/admin-web/test/platform-operations.test.mjs`
- CREATE `apps/admin-web/test/platform-operations-browser.mjs`

实施前已存在的其他 Admin、Core、Web、Mini 修改和未跟踪文件均为受保护现场；不得读取无关文件内容、覆盖、清理或纳入本任务。`apps/admin-web/test/staff-credentials.test.mjs` 的既有 SHA-256 为 `4982E532FE5ED370EC3D36A529B6C37F1C025D844260E89F0060B6E7BFC9DD00`，必须保持不变。

主工作树治理写集：

- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- CREATE 本合同 `docs/superpowers/plans/2026-10-08-g54-platform-tenant-quota-support.md`

禁止修改白名单外路径，禁止整合至主工作树产品代码、安装依赖、修改 lockfile、提交、推送、部署或发布。

## 3. 实施顺序

1. 先新增模型测试并运行，确认固定租户/套餐/配额的有效更新、无效字段拒绝、版本冲突、支持事项人工流转，以及聚合信息不含学生/个人明细。
2. 实现最小内存模型和页面组件，接入既有 Admin 导航；检查授权、只读、无权三种页面表现。
3. 用本地浏览器实际点击导航、修改固定配额/状态、流转支持事项，并验证只读/无权、刷新重置、无浏览器存储和无外部请求。
4. 运行 Admin 类型检查与构建、聚焦测试、浏览器复核、ESLint、Prettier、`git diff --check` 和精确写集审计；只整理本任务文件。

## 4. 验收标准

- 租户样例仅显示虚构代号；可手动调整固定套餐/配额与启用状态，并保留本地版本历史。
- 支持事项仅显示预设分类和合成编号，可手动更新固定处理阶段；无客户原文、回复框或个人联系方式。
- 成本/安全面板只呈现独立预置的聚合数字；页面与测试均不包含学生/家长明细、姓名、电话或可反查信息。
- 只读时所有写操作禁用；无权时不显示平台运营明细；过期版本写入失败且不改变状态。
- 页面刷新恢复固定样例；新增模块不访问网络、浏览器存储或后端。证据只表示本地合成通过，负责人验收、主树产品同步和真实运营仍未完成。

## 5. 验证命令

在隔离工作树运行：

```powershell
node node_modules/typescript/bin/tsc -p apps/admin-web/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p apps/admin-web/tsconfig.json
node --test apps/admin-web/test/platform-operations.test.mjs apps/admin-web/test/staff-credentials.test.mjs
node apps/admin-web/test/platform-operations-browser.mjs
node node_modules/eslint/bin/eslint.js apps/admin-web/src/local-synthetic/platform-operations.ts apps/admin-web/src/pages/platform-operations.ts apps/admin-web/src/main.ts apps/admin-web/preview.mjs apps/admin-web/test/platform-operations.test.mjs apps/admin-web/test/platform-operations-browser.mjs
node node_modules/prettier/bin/prettier.cjs --check apps/admin-web/src/local-synthetic/platform-operations.ts apps/admin-web/src/pages/platform-operations.ts apps/admin-web/preview.mjs apps/admin-web/test/platform-operations.test.mjs apps/admin-web/test/platform-operations-browser.mjs
git diff --check
```

## 6. 停止条件

若实现需要白名单外路径、真实租户/学生/家长/员工资料、真实身份认证、服务端/API/数据库/伙伴云、持久化或新依赖，应停止该部分并记录原因。若页面无法与现有 Admin 入口安全共存，或无权访问仍可见平台明细，停止继续尝试并报告，不得放宽权限断言。
