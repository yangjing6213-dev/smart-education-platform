# Phase 1A 批次A执行计划

## 1. 执行基线

- 项目根路径：`C:\Users\HU\Documents\student-care-saas-platform`
- A1创建的目标分支：`planning/phase-1a-batch-a`
- 权威合同：`PHASE_1A_BATCH_A_CODEX_EXECUTION.md`
- 合同 SHA-256：`892521A36DF3A3A1E76C3923E00705E6F9405515020701279F2AB328F00436AC`
- 授权证据 ID：`CODEX_ACTIVE_GOAL_2026-08-21_PHASE_1A_BATCH_A`
- 外部线程 ID：`01a02398-b83a-7382-a314-353da24ee898`
- 外部目标核验状态：`active`（主线程 fresh `get_goal` 时的快照）
- 完整 objective UTF-8 字节数：`2895`
- 完整 objective SHA-256：`9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089`
- 内部规范化摘要 SHA-256：`DBD4068CCEC13CD2E1EDA2E25C511612BB087D45E184EB3363CDAEBB8C958C6E`（只证明摘要未变，不能替代完整 objective 哈希）
- 授权来源：当前 Codex 线程 active goal
- 批准日期：2026-08-21（Asia/Shanghai）
- 当前允许阶段：Phase 1A 批次A
- 当前节点：A1 Git与项目治理基线

本文件 A0—A7 章节各自包含一个固定 `TASK_ID` 的任务合同实例，不另建实例文件。A0—A5 阶段回执先作为当前 Codex 线程中的仓库外运行证据保存；A6 打包前最终冻结评审报告、文件清单和ZIP内payload manifest。ZIP生成并验证后唯一允许的tracked写是一次性覆盖根 `SHA256SUMS.txt` 为含ZIP哈希的最终manifest；随后计算root manifest SHA并生成仓库外 `THREAD_POST_PACKAGE`，自此零tracked写。A7 不修改任何 tracked 交付物，只完成忽略路径审计、显式暂存、cached 验证、Commit 4、提交后复验和仓库外终端最终回执。A0—A1使用下述自举例外：A0启动时项目根只有指定SHA源合同，仓库内治理文件和阻塞记录尚未存在；A1以外部active goal、A0线程回执和未变的初始目录激活，不预先读取尚未创建的仓库文件。从A2起，每项开始前必须按必读顺序读取合同、决策基线、范围、术语、计划和已存在的阻塞记录。每项结束时必须记录实际证据并停止。计划获批不等于后续项自动激活。

A0的 `CONTRACT_VERSION` 与 `AUTHORIZATION_RECORD_SHA256` 均为 `NOT_APPLICABLE_BOOTSTRAP`；A1两字段均为 `CREATED_BY_COMMIT_1`；A2—A7引用内部摘要实际SHA。完整 `AUTHORIZATION_OBJECTIVE_SHA256` 在A0—A7始终必填。内部摘要由A1创建，不能作为A0既存输入，也不能替代外部证据。`CONTRACT_APPROVAL_STATUS=APPROVED` 只表示合同内容获批；只有 `ACTIVATION_POLICY` 与 `PREVIOUS_STAGE_EVIDENCE` 实际满足时阶段才激活。

最终 Commit 1 SHA 无法自引用写入本提交。A1 完成后由主线程阶段回执传入实际 Commit 1 SHA；A2 必须同时取得该 SHA 和规范/质量复审 `PASS` 才可激活，A6 将实际 SHA 固化到最终评审报告。A2—A7 正常启动时必须核对 Commit 1 中的初始治理文件相对该 SHA 未改动；发现差异即登记实质阻塞并停止。

全批次固定 `DEPENDENCY_INSTALL=NO`。浏览器不可用或失败时采用静态链接与内容检查。未来依赖必须先有新版权威执行合同、新 SHA、全部引用原子更新和项目负责人重新批准；新任务合同还必须列明包名、版本、必要性、影响与回退。

## 2. 全批次交付映射

| 合同项 | 交付 | 阶段 | 主要证据 |
|---:|---|---|---|
| 1 | 项目治理与仓库基线 | A0—A1 | 治理文件、角色卡、模板、Commit 1 |
| 2 | 产品总PRD和V0.1专项PRD | A2 | PRD覆盖表、范围检查 |
| 3 | 用户角色与三端功能矩阵 | A2 | 角色矩阵、端侧矩阵 |
| 4 | 完整页面清单 | A2 | A/B/C级清单、字段与验收点 |
| 5 | 核心用户流程 | A2、A4 | 八条流程、三条可点击闭环 |
| 6 | 内容字段和状态定义 | A2 | 内容模式与状态模型 |
| 7 | 低保真可点击跨端原型 | A4 | 三端入口、导航、状态转换 |
| 8 | 多租户、账号、权限、数据模型草案 | A3 | 架构与隔离证据 |
| 9 | API、文件、环境、部署草案 | A3 | 边界文件；无实际部署 |
| 10 | AI学习助手产品与安全草案 | A3—A4 | 产品、安全、评测与五层流程 |
| 11 | 验收标准和验证脚本 | A2、A5 | 标准、脚本、实际结果 |
| 12 | 批次A审查包 | A6—A7 | 评审、清单、ZIP、哈希、终端回执 |

## 3. A0—A7执行顺序

### A0 执行前硬门禁

#### 内嵌任务合同实例

