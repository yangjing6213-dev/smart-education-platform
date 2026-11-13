# TASK20 D75：PDF v2.0 与 V3 进度状态对齐

**状态：** PASS_DOCUMENTATION_RECONCILIATION；NO_NEW_LOCAL_PRODUCT_GAP_IDENTIFIED；MANUAL_ACCEPTANCE_OPEN
**日期：** 2026-10-10

## 目标与依据

将 V3 中仍显示 M2—M6“未开始”的旧快照，按项目方案 PDF v2.0、当前 PLANS.md 及 D73/D74 实际验证记录更新。明确本地合成实现、自动验证、微信开发者工具人工实点、负责人验收和真实运营是不同状态，避免把完成的代码误报为未开始，也避免把合成演示误报成真实试点或可上线。

权威依据：
- 项目方案 PDF v2.0：SHA-256 4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5
- V3 原始基线：SHA-256 ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38
- M2 合同修改前：DF060D6C42E9C1683EEB2556F7FEF6F0FC1334AB5C9D25F0AD282D8E621AF02D
- D73 当前状态审计：SHA-256 A9FCBF0ACD08F7EB7298085C17E52592C96B85F38EC58B005D66C94E27CFE2AD
- D74 测试入口修复：SHA-256 2953F18B9608D7739849B3F7F58CD64B9DAB55F6DD816EB150F497E6E07A4B45

本次依据用户“继续项目目标开发”及此前取消普通本地阶段逐项等待批准的要求；该工作仅为治理文档更新，不扩大真实服务、生产或发布范围。

## 精确写集

新建：
- docs/superpowers/plans/2026-10-10-task20-d75-pdf-v3-status-reconciliation.md

修改：
- PLANS.md
- docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md
- docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md
- docs/exec-plans/active/project-completion.md
- docs/superpowers/plans/2026-09-27-task20-phase1b-phase1-1-synthetic-demo.md：追加用户已确认的 M2 合成演示 Owner Review 回执，保留原始待审时点。

目标文件主树修改前 SHA-256：
- PLANS.md：28A8FCEFF0BB86806F37C4948E5887710652550E00E93C73282203753E227E18
- active/project-completion.md：23665E28A5305B1A4F489151F3F1D4E8A529A114CE93E546089BA2E406973B69
- roadmap：DFD52CBEEC6C575BFC7C08A96B928582CB26F0FEC8E3EA89E3B46BD1A0F7354A
- V3：ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38

## 状态核对

| 阶段 | 已有本地合成证据 | 未闭合验收/真实条件 | 结论 |
| --- | --- | --- | --- |
| M0 | Phase 1A、治理及 Task 01—18 已冻结 | Task 19 最终交付仍未闭合 | 历史阶段已完成；R0 仍阻塞 |
| M1 | 访客、员工、管理端多波次实现和测试；Wave2B—E 相关 Owner Review 有通过记录 | Wave2A 为 PARTIAL；其余适用 Owner Review 与 Mini 原生实点未整体闭合 | 部分完成 |
| M2 | M1.4 与 M2 合成计划通过用户 Owner Review；证据见合作验证计划及本次补录回执 | 未发生真实机构合作、真实数据授权或真实试点 | 仅合成演示通过 |
| M3.1 | 同一关系 ID 的本机绑定、审核、家长查看；G64B 已记录一条微信原生代表流程 | 其他边界流程、真实身份和整体阶段验收未闭合 | 本地已实现，整体未关闭 |
| M3.2 | 日报、通知、请假、成长记录、健康等合成共享流程及自动化测试 | D73 记录 M32D 请假与 M32F 成长记录原生实点仍待完成；日报/通知及其他原生全流程亦不能由测试替代 | 部分完成，优先做人工实点 |
| M3.3 | 接送授权、核验与记录有本地合成实现及定向验证 | 全角色冷启动、家长授权/员工核验微信原生实点与 Owner Review 未关闭；不得真实放行 | 本地已实现，验收未闭合 |
| M4 | G3.1—G3.6 任务、日报、月反馈、资源、物资、统计等均有本地证据 | 多项 Owner Review 与适用的 Mini 原生验收仍未完成 | 本地实现为主，阶段验收部分开放 |
| M5 | 固定题、分层提示、巩固、成人监督和匿名指标本地实现；G4.1 Owner Review 通过 | G4.2/G4.3 Owner Review 与相关 Mini 原生复核待完成；G4.4 来源复核仍按各自记录跟踪 | 本地合成阶段进行中，不接正式 AI |
| M6 | 费用、人员经营对象、租户/校区合成范围及临时文件恢复演练有局部证据 | D43 不证明真实数据库/对象存储备份恢复；真实身份、生产隔离、运行监控和运营未完成 | 部分完成，不可称生产就绪 |
| R0 | 无新增可替代 Task 19 的最终交付证据 | 最终交付审计与发布门槛未完成 | 阻塞 |

