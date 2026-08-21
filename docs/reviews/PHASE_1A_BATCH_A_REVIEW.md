# Phase 1A 批次A评审报告

## 执行摘要

- `TASK_ID=PHASE_1A_BATCH_A_A6_REVIEW_PACKAGE`
- `CONTRACT_SHA256=892521A36DF3A3A1E76C3923E00705E6F9405515020701279F2AB328F00436AC`
- `AUTHORIZATION_OBJECTIVE_SHA256=9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089`
- `AUTHORIZATION_RECORD_SHA256=DBD4068CCEC13CD2E1EDA2E25C511612BB087D45E184EB3363CDAEBB8C958C6E`
- `PROJECT_ROOT=C:\Users\HU\Documents\student-care-saas-platform`
- `BRANCH=planning/phase-1a-batch-a`
- `RECEIPT_STORAGE=REPOSITORY_REVIEW`
- `GIT_DISPOSITION=DEFERRED_TO_COMMIT_4`
- 当前结论：A0—A5内部证据门禁通过；A6处于打包前冻结状态，仍待项目负责人确认54成员对象。所有 `PASS` 仅表示内部证据门禁通过、待项目负责人验收，不代表负责人已验收。

## A0 只读审计

- 项目根、源合同、合同SHA、目录、Git初始条件、范围与强制停止条件均按A0合同核验。
- 源合同路径为 `PHASE_1A_BATCH_A_CODEX_EXECUTION.md`，SHA-256与锁定值一致。
- A0未要求读取尚不存在的治理文件，未初始化Git、未写文件。

## A1 治理自举

- 按批准自举合同初始化本地Git、建立治理/职责/模板/计划/阻塞基线并创建Commit 1。
- `docs/reviews/BLOCKERS.md` 当前仍为单一 `NO_BLOCKERS`；A6复核时间：`2026-08-22T01:23:46.4823423+08:00`。
- 治理文件相对Commit 1冻结核验通过；自动验证器的 `contract and frozen governance` 检查通过。

## A2 产品规格

- 已完成平台与V0.1 PRD、角色矩阵、三端功能矩阵、69页库存、用户流程、内容模型、状态模型与验收标准。
- 产品原型当前覆盖47个A级页面和12个可操作B级流程；10个C级页面只保留未来结构，不进入原型或开发。
- 公开术语统一为“访客/访客状态/访客端/访客首页”。

## A3 架构与同芯AI安全草案

- 已完成系统架构、模块边界、多租户、身份授权、数据模型、API边界、文件存储、环境部署、安全隐私草案。
- 已完成同芯AI学习助手产品规格、固定学习流程、安全基线和评估草案。
- 锁定边界为小学作业引导与错题巩固；不包含开放聊天、代写、情感陪伴、心理诊断、自动标签、正式模型调用或敏感结论自动发送。

## A4 低保真原型

- 离线、无依赖、单入口低保真原型包含47个A级页面和12个可操作B级流程。
- 三条完整闭环：家长绑定；教师任务—班级情况—教师日报；家长监督—同芯AI学习—教师摘要。
- 专用B级动作统一校验当前页面、精确模拟角色/范围与合法来源状态；非法委托动作、跨页写入和跳步均拒绝。
- 原型文件当前SHA-256：
  - `prototypes/low-fidelity/index.html`：`F5F851F184F14AE164B55BF75335103B8ACCA8A69F35B854BC01D60655C37ECD`
  - `prototypes/low-fidelity/styles/main.css`：`6B7D4F86803F4849FD5AA308F3F72CC4537E4841068A752F474D0168F85EDF43`
  - `prototypes/low-fidelity/scripts/app.js`：`FEE044F482A365490FC8DF5A9891D561188FA87FC69884417261F12809B90342`

## A5 自动验证与浏览器证据

