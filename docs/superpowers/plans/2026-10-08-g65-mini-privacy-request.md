# TASK20_G65_MINI_PRIVACY_REQUESTS

**状态：** `PASS_LOCAL_SYNTHETIC_IMPLEMENTED_AND_SELECTIVELY_SYNCED;AUTOMATED_VALIDATION_PASS;MANUAL_DEVTOOLS_NOT_RUN;OWNER_REVIEW_NOT_CLAIMED`
**依据：** 项目方案 V2.0 的家长数据权利与三端职责；现有 G6.1 本机隐私申请 API、G6.2 Web/Admin 页面和 G6.4 Mini 家长授权页。
**本轮技能流程：** Superpowers 选择测试先行、系统排错、完成前验证；`long-horizon-development` 将本批判定为同一项目长程计划中的一个轻量、可回滚 Mini 切片。计划、上下文和验证证据共用，不另开流程。

## 目标

在小程序既有“数据授权与期限说明”页面中，增加监护人提交、查看、撤回本机合成个人信息申请的入口。页面复用 G6.1 现有服务和当前已审核关系，不新建页面、路由或 API。Web 家长页与 Admin 审核页已经提供同类入口；本批补齐 Mini 端缺口。

固定申请类型为查阅、资料更正、获取副本和删除申请。删除申请只是演示请求，不会执行删除。每个响应都必须确认 `dataChanged=false`；状态只来自 `127.0.0.1` 上的内存服务，重启即清空。

## 行为边界

- 只有服务端当前合成会话包含 `privacy:request` 且存在已审核监护关系时，才读取或提交申请。
- 只允许四个固定类型；提交时要求勾选“仅为本机演示，不会处理真实资料”。不收自由文本、学生姓名、手机号或客户端范围声明。
- Mini 状态只投影申请 ID、固定类型、状态、版本和更新时间；不显示或保存在页面数据中的学生、关系、租户、校区、班级、申请人或历史字段。
- 仅 `SUBMITTED`、`IN_REVIEW` 可撤回；使用当前服务返回的版本号，不自动重试冲突或失败请求。
- 页面离开、关系失效、刷新失败或连接身份变化时清除确认勾选及旧申请列表；不得使用离线缓存恢复内容。
- 继续复用现有页面及绿黄视觉样式；不加新路由、依赖、持久化、外网、真实身份、真实资料、伙伴云或正式 AI。

## 精确写集

实现工作树：`C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`。
验收后选择性同步目标：`C:\Users\HU\Documents\student-care-saas-platform`。

Mini 产品路径（先在实现工作树修改；通过后再逐文件同步到主工作树）：

- MODIFY `apps/mini-program/src/local-synthetic/client.ts`
- MODIFY `apps/mini-program/src/pages/parent/consent.ts`
- MODIFY `apps/mini-program/src/pages/parent/consent.test.ts`
- MODIFY `apps/mini-program/pages/parent/consent/index.ts`
- MODIFY `apps/mini-program/pages/parent/consent/index.wxml`
- MODIFY `apps/mini-program/src/local-synthetic/client.js`（仅本轮编译确有变化时）
- MODIFY `apps/mini-program/src/pages/parent/consent.js`（仅本轮编译确有变化时）
- MODIFY `apps/mini-program/pages/parent/consent/index.js`（仅本轮编译确有变化时）

治理路径：

- MODIFY `PLANS.md`，仅更新本任务状态、验证证据、主树同步状态和下一目标。
- MODIFY `docs/superpowers/plans/2026-10-08-g6-roadmap-reconciliation-after-g62.md`，仅追加 G6.5 当前结论及剩余边界。
- MODIFY 本合同，仅记录本任务执行结果和验证状态。

## 实施顺序与验证

1. 先在隔离 Mini 工作树增加会失败的模型测试：无权限/无已审核关系不可读取或写入；固定类型和显式确认；只允许当前版本撤回；拒绝错误回执及含学生身份字段的响应；断开后清空。验证新增断言先因能力缺失失败。
2. 实现最小共享客户端与现有页面 UI；复用 `miniTransport` 的精确本机路径白名单、既有 `consent-card` 与按钮样式。重新编译后只保留上列三个确实变化的 JS 产物。
3. 在隔离工作树运行 consent/privacy focused tests、Mini typecheck、ESLint、适用 TS Prettier、页面注册护栏、运行时生成文件一致性、`git diff --check` 和精确范围审计。
4. 逐文件确认主树与实现树目标文件基线仍可安全合并；保留所有无关修改，仅同步上述产品路径。主树重跑同一组测试、typecheck、Lint/格式、注册/生成护栏、差异与范围审计。
5. 用本机合成 API 验证同一申请 ID 可由家长提交/查看/撤回、负责人审核，并在家长侧刷新看到更新版本；网络只能访问 loopback，外部请求必须为 0。微信开发者工具仅在本轮实际完成模拟器点击后记 `PASS`，否则记 `NOT_RUN`。

