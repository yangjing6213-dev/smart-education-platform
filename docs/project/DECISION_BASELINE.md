# 决策基线

## 当前 Phase 1B 活动治理

当前 Phase 1B Task 01—07 与 Task 08 Stage B 的活动治理以
`docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V13.md`
为准（SHA-256：`E0CE8BD3AD0566C59563A5FA8E376B43BB64A6B82F09883C707EAF079BCCC98B`）。
authority 使用全文件、无自引用 SHA 约定；Task 01—06 已完成并冻结，Task 06 C2 仅为 acceptance-record-only 验收记录。

```text
PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_08_STAGE_B_ONLY
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03|TASK_04|TASK_05|TASK_06
TASK_04_STARTED=YES
TASK_04_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_05_STARTED=YES
TASK_05_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_05_STAGE_C1_STATUS=FINAL_EVIDENCE_READY
TASK_05_STAGE_C2_STATUS=ACCEPTED
TASK_05_OWNER_REVIEW=ACCEPTED_AND_FROZEN
TASK_06_STARTED=YES_STAGE_B_IMPLEMENTATION
TASK_06_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_06_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_06_STAGE_C1_STATUS=FINAL_EVIDENCE_READY_AND_OWNER_REVIEW_PASSED
TASK_06_OWNER_REVIEW=ACCEPTED
TASK_06_STAGE_C2_STATUS=ACCEPTED
TASK_06_STAGE_C2_AUTHORIZATION=GRANTED
TASK_06_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md
TASK_06_ACCEPTANCE_SHA256=0B690B77CF4C08653FAE3495ABB9B218C640E8C4F02121CC14DEE0557850F68C
TASK_07_STARTED=YES_STAGE_C2_ACCEPTANCE
TASK_07_STAGE_A_AUTHORIZATION=GRANTED
TASK_07_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_07_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_07_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_07_STAGE_C1_STATUS=FINAL_EVIDENCE_READY
TASK_07_STAGE_C1_AUTHORIZATION=GRANTED
TASK_07_STAGE_C2_STATUS=ACCEPTANCE_RECORD_AUTHORIZED
TASK_07_STAGE_C2_AUTHORIZATION=GRANTED
TASK_07_PLUS_STARTED=NO
TASK_07_PLUS_AUTHORIZATION=NOT_GRANTED
TASK_08_STARTED=YES_STAGE_B_REPAIR_AND_CONTINUATION
TASK_08_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_08_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_08_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_08_PLUS_STARTED=NO
TASK_08_PLUS_AUTHORIZATION=NOT_GRANTED
PHASE_1B_API_FRAMEWORK=FASTIFY_5.12.1
NESTJS_REFERENCE_POLICY=HISTORICAL_DRAFT_ONLY
PHASE_1B_NODE_VERSION=24.14.0
PHASE_1B_PNPM_VERSION=11.22.0
T12_DEPENDENCIES=T02 -> T03 -> T05
T10_DEPENDENCIES=T05 -> T08 -> T12
```

本文件下方原有 Phase 1A 决策记录整体保持 `HISTORICAL/FROZEN`，不与上述当前活动治理竞争，也不因当前 authority 回写。Batch B 冻结证据中的 `PROJECT_OWNER_ACCEPTANCE=PENDING` 是负责人验收前的历史快照；当前 authority 记录后续 `BATCH_B_PROJECT_OWNER_ACCEPTANCE=PASS` 裁决。

本次按 `CHANGE_CONTROL.md` §5 采用 `HISTORICAL_FREEZE_PLUS_ACTIVE_REFERENCE_CLOSURE`：原子范围精确为 V9 authority、全部活动治理引用文件和 Task 07 Stage B repair/implementation 合同与验证边界。V8 及更早 authority、Task 06 C2 acceptance、Task 01—06 合同与冻结证据均保持原样；Task 06 C1 review、manifest、ZIP 保持为 C1 历史冻结快照，不在本轮重生成范围内。

## 1. 冻结标识

