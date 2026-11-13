# TASK20 D91：同步 Mini 运行文件验证状态到 V3

## 目标

把 D89 的陈旧 JS 发现和 D90 的精确重生成结果同步到现有 V3 路线图。明确 TS/JS 一致性与生成模式自动测试已通过，同时保留微信开发者工具人工视觉/角色实点和 Owner Review 的待验收状态。

## 权威与基线

- 项目方案 PDF v2.0 SHA-256：`4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。
- V3 路线图：`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`，执行前 SHA-256：`088B8000272BFEBDF098CDA0A37D29DF2C2C1E71C5239982ED105B7AAA4490EF`。
- D89 合同 SHA-256：`E827F314EB8337B04490C0942E3F591ABC7F3B116E9CAC94685A2DD3413030D0`。
- D90 合同 SHA-256：`833E345D2B994B9DE112848E68716B84C2C89556870D9233B0E2A5C6129EA4B5`。
- 控制面执行前 SHA-256：`PLANS.md`=`701479E77D4B6D2EE619CD26D5FBF0DB91E7EDC52CF70F91E39354F28C31CC99`；活动计划=`61DF9FAA57159B5F007D474895A8661BD86D28D802E1824B6DC1153E937B7422`。
- D90 更新后的 JS SHA-256：`684250982A06FF8FFED60C3FAA7851BE1F775AD80CD50714A049DCAD2F7722E7`。

若 PDF、V3 或控制面基线不符，停止同步并重新核对，不覆盖并发修改。

## 精确写集

- CREATE：`docs/superpowers/plans/2026-10-11-task20-d91-v3-mini-runtime-evidence-sync.md`。
- MODIFY：`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`，只补充 D89/D90 当前验证状态和下一验收门槛。
- MODIFY：`PLANS.md`，记录 D91 控制状态。
- MODIFY：`docs/exec-plans/active/project-completion.md`，同步状态与下一步。
- 所有业务代码、测试、生成物、配置、依赖和 lockfile 均只读。

## 验证步骤

1. 重验 PDF SHA 与 V3/控制面基线。
2. 对 D91 合同及 V3、活动计划新增区块运行 Prettier 3 API、尾随空白检查、`git diff --check` 和精确写集审计。
3. 当前证据应写明：Mini 11 页/34 个运行输出、D90 后 `updated=0`；32 个安全测试文件生成 JS 模式 226/226；Mini TypeScript 与页面注册护栏通过；受保护测试未触碰。
4. 仍需微信开发者工具人工查看/点击家长绑定、员工审核、成长记录、通知和返回路径；本任务不能声称这些已完成。

## 状态

`PASS_V3_MINI_RUNTIME_EVIDENCE_UPDATED;PDF_HASH_MATCH;MANUAL_GATES_OPEN`

- 项目方案 PDF SHA-256 与权威基线一致；V3 修改前 SHA-256 与合同基线一致，更新后为 `8FC51AA8DE42E062921B0A3E620B758273BDB5E76195FF3212327BC5D744D5EF`。
- V3 已记录 D89/D90：唯一陈旧 JS 已同步；Mini 内存编译比对为 11 页/34 输出/0 更新；生成 JS 模式安全测试 226/226，Mini TypeScript 与页面注册检查通过。
- 微信开发者工具实际运行与视觉点击、Owner Review、真实服务/数据和生产交付仍未完成或受范围限制。
- D91 合同和 V3/活动计划新增区块 Prettier 3 API 与尾随空白检查通过；`git diff --check` 退出码 0（仅有此前文件的换行符提示）。写集未越界，没有产品代码或配置变更。
- D91 后的下一必要步骤是操作者在微信开发者工具打开 Mini 子目录并按角色实点；仓库根目录没有 `app.json`，应打开 `C:/Users/HU/Documents/student-care-saas-platform/apps/mini-program`。
