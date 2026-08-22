# Phase 1A 批次B｜Codex完整执行合同

> 本合同用于“学生托管机构智能化系统平台”Phase 1A 批次B。  
> 执行方式固定为：**只读 `/plan` → 项目负责人审核 → `/goal` 执行 → 证据审查 → 停止**。  
> 本合同不授权 Phase 1B 正式开发、GitHub 推送、腾讯云部署、真实学生数据、正式 AI、微信支付或生产密钥。

---

## 0. 合同元数据

```text
TASK_ID=PHASE_1A_BATCH_B
PROJECT_ROOT=C:\Users\HU\Documents\student-care-saas-platform
SOURCE_BRANCH=planning/phase-1a-batch-a
SOURCE_HEAD=f698f87150dce3376fb96d1bbb330d28d0d73b81
TARGET_BRANCH=planning/phase-1a-batch-b
BATCH_A_REVIEW_PACKAGE=artifacts/review-package/student-care-platform-phase1a-batch-a-review-pack-v1.0.zip
BATCH_A_REVIEW_PACKAGE_SHA256=309C264BA901FFFCED50AEF52C40D87ACA110ABC41F17C731347D6779DEF183A
BATCH_A_REVIEW_PACKAGE_MEMBER_COUNT=54
BATCH_A_MEMBER_LIST_SHA256=36EBB5D0F829B164D8B9130EB70DD259F5A6D4EFB0A8752D5D9B56D0788C58D6
BATCH_A_PROJECT_OWNER_ACCEPTANCE=PASS
BATCH_A_ACCEPTANCE_DATE=2026-08-22
CURRENT_PHASE=PHASE_1A_BATCH_B
FORMAL_APPLICATION_DEVELOPMENT=NO
PRODUCTION_DEPLOYMENT=NO
REAL_PERSONAL_DATA=NO
LIVE_AI_MODEL=NO
GIT_PUSH=NO
```

合同文件名：

```text
PHASE_1A_BATCH_B_CODEX_EXECUTION.md
```

合同 SHA-256 由外部启动指令提供。任何时候合同缺失、SHA 不符、项目根不符或源提交不符，必须立即停止。

---

## 1. 权威来源与读取顺序

### 1.1 权威层级

1. 本合同及外部启动指令中锁定的合同 SHA-256；
2. 已验收的 Batch A 提交 `f698f87150dce3376fb96d1bbb330d28d0d73b81`；
3. 已验收 Batch A 审查包及其哈希；
4. Batch A 中的 PRD、页面库存、端侧矩阵、用户流程、验收标准、架构草案与 AI 安全草案；
5. 项目负责人后续明确、稳定且不与上述内容冲突的直接授权。

聊天摘要、模型记忆、未落盘口头描述、参考图自动识别结果均不能替代上述权威来源。

### 1.2 Batch B 必读顺序

执行前必须读取：

1. `PHASE_1A_BATCH_B_CODEX_EXECUTION.md`；
2. `AGENTS.md`；
3. `docs/project/DECISION_BASELINE.md`；
4. `docs/project/SCOPE_AND_NON_SCOPE.md`；
5. `docs/product/V0_1_PRD.md`；
6. `docs/product/ENDPOINT_MATRIX.md`；
7. `docs/product/PAGE_INVENTORY.md`；
8. `docs/product/USER_FLOWS.md`；
9. `docs/product/ACCEPTANCE_CRITERIA.md`；
10. `docs/architecture/*.md`；
11. `docs/ai/*.md`；
12. `docs/reviews/PHASE_1A_BATCH_A_REVIEW.md`；
13. `docs/reviews/BLOCKERS.md`；
14. 本合同列出的四个只读视觉输入。

---

## 2. Phase 1A 批次A验收锚点

Batch B 开始前必须验证：

```text
git rev-parse HEAD
```

必须等于：

```text
f698f87150dce3376fb96d1bbb330d28d0d73b81
```

当前分支必须为：

```text
planning/phase-1a-batch-a
```

以下文件必须存在并保持 Batch A 验收状态：

- `artifacts/review-package/student-care-platform-phase1a-batch-a-review-pack-v1.0.zip`
- `docs/reviews/PHASE_1A_BATCH_A_REVIEW.md`
- `docs/reviews/FILE_INVENTORY.md`
- `SHA256SUMS.txt`
- `prototypes/low-fidelity/index.html`
- `prototypes/low-fidelity/styles/main.css`
- `prototypes/low-fidelity/scripts/app.js`

Batch B **不得修改、覆盖、重新打包或删除**以上 Batch A 冻结证据和低保真原型。  
Batch B 只允许创建新的高保真原型、技术基线、执行计划和独立审查包。

---

## 3. 只读视觉输入

输入根目录：

