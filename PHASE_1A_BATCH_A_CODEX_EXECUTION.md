# Phase 1A 批次A｜Codex完整执行指令

> 项目：学生托管机构智能化系统平台  
> 执行阶段：Phase 1A 批次A——规格、流程、低保真原型与技术草案  
> 执行性质：规划与原型交付，不是正式业务开发  
> 目标仓库：`student-care-saas-platform`  
> 推荐本地路径：`C:\Users\HU\Documents\student-care-saas-platform`  
> 推荐分支：`planning/phase-1a-batch-a`

---

## 0. 你的角色与最终目标

你是本项目的 **Codex交付执行负责人**，同时承担以下职责：

- AI产品与交付经理；
- AI技术负责人；
- UI/UX原型执行者；
- QA、安全与文档审查者。

你的最终目标是：

> 在不进入正式业务开发、不部署生产环境、不接入真实学生数据和正式AI模型的前提下，将已经确认的项目方案转化为一套可审查、可追踪、可继续执行的 Phase 1A 批次A交付包，包括项目治理文件、产品规格、三端页面清单、用户流程、低保真可点击原型、技术架构草案、AI学习助手草案、验收规则及完整验证证据。

本轮完成后必须停止，等待项目负责人审核。**禁止自动进入 Phase 1A 批次B或 Phase 1B。**

---

# 1. 信息来源与优先级

按以下顺序理解项目要求：

1. 当前导入到Codex的ChatGPT完整对话；
2. 本执行指令；
3. 已审核通过的两份报告：
   - 《学生托管机构智能化系统平台——完整项目方案与分阶段执行计划》V2.0；
   - 《同芯学园学生托管机构智能化系统平台设计方案》机构汇报版 V1.0；
4. 已确认的项目审查稿 V1.2；
5. 仓库内后续生成并经确认的决策文件。

若内容冲突：

- 以当前对话中最新确认的决定为准；
- 其次以本执行指令为准；
- 不得自行恢复已废弃的旧称谓或旧范围；
- 发现无法判断的实质冲突时，记录到 `docs/reviews/BLOCKERS.md` 并停止，不得猜测。

---

# 2. 已锁定、不得擅自修改的决策

## 2.1 团队与交付方式

```text
项目负责人
→ AI产品与交付经理 + AI技术负责人
→ 专项智能体
→ QA/安全门禁
→ 项目负责人最终验收
```

产品经理负责“做什么、为什么做、用户怎样使用、怎样算完成”。

技术负责人负责“怎样实现、数据与接口怎样设计、怎样测试、怎样发布和回滚”。

专项智能体只能在任务合同授权范围内执行。

## 2.2 商业与技术路线

```text
多租户 SaaS 技术底座
+ 单个真实学生托管机构试点
+ 先验证合作意愿
+ 再逐步开发完整业务
```

技术底座必须支持多机构，但本阶段只围绕“同芯学园”试点设计。

## 2.3 用户与端侧分配

| 用户 | 微信小程序 | 用户网页端 | 机构管理网页端 |
|---|---:|---:|---:|
| 访客 | 支持 | 支持 | 不支持 |
| 家长 | 支持 | 支持 | 不支持 |
| 教师与工作人员 | 支持 | 支持 | 不支持 |
| 机构管理人员 | 可按教师身份使用 | 可按教师身份使用 | 支持 |

全系统用户名称统一使用：

```text
访客状态
访客端
访客首页
```

禁止在正式界面、PRD、页面清单和原型中使用“游客状态”作为当前产品名称。

技术枚举建议使用 `VISITOR`。

## 2.4 端侧设计原则

- 微信小程序：即时、现场、轻量、拍照上传、快捷处理；
- 用户网页端：完整查看、历史记录、长内容、批量或复杂编辑；
- 机构管理网页端：配置、权限、表格、统计、审核、财务与批量管理；
- 三端共用统一后端、数据库、账号、权限、文件和业务规则；
- 双端核心能力一致，但不得机械复制相同页面。

## 2.5 家长与学生绑定流程

必须保持以下顺序：

```text
微信登录
→ 填写手机号
→ 输入机构邀请码 + 学生信息（姓名 + 班级）
→ 机构审核
→ 建立家长与学生关系
```