- 项目根路径：`C:\Users\HU\Documents\student-care-saas-platform`
- 当前分支：`planning/phase-1a-batch-a`
- 当前阶段：Phase 1A 批次A
- 权威合同：`PHASE_1A_BATCH_A_CODEX_EXECUTION.md`
- 合同 SHA-256：`892521A36DF3A3A1E76C3923E00705E6F9405515020701279F2AB328F00436AC`
- 批准主体：项目负责人
- 批准范围：当前目标中的 A0—A7 计划与下列八项裁决
- `AUTHORIZATION_EVIDENCE_ID`：`CODEX_ACTIVE_GOAL_2026-08-21_PHASE_1A_BATCH_A`
- `AUTHORIZATION_EVIDENCE_SOURCE`：当前 Codex 线程 active goal
- `AUTHORIZATION_THREAD_ID`：`01a02398-b83a-7382-a314-353da24ee898`
- `AUTHORIZATION_GOAL_STATUS_AT_VERIFICATION`：`active`
- `AUTHORIZATION_OBJECTIVE_UTF8_BYTES`：`2895`
- `AUTHORIZATION_OBJECTIVE_SHA256`：`9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089`
- 外部证据核验来源：主线程于 2026-08-21 fresh `get_goal`；子线程 `get_goal` 不提供该目标，不能独立复现此查询
- 批准日期：2026-08-21（Asia/Shanghai）
- 授权范围：A0—A7 固定计划、八项冻结裁决、A1质量审查修复、单提交 amend、禁止远程与推送
- 授权摘要：在冻结合同范围内建立完整批次A交付与证据门禁；不授权批次B、Phase 1B、正式开发、依赖安装、真实数据、正式AI、支付或部署
- 内部固化：Commit 1 将本文件与执行计划写入 Git tree；提交 SHA 由提交后的外部终端回执记录，Git 提交只固化内部记录，不替代外部授权来源

合同文件必须保持字节不变。哈希不匹配时停止，不得把修改后的文件当作合同继续执行。

## 2. 完整外部授权证据、内部摘要与权威来源

### 2.1 完整外部授权证据

主线程 fresh `get_goal` 已核验：线程 ID 为 `01a02398-b83a-7382-a314-353da24ee898`，状态快照为 `active`，完整 objective 按 UTF-8 编码后为 2895 字节，SHA-256 为 `9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089`。该完整 objective 哈希与线程 ID 共同证明项目负责人对本批次目标的批准；状态只表示核验时快照，不保证未来不变。Git 不保存平台线程原文，后续核验仍需访问外部线程并复算完整 objective 哈希。

### 2.2 内部规范化摘要

以下记录是便于阅读和逐项映射的内部规范化摘要，不是完整 goal。摘要哈希对象为两个标记行之间的全部 UTF-8 字节，不含标记行，行尾统一为 LF，并包含内容末尾的一个 LF；哈希行位于摘要块之外。摘要 SHA-256 `DBD4068CCEC13CD2E1EDA2E25C511612BB087D45E184EB3363CDAEBB8C958C6E` 只能证明此摘要未变，不能替代完整 objective SHA-256，也不能单独证明外部批准。

<!-- AUTHORIZATION_RECORD_BEGIN -->