## 停止条件

若需要改写集外路径、新路由/API、页面配置、`staff.test.ts`、真实数据/认证、持久化、外部服务、依赖或 lockfile，或编译器要求改写白名单外生成文件，停止该项并记录证据。不得为了通过而弱化权限、数据最小化、回执或范围断言。

## 基线指纹（实施前主树指纹及实现树复核）

执行前对照时发现 `apps/mini-program/src/local-synthetic/client.ts` 与主树指纹不同：实现工作树 SHA-256 为 `570C212F688CBC501F766A26F421446557117550D0022C3B159492D221803DC1`，主树合同记录值为 `8E589DA594E114637EFCDEBFB3580C97BC23E4B9061209CFEFF9BE87A660D22E`。只读差异确认工作树已有两项本任务所需的精确安全限制：只将 `/local/privacy-requests` 与 UUID `/withdraw` 路径加入本机路径白名单，并限制列表路径为 GET/POST、撤回路径为 POST。该增量留在原白名单文件内并复用，不覆盖、不扩展。本合同的“主树与实现树逐字节相同”描述仅对其余七个基线文件成立；此处记录为基线偏差，后续仍逐文件检查并选择性同步。

- `client.ts` `8E589DA594E114637EFCDEBFB3580C97BC23E4B9061209CFEFF9BE87A660D22E`
- `consent.ts` `8D0F09B451946E60861C1D8A913020CE85C2F90D4B6A86CD9A5764F3AB2E2CA3`
- `consent.test.ts` `261BDE17942E199C0004D854B4283109EC4E81367D1770AF0390DA36DEFC5774`
- `consent/index.ts` `E518A97741DA738CACBB568501844BEE45F07EFBA3A4DD70D2BA5F87A00F8A5A`
- `consent/index.wxml` `3D0ED202E8F51E67C2E406018F8543BCC0AA62CDA0DD564CFB1F0C9523ED3FC2`
- `client.js` `C31387FBEB44D00A3078C49BD5B6B8565AD50FB414E66DFF5C46DA0824A57994`
- `consent.js` `1BDE7C0C3D10A9EAE2900126076D1A53A32D8D8F9F8DC10A732F90A4156C54D7`
- `consent/index.js` `384BBB9ECFC03EFC94523058B5B6C079DAC3C6632905C5CA49DBF66E96B12FF5`

## 执行结果（2026-10-08）

- Mini 客户端只在会话含 `privacy:request` 且关系已审核时读取申请；固定四类申请要求明确勾选；仅当前申请版本可撤回。响应只保留申请 ID、版本、类型、状态、更新时间和 `dataChanged=false`，遇到学生身份字段、危险回执或读取失败即拒绝/清空旧申请。
- 更新了既有“数据授权与期限说明”页，无新增路由、配置、输入框、依赖或外部调用。删除申请仅为本机模拟请求，不执行删除。
- TDD 初始测试因生成 JS 落后而失败；随后实现及编译完成，Mini 家长隐私/授权、关系和入口测试 `31/31` 通过，既有 API 隐私申请聚焦测试 `4/4` 通过。Mini `tsc --noEmit`、ESLint、支持文件 Prettier、页面注册及生成文件一致性检查通过。
- 编译器内存预演只发现本合同允许的三个 JS 产物变化；实际编译后所有 Mini TS 生成 JS 与源码一致。隔离工作树没有页面注册脚本，故该项改为在同步后的主树执行并通过 `MINI_PAGE_REGISTRATION_PASS generatedJs=required`。
- 本机 `127.0.0.1:4317` 实际跨角色流程通过：合成监护关系获批、家长提交 ACCESS、负责人将申请转为 `IN_REVIEW`、家长刷新读到版本 `2`；各回执 `dataChanged=false`。Mini 客户端也从同一本机服务加载了该已审核申请。测试只访问 loopback。
- 主树整合前八个目标文件均与合同基线匹配。逐文件选择性同步后，主树重复运行上述 `31/31` focused tests、Mini typecheck、ESLint、Prettier、页面注册护栏和生成 JS 一致性检查，全部通过。未修改合同写集外文件。
- 微信开发者工具实际页面点击与视觉检查 `NOT_RUN`：本轮没有可调用的微信开发者工具交互控制器。自动化和 loopback 证据不代替这项人工验收；负责人验收也未声称通过。
- 未安装依赖、修改 lockfile、访问真实数据/服务、提交、推送、部署或发布。`127.0.0.1:4317` 保持运行；内存演示现留有一条合成的负责人审核中 ACCESS 申请，重启将清空。
