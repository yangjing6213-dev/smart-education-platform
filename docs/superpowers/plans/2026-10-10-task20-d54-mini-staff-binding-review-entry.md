# TASK20 D54：小程序员工关系审核入口修复

## 目标

修复新版小程序里“家长提交关系申请后，员工不能从工作台直接进入审核”的流程断点。工作台入口应始终可见；点击后直接打开现有快捷服务页的“家长关系”区域。共享身份仍由员工明确选择，申请状态、校区范围和审核权限仍由现有本机合成服务控制。

## 已确认的根因

- 家长新版首页的申请通过共享本机服务提交；员工快捷页也从同一服务读取申请。
- 工作台入口却只看另一套旧本机绑定状态，因此新版家长申请可能不会显示入口。
- 即使旧状态让入口出现，点击只打开快捷服务首页；快捷页默认停在“工作”区域，没有直达家长申请列表。
- 现有 `shared-parent-workflows.test.ts` 已证明家长与员工直接打开共享页面时可以看到同一份申请；本任务把工作台入口接到该现有流程，不另造审核服务。

## 精确写集

- MODIFY `apps/mini-program/pages/staff/workbench/index.ts`
- MODIFY `apps/mini-program/pages/staff/workbench/index.wxml`
- MODIFY `apps/mini-program/pages/staff/workbench/index.js`（仅本任务编译生成且确有变化时）
- MODIFY `apps/mini-program/pages/staff/quick-action/index.ts`
- MODIFY `apps/mini-program/pages/staff/quick-action/index.js`（仅本任务编译生成且确有变化时）
- MODIFY `apps/mini-program/src/pages/staff/quick-action.ts`
- MODIFY `apps/mini-program/src/pages/staff/quick-action.js`（仅本任务编译生成且确有变化时）
- MODIFY `apps/mini-program/src/pages/staff-verticals.test.ts`
- MODIFY `PLANS.md`
- CREATE 本合同

隔离工作树：`C:\Users\HU\.codex\worktrees\task20-d54-mini-staff-binding-entry`。为使隔离树与主树现有 Mini 现场一致，只可把上述实现、测试和生成 JS 文件的当前主树版本复制为本任务起始基线；另可只读复制 `apps/mini-program/src/pages/staff/workbench.ts` 与 `apps/mini-program/src/routes/staff.routes.js` 作为测试导入依赖。以上复制不包括修改主树，也不允许读取、复制或运行 `apps/mini-program/src/pages/staff.test.ts`。

## 禁止范围

- 不读取、复制、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 不修改白名单外文件、`app.json`、页面注册 JSON、项目配置、其他页面、API、数据库、真实认证或伙伴云。
- 不连接真实网络、真实学生或机构数据，不增加持久化，不安装依赖或修改 lockfile。
- 不覆盖、清理或回退主树及其他工作树的现场；不 commit、push、部署或发布。
- 若必须改白名单外路径、出现必须改后端的真实范围问题或需要扩大审核业务规则，停止并记录原因。

## 验收标准

1. 工作台始终提供清楚的“家长关系审核”入口，不依赖与新版家长申请分离的旧状态。
2. 点击入口打开快捷服务的家长关系区域；区域参数经过固定选项校验，未知值回到默认“工作”区域。
3. 员工身份仍需明确选择；无权员工不能审核，机构负责人仅处理现有授权校区范围内的申请。
4. 新增测试先复现“入口被旧状态隐藏/跳转默认工作区”的失败，再证明修复后的行为；既有家长提交与员工审核共享流程回归继续通过。
5. 运行 Mini 精确测试、定向 TypeScript 检查、ESLint、Prettier API、WXML 结构检查；仅在获准的 3 个生成 JS 内容确有变化时更新。运行页面注册护栏、差异检查和精确写集审计。
6. `staff.test.ts` 全程保持未读取、未复制、未运行、未修改。
7. 微信开发者工具桌面人工点击如当前工具无法控制，准确标记 `NOT_RUN`；不把自动化测试描述成原生画面验收或 M3.2 收口。

## 验证方式

- 先对新增的员工入口/区域选择测试运行 RED，确认失败原因对应旧状态门槛或默认区块行为。
- 完成最小页面变更后重跑该测试及 `apps/mini-program/src/pages/shared-parent-workflows.test.ts` 的现有共享流程回归；如需完整生成模式，只显式运行该测试文件，不使用通配符。
- 定向运行 Mini TypeScript 检查、ESLint、Prettier API、页面注册护栏、获准生成 JS 语法检查、`git diff --check` 与文件范围审计。
- 记录主树其他未提交/未跟踪差异保持原样；不报告 Owner Review、原生微信验收或生产安全已通过。

## 当前状态

`PARTIAL_DIRECT_ENTRY_QUERY_NOT_FORWARDED_BY_SHARED_WRAPPER;D55_FOLLOWUP_REQUIRED;WECHAT_NATIVE_NOT_RUN`

## 实施与验证结果

- 工作台现在始终显示“家长关系申请”审核入口，路由地址携带家长关系区域参数；快捷服务只接受 `work`、`records`、`parents`、`services` 四个固定区域值，未知值回到“工作”。员工身份选择、已有校区范围和审核权限保持原样。
- 按测试先行完成：实现前新增的两条入口测试按预期失败；修复后隔离工作树测试 `6/6` 通过。选择性同步后，主工作树定向回归 `12/12` 通过，覆盖关系申请共享状态、员工审核、权限拒绝及工作台直达入口。
- 定向 TypeScript 检查（共享 quick-action/workbench 模块、staff 路由和页面测试）通过；定向 ESLint `4` 个 TypeScript 文件通过；Prettier API 检查 `4` 个 TypeScript 文件通过。WXML 不受当前 Prettier parser 支持，结构由页面测试断言覆盖。
- 对页面源码及其完整导入链进行的额外 TypeScript 检查发现 `7` 条既存错误，均在本合同写集之外的 `src/local-synthetic/client.ts` 与 `src/local-synthetic/page.ts`；D54 写集中的页面源码没有 TypeScript 诊断。完整 Mini 项目检查没有运行，因为现有 `tsconfig.json` 会纳入合同明令禁止读取或运行的 `src/pages/staff.test.ts`。
- 微信开发者工具 CLI 没有独立的本地编译命令。本轮用已安装 TypeScript 的 ES2022/CommonJS 转译，仅更新了本合同许可的三个生成 JS；三个 JS 的 Node 语法检查通过。页面注册护栏（要求注册页面有生成 JS）通过，范围限定差异检查通过。微信开发者工具桌面实点与视觉验收为 `NOT_RUN`，没有将自动化结果称为原生验收。
- 主树同步前核对了八个目标文件的基线 SHA-256；仅逐文件同步与主树基线不同的八个许可路径。无依赖、lockfile、配置、业务范围或远端操作；`staff.test.ts` 未读取、复制、运行或修改。
- 同步后复核发现：共享服务包装器在启用共享模式时跳过原页面 `onLoad`，因此工作台传入的 `section=parents` 没有被页面消费，实际仍停留在默认“工作”区。D54 原测试只覆盖页面解析函数和静态路由，没有覆盖共享包装器下的真实 Page 入口；所以 D54 的本机功能闭环状态调整为 `PARTIAL`，由 D55 增补运行时回归并修复。
