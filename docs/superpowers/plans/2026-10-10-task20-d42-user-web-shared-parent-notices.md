# TASK20 D42：家长网页接入共享通知

## 目标

补齐已复核到的本地功能缺口：管理网页发布的合成通知目前可由小程序家长查看和确认，但用户网页没有同一通知列表及回执入口。本批让 `/web/parent/home` 通过现有本机共享服务读取同一条通知，并提供“阅读”与“确认知悉”两个独立动作。

## 权威依据

- 项目方案 PDF v2.0：`C:/Users/HU/Desktop/同芯机构项目/开发方案/student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。
- V3 实施计划：`docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md`，SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。
- 既有证据：`PLANS.md` 中 M3.2 Notice API、D16 Mini 页面共享通知回归、D22 Admin 发布与 Mini 家长同 ID 回执记录；本轮核对的 User Web `/web/parent/home` 入口和本机预览代理。
- 本合同纠正 D40 的审阅覆盖：D40 复核的 Mini/Admin 通知流程不能证明 User Web 家长通知入口已接通。D40 的其他结论保留。

## 实施范围与精确写集

允许新增或修改以下路径：

1. `apps/user-web/src/local-synthetic/parent-notices.ts` — 本机通知客户端、严格响应校验、状态投影与面板渲染。
2. `apps/user-web/src/local-synthetic/parent-notices.test.ts` — 客户端、状态、版本和渲染测试。
3. `apps/user-web/src/main.ts` — 将家长通知面板接入现有 `/web/parent/home`。
4. `apps/user-web/preview.mjs` — 仅放行会用到的本机通知 GET/POST 路径。
5. `apps/user-web/src/styles/user-web.css` — 家长通知面板的窄屏和桌面样式。
6. `apps/user-web/test/parent-notices-browser.mjs` — 使用已有 Playwright，在临时本机合成服务上验证真实网页点击。
7. `PLANS.md` — 记录 D42 结果及唯一当前目标。
8. `docs/exec-plans/active/project-completion.md` — 维护同一活动执行记录。
9. `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` — 校准阶段状态、通知矩阵和缺陷状态摘要，保留历史证据。
10. 本合同。

不得编辑现有不在上述清单的文件。尤其不读、不运行、不修改 `apps/mini-program/src/pages/staff.test.ts`；本批不改 Mini/API、共享服务、管理网页、路由注册、依赖或 lockfile。

## 行为要求

- 页面只显示本机共享服务 `/local/notices` 中当前家长合成身份可见的已发布通知；断线、无权限和空列表均明确提示，绝不切换成预置假通知。
- 客户端只允许连接 `127.0.0.1`/`localhost`，使用 `credentials: omit`、`cache: no-store`、禁止重定向；本机代理仅放行通知列表读取、通知版本的阅读/确认写入和既有会话入口。
- 每条通知先显示“阅读通知”；阅读成功后才显示“确认知悉”。服务回执按家长身份和通知版本保存；更新版本后旧回执不沿用。
- 事件只携带当前已展示的 UUID 和版本；旧版本动作提示刷新，不能覆盖新状态。
- 沿用现有家长页卡片、字体、品牌绿和留白。布局在 390px 与桌面视口下不横向溢出，按钮可读且便于点击。
- 全部内容均为虚构合成数据。无真实消息发送、浏览器持久化、外网请求或新服务。

## 验收条件

1. 先写测试并观察预期失败，再写最小实现；覆盖响应校验、loopback/路径白名单、未阅读不能确认、阅读后可确认、回执独立及旧版本拒绝。
2. 本机集成测试用教师创建并提交同一通知、负责人审核发布、家长网页客户端读取并分别阅读/确认；确认 Admin/Mini 已使用的 Notice API 原有版本和范围规则。
3. Playwright 实际打开 `/web/parent/home`，由服务端教师/负责人建立可见通知，再通过网页按钮完成阅读与确认；确认刷新后仍为已确认、浏览器存储为空、无外网请求/页面错误/失败服务响应，390px 与桌面均无横向溢出。
4. User Web focused tests、typecheck、ESLint、Prettier（新增文件与本次编辑片段）、本地构建、目标空白检查及精确写集审计通过。
5. 复核 D42 文档：当前阶段表和功能矩阵不得把“已自动验证”写成微信原生实点、Owner Review 或生产可用；未完成门槛继续单列。

## 验证命令

- `corepack pnpm --filter @student-care/user-web test`
- `corepack pnpm --filter @student-care/user-web typecheck`
- `corepack pnpm --filter @student-care/user-web lint`
- `corepack pnpm --filter @student-care/user-web build`
- `node --test apps/user-web/test/parent-notices-browser.mjs`，并通过既有环境变量指定已构建的本机合成服务模块。
- 使用已安装 Prettier API 检查新增/修改文件及文档编辑范围；不运行全仓测试，不扫描受保护测试。
- 对十个合同路径执行 `git diff --check` 与状态/写集审计；不运行全工作树空白检查。

## 风险与停止条件

- 主工作树相关 Web 和治理文件已存在未提交改动。本批必须增量编辑、保留现有内容，不允许整文件从其他工作树覆盖。
- 若现有 API 的 `parent-alpha` 权限或 Notice 响应与合同不符，先停在本机测试并查明；不得为使页面通过而修改 API/权限/合成会话。
- 若需要改写集外路径、接入外部服务、改依赖/lockfile，停止并报告具体原因。
- 不做主树外复制、提交、推送、部署、发布或真实通知。