安全边界：D68 曾误触发安装 185 个既有开发工具包的范围偏差继续保持 PARTIAL_SCOPE_DEVIATION，不因后续验证通过而删除。受保护的 apps/mini-program/src/pages/staff.test.ts 未读取、复制、运行或修改。没有修改产品代码、测试、配置、依赖或 lockfile。

## M2 Owner Review 回执补录

M2 合同原 §6 的 PHASE_1_1_OWNER_REVIEW=NOT_STARTED 是当时计划初稿的状态快照。用户之后明确确认 TASK20_PHASE_1B_PHASE_1_1_SYNTHETIC_DEMO Owner Review 通过。本节追加记录该后续事实，不改写原始快照，不扩展到真实机构或生产授权。

PHASE_1_1_OWNER_REVIEW=PASS_USER_CONFIRMED_SYNTHETIC_ONLY
OWNER_REVIEW_SCOPE=本地合成演示完整性
REAL_INSTITUTION_ACCEPTANCE=NOT_OBTAINED
REAL_PILOT_DECISION=NOT_STARTED
PRODUCTION_READINESS=NO

## 后续目标与顺序

1. **Mini 原生人工验收（当前最高优先级）**：在微信开发者工具打开主工作树 apps/mini-program，执行普通编译，随后检查家长绑定→员工审核→家长刷新查看、请假提交→审核→家长知悉、成长记录提交→退回/重交→审核发布→家长知悉，以及员工工作台/快捷服务的入口与返回行为。每一步记录页面、点击动作、看到的结果；出现具体错误即停止该条流程并回报，不把模拟器截图或自动测试冒充人工点击结果。当前没有可供代理直接操作微信开发者工具的工具，因此这一步需要操作者完成。
2. **负责人验收收敛**：对仍标记 pending 的 G4.2/G4.3、D44/D45 等项目，仅在审阅实际画面/结果后记录；不代替负责人签署。
3. **按复现证据修复**：若上述人工操作发现新缺陷，记录复现步骤并做最小修复与回归；若无缺陷，不重复开发已存在的功能。
4. **真实运营与发布**：按正式项目方案单独规划机构确认、隐私授权、真实身份/数据、生产服务、备份恢复、运维安全与 Task 19 最终交付；当前明确保持未执行，不由本地合成任务自动开启。

## 实施与验证记录

- 更新 V3 顶部状态快照与 §3 阶段路线表，将 M1—M6 标记为按实际证据进行中的/部分完成；M2 仅标记为合成演示复核通过；R0/Task 19 保持 blocked。
- 在 PLANS.md、活动完成记录与项目路线图追加同一 D75 结论和下一门槛。
- 仅做文档修改；不运行会触及受保护测试的命令，不安装依赖、不改锁文件、不生成编译文件。
- 验证：权威 PDF/V3 SHA-256；五路径写集审计；文档编码/空白检查；git diff --check；主树与隔离工作树逐文件 SHA 对照。

## 实施与验证结果

- PDF v2.0、未修改前的 V3、D73 和 D74 权威哈希均与计划记录一致。
- M2 Owner Review 用户回执已追加；旧版待审字段保留为历史快照，真实机构接受仍为 NOT_OBTAINED，生产就绪仍为 NO。
- 写集核对为 6 个文档路径：PLANS、V3、项目进度路线图、活动完成记录、M2 合成演示合同和本合同。主工作树六个目标文件哈希均保持任务开始前值。
- git diff --check 退出码为 0；五份现有文档相对主树基线的 git diff --no-index --check 无空白告警；六份目标文档 UTF-8 解码正常，新增/改动行无尾随空白，文件内换行格式一致。
- 本任务仅更新治理/计划文档，因此未运行业务测试、类型检查或构建；无产品代码、测试、配置、依赖或 lockfile 改动。
