# 项目执行规则

## 当前活动治理与历史边界

本仓库用于“学生托管机构智能化系统平台”的多租户 SaaS 规划、原型与早期基础实现。Phase 1A Batch A、Batch B 均为 `HISTORICAL/FROZEN`；V41 治理同步已通过负责人审阅并冻结；Phase 1B Task 01—16 均已接受并冻结，Task 12 post-acceptance minimal route repair 已通过负责人审阅并冻结，Task 14 Stage B/C1/C2 与 Task 16 Stage B/C1/C2 已完成并通过负责人审阅；Task 17 已完成并接受冻结，API/admin-web 入口与六动作审计集成已完成本地验证，C1 已完成、C2 已接受并冻结。Task 18 跨端回归、安全隔离、localhost 浏览器 smoke 与只读发布就绪门禁已通过负责人审阅，本地 checkpoint 已通过 Manager Review，Task 18 已接受并冻结；Task 19 Stage B 当前暂停，唯一活动边界为 Task 19 R1 user-web runtime 与视觉就绪阻塞修复的 Stage A formalization，R1 实施、Task 19 C1/C2 与 Task 20+ 均未获授权。

当前唯一活动治理以 `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md` 为准（SHA-256：`7BECA819534A223D84C4D95FD117FC68C4B9CD4CDFC2E5345AF09E9547D188AB`）。不得为普通开发继续创建 V43、V44 或其他并行治理文件；治理冲突应在现有 `AGENTS.md` 与 `PLANS.md` 当前控制面中收敛并等待负责人验收。

## 当前执行模式与长期稳定规则

- `ACTIVE_GOVERNANCE=V42`；`PHASE_1B_ACTIVE_TASK=TASK19_R1_STAGE_A_FORMALIZATION`；同一时刻只允许一个当前治理版本和一个当前任务边界。V42 之前的版本、V42 内旧 Task 17/Task 18+ 时点字段和下文明确标注的状态块仅是 `HISTORICAL/FROZEN` 证据，不得被解释为第二个活动控制面。
- `DEVELOPMENT_MODE` 用于任务实现与本地稳定化。获得一次任务波次授权后，普通本地读取、白名单内编辑、测试、Lint、typecheck、构建和本地 checkpoint 默认允许连续执行，不得按子步骤重复请求授权。
- `ACCEPTANCE_MODE` 只在任务实现和验证结束后进入。负责人验收、ZIP、最终 SHA 清单、完整 E2E、发布审计和交付包只在明确的验收或交付边界执行；checkpoint 提交只保存可恢复现场，不等于产品验收通过，也不自动授权 C1、C2、下一任务、push、deploy 或 release。
- `UNKNOWN` 与 `REPORTED_ONLY` 必须给出警告、路径分类和影响，但只要不触及保护路径、高风险操作或明确验收门禁，就不得阻塞普通开发。未跟踪路径只按 Git 元数据分类；未获授权时不得读取、删除、移动、覆盖或批量暂存其内容。
- 仅以下高风险操作暂停并请求一次明确确认：删除或覆盖数据、真实数据库迁移、权限边界变化、重大依赖变更、push、deploy、release 和任何外部写入。生产密钥、真实数据和外部服务仍禁止接入。
- 同一错误最多自动修复两轮。两轮后仍失败必须停止试错，并分类为 `PRODUCT_ISSUE` 或 `INFRASTRUCTURE_ISSUE`，记录证据、影响和下一步，不得通过放宽断言、权限或隔离要求制造通过。
- Task 18 精确八路径写集、验证矩阵和 checkpoint 边界已完成并冻结，其历史明细保留在 `PLANS.md`。Task 19 R1 Stage A 当前写集严格限于 `PHASE_1B_TASK_19_R1_CODEX_EXECUTION.md`、`docs/project/PHASE_1B_TASK_19_R1_PLAN.md`、`AGENTS.md`、`PLANS.md`；本阶段不得暂存或提交。禁止 `git add .`、`git add -A` 和对白名单外路径的顺手清理；71 条保护未跟踪路径本阶段不得读取内容、删除、移动或修改。R1 Stage B 只有在负责人另行明确授权后，才可按 R1 合同中的 11 路径 CREATE/MODIFY 白名单实施。