```text
phase-inputs/phase1a-batch-b/
```

视觉文件目录：

```text
phase-inputs/phase1a-batch-b/visual/
```

输入根目录中的 `START_HERE.md`、`INPUT_MANIFEST.txt`、`visual/README.md` 和四个视觉文件均为批准的只读控制输入。整个 `phase-inputs/` 必须加入 `.gitignore`，始终保持未跟踪、只读，不进入 Git、审查包或正式产品。

| 输入文件 | SHA-256 |
|---|---|
| `phase-inputs/phase1a-batch-b/visual/tongxin-logo.png` | `65F4B749DA035FD2659FCF43A58713EABE4BD9F98CF1E9FF78A4724551B3BEE1` |
| `phase-inputs/phase1a-batch-b/visual/web-layout-reference.jpg` | `88B620C1454BC05E273F5E9A1A41A81527B47D8B0ECEE710E05F37412CC90F0E` |
| `phase-inputs/phase1a-batch-b/visual/mobile-layout-reference.jpg` | `612E739FF2371E6477B95DE258FD8E9FE396521F789764C3EBA9B16F1CE30CE2` |
| `phase-inputs/phase1a-batch-b/visual/tongxin-brand-poster.jpg` | `D870845B48D64FAF57E1F3DF7C6032BA4CB51D246700A370D1D98F1B9B26CDDC` |

### 3.1 输入用途

- `tongxin-logo.png`：机构官方 Logo，可复制到高保真原型的品牌资源目录；
- `web-layout-reference.jpg`：只分析桌面端布局、卡片、留白、信息层级和看板结构；
- `mobile-layout-reference.jpg`：只分析移动端卡片、底部导航、轻量交互和信息节奏；
- `tongxin-brand-poster.jpg`：只分析品牌绿色、白色留白、儿童友好氛围和品牌表达。

### 3.2 明确禁止

不得从参考图复制或嵌入：

- 水印、平台账号、原文文案；
- 机器人、人物、排行榜、积分、钻石、奖牌；
- 参考图中的图标、插画、背景纹理或完整构图；
- 参考图原始紫色、蓝色或其他整套配色；
- 任何带版权风险的第三方素材。

所有儿童插画、图标和页面视觉必须为本项目原创的 SVG、CSS 或几何图形。  
官方 Logo 是唯一允许直接使用的输入图片。

---

## 4. 批次B目标

Phase 1A 批次B必须完成四个结果：

1. **同芯学园品牌与跨端 UI 设计系统定稿**；
2. **47 个 A 级页面 + 12 个 B 级流程的高保真可点击原型**；
3. **V0.1 技术架构、数据、权限、API、测试、运维和回滚基线定稿**；
4. **Phase 1B V0.1 正式开发实施计划**，但不执行正式开发。

本批次结束时，项目负责人应能审查：

- 产品是否符合机构品牌；
- 三端界面是否清晰、温暖、专业；
- 所有关键流程是否可理解、可操作；
- 技术边界是否足以指导正式开发；
- Phase 1B 的任务顺序、测试、文件和门禁是否明确。

---

## 5. 产品范围保持冻结

### 5.1 端侧分配

- 访客：微信小程序 + 用户网页端；
- 家长：微信小程序 + 用户网页端；
- 教师与工作人员：微信小程序 + 用户网页端；
- 机构管理：仅机构管理网页端。

### 5.2 V0.1正式开发范围保持不变

Batch B 的高保真原型优先完整表现：

- 访客首页；
- 机构介绍、企业文化与家校共育；
- 托管一日流程；
- 教师团队与教师个人介绍；
- 精彩活动；
- 餐食与食谱；
- 校区与联系方式；
- 内部员工登录概念；
- 内部工作台；
- 新人指南；
- 教学资源与搜索；
- 伙伴云链接；
- 机构资料、首页内容、教师介绍、活动、餐食、新人指南、教学资源、伙伴云链接、员工账号、文件、发布与日志的轻量后台。

### 5.3 B级关键流程保持不变

必须保留 Batch A 的 12 个 B 级流程，并保持既有页面 ID、路由、状态、角色守卫和终态。

三条完整闭环必须继续成立：

1. 家长与学生绑定；
2. 教师任务 → 班级学生情况 → 教师工作日报；
3. 家长/教师监督 → 同芯 AI 学习助手 → 授权教师摘要。

### 5.4 AI范围保持不变

同芯 AI 学习助手只用于：

```text
小学作业引导 + 错题巩固
```

固定顺序：

```text
学生先尝试
→ 第0层
→ 第1层
→ 第2层
→ 必要时第3层
→ 1—3道巩固题
→ 摘要仅回流授权教师
```

禁止开放聊天、答案倾倒、代写、作弊、情感陪伴、虚拟好友、心理诊断、情绪识别、自动能力标签、自动纪律/处罚/绩效结论。