| 核心字段 | 已批准值 |
|---|---|
| `TASK_ID` | `PHASE_1A_BATCH_A_A0_HARD_GATE` |
| `CONTRACT_VERSION` | `NOT_APPLICABLE_BOOTSTRAP` |
| `DECISION_BASELINE_VERSION` | `NOT_APPLICABLE_BOOTSTRAP` |
| `EXECUTOR_ROLE` | `QA_SECURITY_AGENT` |
| `AUTHORIZATION_EVIDENCE_ID` | `CODEX_ACTIVE_GOAL_2026-08-21_PHASE_1A_BATCH_A` |
| `AUTHORIZATION_THREAD_ID` | `01a02398-b83a-7382-a314-353da24ee898` |
| `AUTHORIZATION_OBJECTIVE_UTF8_BYTES` | `2895` |
| `AUTHORIZATION_OBJECTIVE_SHA256` | `9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089` |
| `AUTHORIZATION_RECORD_SHA256` | `NOT_APPLICABLE_BOOTSTRAP` |
| `CONTRACT_APPROVAL_STATUS` | `APPROVED` |
| `ACTIVATION_POLICY` | 外部 active goal 已激活 A0；合法初始态为项目根目录只存在指定SHA源合同，`.git` 和 `docs/reviews/BLOCKERS.md` 均不存在。 |
| `PREVIOUS_STAGE_EVIDENCE` | `NONE`；以主线程 fresh `get_goal` 的线程 ID、状态快照、2895字节和完整 objective SHA-256 作为启动证据。 |
| `PRECONDITION_REF` | `EXTERNAL_ACTIVE_GOAL` |
| `GOVERNANCE_FREEZE_POLICY` | `NOT_APPLICABLE`；A0只读。 |
| `BLOCKER_CHECK_POLICY` | `NOT_APPLICABLE_BOOTSTRAP`；A0不要求、不读取也不创建 `docs/reviews/BLOCKERS.md`，其不存在正是合法初始态的一部分。检查时间和结果记当前 Codex 线程，A6 再固化。 |
| `GOAL` | 只读证明项目根仅有指定SHA源合同，尚未初始化Git且尚未创建阻塞记录。 |
| `SUCCESS_CRITERIA` | 合同哈希匹配；根路径正确；除源合同外无其他条目；`.git` 和 `docs/reviews/BLOCKERS.md` 均不存在；无无关工程或未授权内容。 |
| `AUTHORIZED_READ_PATHS` | 源合同内容、项目根目录条目名称和外部active goal证据；不得读取项目根外文件。 |
| `AUTHORIZED_WRITE_PATHS` | `NONE_READ_ONLY` |
| `CONDITIONAL_BLOCKER_WRITE` | `NONE_READ_ONLY`；A0只在线程回执报告门禁失败并停止。 |
| `FORBIDDEN_ACTIONS` | 任何文件写入、依赖安装、远程/推送/部署、真实数据/正式AI/支付/生产密钥、后续阶段、破坏性Git操作。 |
| `VALIDATION_COMMANDS` | `rtk proxy certutil -hashfile PHASE_1A_BATCH_A_CODEX_EXECUTION.md SHA256`；只读枚举项目根条目名并确认只有源合同；使用 `Test-Path` 等价只读检查确认 `.git` 和 `docs/reviews/BLOCKERS.md` 均不存在。A0不运行Git仓库命令。 |
| `GIT_DISPOSITION` | `NONE_READ_ONLY` |
| `RECEIPT_STORAGE` | `THREAD_UNTIL_A6` |

- **进入**：外部active goal证据匹配后，仅允许只读检查上述合法初始态；不要求阻塞文件存在。
- **动作**：核对根路径、根目录条目名称和合同SHA，确认只有源合同且 `.git` 与 `docs/reviews/BLOCKERS.md` 均不存在。不创建、不修改任何文件。
- **通过证据**：项目根正确；源合同是唯一条目且哈希匹配；`.git` 与阻塞文件不存在；无无关工程。
**停止**：任一项不符即仅在当前Codex线程报告并停止，不创建 `BLOCKERS.md`、不初始化Git、不修改合同。

### A1 Git与项目治理基线

#### 内嵌任务合同实例

| 核心字段 | 已批准值 |
|---|---|
| `TASK_ID` | `PHASE_1A_BATCH_A_A1_GOVERNANCE` |
| `CONTRACT_VERSION` | `CREATED_BY_COMMIT_1` |
| `DECISION_BASELINE_VERSION` | `CREATED_BY_COMMIT_1` |
| `EXECUTOR_ROLE` | `TECH_LEAD` |
| `AUTHORIZATION_EVIDENCE_ID` | `CODEX_ACTIVE_GOAL_2026-08-21_PHASE_1A_BATCH_A` |
| `AUTHORIZATION_THREAD_ID` | `01a02398-b83a-7382-a314-353da24ee898` |
| `AUTHORIZATION_OBJECTIVE_UTF8_BYTES` | `2895` |
| `AUTHORIZATION_OBJECTIVE_SHA256` | `9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089` |
| `AUTHORIZATION_RECORD_SHA256` | `CREATED_BY_COMMIT_1` |
| `CONTRACT_APPROVAL_STATUS` | `APPROVED` |
| `ACTIVATION_POLICY` | 仅在 A0 线程回执 `PASS`，且A1动手前项目根仍与A0合法初始态完全一致时激活A1；不要求 `docs/reviews/BLOCKERS.md` 预先存在。 |
| `PREVIOUS_STAGE_EVIDENCE` | A0线程回执：合同哈希匹配、项目根只有源合同、`.git` 和 `docs/reviews/BLOCKERS.md` 均不存在、无无关内容、结论为 `PASS`。 |
| `PRECONDITION_REF` | `A0_THREAD_RECEIPT_AND_UNCHANGED_INITIAL_DIRECTORY` |
| `GOVERNANCE_FREEZE_POLICY` | A1创建初始治理树；最终Commit 1 SHA只能在提交后由主线程阶段回执记录。 |
| `BLOCKER_CHECK_POLICY` | `BOOTSTRAP_CREATE_AFTER_ACTIVATION`；A1激活前必须确认 `docs/reviews/BLOCKERS.md` 不存在。A1激活后在初始治理树中首次创建该文件；无实质阻塞时写入唯一 `NO_BLOCKERS`。 |
| `GOAL` | 建立 Phase 1A 批次A可执行、可追踪、可停止的 Git 与项目治理基线。 |
| `SUCCESS_CRITERIA` | 19个批准路径且18个自有文件非空、UTF-8无BOM；治理规则覆盖合同；源合同字节及SHA不变；唯一 Commit 1、工作区干净、无远程。 |
| `AUTHORIZED_READ_PATHS` | A1激活前仅可读取源合同、A0线程回执、外部active goal证据和项目根条目名称，不读取尚未创建的治理文件；A1激活并完成对应创建后，可读取源合同、本文件“Commit 1显式暂存清单”的19个精确路径，以及完成status、diff、显式暂存和Commit 1所必需的 `.git` 元数据；禁止其他路径。 |
| `AUTHORIZED_WRITE_PATHS` | 本文件“Commit 1显式暂存清单”中除只读源合同外的18个精确路径，以及仅用于 `git init`、目标分支和计划内Commit 1的 `.git` 元数据。 |
| `CONDITIONAL_BLOCKER_WRITE` | A1正常路径只在最终初始治理树中一次性创建 `docs/reviews/BLOCKERS.md` 并写入单一 `NO_BLOCKERS`，此后正常路径不得改写；若A1发现实质阻塞，可首次创建或修改该文件，记录证据与最小解除条件并立即停止。 |
| `FORBIDDEN_ACTIONS` | 修改源合同；白名单外写入；依赖安装；真实数据、正式AI、支付、生产密钥；远程、推送、部署；后续阶段；`git add .`、`git add -A`、破坏性清理。 |
| `VALIDATION_COMMANDS` | 初始化前Git branch/tree/status/cached/remote字段均记 `NOT_APPLICABLE_BOOTSTRAP`，且不得运行Git仓库命令；初始化后运行合同SHA、UTF-8/非空/19路径、`rtk git diff --check`、自有文件path-scoped `rtk git diff --cached --check`、`rtk git status --short --branch` 与 `rtk git remote -v` 并记录实际结果。 |
| `GIT_DISPOSITION` | `CREATED`：Commit 1 `chore: establish phase 1a project governance` |
| `RECEIPT_STORAGE` | `THREAD_UNTIL_A6` |