- 验证器SHA-256：`5E5DE165FDF217B80CA198CAE8A62AF7709BF9ED4A29E3EC7D672460E45091D4`。
- 自动验证：9项 `PASS`、0项失败、1项A6预期 `DEFER`；A5阶段 `VERIFICATION=PASS`、`A6_MODE=DEFERRED`。
- 规格与质量两路独立复审均为 `Critical 0 / Important 0 / Minor 0 / Ready Yes`。
- 浏览器证据：
  - `BROWSER_VERSION: Chrome 151.0.7922.173`
  - `PLAYWRIGHT_VERSION: 1.62.1`
  - `STATIC_SERVER: http://127.0.0.1:4173/`
  - `PAGE_COUNT: 59`
  - `A_ROUTES: 47`
  - `B_ROUTES: 12`
  - `PAGE_ERRORS: 0`
  - `SEVERE_CONSOLE_ERRORS: 0`
  - `EXTERNAL_REQUESTS: 0`
- 59/59页面标题与页面ID通过；微信小程序20、用户网页13、机构管理网页14、关键流程12。
- 320px抽查 `/mini/visitor/home`、`/web/visitor/home`、`/admin/dashboard`、`/flow/guardian-binding` 均无横向页面溢出。
- 伪造动作负测覆盖绑定跳步、监督矛盾态、删除跨页写、AI越级完成、摘要越级处理和流程跨页重置；合法绑定、监督、删除、AI五层与摘要闭环继续通过。

## A6 打包前（pre-package）

- 本报告、`docs/reviews/FILE_INVENTORY.md`和ZIP内载荷清单在生成ZIP前冻结，打包后永不回写。
- 预期成员数：`54`；运行时白名单名单SHA-256：`36EBB5D0F829B164D8B9130EB70DD259F5A6D4EFB0A8752D5D9B56D0788C58D6`。
- `ZIP_MEMBER_CONFIRMATION_EVIDENCE=THREAD_POST_PACKAGE`：待项目负责人对54成员数、名单SHA与goal SHA作稳定确认；确认原文、UTF-8字节数、原文SHA与时间只记录在仓库外线程回执。
- `THREAD_POST_PACKAGE=PENDING_PROJECT_LEADER_CONFIRMATION`；本报告不声称 `PASS`。
- ZIP验证后唯一允许的tracked写是一次覆盖根 `SHA256SUMS.txt` 为最终manifest；随后生成仓库外回执并保持零tracked写。
- Commit 4 SHA：只在提交后写入 `TERMINAL_FINAL` 外部回执，本报告不得预填或回写。
- Commit 4固定消息：`feat: add phase 1a low fidelity review prototype`。

## 已完成范围

- 项目治理、产品规格、角色与三端功能矩阵、页面清单、用户流程。
- 技术架构、多租户与权限、数据模型、API边界、文件/环境/安全草案。
- 同芯AI学习助手产品、流程、安全和评估草案。
- 47个A级页面、12个B级流程的低保真可点击原型，6张真实浏览器截图。
- 自动静态检查、浏览器路由/闭环/安全负测、响应式检查、PNG结构与视觉复审。

## 未完成范围

- Phase 1A批次B与Phase 1B未启动。
- 未进行正式业务开发、后端实现、数据库迁移、真实认证、微信支付、正式AI接入或腾讯云部署。
- 未配置Git远程、未推送、未创建PR、未发布。
- A6 ZIP、最终根manifest、`THREAD_POST_PACKAGE`及Commit 4仍受后续硬门禁控制。

## 文件统计

- 产品与架构稳定文档由Commit 1—3保存；A4/A5当前新增10个批准文件：3个原型文件、1个验证器、6张截图。
- 原型可运行页面：59（47 A + 12 B）；产品页面库存：69（另含10个C级未来预留）。
- A6审查包目标：54个普通文件成员，不含目录项；其中6个为截图。
- `docs/reviews/FILE_INVENTORY.md`逐行冻结54成员；ZIP内manifest覆盖除自身外的53成员。

