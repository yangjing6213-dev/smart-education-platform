# 数据模型草案

## 1. 边界与约定

本文只定义概念对象，不创建 Prisma schema、数据库迁移或真实数据。所有个人示例必须是标注“模拟数据”的虚构占位；下列字段是边界所需的最小集合，不是最终物理表设计。

敏感级别：`L0` 公开；`L1` 机构内部；`L2` 个人/关系数据；`L3` 未成年人、健康、接送、学习或其他高敏数据。保存原则统一受目的限制、最小保存、关系/权限撤销、审计保留与批准后的删除策略约束；本阶段不虚构法定年限。

除 `Tenant`、平台级 `User`、基线 `Role/Permission` 目录外，机构业务对象必须有 `tenant_id`；校区业务必须有 `campus_id`。字段由服务端可信上下文注入，客户端不能指定或覆盖。

## 2. V0.1 对象（合同锁定清单）

| 对象 | 用途 | 核心字段 | 关系 | 租户范围 | 敏感级别 | 保存原则 | 当前阶段是否实现 |
|---|---|---|---|---|---|---|---|
| `Tenant` | SaaS 机构安全边界 | `id`, `name`, `slug`, `status`, `created_at` | 拥有 Campus、Membership 和机构业务对象 | 自身即租户根；不可用客户端值选择 | L1 | 租户终止后按批准流程冻结、导出/删除；保留最小审计 | V0.1 概念；本批次不落库 |
| `Campus` | 租户内校区与校区范围 | `id`, `tenant_id`, `name`, `status`, `public_profile_ref` | 属于 Tenant；被 Membership/业务对象引用 | `tenant_id` 必填；校区业务使用其 `id` | L1；公开投影可为L0 | 停用不删除历史引用；公开投影可独立下架 | V0.1 概念；不落库 |
| `User` | 跨登录身份的统一主体 | `id`, `status`, `created_at`; 身份引用分离 | 连接多个 Identity 与 Membership | 平台主体无 `tenant_id`；业务权限只经 Membership | L2 | 身份目的终止后可删除/去标识；审计只留稳定标识 | V0.1 概念；不接真实账号 |
| `Membership` | User 与 Tenant 的成员关系 | `id`, `tenant_id`, `user_id`, `role_ids`, `campus_scope`, `status`, `version` | 属于 User/Tenant；引用 Role 与数据范围 | 单一 `tenant_id`；可限多个 `campus_id` | L2 | 停用即撤销访问；历史授权变化留最小审计 | V0.1 概念；仅模拟身份 |
| `Role` | 命名的权限集合 | `id`, `code`, `name`, `permission_ids`, `status` | 被 Membership 引用；关联 Permission | 七个基线角色为平台目录；分配在单一 Membership 内 | L1 | 版本化变更，不回写历史审计 | V0.1 概念；不建权限引擎 |
| `Permission` | 资源、动作和条件的最小许可 | `id`, `resource`, `action`, `condition_key` | 被 Role 引用；与 DataScope 联合判定 | 平台目录；执行时必须落入当前租户范围 | L1 | 权限版本可追踪；删除前检查角色引用 | V0.1 概念；不建策略代码 |
| `InstitutionProfile` | 机构公开介绍及合并区块 | `id`, `tenant_id`, `campus_id?`, `introduction`, `culture_sections`, `home_school_sections`, `publish_status`, `version` | 属于 Tenant；引用校区公开投影/MediaAsset | 机构级或明确校区；公开只读已发布投影 | L0/L1 | 草稿内部保存；下架后公开正文失效；版本/审计保留 | V0.1 规格对象；不落库 |
| `TeacherProfile` | 教师内部档案与批准公开投影的聚合边界 | `id`, `tenant_id`, `campus_id`, `user_id`, `internal_scope`, `public_profile_ref`, `status` | 属于 User/Campus；公开投影引用 MediaAsset | 当前租户 + 校区；公开/内部字段分别授权 | L2；公开投影L0 | 内部档案与公开资料分别下架/删除；撤回公开同意即停止投影 | V0.1 规格对象；不使用真人资料 |
| `GuideArticle` | 员工新人指南 | `id`, `tenant_id`, `campus_id?`, `title`, `body_blocks`, `role_scope`, `publish_status`, `version` | 引用 MediaAsset；分类为辅助对象 | 租户内，必要时限校区/角色 | L1 | 下架后不可读取；版本和发布审计最小保留 | V0.1 规格对象；不落库 |
| `TeachingResource` | 教学资源及搜索 | `id`, `tenant_id`, `campus_id?`, `category_id`, `keywords`, `grade_scope`, `subject_scope`, `role_scope`, `publish_status` | 引用 MediaAsset/ResourceCategory | 租户、校区和岗位范围联合过滤 | L1 | 下架/过期后停止分发；保留版本与引用审计 | V0.1 规格对象；不落库 |
| `PartnerCloudLink` | 伙伴云受控快捷链接目录 | `id`, `tenant_id`, `campus_id?`, `destination_url`（存规范化HTTPS URL）, `normalized_host`, `path_policy_version`, `role_scope`, `publish_status`, `link_status`, `version` | 属于内部知识目录；保存前按批准host/path allowlist验证 | 租户内，必要时限校区/角色 | L1 | 下架或停用立即不可进入；拒绝userinfo/危险scheme，不保存外部凭据 | V0.1 规格对象；仅链接、不抓取、不接API |
| `Activity` | 公开活动列表与详情 | `id`, `tenant_id`, `campus_id`, `title`, `start_at`, `end_at`, `body_blocks`, `media_ids`, `publish_status` | 引用 MediaAsset | 当前租户与校区；公开为已发布投影 | L0/L1 | 下架停止公开；不得保留可识别学生材料 | V0.1 规格对象；模拟数据 |
| `MealPlan` | 公开餐食/食谱计划 | `id`, `tenant_id`, `campus_id`, `service_date`, `meal_period`, `dish_items`, `publish_status` | 属于 Campus | 当前租户与校区 | L0/L1 | 按内容版本保留；不得混入个人健康/过敏档案 | V0.1 规格对象；模拟数据 |
| `MediaAsset` | 文件元数据、引用与生命周期 | `id`, `tenant_id`, `campus_id?`, `storage_key`, `mime_type`, `size_bytes`, `sha256`, `usage_scope`, `status` | 被内容对象引用；可关联同意记录 | 文件前缀与授权均限租户/校区 | L1；个人素材可升L2/L3 | 默认内部；引用解除后按批准策略归档/删除；签名链接不保存 | V0.1 规格对象；无真实上传 |
| `AuditLog` | 不可由普通角色篡改的动作证据 | `id`, `tenant_id`, `campus_id?`, `actor_id`, `action`, `object_type`, `object_id`, `before_after_meta`, `result`, `occurred_at` | 引用稳定主体/对象 ID，不反向拥有正文 | 业务审计限租户/校区；平台日志分区 | L1/L2；禁止正文/密钥 | 追加、最小字段、访问受限；删除策略需兼顾审计义务 | V0.1 概念；原型仅模拟日志 |