- **进入**：仅在A0线程回执证明硬门禁 `PASS`，且项目根仍只有源合同、`.git` 与 `docs/reviews/BLOCKERS.md` 仍不存在时激活A1。
- **授权文件**：根目录 `.gitignore`、`AGENTS.md`、`README.md`、`PLANS.md`；`docs/project/` 六个治理文件；`docs/agents/` 四个角色卡；`docs/templates/` 两个模板；本执行计划；`docs/reviews/BLOCKERS.md`；以及保持字节不变的源合同。
- **动作**：再次确认初始目录未变；初始化Git并创建 `planning/phase-1a-batch-a`；建立权威来源、术语、范围、职责、变更、任务合同、验证和停止规则；首次创建 `BLOCKERS.md` 并写入唯一 `NO_BLOCKERS`。
- **验证**：目标分支、精确19文件清单、唯一 `NO_BLOCKERS`、非空、UTF-8无BOM、关键规则覆盖、合同 SHA、`rtk git diff --check`；显式暂存后对自有文件运行 `rtk proxy --% git diff --cached --check -- . :(exclude)PHASE_1A_BATCH_A_CODEX_EXECUTION.md`，源合同用 SHA-256 和固定5处 Markdown 硬换行例外单独核验。
- **提交**：Commit 1 `chore: establish phase 1a project governance`。
**停止**：回报 Commit 1 SHA；不得开始 A2。

### A2 产品规格基线

#### 内嵌任务合同实例

| 核心字段 | 已批准值 |
|---|---|
| `TASK_ID` | `PHASE_1A_BATCH_A_A2_PRODUCT_BASELINE` |
| `CONTRACT_VERSION` | `1.0-2026-08-21` |
| `DECISION_BASELINE_VERSION` | `COMMIT_1_SHA_FROM_STAGE_RECEIPT` |
| `EXECUTOR_ROLE` | `PRODUCT_MANAGER` |
| `AUTHORIZATION_EVIDENCE_ID` | `CODEX_ACTIVE_GOAL_2026-08-21_PHASE_1A_BATCH_A` |
| `AUTHORIZATION_THREAD_ID` | `01a02398-b83a-7382-a314-353da24ee898` |
| `AUTHORIZATION_OBJECTIVE_UTF8_BYTES` | `2895` |
| `AUTHORIZATION_OBJECTIVE_SHA256` | `9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089` |
| `AUTHORIZATION_RECORD_SHA256` | `DBD4068CCEC13CD2E1EDA2E25C511612BB087D45E184EB3363CDAEBB8C958C6E` |
| `CONTRACT_APPROVAL_STATUS` | `APPROVED` |
| `ACTIVATION_POLICY` | 仅在主线程传入最终 Commit 1 SHA、A1规范/质量复审均 `PASS`、工作区干净且初始治理文件相对 Commit 1 未变时激活 A2。 |
| `PREVIOUS_STAGE_EVIDENCE` | A1主线程阶段回执必须含实际最终 Commit 1 SHA、合同与授权证据哈希、19路径/编码/空白/无remote/clean结果及规范/质量复审结论；A6报告再固化实际值。 |
| `PRECONDITION_REF` | `A1_TERMINAL_STAGE_RECEIPT` |
| `GOVERNANCE_FREEZE_POLICY` | 从A1主线程回执取得最终Commit 1 SHA；启动时核对该提交初始19路径未变，差异即阻塞。 |
| `BLOCKER_CHECK_POLICY` | 启动前读取 `docs/reviews/BLOCKERS.md`，仅单一 `NO_BLOCKERS` 可进入；检查时间和结果先记当前 Codex 线程，A6 再固化到最终评审报告。 |
| `GOAL` | 交付覆盖合同范围、V0.1映射、三端职责和可操作状态的产品规格基线。 |
| `SUCCESS_CRITERIA` | 九个文档齐全；合同12项可追踪；“访客”及三端规则一致；B级12项有状态转换；三条完整闭环定义；V0.1锁定字段、流程和验收点不删弱漏。 |
| `AUTHORIZED_READ_PATHS` | 源合同、六项必读治理/计划/阻塞文件、Commit 1中的治理与角色文件。 |
| `AUTHORIZED_WRITE_PATHS` | `docs/product/PLATFORM_PRD.md`；`docs/product/V0_1_PRD.md`；`docs/product/ROLE_MATRIX.md`；`docs/product/ENDPOINT_MATRIX.md`；`docs/product/PAGE_INVENTORY.md`；`docs/product/USER_FLOWS.md`；`docs/product/CONTENT_SCHEMA.md`；`docs/product/STATE_MODEL.md`；`docs/product/ACCEPTANCE_CRITERIA.md`。 |
| `CONDITIONAL_BLOCKER_WRITE` | 发现实质阻塞时，仅可修改 `docs/reviews/BLOCKERS.md`，记录证据与最小解除条件并立即停止；正常路径不得修改该文件。 |
| `FORBIDDEN_ACTIONS` | 白名单外写入；删弱V0.1映射；静态替代状态转换；依赖、正式代码、真实数据、正式AI/支付/密钥、远程/推送/部署、后续阶段。 |
| `VALIDATION_COMMANDS` | `rtk proxy certutil -hashfile PHASE_1A_BATCH_A_CODEX_EXECUTION.md SHA256`；九文件UTF-8/非空/覆盖检查；术语、B级12项和三闭环内容检查；`rtk git diff --check`；显式暂存后的 `rtk git diff --cached --check`。 |
| `GIT_DISPOSITION` | `CREATED`：Commit 2 `docs: define phase 1a batch a product baseline` |
| `RECEIPT_STORAGE` | `THREAD_UNTIL_A6` |

- **进入**：仅在主线程阶段回执传入最终 Commit 1 SHA、A1规范/质量复审均 `PASS`、治理文件相对该SHA未变且阻塞状态为单一 `NO_BLOCKERS` 时激活。
- **动作**：创建平台/V0.1 PRD、角色和端侧矩阵、页面清单、八条流程、内容字段、状态模型与验收标准。V0.1 合并映射必须保留原始内容和验收点；B级12项全部定义可操作状态。
- **验证**：合同覆盖矩阵；“访客”术语；三端职责；V0.1 不删弱漏；家长绑定、教师任务到日报、AI学习助手闭环设计。
- **提交**：Commit 2 `docs: define phase 1a batch a product baseline`。
**停止**：回报 Commit 2 SHA；不得开始 A3。

### A3 架构、数据、权限与AI安全草案

#### 内嵌任务合同实例