## 关键决策

- 三端共用统一后端边界，但页面职责不机械复制：小程序即时轻量，用户网页完整历史与长内容，机构管理网页负责配置/权限/统计/审核/批量。
- 所有机构业务对象必须有 `tenant_id`，校区业务必须有 `campus_id`；服务端从可信身份上下文注入范围，不信任前端租户ID。
- 平台管理员默认无权读取学生正文；跨租户访问必须单独批准、最小权限并审计。
- 未成年人只使用明显虚构的模拟数据；同芯AI要求监护同意、监督、最小采集、人工复核、可关闭/删除/审计。
- B级原型中的角色切换是审查工具，不是生产授权证明；正式实现必须落到服务端Membership、tenant/campus和对象级权限。

## 原型页面清单

- 微信小程序：20个A级页面。
- 用户网页：13个A级页面。
- 机构管理网页：14个A级页面。
- 关键流程：12个B级可操作状态机。
- 完整路径、页面ID、空/错/权限/终态和角色证据见 `docs/product/PAGE_INVENTORY.md` 与原型统一入口。

## 验证命令

```text
rtk python -B scripts/verify_phase_1a_batch_a.py
rtk node --check prototypes/low-fidelity/scripts/app.js
rtk git diff --check
rtk git status --ignored --short --untracked-files=all
rtk git remote -v
rtk python -m http.server 4173 --bind 127.0.0.1 --directory prototypes/low-fidelity
rtk proxy --% C:\Users\HU\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe -e "<Playwright 59路由、B级闭环/负测、320px与截图内联脚本>"
```

- 上述Node运行时使用工作区已安装Playwright `1.62.1`与系统Chrome；未安装依赖。
- SHA-256使用Node标准库 `crypto` 只读复算；子PowerShell缺少 `Get-FileHash` 后未安装替代工具。

## 验证结果

- 自动验证、Node语法、Git空白检查：退出码均为0。
- 路由：59/59通过；浏览器错误、严重控制台错误、外部请求与HTTP 4xx/5xx均为0。
- B级安全守卫：非法动作保持原状态并返回拒绝回执；合法闭环通过。
- PNG：6/6通过签名、chunk边界、CRC、IDAT/zlib、IEND及尾随字节检查，并逐张目检。
- Git远程输出为空；未推送、未部署、未使用真实数据、正式AI、微信支付或生产密钥。

## 截图清单

- `artifacts/screenshots/mini-visitor-home.png` — `6843FDF2D99E32677478773B07C3F58215DABF967CD9906FF042D7A55FEEE811`
- `artifacts/screenshots/web-visitor-home.png` — `7ACDC6A7E5817B92A523053BFC8CF07C0972B1EF18D560C223BEE343B2FB4142`
- `artifacts/screenshots/admin-dashboard.png` — `349E48EB2FB467C1594B37E782679B2EA3361D7A1AE390E4B51823B3766E4029`
- `artifacts/screenshots/flow-guardian-binding.png` — `5E875686DA946C00A046A38254745EE90C04ABE49BAD254C0A808584FEBAB576`
- `artifacts/screenshots/flow-teacher-daily-report.png` — `767B8C2937B3239011752EA7F3BFE10D39A1539E6DB007B97F53D9A69FA1E67D`
- `artifacts/screenshots/flow-ai-learning-assistant.png` — `3943946DDF6328B2AD1041E6B97AB35CCD08905134F41C8FB454EE26945A36F6`

## Git提交

- `f5007721a33cd000019feb9bea50de6e1d610eb8` — `chore: establish phase 1a project governance`
- `51bb197dea7e19bea068465cb37b8375add3d5fe` — `docs: define phase 1a batch a product baseline`
- `61acddcbd2a89f15f83e6517063555c298668c9b` — `docs: draft platform architecture and ai safety`
- Commit 4：`DEFERRED_TO_COMMIT_4`，固定消息为 `feat: add phase 1a low fidelity review prototype`；SHA只进入 `TERMINAL_FINAL`。