本轮只制作关键流程原型和规格，不实现真实账号、短信或审核服务。

## 2.6 教师工作日报

教师工作日报与学生托管日报必须区分。

教师工作日报主要展示：

- 当天任务完成情况；
- 当天班级学生情况；
- 考勤、请假、接送汇总；
- 班级整体情况；
- 异常及处理情况；
- 未完成原因；
- 工作总结；
- 交接事项；
- 次日重点。

正式业务阶段应由任务、考勤、接送、学生记录和异常数据自动汇总，教师只补充总结，不能退化为重复手工表单。

本轮只制作规格与关键流程原型。

## 2.7 同芯AI学习助手

产品定位：

```text
小学作业引导 + 错题巩固
教师或家长监督使用
学生先尝试
系统分层提示
重新作答
生成同类巩固题
学习摘要回流教师
```

提示层级：

```text
第0层：确认已知条件、问题目标和学生自己的尝试
第1层：提示知识点、公式或解题方向
第2层：拆解一个关键步骤
第3层：必要时讲解完整过程
巩固层：生成1—3道同类题验证理解
```

首期不为学生创建独立账号，由教师或家长从学生档案进入学习空间。

禁止设计为：

- 开放式万能聊天；
- 直接代写作业、作文、手抄报；
- 考试作弊工具；
- 情感陪伴或虚拟好友；
- 心理诊断、情绪识别；
- 自动给学生贴能力标签；
- 自动形成纪律、处罚或绩效结论；
- 未经教师或家长确认直接发送敏感结论。

本轮只完成产品流程、安全边界和概念原型，不调用正式模型。

## 2.8 视觉基线

参考UI样本仅可参考：

- 布局；
- 卡片；
- 留白；
- 导航；
- 数据看板；
- 信息层级；
- 响应式结构。

禁止直接复制：

- 原样配色；
- 机器人或人物；
- 图标；
- 插画；
- 水印；
- 完整页面。

最终视觉方向：

```text
同芯学园品牌绿色
+ 柔和儿童辅助色
+ 温暖可信
+ 儿童友好
+ 专业清晰
+ 卡片化
+ 不过度游戏化
```

低保真原型以结构清晰为主，可少量使用品牌绿作为识别色，但不得提前制作完整高保真视觉。

## 2.9 当前服务器基线

```text
腾讯云轻量应用服务器·通用型
4核CPU
8GB内存
180GB SSD
12Mbps带宽
2000GB/月流量
```

本轮不得连接、修改或部署到该服务器。

---

# 3. 本轮范围

## 3.1 必须完成

1. 项目治理与仓库基线；
2. 产品总PRD和V0.1专项PRD；
3. 用户角色与三端功能矩阵；
4. 完整页面清单；
5. 核心用户流程；
6. 内容字段和状态定义；
7. 低保真可点击跨端原型；
8. 多租户、统一账号、权限和数据模型草案；
9. API边界、文件、环境和部署草案；
10. 同芯AI学习助手产品与安全草案；
11. 验收标准和验证脚本；
12. Phase 1A批次A审查包。

## 3.2 明确不做

- 不开发正式微信小程序；
- 不开发正式Next.js用户端；
- 不开发正式机构管理后台；
- 不开发NestJS业务API；
- 不创建正式数据库迁移；
- 不实现真实登录、短信、微信授权；
- 不接入微信支付；
- 不接入正式AI模型；
- 不接入伙伴云API；
- 不导入真实学生、家长、教师敏感数据；
- 不上传腾讯云；
- 不部署测试或生产；
- 不推送GitHub；
- 不进入Phase 1A批次B；
- 不进入Phase 1B。

---

# 4. 启动前环境检查

先执行只读检查，输出结果后再继续。

## 4.1 工作目录

目标目录：

```text
C:\Users\HU\Documents\student-care-saas-platform
```

处理规则：

1. 若目录不存在，创建目录；
2. 若目录为空或仅包含本项目批准资料，可初始化新Git仓库；
3. 若目录已经是本项目仓库，先读取现有 `README.md`、`AGENTS.md`、`docs/`、Git状态和最近提交；
4. 若目录包含与本项目无关的已有工程或未确认内容，立即停止并报告；
5. 禁止修改 `C:\Users\HU\Documents` 下其他项目；
6. 禁止使用 `--force`；
7. 禁止删除或覆盖无法确认归属的文件。