| 核心字段 | 已批准值 |
|---|---|
| `TASK_ID` | `PHASE_1A_BATCH_A_A3_ARCHITECTURE_AI` |
| `CONTRACT_VERSION` | `1.0-2026-08-21` |
| `DECISION_BASELINE_VERSION` | `COMMIT_1_SHA_FROM_STAGE_RECEIPT` |
| `EXECUTOR_ROLE` | `TECH_LEAD` |
| `AUTHORIZATION_EVIDENCE_ID` | `CODEX_ACTIVE_GOAL_2026-08-21_PHASE_1A_BATCH_A` |
| `AUTHORIZATION_THREAD_ID` | `01a02398-b83a-7382-a314-353da24ee898` |
| `AUTHORIZATION_OBJECTIVE_UTF8_BYTES` | `2895` |
| `AUTHORIZATION_OBJECTIVE_SHA256` | `9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089` |
| `AUTHORIZATION_RECORD_SHA256` | `DBD4068CCEC13CD2E1EDA2E25C511612BB087D45E184EB3363CDAEBB8C958C6E` |
| `CONTRACT_APPROVAL_STATUS` | `APPROVED` |
| `ACTIVATION_POLICY` | 仅在 A2 Commit 2 与产品规格复审均 `PASS`，且治理文件相对最终 Commit 1 未变时激活 A3。 |
| `PREVIOUS_STAGE_EVIDENCE` | A2线程回执必须含实际 Commit 2 SHA、九个产品文件哈希、验证/复审结果、clean状态及最终 Commit 1治理基线核对结果。 |
| `PRECONDITION_REF` | `A2_THREAD_RECEIPT_AND_COMMIT_2` |
| `GOVERNANCE_FREEZE_POLICY` | 使用A1回执中的最终Commit 1 SHA核对该提交初始19路径未变，差异即阻塞。 |
| `BLOCKER_CHECK_POLICY` | 启动前读取 `docs/reviews/BLOCKERS.md`，仅单一 `NO_BLOCKERS` 可进入；检查时间和结果先记当前 Codex 线程，A6 再固化到最终评审报告。 |
| `GOAL` | 交付统一后端、多租户、数据权限、文件环境和AI安全边界的可审查架构草案。 |
| `SUCCESS_CRITERIA` | 十三个文档齐全；`tenant_id`/`campus_id`及服务端可信注入覆盖各隔离面；未成年人规则可执行；AI第0至3层及巩固层、禁止能力和降级路径完整。 |
| `AUTHORIZED_READ_PATHS` | 源合同、六项必读治理/计划/阻塞文件、Commit 1治理文件、A2九个产品规格文件。 |
| `AUTHORIZED_WRITE_PATHS` | `docs/architecture/SYSTEM_ARCHITECTURE_DRAFT.md`；`docs/architecture/MODULE_BOUNDARIES_DRAFT.md`；`docs/architecture/MULTI_TENANCY_DRAFT.md`；`docs/architecture/IDENTITY_AND_AUTHORIZATION_DRAFT.md`；`docs/architecture/DATA_MODEL_DRAFT.md`；`docs/architecture/API_BOUNDARIES_DRAFT.md`；`docs/architecture/FILE_STORAGE_DRAFT.md`；`docs/architecture/ENVIRONMENTS_AND_DEPLOYMENT_DRAFT.md`；`docs/architecture/SECURITY_AND_PRIVACY_DRAFT.md`；`docs/ai/AI_LEARNING_ASSISTANT_PRODUCT_SPEC.md`；`docs/ai/AI_LEARNING_FLOW.md`；`docs/ai/AI_SAFETY_BASELINE.md`；`docs/ai/AI_EVALUATION_DRAFT.md`。 |
| `CONDITIONAL_BLOCKER_WRITE` | 发现实质阻塞时，仅可修改 `docs/reviews/BLOCKERS.md`，记录证据与最小解除条件并立即停止；正常路径不得修改该文件。 |
| `FORBIDDEN_ACTIONS` | 白名单外写入；正式代码、迁移或脚手架；弱化租户/未成年人/AI边界；依赖、真实数据、正式AI/支付/密钥、远程/推送/部署、后续阶段。 |
| `VALIDATION_COMMANDS` | `rtk proxy certutil -hashfile PHASE_1A_BATCH_A_CODEX_EXECUTION.md SHA256`；十三文件UTF-8/非空检查；多租户和AI安全关键字/覆盖检查；`rtk git diff --check`；显式暂存后的 `rtk git diff --cached --check`。 |
| `GIT_DISPOSITION` | `CREATED`：Commit 3 `docs: draft platform architecture and ai safety` |
| `RECEIPT_STORAGE` | `THREAD_UNTIL_A6` |

- **进入**：仅在A2线程回执证明Commit 2与产品规格复审均 `PASS`、治理文件相对最终Commit 1未变且阻塞状态为单一 `NO_BLOCKERS` 时激活。
- **动作**：创建系统/模块、多租户、身份权限、数据、API、文件、环境部署、安全及 AI 产品/流程/安全/评测草案；只设计，不脚手架化。
- **验证**：`tenant_id`、`campus_id`、服务端可信注入、数据/文件/缓存/任务/审计/AI隔离；未成年人规则；AI第0、1、2、3层及巩固层；禁止能力和降级路径。
- **提交**：Commit 3 `docs: draft platform architecture and ai safety`。
**停止**：回报 Commit 3 SHA；不得开始 A4。

### A4 三端低保真可点击原型

#### 内嵌任务合同实例

