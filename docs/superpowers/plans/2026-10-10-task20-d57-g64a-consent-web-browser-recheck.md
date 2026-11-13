# TASK20 D57：G6.4A 家长同意网页本机流程修复

## 目标与已确认原因

- 目标：修复家长同意网页在本机预览使用临时服务端口时无法可靠连接的问题，并实测授权、期限到期复核、撤回流程。
- 当前代码有三处相互关联的接线缺口：`main.ts` 构造 `ParentConsentClient` 时使用默认固定端口 `127.0.0.1:4317`，没有使用预览页同源代理；`preview.mjs` 的 loopback 请求白名单没有放行关系申请写入、同意用途/记录/撤回/期限复核接口；同时页面初始化会读取个人信息申请记录，但代理白名单没有放行 `GET /local/privacy-requests`，导致初始化整体进入错误状态。
- 权威依据：项目方案 PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38B`。

## 隔离工作树与精确写集

- 隔离工作树：`C:\Users\HU\.codex\worktrees\task20-d57-g64a-consent-web`。
- 修改：
  - `apps/user-web/src/main.ts`
  - `apps/user-web/src/pages/parent-consent.test.ts`
  - `apps/user-web/preview.mjs`
  - `apps/user-web/test/preview.test.mjs`
  - `PLANS.md`
  - `docs/exec-plans/active/project-completion.md`
  - `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 新建：本合同。
- 隔离树基线可从主工作树逐文件复制上述四个 User Web 文件；另可只读复制 `apps/user-web/src/pages/parent-consent.ts` 用作测试导入基线。复制只用于建立该任务基线，不修改主工作树或其他文件。

## 允许与禁止

- 仅使用当前本机 loopback 合成服务、虚构家长/学生/负责人和合成授权记录；本机预览只转发固定方法及路径。
- 不修改 API、Admin、Mini、真实认证、真实数据、外部服务、依赖、lockfile 或不在写集中的页面/样式；不处理任何系统蓝屏、转储或分页文件设置。
- 不清理或覆盖既有工作树现场；不读取、复制、运行或修改 `apps/mini-program/src/pages/staff.test.ts`；不 commit、push、部署或发布。

## 验收

1. 先扩展回归测试，证明家长同意客户端使用当前预览页面来源，并验证 preview 代理只允许用途/记录读取、创建、撤回、期限复核、关系申请及页面初始化所需的个人信息申请列表读取；非法 ID、错误方法及未列入的路径继续拒绝。
2. 最小修复主页面同源代理接线和 preview allowlist，不放宽成通用代理。
3. focused User Web 同意页面测试及 preview 代理测试通过；定向类型、ESLint、Prettier API、`git diff --check` 与精确写集审计通过。
4. 用已安装的本机浏览器或已有浏览器工具实际操作页面：先让负责人审核合成关系，再家长提交授权；推进本地演示时钟后由负责人作期限处理；家长刷新看到处理结果并撤回。确认只请求 loopback、本机状态，页面无错误。
5. 如果当前环境没有可用的浏览器交互工具，则将浏览器流程准确记为 `NOT_RUN`，不得新装依赖；focused 测试通过也不代表实际页面操作已验证。

## D57 浏览器复核发现的必要范围补充

- 首次实际浏览器运行复现：关系已在 API 合成服务审核通过，浏览器成功请求会话、绑定、用途和同意记录，但页面仍显示“暂时无法连接本机服务”，因为初始化还会读取 `/local/privacy-requests`，该 GET 被精确白名单拒绝。
- 只补放行 `GET /local/privacy-requests`，供已存在的家长同意页完成状态读取；不允许新增或转发该路径的写入操作，仍拒绝所有未列出路径与方法。
- 该补充只修复当前页面既有初始化链路，不新增个人信息申请功能，不改 API、不扩张外部或真实服务范围。

执行 TypeScript 测试时，可在隔离工作树 `apps/user-web/.task20-d57-test-output/` 临时生成两个相关源码文件的转译结果供 Node 测试器加载；测试后删除该临时目录，不作为交付文件。不得复制或编译其他业务源文件来规避写集。

## 验证结果

- TDD 先确认完整页面失败：本机浏览器已显示审核通过的关系，但家长页面因 `GET /local/privacy-requests` 被代理拒绝而进入连接错误。新增精确白名单回归后，首次验证按预期以 `404` 失败；只放行该列表读取后，代理测试通过 `1/1`，写入仍被拒绝。
- 家长同意页面 focused tests `14/14`；User Web TypeScript `--noEmit` 检查和测试用转译构建通过；四个目标文件 ESLint 通过；`node --check` 两个 JavaScript 文件通过。
- 使用已安装的 Edge、390×844 浏览器视口和本机合成 API 实际操作：审核虚构关系、家长确认并撤回“成长记录”授权、家长授权“健康协作”、负责人推进期限到期、家长重新打开页面看到“已完成到期状态演练”。95 个浏览器网络请求全部发往当前本机预览来源；页面脚本错误为 0。临时视觉截图保存在系统临时目录 `task20-d57-consent-expiry.png`。
- Prettier API 对 D57 修改片段与本合同检查通过。完整 User Web 大文件已有格式差异，因此没有整文件重排；Prettier 命令入口本身因首字节异常无法启动，未修改依赖或该入口文件。
- 浏览器复核发现的额外读取只服务当前页面已有列表，既不新增个人信息申请功能，也不开放写入代理；未修改 API、真实数据、外部服务、配置、依赖或 lockfile。保护文件 `apps/mini-program/src/pages/staff.test.ts` 未读取、复制、运行或修改。

## 状态

`PASS_LOCAL_SYNTHETIC_BROWSER_FLOW;OWNER_REVIEW_AND_NATIVE_ACCEPTANCE_SEPARATE;PRODUCTION_GATES_OPEN`
