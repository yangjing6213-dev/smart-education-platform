# TASK20 D88：V3 进度证据复核与验收门槛重校准

## 目标

把 D84-D87 在主工作树取得的最新 Mini、User Web 和 Admin Web 自动化证据，准确同步到现有 V3 路线图；区分本机自动化、微信开发者工具人工验收、负责人审阅和真实运营条件。V3 仍是项目实现路线图，不据此宣称真实机构可用或项目正式交付。

## 权威与基线

- 项目方案 PDF v2.0 SHA-256：`4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。
- 现有 V3 路线图：`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`，执行前 SHA-256：`7B14FA5DD5EF829170FE3CAFBE2354B76766E756A032AD3F353A3181AB26F36F`。
- D84 合同 SHA-256：`A3ED6BA16D741750C78F862DDDA0D3ECEDACE7658574E95E77E14EFD5EE1D470`。
- D85 合同 SHA-256：`F9A29BF15C13C7A6B38ABAFDAAECCF3166499293D2A9110E5A60E08909ED7C2A`。
- D86 合同 SHA-256：`F01A524017532F9E66F61FDBDB0FD9F8780EEA7AA125BF18240D97B9CEB635FA`。
- D87 合同 SHA-256：`2B683EC6F2CE2D0D59CDE061A16DDBA039FCBCBE1BE34201D0D2DEF00D22E8A8`。
- 执行前控制面 SHA-256：`PLANS.md`=`5A42D6ABF538BEA13831B52E36D3C9D4FA6684EC0ADF2B5239D9A7B6EC3BA3DE`；活动计划=`B18353C64EF41953096785CA0E2099B2518E7A611CE47135857D169FC832E847`。

若 PDF 或 V3 基线哈希不符，停止本次状态同步并重新核对，不覆盖其他修改。

## 精确写集

- CREATE：`docs/superpowers/plans/2026-10-11-task20-d88-v3-evidence-rebaseline.md`。
- MODIFY：`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`，只补充 D84-D87 当前主树验证状态和下一验收门槛。
- MODIFY：`PLANS.md`，更新当前任务锚点及 D84-D88 结论。
- MODIFY：`docs/exec-plans/active/project-completion.md`，同步当前证据与人工门槛。
- 所有业务代码、测试、配置、依赖、lockfile 和生成产物只读。

## 证据要求

1. Mini：主树 32 个安全测试文件 226/226；TypeScript 检查、要求生成 JS 存在的页面注册护栏通过；主树缺少 `scripts/mini-runtime.mjs`，运行时重新编译/输出一致性未证明；受保护 `staff.test.ts` 未读取、运行或编译。
2. User Web/Admin Web：主树测试分别 118/118、139/139；类型检查与 ESLint 通过；测试编译输出仅位于两个应用的 `dist/`。
3. User Web E2E：主树访客投影和 loopback 预览 4/4；不等于人工浏览器视觉验收。
4. 明确保留的门槛：微信开发者工具各角色实际点按/视觉复核、G4.2/G4.3 等 Owner Review、真实服务和生产交付条件分别未完成或禁止，不因本地自动化通过而改为完成。
5. 当前 Mini 正确项目根目录候选为 `C:/Users/HU/Documents/student-care-saas-platform/apps/mini-program`（该目录包含 `app.json`）；此结论只由路径/文件存在性静态核对，不宣称开发者工具已打开。

## 验证和停止条件

- 核对 PDF、V3 和控制面基线哈希；只更新状态文字与证据引用。
- 对新合同和限定新增区块执行 Prettier 3 API、尾随空白、`git diff --check` 与写集审计。
- 不启动微信开发者工具、不生成 JS、不下载浏览器、不安装依赖、不调用外部服务。
- 若 V3 矩阵需要新的产品代码、真实服务或超出四条写集，停止并另立任务；不在 D88 扩大范围。

## 状态

`PASS_V3_EVIDENCE_UPDATED;PDF_SHA_MATCH;MANUAL_GATES_PRESERVED`

- PDF SHA-256 与基线一致：`4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 更新前 SHA-256 与基线一致，更新后 SHA-256 为 `088B8000272BFEBDF098CDA0A37D29DF2C2C1E71C5239982ED105B7AAA4490EF`。
- 已将 D84-D87 主树证据追加到 V3，明确自动化结果、未完成的人工作业/Owner Review/真实服务边界及 Mini 正确根目录。
- `apps/mini-program/app.json` 与 `apps/mini-program/project.config.json` 存在，仓库根 `app.json` 不存在；这说明微信开发者工具应将 Mini 子目录作为项目根目录，仅为静态路径结论。
- 新合同、V3 新增区块与活动计划新增区块的 Prettier 3 API 核对通过；新增区块尾随空白为 0；`git diff --check` 退出码 0（只有既有工作区文件换行符提示）。写集未越界，未修改产品代码、测试、配置、依赖或生成物。
- 下一任务 D89：只读核验主树 Mini 的 TS 源文件与同路径 JS 生成文件是否匹配；在此之前不重新生成 JS，也不宣称 DevTools 页面已实际打开。