V42 冻结任务锚点：`TASK_10_STAGE_C2_STATUS=ACCEPTED`、
`TASK_10_STATUS=ACCEPTED_AND_FROZEN`、
`TASK_10_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_10_ACCEPTANCE.md`、
`TASK_10_ACCEPTANCE_SHA256=4628B2BADB28CF6E5A065AD252B4A1E934D199A1A911D9DE6DEC07313064B657`；
`TASK_11_STARTED=YES_STAGE_C2_ACCEPTED`、`TASK_11_STAGE_C2_STATUS=ACCEPTED`、
`TASK_11_STATUS=ACCEPTED_AND_FROZEN`、
`TASK_11_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_11_ACCEPTANCE.md`、
`TASK_11_ACCEPTANCE_SHA256=4482B3B1914B3A78886487854A54C2732CDF688BB59418C88570E32F204B4FCD`、
`TASK_12_ROUTE_REPAIR_STATUS=IMPLEMENTED_AND_VERIFIED`、
`TASK_12_ROUTE_REPAIR_OWNER_REVIEW=PASS`、
`TASK_12_NEW_WORK_SCOPE=MINIMAL_ROUTE_REPAIR_ONLY`、
`TASK_12_NEW_WORK_STATUS=MINIMAL_ROUTE_REPAIR_ACCEPTED_AND_FROZEN`、
`TASK_13_STARTED=YES_STAGE_C2_ACCEPTED`、
`TASK_13_STAGE_A_STATUS=OWNER_REVIEW_PASSED`、
`TASK_13_STAGE_B_AUTHORIZATION=GRANTED`、
`TASK_13_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED`、
`TASK_13_STAGE_B_OWNER_REVIEW=PASS`、
`TASK_13_STAGE_C1_AUTHORIZATION=GRANTED`、
`TASK_13_STAGE_C1_STATUS=OWNER_REVIEW_PASSED`、
`TASK_13_STAGE_C2_AUTHORIZATION=GRANTED`、
`TASK_13_STAGE_C2_STATUS=ACCEPTED`、
`TASK_13_STATUS=ACCEPTED_AND_FROZEN`、
`TASK_13_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_13_ACCEPTANCE.md`、
`TASK_13_ACCEPTANCE_SHA256=8F8BC3976D22150FBE9801D71ACAC4D9C8DA9EB8A96F616CC50DF891E5700ADF`、
`TASK_14_STARTED=YES_STAGE_C2_ACCEPTED`、
`TASK_14_STAGE_A_STATUS=OWNER_REVIEW_PASSED`、
`TASK_14_STAGE_B_AUTHORIZATION=GRANTED`、
`TASK_14_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED`、
`TASK_14_STAGE_B_OWNER_REVIEW=PASS`、
`TASK_14_STAGE_C1_AUTHORIZATION=GRANTED`、
`TASK_14_STAGE_C1_STATUS=OWNER_REVIEW_PASSED`、
`TASK_14_STAGE_C2_AUTHORIZATION=GRANTED`、
`TASK_14_STAGE_C2_STATUS=ACCEPTED`、
`TASK_14_STATUS=ACCEPTED_AND_FROZEN`、
`TASK_14_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_14_ACCEPTANCE.md`、
`TASK_14_ACCEPTANCE_SHA256=E3399204076DF11AD94301BEE0881589C3CE743FC4A3C84C7F1EEABCDD9C8FD9`、
`TASK_15_STARTED=YES_STAGE_C2_ACCEPTED`、`TASK_15_STAGE_A_STATUS=OWNER_REVIEW_PASSED`、
`TASK_15_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED`、`TASK_15_STAGE_B_OWNER_REVIEW=PASS`、
`TASK_15_STAGE_C1_STATUS=OWNER_REVIEW_PASSED`、`TASK_15_STAGE_C2_STATUS=ACCEPTED`、
`TASK_15_STATUS=ACCEPTED_AND_FROZEN`、
`TASK_16_STARTED=YES_STAGE_C2_ACCEPTED`、
`TASK16_STAGE_A_STATUS=OWNER_REVIEW_PASSED`、
`TASK16_STAGE_B_AUTHORIZATION=GRANTED`、
`TASK16_STAGE_B_STATUS=OWNER_REVIEW_PASSED`、
`TASK16_STAGE_B_OWNER_REVIEW=PASS`、
`TASK16_STAGE_C1_AUTHORIZATION=GRANTED`、
`TASK16_STAGE_C1_STATUS=OWNER_REVIEW_PASSED`、
`TASK16_STAGE_C1_OWNER_REVIEW=PASS`、
`TASK16_STAGE_C2_AUTHORIZATION=GRANTED`、
`TASK16_STAGE_C2_STATUS=ACCEPTED`、
`TASK16_STAGE_C2_OWNER_REVIEW=PASS`、
`TASK16_STATUS=ACCEPTED_AND_FROZEN`、
`TASK16_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_16_ACCEPTANCE.md`、
`TASK16_ACCEPTANCE_SHA256=A77C3FDCD079271AE12CDF9D16A6D4F50B05936F9F231AE26B6F405E7F489FF5`、
`V41_GOVERNANCE_SYNC_OWNER_REVIEW=PASS`、
`TASK_17_STARTED=YES_STAGE_C2_ACCEPTED`、
`TASK17_STAGE_A_AUTHORIZATION=GRANTED`、
`TASK17_STAGE_A_STATUS=OWNER_REVIEW_PASSED`、
`TASK17_STAGE_A_OWNER_REVIEW=PASS`、
`TASK17_STAGE_B_AUTHORIZATION=GRANTED`、
`TASK17_STAGE_B_COMPONENT_EVIDENCE=PASS`、
`TASK17_STAGE_B_REPAIR_AUTHORIZATION=GRANTED`、
`TASK17_STAGE_B_STATUS=OWNER_REVIEW_PASSED`、
`TASK17_API_ENTRYPOINT_STATUS=WIRED_AND_TESTED`、
`TASK17_ADMIN_WEB_ENTRYPOINT_STATUS=WIRED_AND_TESTED`、
`TASK17_AUDIT_ACTION_INTEGRATION_STATUS=SIX_ACTIONS_LOCALLY_VERIFIED`、
`TASK17_STAGE_C1_AUTHORIZATION=GRANTED`、
`TASK17_STAGE_C1_STATUS=COMPLETED`、
`TASK17_STAGE_C1_OWNER_REVIEW=PASS`、
`TASK17_STAGE_C2_AUTHORIZATION=GRANTED`、
`TASK17_STAGE_C2_STATUS=ACCEPTED_AND_FROZEN`、
`TASK17_STAGE_C2_OWNER_REVIEW=PASS`、
`TASK17_STATUS=ACCEPTED_AND_FROZEN`、
`UI_NOT_VISUALLY_VERIFIED=YES`、
`TASK18_PLUS_STARTED=NO`、
`TASK18_PLUS_AUTHORIZATION=NOT_GRANTED`、
`PHASE_1B_ACTIVE_TASK=TASK17_ACCEPTED_AND_FROZEN`、
`OWNER_REVIEW_GATE=TASK17_POST_C2_GOVERNANCE_REVIEW_GATE`、
`STOP_REASON=TASK17_POST_C2_GOVERNANCE_REVIEW_GATE`。

