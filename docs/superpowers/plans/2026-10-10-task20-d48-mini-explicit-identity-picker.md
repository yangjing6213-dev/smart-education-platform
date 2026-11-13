# TASK20 D48 Mini 身份选择器明确化

> 复用当前 Task 20 完成计划和 V3 路线图；与 D47 共用审计依据，不另起长期计划。

## 0. 依据与基线

- **任务 ID：** `TASK20_D48_MINI_EXPLICIT_IDENTITY_PICKER`。
- **依据：** 项目负责人已授权继续剩余项目本地开发，不再逐项等待普通开发许可；D47 独立复核发现冷启动虽未创建会话，但 picker `value=0` 会预选首个虚构身份。代码核对还发现“重新连接”处理器在没有选择时会回退到默认家长/员工身份。
- **隔离工作树：** `C:\Users\HU\.codex\worktrees\task20-d46-mini-shared-default-entry`。写入前主树与隔离树以下基线一致：
  - `apps/mini-program/src/local-synthetic/page.ts`：`8A563FACFAB6240E978609035624FA2FFEF1A44A67EC0F45BE288EA3AFF7D87D`
  - `apps/mini-program/src/local-synthetic/page.js`：`29A9D9DB3F0E1B28FDA2E64FBDAC91EAA8F85ED5DE7141AE8A3626A424F3041A`
  - `apps/mini-program/templates/local-synthetic.wxml`：`E9446EF1716A87E2B52AE5478025A155CE9E825C6A83C2DF96E745BD91CD0981`
  - `apps/mini-program/src/pages/shared-parent-workflows.test.ts`：`BE71F19829C89B05137E6A4BE48B71BA1199659A0B7CA066BD030C81397096C6`
  - `apps/mini-program/src/pages/shared-pickup.test.ts`：`31AB4F80DD3492556AC8CF44C225EB27E1DF85851778468C38491E3ABAB706DE`
  - `apps/mini-program/src/pages/supply-request.test.ts`：`705344D503C0794DBFCBEC34A41E54EF1FB58B9497B9BCCC5DC2AD586741781E`
- **风险边界：** 只用既有虚构身份和本机 loopback 服务；不得访问互联网、真实身份/学生资料、持久化或外部服务。不得读取、运行、复制或修改 `apps/mini-program/src/pages/staff.test.ts`。不得安装依赖、修改 lockfile、提交、推送、部署或发布。

## 1. 完成标准

1. 首次进入页面时身份选择器显示“选择示例身份”，当前值指向明确占位项；第一条真实虚构身份不会被默认突出或连接。
2. 用户明确选中占位项不创建会话、不发出 `POST /local/sessions`；明确选中身份后，选择器索引能正确映射到对应身份。
3. 删除空身份时可直接连接默认家长/员工的回退路径；首次连接及断线重试必须通过明确身份选择。界面连接失败提示与可操作入口一致。
4. 更新三个受影响的 Mini 页面测试，覆盖占位项、未连接、显式身份映射以及原有接送/物资业务回归。
5. `page.ts` 与本轮生成的 `page.js` 行为一致；不得运行可能改写其他生成文件的全项目编译。
6. 完成目标测试、Mini typecheck、目标 ESLint/Prettier、页面注册护栏、精确路径及差异审计。微信开发者工具实际视觉/点按若不可用，准确记为 `NOT_RUN`。

## 2. 精确写集