## 工作区状态

- A6打包前为 `DIRTY_EXPECTED_PRE_COMMIT_4`：A4/A5及A6批准文件尚未暂存，cached差异为空。
- `rtk git status --ignored --short --untracked-files=all` 仅列批准路径；未发现 `.env.example`、依赖、缓存或无关文件。
- 分支 `planning/phase-1a-batch-a`；远程为空；最终 `GIT_WORKTREE_STATUS=CLEAN` 只能由A7提交后外部回执确认。

## 发现的风险

- 客户端低保真角色切换不构成真实授权；正式实现若未在服务端落实tenant/campus/Membership与对象范围，会产生越权风险。
- 多租户缓存键、异步任务、文件前缀、AI会话和成本归属必须与数据库查询/唯一约束同等隔离。
- AI输出仍需人工复核、输入脱敏、敏感主题拦截与可删除审计；不能把模拟流程效果外推为学习成效。
- 本轮曾发现并修复专用B级委托动作可跳步/跨页写入的问题；最终负测与两路复审均通过。

## 已知限制

- 原型仅使用内存状态与本地静态资源，无后端、数据库、真实登录、持久化、并发、灾备或生产性能证据。
- 浏览器证据来自本机Chrome 151和Playwright 1.62.1；未覆盖真机、微信开发者工具或跨浏览器设备矩阵。
- 执行中出现并已解除的非实质工具事件：误生成零字节 `{const}`、单个Playwright快照YAML及数次单个 `__pycache__`，均核对精确路径后删除且从未暂存；一次Playwright MCP传输关闭后改用已安装工作区运行时；一次内联脚本选择器错误仅使该次测试无结果，后续新测试通过。
- `Get-FileHash` 在子PowerShell不可用，使用Node标准库复算；未安装任何工具或依赖。
- 以上事件不改变当前文件哈希、白名单或验证结论，但保留为透明执行记录。

## 阻塞项

- 仓库阻塞基线：`NO_BLOCKERS`。
- 当前硬门禁不是缺陷阻塞，而是合同要求的项目负责人稳定确认：54成员、名单SHA-256与goal SHA未经确认前禁止生成ZIP。
- 以下事件一旦发生必须停止：合同缺失或SHA不符；未授权文件/无关工程/额外提交；权威来源实质冲突；真实数据或生产密钥；跨租户或未成年人风险；需要依赖、外部API、支付、正式AI、远程或部署；验证失败；要求批次B或Phase 1B。

## 下一步建议

1. 项目负责人确认成员数 `54`、名单SHA `36EBB5D0F829B164D8B9130EB70DD259F5A6D4EFB0A8752D5D9B56D0788C58D6`、goal SHA `9659A889AB7870C1C911C63BBC5AE330DCBED2FC023444D1E4B43D89F07A0089`。
2. 确认后生成并直接审计ZIP中央目录、CRC、流式成员SHA和包内manifest；禁止解包。
3. 唯一一次覆盖根最终manifest，生成 `THREAD_POST_PACKAGE` 外部回执，然后零tracked写进入A7。
4. A7按 `FILE_INVENTORY.md` 显式暂存、创建Commit 4、执行最终门禁并停止，提交审查包给项目负责人。

## 明确停止声明

- 未收到项目负责人稳定确认前，本轮在pre-package门禁停止，不生成ZIP。
- A7完成后仍不进入Phase 1A批次B或Phase 1B；不推送GitHub、不部署腾讯云、不修改ENHE现有项目、不使用真实学生/家长/教师敏感数据、不接入微信支付、不接入正式AI模型、不使用生产密钥。
- 批次A最终 `PASS` 仅为内部证据门禁通过、待项目负责人验收；输出规定回执后立即停止。
