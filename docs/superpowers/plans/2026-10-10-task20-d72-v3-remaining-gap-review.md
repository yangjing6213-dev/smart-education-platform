# TASK20 D72：D71 后 V3 剩余缺口复核

**状态：** `PASS_READ_ONLY_REBASELINE;NO_NEW_LOCAL_PRODUCT_GAP;MANUAL_ACCEPTANCE_OPEN`
**日期：** 2026-10-10
**目标：** 将 D67 以来新增证据（D68—D71）与 V3 未完成验收门槛对齐，确定下一步是否存在有证据支持、可在本机合成环境继续实施的产品缺口。
**权威依据：** 项目方案 PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。

## 1. 范围与方法

仅复核既有计划、合同和已完成验证记录；不重复运行未变化代码上的测试，不改产品实现，不读取受保护的 `apps/mini-program/src/pages/staff.test.ts`。

复核路径：`PLANS.md`、`docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md`、项目进度路线图、活动完成计划，以及 D67—D71 合同与回执。

## 2. 精确写集

- 本合同
- `PLANS.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `docs/exec-plans/active/project-completion.md`

其他文件全部只读。不得安装依赖、改 lockfile、清理现场、提交、推送、部署或发布。

## 3. 验收

- 对新增的 D68—D71 证据逐项检查其状态、范围和未完成门槛是否被准确记录。
- 将“本机合成实现/自动检查”“微信开发者工具人工点按”“负责人 Owner Review”“真实运营和外部服务”分开列示，不把前者替代后三者。
- 若找不到新的本机产品缺口，则明确记录无需为继续开发而新增功能，并给出最小下一步；若找到代码缺口，只提出独立合同，不越界改代码。
- 对所有写集文件运行 `git diff --check` 并核对本合同 SHA-256。

## 4. 复核结果

- PDF v2.0 与 V3 文件哈希均与权威记录一致；未修改权威计划。
- D68—D71 结果已逐项对齐：D68 功能/测试通过但因误触发隔离工作树开发工具包安装保留 `PARTIAL_SCOPE_DEVIATION`；D69 已确认生成 JS 版本过期；D70 刷新为 V2 并通过测试/浏览器复核；D71 修复布局，桌面 4 列、手机 1 列、20 项无重叠和溢出，测试与浏览器 smoke 通过。
- 现有证据没有显示新的可通过本机合成代码修复的功能缺口。Mini 微信开发者工具人工点按与 G4.2/G4.3 等负责人验收仍开放；D71 的浏览器自动检查不替代这些验收。真实机构、真实身份/学生资料及外部服务继续按项目范围隔离。
- D72 仅同步计划状态与下一道验收门，不改业务实现、测试、配置、构建产物或依赖；没有提交、推送、部署或发布。下一步需要完成 Mini 原生页面人工点按并由负责人处理未结 Owner Review；若实测发现具体缺陷，再新增精确产品修复合同。
