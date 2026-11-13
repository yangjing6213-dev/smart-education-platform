# TASK20 D21 Mini 物资申请跨端流程

- 任务标识：`TASK20_D21_MINI_SUPPLY_REQUEST_INTEGRATION`
- 状态：`PASS_LOCAL_SYNTHETIC_SOURCE_AND_GENERATED`
- 依据：V2 项目方案第 50 页与 V3 G3.4。Mini 固定目录申请、管理端审核和本机共享服务均已存在；尚缺主工作树真实 Mini Page→Admin 真实审核客户端→Mini 领取的同一对象回归。
- 目标：教师经 Mini 页面建立固定目录物资申请并提交；管理端审核通过；教师在 Mini 读取同一申请并登记领取；验证 ID/版本连续、旧版本操作拒绝。
- 基线：`tests/mini-shared-service.test.mjs` SHA-256 `F2297E54ED73897289BCFE3C04393452712A74E0DF245BF50F96A11C74095CDF`；D20 Mini/Admin 日报闭环源码/编译模式通过。
- 构建：运行管理端既有 TypeScript build 后，通过实际 `SupplyRequestReviewClient` 执行审核；`dist` 仅为本机验证产物。

## 精确写集

1. `tests/mini-shared-service.test.mjs`：增加 Mini 物资申请、管理端审核、Mini 领取和旧版本拒绝的跨端用例。
2. `PLANS.md`：记录 D21 控制状态和验证结果。
3. `docs/exec-plans/active/project-completion.md`：追加 D21 证据。
4. `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`：更新 G3.4 验收状态。
5. 本合同。

## 禁止项

- 不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 初始不修改业务源代码、页面、API、数据库、配置、依赖、lockfile 或编译生成产品 JS；如发现产品缺陷，先记录复现并更新合同。
- 不接入真实采购、库存、支付、身份、外网或持久化；不提交、推送、部署或发布。
- 管理端 build 只生成本机 `dist` 验证产物；若必须修改写集外持久化路径，停止并更新合同。

## 验收

- Mini 真实 Page 处理器创建并提交固定目录申请；Admin 实际审核客户端确认同一对象；Mini 真实 Page 处理器领取后显示 `CLAIMED` 和递增版本。
- 过期版本不能产生服务写请求；请求仅发往本机回环。
- Mini 源码/编译模式、管理端供给测试和服务测试通过；Admin build/typecheck、Mini typecheck、ESLint/Prettier、页面注册护栏、`git diff --check` 和范围审计通过；lockfile 不变。

## 实施结果与验证

- Mini quick-action Page 使用固定目录与用途创建物资申请，提交后由 Admin 实际 `SupplyRequestReviewClient` 对同一 ID/版本确认；员工回到 Mini 领取后，管理端历史显示同一条 `CLAIMED` 申请。
- 状态版本为 `DRAFT v1 → SUBMITTED v2 → READY v3 → CLAIMED v4`；提交过期版本的领取动作没有产生 Mini 服务写请求。管理端传输封装确认所有请求仍在本机回环地址。
- Mini 共享服务回归源码/编译页面模式各 8/8；Admin 物资申请测试 12/12；服务本机回环测试 1/1。
- 管理端 build/typecheck、Mini TypeScript、目标 ESLint、Prettier API 格式核验、页面注册护栏与 `git diff --check` 均通过。
- 未发现需修复的产品代码问题；本批只增加回归测试和治理记录，无真实采购/库存/支付、真实身份、外网或持久化，也未改依赖/lockfile。`staff.test.ts` 未读取、运行或修改。
