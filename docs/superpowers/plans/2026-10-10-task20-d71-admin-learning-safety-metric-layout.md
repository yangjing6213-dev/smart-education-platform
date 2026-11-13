# TASK20 D71：Admin 学习安全指标卡片响应式布局

**状态：** `PASS_LOCAL_SYNTHETIC`
**日期：** 2026-10-10
**目标：** 把 20 项匿名学习安全指标从单列长列表改为清晰、自适应的卡片网格，并由桌面/手机浏览器断言验证。
**方案依据：** PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。
**发现依据：** D70 实际浏览器截图显示所有 20 张卡片纵向堆叠，页面缺少 `.learning-safety-grid` 布局样式。

## 1. 隔离工作树与基线

工作树：`C:\Users\HU\.codex\worktrees\task20-d71-admin-learning-safety-layout`
分支：`codex/task20-d71-admin-learning-safety-layout`

在隔离工作树中仅将主工作树以下当前文件作为只读起始内容复制后再编辑；复制前后确认哈希一致：

- `apps/admin-web/index.html`，主树基线 SHA-256 `D5420C21ED6F4F06BEDEB6BD6518FD251D1D1529BFCD143508B176F8B9854060`
- `apps/admin-web/test/learning-safety-browser.mjs`，主树基线 SHA-256 `45D02E211A475C204812DA0260BB2D1E9DC599BA20F334417CA136C100A094A6`

## 2. 精确写集

仅允许修改：

- `apps/admin-web/index.html`：新增作用于学习安全页的响应式指标网格和卡片样式；保留现有 Admin 共用视觉风格。
- `apps/admin-web/test/learning-safety-browser.mjs`：断言桌面多列、手机单列、20 项齐全、无溢出/重叠，并保留匿名范围及无外网断言。

治理记录仅允许修改本合同、`PLANS.md`、路线图和活动完成计划。Admin/API 源码、其他页面、测试、配置、生成文件、依赖和 lockfile 均禁止修改；禁止安装依赖、提交、推送、部署或发布。

## 3. 验收与验证

- 1280px：指标采用多列卡片网格，20 项全部可见，卡片边界不重叠。
- 390px：卡片改为单列，文字清晰，页面无横向滚动或卡片越界。
- 定向 Admin 学习安全测试 `4/4` 通过；浏览器 smoke 检查指标数据、布局、无页面错误/失败响应/外网请求。
- 在隔离树做语法、ESLint、Prettier API、范围审计；逐文件对比后才选择性同步到主树，再运行实际浏览器 smoke。
- 如需要修改任意白名单之外文件或修改指标内容，停止并另立任务合同。

不得运行会自动安装依赖的 `pnpm exec`；所有工具直接调用现有本地版本。

## 4. 完成记录

- 已在隔离工作树实现并选择性同步两项合同路径。桌面 `1280px` 实测为 4 列、20 张卡片；手机 `390px` 实测为 1 列，页面宽度与视口一致，无横向溢出。两种尺寸截图均已目视复核。
- 浏览器 smoke 退出码 `0`，覆盖 20 项、卡片不重叠、窄屏单列、匿名数据、无个人资料、无外网/失败请求/页面错误。截图位于系统临时目录 `task20-d71-admin-learning-safety-desktop.png` 和 `task20-d71-admin-learning-safety-mobile.png`。
- 定向 Admin 测试 `4/4`；ESLint、Node 语法检查、Prettier API 和限定文件 `git diff --check` 均通过。
- 主树与隔离树两项产品文件 SHA-256 相同：`apps/admin-web/index.html` `3D3618A33401EE3D5D91078AE9C13D5552E6AB2246D21D122F24268DDD8B9C8D`；`apps/admin-web/test/learning-safety-browser.mjs` `4DE099132EB21AB0510DFE7E9580526BF1D80289135FF9571D509FDB4B33DCB9`。
- 本任务没有安装依赖、修改锁文件或写集外文件，也没有提交、推送、部署或发布。Owner Review 与真实机构运行仍未由本任务完成。