## 4.2 Git策略

新仓库：

```text
git init
git checkout -b planning/phase-1a-batch-a
```

已有本项目仓库：

- 确认工作区干净；
- 创建 `planning/phase-1a-batch-a`；
- 如已有同名分支，先检查并复用，不强制覆盖；
- 如已有其他未提交更改，停止并报告。

若Codex环境支持内置worktree，并且仓库已有主分支，则优先使用隔离worktree；新空仓库无需额外创建worktree。

## 4.3 工具检查

检查但不要盲目安装：

```text
git
node
npm
pnpm
python
浏览器或Playwright能力
zip或等价压缩工具
```

本轮优先使用系统已有工具。只有低保真原型验证确有必要时，才能安装最小开发依赖，并在回执中列出。

---

# 5. 仓库与文件结构

建立以下结构。可增加必要的索引文件，但不得随意扩大项目。

```text
student-care-saas-platform/
├─ AGENTS.md
├─ README.md
├─ PLANS.md
├─ .gitignore
├─ docs/
│  ├─ project/
│  │  ├─ PROJECT_CHARTER.md
│  │  ├─ DECISION_BASELINE.md
│  │  ├─ TERMINOLOGY.md
│  │  ├─ SCOPE_AND_NON_SCOPE.md
│  │  ├─ CHANGE_CONTROL.md
│  │  └─ RESPONSIBILITY_MATRIX.md
│  ├─ agents/
│  │  ├─ PRODUCT_MANAGER.md
│  │  ├─ TECH_LEAD.md
│  │  ├─ UI_UX_AGENT.md
│  │  └─ QA_SECURITY_AGENT.md
│  ├─ templates/
│  │  ├─ TASK_CONTRACT.md
│  │  └─ REVIEW_RECEIPT.md
│  ├─ product/
│  │  ├─ PLATFORM_PRD.md
│  │  ├─ V0_1_PRD.md
│  │  ├─ ROLE_MATRIX.md
│  │  ├─ ENDPOINT_MATRIX.md
│  │  ├─ PAGE_INVENTORY.md
│  │  ├─ USER_FLOWS.md
│  │  ├─ CONTENT_SCHEMA.md
│  │  ├─ STATE_MODEL.md
│  │  └─ ACCEPTANCE_CRITERIA.md
│  ├─ architecture/
│  │  ├─ SYSTEM_ARCHITECTURE_DRAFT.md
│  │  ├─ MODULE_BOUNDARIES_DRAFT.md
│  │  ├─ MULTI_TENANCY_DRAFT.md
│  │  ├─ IDENTITY_AND_AUTHORIZATION_DRAFT.md
│  │  ├─ DATA_MODEL_DRAFT.md
│  │  ├─ API_BOUNDARIES_DRAFT.md
│  │  ├─ FILE_STORAGE_DRAFT.md
│  │  ├─ ENVIRONMENTS_AND_DEPLOYMENT_DRAFT.md
│  │  └─ SECURITY_AND_PRIVACY_DRAFT.md
│  ├─ ai/
│  │  ├─ AI_LEARNING_ASSISTANT_PRODUCT_SPEC.md
│  │  ├─ AI_LEARNING_FLOW.md
│  │  ├─ AI_SAFETY_BASELINE.md
│  │  └─ AI_EVALUATION_DRAFT.md
│  ├─ plans/
│  │  └─ PHASE_1A_BATCH_A_EXEC_PLAN.md
│  └─ reviews/
│     ├─ PHASE_1A_BATCH_A_REVIEW.md
│     ├─ FILE_INVENTORY.md
│     └─ BLOCKERS.md
├─ prototypes/
│  └─ low-fidelity/
│     ├─ index.html
│     ├─ assets/
│     ├─ styles/
│     ├─ scripts/
│     └─ pages/
├─ scripts/
│  └─ verify_phase_1a_batch_a.py
├─ artifacts/
│  ├─ screenshots/
│  └─ review-package/
└─ SHA256SUMS.txt
```

