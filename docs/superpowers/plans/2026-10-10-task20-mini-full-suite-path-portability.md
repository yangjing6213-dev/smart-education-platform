# TASK20 Mini 全量回归服务路径可移植性修复

- 任务标识：`TASK20_D15_MINI_FULL_SUITE_PATH_PORTABILITY`
- 状态：`PASS_LOCAL_SYNTHETIC_TEST_HARNESS_REPAIRED`
- 来源：项目方案 PDF v2.0；当前 V3 完成矩阵与 `PLANS.md` 自主执行边界。
- 工作树：`C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`

## 目标

修复小程序全量页面回归从主工作树运行时的两个测试启动失败。测试应优先使用 `LOCAL_SYNTHETIC_CORE_ROOT` 指定的现有本机合成服务根目录；未设置时仍保留相邻 `task20-local-shared-core` 的原有默认行为。此修复只改变测试夹具路径，不改变业务行为。

## 根因证据

- 从主工作树运行 31 个 Mini 测试文件共 210 项：208 项通过，`attendance.test.ts` 与 `multi-student.test.ts` 各在导入服务前失败。
- 虽然命令已设置 `LOCAL_SYNTHETIC_CORE_ROOT=C:\Users\HU\.codex\worktrees\task20-local-shared-core`，两文件仍直接执行 `resolve("../task20-local-shared-core/...")`，Node 因而查找不存在的 `C:\Users\HU\Documents\task20-local-shared-core`。
- Mini 其他共享服务测试已使用同名变量并保留相邻目录默认值，可作为一致性实现参照。
- 聚焦重现：上述两文件 0/2 通过，失败原因均为 `ERR_MODULE_NOT_FOUND`，服务测试正文尚未运行。

## 精确写集

隔离树实施并随后选择性同步到主工作树：

- `apps/mini-program/src/local-synthetic/attendance.test.ts`
- `apps/mini-program/src/local-synthetic/multi-student.test.ts`
- `docs/superpowers/plans/2026-10-10-task20-mini-full-suite-path-portability.md`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`

## 验收与验证

1. 两个聚焦测试在主工作树设置 `LOCAL_SYNTHETIC_CORE_ROOT` 后通过。
2. 31 个 Mini 测试文件串行复跑通过；受保护的 `apps/mini-program/src/pages/staff.test.ts` 必须排除且不读取、不运行、不修改。
3. Mini TypeScript 检查、针对两测试文件的 ESLint、Prettier、页面注册/生成工件护栏及 `git diff --check` 通过。
4. 最终差异严格等于上述六路径；依赖、lockfile、业务页面、生成 JS、配置、外部服务和主树其他现场保持不变。

## 禁止与停止条件

- 不修改业务服务/页面、API、路由、配置、生成 JS、`staff.test.ts`、依赖或 lockfile。
- 不安装依赖；不访问真实数据或外部服务；不提交、推送、部署或发布。
- 若修复需要超出六路径或需要改服务/配置，停止并记录原因。

## 实施与验证结果

- 两个测试都改为读取 `LOCAL_SYNTHETIC_CORE_ROOT`，未设置时保留原相邻目录默认值；业务页面、服务、路由和生成 JS 未改变。
- 在主工作树设置环境变量后，两个测试文件 8/8 通过；在隔离 Mini 工作树移除环境变量、使用相邻共享核心默认值后，同样 8/8 通过。
- 主工作树 31 个 Mini 测试文件串行运行，受保护 `staff.test.ts` 排除：216/216 通过。原来缺失服务路径的两个文件现实际贡献 8 项通过测试。
- Mini TypeScript `--noEmit`、两文件 ESLint、三项作者文件 Prettier、`node scripts/verify_mini_page_registration.mjs --require-generated-js` 均通过。
- `git diff --check` 退出码 0，仅有其他既有文件的换行符提醒；新增计划、两份目标测试均无尾随空白，写入范围核对为精确六路径。未安装依赖、未改 lockfile、配置或生成工件。