---

## 6. 本批次明确非范围

Batch B 不得创建或执行：

- `apps/` 正式应用脚手架；
- 正式 Taro、Next.js、NestJS、Prisma 业务代码；
- `package.json`、锁文件或 `node_modules`；
- 数据库迁移；
- Dockerfile、Compose、Nginx生产配置或CI/CD；
- 微信登录、短信、支付、伙伴云API；
- 正式AI模型、RAG、OCR、外部API；
- 腾讯云连接、部署或域名操作；
- Git远程、推送、PR或发布；
- 真实学生、家长、教师或机构敏感数据；
- 生产密钥或 `.env`；
- Phase 1B 正式开发；
- Phase 2及后续业务开发。

允许产出：文档、JSON契约、离线高保真原型、原创SVG、验证脚本、截图、评审报告和审查ZIP。

---

## 7. 品牌与视觉设计基线

### 7.1 视觉关键词

```text
品牌一致
儿童友好
温暖可信
专业清晰
卡片化
数据直观
操作高效
不过度游戏化
跨端统一
```

### 7.2 锚点色板

以下是设计锚点。允许为满足对比度做小幅调整，但必须在设计报告中记录最终值与原因。

| 角色 | 建议值 |
|---|---|
| 品牌主绿 | `#9FD246` |
| 品牌深绿 | `#6F9F27` |
| 品牌浅绿 | `#EFF8DF` |
| 品牌黄 | `#FFD84D` |
| 天空蓝 | `#7EC8F5` |
| 珊瑚橙 | `#FF9A86` |
| 柔和紫 | `#B7A7F6` |
| 薄荷绿 | `#8FD9B6` |
| 页面背景 | `#F6F8F3` |
| 卡片背景 | `#FFFFFF` |
| 主要文字 | `#1F2A1B` |
| 次要文字 | `#687164` |
| 边框 | `#E3E9DB` |
| 成功 | `#2E9E57` |
| 信息 | `#2E90FA` |
| 警告 | `#F79009` |
| 危险 | `#D92D20` |

颜色使用建议：

```text
70% 中性浅色
20% 品牌绿色
10% 儿童辅助色与状态色
```

单一页面原则上不超过一个主色和两个辅助色。  
安全、接送、健康、异常和费用页面不得娱乐化。

### 7.3 字体和可访问性

- 不加载外部字体；
- 中文字体栈：`Microsoft YaHei`, `PingFang SC`, `Noto Sans CJK SC`, sans-serif；
- 正文默认不小于 16px，辅助信息不小于 13px；
- 主要文本和交互控件达到 WCAG AA 对比度；
- 焦点状态清晰；
- 触控目标不小于 44×44 CSS px；
- 支持键盘导航、Escape关闭弹窗、语义化地标；
- 支持 `prefers-reduced-motion`；
- 不依赖颜色作为唯一状态表达。

### 7.4 端侧视觉差异

- 访客端：最温暖，重品牌、教师、环境、活动和餐食；
- 家长端：重孩子状态、安全、通知、接送和反馈；
- 教师端：重任务、班级、异常、日报和快捷操作；
- 管理端：重表格、筛选、统计、权限和批量管理；
- AI学习助手：友好但不拟人化，不设计为“伙伴”“朋友”或情感角色。

---

## 8. 高保真原型要求

### 8.1 技术形式

创建新的独立目录：

```text
prototypes/high-fidelity/
```

使用：

- HTML；
- CSS Custom Properties；
- 原生 JavaScript；
- 本地 PNG/SVG；
- hash 路由；
- 内存态模拟数据。

不得：

- 修改 `prototypes/low-fidelity/`；
- 安装依赖；
- 使用框架；
- 访问外网；
- 使用 `fetch`、XHR、WebSocket、EventSource；
- 使用 localStorage、sessionStorage、IndexedDB、Cookie；
- 加载外部字体、图标或图片；
- 声称是真实系统。

首页必须明显显示：

```text
Phase 1A 批次B高保真审查原型
全部内容为模拟数据
无真实登录、支付、后端、正式AI或外部请求
```

### 8.2 路由和页面

- 从 `docs/product/PAGE_INVENTORY.md` 读取并保持 47 个 A 级页面和 12 个 B 级页面；
- 页面 ID 和路由不得擅自增加、删除或重命名；
- 高保真原型路由集合必须与低保真原型和页面库存完全一致；
- 10 个 C 级未来预留不得进入可执行原型。

### 8.3 三端布局

#### 微信小程序

- 390×844 为主要设计尺寸；
- 同时验证 320×568；
- 单列卡片为主，必要时双列；
- 角色化底部导航；
- 现场操作按钮显著；
- 适合拍照、签到、接送、任务和日报。