`BLOCKERS.md` 在无阻塞时也必须存在，并明确写入 `NO_BLOCKERS`。

---

# 6. AGENTS.md必须固化的长期规则

`AGENTS.md` 必须简洁、可执行，并让后续Codex任务无需重复长提示词。

至少包含：

1. 项目定位；
2. 当前阶段；
3. 已锁定术语；
4. 三端职责；
5. 多租户强制规则；
6. 未成年人数据规则；
7. AI学习助手边界；
8. 不得使用真实数据；
9. 不得擅自部署或推送；
10. 必须先读哪些文档；
11. 任务必须使用任务合同；
12. 每个阶段结束必须验证并停止；
13. 禁止自动进入下一阶段；
14. 文档、原型与代码的权威来源顺序；
15. 完成声明必须附证据。

---

# 7. 产品规格交付要求

## 7.1 PLATFORM_PRD.md

必须包含：

- 背景与问题；
- 产品定位；
- 目标客户；
- 用户角色；
- 价值优先级；
- 三端产品形态；
- 总体功能地图；
- 阶段路线；
- 非功能需求；
- 隐私与安全；
- AI能力定位；
- 成功指标；
- 风险；
- 术语表引用。

## 7.2 V0_1_PRD.md

V0.1正式范围只包括：

### 访客产品线

- 访客首页；
- 机构介绍；
- 企业文化；
- 家校共育；
- 托管一日流程；
- 教师团队；
- 教师个人介绍；
- 精彩活动；
- 餐食与食谱；
- 校区环境；
- 联系或预约机构。

### 内部员工产品线

- 员工登录概念；
- 内部工作台；
- 新人指南；
- 教学资源；
- 资源搜索；
- 伙伴云链接；
- 我的账号。

### 轻量机构管理后台

- 机构资料；
- 首页内容；
- 教师公开介绍；
- 活动；
- 餐食与食谱；
- 新人指南；
- 教学资源；
- 伙伴云链接；
- 员工账号；
- 文件管理；
- 发布、下架和排序；
- 基础操作日志。

必须明确列出V0.1非范围。

## 7.3 ROLE_MATRIX.md

至少定义：

- 访客；
- 家长；
- 教师；
- 工作人员；
- 机构管理员；
- 校区负责人；
- 平台管理员。

每个角色写清：

- 能看什么；
- 能做什么；
- 不能做什么；
- 使用端；
- 数据范围。

## 7.4 ENDPOINT_MATRIX.md

矩阵列：

```text
功能
访客小程序
访客网页
家长小程序
家长网页
教师小程序
教师网页
机构管理网页
阶段
```

必须区分：

- V0.1正式开发；
- 后续关键流程原型；
- 未来结构预留。

## 7.5 PAGE_INVENTORY.md

页面按三级深度分类。

### A级：V0.1完整低保真可点击

#### 微信小程序

- 访客首页；
- 机构介绍；
- 家校共育；
- 一日流程；
- 教师团队；
- 教师详情；
- 精彩活动；
- 活动详情；
- 餐食与食谱；
- 校区与联系方式；
- 员工登录；
- 内部工作台；
- 新人指南列表；
- 新人指南详情；
- 教学资源分类；
- 教学资源列表；
- 教学资源详情；
- 资源搜索；
- 伙伴云链接；
- 我的账号。

#### 用户网页端

- 访客首页；
- 机构介绍；
- 教师团队；
- 教师详情；
- 活动；
- 餐食与食谱；
- 一日流程；
- 员工登录；
- 内部工作台；
- 新人指南；
- 教学资源；
- 伙伴云入口；
- 我的账号。

#### 机构管理网页端

- 登录；
- 管理看板；
- 机构资料；
- 首页内容；
- 教师公开介绍；
- 活动管理；
- 餐食与食谱；
- 新人指南；
- 教学资源；
- 伙伴云链接；
- 员工账号；
- 文件管理；
- 发布与下架；
- 基础操作日志。

### B级：关键流程原型

- 家长与学生绑定；
- 家长首页；
- 学生每日托管记录；
- 请假；
- 安全接送；
- 教师工作台；
- 教师任务管理；
- 班级学生情况；
- 教师工作日报；
- 同芯AI学习助手；
- AI学习摘要回流教师；
- 家长AI监督设置。

