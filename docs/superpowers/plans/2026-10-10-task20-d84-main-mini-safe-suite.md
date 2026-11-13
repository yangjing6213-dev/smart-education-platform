# TASK20 D84：主工作树 Mini 安全测试与页面工件复核

## 目标

D82 的 216/216 测试运行在 Mini 隔离工作树；D83 已确认主树和隔离树有双向差异。本任务在当前主工作树独立运行安全 Mini 测试子集、Mini 类型检查和只读页面工件检查，确定主树自身的当前证据，不把隔离树结果当作主树通过证明。

## 基线

- 当前工作树：`C:/Users/HU/Documents/student-care-saas-platform`，HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。
- PDF v2.0 SHA-256：`4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。
- D83 审计合同 SHA-256：`68A2D3549FA6C9A51C79FC89179E914ADA1B4A7A84A3BDF0447ED37D20EEE9FD`。
- 主树 `PLANS.md` 执行前 SHA-256：`EF69284E403BF37491AE3AA99E3FB5DC4F3CFDAFA504DA87AD43E1A1362F1B6F`。
- 主树活动计划执行前 SHA-256：`E64EBE439CF109631AE95927EE4CC8D74F5C8F0B84BE3439659B11C2FA7F49CB`。
- 执行前枚举得到 32 个 `apps/mini-program/src/**/*.test.ts` 安全测试文件；唯一排除路径必须是 `apps/mini-program/src/pages/staff.test.ts`。若检查集合含有它，立即取消测试命令。

## 精确写集

- CREATE：`docs/superpowers/plans/2026-10-10-task20-d84-main-mini-safe-suite.md`。
- MODIFY：`PLANS.md`，记录主树结果与下一目标。
- MODIFY：`docs/exec-plans/active/project-completion.md`，记录主树结果。
- 所有产品源码、测试、配置、依赖、lockfile、生成文件均只读。

## 验证步骤

1. 列出 Mini `src` 下测试路径，先断言 32 个安全文件清单不包含 `apps/mini-program/src/pages/staff.test.ts`；使用 Node 测试并发 1 顺序执行，记录文件数、测试数、失败数与退出码。`LOCAL_SYNTHETIC_CORE_ROOT` 只在当前进程指向现有本机合成核心。
2. 执行 `node node_modules/typescript/bin/tsc -p apps/mini-program/tsconfig.json --noEmit`，并在执行前核对 tsconfig 将 `src/**/*.test.ts` 排除，保证保护测试未编译。
3. 主工作树不存在 `scripts/mini-runtime.mjs`；尝试调用时返回 `MODULE_NOT_FOUND`，没有写入文件。改用现有只读护栏 `node scripts/verify_mini_page_registration.mjs --require-generated-js`，结果为 `MINI_PAGE_REGISTRATION_PASS generatedJs=required`。
4. 对本合同与新增治理区块做 Prettier 3 API 格式核对、`git diff --check`、尾随空白和写集审计；不运行整个工作区发现器。

## 禁止事项与停止条件

- 不读取、复制、运行或编译 `apps/mini-program/src/pages/staff.test.ts`；不把它列进命令或测试数组。
- 不修改任何小程序产品/测试/配置/生成文件，不安装依赖、不改 lockfile、不接真实服务/认证/数据/AI/数据库。
- 不提交、推送、部署或发布，不清理或覆盖已有工作区现场。
- 若安全测试失败，保存准确失败证据；本任务不改产品代码，后续另立最小修复任务。若权威哈希或治理基线变化，停止文档更新并重新核对。

## 结果与状态

`PARTIAL_MAIN_TREE_MINI_SUITE_224_OF_226;TSC_PASS;PAGE_REGISTRATION_PASS;FOCUSED_FAILURE_REPRODUCED;SEPARATE_TEST_FIX_REQUIRED`

- 主树安全测试清单为 32 个文件，明确排除 `apps/mini-program/src/pages/staff.test.ts`。完整运行共 226 项，224 通过、2 失败，退出码 1；只重跑两个失败文件为 8 项，6 通过、2 失败，确认不是测试顺序造成。
- 两项失败分别是考勤流程在 `attendance.test.ts` 读取未生成记录的 `status`，以及多学生流程在 `multi-student.test.ts` 读取未生成绑定的 `id`。
- 失败原因已由测试辅助函数与页面选择器核实：测试用 `profiles.findIndex(...)` 的原始索引作为 picker 值；实际选项在最前面包含“请选择示例身份”，索引 0 是空身份，真实 profile 的选择值需在数组索引上加 1。当前页面的占位项行为符合预期，问题位于两处测试辅助函数与页面选项索引不一致，不属于已确认的业务逻辑缺陷。
- `node node_modules/typescript/bin/tsc -p apps/mini-program/tsconfig.json --noEmit` 通过；页面注册护栏及生成 JS 完整性通过。`staff.test.ts` 未读取、运行、编译或修改。
- 当前主树没有 `scripts/mini-runtime.mjs`；运行该不存在路径失败，故运行时编译一致性检查未完成，不能用注册护栏替代该项。没有 Mini 源码、测试、配置或生成文件改动。
- D85 将单独只修复上述两份测试中的 profile picker 辅助索引，并重新运行 focused 与安全全集；届时仍不触碰产品业务代码或受保护测试。
