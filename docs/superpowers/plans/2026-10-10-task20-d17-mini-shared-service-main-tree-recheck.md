# TASK20 D17 Mini 主工作树共享流程本机回归复核

- 任务标识：`TASK20_D17_MINI_SHARED_SERVICE_MAIN_TREE_RECHECK`
- 状态：`PASS_LOCAL_SYNTHETIC_SOURCE_AND_GENERATED`
- 目的：复核主工作树内 Mini 真实页面事件处理器与本机共享服务在源码和编译页面两种模式下的协作，确认 G2.1/G2.2/G3 相关已接入流程仍可用。
- 测试文件：`tests/mini-shared-service.test.mjs`，SHA-256 `F5B0A3124EDF217E77224A52F993EDD2372607A9397AB3286C121F94A614EBC7`
- 服务来源：`C:\Users\HU\.codex\worktrees\task20-local-shared-core`
- 执行根目录：`C:\Users\HU\Documents\student-care-saas-platform`

## 写集

本任务为验证与治理记录批次，不修改产品代码或测试。只更新：

1. `PLANS.md`
2. `docs/exec-plans/active/project-completion.md`
3. `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
4. 本合同

## 验证结果

在 PowerShell 设置 `LOCAL_SYNTHETIC_CORE_ROOT=C:\Users\HU\.codex\worktrees\task20-local-shared-core`，然后运行 `corepack pnpm test:mini-shared-service`：

1. 源码模式：5/5 通过。
2. 设置 `MINI_SHARED_RUNTIME=generated` 后，同一命令复跑：5/5 通过。
3. 覆盖绑定审核、请假退回/重提/确认与家长回执、成长记录确认发布与独立家长知悉、月反馈和来源失效，以及资源列表/收藏/最近使用范围。
4. 测试启动临时回环服务，页面请求只发往该本机服务；服务退出后关闭。未访问外部服务、未持久化真实数据。
5. Node 提示主工作树 `package.json` 未声明模块类型；这是性能提示，不影响两种模式的测试结果。本任务未更改该配置。

本任务期间受测页面及测试指纹未改动：

- `apps/mini-program/pages/staff/quick-action/index.ts`：`86FD97698A026BF3E20D4245E69DB518A47394C9CAAA25F8FDFF78A173019C16`
- `apps/mini-program/pages/staff/quick-action/index.js`：`ED18580BFC7A6ACC19C943CD60C98B1BA9B652B7CCF016C8E6B5B85C57910A4C`
- `apps/mini-program/pages/parent/home/index.ts`：`7D98B8449051F9354FE548C1975C2B3DF58BC01C978D1404692E9C066CF5466E`
- `apps/mini-program/pages/parent/home/index.js`：`99A5B764D3F5A0DFEB1447F6C58272626C27C9D91E1F10908E14CB5FA564D77F`

这只验证上述自动化覆盖的本机合成流程，不等于全部 Mini 页面验收、微信开发者工具实点、负责人验收或真实服务可用。`staff.test.ts` 未读取、运行或修改。