AUTHORIZATION_RECORD_VERSION=1
AUTHORIZATION_EVIDENCE_ID=CODEX_ACTIVE_GOAL_2026-08-21_PHASE_1A_BATCH_A
AUTHORIZATION_SOURCE=当前 Codex 线程 active goal
APPROVED_DATE=2026-08-21（Asia/Shanghai）
APPROVED_BY=项目负责人
PROJECT_ROOT=C:\Users\HU\Documents\student-care-saas-platform
CONTRACT_FILE=PHASE_1A_BATCH_A_CODEX_EXECUTION.md
CONTRACT_SHA256=892521A36DF3A3A1E76C3923E00705E6F9405515020701279F2AB328F00436AC
AUTHORIZED_PHASE=Phase 1A 批次A
PLAN_A0=A0执行前硬门禁
PLAN_A1=A1 Git与项目治理基线
PLAN_A2=A2产品规格基线
PLAN_A3=A3架构、数据、权限与AI安全草案
PLAN_A4=A4三端低保真可点击原型
PLAN_A5=A5自动验证与原型验证
PLAN_A6=A6审查证据与压缩包
PLAN_A7=A7 Commit 4、最终门禁与停止
DECISION_01=指定SHA合同与本已批准决策基线共同构成批次A权威；缺失的两份报告或其他旧资料不阻塞，且不得想象、恢复或扩展其内容；后续直接指令仅在形成稳定可校验记录且不冲突时补充；无法由权威内容确定或出现实质冲突时必须停止请示
DECISION_02=V0.1信息架构只允许以下映射：企业文化并入机构介绍，用户网页端家校共育、校区联系、预约并入访客首页或机构介绍，用户网页端资源搜索并入教学资源，排序作为机构管理后台相关列表操作；产品矩阵、页面清单、原型路由和验收标准必须保留原内容的可追踪映射与独立验收点，所有锁定内容、字段、流程和验收点不得删减、削弱或遗漏，不得以已并入代替交付
DECISION_03=B级12项必须全部具备可操作状态转换，不得只有静态说明页；家长与学生绑定、教师任务到教师工作日报、同芯AI学习助手三条流程必须端到端可点击，并返回明确终态或后续动作，形成完整闭环
DECISION_04=AI概念原型必须实现第0、1、2、3层及巩固层：第0层确认已知条件、目标与学生尝试，第1层提示知识点或方向，第2层拆解关键步骤，第3层仅在必要时讲解完整过程，巩固层生成1至3道同类题验证理解；学生必须先尝试，不得从输入直接跳到答案
DECISION_05=ZIP内SHA256SUMS.txt只校验除自身外的ZIP载荷且不含ZIP自身；ZIP生成并验证后，唯一允许的post-ZIP tracked写是一次性覆盖项目根目录同名清单为包含本轮核心文件与ZIP哈希的最终manifest；随后计算root manifest SHA并生成THREAD_POST_PACKAGE，自此零tracked写；评审报告、FILE_INVENTORY和ZIP内payload manifest永不回写；最终回执必须说明两份清单的对象与职责
DECISION_06=docs/reviews/PHASE_1A_BATCH_A_REVIEW.md必须列出Commit 1、Commit 2、Commit 3，并说明Commit 4会固化评审报告自身、无法在该提交所含报告中预写自身最终哈希；Commit 4哈希只在提交后的终端最终回执记录
DECISION_07=PASS只表示内部证据门禁通过且待项目负责人验收；不表示负责人已经验收，不代表生产可用，也不授权批次B、Phase 1B、发布、推送或部署
DECISION_08=审查包只能使用A6内嵌任务实例的文件级完整显式白名单；在合同最低目录基础上加入源合同、根治理文件、docs/agents、docs/templates、docs/plans和验证脚本，不含任何批次B材料；目录名只作分类且不构成递归授权；成员名单SHA输入固定为排序后的POSIX相对路径、UTF-8无BOM、一行一项、LF且恰好一个末尾LF；A6必须先确定精确48或54成员数与名单SHA，再由主线程取得项目负责人重新确认；稳定证据记录用户确认消息或turn ID，无ID时保存精确确认原文、原文UTF-8字节数与SHA-256，禁止Unicode、空白或换行规范化，并记录确认时间、成员数、名单SHA与goal SHA；未确认即BLOCKED且不得生成ZIP；ZIP生成后禁止解包，直接审计central directory并逐成员流式验证CRC、可读性和SHA-256；不得包含.git、依赖、缓存、密钥或无关文件
DELIVERABLE_01=项目治理与仓库基线
DELIVERABLE_02=产品总PRD和V0.1专项PRD
DELIVERABLE_03=用户角色与三端功能矩阵
DELIVERABLE_04=完整页面清单
DELIVERABLE_05=核心用户流程
DELIVERABLE_06=内容字段和状态定义
DELIVERABLE_07=低保真可点击跨端原型
DELIVERABLE_08=多租户、统一账号、权限和数据模型草案
DELIVERABLE_09=API边界、文件、环境和部署草案
DELIVERABLE_10=同芯AI学习助手产品与安全草案
DELIVERABLE_11=验收标准和验证脚本
DELIVERABLE_12=Phase 1A批次A审查包
PROHIBITION_01=不得启动Phase 1A批次B、Phase 1B或其他阶段；各阶段验证、形成证据并停止待验收
PROHIBITION_02=不得开发正式微信小程序、Next.js用户端、机构管理后台、NestJS业务API、正式业务代码、数据库迁移或应用脚手架
PROHIBITION_03=不得接入真实登录、短信、微信授权、微信支付、伙伴云API、其他外部业务API、正式AI或生产数据库
PROHIBITION_04=不得使用、导入或复制真实学生、家长、教师及其他个人敏感数据；只用明显虚构且不可回溯真人并标注为模拟数据的内容
PROHIBITION_05=不得读取、生成、填入、提交或回显生产密钥
PROHIBITION_06=不得配置Git远程、推送、创建PR、发布、上传腾讯云或部署测试及生产环境
PROHIBITION_07=A0至A7一律不得安装依赖；浏览器不可用或失败时仅作静态链接与内容检查
PROHIBITION_08=不得修改指定SHA合同、项目根目录外文件或其他项目，不得强制覆盖、破坏性清理、删除或覆盖归属不明文件
PROHIBITION_09=不得使用git add .或git add -A；只能显式暂存已批准路径
PROHIBITION_10=不得伪造截图、PASS、生产部署成功或其他无证据完成声明
PROHIBITION_11=不得在ZIP中包含.git、依赖、缓存、密钥、无关文件、目录递归扩张或任何批次B材料
PROHIBITION_12=AI不得开放万能聊天、代写、作弊、情感陪伴、虚拟好友、心理诊断、情绪识别、自动能力标签或自动纪律、处罚、绩效结论；未经教师或家长确认不得发送敏感结论
PROHIBITION_13=不得信任前端tenant_id或允许未经单独批准、最小权限和审计的跨租户访问
<!-- AUTHORIZATION_RECORD_END -->