### C级：结构预留

- 财务与费用；
- 教师绩效；
- 招生；
- 证照；
- 物资；
- 多校区经营；
- SaaS套餐；
- 微信支付；
- AI阅读与学习计划；
- 平台运营。

每个页面必须有：

- 页面ID；
- 端；
- 角色；
- 阶段；
- 入口；
- 主要区域；
- 主要操作；
- 空状态；
- 错误状态；
- 权限要求；
- 数据对象；
- 验收点。

## 7.6 USER_FLOWS.md

必须用 Mermaid 或等价文本图描述：

1. 访客了解机构；
2. 员工查看指南和资源；
3. 家长与学生绑定；
4. 教师任务到工作日报；
5. 接送授权与接送记录；
6. 异常上报和跟进；
7. AI学习助手提示式学习；
8. 内容从后台发布到小程序和网页。

## 7.7 CONTENT_SCHEMA.md

必须定义以下内容对象字段：

- 机构资料；
- 教师公开介绍；
- 一日流程；
- 活动；
- 餐食与食谱；
- 新人指南；
- 教学资源；
- 伙伴云链接；
- 媒体文件；
- 发布状态。

教师公开介绍必须区分：

- 对外公开资料；
- 内部教师档案。

## 7.8 STATE_MODEL.md

至少定义：

- 内容：草稿、已发布、已下架；
- 家长绑定：待提交、待审核、已通过、已拒绝、已解除；
- 任务：待处理、进行中、已完成、已逾期、已取消；
- 教师日报：草稿、已提交、退回修改、已确认；
- AI学习：未开始、引导中、需教师介入、已完成、已关闭。

---

# 8. 技术架构草案要求

采用以下建议栈，但本轮只设计，不完整脚手架化：

```text
微信小程序：Taro + React + TypeScript
用户网页端：Next.js + React
机构管理后台：Next.js
后端API：NestJS模块化单体
数据库：PostgreSQL + Prisma
缓存/任务：Redis（按需启用）
文件：腾讯云COS
部署：Docker + Nginx
AI：Provider Adapter + RAG + Safety Gateway + Evaluation
```

## 8.1 SYSTEM_ARCHITECTURE_DRAFT.md

必须包括：

- 三端与统一API关系；
- 后端模块；
- 数据库；
-COS；
- Redis；
- 日志与审计；
- AI服务层；
- 外部微信能力；
- 伙伴云仅快捷链接阶段；
- 环境隔离；
- 架构决策与暂缓项。

## 8.2 MULTI_TENANCY_DRAFT.md

强制规则：

- 机构业务表包含 `tenant_id`；
- 校区业务包含 `campus_id`；
- 服务端自动注入租户范围；
- 不信任前端传入的租户ID；
- 文件按机构前缀隔离；
- 分享和下载链接短时有效；
- AI会话和成本也按租户隔离；
- 平台管理员默认不查看学生具体内容。

## 8.3 IDENTITY_AND_AUTHORIZATION_DRAFT.md

统一用户模型：

```text
User
├─ 微信身份
├─ 手机号身份
├─ 网页登录身份
└─ 一个或多个机构Membership
```

必须定义：

- 用户；
- 机构成员关系；
- 角色；
- 权限；
- 数据范围；
- 多角色切换；
- 家长与学生关系；
- 教师班级范围；
- 管理员后台权限。

## 8.4 DATA_MODEL_DRAFT.md

本轮必须详细定义但不建立迁移：

### V0.1对象

```text
Tenant
Campus
User
Membership
Role
Permission
InstitutionProfile
TeacherProfile
GuideArticle
TeachingResource
PartnerCloudLink
Activity
MealPlan
MediaAsset
AuditLog
```

### 后续对象

```text
Student
GuardianRelationship
BindingApplication
Attendance
LeaveRequest
PickupAuthorization
PickupRecord
HealthIncident
WorkTask
TeacherDailyReport
FeeRecord
AIStudySession
AIHint
KnowledgePoint
PracticeResult
GuardianConsent
```

每个对象描述：

- 用途；
- 核心字段；
- 关系；
- 租户范围；
- 敏感级别；
- 保存原则；
- 当前阶段是否实现。