#### 用户网页端

- 1440×1024 为主要桌面尺寸；
- 响应式覆盖 768、1024、1440；
- 适合长内容、历史、下载、完整日报和多个孩子；
- 不机械复制小程序布局。

#### 机构管理网页端

- 左侧导航 + 顶部上下文 + 主内容区；
- 数据卡、表格、筛选、状态和待办清楚；
- 儿童辅助色只做分类和状态，不使用大面积卡通装饰。

### 8.4 原创视觉资产

必须创建原创本地SVG：

- 欢迎与儿童成长；
- 教师团队；
- 餐食关怀；
- AI学习引导；
- 安全接送；
- 空状态；
- 完成状态。

原创SVG不得嵌入base64图片、外部链接、水印、参考图文字或第三方图标。

### 8.5 交互和状态

- 59个路由均可导航；
- 12个B级流程均可操作；
- 表单有输入、验证、错误、加载、空状态和终态；
- 模态框、抽屉、标签页和筛选器可交互；
- 所有非法跳步和越权动作必须被拒绝；
- 保持 Batch A 已验证的角色守卫和状态机；
- AI必须先尝试并逐层提示；
- 家长/教师权限和摘要范围不得弱化。

---

## 9. 技术基线定稿

Batch A 的 `*_DRAFT.md` 保持不修改。Batch B 创建新的 `*_BASELINE.md` 文件完成定稿。

必须明确且不得保留 `TBD/TODO/以后再说`：

1. 技术栈和选择理由；
2. Monorepo目录结构；
3. 模块边界；
4. 多租户隔离；
5. 统一身份、Membership、角色与对象级权限；
6. V0.1数据模型；
7. V0.1 API资源与错误契约；
8. 文件上传、COS和短期链接；
9. 环境隔离；
10. 测试策略；
11. 可观测性、日志与审计；
12. 数据迁移与回滚；
13. 安全与未成年人隐私；
14. AI适配器、安全网关和未来评测边界。

### 9.1 服务器基线

记录已经确认的V0.1应用服务器基线：

```text
腾讯云轻量应用服务器
通用型
4核CPU
8GB内存
180GB SSD
12Mbps
2000GB/月
```

该配置只作为 Phase 1B/V0.1 测试与单机构初期试点候选，不得声称已经部署或足以支持正式多机构生产。

### 9.2 Phase 1B未来仓库结构

技术基线和实施计划必须采用以下方向，并在文档中明确未来文件职责：

```text
apps/
  mini-program/
  user-web/
  admin-web/
  api/
packages/
  contracts/
  validation/
  auth/
  tenant/
  config/
  ui-web/
  ui-mini/
  test-utils/
infrastructure/
docs/
tests/
```

Batch B 只写设计和计划，不创建这些正式目录。

---

## 10. Phase 1B实施计划要求

创建：

```text
docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md
```

计划必须：

- 只覆盖 V0.1 正式开发；
- 采用TDD；
- 每个任务有准确未来文件路径；
- 每个任务有接口输入/输出；
- 每个任务有失败测试、实现、通过测试、提交步骤；
- 每项任务可独立审查；
- 明确依赖顺序；
- 明确不进入家长正式业务、教师正式业务、AI正式模型和支付；
- 形成可在后续Codex会话中逐任务执行的计划；
- 结尾给出Phase 1B启动前硬门禁。

至少拆分：

1. Monorepo与质量工具；
2. 共享合同和验证；
3. 多租户请求范围；
4. 身份与内部员工登录基础；
5. 内容与发布模型；
6. 机构资料与首页内容后台；
7. 教师公开介绍；
8. 活动与餐食；
9. 新人指南；
10. 教学资源与搜索；
11. 伙伴云安全入口；
12. 文件上传与COS适配边界；
13. 访客用户网页；
14. 访客微信小程序；
15. 内部员工用户网页；
16. 内部员工小程序；
17. 操作日志；
18. E2E、安全和发布候选验证。

不得执行计划中的任何正式开发任务。

---

## 11. 执行阶段

### B0：只读预检

验证：

- 项目根；
- 源分支和源提交；
- 工作区干净；
- 无Git远程；
- Batch A审查包及哈希；
- Batch A 54成员与清单；
- 本合同及外部SHA；
- 四个视觉输入及哈希；
- 固定Batch B ZIP不存在；
- 除根目录本合同和 `phase-inputs/phase1a-batch-b/` 精确输入集外，没有其他未授权文件。

B0只读，失败立即停止。

### B1：激活批次B与验收记录

创建目标分支：

```text
git switch -c planning/phase-1a-batch-b f698f87150dce3376fb96d1bbb330d28d0d73b81
```