`AUTHORIZATION_RECORD_SHA256=DBD4068CCEC13CD2E1EDA2E25C511612BB087D45E184EB3363CDAEBB8C958C6E`

块内 `DECISION_08` 与本文件裁决8一致：禁止解包，只审计central directory并流式读取成员。整个初始治理树由最终 Commit 1 SHA 冻结，摘要哈希只用于阅读校验。

指定 SHA 的合同与本已批准决策基线共同构成本批次权威。后续直接指令只有在稳定记录、可校验且不与二者冲突时才可作为补充；聊天文字、口头描述和未导入报告不能删减、削弱、替换或想象扩张权威内容。缺失旧报告不构成阻塞，也不得凭名称臆造其内容。任何改变范围、阶段、交付或与权威内容冲突的要求，必须建立新版权威执行合同、新 SHA、原子更新全部引用并由项目负责人重新批准；否则执行者必须停止，不得自行选边。

## 3. 已批准 A0—A7

1. A0：执行前硬门禁；
2. A1：Git与项目治理基线；
3. A2：产品规格基线；
4. A3：架构、数据、权限与AI安全草案；
5. A4：三端低保真可点击原型；
6. A5：自动验证与原型验证；
7. A6：审查证据与压缩包；
8. A7：Commit 4、最终门禁与停止。

顺序、交付、验证和停止条件见 `docs/plans/PHASE_1A_BATCH_A_EXEC_PLAN.md`。A0—A7 的固定 `TASK_ID` 任务合同实例嵌入该文件对应章节，不另建实例文件。批准计划不等于授权跳过实例门禁或自动进入下一项。

## 4. 八项冻结裁决

### 裁决1：权威源与缺失资料

指定 SHA 的合同与已批准决策基线共同构成批次A权威。缺失的两份报告或其他旧资料不阻塞当前执行，但不得想象、恢复或扩展其内容。后续直接指令仅在已形成稳定记录且不冲突时补充；无法由权威内容确定的事项必须停止请示。

### 裁决2：V0.1 信息架构合并映射

允许且只允许以下合并，不得因此删弱漏任何锁定内容字段、流程或验收点：

- “企业文化”并入“机构介绍”；
- 用户网页端“家校共育”“校区联系”“预约”并入“访客首页”或“机构介绍”；
- 用户网页端“资源搜索”并入“教学资源”；
- “排序”作为机构管理后台相关列表的操作能力。

产品矩阵、页面清单、原型路由与验收标准必须保留被合并项目的可追踪映射和独立验收点，不能用“已并入”替代内容交付。

### 裁决3：B级12项与三条完整闭环

B级12项必须全部具备可操作状态转换；不得只有静态说明页。以下三条流程必须端到端可点击并能返回明确终态或后续动作：

1. 家长与学生绑定；
2. 教师任务到教师工作日报；
3. 同芯AI学习助手。

### 裁决4：AI提示层级

AI概念原型必须实现第0层、第1层、第2层、第3层和巩固层。第0层确认已知条件、目标与学生尝试；第1层提示知识点或方向；第2层拆解关键步骤；第3层在必要时讲解完整过程；巩固层生成1—3道同类题验证理解。不得从学生输入直接跳到答案。

