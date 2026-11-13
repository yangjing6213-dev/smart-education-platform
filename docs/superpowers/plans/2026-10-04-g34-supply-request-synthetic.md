# TASK20 / G3.4 物资申请合成实施合同

- 版本：2026-10-04
- 需求依据：`C:/Users/HU/Desktop/同芯机构项目/开发方案/student-care-platform-complete-plan-v2.0.pdf` 与 `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` G3.4。
- 当前目标：在现有本机共享服务上补齐“教师固定目录申请 → 负责人审核 → 领取/缺货/取消”的最小闭环。
- 运行边界：只使用明显标注的合成数据和内存会话；不接入真实认证、真实未成年人、真实采购、支付、数据库、伙伴云、正式 AI、文件存储或外部网络；不安装依赖、不改 lockfile、不提交、不推送、不部署、不发布。
- 授权来源：负责人已取消逐阶段授权并要求由执行者全权完成本地合成开发；本合同仅将该自主范围收敛为可审计的精确写集。

## 1. 最小行为

1. 教师只能在当前租户、校区和授权班级范围内，从固定目录选择物资、固定用途和 1—20 的数量；不开放自由文本、真实价格或采购地址。
2. 教师可以保存草稿、提交、撤回未处理申请和取消已退回申请；负责人只能在同一范围内确认、退回或标记缺货。
3. 已确认申请由教师或授权领取角色执行一次领取；领取和审核分别记录版本与本机审计动作，重复领取或旧版本操作失败。
4. 负责人和管理网页可看授权范围队列；平台管理员只看按状态汇总，不看申请明细、教师、班级或用途原文。
5. 申请状态只使用 `DRAFT`、`SUBMITTED`、`CONFIRMED`、`RETURNED`、`READY`、`OUT_OF_STOCK`、`CANCELLED`、`CLAIMED`；越权、跨范围、非法目录/数量/用途和旧版本操作必须失败。

## 2. 精确写集

### 共享本地服务 worktree

路径：`C:/Users/HU/.codex/worktrees/task20-local-shared-core`

- `packages/contracts/src/supply-request.ts`
- `packages/contracts/src/index.ts`
- `apps/api/src/local-synthetic/repository.ts`
- `apps/api/src/local-synthetic/sessions.ts`
- `apps/api/src/local-synthetic/routes.ts`
- `apps/api/src/local-synthetic/server.ts`
- `apps/api/src/local-synthetic/supply-request.service.ts`
- `apps/api/test/local-synthetic-supply-request.test.ts`
- `tests/local-synthetic/supply-request.test.mjs`
- `docs/exec-plans/active/supply-request-core.md`

### 用户网页 worktree

路径：`C:/Users/HU/.codex/worktrees/task20-web-completion`

- `apps/user-web/src/local-synthetic/client.ts`
- `apps/user-web/src/local-synthetic/supply-request.ts`
- `apps/user-web/src/local-synthetic/supply-request.test.ts`
- `apps/user-web/src/main.ts`
- `apps/user-web/src/styles/user-web.css`
- `apps/user-web/preview.mjs`
- `apps/user-web/test/supply-request-browser.mjs`
- `docs/exec-plans/active/web-supply-request.md`

### 管理网页 worktree

路径：`C:/Users/HU/.codex/worktrees/task20-admin-completion`

- `apps/admin-web/src/main.ts`
- `apps/admin-web/src/local-review/supply-request.ts`
- `apps/admin-web/src/local-proxy.mjs`
- `apps/admin-web/preview.mjs`
- `apps/admin-web/test/supply-request.test.mjs`
- `docs/exec-plans/active/admin-supply-request.md`

### 微信小程序 worktree

路径：`C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign`

