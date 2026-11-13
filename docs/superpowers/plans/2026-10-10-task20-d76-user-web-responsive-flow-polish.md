# TASK20 D76：User Web 窄屏流程样式修复

日期：2026-10-10  
状态：`PASS_LOCAL_SYNTHETIC_UI_REPAIR;OWNER_REVIEW_PENDING`  
工作树：`C:\Users\HU\.codex\worktrees\task20-d76-user-web-layout`

## 1. 目标与依据

D76 处理本地浏览器复核发现的 User Web 真实布局缺陷：390px 页面宽度下，日报/通知区域中的短按钮被挤窄后逐字换行；成长记录填写与审核面板复用通用卡片外观，但其下拉框、复选框、记录卡和操作按钮没有对应样式，导致操作项横向挤在一起。此次只整理显示，不改变业务状态、权限、数据、请求或路由。

审计记录：使用本机合成服务 `127.0.0.1:4317` 和 User Web 本地预览，在 390×844 视口实际打开 `/web/parent/home`、`/web/parent/binding`、`/staff/workbench`、`/staff/report`。修复前 `/staff/report` 的 `[data-staff-daily-refresh]` 实测为 56×64px；成长记录区存在未定宽的原生 select。User Web `dist/styles/user-web.css` 与源 CSS 的 SHA-256 相同，已排除预览 CSS 过期。

D75 所列微信开发者工具实点验收仍未完成；D76 是由独立网页实测缺陷触发的并行本地修复，不宣称 Mini 验收通过，也不替代该人工步骤。

## 2. 精确写集

仅允许：

- `apps/user-web/src/styles/user-web.css`（修改）
- `docs/superpowers/plans/2026-10-10-task20-d76-user-web-responsive-flow-polish.md`（新增本合同并记录结果）

主工作树完成复核后，由负责人选择性同步 CSS 增量，并更新 `PLANS.md` 与 `docs/exec-plans/active/project-completion.md` 的治理状态；上述同步不属于本隔离实现写集。

## 3. 允许行为与禁止事项

允许为日报、月度反馈、家长通知和成长记录面板添加有范围的响应式 CSS，使控件保持可读、按钮不逐字折行、选择框填满可用宽度、记录和操作区清楚分组。

禁止修改 HTML/TypeScript 业务实现、测试、API、Mini、Admin Web、路由、权限、数据、配置、依赖或 lockfile；禁止安装依赖、连接外部服务、commit、push、部署和发布。不得更改用户工作树中的其他内容。

## 4. 验收与验证

- 在 390×844 与 1280×900 视口检查家长首页和员工日报页面。
- “刷新”类按钮保持完整单行文本；成长记录字段纵向排列、输入控件不超出卡片，卡片操作区换行后仍可点击；横向无页面溢出。
- 检查浏览器错误、失败请求、外网请求及浏览器本地存储；仅允许本机合成服务请求，不写浏览器本地存储。
- 运行 User Web 测试、typecheck、ESLint、Prettier、build、`git diff --check` 与精确写集审计。无依赖安装。

## 5. 停止条件

如需改写集以外业务路径、变更业务逻辑/路由/服务、安装依赖，或浏览器检查发现按钮行为而非样式错误，立即停止并记录证据，不扩大范围。

## 6. 验证结果

- 浏览器复核：先注入隔离工作树样式比对，再在实际构建输出上于 390×844 与 1280×844 打开家长首页、员工工作台和日报页；六个组合均无横向溢出、页面错误、失败请求、外部请求或本地存储写入。实际点击家长通知刷新与员工日报刷新，页面状态正常更新。
- 复现指标：日报刷新按钮从 56×64px 调整为 64×40px；家长通知刷新按钮从 114×72px 调整为 114×52px；成长记录下拉框宽度与字段容器一致（手机 282/282px、桌面 668/668px），高度 44px。
- 实际构建截图保存在 `%TEMP%\task20-d76-web-review\`，文件名包括 `parent-built-390.png`、`report-built-390.png`、`staff-built-390.png` 及对应的 `*-built-1280.png`。
- `corepack pnpm --filter @student-care/user-web test`：`118/118`；`typecheck`、`lint`、`build` 均退出码 0。构建后的 `src/styles/user-web.css` 与 `dist/styles/user-web.css` SHA-256 相同。
- `git diff --check -- apps/user-web/src/styles/user-web.css`：通过；D76 CSS 增量对比无空白错误；精确同步只追加 D76 区块并新增本合同。
- Prettier：D76 新增 CSS 块和本合同经已安装 Prettier 3.9.6 的模块接口检查均通过；全文件检查因既存第 17 行长 `font-family` 格式不同而失败。仓库 Prettier CLI 入口文件首字节异常，直接执行时报语法错误；未改依赖或格式化无关旧内容。
- 本任务只说明 User Web 本地样式修复通过；微信开发者工具 Mini 原生实点、负责人验收和生产能力仍未完成。