创建Batch A项目负责人验收记录、Batch B决策基线、范围、执行计划。  
更新 `AGENTS.md`、`PLANS.md`、`README.md` 和 `.gitignore`，但不得修改Batch A审查证据。

Commit 1：

```text
chore: activate phase 1a batch b design baseline
```

### B2：视觉分析与设计系统

完成参考图分析、品牌UI规范、色彩、字体、组件、响应式、交互、原创插画规则和设计QA清单。

Commit 2：

```text
docs: define tongxin cross-end design system
```

### B3：高保真原型

创建59路由高保真原型、原创SVG、角色化布局和12个流程。  
不得修改低保真原型。

Commit 3：

```text
feat: add phase 1a high fidelity prototypes
```

### B4：技术基线与Phase 1B计划

完成所有 `*_BASELINE.md`、V0.1契约、追踪矩阵和Phase 1B实施计划。

Commit 4：

```text
docs: finalize v0.1 technical baseline and phase 1b plan
```

### B5：自动验证与浏览器证据

创建标准库验证器和浏览器测试证据。  
不得安装依赖。优先复用已存在的 Chrome 和 Playwright。

### B6：审查包

生成Batch B评审报告、文件清单、独立manifest、15张真实截图和固定ZIP。  
本合同已明确预授权下方86项精确白名单，不需要中途再次向项目负责人请求成员确认。

### B7：最终提交、门禁与停止

Commit 5：

```text
test: add phase 1a batch b review evidence
```

提交后执行最终验证，输出回执并停止。

---

## 12. 允许修改与创建的文件

### 12.1 允许修改

- `.gitignore`
- `AGENTS.md`
- `README.md`
- `PLANS.md`

除上述四个文件外，Batch A已有文件不得修改。

### 12.2 允许创建

- 本合同；
- `docs/project/PHASE_1A_BATCH_A_ACCEPTANCE.md`
- `docs/project/PHASE_1A_BATCH_B_DECISION_BASELINE.md`
- `docs/project/PHASE_1A_BATCH_B_SCOPE_AND_NON_SCOPE.md`
- `docs/design/`
- `docs/contracts/`
- 本合同列出的新 `docs/architecture/*_BASELINE.md`
- `docs/plans/PHASE_1A_BATCH_B_EXEC_PLAN.md`
- `docs/plans/PHASE_1B_*.md`
- `prototypes/high-fidelity/`
- `scripts/verify_phase_1a_batch_b.py`
- `docs/reviews/PHASE_1A_BATCH_B_*.md`
- `artifacts/screenshots-batch-b/`
- Batch B manifest和ZIP。

`phase-inputs/phase1a-batch-b/` 是只读输入，不属于创建或修改授权。任何其他路径均未授权。

---

## 13. 高保真截图固定清单

必须真实浏览器生成以下15张截图：

1. `mini-visitor-home-hifi.png`
2. `mini-teacher-workbench-hifi.png`
3. `mini-parent-home-hifi.png`
4. `mini-ai-learning-hifi.png`
5. `web-visitor-home-hifi.png`
6. `web-teacher-workbench-hifi.png`
7. `web-parent-home-hifi.png`
8. `web-teacher-daily-report-hifi.png`
9. `admin-dashboard-hifi.png`
10. `admin-teacher-profile-hifi.png`
11. `admin-guide-resource-hifi.png`
12. `flow-guardian-binding-hifi.png`
13. `flow-teacher-daily-report-hifi.png`
14. `flow-ai-learning-assistant-hifi.png`
15. `responsive-mobile-320-hifi.png`

若真实浏览器无法生成完整15张，Batch B必须标记 `BLOCKED`，不得伪造、使用旧截图或缩减清单。

---

## 14. 浏览器和自动验证

### 14.1 自动验证器

创建：

```text
scripts/verify_phase_1a_batch_b.py
```

只使用Python标准库，至少验证：

- Batch A验收锚点；
- 合同和视觉输入哈希；
- 分支与提交历史；
- 允许文件集合；
- Batch A冻结证据未修改；
- 设计文档完整且无占位符；
- CSS tokens存在；
- 色彩对比度关键组合达到AA；
- 59路由与页面库存完全一致；
- 47 A + 12 B + 10 C数量不变；
- 12个B流程和三条闭环；
- AI第0—3层和巩固层；
- 无外部URL/请求/持久化；
- 无第三方水印、排行榜、钻石、机器人等参考图内容；
- 原创SVG无外链、脚本和嵌入图片；
- Logo输出与输入一致或有可验证的无损规范化说明；
- JSON契约可解析；
- 技术基线无 `TBD/TODO/placeholder`；
- Phase 1B计划不包含执行结果；
- 15张PNG结构、CRC和尺寸；
- 审查ZIP路径安全、成员唯一、成员哈希一致。

### 14.2 浏览器矩阵

