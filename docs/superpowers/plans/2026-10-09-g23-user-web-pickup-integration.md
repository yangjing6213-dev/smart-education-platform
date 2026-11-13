# TASK20 G2.3 User Web 家长接送授权接入合同

STATUS=IN_PROGRESS

## 1. 依据与目标

- 项目依据：`student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。
- 现有流程合同：`docs/superpowers/plans/2026-10-03-g23-pickup-authorization-and-verification.md`。G2.2 考勤及 G2.3 本地合成服务、Admin、Mini 已有阶段记录；本批只补主树 User Web `/web/parent/home` 当前缺少的家长接送入口。
- 目标：家长可在已有已审核关系中选择孩子，创建并二次确认临时/常用接送授权，生成仅当前页面内存显示的短时凭证，明确确认后撤销授权，查看完成接送历史并按日期过滤。
- 工程范围：`TASK20_G23_USER_WEB_PICKUP_MAIN_TREE_INTEGRATION`，仅本地合成数据，使用现有 G2.3 服务路由；不新增路由、不改服务端规则。

## 2. 精确写集

隔离工作树：`C:\Users\HU\.codex\worktrees\task20-g23-user-web-pickup-sync`。

允许新增或修改的产品文件仅为：

- `CREATE apps/user-web/src/local-synthetic/parent-pickup.ts`：家长端本地服务客户端及页面片段。
- `CREATE apps/user-web/src/local-synthetic/parent-pickup.test.ts`：家长投影、权限、输入安全和页面状态测试。
- `MODIFY apps/user-web/src/main.ts`：只在现有家长首页挂载/刷新/卸载接送面板并处理其动作。
- `MODIFY apps/user-web/src/styles/user-web.css`：新增有作用域的接送面板样式，沿用现有配色与按钮规范。
- `MODIFY apps/user-web/preview.mjs`：仅放行家长需要的本机接送 GET/POST 路径与 UUID 动作。
- `CREATE apps/user-web/test/parent-pickup-browser.mjs`：本地浏览器实际操作验证。

允许治理记录仅为：

- `MODIFY PLANS.md`
- `MODIFY docs/exec-plans/active/project-completion.md`
- `MODIFY docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `CREATE docs/superpowers/plans/2026-10-09-g23-user-web-pickup-integration.md`

为隔离测试建立主树 User Web 当前状态副本和复用已有 `node_modules` 连接仅用于测试基线，不属于可修改写集；这些副本不得提交到主树。隔离工作树中的 API 源码只读。回写主树前逐文件比对原始 SHA-256；任一目标文件在实施期间被他人改动即停止整合并保留隔离成果。

## 3. 明确禁止

- 不修改 API、数据库、Mini、Admin、其他页面、配置、依赖、lockfile、`staff.test.ts` 或任何写集外文件。
- 不新增路由、不保存授权/凭证到浏览器存储、不输出动态凭证到日志。
- 不使用真实学生、家长、接送人或机构资料；不接入真实认证、网络、通知、支付、伙伴云或正式 AI。
- 不清理、覆盖或回退既有脏文件/未跟踪文件；不提交、推送、部署、发布。
- 若已存在的本地服务路由、主树 API 构建或精确写集不满足验证，停止并记录证据，不扩展范围。

## 4. 验收要求

1. 只显示当前家长会话有权管理的已审核孩子；无已审核关系时给出清楚说明并隐藏授权表单。
2. 创建操作只接受固定接送人和授权类型及日期/时段；新建先呈现待确认状态，必须再点确认才生效。
3. 撤销操作必须显示二次确认；撤销后状态和历史保留，不能静默改写既有记录。
4. 短时凭证只在当前页面内存显示；页面离开、刷新、重新连接或授权变化后立即清空。
5. 家长历史只显示服务允许的安全字段，支持起止日期过滤；不显示其他监护人、教师内部信息或凭证。
6. 使用现有 `/web/parent/home`，不新增导航路由；现有费用、健康、成长、通知等面板保持工作。
7. 预览代理严格限制本机来源、方法、路径、请求头和载荷；不得开放通用代理。

## 5. 验证

- 先新增页面/客户端失败测试并确认按预期失败，再写实现。
- User Web 定向测试、TypeScript 检查、构建、ESLint、Prettier、浏览器流程、`git diff --check` 与精确写集审计。
- 浏览器使用一次性内存服务和独立会话，至少完成：批准关系预置 → 创建草稿 → 二次确认 → 生成凭证 → 撤销确认 → 日期筛选；同时断言没有凭证持久化、无页面错误、无非本机请求，并检查手机与桌面布局。
- 依赖外部工具的微信开发者工具实点不属于本批；未执行时明确记为 `NOT_RUN`。
- 通过后仅在主树目标文件 SHA 与开工快照一致时选择性整合同一写集中的产品增量，重跑主树定向验证；Owner Review 状态不代填。

## 6. 停止条件

需要改写集外文件、发现主树基线变化、服务路由/权限不足、必须引入新依赖或真实服务、不能安全隐藏凭证、或者验证发现授权越界时，立即停止扩张并报告具体证据。其余普通实现问题在本写集内修复并复验。