## 3. 后续对象（合同锁定清单）

| 对象 | 用途 | 核心字段 | 关系 | 租户范围 | 敏感级别 | 保存原则 | 当前阶段是否实现 |
|---|---|---|---|---|---|---|---|
| `Student` | 机构内学生档案引用 | `id`, `tenant_id`, `campus_id`, `class_ref`, `status`, `display_ref` | 被关系、照护、任务和AI对象引用 | 租户+校区+班级/关系 | L3 | 最小字段；关系/在读状态结束后按批准流程限制、删除或去标识 | B级概念；无独立账号，不落库 |
| `GuardianRelationship` | 家长与学生的已审核授权关系 | `id`, `tenant_id`, `campus_id`, `guardian_user_id`, `student_id`, `status`, `approved_by` | 源自 BindingApplication | 租户+校区+本人关系 | L3 | 解除立即撤权；保留最小审核/解除审计 | B级概念；不落库 |
| `BindingApplication` | 家长绑定申请与审核 | `id`, `tenant_id`, `campus_id`, `applicant_user_id`, `onboarding_scope_ref`, `student_candidate_ref`, `status`, `reason_category`, `version` | 一次性OnboardingScope提交；批准后事务性创建/激活Membership并建立GuardianRelationship | 申请人只提交/查本人；审核者限服务端解析的机构/校区 | L3 | 匹配输入最小化；拒绝/撤回/过期不建关系并按策略删除非必要值 | B级概念；只做模拟流程 |
| `Attendance` | 学生出勤必要记录 | `id`, `tenant_id`, `campus_id`, `student_id`, `service_date`, `status`, `recorded_by` | 属于 Student；进入班级汇总/日报 | 租户+校区+班级/关系 | L3 | 按照护目的最小保存；更正留审计，不公开 | B级概念；不落库 |
| `LeaveRequest` | 家长请假与机构确认 | `id`, `tenant_id`, `campus_id`, `student_id`, `requester_id`, `date_range`, `reason_category`, `status`, `version` | 属于 Student/GuardianRelationship | 家长关系、教师班级或管理校区 | L3 | 原因只用必要类别；终态后按批准周期限制访问 | B级概念；只模拟状态 |
| `PickupAuthorization` | 家长创建的接送授权 | `id`, `tenant_id`, `campus_id`, `student_id`, `guardian_relationship_id`, `authorized_party_ref`, `valid_from`, `valid_to`, `status` | 约束 PickupRecord | 家长关系+校区；现场教师限职责 | L3 | 过期/撤销立即失效；避免保存多余证件影像 | B级概念；不落库 |
| `PickupRecord` | 接送核验和结果 | `id`, `tenant_id`, `campus_id`, `student_id`, `authorization_id`, `status`, `checked_by`, `occurred_at`, `incident_ref?` | 引用授权；安全异常进入 PickupException | 租户+校区+班级/关系 | L3 | 只留必要核验结果；不得在日志复制详细身份材料 | B级概念；离线 Prisma schema 有限结构已建，运行仍为本机内存模拟 |
| `PickupException` | 接送现场异常登记与跟进 | `id`, `tenant_id`, `campus_id`, `student_id`, `class_ref`, `date`, `category`, `status`, `version`, `created_by`, `reviewed_by?`, `reviewed_at?`, `outcome?` | 属于 Student/Campus；创建者和审核者引用校区成员；供 TeacherDailyReport 生成来源摘要 | 租户+校区+班级；只给授权员工 | L3 | 固定异常分类与处理结果；不保存凭证/证件/联系方式；处理结果不证明已通知 | B级概念；离线 Prisma schema 已建，运行仍为本机内存模拟 |
| `HealthIncident` | 健康/安全异常的必要事实与跟进 | `id`, `tenant_id`, `campus_id`, `student_id`, `category`, `minimal_facts`, `status`, `handled_by`, `audit_ref` | 关联照护记录、班级汇总、日报摘要 | 租户+校区+班级；管理者按范围 | L3 | 强最小化、脱敏、严格访问；禁止诊断/情绪识别/自动纪律结论 | B级概念；只模拟一般异常 |
| `WorkTask` | 教师任务与进度 | `id`, `tenant_id`, `campus_id`, `assignee_id`, `class_ref?`, `status`, `due_at`, `result`, `version` | 汇总到 TeacherDailyReport | 教师本人/班级；管理者限校区 | L1/L2；关联学生时L3 | 完成/取消保留必要工作证据；不用于自动绩效 | B级概念；离线 Prisma schema 有限结构已建，运行仍为本机内存模拟 |
| `TeacherDailyReport` / `StaffDailyReport` | 员工每日固定选项日报 | `id`, `tenant_id`, `campus_id`, `class_ref`, `date`, 五项固定选项码, `status`, `version`, 创建/审核/更新成员, `updated_at` | 五类独立来源关系保留任务、出勤、成长记录、接送及接送异常的源 ID 和版本，均由租户+校区复合外键约束 | 教师本人/班级；负责人按校区 | L2/L3 | 仅保存现有固定选项码与必要来源版本；不保存自由文本、学生身份或通知事实；不是学生托管日报 | 离线 Prisma schema 有限结构已建，运行仍为本机内存模拟 |
| `FeeRecord` | 未来费用记录边界 | `id`, `tenant_id`, `campus_id`, `subject_ref`, `period`, `amount_meta`, `status` | 可关联 Student/GuardianRelationship | 租户+校区+关系 | L2/L3 | 财务目的限定；正式保留规则后续批准 | C级结构预留；不收费、不支付、不落库 |
| `AIStudySession` | 受监督的一题式学习会话 | `id`, `tenant_id`, `campus_id`, `student_id`, `supervisor_type`, `supervisor_user_id`, `supervisor_membership_id`, `consent_id`, `consent_version`, `policy_version`, `guardian_setting_version`, `institution_setting_version`, `state`, `started_at`, `ended_at`, `safety_flags`, `cost_meta` | 拥有 AIHint/PracticeResult；引用范围匹配的GuardianConsent并生成教师摘要 | 租户+校区+班级/关系；两模式均受家长/机构开关；摘要教师专属 | L3 | 输入最小化；撤回/暂停/关闭后禁止续写；可审计并按删除请求处理 | B级概念；不调用正式模型 |
| `AIHint` | 第0—3层提示记录 | `id`, `tenant_id`, `campus_id`, `session_id`, `level`, `sanitized_input_ref`, `safe_output`, `created_at` | 属于 AIStudySession | 继承会话全部范围 | L3 | 只存必要脱敏内容；安全/删除策略与会话一致 | B级概念；模拟提示 |
| `KnowledgePoint` | 人工治理的知识点目录 | `id`, `tenant_id?`, `grade_scope`, `subject_scope`, `label`, `source_version`, `status` | 被提示/练习引用 | 平台通用或租户批准目录；不能含学生画像 | L1 | 版本化来源；停用不回写历史；禁止自动能力标签 | B级概念；小学数学范围草案 |
| `PracticeResult` | 1—3道巩固题的最小结果 | `id`, `tenant_id`, `campus_id`, `session_id`, `item_ref`, `attempt`, `result`, `created_at` | 属于 AIStudySession；进入教师摘要 | 继承会话全部范围 | L3 | 只留理解验证所需结果；不形成成绩/能力标签 | B级概念；模拟练习 |
| `GuardianConsent` | AI 学习用途的监护人同意与撤回 | id, tenant_id, campus_id, guardian_relationship_id, student_id, consent_version, notice_version, policy_version, status, version, confirmed_at, withdrawn_at? | 关联 AIStudySession 的用途守卫；同时受家长学生级与机构开关约束 | 有效本人监护关系+租户/校区+指定学生/AI 用途 | L3 | 固定本地版本分别为 LEARNING_DEMO_V2、LEARNING_SUPPORT_NOTICE_V1、AI_LEARNING_POLICY_SYNTHETIC_V1；最后一项仅为演示标识 | B级概念；离线 Prisma schema 已有基础，运行时仍为本机内存模拟，未连接数据库