### 裁决5：两份校验清单的职责

压缩包内部的 `SHA256SUMS.txt` 只校验 ZIP 载荷，不包含 ZIP 自身。ZIP 生成并验证后，唯一允许的 post-ZIP tracked 写是一次性覆盖项目根目录 `SHA256SUMS.txt`，形成列出本轮核心文件并追加 ZIP 哈希的最终 manifest；随后只读计算 root manifest SHA 并生成 `THREAD_POST_PACKAGE`，自此零 tracked 写。评审报告、`docs/reviews/FILE_INVENTORY.md` 和 ZIP 内 payload manifest 永不回写。最终回执必须说明两份清单职责，禁止混淆验证对象。

### 裁决6：提交哈希记录位置

`docs/reviews/PHASE_1A_BATCH_A_REVIEW.md` 列出 Commit 1、Commit 2、Commit 3，并说明 Commit 4 会固化评审报告自身，因此无法在该提交所含报告中预写自身最终哈希。Commit 4 哈希只在提交完成后的最终终端回执中记录。

### 裁决7：PASS语义

`PASS` 只表示内部证据门禁通过、等待项目负责人验收。它不表示负责人已验收，不代表生产可用，也不授权进入批次B、Phase 1B、发布、推送或部署。

### 裁决8：审查包显式白名单

审查包只能使用执行计划 A6 内嵌任务实例中的 `ZIP_MEMBER_WHITELIST`。白名单必须逐个列出文件成员；`docs/project/`、`docs/product/`、`docs/architecture/`、`docs/ai/`、`docs/reviews/`、`prototypes/low-fidelity/`、`artifacts/screenshots/` 等目录名仅用于分类，不构成递归授权。

A6运行时必须先将计划中48个基础成员与精确0或6截图转换为POSIX相对路径并按路径字符串序数升序；哈希输入固定为UTF-8无BOM、一行一项、仅LF分隔且恰好一个末尾LF。计算完整成员名单SHA-256后，再由主线程向项目负责人请求并取得对实际成员数与名单SHA的重新确认。`ZIP_MEMBER_CONFIRMATION_EVIDENCE` 必须稳定记录用户确认消息或turn ID；工具无ID时保存项目负责人精确确认原文、原文UTF-8字节数与SHA-256，禁止任何Unicode、空白或换行规范化；同时记录确认时间、48或54实际成员数、名单SHA-256与goal SHA `9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089`。未取得确认、成员数不是48或54、路径与计划不一致或名单哈希无法复算时必须 `BLOCKED`，不得生成ZIP。确认后只允许用Python标准库 `zipfile.ZipFile.infolist()` 直接审计中央目录，不得使用 `Expand-Archive`，不得解包或创建临时解包目录。必须验证每个 `ZipInfo.filename` 与完整白名单精确匹配，并拒绝重复名、尾斜杠目录项、绝对路径、盘符、`..`路径段；逐成员流式读取到EOF以验证CRC/可读性并计算SHA-256。任何缺失、多余、危险路径、重复、CRC、读取或哈希错误均使门禁失败。不得包含 `.git`、依赖、缓存、密钥、无关文件或任何批次B材料。

## 5. active goal补充执行控制