## 8.5 API_BOUNDARIES_DRAFT.md

只定义边界和示例，不生成完整接口代码。

必须包括：

- 公共内容读取；
- 员工资源读取；
- 管理后台内容管理；
- 文件上传；
-发布流程；
- 家长绑定未来接口；
- 教师任务和日报未来接口；
- AI学习助手未来接口；
-错误格式；
-幂等；
-分页；
-审计；
-权限校验位置。

---

# 9. 同芯AI学习助手草案要求

## 9.1 AI_LEARNING_ASSISTANT_PRODUCT_SPEC.md

必须定义：

- 用户问题；
- 目标；
- 首期年级和学科假设；
- 两种监督模式；
- 学生不独立注册；
- 输入方式；
- 学生先尝试；
- 分层提示；
- 错题巩固；
- 转教师；
- 家长控制；
- 教师摘要；
- 使用时长；
- 成功指标；
- 不做事项。

首期试点建议明确为：

```text
一家机构
一个校区
一个班级
一个年级
一个学科
优先小学数学
连续4周
```

实际年级、教材和班级留待后续机构确认，但不得写成无定义的TBD；应标记为“Phase 3.5试点前由机构决策”。

## 9.2 AI_SAFETY_BASELINE.md

必须包含：

- 未成年人使用限制；
- 监护人同意；
- 教师监督；
- 输入脱敏；
- 输出安全；
- 不确定时拒答或转教师；
- 禁止代写；
- 禁止情感陪伴；
- 禁止心理诊断；
- 模型不可用时降级；
- 人工复核；
- 审计；
- 数据删除；
- 家长和机构关闭能力。

## 9.3 AI_EVALUATION_DRAFT.md

定义未来评测集：

- 数学正确性；
- 提示是否泄露答案；
- 是否要求学生先尝试；
- 年级适配；
- 有害内容；
- 隐私泄露；
- 拒答；
- 转人工；
- 成本；
- 延迟；
- 同类题质量。

不运行真实模型评测。

---

# 10. 低保真可点击原型

## 10.1 实现原则

使用轻量、可离线打开的原型，不搭建正式应用工程。

推荐：

```text
HTML + CSS + 少量原生JavaScript
```

允许使用已有的零依赖静态工具，但不得为了低保真原型引入大型框架。

要求：

- 从 `prototypes/low-fidelity/index.html` 可进入所有原型；
- 明确区分小程序框、用户网页框、管理后台框；
- 页面间可点击跳转；
- 使用模拟数据；
- 不发起外部请求；
- 不依赖真实后端；
- 不使用真实姓名、手机号、地址、学生照片或健康数据；
- 不复制UI参考图素材；
- 使用自制占位图形、CSS图标或简单SVG；
- 显示“低保真原型 / 非正式系统”标识。

## 10.2 A级原型

A级页面必须具备完整跳转关系。

可以通过模板复用，但每个页面必须有独立页面ID或路由。

## 10.3 B级关键流程原型

至少形成以下可点击演示：

### 家长绑定

```text
访客
→ 登录
→ 手机号
→ 机构邀请码 + 学生姓名 + 班级
→ 提交
→ 待审核
→ 审核通过后的家长首页
```

### 教师任务与日报

```text
教师工作台
→ 查看任务
→ 标记完成
→ 查看班级学生汇总
→ 自动形成日报草稿
→ 教师补充
→ 提交
→ 负责人确认/退回
```

### AI学习助手

```text
教师或家长开启
→ 选择学生/学科
→ 输入模拟题目
→ 学生先尝试
→ 第1层提示
→ 重新作答
→ 第2层提示
→ 巩固题
→ 学习摘要
→ 回流教师
```

## 10.4 低保真视觉

- 背景以白色、浅灰和浅绿为主；
- 品牌绿用于主按钮和选中状态；
- 柔和蓝、黄、橙、粉、紫只用于少量分类卡片；
- 管理后台减少儿童化装饰；
- 异常状态使用明确红/橙；
- 不使用排行榜、积分游戏或情感化AI形象。

---

# 11. 自动验证

创建 `scripts/verify_phase_1a_batch_a.py`。

至少验证：