## 4. A2 辅助对象与映射

这些对象只细化产品规格，不替换合同锁定清单：

| 辅助对象 | 映射/用途 | 关键字段与范围 | 当前阶段 |
|---|---|---|---|
| `TeacherPublicProfile` | `TeacherProfile` 的公开投影 | `tenant_id`, `campus_id?`, 批准公开字段、`public_consent_status`, `publish_status`; L0/L2分离 | V0.1 规格 |
| `InternalTeacherRecord` | `TeacherProfile` 的内部部分 | `tenant_id`, `campus_id`, `user_id`, `employment_scope`, `internal_notes`; L2 | V0.1 规格 |
| `DayFlow` | 一日流程内容 | `tenant_id`, 校区适用范围、有序时段、发布状态；L0/L1 | V0.1 规格 |
| `CampusPublicProfile` | Campus 的公开投影 | `tenant_id`, `campus_id`, 环境与公开联系说明；不含真实个人联系方式 | V0.1 规格 |
| `ContactIntent` | 联系/预约的原型内最小意向 | `tenant_id`, `campus_id?`, 非敏感模拟字段、确认状态 | V0.1 仅模拟；不建真实线索 |
| `PrivacyConsentRecord` | 在相应处理依据确需取得同意时，记录一个明确用途/范围的版本化授权 | `id`, `tenant_id`, `campus_id?`, `data_subject_ref`, `grantor_user_id`, `guardian_relationship_id?`, `purpose_code`, `scope`, `notice_version`, `status`, `granted_at`, `withdrawn_at?`, `audit_ref` | 主体/用途/范围版本；撤回应追加记录，不覆盖旧授权；AI用途仍使用 `GuardianConsent`，不重复存一份 | 仅有效主体或当前有效监护关系可授权对应范围 | L3 | 不预设法律依据；不得把一次同意扩展到其他目的；不存证件/完整同意正文 | R6 未来概念；不落库 |
| `PrivacyRequest` | 本人或经授权监护人提出的查阅/复制/更正/补充/删除/限制/解释请求 | `id`, `tenant_id`, `campus_id?`, `requester_user_id`, `data_subject_ref`, `guardian_relationship_id?`, `request_type`, `scope_refs`, `status`, `version`, `outcome_code`, `export_ref?`, `audit_ref`, `received_at`, `completed_at?` | 受理、核验、审查、执行、答复的单一工作流；复制结果关联 R4 `Export`，普通业务投影与 `DATA_SUBJECT_RIGHTS_COPY` 分用途 | 本人/有效关系与责任角色；跨租户/校区拒绝 | L3 | 只存必要对象引用和结果类别；身份材料/学生正文不重复落入请求或审计；不预设法定期限 | R6 未来概念；不落库 |
| `ResourceCategory` | 资源租户内分类 | `tenant_id`, `campus_id?`, `name`, `sort_order` | V0.1 规格 |
| `PublishState` | 内容状态动作记录 | `tenant_id`, `campus_id?`, 对象/版本、前后状态、操作者、审计引用 | V0.1 规格 |
| `StudentDailyCareRecord` / `CareRecord` | 单个学生每日托管记录，不替代教师工作日报 | `id`, `tenant_id`, `campus_id`, `student_id`, `service_date`, `status`, `version`；来源按 CareRecordRevision 绑定考勤、菜单计划和接送记录，保存必要来源版本；教师限班级写、家长限有效关系读 | L3；离线 Prisma 结构已含修订级类型来源快照，运行时仍用本机内存服务；菜单仅作菜单上下文，不代表学生实际食用 |
| `AIStudySummary` | 会话的教师专属最小摘要 | 会话引用、尝试次数、提示层、巩固结果、安全标记、介入建议；继承L3范围 | B级概念；正文仅授权教师 |
| `AIInstitutionSetting` / `AISettings` | 校区级机构开关源记录与家长监督状态的组合投影 | `tenant_id`, `campus_id`, `enabled=false`, `version`, `updated_by`; 投影另含家长状态/版本 | L1；AIInstitutionSetting 离线 Prisma 结构已建、机构开关默认关闭，运行时仍未接入；组合投影不替代 GuardianConsent |
| `AIDataDeletionRequest` | 独立删除工作流 | `tenant_id`, `campus_id`, 关系/学生、删除范围、`PENDING/COMPLETED/REJECTED`, 审计引用 | B级概念；与监督开关正交 |

