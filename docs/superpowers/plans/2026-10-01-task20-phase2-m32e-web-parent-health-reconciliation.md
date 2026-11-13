# TASK20_PHASE2_M32E_WEB_PARENT_HEALTH_RECONCILIATION

## 状态与依据

- `TASK_ID=TASK20_PHASE2_M32E_WEB_PARENT_HEALTH_RECONCILIATION`
- `AUTHORIZATION=GRANTED_BY_OWNER_CURRENT_REQUEST_2026-10-01`（仅本地、合成数据开发）
- `WORKTREE=C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`
- `REFERENCE_WORKTREE=C:\Users\HU\.codex\worktrees\task20-phase2-parent-relation-binding-contract`（只读）
- `V3=docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md`
- 本阶段只补齐新版工作树缺少的家长 Web 页面与健康异常 Web/Admin 页面；Mini 健康异常、家长请假和员工请假审核已在目标树中，不在本阶段修改。
- 来源工作树已有对应 Web/Admin 模拟实现和历史验证记录。本阶段以逐文件审查后的选择性迁入为起点，重新验证目标树与 M32D 的兼容性；来源工作树保持只读，不覆盖目标树现场。

## 目标与边界

在新版用户网页中恢复本地家长关系绑定、日报/通知、请假及健康摘要查看，并让教师能够进行健康异常固定选项上报与历史查看、授权审核员能够确认/退回/升级、单独发布或撤回家长摘要。家长仅在有效关系下看见已发布摘要，并能独立阅读和确认本机知悉。管理网页提供机构/校区范围审核与平台管理员匿名汇总。各应用使用彼此独立的合成内存，不声称跨端实时同步。

所有内容明确标为模拟数据，不输入自由文本、真人健康细节或身份信息。禁止网络、真实认证、API、数据库、伙伴云、推送、正式 AI、存储和新依赖。保留新版访客与员工页面、当前 M32D 请假审核、C2 Mini 绿黄 UI 及既有工作树现场。不得修改 Mini、`staff.test.ts`、`app.json`、`index.json`、项目配置、依赖或 lockfile；不提交、推送、部署或发布。

## 精确写集（17 条）

### 用户网页（14）

1. `MODIFY apps/user-web/src/main.ts`：合并家长本地页面与健康异常动作处理，保留目标树访客、员工、联系意向和 M32D 请假审核行为。
2. `CREATE apps/user-web/src/pages/parent-binding.ts`：合成关系绑定状态转换与页面。
3. `CREATE apps/user-web/src/pages/parent-binding.test.ts`：绑定、越权、失效关系测试。
4. `CREATE apps/user-web/src/pages/parent-home.ts`：家长首页投影与页面装配。
5. `CREATE apps/user-web/src/pages/parent-updates.ts`：日报/站内模拟通知读取和知悉。
6. `CREATE apps/user-web/src/pages/parent-updates.test.ts`：范围、状态、重复与回执测试。
7. `CREATE apps/user-web/src/pages/parent-leave.ts`：家长固定选项请假展示与操作。
8. `CREATE apps/user-web/src/pages/parent-leave.test.ts`：请假状态、范围与撤销测试。
9. `CREATE apps/user-web/src/pages/parent-health.ts`：已发布健康摘要投影与独立知悉回执。
10. `CREATE apps/user-web/src/pages/parent-health.test.ts`：发布/撤回、绑定失效及回执测试。
11. `CREATE apps/user-web/src/pages/health-incident-workflow.ts`：固定选项健康异常状态、范围校验、审核/批量、发布和家长投影。
12. `CREATE apps/user-web/src/pages/health-incident-workflow.test.ts`：六态、权限、版本、整批原子性、发布/撤回与无副作用测试。
13. `MODIFY apps/user-web/src/pages/staff-report.tsx`：在既有员工报告页接入健康异常模拟控件，沿用现有站点样式。
14. `CREATE tests/e2e/health-incident-review.spec.ts`：绑定、上报、人工审核发布、家长知悉、撤回、匿名管理和无网络浏览器流程。

### 管理网页（3）

15. `MODIFY apps/admin-web/src/main.ts`：在保留 M32D 请假审核的同时加入健康异常审核入口和范围模式。
16. `CREATE apps/admin-web/src/pages/health-incident-review.tsx`：机构/校区审核及平台管理员匿名汇总。
17. `CREATE apps/admin-web/test/health-incident-review.test.mjs`：角色、范围、状态转换和匿名汇总测试。

除上述 17 条外不写项目路径。仅可由既有构建流程更新忽略的 `dist` 输出；不得删除或清理任何输出。开始前需记录目标树 HEAD、index、17 条路径存在状态与 SHA-256。若任何既存内容不能安全合并，停止而不覆盖。

## 验收与验证

- 家长网页关系未审核/失效时不显示学生摘要；固定模拟绑定通过后仅显示合成资料。日报、通知、请假、健康查看均按当前关系范围过滤；家长回执独立于业务状态。
- `/staff/report` 提供健康异常教师/审核演示；确认与发布分离，撤回发布立即隐藏家长摘要；Web 批量动作先校验整批，任一无效则零项变更。
- Admin 机构/校区角色仅看当前合成范围；平台管理员仅见不能反推个体的汇总计数，不出现学生行或健康详情。
- 保留 `/staff/leave-review` 的审核和 M32D 既有测试行为。
- 在目标树运行：Web/Admin typecheck、Web build、家长/健康/请假审核 focused tests、健康 E2E、现有 Mini parent/health/leave/staff focused tests、Mini typecheck、页面注册护栏、ESLint、Prettier、`git diff --check`、精确范围审计和源码网络/存储审计。
- 对 Web 和 Admin 用已有浏览器运行 320×568、390×844、1365×900：核对窄屏无溢出/重叠，键盘操作、成功/错误态、浏览器错误、失败/外部请求与存储调用均为零。
- 微信开发者工具未由本助手控制；若没有本轮人工复核回报，Mini 原生编译/视觉状态保持 `NOT_RUN`，不得用网页浏览器截图代替。

## 执行顺序与停止条件

1. 保存目标树基线清单；将新增测试先放入目标树并运行，观察因对应页面/模块未接入而失败，再逐批迁入已验证的来源实现。
2. 对 `main.ts` 和 `staff-report.tsx` 做语义合并，保留目标树现有访问者、员工与请假审核内容；运行测试、类型、Lint、格式和本地浏览器检查。
3. 审查精确 diff、路径和无网络/存储结果，记录回执。旧来源树保持只读。

若发现必须修改第 2 节以外路径、需要新增依赖或服务、Mini 注册/项目配置变化、真实个人信息，或合并会覆盖目标树无法恢复的现有修改，立即停止并报告。单一失败最多针对原因修复两轮；之后标记 `PRODUCT_ISSUE` 或 `INFRASTRUCTURE_ISSUE`。不得提交、推送、部署或发布。