以上 V42 锚点是 `HISTORICAL/FROZEN` 授权时快照，不代表当前 Task 18/19 控制面；其中旧 Task 17 阻塞、Task 18+ 未启动或未授权表述均只属于历史授权时点，`UI_NOT_VISUALLY_VERIFIED=YES` 也仅是 Task 17 的历史限制，不得解释为 Task 18 当前视觉状态。当前控制面为：
`TASK18_AUTHORIZATION=GRANTED`、
`TASK18_STATUS=ACCEPTED_AND_FROZEN`、
`TASK18_OWNER_REVIEW=PASS`、
`TASK18_MANAGER_REVIEW=PASS`、
`TASK18_LOCAL_VALIDATION_STATUS=PASS`、
`TASK18_UI_VISUAL_VERIFICATION_STATUS=PASS_LOCALHOST_SMOKE`、
`TASK18_SCOPE=THREE_CLIENT_REGRESSION_ISOLATION_AND_LOCALHOST_RELEASE_SMOKE`、
`TASK18_COMMIT_AUTHORIZATION=GRANTED`、
`TASK18_CHECKPOINT_COMMIT=e0c41bb859a87a031cf8b7d39373aea3b712681a`、
`TASK18_CHECKPOINT_STATUS=MANAGER_REVIEW_PASSED`、
`TASK18_CONTROL_PLANE_CHECKPOINT_COMMIT=b3f300cd3c749cc06dc462d149353ac8cd0f5528`、
`TASK19_STARTED=NO`、
`TASK19_IMPLEMENTATION_AUTHORIZED=NO`、
`TASK19_STAGE_A_AUTHORIZATION=GRANTED`、
`TASK19_STAGE_A_STATUS=PROPOSED_PENDING_OWNER_REVIEW`、
`TASK19_TYPE=PHASE_1B_V0_1_FINAL_DELIVERY_ACCEPTANCE`、
`TASK19_STAGE_B_AUTHORIZATION=NOT_GRANTED`、
`TASK19_STAGE_C1_AUTHORIZATION=NOT_GRANTED`、
`TASK19_STAGE_C2_AUTHORIZATION=NOT_GRANTED`、
`TASK19_R1_STARTED=NO`、
`TASK19_R1_STAGE_A_STATUS=PROPOSED_PENDING_OWNER_REVIEW`、
`TASK19_R1_IMPLEMENTATION_AUTHORIZED=NO`、
`TASK20_PLUS_STARTED=NO`、
`TASK20_PLUS_AUTHORIZATION=NOT_GRANTED`、
`PHASE_1B_ACTIVE_TASK=TASK19_R1_STAGE_A_FORMALIZATION`、
`OWNER_REVIEW_GATE=TASK19_R1_STAGE_A_OWNER_REVIEW_GATE`、
`STOP_REASON=TASK19_R1_STAGE_A_OWNER_REVIEW_GATE`。

