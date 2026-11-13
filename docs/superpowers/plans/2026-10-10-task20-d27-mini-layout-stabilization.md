# TASK20 D27：小程序首页与员工控件排版稳定

## 目标与依据

继续执行 V3 路线图中的 D10 Mini 原生控件稳定化。近期截图显示首页“校园动态”标题被压成竖排、右侧箭头异常放大，以及员工操作区按钮纵向堆叠。代码审查确认活动标题行允许内容缩小，箭头仅设置基础尺寸，尚未限制最大尺寸；工作台与快捷页虽已声明横向排列，但按钮尺寸/对齐约束不够明确。

本批只加固现有小程序布局，不新增页面或业务流程。保留绿黄品牌与透明玻璃样式；不连接真实服务。微信开发者工具当前不可交互，本轮只以源码断言、编译页面测试和样式规则复核，不宣称原生视觉验收。

## 精确写集

- `apps/mini-program/src/pages/mini-brand-ui.test.ts`
- `apps/mini-program/pages/visitor/home/index.wxss`
- `apps/mini-program/pages/staff/workbench/index.wxss`
- `apps/mini-program/pages/staff/quick-action/index.wxss`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 本合同文件

不修改 WXML、TypeScript、生成 JS、`app.wxss`、页面注册、`staff.test.ts`、依赖或 lockfile。

## 实施与验收

1. 先在既有 `mini-brand-ui.test.ts` 增加失败断言：活动标题及右侧提示保持一行；首页三类右箭头宽高都限制为 28rpx 且不可拉伸；员工工作台与快捷页的两按钮组保持横向、按钮文字水平/垂直居中并按文字自然定宽；返回按钮保持左对齐。
2. 仅在写集 WXSS 中补齐相应约束，不改变颜色、文案、页面结构和按钮动作。小屏宽度允许自然换行，按钮不得溢出或互相覆盖。
3. 运行 Mini UI 聚焦测试、Mini 全量页面测试（排除受保护的 `staff.test.ts`）、Mini typecheck、目标 ESLint、Prettier API 格式检查、页面注册护栏、`git diff --check` 与精确写集审计。
4. 若需要 WXML/TS/生成 JS、全局配置或其他页面才能修复，先停下并更新合同，不扩张写集。

## 完成记录

### 失败复现与修复

- 新增的首页布局和员工按钮约束测试先运行，6 项中原有 4 项通过、2 项按预期失败：校园动态提示没有独立横排规则，员工按钮没有页面级居中/自然宽度约束。
- 首页把校园动态标题组设为可伸缩主体，右侧提示固定横排；访客首页三类右箭头固定为 28rpx，禁止被图片固有尺寸撑大。
- 工作台与快捷页操作按钮明确采用内容自然宽度、双向居中和横排换行；共享返回按钮继续左对齐。窄屏仍可换行并受容器最大宽度限制。
- 未修改 WXML、业务 TypeScript 或生成 JS，也未更改按钮操作、颜色或业务流程。

### 验证结果

- Mini 全部 31 个源测试文件共 `219/219` 通过，排除受保护的 `staff.test.ts`；最初页面子集因未提供已有 `LOCAL_SYNTHETIC_CORE_ROOT` 环境变量而出现导入失败，使用项目记录的共享核心路径重跑后通过，未修改测试路径或文件。
- Mini TypeScript、目标 ESLint、Prettier API（测试、三份 WXSS 与本合同）、页面注册生成文件护栏和 `git diff --check` 通过；lockfile 无变化。
- 微信开发者工具真实点击与视觉验收仍为 `NOT_RUN`（工具当前 `CONNECT_ERROR`）；本结果只证明源码布局规则和自动化，不代表原生屏幕验收。
- 实际修改路径均属于本合同写集。最终 SHA-256 记于 `PLANS.md`。