遍历全部59路由，记录：

```text
BROWSER_VERSION
PLAYWRIGHT_VERSION
STATIC_SERVER_COMMAND
ROUTES_TOTAL=59
ROUTES_PASS=59
PAGE_ERRORS=0
SEVERE_CONSOLE_ERRORS=0
EXTERNAL_REQUESTS=0
FAILED_REQUESTS=0
```

额外检查：

- 390×844移动端；
- 320×568窄屏；
- 768×1024平板；
- 1024和1440桌面；
- 关键路由无横向溢出；
- Tab焦点可见；
- Escape关闭可关闭层；
- 触控目标；
- reduced motion；
- 12个流程合法路径通过；
- 非法跳步、越权、摘要跨角色、AI越级均被拒绝。

---

## 15. Batch B审查包

固定路径：

```text
artifacts/review-package/student-care-platform-phase1a-batch-b-review-pack-v1.0.zip
```

独立manifest：

```text
SHA256SUMS_PHASE_1A_BATCH_B.txt
```

不得覆盖Batch A的 `SHA256SUMS.txt`。

### 15.1 精确白名单

成员数：

```text
86
```

成员名单SHA-256：

```text
B6ED195F1F41AB731F53AFA65071037BE23A56F3547B543160A41F0CE6A33C30
```

算法：POSIX相对路径按Unicode字符串升序，UTF-8无BOM，一行一个路径，LF分隔并恰好一个末尾LF。

白名单：

- `.gitignore`
- `AGENTS.md`
- `README.md`
- `PLANS.md`
- `PHASE_1A_BATCH_B_CODEX_EXECUTION.md`
- `docs/project/PHASE_1A_BATCH_A_ACCEPTANCE.md`
- `docs/project/PHASE_1A_BATCH_B_DECISION_BASELINE.md`
- `docs/project/PHASE_1A_BATCH_B_SCOPE_AND_NON_SCOPE.md`
- `docs/plans/PHASE_1A_BATCH_B_EXEC_PLAN.md`
- `docs/design/VISUAL_REFERENCE_ANALYSIS.md`
- `docs/design/BRAND_UI_GUIDELINES.md`
- `docs/design/COLOR_AND_ACCESSIBILITY.md`
- `docs/design/TYPOGRAPHY_AND_CONTENT_TONE.md`
- `docs/design/SPACING_RADIUS_ELEVATION.md`
- `docs/design/ICON_AND_ILLUSTRATION_RULES.md`
- `docs/design/COMPONENT_INVENTORY.md`
- `docs/design/RESPONSIVE_AND_CROSS_ENDPOINT_RULES.md`
- `docs/design/INTERACTION_AND_MOTION_RULES.md`
- `docs/design/DESIGN_QA_CHECKLIST.md`
- `prototypes/high-fidelity/index.html`
- `prototypes/high-fidelity/styles/tokens.css`
- `prototypes/high-fidelity/styles/base.css`
- `prototypes/high-fidelity/styles/components.css`
- `prototypes/high-fidelity/styles/layouts.css`
- `prototypes/high-fidelity/styles/endpoints.css`
- `prototypes/high-fidelity/scripts/app.js`
- `prototypes/high-fidelity/data/page-catalog.js`
- `prototypes/high-fidelity/data/mock-data.js`
- `prototypes/high-fidelity/assets/brand/tongxin-logo.png`
- `prototypes/high-fidelity/assets/icons/symbols.svg`
- `prototypes/high-fidelity/assets/illustrations/welcome-children.svg`
- `prototypes/high-fidelity/assets/illustrations/teacher-team.svg`
- `prototypes/high-fidelity/assets/illustrations/meal-care.svg`
- `prototypes/high-fidelity/assets/illustrations/ai-learning.svg`
- `prototypes/high-fidelity/assets/illustrations/safety-pickup.svg`
- `prototypes/high-fidelity/assets/illustrations/empty-state.svg`
- `prototypes/high-fidelity/assets/illustrations/success-state.svg`
- `docs/architecture/TECH_STACK_BASELINE.md`
- `docs/architecture/REPOSITORY_STRUCTURE_BASELINE.md`
- `docs/architecture/SYSTEM_ARCHITECTURE_BASELINE.md`
- `docs/architecture/MODULE_BOUNDARIES_BASELINE.md`
- `docs/architecture/MULTI_TENANCY_BASELINE.md`
- `docs/architecture/IDENTITY_AND_AUTHORIZATION_BASELINE.md`
- `docs/architecture/DATA_MODEL_BASELINE.md`
- `docs/architecture/API_CONTRACT_BASELINE.md`
- `docs/architecture/FILE_STORAGE_BASELINE.md`
- `docs/architecture/ENVIRONMENTS_AND_DEPLOYMENT_BASELINE.md`
- `docs/architecture/SECURITY_AND_PRIVACY_BASELINE.md`
- `docs/architecture/TEST_STRATEGY_BASELINE.md`
- `docs/architecture/OBSERVABILITY_AND_OPERATIONS_BASELINE.md`
- `docs/architecture/MIGRATION_AND_ROLLBACK_BASELINE.md`
- `docs/contracts/V0_1_ROUTE_AND_PAGE_CONTRACT.md`
- `docs/contracts/V0_1_PERMISSION_MATRIX.md`
- `docs/contracts/V0_1_CONTENT_SCHEMA.json`
- `docs/contracts/V0_1_API_SCHEMA.json`
- `docs/contracts/V0_1_ERROR_CATALOG.md`
- `docs/contracts/V0_1_ACCEPTANCE_TRACEABILITY.md`
- `docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md`
- `docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md`
- `scripts/verify_phase_1a_batch_b.py`
- `docs/reviews/PHASE_1A_BATCH_B_REVIEW.md`
- `docs/reviews/PHASE_1A_BATCH_B_FILE_INVENTORY.md`
- `SHA256SUMS_PHASE_1A_BATCH_B.txt`
- `artifacts/screenshots-batch-b/mini-visitor-home-hifi.png`
- `artifacts/screenshots-batch-b/mini-teacher-workbench-hifi.png`
- `artifacts/screenshots-batch-b/mini-parent-home-hifi.png`
- `artifacts/screenshots-batch-b/mini-ai-learning-hifi.png`
- `artifacts/screenshots-batch-b/web-visitor-home-hifi.png`
- `artifacts/screenshots-batch-b/web-teacher-workbench-hifi.png`
- `artifacts/screenshots-batch-b/web-parent-home-hifi.png`
- `artifacts/screenshots-batch-b/web-teacher-daily-report-hifi.png`
- `artifacts/screenshots-batch-b/admin-dashboard-hifi.png`
- `artifacts/screenshots-batch-b/admin-teacher-profile-hifi.png`
- `artifacts/screenshots-batch-b/admin-guide-resource-hifi.png`
- `artifacts/screenshots-batch-b/flow-guardian-binding-hifi.png`
- `artifacts/screenshots-batch-b/flow-teacher-daily-report-hifi.png`
- `artifacts/screenshots-batch-b/flow-ai-learning-assistant-hifi.png`
- `artifacts/screenshots-batch-b/responsive-mobile-320-hifi.png`
- `docs/product/PAGE_INVENTORY.md`
- `docs/product/ENDPOINT_MATRIX.md`
- `docs/product/ACCEPTANCE_CRITERIA.md`
- `docs/product/USER_FLOWS.md`
- `docs/product/V0_1_PRD.md`
- `docs/ai/AI_LEARNING_ASSISTANT_PRODUCT_SPEC.md`
- `docs/ai/AI_SAFETY_BASELINE.md`
- `docs/reviews/PHASE_1A_BATCH_A_REVIEW.md`

