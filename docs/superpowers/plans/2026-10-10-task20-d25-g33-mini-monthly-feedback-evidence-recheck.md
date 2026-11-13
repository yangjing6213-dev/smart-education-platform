# TASK20 D25：G3.3 Mini 月反馈测试路径现况复核

## 目标与依据

项目负责人已授权自主继续本地合成开发。依据 PDF V2.0（SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`）与 V3 路线图，复核 G3.3 月反馈在主工作树中的自动化证据，解决旧记录所述 `tests/mini-shared-service.test.mjs` 在主树和来源树均缺失的过期状态。

当前主树已能定位 `tests/mini-shared-service.test.mjs`，且其中有“Mini monthly feedback is one shared employee-to-parent workflow”用例。本任务只核实其源码/生成页面模式；不补造已存在的测试，不把自动化结果当作微信开发者工具验收。

## 精确写集

- CREATE `docs/superpowers/plans/2026-10-10-task20-d25-g33-mini-monthly-feedback-evidence-recheck.md`
- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`

## 禁止范围

- 不修改任何产品代码、测试、生成 JS、页面、路由、配置、依赖或 lockfile。
- 不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 不访问真实数据、外部网络、数据库、正式 AI 或生产服务；不提交、推送、部署或发布。
- 不把页面测试表述为实际微信开发者工具点击或负责人验收。

## 验证步骤

1. 使用既有 `LOCAL_SYNTHETIC_CORE_ROOT` 指向 `C:\Users\HU\.codex\worktrees\task20-local-shared-core`，仅运行命名为“Mini monthly feedback is one shared employee-to-parent workflow”的共享服务页面用例。
2. 同一用例分别运行 TypeScript 源码与生成 JS 页面模式，确认员工提交、负责人审核发布、家长读取/确认、来源变化使旧摘要失效等已有断言通过。
3. 复用本轮已完成的 Mini 31 文件串行回归 `216/216` 结果；执行治理文件格式、`git diff --check`、精确写集与受保护路径状态审计。
4. 只在上述证据通过后，将旧“测试路径缺失”状态标记为已由后续实际测试覆盖；Owner Review 与微信开发者工具点击仍单独待办。

## 停止条件

若当前页面测试或共享服务路径不存在、需要改动写集外路径、测试触及外部服务，停止并记录，不扩大范围。

## 结果与验证

- 既有 `apps/mini-program/src/pages/monthly-feedback.test.ts` 提供两项固定选项与版本规则检查；当前主树 `tests/mini-shared-service.test.mjs` 有员工、负责人和家长共用一条月反馈记录的实际 Page/本机服务流程，覆盖来源更新后使旧家长摘要失效。
- 指定月反馈流程源码模式和编译页面模式各 `1/1` 通过。整份共享服务联测的 9 项在源码模式与设置 `MINI_SHARED_RUNTIME=generated` 的编译页面模式各 `9/9` 通过；均只使用本机临时内存服务。
- 同一轮 Mini 页面串行全量回归为 `31` 个文件、`216/216` 通过；受保护的 `staff.test.ts` 排除且未读取、运行或修改。
- Mini TypeScript `--noEmit` 检查和 `node scripts/verify_mini_page_registration.mjs --require-generated-js` 均通过。
- 当前结论：旧记录准确描述 G3.3 首次同步时的路径缺失；后续主树已有对应自动化流程，因此该“缺失测试路径”不再是当前阻塞。此复核不证明合同源树逐路径完全同步，也不等于微信开发者工具实点、Owner Review 或正式学习成效。
- 新合同经已安装 Prettier API 格式核验通过；`git diff --check` 通过，Git 仅报告其他既有文件的换行符提示；本合同无尾随空白。
- 最终写入范围限定为本合同及 `PLANS.md`、项目完成记录、路线图；不触及产品代码、测试、Mini 页面或设置。