Task 18 checkpoint 与控制面 checkpoint 已通过独立复核，但 checkpoint 仍只保存本地可恢复状态，不等于发布或 release。Task 19 当前暂停在 R1 blocker-repair formalization；本次授权只允许形成 R1 合同、计划和当前控制面，不构成 R1 实施、Task 19 Stage B/C1/C2、push、deploy、release 或 Task 20+ 授权。后续远端 push 观测结果单独记录如下，不反推授权来源。

R1 远端状态观测：
`GIT_PUSH_EXECUTED=YES`、
`GIT_PUSH_COMMIT=6f02fa113e69b14e05ca5a8ea03d3c1769aa8da2`、
`GIT_PUSH_TIME=2026-09-21T01:36:02+08:00`、
`GIT_PUSH_ACTOR=UNKNOWN`、
`PUSH_AUTHORIZATION=NOT_VERIFIABLE_FROM_CURRENT_RECORD`。

当前 R1 控制面为：
`TASK19_R1_USER_WEB_RUNTIME_AND_VISUAL_READINESS`、
`TASK19_R1_STARTED=NO`、
`TASK19_R1_STAGE_A_STATUS=PROPOSED_PENDING_OWNER_REVIEW`、
`TASK19_R1_IMPLEMENTATION_AUTHORIZED=NO`、
`TASK19_STAGE_B_AUTHORIZATION=NOT_GRANTED`、
`TASK20_PLUS_STARTED=NO`。R1 仅 formalize Task 19 的 user-web runtime 与视觉就绪阻塞修复；不得执行实现、测试、浏览器、服务、提交、push、部署或 release。

## HISTORICAL/FROZEN：Phase 1A 自举与必读顺序

