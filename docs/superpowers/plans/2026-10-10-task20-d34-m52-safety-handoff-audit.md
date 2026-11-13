# TASK20 D34：M5.2 学习安全退出与人工接管证据核对

## 目标

对照项目方案 V2.0 与 V3 M5.2，核对固定题目拒绝开放输入、关闭/清除本机学习会话、教师在授权班级范围接手、家长端不可继续操作，以及管理端仅查看匿名安全汇总的现状。判断 M5.2 总表“待实施”是否准确，分开记录自动化、本机浏览器、Mini 原生和 Owner Review 状态。

## 精确写集

- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `docs/superpowers/plans/2026-10-10-task20-d34-m52-safety-handoff-audit.md`

本轮只允许更新以上治理文件；源码、测试、生成文件、配置与依赖均只读。发现可复现产品缺陷时，先记录依据并建立单独精确写集后继续，不得在审计合同中修改产品文件。

## 审计范围与边界

- API 与共享本机服务：固定输入白名单和自由文本拒绝、越权/无效动作拒绝、关闭和删除、超时/完成后拒绝继续、教师接手及班级范围、匿名汇总。
- User Web 与 Mini：查看安全说明、发起关闭/清除/接手动作、关闭或接手后学习页面状态；检查页面未提供开放式聊天输入。
- Admin：汇总仅匿名计数和安全指标，不显示学生、班级或会话明细；查看计数是否有明确版本/口径。
- 禁止接入正式 AI、外网、真实身份/学生/机构数据、持久化或真实服务；不得读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 不安装依赖、不修改 lockfile、不提交、推送、部署或发布；保留工作树已有其他修改。

## 验收标准

1. API、Web、Mini、Admin 的相关定向测试和可用本机页面流程均有实际结果。
2. 逐项区分“关闭本次练习”“清除会话”“交教师接手”和“匿名安全统计”是否实现且范围正确。
3. 若本地实现已有，不再标记待实施；若缺口存在，明确功能影响并转为独立实现任务。
4. 原生微信开发者工具和 Owner Review 未实际完成时保持 `NOT_RUN/PENDING`。
5. 最终合同 SHA、精确写集审计、Prettier API 与 `git diff --check` 通过；未验证内容不得写成通过。

## 验证记录

## 已执行结果

- API 学习服务 `6/6`；本机路由流程 `1/1`；User Web 学习页 `5/5`；Mini 页面/客户端 `11/11`；Admin 匿名摘要 `2/2`；学习轨迹 E2E `3/3`。
- API 对固定输入的严格白名单、家长结束/删除、教师按班级接手、接手后学生只读及平台匿名统计已有本机测试证据。User Web 已有结束、家长删除和接手控件。
- Mini 只有结束与教师接手；Mini 客户端没有删除方法、页面没有删除按钮。教师没有 `learning:delete` 能力，也不能删除自己接手的家长记录。
- `LearningSafetySummary` 仅包含数字计数，不含指标定义版本；单次会话虽含 `consentVersion` 与 `guidanceMode`，但 Admin 汇总没有向查看者标明统计口径版本。
- 结论：`GAPS_CONFIRMED_PENDING_D35_D36`。D35 修复 Mini/教师安全清理，D36 增加本地匿名汇总指标版本；正式 AI、实际成本和线上模型故障回退仍不接入。Owner Review 与 Mini 原生复核 `PENDING/NOT_RUN`。
- 本合同和三份 D34 治理记录的 Prettier API 检查、精确路径 `git diff --check` 通过；lockfile 未变化。