- `apps/mini-program/pages/staff/quick-action/index.ts`
- `apps/mini-program/pages/staff/quick-action/index.wxml`
- `apps/mini-program/pages/staff/quick-action/index.wxss`
- `apps/mini-program/pages/staff/quick-action/index.js`（仅编译确有变化时）
- `apps/mini-program/src/pages/supply-request.ts`
- `apps/mini-program/src/pages/supply-request.test.ts`
- `apps/mini-program/src/local-synthetic/client.ts`
- `apps/mini-program/src/local-synthetic/client.js`（仅编译确有变化时）
- `apps/mini-program/src/local-synthetic/page.ts`
- `apps/mini-program/src/local-synthetic/page.js`（仅编译确有变化时）
- `apps/mini-program/templates/local-synthetic.wxml`
- `docs/exec-plans/active/mini-supply-request.md`

受保护文件：`apps/mini-program/src/pages/staff.test.ts`、`app.json`、所有 `index.json`、根配置、依赖和 lockfile 不得修改。

## 3. 实施与验证顺序

1. 先为共享服务写失败测试：固定目录/用途、数量边界、范围和角色、重复提交、审核/缺货/取消/领取、版本冲突和匿名平台汇总。
2. 实现内存服务和路由，再接通 Web、Admin 和 Mini；客户端不得传租户、校区或班级作为授权依据。
3. 每端增加页面级验证：教师创建/提交、负责人确认/退回/缺货、教师领取/取消；断言没有自由文本和外部请求。
4. 仅在生成内容确有变化时更新 `index.js`；运行类型检查、focused tests、浏览器 smoke、Mini runtime、ESLint、Prettier、`git diff --check` 和范围审计。

## 4. 验收标准

- 服务覆盖固定申请、提交、审核、退回、缺货、取消、领取和旧版本拒绝；越权读取/写入失败。
- Web/Admin browser smoke 完成教师→负责人→教师领取流程；平台角色只得到匿名计数；无页面错误、无外部请求。
- Mini typecheck、页面测试和页面注册/生成护栏通过；原生微信开发者工具未实点时保持 `NATIVE_NOT_RUN`。
- 写集之外无新增或修改；不得以复制旧 JS、降低断言或跳过范围检查代替实现。

## 5. 停止条件

发现需要修改合同写集外文件、增加路由或配置、接入真实服务/数据、安装依赖、修改 `staff.test.ts`/`app.json`/`index.json`，或必须保存真实采购信息时，停止并记录原因。

## 6. 2026-10-07 自主修正记录

- 原合同 SHA-256：`A836A08CC5DA7432A57B97F43E4E3EB61CA1E13F296F09F9AFFD6AEF28D3AF89`。
- 核对发现用户网页本地预览未转发物资接口，且前序健康、内部日报、月度反馈接口也未进入允许清单。依负责人持续自主本地开发授权，将既有 `apps/user-web/preview.mjs` 纳入精确写集，仅补上述已经实现接口的精确路径/方法，不放开任意代理或对外网络。
- 浏览器验证必须经过实际预览代理和实际本机共享服务，禁止通过请求拦截替换业务请求而把绕过代理的结果算作端到端通过。
- “确认”直接进入可领取状态 `READY`，减少额外操作；`CONFIRMED` 仅为保留枚举，不增加必须点击的中间步骤。缺货作为本次处理结果保留，不得阻止教师再次申请；不同目录或用途可并行申请，同目录同用途的有效申请防重复。
- Mini 核对发现新增物资面板原先只会在离线模式显示，进入“本机协同”后隐藏。为满足原目标中的同一申请协作，补入既有本机协同 client、page、模板及两个对应生成 JS；只为物资追加固定字段、当前身份权限、范围校验和版本化命令。独立离线展示继续保留并明确模式，不用离线结果替代共享结果。
- Mini 共享验证至少覆盖：Mini 发起→同机负责人审核→Mini 刷新并领取同一 ID；关闭服务/切换身份清空旧资料；旧版本和无权限动作拒绝。请求只发至既有 `http://127.0.0.1:4317`，不接入外部服务。原生工具点击证据仍独立记为 `NOT_RUN`。
