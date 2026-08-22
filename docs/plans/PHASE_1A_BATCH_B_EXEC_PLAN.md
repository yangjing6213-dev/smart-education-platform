# Phase 1A 批次B任务合同与执行计划

## 0. 公共任务合同

| 字段 | 固定值 |
|---|---|
| TASK_ID_PREFIX | PHASE_1A_BATCH_B |
| AUTHORIZATION | 项目负责人已批准的当前线程目标与本合同 |
| CONTRACT_SHA256 | 8DE2E96EB129E05950F8BC3832C5CEB842A1565BC5512E201F7EB233AC6DE04E |
| SOURCE_BRANCH | planning/phase-1a-batch-a |
| SOURCE_HEAD | f698f87150dce3376fb96d1bbb330d28d0d73b81 |
| TARGET_BRANCH | planning/phase-1a-batch-b |
| PROHIBITED | Batch A 冻结证据、依赖、正式应用、真实数据、密钥、外部 API、正式 AI、支付、远程、推送、PR、部署 |

每个实例遵循：批准合同 -> 最小实施 -> 专项自检 -> QA/安全门禁 -> 显式暂存 -> staged 检查 -> 提交 -> 复验 -> 回执 -> 停止。任何失败都不得用计划文字替代证据。

## B0：只读预检

- TASK_ID=PHASE_1A_BATCH_B_B0
- 允许写入：无；允许命令：只读 Git、哈希、ZIP 中央目录和文本读取。
- 输入：Batch B 合同、Batch A 验收锚点、Batch A ZIP/Manifest/报告/文件清单/验证器/低保真原型/截图、四个视觉输入。
- 验收：合同 SHA；源分支和源 HEAD；目标分支 provenance；工作区和 index；remote 为 0；Batch A ZIP SHA、54 成员、成员名单 SHA；四个视觉 SHA；根目录无额外 ZIP；Batch B 固定 ZIP 不存在；输入集精确且未跟踪。
- 验证命令：git status --short --ignored --untracked-files=all、git rev-parse、标准库 SHA/ZIP 中央目录脚本、git remote。
- 停止：任何冻结证据漂移、目标分支归属不明、哈希不符、未授权文件或固定 ZIP 已存在。

## B1：治理与验收记录

- TASK_ID=PHASE_1A_BATCH_B_B1
- 允许文件：.gitignore、AGENTS.md、README.md、PLANS.md、docs/project/PHASE_1A_BATCH_A_ACCEPTANCE.md、docs/project/PHASE_1A_BATCH_B_DECISION_BASELINE.md、docs/project/PHASE_1A_BATCH_B_SCOPE_AND_NON_SCOPE.md、docs/plans/PHASE_1A_BATCH_B_EXEC_PLAN.md。
- 输出：Batch A 最终验收记录、Batch B 决策和范围基线、B0-B7 计划、根治理切换至 Batch B、/phase-inputs/ 忽略规则。
- 验收：路径正确；Batch A 冻结语义完整；B0-B7、五次提交、59 路由、15 截图、86 白名单和停止不变量明确；无 Batch A 文件变化。
- 验证命令：git diff --check（合同固定硬换行除外）、git diff --name-only、冻结文件 SHA 对比、UTF-8/非空检查。
- 提交：chore: activate phase 1a batch b design baseline。

## B2：品牌与跨端 UI 设计系统

