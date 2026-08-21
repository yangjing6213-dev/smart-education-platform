# 任务合同模板

> 使用方法：把本模板字段填写到 `docs/plans/PHASE_1A_BATCH_A_EXEC_PLAN.md` 对应 A0—A7 章节，形成内嵌任务合同实例；不得另建实例文件。固定 `TASK_ID` 不得复用或改名。所有“必填”字段填写且合同获批后，仍须满足 `ACTIVATION_POLICY` 与 `PREVIOUS_STAGE_EVIDENCE` 才能执行。

## 1. 合同标识

- `TASK_ID`：`<必填：固定唯一编号>`
- `TASK_NAME`：`<必填：单一可验证目标>`
- `STAGE`：`<必填：A0—A7之一>`
- `CONTRACT_VERSION`：`<必填：A0=NOT_APPLICABLE_BOOTSTRAP；A1=CREATED_BY_COMMIT_1；A2—A7=版本与日期>`
- `EXECUTOR_ROLE`：`<必填：角色或智能体>`
- `AUTHORIZATION_EVIDENCE_ID`：`<必填：稳定外部证据 ID；禁止只写“当前指令”>`
- `AUTHORIZATION_THREAD_ID`：`<必填：外部线程或审批对象稳定ID>`
- `AUTHORIZATION_OBJECTIVE_UTF8_BYTES`：`<必填：完整目标UTF-8字节数>`
- `AUTHORIZATION_OBJECTIVE_SHA256`：`<必填：完整目标SHA-256>`
- `AUTHORIZATION_RECORD_SHA256`：`<必填：A0=NOT_APPLICABLE_BOOTSTRAP；A1=CREATED_BY_COMMIT_1；A2—A7=内部规范化摘要SHA-256；不得冒充完整目标哈希>`
- `APPROVED_AT`：`<必填：已知批准日期与时区；未知精确时间不得编造>`
- `APPROVAL_SUMMARY`：`<必填：批准范围、禁止范围与裁决摘要>`
- `CONTRACT_APPROVAL_STATUS`：`<APPROVED|NOT_APPROVED>`
- `ACTIVATION_POLICY`：`<必填：本阶段何时激活；批准不等于激活>`
- `PREVIOUS_STAGE_EVIDENCE`：`<必填：启动前必须取得的前阶段回执、提交和复审证据类型；无则写NONE>`

内嵌实例的 A0—A7 章节标题同时给出 `TASK_NAME` 和 `STAGE`；标题必须与 `TASK_ID` 唯一对应，不得以省略表格行为由留下歧义。
本批次的 `APPROVED_AT` 由执行计划第1节“批准日期”全局值统一满足，`APPROVAL_SUMMARY` 由同节的授权来源、允许阶段和本决策基线的批准范围统一满足；A0—A7 实例不重复这两行，不得改用其他值。

完整 objective SHA-256 在A0—A7均必填，并与外部线程ID共同证明外部目标完整性。A0时内部摘要不存在；A1创建合同与摘要，故两阶段使用上述自举状态值。A2—A7才填写实际 `AUTHORIZATION_RECORD_SHA256`；该哈希只方便阅读和映射，不能替代完整目标哈希。指定SHA合同与已批准决策基线共同构成本批次权威。

## 2. 权威输入

- 源合同：`PHASE_1A_BATCH_A_CODEX_EXECUTION.md`
- 合同 SHA-256：`892521A36DF3A3A1E76C3923E00705E6F9405515020701279F2AB328F00436AC`
- `DECISION_BASELINE_VERSION`：`<必填：A0=NOT_APPLICABLE_BOOTSTRAP；A1=CREATED_BY_COMMIT_1；A2—A7=COMMIT_1_SHA_FROM_STAGE_RECEIPT>`
- `PRECONDITION_REF`：`<必填：执行前已知的证据来源或引用；不得预填未来实际SHA>`
- `BLOCKER_CHECK_POLICY`：`<必填：A0写NOT_APPLICABLE_BOOTSTRAP；A1写激活后首次创建规则；A2—A7写启动前已存在且单一NO_BLOCKERS的检查时间和证据位置>`
- `GOVERNANCE_FREEZE_POLICY`：`<必填：A0写NOT_APPLICABLE；A1说明初始治理树由提交后回执传入的最终Commit 1 SHA冻结；A2—A7启动时验证初始治理文件相对该提交未变>`

### A0—A1自举例外

