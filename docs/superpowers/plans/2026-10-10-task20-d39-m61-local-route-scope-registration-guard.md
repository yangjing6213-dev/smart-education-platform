# TASK20 D39：M6.1 本机业务路由范围登记护栏

## 目标

按项目方案 M6.1，为现有本机合成 API 增加自动检查，确保未来新增的 `/local/*` 业务接口显式经过身份和租户/校区范围校验。已有两个只返回角色目录、创建合成演示会话的入口允许公开；其他业务路由不得缺少身份或范围配置。

## 依据与基线

- 产品依据：PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 §10 M6.1 要求业务身份、成员、能力和对象范围隔离。
- 当前源码：`apps/api/src/local-synthetic/routes.ts` 通过共享 `config` 或带成员能力限制的配置注册业务路由；公共入口仅为 `GET /local/profiles` 和 `POST /local/sessions`。
- 缺口：`apps/api/test/scope.plugin.test.ts` 测插件行为，但没有检查本机业务路由注册是否持续使用身份和范围配置。

## 精确写集

- `apps/api/test/local-synthetic-scope-registration.test.ts`（新建）：使用仓库已安装的 TypeScript 语法树解析器检查本机业务路由；不安装依赖。
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 本合同文件。

不修改 API 服务、权限插件、路由、页面、配置、依赖或 lockfile；不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。保留所有现有未提交/未跟踪现场。

## 验收标准

1. 一个刻意缺少身份/范围配置的业务路由样例会被护栏识别，先以失败结果证明检测有效。
2. 合法的共享范围配置和继承该配置的成员能力配置通过；两个明确公开的合成演示入口被识别为仅有的例外。
3. 当前 `routes.ts` 中每个 `/local/*` 业务接口均通过护栏；新增未知注册方式不得静默漏检。
4. 相关 API 路由/成员测试、API typecheck、ESLint、Prettier、`git diff --check` 和精确写集审计通过。

## 边界与风险

- 这是注册完整性回归护栏，不是生产登录、数据库行级隔离、对象存储前缀、后台任务或真实租户安全认证。
- 仅使用现有源码和合成 API；不请求外网，不写入持久数据。
- 不提交、推送、部署、发布、安装依赖或更改 lockfile。

## 当前状态

- `TASK20_D39_STATUS=PASS_LOCAL_ROUTE_SCOPE_REGISTRATION_GUARD_WITH_VERIFICATION_SCOPE_DEVIATION_RECORDED`
- `TASK20_ACTIVE_TARGET=TASK20_D39_M61_LOCAL_ROUTE_SCOPE_REGISTRATION_GUARD`
- TDD 红灯已确认：无保护配置、缺少 `scopeRequired`、无保护动态路径、通过 app 别名注册的无保护路由和从 app 对象拆出的路由方法都会被检查拒绝。
- 当前路由核验支持直接 HTTP 方法、继承共享配置的路由，以及使用共享配置的 `app.route(...)` 辅助函数；仅豁免 `GET /local/profiles` 与 `POST /local/sessions`。
- API 定向测试 `19/19`、API TypeScript 检查、目标 ESLint、Prettier API 检查、`git diff --check` 和精确路径审计通过。
- Prettier CLI 未运行成功：已安装的 `prettier.cjs` 首字节异常，Node 报语法错误；未修改依赖。改用已安装 Prettier API 检查测试文件和本合同，通过；计划/路线图的大型既有文件只对本次新增范围做格式检查。
- 本合同 SHA-256 在治理记录同步后计算并登记；没有修改 API 运行时代码、配置、依赖或 lockfile。

## 范围偏离记录

- 最终检查期间，一条额外 Mini 全量测试命令因 Windows 反斜杠路径未被排除条件识别，意外执行了合同明确保护的 `apps/mini-program/src/pages/staff.test.ts`。全量尝试结果为 `227/229`，两项失败来自该文件的旧预期；该文件没有被修改。本项不属于 D39 验收，也不影响 D39 API 定向测试 `19/19` 的结果。
- 同一轮较早还运行过一次未限定路径的 `git diff --check`，它扫描了工作树中的全部差异，包括该受保护路径。该命令退出码为 0，只显示其他页面的换行符提示；后续差异检查已限定到 D39 文档路径。
- 这是执行范围偏离，已停止进一步 Mini 测试运行；后续继续工作时不会再读取、运行或修改该保护文件。