| 核心字段 | 已批准值 |
|---|---|
| `TASK_ID` | `PHASE_1A_BATCH_A_A4_LOW_FIDELITY_PROTOTYPE` |
| `CONTRACT_VERSION` | `1.0-2026-08-21` |
| `DECISION_BASELINE_VERSION` | `COMMIT_1_SHA_FROM_STAGE_RECEIPT` |
| `EXECUTOR_ROLE` | `UI_UX_AGENT` |
| `AUTHORIZATION_EVIDENCE_ID` | `CODEX_ACTIVE_GOAL_2026-08-21_PHASE_1A_BATCH_A` |
| `AUTHORIZATION_THREAD_ID` | `01a02398-b83a-7382-a314-353da24ee898` |
| `AUTHORIZATION_OBJECTIVE_UTF8_BYTES` | `2895` |
| `AUTHORIZATION_OBJECTIVE_SHA256` | `9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089` |
| `AUTHORIZATION_RECORD_SHA256` | `DBD4068CCEC13CD2E1EDA2E25C511612BB087D45E184EB3363CDAEBB8C958C6E` |
| `CONTRACT_APPROVAL_STATUS` | `APPROVED` |
| `ACTIVATION_POLICY` | 仅在 A3 Commit 3 与架构/AI安全复审均 `PASS`，且治理文件相对最终 Commit 1 未变时激活 A4。 |
| `PREVIOUS_STAGE_EVIDENCE` | A3线程回执必须含实际 Commit 3 SHA、十三个架构/AI文件哈希、验证/复审结果、clean状态及最终 Commit 1治理基线核对结果。 |
| `PRECONDITION_REF` | `A3_THREAD_RECEIPT_AND_COMMIT_3` |
| `GOVERNANCE_FREEZE_POLICY` | 使用A1回执中的最终Commit 1 SHA核对该提交初始19路径未变，差异即阻塞。 |
| `BLOCKER_CHECK_POLICY` | 启动前读取 `docs/reviews/BLOCKERS.md`，仅单一 `NO_BLOCKERS` 可进入；检查时间和结果先记当前 Codex 线程，A6 再固化到最终评审报告。 |
| `GOAL` | 用零依赖静态文件交付三端低保真可点击原型和三条关键业务闭环。 |
| `SUCCESS_CRITERIA` | 三个原型文件齐全；三端职责清楚；A级与B级12项可操作；家长绑定、教师任务到日报、AI学习助手完整可点击；AI五层、模拟数据和V0.1验收映射可见。 |
| `AUTHORIZED_READ_PATHS` | 源合同、六项必读治理/计划/阻塞文件、A2产品规格文件、A3架构与AI草案文件。 |
| `AUTHORIZED_WRITE_PATHS` | `prototypes/low-fidelity/index.html`；`prototypes/low-fidelity/styles/main.css`；`prototypes/low-fidelity/scripts/app.js`。 |
| `CONDITIONAL_BLOCKER_WRITE` | 发现实质阻塞时，仅可修改 `docs/reviews/BLOCKERS.md`，记录证据与最小解除条件并立即停止；正常路径不得修改该文件。 |
| `FORBIDDEN_ACTIONS` | 白名单外写入；高保真扩张；外部请求；依赖、正式代码、真实数据、正式AI/支付/密钥、远程/推送/部署、后续阶段。 |
| `VALIDATION_COMMANDS` | 三文件UTF-8/非空检查；静态链接目标和页面ID检查；三条闭环及AI五层内容检查；`rtk git diff --check`；`rtk git status --short`。 |
| `GIT_DISPOSITION` | `DEFERRED_TO_COMMIT_4`；必须保留逐文件SHA-256与执行前后Git tree/工作区证据。 |
| `RECEIPT_STORAGE` | `THREAD_UNTIL_A6` |

- **进入**：仅在A3线程回执证明Commit 3与架构/AI安全复审均 `PASS`、治理文件相对最终Commit 1未变且阻塞状态为单一 `NO_BLOCKERS` 时激活。
- **动作**：用零依赖 HTML/CSS/少量原生 JavaScript 建立统一入口、A级页面和B级12项；三端框架清楚，使用虚构模拟数据，不发外部请求。
- **验证**：每页独立 ID/路由；内部链接目标存在；空/错/权限/终态可见；三条关键闭环可点击；AI五层可操作；V0.1合并验收点可追踪。
- **提交**：暂不单独提交，与 A5—A7 一并进入 Commit 4。
**停止**：原型内部审查后等待 A5 单独授权。

### A5 自动验证与原型验证

#### 内嵌任务合同实例

| 核心字段 | 已批准值 |
|---|---|
| `TASK_ID` | `PHASE_1A_BATCH_A_A5_VERIFICATION` |
| `CONTRACT_VERSION` | `1.0-2026-08-21` |
| `DECISION_BASELINE_VERSION` | `COMMIT_1_SHA_FROM_STAGE_RECEIPT` |
| `EXECUTOR_ROLE` | `QA_SECURITY_AGENT` |
| `AUTHORIZATION_EVIDENCE_ID` | `CODEX_ACTIVE_GOAL_2026-08-21_PHASE_1A_BATCH_A` |
| `AUTHORIZATION_THREAD_ID` | `01a02398-b83a-7382-a314-353da24ee898` |
| `AUTHORIZATION_OBJECTIVE_UTF8_BYTES` | `2895` |
| `AUTHORIZATION_OBJECTIVE_SHA256` | `9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089` |
| `AUTHORIZATION_RECORD_SHA256` | `DBD4068CCEC13CD2E1EDA2E25C511612BB087D45E184EB3363CDAEBB8C958C6E` |
| `CONTRACT_APPROVAL_STATUS` | `APPROVED` |
| `ACTIVATION_POLICY` | 仅在 A4线程回执、三个原型文件SHA-256和原型复审均 `PASS`，且治理文件相对最终 Commit 1 未变时激活 A5。 |
| `PREVIOUS_STAGE_EVIDENCE` | A4线程回执必须含三个原型文件的实际SHA-256、链接/页面/三闭环/AI五层复审结果和执行前后工作区证据。 |
| `PRECONDITION_REF` | `A4_THREAD_RECEIPT_AND_PROTOTYPE_HASHES` |
| `GOVERNANCE_FREEZE_POLICY` | 使用A1回执中的最终Commit 1 SHA核对该提交初始19路径未变，差异即阻塞。 |
| `BLOCKER_CHECK_POLICY` | 启动前读取 `docs/reviews/BLOCKERS.md`，仅单一 `NO_BLOCKERS` 可进入；检查时间和结果先记当前 Codex 线程，A6 再固化到最终评审报告。 |
| `GOAL` | 建立并实际运行批次A自动验证，对原型执行静态及可用时的浏览器验证。 |
| `SUCCESS_CRITERIA` | 验证脚本实际通过；失败数为0；浏览器成功时恰好生成下列6张截图，失败或不可用时恰好0张；不得出现部分截图集合；命令、退出码、哈希、来源与普通/忽略路径审计齐全。 |
| `AUTHORIZED_READ_PATHS` | 源合同、六项必读治理/计划/阻塞文件、A2/A3全部批准文档、A4三个原型文件、Git普通与忽略路径名称。 |
| `AUTHORIZED_WRITE_PATHS` | `scripts/verify_phase_1a_batch_a.py`；成功时精确6项：`artifacts/screenshots/mini-visitor-home.png`、`artifacts/screenshots/web-visitor-home.png`、`artifacts/screenshots/admin-dashboard.png`、`artifacts/screenshots/flow-guardian-binding.png`、`artifacts/screenshots/flow-teacher-daily-report.png`、`artifacts/screenshots/flow-ai-learning-assistant.png`；浏览器失败或不可用时截图集合精确为0项。 |
| `CONDITIONAL_BLOCKER_WRITE` | 发现实质阻塞时，仅可修改 `docs/reviews/BLOCKERS.md`，记录证据与最小解除条件并立即停止；正常路径不得修改该文件。 |
| `FORBIDDEN_ACTIONS` | 部分截图集合、伪造截图/PASS、为浏览器安装依赖、读取忽略文件内容、白名单外写入、真实数据、正式AI/支付/密钥、远程/推送/部署、后续阶段。 |
| `VALIDATION_COMMANDS` | `rtk python scripts/verify_phase_1a_batch_a.py`；浏览器可用时执行六个批准场景；`rtk git status --ignored --short`；截图0/6精确集合与逐文件SHA-256检查；`rtk git diff --check`。 |
| `GIT_DISPOSITION` | `DEFERRED_TO_COMMIT_4`；必须保留脚本/实际截图SHA-256与执行前后Git tree/工作区证据。 |
| `RECEIPT_STORAGE` | `THREAD_UNTIL_A6` |

