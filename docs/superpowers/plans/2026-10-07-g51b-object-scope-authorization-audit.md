# TASK20 G5.1B 对象级范围授权审计（2026-10-07）

**状态：** `PASS_READ_ONLY_AUDIT`
**前置阶段：** G5.1 审计已由用户复核；G5.1A 本地合成员工生命周期已完成实现和定向验证，等待单独验收及主工作树业务同步。
**授权依据：** 用户已明确委托继续完成本项目后续本地开发，并要求复核后进入下一步。本合同仅执行本地合成服务的只读审计，不改变业务行为。

## 目标

核实现有服务是否在可信租户/校区身份之上，对班级、学生、关系和业务对象继续执行对象级校验；核对跨范围负测与列表过滤是否有测试证据，输出事实、测试覆盖缺口和下一项最小实现合同。重点避免把“路由有登录/能力门禁”误当成“目标对象也已授权”。

## 精确写集

只允许修改以下治理文件：

- `docs/superpowers/plans/2026-10-07-g51b-object-scope-authorization-audit.md`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`

代码、测试、配置、依赖和 lockfile 均为只读。不得同步任何业务文件到主工作树。

## 只读检查范围

Core 隔离工作树：`C:\Users\HU\.codex\worktrees\task20-local-shared-core`

- 可信身份和范围：`packages/auth/src/identity.ts`、`packages/auth/src/membership-policy.ts`、`packages/auth/src/session.ts`、`packages/tenant/src/resolve-scope.ts`、`apps/api/src/plugins/auth.plugin.ts`、`apps/api/src/plugins/scope.plugin.ts`。
- 本地合成路由与对象服务：`apps/api/src/local-synthetic/routes.ts`、`apps/api/src/local-synthetic/*service.ts`、`apps/api/src/local-synthetic/sessions.ts`。
- 对应已有服务、范围与本地合成回归测试：`packages/auth/test/`、`packages/tenant/test/`、`apps/api/test/`。
- 使用现存合同、活动计划和已记录验证结果交叉核对；不读取未跟踪素材或非必要个人数据。

审计对象覆盖：关系/请假、成长记录、考勤/接送、健康事件、员工日报/月度反馈、通知、物资、任务、资源、费用、学习会话与统计。每项分别标记：可信范围来源、路由能力门禁、对象目标匹配、列表过滤、历史/事件读取、版本/状态保护、拒绝用例和证据状态。

## 明确不做

- 不修改任何业务实现或测试，不增加通用授权抽象。
- 不接入真实账号、真实未成年人数据、数据库、伙伴云、网络外服务或正式 AI。
- 不安装依赖、不改 lockfile、不创建生成产物、不修改 `staff.test.ts`。
- 不 commit、push、部署、发布或执行外部写入。

## 验收与验证

1. 对每个业务域区分“源码可见”“现有测试覆盖”“本轮实际执行”，不把静态证据写成运行通过。
2. 列出缺少跨租户/校区/班级/学生拒绝、列表过滤或版本保护测试的具体域与文件，不以单一共享插件测试代表所有对象服务。
3. 形成风险排序和下一阶段精确写集建议；发现高风险可复现越权时立即停止审计扩展并记录，不在本合同内修复。
4. 对治理文件运行 `git diff --check`；确认 Core/Admin 工作树业务内容未被改动。

## 停止条件

如审计需要读取本合同之外的敏感数据、写入代码/测试/配置、安装工具、改 lockfile、改变真实认证或服务，立即停止并报告。不得为使测试通过而放宽权限断言。

## 审计结果

### 当前源码与测试目录可见的证据

- `apps/api/src/server.ts:85-86` 在路由执行前以可信成员能力决定路由是否可用；`apps/api/src/plugins/scope.plugin.ts:22-35` 将租户/校区范围从可信身份解析后挂到请求。`packages/tenant/src/resolve-scope.ts` 负责拒绝无可信主体、非活动关系和非法/越界租户校区输入。相邻测试覆盖伪造身份拒绝、非活动成员拒绝、租户不匹配、校区越界和 scope-required fail closed。
- 对象层不是由单一通用授权器完成。`binding-leave.service.ts`、`care-record.service.ts`、`attendance.service.ts`、`task-assignment.service.ts`、`supply-request.service.ts` 等按各自对象字段核对租户、校区、班级、学生、创建者、监护关系或被分配人；列表和投影也在服务端按当前成员过滤。当前实现的证据是逐域规则，不能外推为未来新模块自动具备权限。
- 已有负测覆盖主要本地合成业务域：绑定/请假（`apps/api/test/local-synthetic.test.ts`）、成长记录（`local-synthetic-care.test.ts`）、考勤（`local-synthetic-attendance.test.ts`）、接送（`local-synthetic-pickup.test.ts`）、健康事件（`local-synthetic-health-incident.test.ts`）、通知（`local-synthetic-notice.test.ts`）、日报/月度反馈、物资、任务、资源、费用、学习和统计。测试名称及目标覆盖包括跨范围拒绝、伪造字段、关系撤销后失去读权限、仅授权学生投影、匿名平台汇总和版本/状态检查；这属于静态读取到的测试覆盖，不表示本轮逐一执行。
- G5.1A 新增的成员服务还检查负责人能力、同机构同校区普通员工目标、禁止修改本人/负责人/家长/平台身份，并在停用/撤销时使旧会话失效；其隔离浏览器流程与相关 API 测试在 G5.1A 验证记录中通过。
- `buildScopeCacheKey` / `verifyScopeCacheKey` 目前只在 tenant 包实现及其测试中使用；本轮 `rg` 未找到 API 或应用运行时调用。因此“缓存键是否遗漏操作者”仍是未来接入缓存时的设计检查项，不是已发现的当前缓存越权。

### 审计边界与剩余风险

- 各域重复实现对象范围匹配，存在未来维护时规则漂移的风险；当前没有证据支持再增加一个大而全的通用授权抽象。更稳妥的做法是业务新增时复用可信 `ScopeContext`，再在域服务绑定具体对象关系，并为新增对象同步加入跨范围负测。
- 本轮只读检查源码与现有测试，没有逐一运行所有 API 业务测试；此前 G5.1A 的 API 基线/成员 focused tests 有独立验证记录。服务仍是内存合成演示，不能据此宣称生产账号、数据库或真实多租户系统安全已验收。
- G5.1A 当前为 `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`，尚未选择性同步主工作树业务代码。Admin 物资申请与资源库的额外浏览器回归仍有等待按钮/固定记录超时，原因未明；不属于本审计写集，也未据此改变其业务代码。

### 结论与下一步

没有发现需要在本只读审计中立即停止的对象越权证据；现有各域实现和负测已建立可复用的服务端保护模式。G5.1 可作为“本地合成权限基线已建立、待 G5.1A 负责人验收及后续主树同步”的候选状态，不能称为生产级权限完成。下一目标按路线转入 G5.2 合成账务/费用闭环合同规划：先盘点现有只读费用展示与后端能力，限定为本地模拟账本、明确金额/状态/追溯，不接真实支付、数据库或外部服务。
