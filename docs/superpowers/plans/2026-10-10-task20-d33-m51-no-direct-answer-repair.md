# TASK20 D33：M5.1 第 3 级提示不泄露答案

## 目标

修复 D32 已确认的 M5.1 内容缺陷：当前 API 第 3 级提示把合成题的正确结果直接显示给学生，违反 V3 第 9 节“禁止直接给答案”。保留固定题目、逐级提示、家长/教师监督、巩固题和本机合成边界，只让学生自行完成最后一步。

## 精确写集

- `apps/api/src/local-synthetic/learning-session.service.ts`
- `apps/api/test/local-synthetic-learning-session.test.ts`
- `tests/local-synthetic/learning-session.test.mjs`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `docs/superpowers/plans/2026-10-10-task20-d33-m51-no-direct-answer-repair.md`

API 编译产物只允许生成到既有忽略目录 `apps/api/dist/`，不得提交为本次跟踪改动。

## 实施要求

1. 先扩展 API 服务测试：学生每次提交错误答案后才能解锁下一级提示；0 到 3 级按序开放；第 3 级提示要求学生自行完成末步，不出现正确结果 `403`。
2. 先运行新测试，确认旧实现因包含正确结果而失败，再以最小文案改动修复 API 提示。
3. 扩展本机 API 集成测试，确认通过实际路由返回的第 3 级提示不含最终答案；随后重跑 API 定向测试、D32 相关 Web/Mini/Admin/E2E 自动化测试和 API 类型检查。
4. 更新计划表和执行记录：M5.1 本地安全内容缺陷修复后可标记为“本地自动化验证通过”，Owner Review 与 Mini 微信开发者工具原生复核仍分别保留待验状态。

## 边界

- 仅固定、虚构题目；不接正式 AI、外部网络、真实学生或机构资料、持久化、认证、API 以外新服务。
- 不修改 User Web、Mini、Admin UI 或任何生成 JS；这些页面继续展示 API 返回的固定提示文本。
- 不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`；不安装依赖、不改 lockfile、不提交、推送、部署或发布。
- 如最小修复需要修改上述白名单外文件，停止并在治理记录中说明原因。

## 验收标准

- 新测试在修复前明确失败于答案泄露断言，修复后通过。
- API 所有 4 级提示需要逐次错误作答解锁；跳级、重复或已答对后查看提示仍被拒绝。
- API 集成路由返回的提示没有 `403` 等最终结果；巩固题流程继续通过。
- 目标 API/Web/Mini/Admin/E2E 检查、类型检查、ESLint、Prettier API、SHA-256、写集审计和 `git diff --check` 结果如实记录。

## 验证结果

- TDD 红灯：修复前 API 服务与实际路由两项新答案泄露断言均因原提示包含 `403` 失败。
- 修复后：API 服务 `6/6`；API 路由集成 `1/1`；User Web `5/5`；Mini 页面/客户端 `11/11`；Admin 匿名汇总 `2/2`；学习轨迹 E2E `3/3`。
- API TypeScript 构建通过；API `typecheck` 与本次两份 API 文件 ESLint 通过。
- User Web、Mini、Admin、E2E 测试为与 D33 文案共用安全边界的回归检查；Mini 原生微信开发者工具复核 `NOT_RUN`，Owner Review `PENDING`。
- API 源码、测试与治理记录对应片段均通过 Prettier API；精确路径 `git diff --check` 通过，`pnpm-lock.yaml` 未变化。最终合同 SHA-256 记入三份计划记录。
