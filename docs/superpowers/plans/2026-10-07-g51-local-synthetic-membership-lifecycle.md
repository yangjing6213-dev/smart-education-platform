# TASK20 G5.1A 本地合成员工状态与能力门禁（2026-10-07）

**状态：** `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`
**来源审计：** `docs/superpowers/plans/2026-10-07-g51-tenant-role-object-scope-audit.md`
**审计 SHA-256：** `95C5054FEB3362A04E71FF878BCA895F4B4F38B68E099FBBF9E9FD8A145D327E`
**授权依据：** 用户已明确要求由助手全权推进本项目后续本地开发，并确认上一批复核通过、进入下一步。本合同只实施合成数据和本地服务，不扩展到真实账号或外部服务。

## 目标

在本地合成服务和机构管理端提供最小员工成员生命周期：显示当前校区合成员工及固定岗位/能力摘要；负责人可以停用、恢复或撤销可管理的成员；变更在服务端生效并立即使该成员已有会话失效。使用共享身份能力对读写操作设门禁，并保留租户/校区范围复核。

## 精确写集

### Core（隔离工作树 `C:\Users\HU\.codex\worktrees\task20-local-shared-core`）

- `packages/contracts/src/identity.ts`
- `packages/contracts/test/identity.test.ts`
- `packages/auth/test/policy.test.ts`
- `apps/api/src/local-synthetic/sessions.ts`
- `apps/api/src/local-synthetic/routes.ts`
- `apps/api/test/local-synthetic-membership.test.ts`（新增）

### Admin（隔离工作树 `C:\Users\HU\.codex\worktrees\task20-admin-completion`）

- `apps/admin-web/src/main.ts`
- `apps/admin-web/src/local-proxy.mjs`
- `apps/admin-web/src/local-review/membership-management.ts`（新增）
- `apps/admin-web/test/local-proxy.test.mjs`
- `apps/admin-web/test/membership-management-browser.mjs`（新增）

### 治理

- `docs/superpowers/plans/2026-10-07-g51-local-synthetic-membership-lifecycle.md`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`

验证允许写入被忽略的编译输出：Core `packages/*/dist`、`apps/api/dist`；Admin `apps/admin-web/dist`。不得把这些生成物纳入本次交付范围。

## 范围与规则

- 只用固定合成员工、租户、校区、班级和岗位；状态只存在本机服务内存中，服务重启后恢复预置状态。
- 只允许机构负责人读取当前租户/校区的员工清单和修改同一校区普通员工；不能修改负责人本人、其他负责人、家长、平台管理员、其他校区或其他机构成员。
- 岗位与能力来自固定合成 profile，页面只展示，不开放权限提升、跨校区调岗、自由编辑能力或自定义角色。
- 读操作要求 `memberships:read`，写操作要求新增共享能力 `memberships:manage`，并同时由本地业务动作和同租户/同校区目标检查保护。
- 状态变为 `SUSPENDED` 或 `REVOKED` 时，删除该成员所有现有本地会话；恢复为 `ACTIVE` 不复活旧会话，必须重新创建本地会话。`REVOKED` 在当前服务生命周期内不可恢复。
- 写请求只允许固定状态字段，额外字段一律拒绝；审计若实现，只记录合成操作者/目标 ID、前后状态与时间，不记录请求正文。
- 页面包含连接中、空列表、受限/失败和成功反馈；按钮按权限隐藏或禁用；使用现有后台风格与可访问语义。

## 明确不做

- 不接入真实认证、真实员工或学生数据、数据库、伙伴云、外部服务、短信、微信授权或持久化。
- 不修改 Mini、User Web、`staff.test.ts`、`app.json`、项目配置、依赖或 lockfile。
- 不改其他业务页面、路由或历史工作；不同步主工作树业务代码。
- 不 commit、push、部署、上传、发布或执行外部写入。

## 验收与验证

1. 先补回归测试并确认失败原因确为能力缺失/成员状态不可管理，再实现。
2. Core：contracts/auth/API focused tests、类型检查、ESLint、Prettier、API loopback 验证；覆盖负责人通过、员工/家长/平台身份拒绝、跨校区/跨租户拒绝、正文多余字段拒绝、停用/撤销即时失效、恢复不复活旧会话。
3. Admin：focused proxy 测试和真实本地浏览器操作；验证清单只显示授权校区合成员工、停用/恢复/撤销后刷新状态、无控制台错误/失败请求/外网请求。
4. 两工作树分别审查 `git diff --check`、精确写集和未跟踪文件；更新本合同与项目进度文件记录命令、结果、风险和未执行的微信原生复核。

## 停止条件

如必须修改写集外文件、引入依赖、变更真实认证/持久化/外部服务、放宽跨范围访问，或发现现有未提交内容无法安全共存，停止对应改动并报告。微信开发者工具人工点击若当前不可用，标为 `NOT_RUN`，不得以浏览器测试替代。

## 实施与验证记录（2026-10-07）

- Core 和 Admin 均在合同指定的隔离工作树中完成；只使用固定合成数据。没有安装依赖、改 lockfile、提交、推送、部署或同步业务代码到主工作树。工作树中原有其他脏文件和未跟踪文件均保留；例如 Core 的 `packages/contracts/src/index.ts` 已有与成员能力无关的导出增量，本任务没有修改它。
- Core：contracts/auth/tenant/API 源码类型编译通过；身份、能力策略、租户隔离、受保护 API 路由和新增成员状态测试合计 30/30 通过。API 类型编译采用本机 TypeScript Compiler API 路径映射并跳过第三方声明检查，因为隔离 worktree 的 workspace 链接不能由标准包解析直接使用；这证明所列源码可编译，不等同于标准 workspace 全量 typecheck。
- Admin：`node node_modules/typescript/bin/tsc -p apps/admin-web/tsconfig.json` 通过；目标 ESLint、Prettier 和 `git diff --check` 通过。`node --test apps/admin-web/test/local-proxy.test.mjs` 为 1/1 通过。
- Admin 本地真实浏览器：`node apps/admin-web/test/membership-management-browser.mjs` 通过。覆盖同校区员工列表、固定中文能力摘要、停用、恢复、撤销，以及一次人为模拟的 PATCH 503：页面保留“成员状态没有更新”提示、状态仍有效，再次操作成功。浏览器脚本错误、控制台错误、失败网络响应和外网请求均为 0。代理测试新增成员列表 `tenantId` 和成员状态记录 `campusId` 伪造查询拒绝断言。
- TDD 红灯：修复前浏览器回归在等待明确失败提示时超时；修复后同一场景通过。静态代码复核未发现成员读取/变更的租户或校区越权；复核指出的失败反馈问题已修正。
- 额外运行的既有物资申请浏览器回归 `node --test apps/admin-web/test/supply-request.test.mjs` 为 10/11：确认、领取、退回、缺货的浏览器用例超时，未找到确认按钮。它不在本合同写集中，根因尚未确认，本任务未修改物资模块。此前额外的资源库浏览器回归也报告等待固定示例记录超时，根因同样尚未确认；两项均保留为后续独立排查项，不能宣称相关整套 Admin 回归通过。
- 本环境 `pnpm` 为 11.19.0，而仓库要求 `>=11.22.0 <12.0.0`；因此 `pnpm exec tsc` 被版本门禁拒绝。没有安装/升级 pnpm；直接调用已安装的 TypeScript 编译器成功完成 Admin 类型检查。
- 微信开发者工具人工点击不适用于本 Admin/API 切片；Mini 未修改。G51A 的负责人验收尚未由用户单独确认；本记录只表示隔离工作树中的本地实现与所列验证完成。主工作树业务同步仍未执行。