- TASK_ID=PHASE_1A_BATCH_B_B2
- 允许路径：合同白名单中的 docs/design/*。
- 输出：视觉参考分析、品牌 UI、颜色与可访问性、字体与内容语气、间距圆角层级、图标插画、组件库存、响应式跨端规则、交互动效规则、设计 QA 清单。
- 验收：只使用参考图的布局和信息层级；颜色、人物、图标和完整页面均原创；正文、触控目标、焦点、键盘、减少动效规则明确；访客、家长、教师、管理端差异明确。
- 验证命令：路径白名单检查、文本禁用词扫描、SVG 外链/base64/水印扫描、颜色和尺寸静态检查。
- 提交：docs: define tongxin cross-end design system。

## B3：59 路由高保真原型

- TASK_ID=PHASE_1A_BATCH_B_B3
- 允许路径：prototypes/high-fidelity/** 及合同白名单内原型资产。
- 输出：原生 HTML/CSS/JS 原型、页面目录、内存模拟数据、Logo、图标符号表、7 个原创 SVG 插画。
- 验收：A 级 47、B 级 12、浏览器 59；C 级不执行；hash 路由可导航；三端职责正确；12 流程有状态转换；三闭环和 AI 五层守卫可操作；无网络、持久化、外部资源、正式服务和真实数据。
- 验证命令：标准库路由/引用/脚本静态检查，浏览器逐路由验证，控制台/请求计数，SVG 安全检查。
- 提交：feat: add phase 1a high fidelity prototypes。

## B4：V0.1 基线与 Phase 1B 计划

- TASK_ID=PHASE_1A_BATCH_B_B4
- 允许路径：合同白名单中的 docs/architecture/*_BASELINE.md、docs/contracts/*、docs/plans/PHASE_1B_*.md。
- 输出：14 个架构基线、6 个契约文件、18 个独立 TDD 任务的 Phase 1B 计划和依赖图。
- 验收：技术、目录、模块、租户、身份、权限、数据、API、文件、环境、安全、测试、观测、迁移回滚和 AI 网关均无 TBD/TODO；每个 Phase 1B 任务有准确未来路径、输入/输出、失败测试、实现、通过测试和提交步骤；不执行正式开发。
- 验证命令：Markdown/JSON 解析、必需章节扫描、TDD 任务计数、禁止路径扫描、合同白名单检查。
- 提交：docs: finalize v0.1 technical baseline and phase 1b plan。

## B5：自动与浏览器验证

- TASK_ID=PHASE_1A_BATCH_B_B5
- 允许路径：scripts/verify_phase_1a_batch_b.py、合同白名单内验证证据文件。
- 输出：标准库验证器、浏览器验证结果、响应式检查、越权负测、12 流程结果和浏览器环境记录。
- 验收：所有 PASS 均由命令或浏览器实际结果支持；页面错误、严重控制台错误、外部请求和失败请求可追溯；59/59、15 截图前置状态和三闭环均通过。
- 验证命令：python scripts/verify_phase_1a_batch_b.py 及现有浏览器命令；不得安装依赖。
- 停止：浏览器不可用、截图无法真实生成或任何负测未拒绝时标记 BLOCKED。

## B6：截图与 86 项审查包

- TASK_ID=PHASE_1A_BATCH_B_B6
- 允许路径：合同规定的 15 个截图、评审报告、文件清单、独立 Manifest 和固定 ZIP。
- 输出：15 张真实截图、docs/reviews/PHASE_1A_BATCH_B_REVIEW.md、docs/reviews/PHASE_1A_BATCH_B_FILE_INVENTORY.md、SHA256SUMS_PHASE_1A_BATCH_B.txt、固定 ZIP。
- 验收：ZIP 精确 86 项；成员名单 SHA 为 B6ED195F1F41AB731F53AFA65071037BE23A56F3547B543160A41F0CE6A33C30；中央目录无重复、目录或危险路径；逐成员 CRC/SHA；不含输入目录、.git、依赖、缓存、密钥或 Batch A ZIP。
- 验证命令：Python 标准库 zipfile.infolist()、流式哈希、Manifest 交叉检查；禁止解包。

## B7：最终门禁与停止

- TASK_ID=PHASE_1A_BATCH_B_B7
- 允许路径：B6 证据和固定提交所需白名单；不得修改 Batch A 冻结文件。
- 输出：第五次提交、最终门禁命令和固定格式回执。
- 验收：五次提交顺序和消息正确；合同、源 HEAD、冻结证据无漂移；工作区/index 干净；remote 0；PHASE_1B_STARTED=NO、PROJECT_OWNER_ACCEPTANCE=PENDING。
- 提交：test: add phase 1a batch b review evidence。
- 停止：最终回执输出后停止，等待项目负责人验收。