`HomeContent`、`ClassSummary`、`AttendanceSummary` 等可作为查询投影或聚合视图，不能借此省略来源对象的租户、校区、班级、关系与敏感级别守卫。

## 5. 关系与完整性规则

1. 所有跨对象关系必须同租户；校区对象还必须属于同一租户并落入授权范围。
2. User 与业务数据之间只经 Membership、教师档案或已审核家长关系连接；知道对象 ID 不构成权限。
3. 公开教师资料与内部教师档案分别授权、发布、审计和删除。
4. 发布投影只来自合法 `PUBLISHED` 版本；下架后缓存和公开文件授权失效。
5. 教师教学摘要正文只允许当前租户、校区、授权班级内教师读取；家长通过独立投影只可读本人有效关系孩子的使用时长、完成情况、知识点摘要和已人工复核的需关注项，不得读取教师待复核材料、模型内部日志或其他学生数据；管理角色不读取摘要正文。
6. 状态转换、幂等与版本冲突按 `docs/product/STATE_MODEL.md`；本草案不增加新终态。
7. 绑定前的 `OnboardingScope` 是服务端校验一次性机构邀请码后签发的短时不透明授权，不是 Membership。它只允许提交/查询本人申请；批准事务性创建/激活家长 Membership 与关系，拒绝或过期不创建。
8. 家长与教师两种 AI 监督模式均需范围匹配、版本有效且未撤回的 GuardianConsent，并同时服从家长学生级与机构开关；撤回、暂停或关闭后禁止新会话和现有会话续写，迟到结果丢弃。

