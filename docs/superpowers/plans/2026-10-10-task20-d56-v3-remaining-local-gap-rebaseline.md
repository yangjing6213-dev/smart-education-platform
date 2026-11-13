# TASK20 D56：V3 网页与小程序剩余本地缺口复核

## 目标与依据

- 目标：以正式项目方案 PDF v2.0（SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`）和 V3 计划（SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`）为准，结合 D51、D52、D54、D55 的最新证据，重新核对家长关系申请、员工/负责人审核、成长记录、通知和相关 Web/Admin 页面；分开列出代码缺口与人工/生产验收门，并选出下一项可本机完成的具体目标。
- 当前证据锚点：D55 合同 SHA-256 `079338BFC4A69E73F7B977EC45183B317900F4029C0088D9991D93775F5591B6`；D54 共享入口根因已在 D55 修复；微信开发者工具人工点击和 Owner Review 仍单独记录。
- 仅使用虚构数据和本机服务；本任务只读实现/测试，并更新执行计划，不实现新的业务行为。

## 精确写集

- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- CREATE 本合同

## 只读范围

- 正式 V3 计划中 M3.1–M3.3、M4 和 M6 的完成标准；D51、D52、D54、D55 合同及对应验证记录。
- Mini 共享家长流程、共享通知、UI 抛光测试；User Web 家长关系/通知测试；Admin Web 关系审核测试。
- 禁止读取、复制、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。

## 验收

1. 用明确命令核实当前 Mini 员工关系审核入口、成长记录草稿—提交—审核—发布—家长查看，以及 Web/Admin 关系申请审核和通知流程；只复用当前有效证据。
2. 把真实缺失、已实现并有自动化证据、仅待人工点击/Owner Review、超出当前本机授权的生产能力分开记录；不得把自动化说成微信原生验收。
3. 若确认新的可本机修复代码缺口，只记录精确下一任务目标和写集边界；本 D56 不改业务代码或测试。不得为了“继续”而重复实现已完成流程。
4. 写集审计、合同 SHA-256、Prettier API 与 `git diff --check` 通过；保留所有无关工作树现场。

## 验证方式

- Mini：`shared-parent-workflows.test.ts`、`shared-notice.test.ts`、`mini-ui-polish.test.ts`，通过 `scripts/mini-safe-test-runner.mjs` 指定路径；共享 Page 测试分别运行源码和生成 JS 模式。
- User Web：`parent-consent.test.ts` 与 `parent-notices.test.ts` 定向运行。
- Admin Web：`binding-review.test.mjs` 定向运行。
- 本任务不运行全项目套件，不调用完整 Mini `tsconfig.json`，不读/跑受保护的 `staff.test.ts`。

## 验证结果

- 正式方案 PDF SHA-256 与 V3 计划 SHA-256 均与已登记值一致。
- Mini 源码模式：共享家长流程、共享通知与 UI 护栏 `16/16`；生成 JS 模式的两个共享页面流程 `6/6`。小程序受保护的 `staff.test.ts` 未读取、未运行、未复制、未修改。
- User Web 使用当前源码编译产物中的家长同意和共享通知 focused tests `17/17`；两组实际运行文件及其对应生成 JS 均与当前 TypeScript 源码转译结果一致。直接把 TypeScript 测试交给 Node 时，因源码通过 `.js` 扩展名导入未生成的 JS 而出现 `ERR_MODULE_NOT_FOUND`；改用仓库现有 dist focused tests 后通过。这是测试入口不匹配，不是产品缺陷，也没有触发构建写入。
- Admin Web 关系审核 focused tests `8/8`；被测审核页与客户端的当前编译 JS 均和 TypeScript 源码转译一致。
- D51、D52、D54、D55 和现行完成计划的证据与本轮结果一致：M3.1 关系审核与 M3.2 成长记录/通知的本地共享页面流程有自动化覆盖；M3.3、M4.1–M4.3 及 M6.1–M6.3 的已有本机实现按既有阶段记录维护。此结论不替代微信原生点击、负责人复核或生产能力。
- 本轮 reviewed code paths 没有确认新的本地产品缺陷。一个真实未闭合项是 G6.4A 家长同意网页的授权/撤回/期限生命周期浏览器流程仍属 `INCONCLUSIVE`；模型/页面定向测试通过并不能证明整页按钮流程有效。下一项定为 D57：使用本机合成服务复现该浏览器流程，确认是产品断点还是旧证据不足，再按复现结果修复最小写集。
- 本合同 Prettier API 检查通过；最终 `git diff --check` 与精确写集审计在收尾时执行。没有修改业务源码、测试、配置、依赖或 lockfile；Owner Review、微信开发者工具人工实点和生产门槛仍单独开放。

## 状态

`PASS_LOCAL_SYNTHETIC_MATRIX_REBASELINE;NO_NEW_PRODUCT_DEFECT_IN_REVIEWED_PARENT_NOTICE_AND_MINI_UI_PATHS;G64A_CONSENT_BROWSER_FLOW_INCONCLUSIVE;OWNER_NATIVE_AND_PRODUCTION_GATES_OPEN`

## 停止条件与状态边界

- 若目标测试依赖缺失的外部服务、真实账号或真实儿童资料，记录为 `NOT_RUN`，不得接入服务或扩大范围。
- 若发现代码缺陷超出本只读写集，不在本任务改代码；在已授予的本机开发范围内建立下一份精确合同再继续。
- Owner Review、微信开发者工具人工点击、真实机构验收及生产就绪始终分开记录。
