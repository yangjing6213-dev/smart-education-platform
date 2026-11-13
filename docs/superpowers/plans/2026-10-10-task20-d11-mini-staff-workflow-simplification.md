# TASK20_D11_MINI_STAFF_WORKFLOW_SIMPLIFICATION

日期：2026-10-10  
状态：`PASS_LOCAL_SYNTHETIC_SELECTIVELY_SYNCED;OWNER_REVIEW_PENDING;NATIVE_VISUAL_NOT_RUN`  
来源：用户对项目开发的持续自主授权；V3 路线图 D11（员工快捷页混合多个业务和角色选择）  
实施工作树：`C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`  
分支/基线：`codex/task20-mini-brand-redesign` / `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`

## 目标

让员工小程序快捷页在共享服务模式下按“工作、成长、家长、其他”分组，每次只显示所选类别，并提供清楚的返回工作台入口。保留已有离线模式回退。页面操作继续使用现有共享服务、身份、校区范围和权限判断，不改变业务状态规则。

## 实施写集

只允许在实施工作树修改以下路径：

- `apps/mini-program/pages/staff/quick-action/index.ts`
- `apps/mini-program/pages/staff/quick-action/index.wxml`
- `apps/mini-program/pages/staff/quick-action/index.wxss`
- `apps/mini-program/pages/staff/quick-action/index.js`（仅本轮编译生成且内容变化时）
- `apps/mini-program/templates/local-synthetic.wxml`
- `apps/mini-program/src/pages/mini-workflow-ui.test.ts`

本合同和主工作树的 `PLANS.md`、`docs/exec-plans/active/project-completion.md` 属治理记录，不复制其他产品文件。完成隔离实施后，由主工作树仅选择性同步上列实际变化的 Mini 文件，并更新治理记录。

实施前基线 SHA-256：

| 路径 | SHA-256 |
| --- | --- |
| `apps/mini-program/pages/staff/quick-action/index.ts` | `7E167E8BDCCBA7970C2B4EE53925423DDCA50919FF4DD6112BEBED4DD2156466` |
| `apps/mini-program/pages/staff/quick-action/index.wxml` | `A500492DC774218199393A2086DBBE52B787FB40286B024425F3FF24BFE3FE9D` |
| `apps/mini-program/pages/staff/quick-action/index.wxss` | `0A5713EC13A6DD853D18A01E4A4DC6A861AF46E9ADC09BFF803A43E28B1742C1` |
| `apps/mini-program/pages/staff/quick-action/index.js` | `9C97C5C26B7C023E82E1119F0E529C1FE67DED7AB569216257CF3DA7EFE7B137` |
| `apps/mini-program/templates/local-synthetic.wxml` | `7A2C15950A9BFBC568A7414F270B886A4CB32F3A4E5670008E164C28CF2813D6` |
| `apps/mini-program/src/pages/mini-workflow-ui.test.ts` | `CBE69607B3650DF92557A101555A304E0BB920599F49AF67B86C5447F0303552` |

现有 Mini 页面测试基线：`node --experimental-strip-types --test apps/mini-program/src/pages/mini-workflow-ui.test.ts`，8/8 通过。

## 设计与行为约束

- 仅共享服务员工快捷页显示四个中文分类入口：工作、成长、家长、其他；使用项目现有绿黄半透明玻璃风格，不新增图标或依赖。
- 共享模式按类别收纳任务/日报、成长/考勤/健康、关系/请假/通知、资源/物资/接送；保持连接状态和身份切换入口始终可见。
- 快捷页一次只呈现一个类别；状态变化、刷新和身份切换不得改变现有服务端权限判断或跨范围规则。
- 离线模式原有完整演示内容保持在 `!sharedMode` 分支；不删除、不改写离线业务流程。
- 共享模式下在页面顶部提供返回工作台入口；不显示模板内面向访客首页的重复返回入口。
- 直接页面测试覆盖默认类别、有效切换、无效类别拒绝、返回页面后类别保持，以及共享/离线渲染边界。

## 验收与验证

1. 先扩展 `mini-workflow-ui.test.ts`，证明类别导航及共享/离线渲染规则；看到测试失败后再实现。
2. 源码模式与生成 JS 模式各运行该页面测试；Mini TypeScript 检查、ESLint、Prettier、Mini 页面注册/生成输出护栏、`git diff --check` 和精确路径审计通过。
3. 检查关键操作路径仍可从类别内完成，离线内容仍由共享服务关闭状态显示；不改变其余页面的共享模板表现。
4. 微信开发者工具交互控制通道当前不可用，因此原生视觉和触控验收只能如实记 `NOT_RUN`，不由静态测试替代。

## 禁止与停止条件

- 不修改本写集以外文件，不修改 `apps/mini-program/src/pages/staff.test.ts`、`app.json`、项目配置、API、数据库、依赖或 lockfile。
- 不改变页面路由、业务权限、身份来源、共享服务数据合同或真实外部连接；不引入真实数据、持久化、AI、机构服务。
- 不清理、回滚或覆盖实施工作树既有更改；不提交、推送、部署或发布。
- 若分类分组无法只靠本写集安全实现，或页面测试揭示业务合同需要改变，停止并记录缺口，不扩大写集。

## 实施结果

- 用新增页面用例先复现缺少 `staffSection` 分类状态（红灯）；完成分类状态与 WXML 后，源码页面测试 9/9、生成 JS 页面测试 9/9 通过。
- Mini 运行护栏测试 5/5；源树和主树 `mini-runtime.mjs` 均报告 11 个页面、34 个输出、0 个过期文件；仅快捷页 `index.js` 在编译后变化。
- Mini TypeScript 检查、ESLint、项目 Prettier API 检查（TS/WXSS/测试 3 个文件）、`git diff --check` 和六路径尾随空白检查通过。WXML 没有在当前工具链中配置格式化/微信编译器，记录为 `NOT_RUN`。
- 主工作树与实施基线 SHA-256 匹配后，选择性同步且哈希复核通过的文件共 6 个：快捷页 TS/WXML/WXSS/生成 JS、共享模板 WXML、Page 测试。
- 共享模式现仅呈现当前类别；学生选择和连接身份始终可见；员工返回工作台入口位于页首；离线演示原样保留在 `!sharedMode` 分支。共享服务权限、身份、数据范围及业务状态转换未改。
- 实际微信开发者工具视觉与触摸操作没有执行，仍为 `NOT_RUN`；本地测试不替代该验收。未改依赖、lockfile、`staff.test.ts`、路由或配置；未提交、推送、部署或发布。