- A0合法初始态：项目根只有指定SHA源合同，`.git` 和 `docs/reviews/BLOCKERS.md` 均不存在。A0只读检查，不要求、不读取、不创建阻塞文件；失败只记线程回执并停止。
- A1激活只依赖A0线程回执 `PASS` 与未变的初始目录，不依赖尚未存在的仓库治理文件。A1激活后初始化Git、创建治理树，并首次创建 `docs/reviews/BLOCKERS.md`；无实质阻塞时写入唯一 `NO_BLOCKERS`。
- 从A2起，任务启动前必须确认阻塞文件已存在且仅含单一 `NO_BLOCKERS`。当前该状态是A1创建后的真实状态，不是A0或A1的激活前提。
- A2—A7使用的实际Commit 1 SHA由A1阶段回执传入，并在A6最终评审报告固化；Commit 1内不得自引用未来哈希。

## 3. 目标与成功标准

### 目标

`<必填：一句话说明交付结果，不写实现愿望>`

### 可验证成功标准

1. `<必填：文件或行为验收点>`
2. `<必填：安全/范围验收点>`
3. `<必填：证据验收点>`

## 4. 授权边界

### 允许读取

- `<必填：路径或资料>`

### 允许创建或修改

- `<必填：逐个列出精确相对路径，禁止目录通配授权>`

### 条件阻塞写权限

- A0：`NONE_READ_ONLY`，只在线程回执报告失败并停止；
- A1：正常路径只可在初始治理树中一次性创建 `docs/reviews/BLOCKERS.md` 并写入单一 `NO_BLOCKERS`，此后正常路径不得修改；
- A1—A7：发现实质阻塞时仅可创建或修改 `docs/reviews/BLOCKERS.md`，记录证据与最小解除条件并立即停止；A2—A7 正常路径一律不得修改该文件。

### 明确禁止

- 任何未列出的文件；
- 批次B、Phase 1B 和正式业务代码；
- A0—A7 的任何依赖安装、真实数据、正式 AI、支付、生产密钥、远程、推送和部署；
- `git add .`、`git add -A`、强制覆盖与破坏性清理；
- `<必填：本任务额外禁止项；无则写“无额外项”>`

## 5. 实施步骤

1. `<必填：步骤及其进入条件>`
2. `<必填：步骤及其验证点>`
3. `<必填：形成证据并停止>`

不得加入“顺便优化”、未来扩展、未批准抽象或额外文件。

### 依赖规则

- 当前实例固定为 `DEPENDENCY_INSTALL=NO`；浏览器验证失败时使用静态链接与内容检查。
- 未来安装最小验证依赖前，项目负责人必须在新任务合同中逐项批准包名、版本、必要性、影响和回退，并先形成新版权威执行合同、新 SHA、原子更新全部引用且重新批准。

## 6. 验证计划

| 验收点 | 计划命令或检查方法 | 预期结果 | 计划证据位置 |
|---|---|---|---|
| `<必填>` | `<必填>` | `<必填>` | `<必填>` |

验证必须按仓库状态条件枚举：

- `BOOTSTRAP_NO_REPOSITORY`：仅适用A0及A1初始化前；Git分支、tree、status、cached diff、remote和阻塞文件字段填 `NOT_APPLICABLE_BOOTSTRAP`，不运行Git仓库命令；仍必须用实际命令核对根目录、合同SHA及 `.git`/`BLOCKERS.md` 不存在。
- `EXISTING_REPOSITORY`：仓库一旦存在（包括A1执行 `git init` 后），必须计划文件白名单、UTF-8无BOM、非空、内容门禁、`rtk git diff --check`、`rtk git diff --cached --check`、合同SHA、Git状态和remote检查。

涉及原型时增加链接与浏览器/静态验证；涉及审查包时，必须计划使用Python标准库 `zipfile.ZipFile.infolist()` 直接审计中央目录与逐成员流式SHA，禁止 `Expand-Archive`、文件系统解包和临时解包目录。

A6 必须逐个列出ZIP成员。成员名单转为POSIX相对路径并按路径字符串序数升序；SHA-256输入固定为UTF-8无BOM、一行一项、仅LF分隔且恰好一个末尾LF。主线程必须取得项目负责人对实际48或54成员数、名单SHA与goal SHA的重新确认。`ZIP_MEMBER_CONFIRMATION_EVIDENCE` 记录用户确认消息/turn ID；无ID时保存精确确认原文、原文UTF-8字节数与SHA-256，禁止Unicode、空白或换行规范化，并记录确认时间。未确认不得生成ZIP。

