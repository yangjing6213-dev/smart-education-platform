# TASK20_POST_G24_V3_MATRIX_REFRESH

## 任务边界

- 状态：`PASS_LOCAL_DOCUMENTATION_AUDIT;NEXT_TARGET_G25_MINI_NATIVE_NOTICE_FLOW`；本任务只校准进度和选择下一项，不修改产品代码。
- 需求依据：项目方案 `C:\Users\HU\Desktop\同芯机构项目\开发方案\student-care-platform-complete-plan-v2.0.pdf`（SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`）；V3 实施计划 `docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md`（SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38B`）；当前 `PLANS.md` 与各阶段合同/验证记录。
- 目标：核对 G24 完成后的网页与小程序进度，纠正仍标成“主树同步待做”但已有后续证据的当前状态，保留所有负责人复核和原生小程序验收边界，并选择下一项实际未闭合的功能工作。

## 允许写入的文件

1. `PLANS.md`（修改）
2. `docs/exec-plans/active/project-completion.md`（修改）
3. `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`（修改）
4. `docs/superpowers/plans/2026-10-09-task20-post-g24-v3-matrix-refresh.md`（本文件，新建）

除此之外不写入任何文件。

## 校准规则

- G24 Admin 费用代理：本地自动检查与隔离浏览器验证通过；Owner Review 和本轮 Admin 人工浏览器复核未执行，不得标为已验收。
- G3.5 资源生命周期：Web/Admin 主树选择性同步及本地浏览器验证已通过；Owner Review 与小程序原生复核仍待完成。
- G3.6 统计：Owner Review、主树同步和 2026-10-08 本地运行实例刷新已通过；不得保留旧的“工具策略阻止重启”状态。
- G4.1–G4.3：Web/Admin 主树同步及自动/浏览器验证已通过；G4.1 Owner Review 已通过，G4.2/G4.3 Owner Review 待办；未有点击证据的原生小程序流程仍为 `NOT_RUN`。
- G6.4：主树自动验证、网页浏览器流程和小程序家长绑定/授权授予撤销实际流程已有通过记录；总体 Owner Acceptance 仍未声明。
- G2.3：User Web 家长接送入口主树同步已通过。Mini/API 原合同中 8 个实现、测试和模板路径与主树逐文件 SHA-256 相同，无需再次复制；但此前没有独立的 Mini 主树整合回执，Owner Review 和完整原生接送点击仍未完成。
- G3.3：Web/Admin 主树同步已通过；本次只读比对发现 API/Mini 原合同路径中 14 个源文件与生成文件与主树相同。合同列出的 `tests/mini-shared-service.test.mjs` 在两棵树都不存在，因此不能把 15 条路径全部写成已同步；现有自动测试证据及人工验收状态分别保留。
- G24 及其他阶段只采用最新、可追溯的合同/测试记录，不把“打开模拟器”当成具体业务流程验收。

## 本轮现场证据

- WeChat DevTools 已通过 CLI 重新打开隔离工作树内正确的项目目录 `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign\apps\mini-program`。窗口标题为 `mini-program`；窗口截图中访客首页已渲染，启动画面不再显示 `app.json` 缺失。此前失败的直接原因是 DevTools 打开了不含 `app.json` 的 worktree 根目录。
- 这次截图只证明项目启动和首页渲染；没有执行通知发布、家长查看/确认/撤回或接送等业务点击，因此这些原生流程仍按各自状态记录为未运行或部分运行。
- 下一目标选为 G2.5 Mini 通知原生流程收尾：先在当前正确项目中复核“员工创建/提交→负责人审核并发布→家长读取/确认→负责人撤回”，仅在发现可复现的产品缺陷时再建立窄修复写集。该目标不表示已经人工验收。

## 本轮实施与验收

- 比较项目方案 PDF、固定 SHA 的 V3 计划、主树当前记录、对应阶段合同和验证结果。
- 只修正当前状态摘要和确实冲突的总结段；历史记录保留原样。
- G2.3 和 G3.3 路径比对仅用于纠正状态表述；不复制文件，不把缺失的合同测试路径视为通过。
- 执行 `git diff --check`、四路径范围审计、合同/V3 哈希复核和当前工作区状态检查。
- 不运行会改写生成文件的编译，不安装依赖，不改 lockfile，不提交、推送、部署或发布。

## 停止条件与状态边界

- 若主树、隔离工作树、合同或验证记录互相冲突，记录冲突并暂停相关断言；不猜测或覆盖。
- 负责人复核、原生微信操作和正式机构验收分别记录，自动化测试不能替代这些证据。
- 本任务 `PASS` 仅表示进度矩阵对齐和下一任务选定，不表示产品发布就绪。
