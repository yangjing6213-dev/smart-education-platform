# TASK20 G5.4 平台运营合成页面主树选择性整合合同

**日期：** 2026-10-08  
**自主执行依据：** 用户已要求由助手持续完成剩余本地开发；本合同只界定本批次精确写集。  
**来源实施合同：** `docs/superpowers/plans/2026-10-08-g54-platform-tenant-quota-support.md`，SHA-256 `470DC718FC52EFF6C50559CDC5C50914E251AAEED129C333F904B468EF4BD62D`。  
**来源工作树：** `C:\Users\HU\.codex\worktrees\task20-admin-completion`，本批只读。

## 1. 目标

把 G5.4 固定虚构租户、套餐/配额、支持事项和匿名汇总的本机演示页面选择性接入主树 Admin。状态只保存在页面内存，不访问网络、服务端或浏览器存储；只读/无权模式保持禁改与现有拒绝页行为。

## 2. 实施前记录与精确写集

- 主树 `apps/admin-web/src/main.ts` 基线 SHA-256：`8D7CFD0ADCD8CDEEBBF4A6C4E120827051B18B98DB6BDC5C4F108DBE6746D690`。
- 来源模型 SHA-256：`3EE4F6767356190563302BCB46889F32AB604307692A748B18B203C6C2642792`。
- 来源页面 SHA-256：`1AE439C4D1E70BBE715FDA8ED3544F5757F9594F59CD564C2FA6B38BEEEE8D32`。
- 来源模型测试 SHA-256：`C384B64D43D044651BAA8C30EB4C226C8CAAE562E4DD7E0F0B806CC7D9E63166`。
- 上述三个新文件在主树实施前均不存在。主树 `preview.mjs` 已把所有 `/admin/...` 请求映射到 Admin 页面，故不需要更改它。

主树仅允许以下变更：

- CREATE `apps/admin-web/src/local-synthetic/platform-operations.ts`。
- CREATE `apps/admin-web/src/pages/platform-operations.ts`。
- CREATE `apps/admin-web/test/platform-operations.test.mjs`。
- MODIFY `apps/admin-web/src/main.ts`：仅添加页面/模型导入、一个固定内存 store、导航入口、平台运营渲染函数和对应路由；不得整份复制来源文件或重写既有导航、权限处理。
- MODIFY `PLANS.md`：记录本合同、实际结果、验证证据与仍未完成的验收门槛。
- CREATE 本合同文件。

不复制来源 `main.ts`、`preview.mjs` 或浏览器控制脚本。主树已有页面入口与本地预览配置不同；全文件覆盖会丢失既有家长隐私、员工资格和工作材料功能。浏览器控制运行时缺失，本批只做自动化和 HTTP 路由验证，手动视觉验收继续标记 `NOT_RUN`。

## 3. 禁止范围与停止条件

- 只用合同描述的合成租户与聚合数据；不得录入或引入真实租户、人员、学生、成本、安全事件或客户支持内容。
- 不接入真实认证、网络、API、数据库、伙伴云、AI、文件或浏览器持久化；不新增依赖。
- 不修改 API、Mini、User Web、配置、锁文件、受保护 `staff.test.ts`、来源工作树或其他主树文件。
- 不提交、推送、部署或发布。
- 若实现需要写集外路径、无法保留主树当前入口与权限控制，立即停止并记录。

## 4. 验收与验证

- 先运行既有模型测试，确认预期的“缺少模块”失败，再同步模型/页面/测试并接入主树。
- 管理端 TypeScript no-emit 与编译通过；G5.4 聚焦测试和员工相关回归通过。
- 对新增代码运行 ESLint/Prettier，`main.ts` 仅检查并格式化本次追加片段；`git diff --check` 与精确路径审计通过。
- 本地 `/admin/platform-operations`、主入口脚本及新页面脚本 HTTP smoke 成功。HTTP 结果不等于页面点击或视觉验收。
- 人工浏览器点击因控制运行时缺失继续 `NOT_RUN`；负责人验收、提交、推送、部署和发布均不在本批完成声明内。
