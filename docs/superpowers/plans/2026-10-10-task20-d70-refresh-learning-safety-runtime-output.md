# TASK20 D70：刷新学习安全汇总本机运行文件

**状态：** `PASS_LOCAL_SYNTHETIC; BROWSER_SMOKE_PASS`
**日期：** 2026-10-10
**目标：** 使 Admin 浏览器 smoke 使用与当前 API TypeScript 源码一致的本机生成文件，恢复匿名学习指标显示。
**方案依据：** PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。
**根因证据：** D69 浏览器显示“安全汇总格式无效”；`apps/api/src/local-synthetic/learning-session.service.ts` 为 `LEARNING_SAFETY_V2`，而当前本机生成 JS 仍为 `LEARNING_SAFETY_V1`。

## 1. 最小写集

只允许刷新以下由现有 API TypeScript 源码生成的本机文件：

- `apps/api/dist/src/local-synthetic/learning-session.service.js`
- `apps/api/dist/src/local-synthetic/learning-session.service.js.map`

只允许同步治理记录：

- 新建本合同
- `PLANS.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `docs/exec-plans/active/project-completion.md`

API/Admin 源文件、测试、配置、package 清单、lockfile、其他生成文件及 Mini/Web 页面均只读。禁止安装/删除依赖、提交、推送、部署或发布。

## 2. 实施方式与停止条件

- 先用现有 TypeScript 编译器读取 `apps/api/tsconfig.json`，在内存中生成该源文件的 JS 和 source map。
- 写盘前确认输出只对应上述两个精确目标文件；如编译设置无法保证该写集、出现任何额外生成输出，立即停止。
- 只根据当前源文件更新本地忽略的运行输出，不修改源逻辑或修补浏览器断言。
- 若 `apps/admin-web/test/learning-safety-browser.mjs` 仍失败，保留证据并停止，不扩大写集。

## 3. 验收

1. API 项目 `tsc --noEmit` 通过。
2. Admin 定向学习安全测试通过。
3. 生成 JS 包含 `LEARNING_SAFETY_V2`，与当前源文件版本一致；source map 对应当前源路径。
4. `node apps/admin-web/test/learning-safety-browser.mjs` 通过，浏览器显示匿名 V2 指标，无横向溢出、页面异常、失败响应或外网请求。
5. 两个获准生成文件之外没有新生成/修改文件；依赖及 lockfile 状态不变。

## 4. 验证命令

只调用现有工具，不调用会触发依赖安装的 `pnpm exec`：

```powershell
node_modules/.bin/tsc.cmd --noEmit -p apps/api/tsconfig.json
node --experimental-strip-types --test apps/admin-web/test/learning-safety.test.mjs
node apps/admin-web/test/learning-safety-browser.mjs
```

最终记录两个生成文件的 SHA-256，复核精确写集及 `git diff --check -- PLANS.md`。

## 5. 最终结果

- API TypeScript 检查通过；Admin 学习安全定向测试 `4/4` 通过。
- 仅按项目 ESM 模块格式刷新本合同列出的 JS 与 source map。第一次内存转译尝试生成 CommonJS，浏览器运行时及时拒绝；改为 ESNext 模块格式后输出只含 `LEARNING_SAFETY_V2`，source map 指向当前源文件。
- Admin 浏览器 smoke `PASS`：V2 指标口径可见，20 张匿名指标卡片均渲染；1280px 视口没有横向溢出；页面异常、失败响应和外网请求为零。仅本机请求会话与合成汇总接口。截图保存于系统临时目录 `task20-d70-admin-learning-safety.png`，不纳入项目。
- 根因是本机 API 生成 JS 滞后于当前 TypeScript 源文件，并非源页面逻辑缺失。只刷新两个精确生成文件；未修改 API/Admin 源码、测试、配置、package 清单或 lockfile，也未安装依赖。
- 此验证不代表真实学习效果、真实学生数据安全、Owner Review 或生产就绪。
