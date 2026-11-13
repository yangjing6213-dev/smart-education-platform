# TASK20 G5.3A 主工作树适配与选择性整合合同

状态：`PASS_ADMIN_MAIN_TREE_SYNC_2026-10-08;IMPLEMENTATION_OWNER_REVIEW_PENDING;CORE_API_REMAINS_ISOLATED_FOR_G6`

## 背景与目标

隔离实现 `2026-10-07-g53a-staff-credential-lifecycle.md` 已完成本地合成 API 与管理端验证，但主工作树的 API 采用正式路由/认证结构、没有 `local-synthetic` 服务；主树 `/admin/staff` 是静态页面，且 `apps/admin-web/src/main.ts` 有必须保留的既有未提交改动。直接复制 Core/Admin 隔离文件会带入未经选择的前序代码，不能安全同步。

本阶段在主工作树现有 `/admin/staff` 路由中完成最小的本机合成页面适配：仅内存数据、固定虚构校区与员工、固定资格类别、日期状态提示、创建/更新与版本历史。刷新后恢复预置示例。该页面不调用 API、网络、存储或上传；结果是可操作的本地演示，不冒充服务端权限或真实员工档案。统一服务接线仍列为 G6 集成工作。

实施同时修复当前脏 `main.ts` 相对页面组件的 6 处既有类型错误：三处不存在的 `unpublishAction`、审计页 `CONFLICT` 状态、未支持的 `scope` 参数以及不存在的 `summary` 返回值。只按现有页面组件类型改正调用，不改四个页面组件、不改变它们的功能。

## 隔离与基线

- 新隔离工作树：`C:\Users\HU\.codex\worktrees\task20-g53a-main-adapt`
- 分支：`codex/task20-g53a-main-adapt`
- 基础提交：`bd0001faa8e2fd7bbabe86e3d778ba24431107e8`
- 主树 `apps/admin-web/src/main.ts` 在隔离前的 SHA-256：`51A3E3BB3529D790D4FF565116F1D2502713AA5662B99AC8923C8402F6FA1102`。该文件只复制到新工作树作为完整上下文；回同步前再次核对此哈希，只有完全一致才可把工作树版本写回主树，否则停止并保留两边内容。
- 工作树依赖通过只读指向主树现有 `node_modules` 的本地 junction 使用；未安装或升级依赖、未改 lockfile。

## 精确写集

只允许修改或创建：

1. `apps/admin-web/src/main.ts`（保留快照内原有改动；只修复上面的 6 处类型错误，并接入现有 `/admin/staff` 页面）
2. `apps/admin-web/src/local-synthetic/staff-credentials.ts`（新增内存状态与固定规则）
3. `apps/admin-web/src/pages/staff-credentials.ts`（新增页面渲染和事件绑定）
4. `apps/admin-web/test/staff-credentials.test.mjs`（新增行为与页面边界测试）
5. `PLANS.md`
6. `docs/exec-plans/active/project-completion.md`
7. 本合同文件

隔离验证通过后，仅选择性回同步上述 1–4 项；其中 `main.ts` 必须先匹配隔离前哈希。不得覆盖任何已变化主树文件；新文件若已出现则先停止核对。

## 明确不做

- 不修改 `apps/api`、数据库、真实认证或成员权限，不增加 API 路由。
- 不读取或保存真实员工、证照、未成年人或机构资料；不接受证件号码、自由文本、照片或附件。
- 不使用浏览器本地存储、Cookie、网络、正式通知或外部服务；不接入上传、支付、AI 或伙伴云。
- 不修改组件源文件、页面路由表、依赖、lockfile、微信小程序、`staff.test.ts` 或合同写集外文件。
- 不提交、推送、部署或发布。

## 验收与验证

1. `pnpm exec tsc -p apps/admin-web/tsconfig.json --noEmit`：主 Admin 全量类型检查通过，包括修复原有基线类型错误。
2. `node --test apps/admin-web/test/staff-credentials.test.mjs`：固定类别、日期范围、到期提示、创建/更新、版本冲突、历史递增、拒绝自由文本及刷新不持久化规则通过。
3. 目标 ESLint、Prettier、`git diff --check`、目标路径审计通过；无新增依赖、网络请求或持久化调用。
4. 能使用现有浏览器工具时，对 `/admin/staff` 的创建、更新、只读和权限拒绝状态做本地点击复核；不可用则准确记为 `NOT_RUN`。
5. 主树 `main.ts` 同步前哈希一致，回同步后四个产品路径范围精确，主树 `git diff --check` 与管理端 typecheck 复验通过。

## 执行结果（2026-10-08）

- 同步前 `apps/admin-web/src/main.ts` SHA-256 与隔离快照完全一致；3 个新增目标不存在。只同步合同列出的四个 Admin 产品路径，主树与隔离树四文件 SHA-256 逐一相同。
- 主树 Admin typecheck、编译、既有与新增测试 11/11、ESLint、Prettier、目标路径 `git diff --check` 均通过。首轮测试因主树尚无编译输出而无法解析测试所需的 `dist` 模块；先运行合同范围内的 TypeScript 编译后重跑，通过。只读复核没有 Critical/Important 项；按复核修正下架按钮状态文案和审计冲突状态映射。
- Edge 实际本地点击复核通过新增、更新和版本历史、只读禁用及其“需要发布权限”文案、无权限提示、刷新后恢复预置示例，以及审计冲突提示；HTTP 请求仅访问 `127.0.0.1`，未接入真实网络服务。
- Core API 和数据库未同步，保持合同限定的 G6 后续集成；未进行或冒称实施 Owner Review。

## 停止条件

遇到白名单外改动需求、主树 `main.ts` 哈希变化、需要依赖/网络/后端/真实身份或保存个人数据时立即停止。不得用弱化类型、权限或行为断言制造通过。
