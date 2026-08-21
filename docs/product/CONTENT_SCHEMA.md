# 内容字段模型

## 1. 约束与字段约定

本文定义产品级字段，不创建数据库迁移、接口或真实数据。所有示例值只能是明显虚构且标注“模拟数据”的占位内容。

### 1.1 机构内容公共字段

除特别说明外，所有机构内容对象均包含：

| 字段 | 类型/示例 | 必填 | 规则 |
|---|---|---:|---|
| `id` | 稳定不透明ID | 是 | 不使用姓名、手机号等个人信息拼接 |
| `tenant_id` | 租户ID | 是 | 未来由服务端可信注入；前端不可指定或覆盖 |
| `campus_id` | 校区ID/空 | 视对象 | 校区业务必填；机构级内容可为空 |
| `title` | 文本 | 是 | 去除脚本；长度规则后续实现阶段确认 |
| `summary` | 文本 | 否 | 公开摘要不得包含内部或学生信息 |
| `visibility` | `PUBLIC`/`INTERNAL` | 是 | 默认内部；公开需显式选择 |
| `publish_status` | `DRAFT`/`PUBLISHED`/`UNPUBLISHED` | 是 | 见 `STATE_MODEL.md` |
| `sort_order` | 整数 | 是 | 仅在同租户、同校区、同列表范围内排序 |
| `version` | 正整数 | 是 | 用于冲突检测；保存时递增 |
| `created_by` / `updated_by` | 用户ID | 是 | 只保存标识，不公开个人资料 |
| `created_at` / `updated_at` | 时间 | 是 | 统一时区存储策略在后续架构草案定义 |
| `published_at` / `unpublished_at` | 时间/空 | 否 | 与发布动作一致 |

## 2. `InstitutionProfile` 机构资料

| 字段 | 类型 | 必填 | 可见性/规则 |
|---|---|---:|---|
| 公共字段 | 见1.1 | 是 | `visibility=PUBLIC` 的已发布投影才给访客 |
| `short_name` | 文本 | 是 | 公开品牌简称；模拟数据 |
| `introduction` | 富文本块 | 是 | 机构简介 |
| `service_scope` | 文本块列表 | 是 | 服务内容与边界 |
| `education_philosophy` | 文本块 | 是 | 教育理念 |
| `culture_sections` | 有序区块列表 | 是 | 企业文化独立字段，含区块ID、标题、正文；不能只写“已并入” |
| `home_school_sections` | 有序区块列表 | 否 | 家校共育独立字段，可投影到网页首页/机构介绍 |
| `day_flow_id` | ID/空 | 否 | 引用已发布一日流程 |
| `public_contact_note` | 文本 | 否 | 仅公开联系说明，不放真实个人联系方式 |
| `appointment_notice` | 文本 | 否 | 联系/预约意向说明与隐私提示 |
| `campus_public_refs` | 校区公开投影ID列表 | 否 | 只引用同租户校区 |

**页面映射**：`A-MP-01/02/03/10`、`A-WEB-01/02`、`A-ADM-03/04`。

## 3. 教师资料的公开/内部分离

### 3.1 `TeacherPublicProfile` 对外公开资料

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| 公共字段 | 见1.1 | 是 | 只有明确批准的已发布版本公开 |
| `display_name` | 虚构展示名/称谓 | 是 | 原型使用“模拟教师A”等，不使用真人姓名 |
| `public_title` | 文本 | 是 | 对外职务称谓 |
| `public_bio` | 文本块 | 是 | 经批准的公开简介 |
| `focus_areas` | 文本标签列表 | 否 | 公开擅长方向，不形成自动能力评级 |
| `public_experience` | 文本列表 | 否 | 仅经本人/机构批准的公开经历 |
| `public_media_asset_id` | ID/空 | 否 | 原型只引用自制占位图，不使用真人照片 |
| `source_internal_teacher_id` | 内部ID | 是 | 仅内部关联，绝不公开返回 |
| `public_consent_status` | `NOT_CONFIRMED`/`CONFIRMED`/`WITHDRAWN` | 是 | 未确认或撤回时不能发布 |

