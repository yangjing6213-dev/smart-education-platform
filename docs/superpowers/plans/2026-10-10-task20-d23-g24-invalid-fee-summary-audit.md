# TASK20 D23：G2.4 不可用费用资料汇总边界复核

## 依据与目标

- 以《学生托管机构智能化系统平台·完整项目方案》V2.0（SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`）为产品依据，以当前 `PLANS.md` 和 G2.4 合同为执行状态依据。
- 用户已授权自主继续本地项目开发。本任务只复核 G2.4 记录的 `INVALID_DOCUMENTS_NOT_ZERO_FEE` 边界；现有实现审阅显示费用汇总按当前有效期与状态筛选可用资料，但原固定样例的过期/撤回资料金额均为空，不能证明带金额的不可用资料不会影响汇总。
- 目标：用合成资料补一条服务级回归，向校区汇总加入带非零金额的过期与撤回资料，确认不可用数量增加、可用数量不变、金额汇总不变。若测试暴露业务缺陷，再按 TDD 最小修复；若通过，则只记录“现有行为已验证”，不修改产品代码。
- 本任务不涉及电脑蓝屏、转储文件、分页设置或系统重启。

## 精确写集

- `MODIFY apps/api/test/local-synthetic-fees.test.ts`
- `MODIFY PLANS.md`
- `MODIFY docs/exec-plans/active/project-completion.md`
- `MODIFY docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `CREATE docs/superpowers/plans/2026-10-10-task20-d23-g24-invalid-fee-summary-audit.md`

不修改 API、网页、小程序产品代码、生成文件、配置、依赖或 lockfile；不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。

## 验收与验证

1. 新测试使用固定时钟、进程内 `LocalRepository` 和虚构校区负责人，不访问网络或外部数据。
2. 新增带非零金额的 `EXPIRED` 与 `REVOKED` 费用资料后，校区摘要的 `activeDocuments` 和 `amountTotal` 不增加，`unavailableDocuments` 增加两条。
3. 运行 API 费用聚焦测试、API typecheck、目标 ESLint、目标文件格式核验、`git diff --check`、写集审计和 lockfile 指纹核对。
4. 记录实际结果；不把自动化测试解释为负责人验收、原生微信验收或真实财务验收。

## 禁止项与停止条件

- 仅使用固定合成数据；不接真实账号、学生、机构财务、数据库、支付、伙伴云、外部网络或持久化。
- 不安装依赖、不改 lockfile、不提交、不推送、不部署、不发布，不清理或覆盖其他工作现场。
- 若测试暴露问题且修复需要写集外文件或改变金额业务定义，停止该修复并记录具体证据与影响，继续其他不依赖项。

## 执行记录

- 状态：`PASS_LOCAL_SYNTHETIC_TEST_ONLY`。
- 聚焦测试：API TypeScript 编译后运行 `apps/api/dist/test/local-synthetic-fees.test.js`，4/4 通过；覆盖原费用/关系用例和本次新增的过期、撤回非零金额用例。
- 验证：`pnpm --filter @student-care/api build`、`pnpm --filter @student-care/api typecheck`、目标 ESLint 均通过。Prettier API 对新增测试代码块核验完全匹配；整份既有测试文件存在原格式差异，未整文件重排。`git diff --check` 通过；仅显示其他既有文件的换行符提示。lockfile SHA-256 保持 `01BCB5E41D0E3C786F5EACF933791BAB767ACF17B4487D919C04BB2582F4CD64`。
- 结论：服务摘要把两条不可用资料计入不可用数量，但不增加可用数量或金额。没有发现需修改的产品逻辑；费用资料金额合计仍只是可用资料金额的合计，不等于应收/实收/余额，账务数值应以独立合成流水摘要为准。没有进行负责人验收或微信原生点击。
- 执行限制：本地工具没有 `tsx`，因此使用项目已有 TypeScript 编译器和 Node 运行测试；没有安装工具或变更 lockfile。保护测试 `apps/mini-program/src/pages/staff.test.ts` 未读取、运行或修改。
