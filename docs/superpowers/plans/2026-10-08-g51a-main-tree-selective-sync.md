# TASK20 G5.1A 成员管理主工作树选择性接入

**状态：** `IN_PROGRESS`
**授权依据：** 用户已明确要求由助手全权推进本项目后续本地开发，并指示进入下一步。本合同限定为已完成 G5.1A 合成成员生命周期的主工作树 Admin 页面接入，不代表负责人 Owner Review。
**来源：** `C:\Users\HU\.codex\worktrees\task20-admin-completion`，只读；原 G5.1A 合同为 `docs/superpowers/plans/2026-10-07-g51-local-synthetic-membership-lifecycle.md`。
**目标基线：** 主工作树 HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。开始前 `apps/admin-web/src/main.ts` 已有其他已完成批次的未提交改动；只允许在既有员工管理页和启动 URL 的最小范围内增量修改，必须保留全部既有内容。

## 目标

把固定合成数据的同校区员工成员查看、停用、恢复、撤销和状态记录接入主工作树 `/admin/staff`。沿用主树已存在的本机合成 API，不复制来源工作树整份入口或资格材料模块；每个状态变更携带当前版本，拒绝过期页面写入。浏览器请求只能访问明确允许的 `127.0.0.1` 本机服务端口与成员相关路径。

## 精确写集

- MODIFY `apps/admin-web/src/main.ts`：只增量导入成员模块，在现有 `/admin/staff` 页面追加成员面板、状态操作及页面离开后的异步回调保护；保留已有证照、材料、招聘、员工运营等区块。
- CREATE `apps/admin-web/src/local-review/membership-management.ts`：仅成员管理客户端、合成成员数据校验、同校区范围校验、版本化状态操作、受限本机传输和 HTML 呈现；不得复制资格材料实现。
- CREATE `apps/admin-web/test/membership-management.test.mjs`：覆盖本机路径白名单、错误端口/外部地址拒绝、负责人读取、非负责人拒绝、同校区成员呈现、状态操作版本参数、冲突反馈及 HTML 转义。
- MODIFY `scripts/start-local-demo.mjs`：给 Admin 入口附加当前本机合成服务端口参数，保留既有 `mediaServicePort` 行为和启动流程。
- MODIFY `tests/local-synthetic/demo-launcher.test.mjs`：验证 Admin 启动地址包含正确本机服务端口，且已有启动器行为保持不变。
- MODIFY `PLANS.md`：记录本合同、精确路径、状态、验证、Owner Review 未宣称及下一目标。
- MODIFY `docs/superpowers/plans/2026-10-08-g6-roadmap-reconciliation-after-g62.md`：仅更新 G5.1A 主树同步证据和剩余路线，不改 V3 冻结计划。
- CREATE 本合同文件。

TypeScript 编译允许更新忽略的 `apps/admin-web/dist/**`；不得把编译产物作为交付文件。测试运行时临时文件必须位于操作系统临时目录并在退出时清除。

## 实施边界

- 只用本地预置的虚构机构、校区、岗位、成员和状态；不调用真实身份、真实数据、数据库、存储、伙伴云、外部服务或正式 AI。
- API、共享 contracts/auth、Mini、小程序受保护测试、User Web、配置、依赖和 lockfile 均不属于本批写集。
- 主工作树已有大量未提交现场。不得整份覆盖 `main.ts`，不得读取 `apps/mini-program/src/pages/staff.test.ts` 内容，不得删除、暂存或清理任何不在本批写集内的路径。
- 不安装依赖，不 commit、push、部署、上传、发布或执行外部写入。

## 验收与验证

1. 按 TDD 先写可执行行为测试，证明本机传输限制和版本化状态更新行为；至少一个新测试须在实现完成前以预期失败证明缺口。
2. 运行 Admin 定向测试和统一启动器定向测试；运行 Admin `tsc --noEmit` 与 build、目标 ESLint、Prettier、新增路由静态 smoke。
3. 运行已存在的 API 成员状态/版本冲突聚焦测试，复核 API 契约与 Admin 请求体一致；不修改 API 代码。若编译后测试因既有仓库根路径计算错误无法加载 Fastify，不修改本批写集外的 API 测试文件，改由本批统一启动器测试对真实本机 API 完成员清单、版本化更新和过期版本 409 的端到端覆盖，并如实记录原测试失败原因。
4. 执行 `git diff --check`、逐路径写集审计和构建产物排除检查。对 `main.ts` 只格式化本次新增片段，避免重写已有现场。
5. 由独立复核检查权限范围、请求地址限制、版本冲突行为、既有页面共存和写集；没有自动浏览器控制器时，手动浏览器点击及 Owner Review 必须标记 `NOT_RUN`/`PENDING`，不得冒称通过。

## 停止条件

如果本地服务端口无法安全传入、主树 API 与版本契约不匹配、页面集成必须改写现有业务区块、必须修改本合同写集外文件，或发现跨机构/校区访问风险，停止对应部分并记录原因；不得扩大范围、放宽测试或覆盖既有现场。