### 3.2 `InternalTeacherRecord` 内部教师档案

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| `id`、`tenant_id`、`campus_id` | ID | 是 | 机构/校区隔离 |
| `user_id` | ID | 是 | 关联内部用户 |
| `employment_scope` | 结构化范围 | 是 | 岗位、校区、班级等内部范围 |
| `internal_notes` | 受限文本 | 否 | 不得复制到公开资料 |
| `credential_refs` | 受限引用列表 | 否 | 当前原型不存真实证照 |
| `status` | `ACTIVE`/`INACTIVE` | 是 | 仅内部使用 |

公开接口/页面禁止返回 `user_id`、内部备注、真实身份、联系方式、证照或内部状态。公开资料与内部档案必须分别授权、分别审计、分别删除/下架。

## 4. `DayFlow` 一日流程

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| 公共字段 | 见1.1 | 是 | 公开内容 |
| `applicable_campus_ids` | ID列表 | 是 | 必须属于同租户 |
| `segments` | 有序列表 | 是 | 每项含 `segment_id`、模拟时间标签、标题、说明、注意事项 |
| `effective_from` / `effective_to` | 日期/空 | 否 | 决定展示版本，不回溯覆盖历史 |
| `general_notice` | 文本 | 否 | 不含个人健康或学生信息 |

## 5. `Activity` 活动

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| 公共字段 | 见1.1 | 是 | 校区活动需 `campus_id` |
| `activity_start_at` / `activity_end_at` | 时间 | 是 | 结束不得早于开始 |
| `body_blocks` | 内容块列表 | 是 | 文本/自制占位媒体引用 |
| `media_asset_ids` | ID列表 | 否 | 同租户且获公开使用批准 |
| `public_participant_note` | 文本 | 否 | 不列学生姓名、照片或可识别组合信息 |
| `detail_slug` | 文本 | 是 | 同租户公开范围唯一 |

## 6. `MealPlan` 餐食与食谱

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| 公共字段 | 见1.1 | 是 | 校区业务 `campus_id` 必填 |
| `service_date` | 日期 | 是 | 仅计划日期 |
| `meal_period` | 枚举 | 是 | 如早餐/午餐/加餐；显示标签可配置 |
| `dish_items` | 文本列表 | 是 | 一般菜品说明，不关联个人 |
| `general_allergen_notice` | 文本 | 否 | 仅一般提示，不作个体诊断或医疗建议 |
| `media_asset_id` | ID/空 | 否 | 自制占位图；不含学生 |

个人过敏、健康状况或个性化膳食不是本公开内容对象字段。

## 7. `GuideArticle` 新人指南

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| 公共字段 | 见1.1 | 是 | `visibility=INTERNAL` 固定 |
| `category_id` | ID | 是 | 同租户分类 |
| `body_blocks` | 内容块列表 | 是 | 内部正文 |
| `applicable_role_ids` | 角色ID列表 | 是 | 至少一个内部角色 |
| `applicable_campus_ids` | ID列表/空 | 否 | 空表示机构内授权成员；否则限制校区 |
| `document_version` | 文本 | 是 | 可读版本号，不替代系统 `version` |
| `attachment_asset_ids` | ID列表 | 否 | 同租户、内部可见的模拟附件 |
| `acknowledgement_required` | 布尔 | 是 | 仅定义阅读确认，不作绩效评价 |

