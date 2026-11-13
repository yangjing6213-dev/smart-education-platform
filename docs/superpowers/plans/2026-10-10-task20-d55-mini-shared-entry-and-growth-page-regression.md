# TASK20 D55：小程序共享入口与成长记录页面回归

## 目标

修复员工快捷页进入共享演示模式后忽略 `section` 路由参数的问题，并验证新版共享模板中的成长记录选择、建草稿和审核入口确实能被员工页面操作。只修复已确认的本机流程断点，不另造第二套成长记录界面。

## 已确认的根因与范围

- D54 已让工作台路由携带 `section=parents`，但 `withLocalSynthetic` 在共享模式启用时跳过原页面 `onLoad`，导致 `section=parents` 被丢弃，页面仍停在默认“工作”区；这使员工看不到家长关系审核列表。
- 新版 `templates/local-synthetic.wxml` 已含“成长”分类、固定选项选择器和成长记录草稿按钮；旧的快捷页模板只保留说明文字。应验证共享模板的实际 Page 事件，不复制或重建重复表单。
- 所有数据仍走现有本机合成共享服务，身份、校区范围、审核与发布权限保持原样。

## 精确写集

- MODIFY `apps/mini-program/src/local-synthetic/page.ts`
- MODIFY `apps/mini-program/src/local-synthetic/page.js`（仅本任务 TypeScript 转译内容确有变化时）
- MODIFY `apps/mini-program/src/pages/shared-parent-workflows.test.ts`
- MODIFY `PLANS.md`
- MODIFY `docs/superpowers/plans/2026-10-10-task20-d54-mini-staff-binding-review-entry.md`（将 D54 结果更正为部分完成并记录 D55 跟进）
- CREATE 本合同

隔离工作树：`C:\Users\HU\.codex\worktrees\task20-d55-mini-shared-entry`。在隔离树中仅可从主树复制本写集文件的当前版本作为基线；不得复制或读取 `apps/mini-program/src/pages/staff.test.ts`。测试可在主树产品基线仍未整合 D55 实现时运行一次 RED；选择性同步获准文件后，必须在主树再运行同一 Page 集成测试的 GREEN。主树其余既有现场必须保留。

## 禁止范围

- 不读取、复制、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 不修改本合同写集之外的源代码、测试、路由、WXML、配置、页面注册、API、数据库或项目依赖。
- 不安装依赖、不修改 lockfile，不连接真实认证、数据、伙伴云或外部服务；本机合成回归只允许 loopback。
- 不覆盖或清理任何其他工作树/主树现场，不 commit、push、部署或发布。
- 不把本地 Page 自动化描述为微信开发者工具人工验收。

## 验收标准

1. 启用共享服务时，`onLoad({ section: "parents" })` 后员工快捷页仍处于“家长”分类；未知 section 仍由页面固定枚举回退到“工作”。
2. 使用“家长”入口的实际共享 Page 回归能看到现有家长申请并由有权机构负责人审核；普通教师仍不能审核。
3. “成长”分类有可见的固定选项控件；通过真实 Page `handleSharedCareField` 更改选项后，草稿动作会把该选择送入同一份共享成长记录。现有状态机与权限决定提交、审核、发布，不新增业务规则。
4. 从员工提交到负责人审核、发布及家长查看的本机共享回归通过；无网络外发和持久化。
5. 运行 focused tests（共享 Page 源码与生成 JS 两种模式）、定向 TypeScript、ESLint、Prettier API、生成 JS 语法检查、Mini 注册护栏、`git diff --check` 和精确路径审计。完整 Mini `tsconfig` 检查若会载入受保护测试则不得运行。
6. 微信开发者工具桌面实点无法控制时记为 `NOT_RUN`；Owner Review 与原生验收不冒充自动化证据。

## 验证方式

- 先扩展 `shared-parent-workflows.test.ts`：让员工 Page 通过 `onLoad` 接收 `section=parents`，并通过真实 Page handler 触发成长记录选项和草稿动作；在实现前观察入口测试失败。
- 最小修复共享包装器：共享模式下只为员工快捷页保留原页面 `onLoad(options)` 初始化，使页面读取已校验的 section；随后继续渲染共享状态。其他页面的加载行为不得改变。
- TypeScript 页面文件和测试按显式文件列表检查；不得使用 `tsconfig.json` 全项目入口。
- 用已安装 TypeScript API 按小程序 CommonJS 输出方式生成唯一获准的 `page.js`，并确认生成结果与当前源码一致。
- 在隔离树和选择性同步后主树分别验证允许的 focused 范围；审计修改文件，不暂存或清理其他现场。

## 当前状态

`PASS_LOCAL_SYNTHETIC;D54_SHARED_ENTRY_ROOT_CAUSE_FIXED;SOURCE_AND_GENERATED_TESTS_8_OF_8;WECHAT_NATIVE_NOT_RUN;OWNER_REVIEW_PENDING`

## 实施与验证结果

- 共享包装器现在仅在员工快捷页启用共享模式时，把 `onLoad(options)` 转交给原页面处理器；其他页面继续保持原来的加载行为。实际注册 Page 的回归先按预期复现 `section=parents` 被丢弃，再验证快捷页进入“家长”分类并仍按固定值回退未知分类。
- 同一页面回归实际选择成长记录固定选项、创建并提交草稿、由同校区有权负责人审核和发布，再由家长看到已发布记录、打开记录并读取详情。测试点击包含小程序真实按钮传入的关系编号和发布版本号；此为测试夹具完整性修正，不是新增业务规则。
- 主工作树 `node scripts/mini-safe-test-runner.mjs apps/mini-program/src/pages/shared-parent-workflows.test.ts apps/mini-program/src/pages/staff-verticals.test.ts`：源码模式 `8/8`、生成 JS 模式 `8/8`。明确未运行受保护的 `staff.test.ts`。
- 两个显式 TypeScript 检查（`page.ts` 的 ES2022/CommonJS 与测试的 ES2022/ESNext/Bundler）通过；目标 ESLint 与 Prettier API 检查通过；`page.js` 与已安装 TypeScript API 的转译结果逐字符一致，Node 语法检查和 Mini 页面注册护栏通过。
- 回归仅访问 `127.0.0.1` 的本机合成服务；测试拒绝 storage 调用并确认请求路径限于 `/local/`。`git diff --check` 退出码为 `0`，输出只有仓库既有换行格式提示。D55 没有写入依赖、lockfile、配置或白名单外业务文件。范围复核时主工作树另有一份与本任务无关的 `package.json` 测试命令差异（3 行新增、2 行调整），本任务未修改该文件并保留原样；`pnpm-lock.yaml` 未变。
- 微信开发者工具桌面实点和视觉验收未运行（`NOT_RUN`）；本地自动化结果不代表原生验收或 Owner Review。
