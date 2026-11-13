# TASK20 G5.1 租户角色与对象范围基线审计（2026-10-07）

**状态：** `PASS_READ_ONLY_AUDIT`

**依据：** 项目方案 `student-care-platform-complete-plan-v2.0.pdf` 第 20–31、39–44 页；`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 的 G5.1；当前唯一活动治理 `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md`。

## 目标

在开始 G5.1 经营管理实现前，核对已有身份、成员、角色能力、租户/校区/班级范围和对象级授权能力，避免重复造轮子或把局部模拟冒充 SaaS 权限完成。明确当前可复用的服务端规则、缺口、风险和最小实现切片。

## 本阶段授权范围

- 只读检查现有合同、类型、服务端身份与范围插件、成员/对象权限和针对性测试。
- 可在本合同最后记录审计结论与下一份实现合同的建议写集。
- 本阶段不修改任何业务代码、测试、配置、依赖、lockfile或主树/隔离树文件内容；不整合代码，不产生外部写入。

## 核查问题

1. 组织/校区/成员/角色/能力的可信来源是什么；客户端能否伪造 `tenantId`、`campusId`、班级或学生范围？
2. 缺失、停用、撤销成员、能力不足、跨租户/校区/班级/对象访问会怎样被拒绝？拒绝是否有必要审计且不泄露正文？
3. 绑定、日报、任务、资源、学习及新业务对象是否复用相同范围约束；是否有只靠前端隐藏按钮的薄弱点？
4. 现有自动测试覆盖哪些规则，哪些缺口需要 G5.1 实现切片补足？

## 验收

- 明确区分已由当前源码/测试证明、仅文档声称和未验证的能力。
- 形成按风险排序的最小缺口清单，并给出 G5.1 下一份精确写集建议。
- 审计只读；任何文件差异、主树状态变化均立即停止并报告。

## 审计结论（2026-10-07）

### 已由当前源码与测试证明

- `packages/auth/src/identity.ts`、`membership-policy.ts` 与 `session.ts` 会校验可信会话、身份一致性、成员状态、租户、校区和能力；客户端提交的身份、角色、租户和校区声明会被拒绝。`packages/tenant/src/resolve-scope.ts` 只从可信成员关系生成租户/校区范围；跨租户、无成员、非活动成员、校区越界和能力不足会 fail closed。
- API 的 `auth.plugin.ts` 与 `server.ts` 在受保护路由上先建立可信身份，再按路由能力筛选有效成员。未提供服务端身份适配器时，受保护路由不会退回客户端声明。
- 现有 API 域服务和测试分别检查班级/学生对象范围；`ScopeContext` 目前统一承载租户/校区，班级和学生范围由各域服务继续校验。因此已有隔离证据，但还不是一个通用对象授权层。
- 管理端 `/admin/staff` 当前是固定合成资料的只读页面，没有成员状态或能力管理入口。

### 已确认的缺口

- `apps/api/src/local-synthetic/sessions.ts` 的演示身份来自固定 profile 列表；创建会话时复制固定成员资料，解析时把会话和成员状态设为 `ACTIVE`。当前没有停用/撤销成员的本地状态目录，也没有使已有会话随成员状态变更而失效的入口。
- `LocalMember` 使用固定 `actions` 清单代表岗位权限，但共享身份能力集合尚无成员管理能力；本地路由和共享身份能力目前是两套并行检查。下一切片应使用共享 `capabilityRequired` 保护成员读取/变更，同时保留对象级服务端校验。
- 班级/学生范围在领域服务中按对象逐项验证；后续新增业务对象必须沿用这些检查。不能据现有证据宣称任意新对象已经自动获得隔离。
- `buildScopeCacheKey` 包含租户和校区但不包含操作者。当前尚未找到它被用于个性化/权限敏感数据缓存的证据，因此列为后续审查点，不定性为已发生的数据泄露。

### 审计证据与限制

- 阅读路径：`packages/contracts/src/identity.ts`、`packages/auth/src/identity.ts`、`packages/auth/src/membership-policy.ts`、`packages/auth/src/session.ts`、`packages/tenant/src/resolve-scope.ts`、`apps/api/src/plugins/auth.plugin.ts`、`apps/api/src/plugins/scope.plugin.ts`、`apps/api/src/server.ts`、`apps/api/src/local-synthetic/sessions.ts`、`apps/api/src/local-synthetic/routes.ts`、`apps/admin-web/src/main.ts` 及相邻权限/范围测试。
- `tsc -p packages/auth/tsconfig.json --noEmit` 与 `tsc -p packages/tenant/tsconfig.json --noEmit`：通过。
- 已构建输出的针对性回归：`node --test packages/auth/dist/test/policy.test.js packages/tenant/dist/test/isolation.test.js apps/api/dist/test/task04.routes.test.js apps/api/dist/test/scope.plugin.test.js`：24/24 通过。此结果证明这些本地测试通过，不代表生产认证、持久化或正式 SaaS 安全验收。
- 本阶段只读；未改业务代码、测试、配置、依赖、lockfile，也未同步主工作树业务文件。

### 下一份最小实现合同建议

`TASK20_G51A_LOCAL_SYNTHETIC_MEMBERSHIP_LIFECYCLE`：只在本地合成服务与管理端新增同租户/同校区员工列表、固定岗位/能力展示、停用/恢复/撤销；把 `memberships:read` / `memberships:manage` 接入共享身份能力校验；状态变更使已有会话失效；仅接受固定状态字段并拒绝额外正文；平台管理员、家长、负责人本人及跨范围目标不可被修改。保留固定岗位能力定义，不做真实邀请、真实账号、跨校区调岗或持久化。

建议写集：

- Core：`packages/contracts/src/identity.ts`、`packages/contracts/test/identity.test.ts`、`packages/auth/test/policy.test.ts`、`apps/api/src/local-synthetic/sessions.ts`、`apps/api/src/local-synthetic/routes.ts`、`apps/api/test/local-synthetic-membership.test.ts`。
- Admin：`apps/admin-web/src/main.ts`、`apps/admin-web/src/local-review/membership-management.ts`、`apps/admin-web/src/local-proxy.mjs`、`apps/admin-web/test/local-proxy.test.mjs`、`apps/admin-web/test/membership-management-browser.mjs`。
- 治理：下一份实现合同、`PLANS.md`、`docs/exec-plans/active/project-completion.md`。

此审计不等同于生产安全证明或正式 SaaS 就绪。下一切片也只覆盖本地合成演示中的成员生命周期，不宣称 G5.1 全部关闭。