## 8. `TeachingResource` 教学资源

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| 公共字段 | 见1.1 | 是 | `visibility=INTERNAL` 固定 |
| `category_id` | ID | 是 | 支持分类筛选 |
| `keywords` | 文本标签列表 | 否 | 支持租户内搜索；不包含个人信息 |
| `body_blocks` | 内容块列表 | 是 | 资源说明/正文 |
| `grade_scope` / `subject_scope` | 标签列表 | 否 | 人工配置的适用范围，不是学生能力标签 |
| `applicable_role_ids` | 角色ID列表 | 是 | 控制员工可见范围 |
| `applicable_campus_ids` | ID列表/空 | 否 | 校区限制 |
| `resource_version` | 文本 | 是 | 显示版本 |
| `attachment_asset_ids` | ID列表 | 否 | 同租户模拟附件 |

网页端资源搜索并入教学资源页面，但字段必须支持关键词、分类、适用范围、无结果与清除条件。

## 9. `PartnerCloudLink` 伙伴云链接

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| 公共字段 | 见1.1 | 是 | `visibility=INTERNAL` 固定 |
| `label` | 文本 | 是 | 员工可理解的入口名称 |
| `destination_url` | URL占位 | 是 | 原型只用不可访问的模拟地址；不请求外部网络 |
| `description` | 文本 | 否 | 说明用途与责任边界 |
| `allowed_role_ids` | 角色ID列表 | 是 | 访问前校验 |
| `allowed_campus_ids` | ID列表/空 | 否 | 可限制校区 |
| `link_status` | `ENABLED`/`DISABLED` | 是 | 运行开关；与公共字段 `publish_status` 正交 |
| `confirmation_required` | 布尔 | 是 | 进入前显示安全确认 |

`publish_status` 控制链接记录是否发布到内部目录，`link_status` 控制已发布链接是否处于可运行状态；两者不能相互代替：

| `publish_status` | `link_status` | 员工端结果 |
|---|---|---|
| `PUBLISHED` | `ENABLED`（active） | 显示入口，权限通过并确认后才允许进入模拟提示 |
| `PUBLISHED` | `DISABLED` | 不显示可进入入口；直接路由访问返回停用 |
| `DRAFT`/`UNPUBLISHED` | 任意 | 不显示入口且拒绝进入 |

只有 `PUBLISHED + ENABLED`（active）同时成立时才可展示并进入员工端入口。禁止保存伙伴云账号、口令、Token 或 API 凭据；V0.1 只做快捷链接概念。

## 10. `MediaAsset` 媒体文件

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| `id`、`tenant_id`、`campus_id` | ID/空 | 是/视对象 | 文件按租户前缀隔离；校区素材带 `campus_id` |
| `asset_kind` | 枚举 | 是 | 图片、文档或简单SVG占位；当前不上传真实文件 |
| `original_filename` | 文本 | 是 | 原型使用中性模拟文件名，不含个人信息 |
| `storage_key` | 文本 | 是 | 必须含租户隔离前缀；不暴露真实存储凭据 |
| `mime_type` | 文本 | 是 | 未来由服务端检测，不信任客户端声明 |
| `size_bytes` | 整数 | 是 | 未来校验上限；当前仅规格 |
| `sha256` | 十六进制 | 是 | 完整性标识，不含密钥 |
| `alt_text` | 文本 | 否 | 公开图片需可理解替代文本 |
| `usage_scope` | `PUBLIC`/`INTERNAL` | 是 | 默认内部 |
| `consent_ref` | ID/空 | 否 | 涉及个人素材时必须有批准；本批次不使用真人素材 |
| `asset_status` | `AVAILABLE`/`REFERENCED`/`ARCHIVED` | 是 | 被引用时归档需警示 |
| `created_by` / `created_at` | ID/时间 | 是 | 审计字段 |

当前原型只允许自制占位图形、CSS图标和简单SVG，不发起真实上传或下载。

## 11. `PublishState` 发布状态记录