## 7. Git合同

- `GIT_DISPOSITION`：`<必填：NONE_READ_ONLY | DEFERRED_TO_COMMIT_4 | CREATED>`
- `TARGET_COMMIT`：`<CREATED时必填：计划内提交编号与固定消息；其他状态写对应处置>`
- `AUTHORIZED_STAGING_PATHS`：`<必填：执行前批准的精确路径白名单；A7引用FILE_INVENTORY，禁止通配符>`
- `PLANNED_PRE_COMMIT_CHECKS`：`<必填：计划命令>`
- `REMOTE_AND_PUSH`：`FORBIDDEN`

固定映射：A0=`NONE_READ_ONLY`；A4—A6=`DEFERRED_TO_COMMIT_4`；A1—A3和A7=`CREATED`。延迟提交不等于无证据，也不授权提前创建 Commit 4。
本批次紧凑实例的字段映射如下，具有与单独表格行相同的约束力：

- `TARGET_COMMIT` 由各实例 `GIT_DISPOSITION` 满足：A0无提交；A1—A3和A7的该行必须含提交编号与固定消息；A4—A6的 `DEFERRED_TO_COMMIT_4` 唯一指向A7固定Commit 4。
- `AUTHORIZED_STAGING_PATHS` 由实例现有白名单满足：A0为无；A1使用执行计划第4节的19路径；A2—A3仅使用各自 `AUTHORIZED_WRITE_PATHS` 中实际变更路径；A4—A6不立即暂存；A7仅使用已验证 `FILE_INVENTORY.md` 的逐项精确路径。
- `PLANNED_PRE_COMMIT_CHECKS` 由各实例 `VALIDATION_COMMANDS` 及其“验证”段满足；暂无提交的A0/A4—A6记录对应无提交或延迟处置，A7必须包含cached白名单、空白和哈希验证。

实际前置/结束 SHA、实际时间、实际命令与结果、产物 SHA-256、实际 changed/staged paths、提交 SHA 和工作区状态不属于执行前合同，必须移入执行后的 `REVIEW_RECEIPT`。

## 8. 停止条件

合同哈希不符、来源冲突、范围外文件、真实数据/密钥、跨租户或未成年人风险、AI越界、需安装依赖/外部服务、验证失败无法在白名单内修复、或要求进入下一阶段时，保留有效成果、记录事实与最小解除条件并停止。

## 9. 回执要求

- `RECEIPT_STORAGE=<THREAD_UNTIL_A6|REPOSITORY_REVIEW|THREAD_POST_PACKAGE|TERMINAL_FINAL>`，必须按实例填写。
- A0—A5 使用 `THREAD_UNTIL_A6`：阶段结束时先在当前 Codex 线程保存仓库外运行证据，不得要求提前写入尚不存在的最终评审报告。
- A6打包前使用 `REPOSITORY_REVIEW`：最终冻结 `docs/reviews/PHASE_1A_BATCH_A_REVIEW.md`、`docs/reviews/FILE_INVENTORY.md` 和载荷校验清单。评审报告只记A0—A5与A6 pre-package证据、Commit 1—3、浏览器证据和“post-package结果仅进入外部回执/最终终端”声明。
- A6打包后使用 `THREAD_POST_PACKAGE`：ZIP生成并验证后，唯一允许的post-ZIP tracked写是一次性覆盖根 `SHA256SUMS.txt` 为含ZIP哈希的最终manifest；随后计算root manifest SHA并生成线程回执，自此零tracked写。报告、FILE_INVENTORY与ZIP内payload manifest永不回写。回执记录ZIP SHA、root manifest SHA、名单SHA、确认稳定证据、central-directory/CRC/流式SHA结果、实际成员数、命令和时间。
- A7 使用 `TERMINAL_FINAL`：读取A6 `THREAD_POST_PACKAGE` 回执，不得修改任何tracked交付物；只执行忽略路径审计、显式暂存、cached验证、Commit 4、提交后复验，并在仓库外最终终端回执复述post-package证据。

回执附实际文件清单、验证命令与结果、合同 SHA、产物哈希、Git tree/提交 SHA、风险和停止声明。`PASS` 必须写明“内部证据门禁通过，待项目负责人验收”。