1. 所有必需文件存在；
2. Markdown文件不为空；
3. 关键决策词存在；
4. 面向当前产品的文档和原型不误用“游客状态”；
5. 绑定流程顺序正确；
6. 三端矩阵存在；
7. V0.1范围和非范围存在；
8. AI禁止能力有明确记录；
9. 原型入口存在；
10. 原型内部链接目标存在；
11. 不包含常见密钥格式；
12. 不包含真实手机号、身份证号或学生敏感数据；
13. `BLOCKERS.md`有明确状态；
14. 禁止出现生产部署成功等虚假声明；
15. 评审报告存在。

验证命令：

```powershell
python scripts/verify_phase_1a_batch_a.py
git diff --check
git status --short
```

若可使用浏览器自动化，再增加：

- 启动本地静态服务器；
- 打开原型入口；
- 访问关键页面；
- 检查无严重控制台错误；
- 输出关键页面截图到 `artifacts/screenshots/`。

浏览器自动化不可用时，不得伪造截图；在回执中如实说明，并完成静态链接验证。

---

# 12. 提交策略

建议分为四次可审查提交。

## Commit 1

```text
chore: establish phase 1a project governance
```

包含：

- README；
- AGENTS；
- PLANS；
- 项目治理；
- 角色卡；
- 模板。

## Commit 2

```text
docs: define phase 1a batch a product baseline
```

包含：

- PRD；
- 角色矩阵；
- 端侧矩阵；
- 页面清单；
- 用户流程；
- 内容和状态；
- 验收标准。

## Commit 3

```text
docs: draft platform architecture and ai safety
```

包含：

- 技术架构；
- 多租户；
- 统一身份与权限；
- 数据模型；
- API边界；
- AI学习助手；
- AI安全与评测。

## Commit 4

```text
feat: add phase 1a low fidelity review prototype
```

包含：

- 低保真原型；
- 验证脚本；
- 截图；
- 评审报告；
- 文件清单；
- 校验和；
- 最终审查包。

每次提交前：

```text
只暂存规定文件
运行相关验证
检查git diff --cached
禁止git add .
禁止推送远程
```

---

# 13. 审查包

生成：

```text
artifacts/review-package/student-care-platform-phase1a-batch-a-review-pack-v1.0.zip
```

压缩包至少包含：

```text
docs/project/
docs/product/
docs/architecture/
docs/ai/
docs/reviews/
prototypes/low-fidelity/
artifacts/screenshots/（如真实生成）
SHA256SUMS.txt
```

不要把 `.git`、缓存、依赖目录、密钥或无关文件放入压缩包。

在项目根目录生成 `SHA256SUMS.txt`，覆盖本轮核心文档、原型入口、验证脚本和ZIP。

---

# 14. PHASE_1A_BATCH_A_REVIEW.md

最终评审报告必须包含：

- 执行摘要；
- 已完成范围；
- 未完成范围；
- 文件统计；
- 关键决策；
- 原型页面清单；
- 验证命令；
- 验证结果；
- 截图清单；
- Git提交；
- 工作区状态；
- 发现的风险；
- 已知限制；
- 阻塞项；
- 下一步建议；
- 明确停止声明。

不得写“全部完成”而不附证据。

---

# 15. 完成门禁

全部通过后才能声明批次A完成：

```text
PROJECT_GOVERNANCE_STATUS=PASS
PRODUCT_SCOPE_STATUS=PASS
VISITOR_TERMINOLOGY_STATUS=PASS
ENDPOINT_MATRIX_STATUS=PASS
PAGE_INVENTORY_STATUS=PASS
USER_FLOW_STATUS=PASS
LOW_FIDELITY_PROTOTYPE_STATUS=PASS
ROLE_PERMISSION_DRAFT_STATUS=PASS
MULTI_TENANT_DRAFT_STATUS=PASS
DATA_MODEL_DRAFT_STATUS=PASS
API_BOUNDARY_DRAFT_STATUS=PASS
AI_STUDENT_PRODUCT_SPEC_STATUS=PASS
AI_MINOR_SAFETY_BASELINE_STATUS=PASS
DATA_PRIVACY_BASELINE_STATUS=PASS
AUTOMATED_VERIFICATION_STATUS=PASS
REVIEW_PACKAGE_STATUS=PASS
GIT_WORKTREE_STATUS=CLEAN
GIT_PUSH_EXECUTED=NO
PRODUCTION_DEPLOYMENT_EXECUTED=NO
REAL_STUDENT_DATA_USED=NO
LIVE_AI_MODEL_USED=NO
PHASE_1A_BATCH_B_STARTED=NO
PHASE_1B_STARTED=NO
```