- **进入**：仅在A4线程回执与三个原型文件SHA-256齐全、原型复审 `PASS` 且阻塞状态为单一 `NO_BLOCKERS` 时激活。
- **动作**：创建验证脚本，检查文件、内容、术语、流程、链接、密钥、真实数据、阻塞状态和虚假生产声明；运行 `rtk git status --ignored --short` 只审计路径。浏览器不可用或失败时不安装工具、不生成截图，记录限制并完成静态验证；浏览器真实成功时六个批准场景必须全部成功并生成精确6张截图。
- **验证**：完整命令、退出码、失败数、静态/浏览器结果、截图来源和忽略路径；截图集合只能为成功时精确6项或失败/不可用时精确0项；`.env.example` 若存在必须被发现并排除，批准的 `artifacts/` 证据不得被忽略。
**停止**：存在失败不得进入 A6；不得伪造截图或 `PASS`。

### A6 审查证据与压缩包

#### 内嵌任务合同实例

| 核心字段 | 已批准值 |
|---|---|
| `TASK_ID` | `PHASE_1A_BATCH_A_A6_REVIEW_PACKAGE` |
| `CONTRACT_VERSION` | `1.0-2026-08-21` |
| `DECISION_BASELINE_VERSION` | `COMMIT_1_SHA_FROM_STAGE_RECEIPT` |
| `EXECUTOR_ROLE` | `QA_SECURITY_AGENT` |
| `AUTHORIZATION_EVIDENCE_ID` | `CODEX_ACTIVE_GOAL_2026-08-21_PHASE_1A_BATCH_A` |
| `AUTHORIZATION_THREAD_ID` | `01a02398-b83a-7382-a314-353da24ee898` |
| `AUTHORIZATION_OBJECTIVE_UTF8_BYTES` | `2895` |
| `AUTHORIZATION_OBJECTIVE_SHA256` | `9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089` |
| `AUTHORIZATION_RECORD_SHA256` | `DBD4068CCEC13CD2E1EDA2E25C511612BB087D45E184EB3363CDAEBB8C958C6E` |
| `CONTRACT_APPROVAL_STATUS` | `APPROVED` |
| `ACTIVATION_POLICY` | 仅在 A5自动验证 `PASS`、截图精确6项或不可用/失败时精确0项证据完整，且治理文件相对最终 Commit 1 未变时激活 A6。 |
| `PREVIOUS_STAGE_EVIDENCE` | A5线程回执必须含验证脚本SHA-256、命令/退出码/失败数、普通与忽略路径审计，以及6张截图逐文件哈希或浏览器不可用/失败且0截图的证据。 |
| `PRECONDITION_REF` | `A5_THREAD_RECEIPT_AND_VERIFICATION_PASS` |
| `GOVERNANCE_FREEZE_POLICY` | 使用A1回执中的最终Commit 1 SHA核对该提交初始19路径未变，并把实际SHA与结果固化到最终评审报告。 |
| `BLOCKER_CHECK_POLICY` | 启动前读取 `docs/reviews/BLOCKERS.md`，仅单一 `NO_BLOCKERS` 可进入；检查时间和结果直接写入最终评审报告A6回执。 |
| `GOAL` | 打包前冻结tracked评审证据、文件清单和载荷清单；打包后在仓库外线程回执记录ZIP、根最终清单与中央目录验证，使A7无需改动任何tracked交付物。 |
| `SUCCESS_CRITERIA` | 最终评审报告只记录A0—A5与A6 pre-package实际证据、Commit 1—3、浏览器证据及post-package外部回执声明；报告、FILE_INVENTORY和ZIP内payload manifest在打包前冻结且永不回写；项目负责人稳定确认48或54成员数与名单SHA；ZIP验证后仅一次覆盖根最终manifest，随后生成 `THREAD_POST_PACKAGE` 并保持零tracked写。 |
| `AUTHORIZED_READ_PATHS` | 源合同、六项必读治理/计划/阻塞文件、A0—A5线程回执、A2—A5全部批准产物，以及下列文件级ZIP白名单。 |
| `AUTHORIZED_WRITE_PATHS` | `docs/reviews/PHASE_1A_BATCH_A_REVIEW.md`；`docs/reviews/FILE_INVENTORY.md`；`SHA256SUMS.txt`；`artifacts/review-package/student-care-platform-phase1a-batch-a-review-pack-v1.0.zip`。 |
| `CONDITIONAL_BLOCKER_WRITE` | 发现实质阻塞时，仅可修改 `docs/reviews/BLOCKERS.md`，记录证据与最小解除条件并立即停止；正常路径不得修改该文件。 |
| `FORBIDDEN_ACTIONS` | `Expand-Archive`、任何解包或临时解包目录、目录递归授权、通配打包、部分截图集合、额外成员、篡改源合同、白名单外写入、依赖、真实数据、正式AI/支付/密钥、远程/推送/部署、后续阶段。 |
| `VALIDATION_COMMANDS` | `rtk python scripts/verify_phase_1a_batch_a.py`；该脚本必须用 `zipfile.ZipFile.infolist()` 直接审计中央目录，校验 `ZipInfo.filename` 精确白名单、重复名、尾斜杠目录项、绝对路径、盘符、`..`、CRC/可读性及逐成员流式SHA；复算包内与根清单；`rtk git diff --check`。 |
| `GIT_DISPOSITION` | `DEFERRED_TO_COMMIT_4`；必须保留批准产物SHA-256、ZIP成员比较及执行前后Git tree/工作区证据。 |
| `RECEIPT_STORAGE` | `REPOSITORY_REVIEW` |
| `POST_PACKAGE_RECEIPT_STORAGE` | `THREAD_POST_PACKAGE` |
| `ZIP_MEMBER_CONFIRMATION_EVIDENCE` | 记录用户确认消息或turn ID；无ID时保存精确确认原文、原文UTF-8字节数与SHA-256，禁止Unicode/空白/换行规范化；并记录确认时间、实际48或54成员数、名单SHA-256与goal SHA。 |

