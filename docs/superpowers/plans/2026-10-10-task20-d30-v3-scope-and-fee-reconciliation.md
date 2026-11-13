# TASK20 D30：V3 租户范围与费用视图证据核对

## 目标

继续 V3 剩余项审计：复核 M6.1 本地租户/校区/成员/对象范围证据，并完成 D28 留下的 M6.2 Web、Mini 与 Admin 费用只读视图检查。只使用本机合成数据，不把本地通过写成生产安全验收。

全量 API 本机合成范围测试中，绑定成员与员工证照两组测试从编译目录启动时把仓库根路径解析到 `apps`，Fastify 因此解析失败，未进入业务用例。本任务允许给这两个测试增加现有 `LOCAL_SYNTHETIC_CORE_ROOT` 环境变量覆盖，修复运行入口，不改业务逻辑。

## 精确写集

- `apps/api/test/local-synthetic-membership.test.ts`
- `apps/api/test/local-synthetic-staff-credentials.test.ts`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 本合同

## 允许与禁止

- 允许只在上述两个 API 测试中修正测试根目录发现，优先支持显式 `LOCAL_SYNTHETIC_CORE_ROOT`，不改变其原有默认行为。
- 允许运行现有 API、Admin Web、User Web、Mini 费用及范围相关测试、类型检查、ESLint、Mini 页面注册护栏、Prettier API、`git diff --check` 和路径范围审计。
- 禁止修改业务实现、其他测试、Mini 页面、`apps/mini-program/src/pages/staff.test.ts`、路由、配置、依赖或 lockfile。
- 只用固定合成数据；不连接真实认证、数据库、伙伴云、外部服务或正式 AI；不提交、推送、部署或发布。

## 验收

1. 显式设置 `LOCAL_SYNTHETIC_CORE_ROOT` 后，原先无法启动的成员与员工证照测试进入实际用例并通过。
2. API 本机合成测试确认其余对象的跨租户/校区/班级/学生与旧关系边界；费用视图测试确认家长只见当前已审核关系对应的学生、平台端仅见匿名数量且无支付/退款写操作。
3. Web、Mini 与 Admin 定向费用测试通过；不得将自动化测试等同于微信开发者工具人工验收或负责人验收。
4. 同步 M6.2 当前证据与仍未完成的人工验收边界，写明下一阶段目标；不把 M6.1 的局部证据外推到尚未逐项核验的新对象。
5. 精确写集外没有修改；lockfile 未改；`git diff --check` 通过。

## 停止条件

如需修改上述白名单外文件、改业务逻辑、修改依赖/配置、使用真实数据或接外部服务，停止对应改动并记录原因。微信开发者工具或人工验收无法执行时记 `NOT_RUN`，不得用浏览器或源码检查代替。

## 执行记录

- **复现：** `node --test` 从编译输出运行完整 API 范围测试时，成员及员工证照测试里的相对根目录少回退一级，Fastify 指向不存在的 `apps/node_modules`；两项均在测试启动阶段失败，尚未执行断言。
- **费用基线：** API 费用 `8/8`、Admin 费用与平台摘要 `14/14`、User Web 家长费用/关系 `18/18`、Mini 家长费用/服务 `20/20`。
- **修复与复测：** 两个 API 测试支持显式仓库根环境变量后，API 本机合成范围全套 `96/96`；覆盖成员状态/旧会话失效和员工证照范围，其他 API 对象范围测试也全部通过。Admin 成员/绑定/成长范围 `18/18`、User Web 关系与成长 `16/16`、Mini 身份/多学生/绑定/成长 `40/40`。首轮未设置根目录时的失败只发生在测试启动阶段，不作为业务失败或通过证据。
- **其他已知回归复核：** Admin 物资流程 `12/12`；资源库真实本机浏览器流程输出 `PASS`，页面错误、失败响应、外部请求均为 0。此前记录的超时本轮未复现，原因未确认，不将它定性为产品缺陷。
- **验证：** API 构建/类型编译、Admin/User Web/Mini 类型检查、目标 API ESLint、Mini 页面注册护栏通过；D30 两个测试文件与四份 Markdown（新合同及三份记录的新增段落）Prettier API 检查通过。
- **范围：** 仅修改本合同列出的两个测试与四份治理记录。无业务逻辑、页面、配置或依赖变化；lockfile 未改。主工作树已有 `package.json` 修改没有触碰；`staff.test.ts` 未读取、运行或修改。
- **未运行：** 微信开发者工具人工点击/视觉和负责人 Owner Review。M6.1 生产权限验收、真实机构数据、支付或退款均不在本合同范围。
- **结果：** `PASS_LOCAL_AUTOMATED_EVIDENCE_PENDING_NATIVE_AND_OWNER_REVIEW`；下一任务为复核 V3 M4.3 资源生命周期在 User Web、Mini 与 Admin 的现有实现及测试是否一致。