- A0合法初始态为项目根只有指定SHA源合同，`.git`、决策基线、范围、术语、计划、仓库任务合同和 `docs/reviews/BLOCKERS.md` 均不存在。A0只读取源合同与外部active goal，不要求任何尚未存在的仓库文件。
- A1仅凭A0线程回执 `PASS`、外部active goal与未变的初始目录激活；激活后初始化Git、创建治理文件与单一 `NO_BLOCKERS`，并把A0/A1自举记录固化进Commit 1。
- 从A2起才适用以下完整预读顺序和仓库任务合同模板：

1. `PHASE_1A_BATCH_A_CODEX_EXECUTION.md`，其 SHA-256 必须为 `892521A36DF3A3A1E76C3923E00705E6F9405515020701279F2AB328F00436AC`；
2. `docs/project/DECISION_BASELINE.md`；
3. `docs/project/SCOPE_AND_NON_SCOPE.md`；
4. `docs/project/TERMINOLOGY.md`；
5. `docs/plans/PHASE_1A_BATCH_A_EXEC_PLAN.md`；
6. `docs/reviews/BLOCKERS.md`；
7. `docs/plans/PHASE_1A_BATCH_A_EXEC_PLAN.md` 对应 A0—A7 章节中的已批准内嵌任务合同实例；`docs/templates/TASK_CONTRACT.md` 只定义字段规范。

指定 SHA 的源合同与已批准的 `docs/project/DECISION_BASELINE.md` 共同构成本批次权威；后续直接指令只有在稳定记录且不与二者冲突时才可补充。不得用“当前指令”或聊天记录代替稳定授权证据，也不得削弱、替换或扩张权威内容。任何改变范围、阶段、交付或与源合同冲突的变更，必须建立新版权威执行合同、新 SHA、原子更新全部引用并重新批准；否则先登记阻塞并停止，不得猜测。

## HISTORICAL/FROZEN：Phase 1A 批次B预读与执行边界

Batch B 的权威合同为 `PHASE_1A_BATCH_B_CODEX_EXECUTION.md`，SHA-256 必须为 `8DE2E96EB129E05950F8BC3832C5CEB842A1565BC5512E201F7EB233AC6DE04E`。执行前必须读取该合同、当前 Batch A 冻结基线、四个只读视觉输入和 `docs/plans/PHASE_1A_BATCH_B_EXEC_PLAN.md`，并重新执行 B0 硬门禁。

Batch A 的审查 ZIP、根 `SHA256SUMS.txt`、评审报告、文件清单、验证器、低保真原型、截图及既有产品/架构/AI文档均为冻结证据。Batch B 不得修改、覆盖、重新打包或删除它们；`docs/reviews/BLOCKERS.md` 也属于 Batch A 冻结文件，Batch B 阻塞记录只能写入合同白名单中的 `docs/reviews/PHASE_1A_BATCH_B_REVIEW.md`。

`phase-inputs/phase1a-batch-b/` 是只读输入，必须保持忽略、未跟踪、不进入 Git 或审查包。Batch B 原型只能使用原生 HTML、CSS 和 JavaScript、内存模拟数据、本地 PNG/SVG 与 hash 路由；不得安装依赖、创建 `package.json`、访问外网、使用持久化存储或接入正式服务。

Batch B 固定交付为 47 个 A 级页面、12 个 B 级流程、59 个浏览器路由、15 张真实浏览器截图、V0.1 技术基线、18 个独立 TDD 任务的 Phase 1B 计划、自动验证器及 86 项精确白名单审查包。上述 Batch B 合同与证据保持历史冻结。当前 Phase 1B 活动治理以 `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V37.md` 为准（SHA-256：`78B5C409048F7BB1C0E276BC38382952B3F9A2E1E1E489578BF9E35766F99A03`）：Task 01—15 已接受并冻结；Task 16 Stage B 已获授权但因缺少 mini-program tsconfig 阻塞；C1/C2 及 Task 17+ 尚未启动且未获授权。本文件及其他冻结文件中的旧阶段语句仅属 `HISTORICAL/FROZEN` 记录；当前 API 为 Fastify 5.12.1，runtime 为 Node 24.14.0 与 pnpm 11.22.0，T12 为 `T02 -> T03 -> T05`，T10 为 `T05 -> T08 -> T12`。

