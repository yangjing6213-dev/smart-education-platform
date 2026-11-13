# TASK20 D26：小程序操作文案正式化

## 目标与依据

项目负责人已授权自主继续本地开发。依据 PDF V2.0（SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`）、V3 路线图和此前明确的界面要求，清理家长授权及员工物资申请中残留的“演示/模拟”操作提示，使按钮、状态和操作说明读起来像正式功能。

合成数据披露仍必须清晰保留：例如“模拟数据”、仅本机使用、不处理真实资料。不得把本机记录描述成已处理真实资料。

## 精确写集

- MODIFY `apps/mini-program/pages/parent/consent/index.wxml`
- MODIFY `apps/mini-program/pages/parent/consent/index.ts`
- MODIFY `apps/mini-program/pages/parent/consent/index.js`（仅由本轮 TypeScript 编译结果确有变化时）
- MODIFY `apps/mini-program/src/pages/parent/consent.test.ts`
- MODIFY `apps/mini-program/pages/staff/quick-action/index.wxml`
- MODIFY `apps/mini-program/pages/staff/quick-action/index.ts`
- MODIFY `apps/mini-program/pages/staff/quick-action/index.js`（仅由本轮 TypeScript 编译结果确有变化时）
- MODIFY `apps/mini-program/src/pages/supply-request.ts`
- MODIFY `apps/mini-program/src/pages/supply-request.test.ts`
- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- CREATE this contract

## 禁止范围

- 不修改写集以外路径、页面路由、`app.json`、项目配置、其他测试、API、数据库或依赖/lockfile。
- 不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 不删除合成数据披露，不接真实服务、真实资料、外网或持久化；不提交、推送、部署或发布。
- 微信开发者工具人工点击不是本任务验收项；不得将源码测试写成真实视觉验收。

## TDD 与验收

1. 先扩展既有家长授权和物资申请页面测试，要求正式操作文案不含“模拟/演示/演练”，同时确认必要的“模拟数据/本机/不处理真实资料”披露仍存在；先看到目标断言因旧文案失败。
2. 只改合同内 WXML/TypeScript 文案；用 TypeScript 编译结果更新且仅更新发生变化的两个页面 JS。`src/pages/supply-request.ts` 是无运行时导入的纯模型测试文件，没有对应生成 JS，不新建此文件。
3. 页面测试在源码与生成页面模式通过；再运行 Mini TypeScript、目标 ESLint/Prettier、页面注册生成文件护栏、`git diff --check` 与精确路径审计。
4. 如编译生成写集外文件、需要改动数据语义或必须删除合成披露，停止并报告，不扩展范围。

## 结果

- TDD 红测按预期捕获两处旧操作文案；改写 WXML 与 TypeScript 文案后，家长授权和物资页面聚焦测试源码模式 `19/19`、生成页面模式 `19/19` 通过。
- 31 个 Mini 页面测试文件全量 `217/217` 通过，排除且未读取、运行或修改受保护的 `staff.test.ts`。
- Mini TypeScript `--noEmit` 检查通过；五个改动的 TypeScript/测试文件 ESLint 与 Prettier API 检查通过。
- 仅更新变化的 `pages/parent/consent/index.js` 与 `pages/staff/quick-action/index.js`；TypeScript 编译结果逐字核对一致。`src/pages/supply-request.ts` 没有运行时 JS 输出，不创建该文件。页面注册护栏要求生成 JS 后通过。
- 操作文案已无“模拟申请、演示意向、本机演示”等旧用语；保留“模拟数据”、本机范围及不处理真实资料的提示。没有真实资料或外部服务接入。
- 微信开发者工具实际点击/视觉验收未运行，本任务不宣称原生验收通过。Prettier API 对本合同及三个新增记录段落通过；`git diff --check` 通过，只有其他既有文件的换行符提示。写入路径均在合同写集，lockfile 未改，最终 SHA 记入 `PLANS.md`。
