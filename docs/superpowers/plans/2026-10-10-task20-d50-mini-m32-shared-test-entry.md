# TASK20 D50：Mini 通知与健康共享流程测试入口对齐

## 0. 依据与基线

- **任务 ID：** `TASK20_D50_MINI_M32_SHARED_TEST_ENTRY_RECONCILIATION`。
- **目标：** 让通知与健康测试使用当前页面真实的默认共享入口、显式身份选择器和断开方式，完整覆盖现有流程而不改业务代码。
- **诊断证据：** `apps/mini-program/src/local-synthetic/page.ts` 中共享流程默认为启用；注册页的 `onShow` 会监听页面、加载合成身份列表；显式身份选择由 `handleSharedProfile` 处理，选择器第 0 项用于断开连接、实际身份从第 1 项开始。两个聚焦测试仍调用旧 `handleSharedEnable`/不存在的 `handleSharedConnect`，且用旧的零起始数组索引选择身份；测试清理还调用未绑定到页面模板的 `handleSharedOffline`。因此测试无法通过真实入口，身份选项会错位，清理会关闭模块共享模式。页面模板实际绑定身份选择器，没有上述旧连接/断开按钮入口。
- **隔离工作树：** `C:\Users\HU\.codex\worktrees\task20-d46-mini-shared-default-entry`。此树已有其他任务的现场，执行时仅编辑本合同和本节列出的两个测试；其他现场保持原样。
- **主工作树测试基线：** `shared-notice.test.ts` SHA-256 `7C592AC6A7B09A2C1CFE57908F83089019908C32997BA3DE0E10AB3E2EE98FB5`；`shared-health.test.ts` SHA-256 `75258DA04271A8E2BA861B578421FBBDB2541E1C3CA53E22288DC86677DBE861`。两份文件在隔离树初始缺失，将仅复制这两份已知测试作为基线后修改。
- **运行时代码基线：** 根树与隔离树 `src/local-synthetic/page.ts` SHA-256 均为 `E394CDDC3F905DE00D75E3C0984447B4CBEE64BDEDBD641CD566C8CFD0C7F6FF`，生成 `page.js` 均为 `1E481590DE08EC0F2F42F5CBEE66F8139600927B7558A988935E55589D90A7EA`。运行时代码为只读输入，不在本任务写集内。
- **数据边界：** 只用本机合成服务与虚构身份；不读取真实机构或学生资料，不访问外网，不写入真实服务。

## 1. 完成标准

1. 两份测试都从真实页面 `onLoad`、`onShow` 启动，并断言共享模式已打开、身份列表已加载，且页面进入前后的身份与连接状态不变；角色选择使用页面显示的选择器索引。
2. 原有通知创建、退回重提、审核发布、家长查看/确认、撤回与身份隔离断言，以及健康记录创建、审核发布、家长查看/确认、撤回与身份隔离断言全部保留；不得删除、跳过或降低原断言。
3. 两份测试在 TypeScript 源码运行模式通过；若当前隔离树具备与基线匹配的生成运行时，也在生成 JS 模式通过。
4. 不修改产品逻辑、页面模板、生成文件、API、数据库、配置、依赖或 lockfile；`apps/mini-program/src/pages/staff.test.ts` 不读取、不运行、不复制、不修改。

## 2. 精确写集

隔离树仅修改：

- `apps/mini-program/src/pages/shared-notice.test.ts`
- `apps/mini-program/src/pages/shared-health.test.ts`
- `docs/superpowers/plans/2026-10-10-task20-d50-mini-m32-shared-test-entry.md`

选择性同步主工作树仅允许：

- 上述两份测试文件
- 上述任务合同
- `PLANS.md`（记录 D50 结果、状态和下一步）

为测试只读复制的基线输入（不纳入修改或同步写集）：两份测试文件从主工作树复制到隔离树；仅在生成运行模式缺少文件时，可复制 `apps/mini-program/src/local-synthetic/client.js` 到隔离树供只读运行。复制前后核对 SHA-256。运行时共享页源码、页面源码及生成 JS 只读。

其余所有文件均不在写集内。不得清理或覆盖既有工作树现场。

## 3. 步骤

1. 仅复制本节列出的测试基线，核对复制前后哈希，并在当前实现下运行两份测试，确认旧入口调用导致的失败可复现。
2. 仅修改两个测试的页面准备、身份选择与清理步骤：使用 `onShow` 默认入口；对角色数组索引加上页面占位项偏移；清理时通过身份选择器的占位项断开，避免调用未显示的旧处理函数。保留所有业务流程断言。
3. 运行源码与可用的生成 JS 两种测试模式；检查目标 ESLint、Prettier、文件差异、行尾空白及写集。无需编译，因为本任务不改 TypeScript 产品源码。
4. 逐项复核测试数量与原断言范围，核对运行时输入文件未变化，再选择性同步合同、两份测试和 `PLANS.md` 到主树。

## 4. 验收命令

- `node --experimental-transform-types --test apps/mini-program/src/pages/shared-notice.test.ts`
- `node --experimental-transform-types --test apps/mini-program/src/pages/shared-health.test.ts`
- 生成 JS 模式分别设置 `MINI_WORKFLOW_RUNTIME=generated` 后运行以上两条命令（仅当所需生成输入齐备且与主树哈希相符）。
- 使用本机 ESLint、Prettier API 检查两份测试与合同；对任务写集运行 `git diff --check`、尾随空格审计和 SHA/范围审计。

## 5. 执行结果

首次复现：通知测试 `0/4`、健康测试 `0/5`，均因旧 `handleSharedConnect` 缺失而失败。更换为真实入口后确认，初次打开状态为 `IDLE`，而同一流程的页面跳转会保留已明确选择的角色；测试需比较进入前后状态，而非强制每次跳转回到未连接。

最终结果：通知源码模式 `4/4`、健康源码模式 `5/5`；目标两份测试 TypeScript 定向检查、ESLint stdin 检查和 Prettier API 检查通过。原有业务场景与断言保留；改动仅对齐真实入口、选择器索引、身份清理方式及首次流程的显式员工身份选择。

生成 JS 模式未运行：隔离树缺少页面引用图中的 10 个不同生成 JS 模块；补齐它们需要超出只读基线复制范围的广泛产物复制或重新编译，本任务不扩大范围。微信开发者工具未运行。执行后合同 SHA-256、主树精确同步路径和空白/范围审计结果以主树 `PLANS.md` 的 D50 记录为准。M3.2 整体状态仍部分完成，不宣称负责人验收或原生微信验收通过。