## 锁定产品规则

- 面向未登录公众的产品术语统一为“访客”“访客状态”“访客端”“访客首页”；禁止把“游客状态”作为当前产品名称。技术枚举可用 `VISITOR`。
- 微信小程序负责即时、现场、轻量、拍照上传和快捷处理；用户网页端负责完整查看、历史、长内容及复杂编辑；机构管理网页端负责配置、权限、表格、统计、审核、财务和批量管理。
- 三端共用统一后端、数据库、账号、权限、文件和业务规则；核心能力保持一致，但页面不得机械复制。
- 所有机构业务对象必须具备 `tenant_id`；校区业务必须具备 `campus_id`。服务端从可信身份与成员关系自动注入租户范围，不信任前端租户 ID；查询、写入、唯一约束、缓存键、任务、审计、文件前缀、AI 会话和成本均按租户隔离。
- 平台管理员默认无权查看学生具体内容；跨租户访问必须有单独批准、最小权限和审计证据。

## 未成年人、数据与模拟规则

- 本批次只使用明显虚构且不可回溯到真人的模拟数据；禁止真实姓名、手机号、身份证号、地址、照片、健康、考勤、接送、成绩或家庭关系数据。
- 不得通过组合字段影射真实未成年人；示例统一标注“模拟数据”。不得从生产、机构表格、聊天截图或公开网页复制个人数据。
- 未成年人能力必须以监护人同意、教师或家长监督、最小采集、输入脱敏、输出安全、人工复核、可关闭、可删除和可审计为前提。

## 同芯AI学习助手边界

- 定位仅为“小学作业引导 + 错题巩固”：学生先尝试，再依次使用第0、1、2、3层提示，最后进入巩固层；学习摘要只能回流教师。
- 学生首期不独立注册；由教师或家长从学生档案开启。当前批次只做规格、安全边界和模拟原型，不调用正式模型。
- 禁止开放式万能聊天、代写、作弊、情感陪伴、虚拟好友、心理诊断、情绪识别、自动能力标签、自动纪律/处罚/绩效结论，以及未经教师或家长确认发送敏感结论。

## 禁止操作

- 禁止配置远程、推送、创建 PR、发布、上传腾讯云或部署测试/生产环境。
- 禁止接入真实登录、短信、微信授权、微信支付、伙伴云 API、正式 AI、生产数据库或真实数据。
- 禁止读取、生成、填入、提交或回显生产密钥；不得把任何密钥写入文档、原型、日志或 Git。
- A0—A7 与 B0—B7 一律禁止安装依赖；浏览器验证失败时必须改用静态链接与内容检查，不得为截图或浏览器自动化安装工具。
- 未来只有项目负责人在新任务合同中明确批准最小验证依赖的包名、版本、必要性、影响和回退，并先形成新版权威执行合同、新 SHA、原子更新全部引用且重新批准后，才可安装；当前合同下无例外。
- 禁止 `git add .`、`git add -A`、强制覆盖、破坏性清理和修改项目根目录外文件。

## 治理、验证与完成声明

A0—A1执行外部active goal中已批准的自举合同并在Commit 1固化；从A2起，每项工作必须先填写并批准执行计划对应章节中的内嵌任务合同实例，使用固定 `TASK_ID`，明确外部授权证据 ID/摘要/完整性证据、目标、允许文件、禁止范围、验收点、验证命令、证据和停止条件。专项智能体只能修改实例白名单内文件。

执行顺序固定为：任务合同批准 → 最小范围实施 → 专项自检 → QA/安全门禁 → 显式暂存 → 检查暂存差异 → 按计划提交 → 复验 → 回执 → 停止。

“完成”必须附文件清单、实际命令、退出码或结果摘要、Git 差异/提交 SHA、合同 SHA 和未解决风险。`PASS` 只表示内部证据门禁通过、等待项目负责人验收；不代表负责人已验收，也不授权下一阶段。
