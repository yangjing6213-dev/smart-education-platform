# TASK20 D69：Admin 学习安全汇总浏览器复核

**状态：** `ROOT_CAUSE_CONFIRMED; FOLLOW_UP_D70_REQUIRED`
**日期：** 2026-10-10
**目标：** 对照项目方案 PDF v2.0 与 V3，使用当前电脑已有的本机浏览器工具，实际打开并复核 Admin 学习安全汇总页；不因 D67 的工具状态误判而跳过浏览器验收。
**方案依据：** PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。
**前序说明：** D68 的行为测试通过，但因隔离树内意外安装 185 个开发工具包，状态保留为 `PARTIAL_SCOPE_DEVIATION`。D69 不安装或增删任何依赖。

## 1. 页面与流程

目标页面：`/admin/learning-safety?profile=platform-admin`。

只读核对的现有文件：

- `apps/admin-web/src/main.ts`
- `apps/admin-web/src/local-review/learning-safety.ts`
- `apps/admin-web/test/learning-safety-browser.mjs`
- `apps/admin-web/preview.mjs`
- 当前已有 `apps/admin-web/dist` 与 `apps/api/dist`。

现有浏览器测试会启动本机合成服务和 loopback Admin 预览，打开 Chromium 并检查页面、匿名指标、横向溢出、页面异常、失败响应及外网请求。只使用虚构数据，不访问真实机构或外部服务。

## 2. 精确写集与禁止范围

只允许写入：

- 新建本合同
- `PLANS.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `docs/exec-plans/active/project-completion.md`

Admin/API 源码、测试、配置、构建产物及依赖均只读。禁止安装依赖、修改 lockfile、清理或覆盖现场、commit、push、部署和发布。

## 3. 验收点

1. 直接路由打开后，页面能显示“学习安全汇总”与 V2 合成指标。
2. 只呈现匿名总量，不出现学生姓名、个人标识或班级明细。
3. 页面宽度适配测试视口，无横向滚动。
4. 页面错误、失败响应与外网请求均为零；本地请求仅包含该页所需的会话与汇总请求。
5. 如遇浏览器启动失败、构建产物过期或出现产品行为缺陷，记录证据并停止，不装依赖、不改源码；另立修复合同。

## 4. 验证

仅运行已存在的浏览器验证入口：

```powershell
node apps/admin-web/test/learning-safety-browser.mjs
```

之后复核该命令退出码与定向输出、`git diff --check -- PLANS.md`、治理记录尾随空白、D69 精确写集与 package/lockfile 状态。不得运行会自动补装依赖的 `pnpm exec`。

## 5. 实际结果与根因

- `node apps/admin-web/test/learning-safety-browser.mjs` 退出码 `1`：页面标题与主体成功加载，但现有浏览器脚本等待“指标口径：V2（本机合成数据）”超时。
- 使用现有 Chromium 直接复现并查看页面截图：页面显示“安全汇总格式无效。”，指标卡片未显示；页面错误、失败响应与外网请求均为零，本地请求限于会话和学习汇总接口。
- 根因已确认是本地生成文件过期：`apps/api/src/local-synthetic/learning-session.service.ts` 返回 `LEARNING_SAFETY_V2`，而只读的 `apps/api/dist/src/local-synthetic/learning-session.service.js` 仍返回 `LEARNING_SAFETY_V1`。Admin 校验器按契约拒绝旧格式，因此浏览器脚本失败不是页面渲染异常，也不是指标 UI 缺失。
- 本任务按第 3 节停止条件未改任何业务源码、测试、配置、构建产物或依赖。下一步 D70 仅刷新这一服务的生成 JS 与 source map，再重复该浏览器流程；不以旧产物冒充当前源码。
- 截图保存在系统临时目录 `task20-d69-admin-learning-safety.png`，不纳入项目。

本轮仅证明定位出本机编译产物版本不一致；D69 浏览器验收未通过，不代表真实机构或生产环境状态。
