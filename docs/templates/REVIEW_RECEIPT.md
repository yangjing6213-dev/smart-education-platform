# 评审回执模板

## 1. 任务信息

- `TASK_ID`：`<必填：与执行计划固定 ID 一致>`
- 阶段：`<必填：A0—A7>`
- 任务合同版本：`<必填：A0写NOT_APPLICABLE_BOOTSTRAP；A1写CREATED_BY_COMMIT_1；A2—A7写实际版本>`
- 实际开始时间：`<必填：含时区>`
- 实际结束时间：`<必填：含时区>`
- 执行角色：`<必填>`
- 结论：`<PASS|BLOCKED>`
- 验收状态：`待项目负责人验收`
- `CONTRACT_APPROVAL_STATUS`：`<APPROVED|NOT_APPROVED>`
- 激活证据结论：`<PASS|BLOCKED>`
- `FILE_CHANGE_STATUS`：`<NONE_READ_ONLY|READ_ONLY_CHECKED|CREATED|MODIFIED>`
- `STAGING_STATUS`：`<NONE_READ_ONLY|NOT_APPLICABLE|DEFERRED_TO_COMMIT_4|STAGED|COMMITTED>`
- `RECEIPT_STORAGE`：`<THREAD_UNTIL_A6|REPOSITORY_REVIEW|THREAD_POST_PACKAGE|TERMINAL_FINAL>`

状态映射：A0顶层固定 `FILE_CHANGE_STATUS=NONE_READ_ONLY` 且 `STAGING_STATUS=NONE_READ_ONLY`，已检查的输入路径只在文件清单逐行填 `READ_ONLY_CHECKED`；A1—A3顶层按实际填 `CREATED`/`MODIFIED` 且完成提交后填 `COMMITTED`；A4—A6顶层按实际填 `CREATED`/`MODIFIED` 且 `STAGING_STATUS=DEFERRED_TO_COMMIT_4`；A7顶层固定 `FILE_CHANGE_STATUS=NONE_READ_ONLY`，成功创建Commit 4后 `STAGING_STATUS=COMMITTED`。

## 2. 基线证据

- 项目根路径：`<必填>`
- 分支：`<必填；A0写NOT_APPLICABLE_BOOTSTRAP>`
- 源合同 SHA-256：`<必填>`
- 决策基线：`<必填：A0写NOT_APPLICABLE_BOOTSTRAP；A1写CREATED_BY_COMMIT_1；A2—A7写实际Commit 1 SHA与路径>`
- 外部批准证据 ID：`<必填>`
- `AUTHORIZATION_THREAD_ID`：`<必填>`
- `AUTHORIZATION_GOAL_STATUS_AT_VERIFICATION`：`<必填：状态快照>`
- `AUTHORIZATION_OBJECTIVE_UTF8_BYTES`：`<必填>`
- `AUTHORIZATION_OBJECTIVE_SHA256`：`<必填：完整objective SHA-256>`
- `AUTHORIZATION_RECORD_SHA256`：`<必填：A0写NOT_APPLICABLE_BOOTSTRAP；A1写CREATED_BY_COMMIT_1；A2—A7写实际内部摘要SHA-256>`
- 实际前阶段证据：`<必填：实际回执、复审结论和提交/文件哈希；无则写NONE>`
- 实际前置 SHA：`<必填：A0写NOT_APPLICABLE_BOOTSTRAP并列输入合同哈希；其他阶段记录启动时实际SHA>`
- 最终 Commit 1治理基线核对：`<A2—A7必填：实际Commit 1 SHA、比较路径、命令与结果；A0/A1写NOT_APPLICABLE>`
- 任务开始前 Git 状态：`<必填；A0写NOT_APPLICABLE_BOOTSTRAP>`
- 任务开始前 Git tree：`<必填；A0写NOT_APPLICABLE_BOOTSTRAP>`

### A0自举填写规则

A0对分支、决策基线、Git前置SHA/tree/status/cached diff/remote和 `BLOCKERS.md` 统一填 `NOT_APPLICABLE_BOOTSTRAP`；该值只表示合法初始态中对象尚不存在，不是 `UNKNOWN`。A0仍必须在验证表记录实际命令、时间和结果，证明项目根只有源合同、合同SHA匹配、`.git` 和 `docs/reviews/BLOCKERS.md` 不存在。

A1必须分开记录时序：初始化前branch/tree/status/cached/remote填 `NOT_APPLICABLE_BOOTSTRAP` 且不运行Git仓库命令；初始化后与Commit 1后填写实际branch、tree、status、cached检查与remote结果。不得用后置Git证据冒充A0或A1初始化前证据。

## 3. 交付与差异

### 已完成

- `<逐项对应任务合同成功标准>`

### 未完成或未验证

- `<如无写“无”；不得省略>`

### 文件清单

| 实际路径 | `FILE_CHANGE_STATUS` | 对应验收点 |
|---|---|---|
| `<必填>` | `<CREATED|MODIFIED|READ_ONLY_CHECKED>` | `<必填>` |

不得列出未实际生成或检查的文件。另列 `ACTUAL_CHANGED_PATHS`；无变更必须明确写 `NONE_READ_ONLY`。

## 4. 验证证据

| 实际命令或检查 | 实际时间 | 退出码/结果 | 证据摘要 |
|---|---|---:|---|
| `<必填>` | `<必填：含时区>` | `<必填>` | `<必填>` |

