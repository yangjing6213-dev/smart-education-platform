# TASK20 G4.4C Mini 资料受众兼容修复合同

## 0. 依据与当前授权

- 需求依据：`student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；项目统一控制面为 `PLANS.md` 与 `docs/exec-plans/active/project-completion.md`。
- 本任务属于负责人已授权的剩余项目本地开发，只使用固定合成数据和本机内存服务。
- Mini 隔离来源树：`C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`。开始前，Mini 客户端源码、测试和生成 JS 与主树逐文件 SHA 一致；来源树已有未跟踪的 `tests/mini-shared-service.test.mjs`，本合同只读取并运行它，不改写它。
- 已复现的问题：员工页面连接本机服务时，服务成功返回包含 `PARENT`、`TEACHER` 的合法资源受众列表，以及固定标签 `两位数加法与进位`；Mini `parseResource` 只接受 `TEACHER`、`OWNER`，其标签白名单也缺少该服务已有的固定标签。任一不匹配都会被连接流程收敛为 `DISCONNECTED`，让教师无法进入共享工作台。

## 1. 目标与修复边界

让 Mini 能接受资源服务返回的 `PARENT` 受众标记和现有固定标签 `两位数加法与进位`，同时保留固定枚举与当前会话角色必须出现在受众列表中的检查。该修复只改变 Mini 对现有共享服务响应的兼容性，不改变 API 资源范围、审核状态、权限或页面流程。

## 2. 精确写集

隔离来源树中允许：

- MODIFY `apps/mini-program/src/local-synthetic/client.test.ts`
- MODIFY `apps/mini-program/src/local-synthetic/client.ts`
- MODIFY `apps/mini-program/src/local-synthetic/client.js`，仅当 TypeScript 编译器报告输出内容变化

主工作树中允许：逐文件核对隔离来源结果后，选择性同步以上相同路径；`client.js` 仍仅在编译输出变化时同步。

治理记录允许：

- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- CREATE 本合同

来源树已有 `tests/mini-shared-service.test.mjs` 是只读验证材料，不加入本次写集。其余文件一律不改。

## 3. 禁止事项与停止条件

- 不改 Mini 页面、路由、`app.json`、`index.json`、配置、API、数据库、真实认证、伙伴云、正式 AI、依赖或 lockfile。
- 不读写 `apps/mini-program/src/pages/staff.test.ts`；不提交、推送、部署或发布。
- 保留既有未跟踪文件和回退工作树；不覆盖、不清理任何非本合同文件。
- 若来源树和主树的目标文件基线不再匹配、需要扩展至白名单外路径，或必须改变 API 数据范围才能修复，停止并记录原因。

## 4. TDD 与验证步骤

1. 在隔离来源树的现有 Mini 资源校验测试中，把有效资源受众改为 `PARENT` 与 `TEACHER`、固定标签改为 `两位数加法与进位`。先运行用例确认受众不兼容时失败；只补受众后再次运行，确认固定标签缺失仍让状态为 `DISCONNECTED`。
2. 仅扩展 `parseResource` 的固定受众集合为 `PARENT`、`TEACHER`、`OWNER`，并把服务当前实际使用的 `两位数加法与进位` 加入固定标签集合；保留 `audienceRoles.includes(role)`、数组长度、租户/校区/班级、发布状态和有效期检查。重新运行该用例，确认通过。
3. 运行 `tests/mini-shared-service.test.mjs` 的源码与生成 JS 两种模式，覆盖父家长、员工、负责人在同一服务上的页面连接与月反馈/资源流程。运行 Mini typecheck、页面注册/运行时一致性护栏、目标 ESLint、仅对编写的 TypeScript 源码和测试运行 Prettier、`git diff --check` 与精确路径审计；生成 JS 以编译一致性护栏验证，不另行格式化；只同步实际改变的 `client.js`。
4. 在主树先确认目标路径仍为本合同记录的基线，再逐文件选择性整合。复跑相同 Mini 聚焦测试、共享服务 Page 测试、类型检查、编译护栏、Lint、格式和差异/范围检查。不得把未执行的微信开发者工具人工点击写成通过。

## 5. 验收标准

- 原失败的教师服务连接转为 `READY`，资源列表接受合法的 `PARENT`、`TEACHER` 受众组合与现有固定学习标签。
- 仅包含其他角色（例如只包含 `OWNER`）的资源、未知标签仍被拒绝，且已有租户、校区、班级、状态和过期资源拒绝用例保持通过。
- 变更只包含第 2 节路径；Mini 生成 JS 仅在内容变化时更新并通过编译一致性检查；编译输出不做独立格式化；没有依赖、lockfile、真实数据或外部服务变化。
- 控制面明确区分本地自动验证、微信开发者工具人工验收和 Owner Review；本任务不关闭仍待完成的 G2.5 通知原生流程或 G4.4 Owner Review。

## 6. 当前状态

`IN_PROGRESS`。自动化回归已复现教师连接失败；根因已定位到受众与标签两个固定解析集合不完整。来源 Mini 客户端与共享 Page 回归当前源码模式均通过，生成 JS 与主树同步及完整验证尚未完成。