发布状态既是可发布对象的字段，也需要独立动作记录：

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| `content_type` / `content_id` | 枚举/ID | 是 | 关联同租户内容 |
| `tenant_id` / `campus_id` | ID/空 | 是/视对象 | 与内容对象一致 |
| `from_status` / `to_status` | 发布状态 | 是 | 仅允许状态模型定义的转换 |
| `content_version` | 正整数 | 是 | 防止并发覆盖 |
| `action_reason` | 文本/空 | 视动作 | 下架可要求最小原因类别 |
| `actor_user_id` | ID | 是 | 必须有发布权限 |
| `occurred_at` | 时间 | 是 | 审计时间 |
| `audit_log_id` | ID | 是 | 指向不可篡改的基础操作日志 |

公共读取只返回当前 `PUBLISHED` 投影；草稿和已下架正文不能因缓存或合并页面而公开。

## 12. `AIDataDeletionRequest` AI数据删除请求

这是 `B-FLOW-12` 的产品级操作对象，与 `AISettings` 监督开关分离；本批次只模拟状态，不删除真实数据或建立迁移。

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| `id`、`tenant_id`、`campus_id` | ID | 是 | 请求按机构/校区隔离，范围由可信身份注入 |
| `guardian_relationship_id` | ID | 是 | 必须是当前家长已通过的关系 |
| `student_ref` | 不透明ID | 是 | 只引用授权学生，不在页面回显额外身份字段 |
| `deletion_scope` | 枚举列表 | 是 | 仅列申请删除的AI会话/提示/练习结果范围，不自动扩大 |
| `request_status` | `PENDING`/`COMPLETED`/`REJECTED` | 是 | 创建时固定为 `PENDING`；只允许状态模型定义的转换 |
| `rejection_reason` | 非敏感原因类别/空 | 拒绝时 | 家长可见，用于返回监督页后修正并重提 |
| `result_notice` | 最小结果说明/空 | 完成时 | 不包含AI摘要正文或其他敏感正文 |
| `requested_by` / `requested_at` | 用户ID/时间 | 是 | 必须是关联家长并记录审计 |
| `handled_by` / `handled_at` | 用户ID/时间/空 | 处理后 | 处理者必须有本机构/校区删除工作流权限 |
| `version` / `audit_log_id` | 正整数/ID | 是 | 防重复处理、保留不可篡改的动作证据 |

请求创建后页面必须显示 `待处理`；处理完成显示最小结果，拒绝显示原因并返回监督页允许重提。监督开关的开启/暂停/关闭不改变删除请求状态，删除请求也不能被“恢复会话”覆盖。

## 13. 对象追踪

| 对象 | 主要管理页 | 主要读取页 | 关键验收 |
|---|---|---|---|
| InstitutionProfile | `A-ADM-03/04` | `A-MP-01/02/03/10`、`A-WEB-01/02` | 六项合并映射字段不丢失 |
| TeacherPublicProfile | `A-ADM-05` | `A-MP-05/06`、`A-WEB-03/04` | 公开/内部档案分离 |
| DayFlow | `A-ADM-03/04` | `A-MP-04`、`A-WEB-07` | 有序时段、空/错误状态 |
| Activity | `A-ADM-06` | `A-MP-07/08`、`A-WEB-05` | 只读已发布投影 |
| MealPlan | `A-ADM-07` | `A-MP-09`、`A-WEB-06` | 无个人健康信息 |
| GuideArticle | `A-ADM-08` | `A-MP-13/14`、`A-WEB-10` | 内部范围过滤 |
| TeachingResource | `A-ADM-09` | `A-MP-15/16/17/18`、`A-WEB-11` | 搜索合并但能力完整 |
| PartnerCloudLink | `A-ADM-10` | `A-MP-19`、`A-WEB-12` | 无API/凭据，角色受限 |
| MediaAsset | `A-ADM-12` | 各内容页引用 | 同租户、自制占位、引用安全 |
| PublishState | `A-ADM-13/14` | 全部公开/内部读取页 | 合法转换、同一投影、动作审计 |
| AIDataDeletionRequest | 后续受限处理入口 | `B-FLOW-12` | 请求待处理可见；完成/拒绝有结果；与监督开关正交 |