任何关键门禁失败：

- 不得伪造PASS；
- 写明 `BLOCKED`；
- 保留已有有效成果；
- 输出阻塞原因和最小解除条件；
- 停止执行。

---

# 16. 最终回执格式

完成后只输出以下结构，不要继续下一阶段：

```text
PHASE_1A_BATCH_A_STATUS=<PASS|BLOCKED>
PROJECT_ROOT=<绝对路径>
BRANCH=<分支>
WORKTREE=<路径或NONE>

PROJECT_GOVERNANCE_STATUS=<PASS|BLOCKED>
PRODUCT_SCOPE_STATUS=<PASS|BLOCKED>
VISITOR_TERMINOLOGY_STATUS=<PASS|BLOCKED>
ENDPOINT_MATRIX_STATUS=<PASS|BLOCKED>
PAGE_INVENTORY_STATUS=<PASS|BLOCKED>
USER_FLOW_STATUS=<PASS|BLOCKED>
LOW_FIDELITY_PROTOTYPE_STATUS=<PASS|BLOCKED>
ROLE_PERMISSION_DRAFT_STATUS=<PASS|BLOCKED>
MULTI_TENANT_DRAFT_STATUS=<PASS|BLOCKED>
DATA_MODEL_DRAFT_STATUS=<PASS|BLOCKED>
API_BOUNDARY_DRAFT_STATUS=<PASS|BLOCKED>
AI_STUDENT_PRODUCT_SPEC_STATUS=<PASS|BLOCKED>
AI_MINOR_SAFETY_BASELINE_STATUS=<PASS|BLOCKED>
DATA_PRIVACY_BASELINE_STATUS=<PASS|BLOCKED>
AUTOMATED_VERIFICATION_STATUS=<PASS|BLOCKED>
REVIEW_PACKAGE_STATUS=<PASS|BLOCKED>

COMMITS=
- <hash> <message>
- <hash> <message>

VERIFICATION_COMMANDS=
- <command>
- <command>

VERIFICATION_SUMMARY=
<关键验证结果>

REVIEW_PACKAGE=<绝对路径>
REVIEW_PACKAGE_SHA256=<hash>
SCREENSHOTS=<数量或NOT_AVAILABLE>
BLOCKERS=<NO_BLOCKERS或简述>

GIT_WORKTREE_STATUS=<CLEAN|DIRTY>
GIT_PUSH_EXECUTED=NO
PRODUCTION_DEPLOYMENT_EXECUTED=NO
REAL_STUDENT_DATA_USED=NO
LIVE_AI_MODEL_USED=NO
PHASE_1A_BATCH_B_STARTED=NO
PHASE_1B_STARTED=NO

NEXT_RECOMMENDED_ACTION=提交Phase 1A批次A审查包给项目负责人审核
```

输出回执后立即停止。

---

# 17. 推荐执行方法

在Codex中先使用计划模式进行只读审计：

```text
/plan 阅读当前导入的ChatGPT对话、本文件和目标目录。仅检查环境、范围、文件结构、执行顺序与风险，形成Phase 1A批次A实施计划；不要创建或修改任何文件，不要进入批次B。
```

项目负责人确认计划后，再启动目标模式：

```text
/goal 严格执行 PHASE_1A_BATCH_A_CODEX_EXECUTION.md，完成全部批次A交付和验证，生成审查包，并在所有门禁有证据后输出规定回执。不得启动批次B、Phase 1B、生产部署、Git推送、真实学生数据或正式AI模型；遇到实质冲突或无法安全解除的阻塞时停止并报告。
```

若目标模式要求过长，将本文件保存到项目根目录：

```text
PHASE_1A_BATCH_A_CODEX_EXECUTION.md
```

然后使用上面的短目标命令引用该文件。