- 当前 A0—A7 一律不安装依赖；浏览器不可用或失败时只执行静态链接与内容检查。
- 未来最小验证依赖必须由项目负责人在新任务合同中批准包名、版本、必要性、影响和回退，并先形成新版权威执行合同、新 SHA、原子更新全部引用且重新批准。
- A0的唯一合法初始态为：项目根只有指定SHA源合同，`.git` 和 `docs/reviews/BLOCKERS.md` 均不存在。A0只读核验该状态，不要求、不读取也不创建阻塞文件；失败只记当前Codex线程并停止。
- A1只在A0线程回执 `PASS` 且目录仍与A0初始态一致时激活；A1激活前不得要求 `docs/reviews/BLOCKERS.md` 存在。A1激活后初始化Git、创建治理树，并首次创建该文件；无实质阻塞时写入唯一 `NO_BLOCKERS`。当前该状态是A1创建后的真实状态，不得反向解释为A0或A1的激活前提。
- 从A2起，每阶段启动前必须确认 `docs/reviews/BLOCKERS.md` 已存在且仅含单一 `NO_BLOCKERS`；缺失、多状态或有实质阻塞均不得激活。
- A0—A5阶段回执先保存在当前Codex线程。A6打包前最终冻结 `docs/reviews/PHASE_1A_BATCH_A_REVIEW.md`、`docs/reviews/FILE_INVENTORY.md` 和ZIP内payload manifest；生成并验证ZIP后，唯一允许的post-ZIP tracked写是一次性覆盖根 `SHA256SUMS.txt` 为含ZIP哈希的最终manifest。随后计算root manifest SHA并生成 `THREAD_POST_PACKAGE`，自此零tracked写；报告、FILE_INVENTORY和ZIP内payload manifest永不回写。
- A6打包后必须在当前Codex线程生成 `THREAD_POST_PACKAGE` 回执，记录ZIP SHA、root manifest SHA、运行时白名单SHA、central-directory/CRC/成员流式SHA结果、48/54实际成员数以及验证命令和时间。A7读取该回执，不得修改任何tracked交付物；只允许忽略路径审计、按 `FILE_INVENTORY.md` 显式暂存、cached验证、创建Commit 4和提交后复验，并在最终终端回执复述post-package证据。
- 最终 Commit 1 SHA 不可能写入其自身 tree。A1 提交后的主线程阶段回执必须传递实际 Commit 1 SHA；A2 只有收到该 SHA 与规范/质量复审 `PASS` 才能激活，A6 再把实际值固化到最终评审报告。A2—A7 正常启动时必须以该 SHA 为基线核对 Commit 1 中的治理文件未被修改；若发现差异，按实质阻塞处理。
- 合同批准不等于阶段激活。A0—A7 各实例必须分别满足 `ACTIVATION_POLICY` 与 `PREVIOUS_STAGE_EVIDENCE` 后才能执行。
- 决策基线版本字段固定映射：A0=`NOT_APPLICABLE_BOOTSTRAP`；A1=`CREATED_BY_COMMIT_1`；A2—A7=`COMMIT_1_SHA_FROM_STAGE_RECEIPT`。A2—A7使用的实际Commit 1 SHA由A1阶段回执传入，并在A6打包前最终评审报告固化。
- 自举合同字段固定映射：A0的 `CONTRACT_VERSION` 与 `AUTHORIZATION_RECORD_SHA256` 均为 `NOT_APPLICABLE_BOOTSTRAP`，但完整objective SHA-256必填；A1两字段均为 `CREATED_BY_COMMIT_1`。内部规范化摘要块由A1创建，不得被描述为A0既存输入。
- A1 正常路径只可在初始治理树中一次性创建 `docs/reviews/BLOCKERS.md` 并写入单一 `NO_BLOCKERS`；创建后 A1 余下正常路径与 A2—A7 正常路径均不得修改该文件。A1—A7 只有发现实质阻塞时，才可仅创建或修改该文件、记录证据和最小解除条件，并立即停止。
- `.env.example` 若出现，必须由忽略路径审计发现，且不得纳入批次A；`artifacts/` 下批准的验证结果、Playwright报告和日志不得被忽略规则隐藏。

## 6. 固定输入的空白检查例外

源合同第3—7行末尾各有两个空格，用于 Markdown 硬换行；这5处属于指定 SHA 合同的不可修改固定输入。项目负责人批准以下精确验证办法：

1. 对18个自有新文件运行 `git diff --cached --check -- . ':!PHASE_1A_BATCH_A_CODEX_EXECUTION.md'`，结果必须为0错误；
2. 使用 `certutil` 或等价 SHA-256 工具确认源合同仍为冻结哈希；
3. 完整 `git diff --cached --check` 的已知输出只允许是源合同第3—7行这5处 Markdown 硬换行。

不得修改源合同来消除提示，不得关闭全局空白检查，也不得把例外扩展到其他路径、行或错误类型。

## 7. 变更规则

本合同下，项目负责人明确批准后只能增加不删减解释，并同步更新受影响任务实例、验收点和证据计划。任何改变范围、阶段、交付或与源合同冲突的变更，必须按 `docs/project/CHANGE_CONTROL.md` 建立新版权威执行合同、新 SHA、原子更新全部引用并重新批准；旧合同保持冻结。不得先改次级文档或原型再补审批。