- **进入**：仅在A5验证 `PASS`、精确6截图或不可用/失败且精确0截图证据齐全、阻塞状态为单一 `NO_BLOCKERS` 时激活。
- **动作**：先最终冻结评审报告、文件清单和只校验载荷的ZIP内payload manifest；报告列 A0—A5与A6 pre-package证据、Commit 1—3、浏览器证据，并声明 Commit 4 SHA 和post-package结果只进入外部回执/最终终端。按固定算法计算48或54成员名单SHA，由主线程取得项目负责人对成员数、名单SHA与goal SHA的重新确认；无turn ID时原样保存确认原文并计算UTF-8字节数与SHA-256，不作任何规范化。未确认即 `BLOCKED` 且不得生成ZIP。确认后逐文件写入并验证ZIP；验证通过后唯一允许的post-ZIP tracked写是一次性覆盖根 `SHA256SUMS.txt` 为含ZIP哈希的最终manifest。随后计算root manifest SHA并生成 `THREAD_POST_PACKAGE`；自此零tracked写，报告、FILE_INVENTORY和ZIP内payload manifest永不回写。

`ZIP_MEMBER_WHITELIST_BASE` 固定为以下48个文件成员：

```text
PHASE_1A_BATCH_A_CODEX_EXECUTION.md
.gitignore
AGENTS.md
README.md
PLANS.md
docs/project/PROJECT_CHARTER.md
docs/project/DECISION_BASELINE.md
docs/project/TERMINOLOGY.md
docs/project/SCOPE_AND_NON_SCOPE.md
docs/project/CHANGE_CONTROL.md
docs/project/RESPONSIBILITY_MATRIX.md
docs/agents/PRODUCT_MANAGER.md
docs/agents/TECH_LEAD.md
docs/agents/UI_UX_AGENT.md
docs/agents/QA_SECURITY_AGENT.md
docs/templates/TASK_CONTRACT.md
docs/templates/REVIEW_RECEIPT.md
docs/plans/PHASE_1A_BATCH_A_EXEC_PLAN.md
docs/product/PLATFORM_PRD.md
docs/product/V0_1_PRD.md
docs/product/ROLE_MATRIX.md
docs/product/ENDPOINT_MATRIX.md
docs/product/PAGE_INVENTORY.md
docs/product/USER_FLOWS.md
docs/product/CONTENT_SCHEMA.md
docs/product/STATE_MODEL.md
docs/product/ACCEPTANCE_CRITERIA.md
docs/architecture/SYSTEM_ARCHITECTURE_DRAFT.md
docs/architecture/MODULE_BOUNDARIES_DRAFT.md
docs/architecture/MULTI_TENANCY_DRAFT.md
docs/architecture/IDENTITY_AND_AUTHORIZATION_DRAFT.md
docs/architecture/DATA_MODEL_DRAFT.md
docs/architecture/API_BOUNDARIES_DRAFT.md
docs/architecture/FILE_STORAGE_DRAFT.md
docs/architecture/ENVIRONMENTS_AND_DEPLOYMENT_DRAFT.md
docs/architecture/SECURITY_AND_PRIVACY_DRAFT.md
docs/ai/AI_LEARNING_ASSISTANT_PRODUCT_SPEC.md
docs/ai/AI_LEARNING_FLOW.md
docs/ai/AI_SAFETY_BASELINE.md
docs/ai/AI_EVALUATION_DRAFT.md
docs/reviews/PHASE_1A_BATCH_A_REVIEW.md
docs/reviews/FILE_INVENTORY.md
docs/reviews/BLOCKERS.md
prototypes/low-fidelity/index.html
prototypes/low-fidelity/styles/main.css
prototypes/low-fidelity/scripts/app.js
scripts/verify_phase_1a_batch_a.py
SHA256SUMS.txt
```

`ZIP_MEMBER_SCREENSHOT_SET` 只有两种允许结果：A5浏览器验证失败或不可用时为零成员；A5真实成功且六个文件均有哈希证据时，追加以下精确六个成员，不允许部分集合或其他文件名：

```text
artifacts/screenshots/mini-visitor-home.png
artifacts/screenshots/web-visitor-home.png
artifacts/screenshots/admin-dashboard.png
artifacts/screenshots/flow-guardian-binding.png
artifacts/screenshots/flow-teacher-daily-report.png
artifacts/screenshots/flow-ai-learning-assistant.png
```

目录名只用于分类，不是 ZIP 成员授权；ZIP 不写独立目录条目。禁止 `.git`、依赖、缓存、密钥、无关文件和任何批次B材料。ZIP内 `SHA256SUMS.txt` 只校验除自身外的载荷文件且永不回写；ZIP生成并验证后，仅一次覆盖根 `SHA256SUMS.txt`，列出核心文件并追加ZIP哈希。

- **验证**：成员名单先转为POSIX相对路径并按路径字符串序数升序；SHA-256输入为UTF-8无BOM、一行一项、仅LF分隔且恰好一个末尾LF。`ZIP_MEMBER_CONFIRMATION_EVIDENCE` 记录用户确认消息/turn ID；无ID时保存精确确认原文、原文UTF-8字节数与SHA-256，不得规范化Unicode、空白或换行；确认对象同时含实际48或54成员数、名单SHA与goal SHA。仅在确认后使用 `zipfile.ZipFile.infolist()` 审计中央目录并逐成员流式验证；失败即停止。ZIP验证后仅允许一次根manifest写入，随后零tracked写。禁止解包与临时解包目录。
**停止**：`THREAD_POST_PACKAGE` 未完整记录且验证未 `PASS`，不得进入 A7。

### A7 Commit 4、最终门禁与停止

#### 内嵌任务合同实例

