# TASK20 D74：Web/Admin 合成服务测试根目录默认值修复

**状态：** `PASS_LOCAL_TEST_RUNNER_ROOT_DEFAULT_REPAIRED`
**日期：** 2026-10-10
**目标：** 让 User Web 和 Admin Web 的本机合成服务测试在未手动设置 `LOCAL_SYNTHETIC_CORE_ROOT` 时，自动从测试文件位置定位当前仓库；保留显式环境变量覆盖能力。
**依据：** 项目方案 PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。

## 1. 隔离工作树和现有现场

- 工作树：`C:\Users\HU\.codex\worktrees\task20-d74-local-service-root-default`
- 分支：`codex/task20-d74-local-service-root-default`
- 来源 HEAD：`bd0001faa8e2fd7bbabe86e3d778ba24431107e8`
- 主树的三个目标测试当前为既存未跟踪文件，修改前 SHA-256：
  - `apps/user-web/src/local-synthetic/care-record-client.test.ts`：`80EEA2254EAE585F35A0B45ABA3334F17D1BA5325F0745EF04FC7DA2D2BC1BBF`
  - `apps/user-web/src/local-synthetic/parent-notices.test.ts`：`4CE2722E12FBD974F1E7C0C6ECD66064F0D42EBD0FB5F6E9C61AE9512C829FF6`
  - `apps/admin-web/test/care-record-client.test.mjs`：`2157ECBFBADAFC37C010E4CE165CBD898FFEA00049C43BB288B0E013865F826C`

编辑前必须将这些当前主树文件逐一原样复制到隔离树；不清理、重命名或覆盖其他未跟踪文件。不得安装依赖。

## 2. 精确写集

仅允许修改：

- `apps/user-web/src/local-synthetic/care-record-client.test.ts`
- `apps/user-web/src/local-synthetic/parent-notices.test.ts`
- `apps/admin-web/test/care-record-client.test.mjs`
- 若定向 TypeScript 编译确实产生差异，仅更新对应生成测试文件：
  - `apps/user-web/dist/local-synthetic/care-record-client.test.js`
  - `apps/user-web/dist/local-synthetic/parent-notices.test.js`
- 治理记录：本合同、`PLANS.md`、`docs/exec-plans/active/project-completion.md`、`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`。

生成测试文件只用现有 TypeScript 编译器 API 定向产出；不得运行会写入其他 `dist` 输出的全项目 emit/build。不得改 `package.json`、lockfile、产品业务代码、服务/API、其他测试、配置或微信受保护测试。禁止提交、推送、部署和发布。

## 3. 验收与验证

- 修复前失败证据：没有 `LOCAL_SYNTHETIC_CORE_ROOT` 时，User Web 两项和 Admin 一项共享服务集成测试报“必须设置目录”；显式设置本仓库根目录后 Admin `2/2` 通过。
- 只在显式变量未设置时回退到由当前测试文件位置计算的仓库根目录；已有变量优先级和 loopback/合成边界不变。
- User Web 两项生成测试、Admin 目标测试和各自全套安全页面测试在变量未设置时通过；测试只启动本机临时端口，不发送外网请求。
- Mini 既有安全套件和受保护文件保持不变；无产品源代码、依赖、lockfile 或项目配置变化。
- 执行目标 ESLint、Prettier API、TypeScript no-emit、`git diff --check`、主树/工作树哈希比较和写集审计。

## 4. 实施结果

- TDD 复现：清除 `LOCAL_SYNTHETIC_CORE_ROOT` 后，修复前 User Web 两项与 Admin 一项共享服务测试报错并停止；这是测试目录设置缺省，不是服务业务逻辑失败。
- 三个测试文件现在保留环境变量显式覆盖，并在未设置时从测试文件地址计算仓库根目录。主树与隔离工作树的三个源文件 SHA-256 一致：`care-record-client.test.ts` `EC1C399F640F7DE08772C22C48BBFC5B9C719F86A7BAEE01258D9595B22732A9`；`parent-notices.test.ts` `2E9CF634C28817AEFAE54ED54600F6FFCA4138B61004ECA9AD0A9F5A8D9586F5`；Admin 测试 `B69B9E75130505BB6A591C8533D9D444259896F6E4690DCC220EDF77606AD931`。
- 验证时没有设置该环境变量：User Web 聚焦合成服务测试 `7/7`、完整生成测试 `118/118`；Admin 聚焦 `2/2`、完整测试 `139/139`。User Web 与 Admin TypeScript 检查、三文件 ESLint、Prettier API 检查均通过。
- 仅更新两份经定向 TypeScript 转译确实发生变化的 User Web 生成测试 JS；SHA-256 分别为 `7DD0E3215AF00A792D5B6341BD469B096F56D24EC8C26D3C2E9A465ECCEC9EC6` 与 `BD78D1F06F0F62CD89A9EE9F8C140FE64A9D35541F139EBDB1C6EE7377FF197B`。生成内容使用 ESM，与该项目 `type=module` 一致。
- `git diff --check`、定向未跟踪文件空白检查和精确路径审计通过。未修改业务代码、配置、依赖、lockfile、Mini 文件或其他测试；未触及受保护测试；没有提交、推送、部署或发布。
- 隔离工作树和主树中的测试源文件已逐项哈希复核一致。下一项仍是 Mini 原生操作验收与负责人验收；当前自动化工具无法代替微信开发者工具中的人工点击。
