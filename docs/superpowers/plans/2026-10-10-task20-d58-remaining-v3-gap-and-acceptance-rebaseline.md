# TASK20 D58：V3 剩余差距与验收状态复核

**状态：** `READ_ONLY_REBASELINE_COMPLETE;D59_CONTRACT_READY`
**日期：** 2026-10-10
**产品依据：** `C:\Users\HU\Desktop\同芯机构项目\开发方案\student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。
**阶段映射：** `docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md`。其旧状态快照仅作需求映射，当前进度以本次核对的代码、测试和 `PLANS.md` 证据为准。
**授权依据：** 负责人已要求取消普通本地开发的逐项等待，由执行者按项目方案自主继续；仅限本地合成资料和可回退改动。

## 1. 目标与边界

对照 V3 的剩余工作和当前证据，区分尚缺的本地功能、仍待实际操作/负责人验收的门槛，以及只有进入真实运营阶段才能完成的事项；选出一个已确认且可在现有技术边界内实现的下一项任务，并先建立其精确写集合同。

本轮只审查项目资料与应用代码中的业务对象定义，不修改产品代码、测试、配置、依赖、lockfile、生成文件或运行服务。不得读取、复制、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。不得提交、推送、部署或发布。

## 2. 本次复核结果

1. D57 已在实际本机浏览器中完成家长授权、撤回、负责人期限处理及家长重新查看结果；95 个请求均留在本机预览地址，页面错误为零。它关闭的是网页本机流程及其预览读取白名单缺口，不关闭微信原生验收、负责人验收或真实隐私服务门槛。
2. V3 M6.2 明确列出 `StaffPerformance`，并要求管理网页处理员工经营事务，同时不得让系统自动决定个人权益。主树 `staff-operations.ts` 目前只定义工作材料核对与招聘跟进；在 API/Admin/User Web/Mini 源码中检索 `StaffPerformance`、员工绩效/评估对应类型或记录均无结果。已有工作材料记录不具备独立的人工工作回顾记录、审核版本和历史，因此该域对象是已证实的本地功能缺口。
3. G3.4 物资申请的本地共享服务、Mini 页面和 Web/Admin 操作均已有实现证据；仍未闭合的是微信原生“缺货/取消”实点及负责人验收。现有证据不支持把它描述成仍缺代码，也不把自动化测试扩写成原生验收通过。
4. M6.1 的本机测试只覆盖已实现的成员/对象范围路径；真实身份、数据库、对象存储、后台作业和跨服务审计仍属于生产能力，依当前边界不在本地演示中伪造。M6.3 已有临时合成文件恢复演练，但不等于真实备份、恢复目标或供应链审计。
5. 当前阶段证据中，部分 Mini 全角色微信开发者工具实点、Admin 手动浏览器检查和多项 Owner Review 仍明确为 `NOT_RUN`/`PENDING`。这些属于独立验收门，不应阻断其他可在本机验证的缺口，也不能被源码测试替代。

## 3. 下一项任务

下一项为 `TASK20_D59_G53C_STAFF_PERFORMANCE_HUMAN_REVIEW_SYNTHETIC`，具体合同见 `docs/superpowers/plans/2026-10-10-task20-d59-g53c-staff-performance-human-review.md`。

D59 合同 SHA-256：`5BB9FAC255036EC6A1BCF283B3AB911BA04D8E2A409B4A07D61BFEB299082B33`。

在现有 Admin 员工经营面板补入独立的合成员工工作回顾记录：仅固定虚构员工、月份、工作领域、人工回顾结论与支持措施；版本冲突可见，保留本地状态历史，刷新后复位。所有结果由负责人手动选择；不使用分数、排名、自动评价、自由文本个人资料，不影响薪酬、岗位、雇佣或其他权益。只在内存中演示，不接 API/数据库/持久化。

## 4. D58 精确写集与验证

- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- CREATE 本合同
- CREATE D59 实施合同 `docs/superpowers/plans/2026-10-10-task20-d59-g53c-staff-performance-human-review.md`

核对项目 PDF/V3 既有权威哈希、查看 D57 和 M6.2 阶段记录、读取 Admin 员工经营模型/页面及对应测试，并对非受保护源码范围执行只读检索。最后运行治理文件范围检查和 `git diff --check`。本轮不运行产品测试，因为没有修改产品实现或测试。

## 5. 停止条件

如发现 D59 必须采集真实员工资料、进行自动评分或人事判断、接入外部服务、数据库/持久化或依赖，停止该部分并保留已完成的 D58 复核。任何微信原生/Owner 验收结论必须来自对应实际操作，不从本地自动化推断。
