# TASK20 G3.6 管理端主工作树选择性整合

**状态：** `PARTIAL_LOCAL_SYNTHETIC;LIVE_RESTART_BLOCKED_BY_TOOL_POLICY`

**目标：** 将已完成并通过负责人复核的 G3.6 合成运营统计管理页面接入当前主工作树，同时保留主树较新的 Admin 功能和现有未提交现场。

**依据：** 用户已授权我自主推进剩余项目开发；G3.6 原实施合同 `docs/superpowers/plans/2026-10-07-g36-operational-statistics.md`（SHA-256 `51BA316895AB93B840C0259BC8ECF62DA62E1DBA9725480410C1A22EDE159C1F`）及 2026-10-07 Owner Review `PASS`。原 G3.6 合同记录主树同步未执行；本合同仅补充该后续整合写集，不改统计定义和权限范围。

**技能流程：** 已由 Superpowers 选择流程并由 `long-horizon-development` 判定为 Lightweight；本批复用现有 G3.6 页面，不重启设计流程。先运行页面行为测试，再接入实现，最后执行 focused tests、类型检查、构建、Lint、格式、浏览器 smoke 与范围审计。

## 范围与写集

来源工作树只读：`C:\Users\HU\.codex\worktrees\task20-admin-completion`。只选择 G3.6 统计页面增量；不得整份复制来源 `main.ts`、`preview.mjs` 或首页文件。

- CREATE `apps/admin-web/src/local-review/statistics.ts`（适配主树现有结构；只保留统计所需的本地合成角色定义）
- CREATE `apps/admin-web/test/statistics.test.mjs`
- CREATE `apps/admin-web/test/statistics-browser.mjs`
- CREATE `apps/admin-web/src/local-proxy.mjs`（仅允许统计页面所需的本机路由）
- MODIFY `apps/admin-web/src/main.ts`（只追加统计页导入、只读传输、导航入口与路由生命周期；保留现有页面及行为）
- MODIFY `apps/admin-web/preview.mjs`（只为本机统计预览增加受限 `/local/` 转发；保留现有静态路径检查）
- MODIFY `apps/admin-web/index.html`（只为统计页添加局部样式，不影响其他管理页面）
- MODIFY `apps/api/src/local-synthetic/server.ts`（只修正统计筛选 GET 的 CORS 预检参数核验；真实 GET 与其他接口规则不变）
- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY 本合同记录实施结果
- 允许验证命令生成被忽略的 `apps/admin-web/dist/**`、`apps/api/dist/**` 编译输出；不纳入产品写集。

## 产品和安全约束

- 只使用现有本机合成统计 API；机构负责人只见当前会话授权范围、31 天内日期/班级汇总和不含学生身份的来源编号；平台管理员只见匿名分类总量。
- 客户端不得指定或伪造租户、校区、班级或权限；管理统计页面只能读取，不能新增或变更记录。
- 新增的 Admin 本机转发仅支持 `POST /local/sessions`、`GET /local/session`、`GET /local/statistics`、`GET /local/statistics-summary`；仅回环地址；拒绝伪造范围参数和转发身份头。
- 管理端在本机启动入口下直连统计 API 时，带日期/班级筛选的 `GET` 会触发浏览器预检；预检只允许统计 API 已支持的筛选参数，不放宽实际 GET 的校验。
- 不新增 API 能力、Mini/User Web 行为、依赖或业务数据；不读取或修改 `apps/mini-program/src/pages/staff.test.ts`。

## 验收与验证

1. 页面模型测试覆盖校区范围统计、日期/班级筛选、来源编号、平台匿名视图、无权和断线清空。
2. 浏览器 smoke 覆盖从机构概览进入统计页、负责人筛选、空结果、另一校区隔离、平台匿名视图；本机统计筛选预检成功；页面错误、失败响应、外网请求为 0。
3. Admin/API TypeScript、focused tests、ESLint、目标文件 Prettier、`git diff --check`、HTTP 静态路由 smoke 与精确写集审计通过。`apps/admin-web/src/main.ts` 整文件 Prettier 检查单独记录；不为修复既有格式差异而重排整份文件。
4. 本机演示服务的重启若受工具策略阻止，应如实记录为未执行；不得尝试绕过该策略。隔离浏览器测试启动独立本机 API 与预览服务，不依赖常驻服务。

## 实施结果（2026-10-08）

- 统计 API 的实际 `GET` 参数和权限规则未变；只让 `/local/statistics` 的 `GET` 预检携带既有日期、校区、班级筛选参数通过，其他范围参数仍拒绝。新增浏览器回归先复现旧代码 `400`，修复后断言预检 `204`、伪造 `tenantId` 仍 `400`。
- PASS：Admin/API TypeScript 检查与构建；Admin 统计模型测试 `3/3`；API 统计服务测试 `4/4`；实际预览浏览器流程；ESLint；目标代码/HTML/合同文件及执行记录 Prettier；`git diff --check`。浏览器报告 `pageErrors=[]`、`failedResponses=[]`、`externalRequests=[]`，并验证手机宽度无横向溢出、校区范围和平台匿名总数。
- PARTIAL：当前常驻演示进程仍载入修复前的 API 代码，无法在本轮自动刷新。已获准的停止/重启动作被工具策略拒绝；未尝试其他停止进程的方法。新建的隔离浏览器实例加载已编译代码并通过。
- 格式与工具环境：仓库要求 pnpm `>=11.22.0`，当前为 `11.19.0`；未安装或升级依赖，改用仓库已有 TypeScript 编译器执行检查和构建。当前 `main.ts` 与 `PLANS.md` 整文件 Prettier 检查失败；`main.ts` 的 Git HEAD 基线格式通过，G3.6 代码段已按格式器输出核对；本轮开始前 `PLANS.md` 已有 1184 行未提交增量，本轮只做精确治理字段更新。为保留既有现场，没有对这两个整文件进行格式化重写。
- 结论：业务代码与自动验证已选择性整合；只有已打开的常驻演示实例刷新未完成，需在原本机演示窗口关闭后重新启动，才能复核该实例使用新 API 代码。

## 停止条件

如果统计 API 在主树缺失、页面需要读取学生身份/事件正文、需要修改写集外业务文件、扩大转发权限、安装依赖或接入外部服务，停止并记录原因。不得提交、推送、部署、上传或发布。