## 6. R3 数据事务、幂等与迁移契约（设计；未接入数据库）

本节把上面的概念对象与 `docs/product/STATE_MODEL.md` 的状态转换落实为未来持久层的验收条件。它不是 Prisma schema、SQL、数据库迁移或生产运行结论。当前原型的 `LocalRepository` 使用进程内 `Map`；进程重启后数据清空。其批量方法会在写入前检查重复 ID 和旧版本，但内存预校验不等于跨进程事务；审计列表也是单独追加的，不能证明业务状态与审计在崩溃时原子提交。

### 6.1 每次写入必须共同满足的规则

1. 服务端先从可信身份解析 `tenant_id`、适用的 `campus_id`、角色/成员状态及班级或已批准关系；查询与更新条件均包含可信范围。客户端提交的租户、校区和操作者字段一律忽略或拒绝。
2. 有版本的对象按 `对象ID + tenant_id + campus_id（适用时）+ 当前状态 + expected_version` 条件更新，并在同一成功提交中将版本加一。影响行数为零时按版本冲突或状态冲突拒绝；不能读取新版本后静默重试用户的旧意图。
3. 业务状态、对应版本历史、不可变审计事件及必须同步创建的关系/收据/待投递事件要么全部提交，要么全部回滚。审计至少关联可信操作者、租户/校区、对象、动作、前后版本、结果、时间及关联事件 ID；不写入密码、令牌、完整学生正文或签名链接。
4. 多对象批次先在同一事务中校验全部成员和范围，再统一写入。任一重复对象、缺失对象、越权对象、非法状态或旧版本都使整批失败；不得留下部分更新或只写一部分审计。