ZIP内manifest校验除自身外的85项成员；项目根manifest额外记录ZIP自身哈希。  
ZIP中不得包含视觉参考输入目录、`.git`、依赖、缓存、密钥或未授权文件。

---

## 16. Git提交

固定五次新提交：

1. `chore: activate phase 1a batch b design baseline`
2. `docs: define tongxin cross-end design system`
3. `feat: add phase 1a high fidelity prototypes`
4. `docs: finalize v0.1 technical baseline and phase 1b plan`
5. `test: add phase 1a batch b review evidence`

每次提交前：

```text
git diff --check
git diff --cached --check
git diff --cached --name-status
git status --short --branch --untracked-files=all
```

只能显式 `git add <approved paths>`。禁止 `git add .`、`git add -A`、amend已验收Batch A提交、rebase、reset --hard、push或创建远程。

---

## 17. 阻塞规则

以下任一情况立即停止：

- 根目录、源分支、源HEAD或合同SHA不符；
- Batch A审查包或冻结文件漂移；
- 视觉输入缺失或哈希不符；
- 目标分支已存在且归属不明；
- 出现未授权文件或改动；
- 需要安装依赖；
- 需要外部API、正式AI、支付、腾讯云或生产密钥；
- 无法完成15张真实截图；
- 无法保持59路由和12流程；
- 设计引用出现复制、水印或版权风险；
- 技术基线无法消除实质歧义；
- 验证或审查包失败。

阻塞时：

1. 不做破坏性恢复；
2. 保留已验证成果；
3. 将 `docs/reviews/BLOCKERS.md` 改为单一 `BLOCKED` 状态；
4. 记录事实、证据、影响、已完成内容和最小解除条件；
5. 输出BLOCKED回执并停止。

---

