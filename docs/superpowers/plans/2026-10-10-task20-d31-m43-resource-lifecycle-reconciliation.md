# TASK20 D31：M4.3 教学资源生命周期证据与状态核对

## 目标

对照 V3 M4.3，复核 User Web、Admin Web、Mini 与本机共享服务现有的教学资源搜索/筛选、范围过滤、详情、版本/来源/有效期、收藏/最近使用、撤回/过期拒绝。纠正计划表中的“待实施”旧状态，但不得把本地合成实现写成真实教材、外部文件或生产服务验收。

## 精确写集

- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 本合同

## 允许与禁止

- 只读复核现有 M4.3 页面、服务和相邻测试；允许运行 API 资源范围、User Web 资源页面、Mini 资源客户端与实际页面流程、Admin 资源浏览器流程的既有测试。
- 本任务只允许修改上列治理文件。若发现真实产品缺陷，先记录确切复现和影响，再建立下一份精确写集实现合同，不在此合同内改业务代码或测试。
- 禁止读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`；不接真实资料、外链、身份、数据库、伙伴云或 AI；不安装依赖、不改 lockfile；不提交、推送、部署或发布。

## 验收

1. API 资源服务对租户/校区/班级、过期/撤回、版本与管理权限的负测通过；家长/教师客户端只显示当前授权范围。
2. User Web、Mini 和 Admin 的既有资源页面/流程测试通过；Mini 操作只读取本机共享服务，不使用持久化或外部资源。
3. 明确当前本地实现覆盖面、未验证的浏览器/微信原生步骤，以及 Owner Review 状态；不得混淆“路线图待办”与“代码尚未实现”。
4. 仅治理写集有差异；Markdown Prettier API、`git diff --check`、SHA-256 和路径审计通过。

## 执行记录

- **API：** `apps/api/dist/test/local-synthetic-resource-library.test.js` `6/6`，覆盖对象范围、固定字段、收藏/最近使用、撤回和平台匿名摘要。
- **User Web：** `apps/user-web/dist/pages/resources.test.js` `3/3`，搜索/筛选/范围字段、详情与安全内容、断连拒绝通过。
- **Mini：** `apps/mini-program/src/local-synthetic/client.test.ts` 资源客户端测试 `1/1`；`tests/mini-shared-service.test.mjs` 快捷页实际 Page 操作测试 `1/1`，覆盖当前授权目录、查看、收藏和使用记录。
- **Admin：** `apps/admin-web/test/resource-library.test.mjs` 本机浏览器流程 `PASS`；更新范围/有效期及版本、教师收藏/最近使用、撤回后清除投影、平台端只显示匿名总数。页面错误、失败响应、外部请求均为 `0`。
- **结论：** V3 M4.3 的本地合成实现已经存在，原表“待实施”是过期记录。本轮只核对证据，不修改业务代码或测试。G3.5 Owner Review 仍 `PENDING`，Mini 微信开发者工具原生视觉/点击仍 `NOT_RUN`；不接真实教材、附件或外链。
- **结果：** `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_AND_MINI_NATIVE_REVIEW`。下一目标转为核对 M5.1 分层提示在三端的当前实现和状态记录。
- **治理验证：** `PLANS.md` 的 M3.3–M6.3 状态表、D31 新增记录、本合同及两份活动计划新增段落均通过 Prettier API 核验；`git diff --check`、精确路径与合同 SHA 核对通过，lockfile 未改。