### 6.2 业务原子边界

| 用户动作                 | 一次原子提交内的对象                                                           | 必须拒绝或保持的结果                                                                              |
| ------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 审核通过家长绑定         | `BindingApplication` 状态/版本、`Membership`、`GuardianRelationship`、审核审计 | 已拒绝/撤回/过期申请不能建立关系；同一有效监护人—学生关系不得重复激活；任一步失败均不留下半条关系 |
| 批量保存成长记录         | 本批 `StudentDailyCareRecord` 版本与历史、逐对象审计                           | 全部对象同租户/校区并满足 expected version；一条冲突则整批不变                                    |
| 审核、发布或撤回成长记录 | 记录状态/版本、发布投影版本、审计；知悉状态按当前发布版本独立关联              | 草稿不能被家长读取；新发布版本不能沿用旧版本知悉；旧版本命令不能覆盖新状态                        |
| 处理请假、健康/接送事件  | 请求/事件状态与版本、必要的跟进对象、审计                                      | 重复终态操作不产生第二条记录；失效关系、错班级或错校区不改变数据                                  |
| 更新家长学习监督         | 学生范围内的家长设置版本、受影响活动会话的限时/关闭状态、审计                  | 关系失效后拒绝读写；关停立即阻止继续；提高限时不能自动延长已缩短的会话                            |
| 创建隐私申请或知悉回执   | 申请/回执对象及版本、审计                                                      | 重复请求不得重复生成业务对象；回执绑定当前发布版本及当前监护关系                                  |