| 核心字段 | 已批准值 |
|---|---|
| `TASK_ID` | `PHASE_1A_BATCH_A_A7_FINAL_GATE` |
| `CONTRACT_VERSION` | `1.0-2026-08-21` |
| `DECISION_BASELINE_VERSION` | `COMMIT_1_SHA_FROM_STAGE_RECEIPT` |
| `EXECUTOR_ROLE` | `QA_SECURITY_AGENT` |
| `AUTHORIZATION_EVIDENCE_ID` | `CODEX_ACTIVE_GOAL_2026-08-21_PHASE_1A_BATCH_A` |
| `AUTHORIZATION_THREAD_ID` | `01a02398-b83a-7382-a314-353da24ee898` |
| `AUTHORIZATION_OBJECTIVE_UTF8_BYTES` | `2895` |
| `AUTHORIZATION_OBJECTIVE_SHA256` | `9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089` |
| `AUTHORIZATION_RECORD_SHA256` | `DBD4068CCEC13CD2E1EDA2E25C511612BB087D45E184EB3363CDAEBB8C958C6E` |
| `CONTRACT_APPROVAL_STATUS` | `APPROVED` |
| `ACTIVATION_POLICY` | 仅在 A6仓库评审的pre-package证据与仓库外 `THREAD_POST_PACKAGE` 回执均 `PASS`、全部交付物已最终化且治理文件相对最终 Commit 1 未变时激活 A7。 |
| `PREVIOUS_STAGE_EVIDENCE` | A6仓库评审报告必须含最终报告/清单的pre-package证据；`THREAD_POST_PACKAGE` 必须含ZIP SHA、root manifest SHA、运行时白名单SHA、48或54成员中央目录审计、CRC/可读性/流式SHA结果、命令、时间及 `PASS`。 |
| `PRECONDITION_REF` | `A6_REPOSITORY_REVIEW_PRE_PACKAGE_AND_THREAD_POST_PACKAGE_PASS` |
| `GOVERNANCE_FREEZE_POLICY` | 使用A1回执中的最终Commit 1 SHA核对该提交初始19路径未变；只读复验，差异即阻塞。 |
| `BLOCKER_CHECK_POLICY` | 提交前读取 `docs/reviews/BLOCKERS.md`，仅单一 `NO_BLOCKERS` 可进入；结果写终端最终回执，不得修改tracked交付物。 |
| `GOAL` | 读取A6 pre-package与 `THREAD_POST_PACKAGE` 证据，零tracked修改地显式暂存批准产物、创建Commit 4、执行最终门禁并停止。 |
| `SUCCESS_CRITERIA` | A6最终化文件与 `THREAD_POST_PACKAGE` 证据一致且未变；仅显式暂存FILE_INVENTORY确认路径；cached门禁通过；Commit 4固定消息正确；提交后clean/log/remote/合同哈希/ZIP哈希复验通过；终端记录Commit 4 SHA并复述post-package证据，未启动后续阶段。 |
| `AUTHORIZED_READ_PATHS` | 源合同、六项必读治理/计划/阻塞文件、`docs/reviews/PHASE_1A_BATCH_A_REVIEW.md`、`docs/reviews/FILE_INVENTORY.md`、当前线程 `THREAD_POST_PACKAGE` 外部回执、A4—A6全部批准产物及Git元数据。 |
| `AUTHORIZED_WRITE_PATHS` | `NONE_GIT_METADATA_ONLY`；正常路径只允许显式暂存和创建计划内Commit 4所需的Git元数据变化，不得修改任何tracked交付物。 |
| `CONDITIONAL_BLOCKER_WRITE` | 发现实质阻塞时，仅可修改 `docs/reviews/BLOCKERS.md`，记录证据与最小解除条件并立即停止，不得创建Commit 4；正常路径不得修改该文件。 |
| `FORBIDDEN_ACTIONS` | 修改任何tracked交付物、未列路径暂存、`git add .`、`git add -A`、额外提交、依赖、真实数据、正式AI/支付/密钥、远程/推送/部署、后续阶段、伪造PASS。 |
| `VALIDATION_COMMANDS` | 提交前：读取并复验 `THREAD_POST_PACKAGE`，运行 `rtk git status --ignored --short`、显式 `rtk git add -- <FILE_INVENTORY精确路径>`、`rtk git diff --cached --check`、cached白名单/哈希复验；提交后：`rtk git status --short --branch`、`rtk git log -1`、`rtk git remote -v`、合同SHA-256与最终ZIP SHA-256复验。 |
| `GIT_DISPOSITION` | `CREATED`：Commit 4 `feat: add phase 1a low fidelity review prototype` |
| `RECEIPT_STORAGE` | `TERMINAL_FINAL` |

- **进入**：仅在A6仓库评审pre-package证据与 `THREAD_POST_PACKAGE` 的中央目录、CRC/可读性、成员SHA和两类清单验证均 `PASS`，全部tracked交付物已最终化且阻塞状态为单一 `NO_BLOCKERS` 时激活。
- **动作**：读取并复验 `THREAD_POST_PACKAGE`，不修改任何tracked交付物。先运行 `rtk git status --ignored --short` 仅审计路径；按 `FILE_INVENTORY.md` 精确路径显式暂存并完成cached白名单、空白、内容和哈希验证；创建 Commit 4 `feat: add phase 1a low fidelity review prototype`；提交后复验clean、log、remote、合同SHA-256和最终ZIP SHA-256，在仓库外终端回执记录Commit 4 SHA并复述ZIP SHA、root manifest SHA、运行时白名单SHA、实际成员数及中央目录验证结论。
- **最终门禁**：合同12项、四提交、文件/内容/链接/浏览器或静态结果、两类校验清单、ZIP、干净工作区、忽略路径无 `.env.example` 且批准的 `artifacts/` 证据未被隐藏、无远程/推送/部署/真实数据/正式AI/支付/生产密钥/依赖安装、未启动后续阶段。
- **结论**：`PASS` 仅为内部证据门禁通过、待项目负责人验收。
**停止**：输出规定回执后立即停止。

## 4. Commit 1显式暂存清单

仅允许暂存：

```text
.gitignore
AGENTS.md
README.md
PLANS.md
PHASE_1A_BATCH_A_CODEX_EXECUTION.md
docs/project/PROJECT_CHARTER.md
docs/project/DECISION_BASELINE.md
docs/project/TERMINOLOGY.md
docs/project/SCOPE_AND_NON_SCOPE.md
docs/project/CHANGE_CONTROL.md
docs/project/RESPONSIBILITY_MATRIX.md
docs/agents/PRODUCT_MANAGER.md
docs/agents/TECH_LEAD.md
docs/agents/UI_UX_AGENT.md
docs/agents/QA_SECURITY_AGENT.md
docs/templates/TASK_CONTRACT.md
docs/templates/REVIEW_RECEIPT.md
docs/plans/PHASE_1A_BATCH_A_EXEC_PLAN.md
docs/reviews/BLOCKERS.md
```

禁止 `git add .` 和 `git add -A`。

## 5. 强制停止矩阵

| 事件 | 立即动作 | 最小解除条件 |
|---|---|---|
| 合同缺失或SHA不符 | 停止全部写入 | 恢复指定字节合同并重新核验 |
| 未授权文件/无关工程/额外提交 | 保留现场、停止 | 项目负责人确认归属和处理方案 |
| 权威来源实质冲突 | 记录双方原文与影响 | 项目负责人明确裁决 |
| 真实数据或生产密钥 | 不读取、不回显、不提交 | 安全处置并由项目负责人确认 |
| 跨租户或未成年人风险 | 门禁失败 | 在当前白名单内修复并复验，或取得新合同 |
| 需要依赖、外部API、支付、正式AI、远程或部署 | 拒绝执行 | 另立后续阶段且明确授权；本批次仍停止 |
| 验证失败 | 不提交、不报PASS | 修复后完整重跑并保留新证据 |
| 要求批次B或Phase 1B | 停止 | 项目负责人完成批次A验收并单独授权 |

## 6. 完成证据格式

每项回执必须列出：状态、合同 SHA、项目根与分支、实际文件清单、逐条验证命令和结果、失败/未知项、显式暂存路径、提交 SHA、远程/推送/部署/真实数据/正式AI/支付/密钥声明、阻塞状态、`PASS`语义和停止声明。无证据不得声称完成。