## 18. 完成门禁

必须全部满足：

```text
BATCH_A_ACCEPTANCE_ANCHOR_STATUS=PASS
PHASE_1A_BATCH_B_GOVERNANCE_STATUS=PASS
VISUAL_INPUT_INTEGRITY_STATUS=PASS
VISUAL_REFERENCE_COMPLIANCE_STATUS=PASS
BRAND_UI_SYSTEM_STATUS=PASS
COLOR_ACCESSIBILITY_STATUS=PASS
COMPONENT_SYSTEM_STATUS=PASS
RESPONSIVE_DESIGN_STATUS=PASS
HIGH_FIDELITY_ROUTE_STATUS=PASS
HIGH_FIDELITY_A_ROUTE_COUNT=47
HIGH_FIDELITY_B_ROUTE_COUNT=12
HIGH_FIDELITY_BROWSER_ROUTE_COUNT=59
B_FLOW_STATE_GUARD_STATUS=PASS
GUARDIAN_BINDING_LOOP_STATUS=PASS
TEACHER_DAILY_REPORT_LOOP_STATUS=PASS
AI_LEARNING_LOOP_STATUS=PASS
ORIGINAL_ILLUSTRATION_STATUS=PASS
TECHNICAL_BASELINE_STATUS=PASS
MULTI_TENANT_BASELINE_STATUS=PASS
ROLE_PERMISSION_BASELINE_STATUS=PASS
DATA_MODEL_BASELINE_STATUS=PASS
API_CONTRACT_BASELINE_STATUS=PASS
SECURITY_PRIVACY_BASELINE_STATUS=PASS
TEST_STRATEGY_BASELINE_STATUS=PASS
OPERATIONS_ROLLBACK_BASELINE_STATUS=PASS
PHASE_1B_IMPLEMENTATION_PLAN_STATUS=PASS
AUTOMATED_VERIFICATION_STATUS=PASS
BROWSER_VERIFICATION_STATUS=PASS
SCREENSHOT_COUNT=15
REVIEW_PACKAGE_STATUS=PASS
REVIEW_PACKAGE_MEMBER_COUNT=86
REVIEW_PACKAGE_MEMBER_LIST_SHA256=B6ED195F1F41AB731F53AFA65071037BE23A56F3547B543160A41F0CE6A33C30
GIT_WORKTREE_STATUS=CLEAN
GIT_REMOTE_COUNT=0
GIT_PUSH_EXECUTED=NO
PRODUCTION_DEPLOYMENT_EXECUTED=NO
REAL_STUDENT_DATA_USED=NO
LIVE_AI_MODEL_USED=NO
PHASE_1B_STARTED=NO
PHASE_2_STARTED=NO
PROJECT_OWNER_ACCEPTANCE=PENDING
```

`PASS`只表示内部证据门禁通过，等待项目负责人验收。

---

## 19. 最终回执格式

```text
PHASE_1A_BATCH_B_STATUS=PASS|BLOCKED
PROJECT_ROOT=...
SOURCE_HEAD=...
TARGET_BRANCH=...
TARGET_HEAD=...
CONTRACT_SHA256=...
BATCH_A_REVIEW_PACKAGE_SHA256=...
VISUAL_INPUTS_STATUS=...
DESIGN_SYSTEM_STATUS=...
HIGH_FIDELITY_ROUTE_STATUS=...
A_ROUTE_COUNT=47
B_ROUTE_COUNT=12
BROWSER_ROUTE_COUNT=59
SCREENSHOT_COUNT=15
TECHNICAL_BASELINE_STATUS=...
PHASE_1B_PLAN_STATUS=...
AUTOMATED_VERIFICATION_STATUS=...
BROWSER_VERIFICATION_STATUS=...
REVIEW_PACKAGE_PATH=...
REVIEW_PACKAGE_SIZE=...
REVIEW_PACKAGE_SHA256=...
REVIEW_PACKAGE_MEMBER_COUNT=86
REVIEW_PACKAGE_MEMBER_LIST_SHA256=B6ED195F1F41AB731F53AFA65071037BE23A56F3547B543160A41F0CE6A33C30
COMMIT_1=...
COMMIT_2=...
COMMIT_3=...
COMMIT_4=...
COMMIT_5=...
GIT_WORKTREE_STATUS=...
GIT_REMOTE_COUNT=0
GIT_PUSH_EXECUTED=NO
PRODUCTION_DEPLOYMENT_EXECUTED=NO
REAL_STUDENT_DATA_USED=NO
LIVE_AI_MODEL_USED=NO
PHASE_1B_STARTED=NO
BLOCKERS=NONE|...
PROJECT_OWNER_ACCEPTANCE=PENDING
```

输出后立即停止。不得进入 Phase 1B，不得自行继续开发。