### 6.3 幂等、并发与异步消息

- 创建类或可能因网络重试重复执行的写入使用幂等键；唯一范围至少包含可信租户、操作者/授权关系和操作类别。服务端同时保存规范化请求摘要与最终结果引用。
- 同一幂等键、同一请求摘要的再次提交返回原结果，不重复创建对象或副作用；同一键但请求内容不同则返回冲突。并发首写由唯一约束裁决，失败方读取并核对既有结果后按上述规则响应。
- 状态更新仍须带 expected version；幂等键不能替代权限检查、状态检查或对象版本检查。服务端必须先校验当前身份和对象范围，再返回已存在的结果，避免旧授权借重试键读取敏感信息。
- 实际通知不在数据库事务中直接调用微信或其他外部渠道。待正式接入后，在业务事务中记录带稳定事件 ID 的待投递项，事务提交后由独立投递器发送；记录排队、发送、送达、失败与人工跟进等不同事实，重试不得重复改变业务状态。当前没有投递器，不得展示为已发送或已送达。

### 6.4 迁移、回滚与待定参数

目标存储实施前采用兼容迁移：先扩展新结构并发布可兼容读写，再执行可重复的回填并核对数量/版本/范围，切换读路径，验证后才移除旧结构。迁移前保存并验证恢复点；每一步记录输入/输出计数、失败对象和回滚门。不可逆数据变换不得承诺自动反向回滚，应先停止切换并通过经批准的恢复或前滚修复方案处理。

物理唯一索引、外键/复合外键、事务隔离级别、锁策略、幂等键有效期、保留年限、审计留存、重试间隔、RPO/RTO 与跨区恢复能力均未在本节擅自定值。这些参数需结合正式数据库、数据用途、专业意见、成本及负责人决定后，在独立实施合同中锁定。当前没有 PostgreSQL、Prisma、备份、恢复或跨设备持久化验证。

### 6.5 后续实现验收矩阵

未来数据库切片至少须用合成数据验证：

- 两个并发请求携相同对象版本更新，恰有一个成功，另一个收到冲突；对象只增加一个版本。
- 同一幂等键和相同内容重复提交，返回同一对象；同键不同内容被拒绝；并发重复创建只产生一个对象和一组审计/副作用。
- 多对象批次中人为加入旧版本或错范围对象后，所有原对象版本及审计数量均保持不变。
- 绑定审批、成长发布、关系撤销和家长知悉等跨对象动作满足本节原子边界；业务提交失败时没有孤立关联或成功审计。
- 修改请求伪造 `tenant_id` / `campus_id`、使用已失效关系或跨班级对象都被拒绝，且错误响应不泄露其他范围的对象是否存在。
- 进程/服务重启后的数据保留、备份校验、恢复与回滚必须在真实目标存储环境单独验证；内存原型测试不得计作通过。
