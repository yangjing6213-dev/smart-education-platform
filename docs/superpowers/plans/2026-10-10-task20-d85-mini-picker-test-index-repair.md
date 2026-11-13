# TASK20 D85：修复 Mini 共享身份选择测试索引

## 目标

修复 D84 在主工作树复现的两项 Mini 安全测试失败。页面身份选择器在 profile 列表前放置“请选择示例身份”占位项，测试辅助函数却直接传入 profile 的零起始数组索引，导致选择空身份。本任务只调整两份测试辅助函数，使其按页面 picker 的显示索引选择实际 profile，并在 profile 缺失时明确失败。

## 基线证据

- 当前工作树：`C:/Users/HU/Documents/student-care-saas-platform`，HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。
- D84 合同：`docs/superpowers/plans/2026-10-10-task20-d84-main-mini-safe-suite.md`；SHA-256：`A3ED6BA16D741750C78F862DDDA0D3ECEDACE7658574E95E77E14EFD5EE1D470`。
- `apps/mini-program/src/local-synthetic/attendance.test.ts` 基线 SHA-256：`AA1CCA6CCEB51ED5FFBBAEB995122DDEA4055304E560DB9940B9AD6E616FFF59`。
- `apps/mini-program/src/local-synthetic/multi-student.test.ts` 基线 SHA-256：`CD813A823A4E174209861D600F2DB042B4AB3F334633015998322C7A62D50351`。
- D84 全量主树安全测试：32 个文件、226 项、224 通过/2 失败；两个失败文件单独重跑为 6 通过/2 失败。
- 故障定位：页面选项索引 0 为占位项，真实 profile 的 picker 值为 `findIndex(...) + 1`。D85 不修改页面业务逻辑。

## 精确写集

- CREATE：`docs/superpowers/plans/2026-10-10-task20-d85-mini-picker-test-index-repair.md`。
- MODIFY：`apps/mini-program/src/local-synthetic/attendance.test.ts`，仅修正本地 `profile` 测试辅助函数。
- MODIFY：`apps/mini-program/src/local-synthetic/multi-student.test.ts`，仅修正本地 `profile` 测试辅助函数。
- MODIFY：`PLANS.md`，记录 D84 结果、D85 状态和验证结果。
- MODIFY：`docs/exec-plans/active/project-completion.md`，同步 D84/D85 记录。

不得修改业务源码、WXML/WXSS、页面注册、JS 生成产物、配置、依赖或 lockfile；不得读取、运行、编译、复制或修改 `apps/mini-program/src/pages/staff.test.ts`。

## 实施与验证

1. 保持测试先行：D84 的两项真实失败作为 RED 证据；仅对两个测试辅助函数做最小更新，先断言 profile 存在，再传入 `index + 1`。
2. 使用与 D84 相同的 `LOCAL_SYNTHETIC_CORE_ROOT=C:\Users\HU\.codex\worktrees\task20-local-shared-core`，用 `node scripts/mini-safe-test-runner.mjs` 运行上述两个明确文件，确认原失败消失。
3. 重新运行 Mini `src` 下所有测试文件，运行前断言清单恰为 32 个且不含受保护路径；并行度为 1。继续使用同一 `LOCAL_SYNTHETIC_CORE_ROOT`，记录测试数、通过数、失败数和退出码。
4. 运行 `node node_modules/typescript/bin/tsc -p apps/mini-program/tsconfig.json --noEmit`、`node scripts/verify_mini_page_registration.mjs --require-generated-js`、两份测试文件的 Prettier API 格式核对、`git diff --check` 与精确写集/基线哈希审计。
5. 不调用主树不存在的 `scripts/mini-runtime.mjs`；不生成或更新 JS。若失败暴露出需修改测试辅助函数之外的业务/测试文件，停止并记录，不扩大写集。

## 完成状态与验证

`PASS_MAIN_MINI_SAFE_SUITE_226_OF_226;TEST_HELPER_INDEX_ONLY;TSC_PASS;PAGE_REGISTRATION_PASS`

- RED：D84 已复现两个目标测试失败（两文件 6/8）。GREEN：修正 profile 辅助函数后，两文件 8/8 通过。
- 主工作树安全 Mini 测试 32 个文件共 226/226 通过，退出码 0；测试运行并发 1。名单排除了 `apps/mini-program/src/pages/staff.test.ts`，其未读取、运行、编译或修改。
- Mini `tsc --noEmit` 通过；`node scripts/verify_mini_page_registration.mjs --require-generated-js` 通过（页面与非空生成 JS 均存在）。主树没有 `scripts/mini-runtime.mjs`，因此没有重新编译或刷新任何 JS。
- 两份测试文件 ESLint 通过；Prettier 3 API 对两份测试和本合同格式核对通过；`git diff --check` 退出码 0。Git 对其他既有脏文件输出换行符提示，没有报告空白错误。
- 本次只改两个测试辅助函数：profile 不存在时明确失败，实际 picker 值使用数组索引加 1。代码后 SHA-256：`4A1B8229B6744D07B13007731209AA4859BA9AD4FED8B47B1E2578E1B85963D6`（attendance）和 `BB3E98332241420A805723ED1BE72B3D9C03786EFACC33F27EF476D0ECE77C70`（multi-student）。
- 没有新增业务行为或修改页面；Node 仅输出既存的模块类型性能提示，不影响测试结果。页面在微信开发者工具中的原生视觉和角色实点仍是 `NOT_RUN`，需要操作者在本机工具复核；不把自动化通过宣称为人工验收。