- 测试或验证总数：`<必填；不适用则说明原因>`
- 失败数：`<必填>`
- 截图：`<实际数量或不可用原因>`
- 产物哈希：`<逐文件 SHA-256；只读任务列输入证据哈希>`
- 实际结束 SHA/工作区：`<必填：HEAD或tree哈希与状态>`

### A6 pre-package与post-package证据分界

- `REPOSITORY_REVIEW`：打包前最终冻结评审报告、FILE_INVENTORY和ZIP内payload manifest；三者永不回写。报告只记录A0—A5、A6 pre-package、Commit 1—3及浏览器或0截图证据，并声明post-package结果进入线程与最终终端回执。
- `THREAD_POST_PACKAGE`：项目负责人确认对象必须同时含48/54实际成员数、名单SHA与goal SHA。名单SHA输入固定为排序后的POSIX相对路径、UTF-8无BOM、一行一项、LF且恰好一个末尾LF。`ZIP_MEMBER_CONFIRMATION_EVIDENCE` 记录用户确认消息/turn ID；无ID时保存精确确认原文、原文UTF-8字节数与SHA-256，禁止Unicode、空白或换行规范化，并记录确认时间。未确认不得生成ZIP。ZIP生成并验证后，仅可一次覆盖根 `SHA256SUMS.txt` 为含ZIP哈希的最终manifest；随后计算 `ROOT_MANIFEST_SHA256` 并生成本回执，自此零tracked写。回执另记ZIP SHA、名单SHA、中央目录/CRC/流式SHA、命令、时间和结果；禁止解包。

## 5. Git证据

- `ACTUAL_CHANGED_PATHS`：`<必填：逐个路径；无则写NONE_READ_ONLY>`
- `ACTUAL_STAGED_PATHS`：`<必填：逐个路径；未暂存则写对应STAGING_STATUS>`
- 暂存差异检查：`<必填；A0写NOT_APPLICABLE_BOOTSTRAP；其他阶段写实际结果>`
- 提交：`<NONE_READ_ONLY | DEFERRED_TO_COMMIT_4 | COMMITTED: SHA与固定消息>`
- 工作区状态：`<必填>`
- 远程：`<必填：A0写NOT_APPLICABLE_BOOTSTRAP；仓库存在时应为无>`
- 推送审计：`<NO|YES|UNKNOWN；附命令、时间、证据路径>`

Commit 4 的最终 SHA 只在提交后的终端回执中记录，不在会被 Commit 4 固化的评审报告中预写。

## 6. 安全与范围审计

不得预填“未执行”或同义结论。每项必须在执行后填写：

| 关键项 | 结论 | 检查命令 | 检查时间 | 证据路径 |
|---|---|---|---|---|
| 真实学生/家长/教师数据 | `<NO|YES|UNKNOWN>` | `<必填>` | `<必填：含时区>` | `<必填>` |
| 生产密钥读取、生成、写入、回显或提交 | `<NO|YES|UNKNOWN>` | `<必填>` | `<必填>` | `<必填>` |
| 正式AI模型调用 | `<NO|YES|UNKNOWN>` | `<必填>` | `<必填>` | `<必填>` |
| 微信支付或外部业务API接入 | `<NO|YES|UNKNOWN>` | `<必填>` | `<必填>` | `<必填>` |
| 新依赖安装 | `<NO|YES|UNKNOWN>` | `<必填>` | `<必填>` | `<必填>` |
| 测试或生产部署 | `<NO|YES|UNKNOWN>` | `<必填>` | `<必填>` | `<必填>` |
| Git远程配置或推送 | `<NO|YES|UNKNOWN|NOT_APPLICABLE_BOOTSTRAP（仅A0）>` | `<必填>` | `<必填>` | `<必填>` |
| Phase 1A批次B或Phase 1B启动 | `<NO|YES|UNKNOWN>` | `<必填>` | `<必填>` | `<必填>` |
| 正式业务代码创建 | `<NO|YES|UNKNOWN>` | `<必填>` | `<必填>` | `<必填>` |

任一关键项为 `YES` 或 `UNKNOWN`，本阶段结论必须为 `BLOCKED`；不得用其他门禁抵消。A0的Git远程项仅在实际命令证明 `.git` 不存在时可填 `NOT_APPLICABLE_BOOTSTRAP`。

## 7. 风险与阻塞

- 已知风险：`<必填；无则写“当前证据未发现”>`
- 未知项：`<必填；无则写“无”>`
- 阻塞状态：`<必填：A0写NOT_APPLICABLE_BOOTSTRAP；A1—A7引用 docs/reviews/BLOCKERS.md>`
- 最小解除条件：`<有阻塞时必填；无则写“不适用”>`

## 8. 结论与停止

`<若通过：本回执仅证明内部证据门禁通过，待项目负责人验收；不授权下一阶段。若未通过：列出失败门禁与证据。>`

下一建议动作：提交本回执与证据给项目负责人审查。回执形成后停止，不自动激活下一阶段。

回执存储必须服从任务实例：A0—A5先用 `THREAD_UNTIL_A6`；A6打包前用 `REPOSITORY_REVIEW` 冻结报告、FILE_INVENTORY和ZIP内payload manifest。ZIP生成并验证后仅一次覆盖根最终manifest；再生成 `THREAD_POST_PACKAGE`，此后零tracked写。A7只读该线程回执并用 `TERMINAL_FINAL` 记录Commit 4与提交后复验。