- `apps/mini-program/src/local-synthetic/page.ts`
- `apps/mini-program/src/local-synthetic/page.js`（仅由本轮 TypeScript 源编译生成）
- `apps/mini-program/templates/local-synthetic.wxml`
- `apps/mini-program/src/pages/shared-parent-workflows.test.ts`
- `apps/mini-program/src/pages/shared-pickup.test.ts`
- `apps/mini-program/src/pages/supply-request.test.ts`
- 本合同
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`

其他任何路径变化均不在写集内；特别是不得改 Mini 路由、`client.ts/js`、其他生成文件、页面样式、配置、依赖、lockfile 或受保护测试。

## 3. 步骤

1. 在隔离工作树先新增/加强页面测试，确认占位项和明确选择行为；先运行得到预期失败。
2. 最小修改共享页面投影与 WXML：增加占位项，按偏移索引连接身份，移除可隐式连接默认身份的按钮/处理器，并修正失败提示。
3. 重跑页面测试，再运行源码/生成页面共享流程、Mini typecheck、目标 ESLint/Prettier、页面注册护栏、`git diff --check` 和精确写集审计。
4. 独立复核后，仅逐文件选择性同步 D48 六个 Mini 实现/测试路径到主树；逐文件比对，不覆盖主树其他现场。仅对已验证的单个 `page.ts` 用本地 TypeScript API 生成 `page.js`。
5. 主树重跑目标测试及必要检查，记录结果和下一 V3 差距复核目标。

## 4. 验收命令

- 隔离树本身没有安全 Mini 测试入口脚本，因此在隔离树用明确路径运行：`node --experimental-transform-types --test apps/mini-program/src/pages/shared-parent-workflows.test.ts apps/mini-program/src/pages/shared-pickup.test.ts apps/mini-program/src/pages/supply-request.test.ts`；主树同步后，再用 `scripts/mini-safe-test-runner.mjs` 显式列出同三条路径复验。
- 新增页面流程在源码及生成页面模式各运行一次；每次都只访问本机 loopback。
- `node_modules/.bin/tsc.cmd -p apps/mini-program/tsconfig.json --noEmit --allowImportingTsExtensions`
- ESLint、Prettier API、`node scripts/verify_mini_page_registration.mjs`、目标路径 `git diff --check` 与 SHA/状态审计。
- 不运行 Mini 全量测试通配符、不触碰 `staff.test.ts`、不重建 API 或启动器。

## 5. 结果

### 实施结果

- 首次进入现在显示“选择示例身份”；占位项不创建会话。身份下拉索引先跳过占位项，再映射到真实合成身份。
- 移除了无身份时自动回退到预置家长/员工的连接入口。连接失败后清空当前选择并提示用户重新选择；测试模拟本机服务返回 503，再由用户明确重选同一身份恢复。
- 家长绑定、请假、接送、物资测试都验证实际会话身份与用户选择一致，防止索引偏移后以错误角色操作。
- 仅同步合同列出的六个 Mini 路径；主树写入前六个基线哈希均与合同一致。生成的 `page.js` 由本轮 `page.ts` 转译，没有运行会改写其他生成文件的全量编译。
- TDD 先以缺少占位项模板绑定及标签投影的失败定位实现缺口，完成后目标流程转绿。WXML 通过 Prettier HTML 解析器；没有对整页重新排版，避免仅为格式工具改写整份小程序模板。

### 验证结果

- 隔离树目标测试：`13/13 PASS`；Mini typecheck、目标 ESLint、四个 TypeScript 文件 Prettier API 检查、WXML HTML 解析及生成 JS 语法检查通过。
- 主树安全测试入口：三条目标测试路径 `13/13 PASS`；生成页面模式的共享家长流程 `2/2 PASS`。
- 主树 Mini typecheck、目标 ESLint、`node scripts/verify_mini_page_registration.mjs --require-generated-js`、`node --check apps/mini-program/src/local-synthetic/page.js` 通过。
- 生成页面测试首次因默认共享服务目录不存在而失败；显式指向现有本机共享核心目录后重跑通过。这是测试环境路径问题，未改代码或构建服务。
- 独立代码复核：无 Critical、Important、Minor findings。精确范围与空白检查通过；没有修改受保护测试、配置、依赖或 lockfile。
- 微信开发者工具实际视觉/点按：`NOT_RUN`；人工验收与 Owner Review 尚未宣称通过。
- 最终合同 SHA 与本任务状态记录在 `PLANS.md`，不得从本节推断负责人验收或发布许可。
