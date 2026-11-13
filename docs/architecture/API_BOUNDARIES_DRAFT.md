# API 边界草案

## 1. 边界

本文只定义未来统一 API 的资源边界、示例和横切规则，不生成接口代码、OpenAPI、真实认证、外部请求或数据库迁移。示例路径是概念路径，不是已上线地址。

## 2. 请求处理顺序与权限位置

```text
入口限流/关联ID
→ 身份验证（公开接口除外）
→ Membership与当前角色解析
→ 服务端注入tenant_id及适用campus_id/班级/关系范围
→ 控制器校验输入形状
→ 应用服务校验资源、动作、对象状态与幂等
→ 仓储强制附加租户/校区范围
→ 执行事务并追加审计
→ 输出字段投影/脱敏
```

前端传入的 `tenant_id` 不参与授权；若请求体或查询参数出现并与可信上下文冲突，拒绝。界面隐藏、路由守卫和客户端角色只改善体验，不能代替服务端校验。

服务端 RequestScope 携带 `scope_version` 与不透明 `scope_fingerprint`，由 user、Membership、当前角色、租户、校区/班级、学生关系、权限及相关版本规范计算。客户端不能提交或复用自称的指纹；范围任一变化后旧指纹对应的缓存、幂等重放和 cursor 均被拒绝。

## 3. API 类别

| 类别 | 概念示例 | 主体/范围 | 边界 |
|---|---|---|---|
| 公共内容读取 | `GET /public/institutions/{publicSlug}`、`GET /public/activities` | 访客；指定机构公开投影 | 只返 `PUBLISHED + PUBLIC`，不返草稿/内部字段 |
| 员工资源读取 | `GET /staff/guides`、`GET /staff/resources?query=...` | 有效 Membership；租户/校区/岗位 | 搜索不跨租户；无权限不泄露对象存在 |
| 伙伴云目录 | `GET /staff/partner-cloud-links/{id}/entry-check` | 员工角色与范围 | 只对 `PUBLISHED + ENABLED` 返回规范化主机确认；仅批准HTTPS host/path，不代理或抓取伙伴云 |
| 管理后台内容 | `POST /admin/content/{type}`、`POST /admin/content/{id}:publish` | 机构管理员/校区负责人按范围 | 草稿、预览、发布/下架、排序、版本与审计 |
| 文件上传 | `POST /files/upload-intents`、`POST /files/{id}:complete` | 授权内容编辑者 | 后端生成 key/短时授权；校验类型/大小/hash；不公开凭据 |
| 文件下载 | `POST /files/{id}/download-intents` | 当前有效的对象读取者 | 每次按现有身份/关系/引用/版本重验；私有、单文件短时授权；不返回 COS key |
| 数据导出 | `POST /exports`、`GET /exports/{id}`、`POST /exports/{id}/download-intents`、`POST /exports/{id}:revoke` | 家长本人有效关系的 A2 投影；教师授权班级；管理者授权租户/校区 | 强制业务用途、字段允许列表、接收主体、范围/版本校验与审计；无任意表/字段导出 |
| 个人信息权利请求与用途同意 | `GET /privacy-notices/{purpose}`、`POST /privacy-consents`、`POST /privacy-consents/{id}:withdraw`、`POST /privacy-requests`、`GET /privacy-requests/{id}`、`POST /admin/privacy-requests/{id}:decide`、`POST /admin/privacy-requests/{id}:complete` | 本人/经核验的当前有效监护人；处理者限经批准的租户职责范围 | 目的/告知版本、主体和对象范围由服务端校验；复制复用 R4 Export，但与普通业务投影分用途并绑定已批准请求；拒绝需记录安全理由类别；不配置实际法定办理期限 |
| 消息投递与回执 | `GET /message-deliveries/{id}`、`POST /message-deliveries/{id}:retry`、`POST /message-deliveries/{id}:follow-up`、`POST /messages/{id}:read`、`POST /messages/{id}:acknowledge` | 接收人本人；重试/跟进仅限当前负责教师或授权校区角色 | 接收人由服务端按有效关系/职责解析；业务、投递、送达、已读、知悉和人工跟进分别记录；渠道回调须由服务端验签并去重 |
| 发布投影 | `POST /admin/content/{id}:unpublish` | 有发布权限 | 合法状态、同版本、双端读取同一投影、缓存失效 |
| 家长绑定（未来） | `POST /onboarding/binding-applications`、`GET /onboarding/binding-applications/{id}`、`POST /admin/binding-applications/{id}:approve` | 已验证User的受限OnboardingScope；审核者限租户/校区 | 服务端解析邀请范围；申请人只提交/查本人申请；批准事务性建Membership+关系 |
| 教师任务/日报（未来） | `POST /teacher/tasks/{id}:start`、`POST /teacher/daily-reports/{id}:submit` | 教师本人/班级；负责人限校区 | 状态机、自动汇总、退回/确认；不自动绩效 |
| AI 学习（未来） | `POST /ai/study-sessions`、`POST /ai/study-sessions/{id}/attempts`、`POST /ai/study-sessions/{id}/hints` | 两模式均需范围/版本匹配的监护同意+家长/机构开关；再校验关系或班级 | 服务端注入监督者引用；撤回/暂停/关闭后禁止启动和续写；学生先尝试 |
| AI 教师摘要（未来） | `GET /teacher/ai-study-summaries/{id}` | 仅授权教师 | 家长/管理员/平台管理员不得获得正文 |
| AI 删除请求（未来） | `POST /guardian/ai-deletion-requests` | 家长本人已通过关系 | 独立 `PENDING/COMPLETED/REJECTED`；与监督开关正交 |

所有写示例仅表达边界；当前不得调用。

### 3.1 家长绑定自举 API

尚无 Membership 的已验证 User 先向服务端提交一次性机构邀请码与最小匹配输入。服务端规范校验邀请码，在服务端解析候选 `tenant_id`、`campus_id` 与学生匹配范围，再签发短时、不透明、一次性 `OnboardingScope` token；客户端传入的租户、校区或学生 ID 一律不可信。

该 token 只授权 `POST /onboarding/binding-applications` 与申请人本人状态查询，不能读取学生档案、列出候选或查询其他申请。无效、过期、错租户、未匹配和无权限使用通用响应防枚举。审核批准必须在同一事务内创建/激活家长 Membership、建立 `GuardianRelationship`、完成申请并消费 token；拒绝、撤回或过期不创建 Membership/关系。

### 3.2 伙伴云 URL 控制

管理写入使用标准 URL 解析器规范化 scheme、主机、端口与 path，仅接受 `https`，且规范化主机与 path 前缀必须命中逐项批准的 allowlist。拒绝 userinfo、未批准端口、混淆/空主机、路径逃逸，以及 `javascript:`、`data:`、`file:` 等非 HTTPS scheme；query/fragment 默认拒绝，只有明确允许的参数才可保留。

服务端只保存和返回验证后的规范化 URL，不抓取目标内容、不代理请求、不为“验证”盲随重定向。确认页必须显示规范化主机并提示即将离开本系统；配置新增、主机/path/策略版本变更、启用/停用与进入确认均记录最小审计，日志不保留潜在凭据或完整敏感 query。

### 3.3 文件上传、读取与导出意图

以下均为未来 API 契约示例，不表示已有运行时路由。

- `POST /files/upload-intents` 只接收业务用途、目标对象引用、申报类型、字节数和内容摘要；服务端从可信 Membership 注入租户/校区与可用目录，检查角色、对象状态、允许列表和大小后才签发单对象、单动作上传授权。
- `POST /files/{id}:complete` 重验当前授权和对象范围，并核对实际文件签名、大小、SHA-256 与扫描状态；只有全部通过才将对象转为可引用。重复完成按 R3 幂等规则返回原结果；异载荷、过期授权、状态变化或范围变化则拒绝。
- `POST /files/{id}/download-intents` 不接受客户端 COS key；服务端先确认当前对象/业务版本仍可读，再签发 5 分钟单文件只读授权。公开文件也必须来自当前已发布投影。
- `POST /exports` 只接收已批准的用途、目标记录引用、时间范围、格式和接收主体；普通业务导出字段由服务端角色投影决定，家长业务导出仅含使用时长/完成情况/知识点摘要/经人工复核的需关注项。个人信息复制只能使用 `DATA_SUBJECT_RIGHTS_COPY` 用途并绑定已批准的 `privacy_request_id`，由服务端按申请主体/当前有效监护关系解析范围和可复制类别；它不受 A2 日常业务摘要四字段限制，但仍遵守本项目家长可见边界，不含其他学生信息、模型内部日志或教师待复核材料，类别与例外须经专业审阅。两种用途均不得接收任意字段、表名、查询表达式、租户 ID 或校区 ID；服务端重验主体、关系/班级范围和数据版本后创建导出任务并返回不透明任务 ID。
- `GET /exports/{id}` 仅向申请主体或明确授权的处理角色返回最小状态。`POST /exports/{id}/download-intents` 在下载时再次验证任务归属、主体权限、关系/成员状态、数据版本和期限，再签发 5 分钟私有链接；`POST /exports/{id}:revoke` 停止未来签发并清理应用侧引用。已经发出的链接按供应商实际能力和有效期处理，不承诺超出 5 分钟上限的即时撤销。
- 任何失败均返回安全错误状态，不产生可下载文件、不静默截断、不回退到公开存储。导出最大行数、生成时长、结果体积和临时文件保留时长需在实际实现合同中锁定；未锁定前不接入真实导出。

### 3.4 消息投递、读取与知悉回执

以下仅是未来 API 边界，不表示当前已有消息路由或外部发送：

- 业务服务在提交业务状态时，同一事务写入稳定事件 ID 和待投递记录；独立投递器在事务完成后调用服务端渠道适配器。业务事件提交与渠道发送分离，不能因渠道失败回滚已完成的业务操作，也不能把业务成功当作投递成功。
- 接收人列表、渠道、租户/校区和消息字段由服务端按事件类型、可信 Membership、负责班级、当前有效监护关系及用途规则生成。客户端不提交接收人 ID、手机号、租户/校区 ID、模板或任意正文。每个接收人单独生成投递状态和回执边界。
- `GET /message-deliveries/{id}` 只向当前接收人本人或有职责的跟进角色返回安全状态。`POST /message-deliveries/{id}:retry` 只允许当前授权处理者对符合重试条件的失败项发起有界重试；`POST /message-deliveries/{id}:follow-up` 记录人工跟进状态与安全结果类别，不覆盖投递历史。
- `POST /messages/{id}:read` 只在当前接收人已授权打开消息时记录读取；`POST /messages/{id}:acknowledge` 必须携带该消息引用的业务对象版本和明确确认动作。两个操作不可互相替代，也不改变成长记录、请假等业务状态。
- 渠道回调只进入服务端内部适配器；实际路由和供应商签名机制待未来合同确定。适配器在验签后按事件 ID、渠道消息 ID、接收人和业务版本去重；未知、跨范围、伪造或迟到回调不能提升/倒退状态。没有渠道送达证据时不得返回 `DELIVERED`。
- 发送前重新验证对象版本、成员/关系、班级职责和渠道授权；撤权或对象撤回后取消未发送项。已送达消息不能承诺外部撤回。家长仅能读取本人有效关系允许的安全投影；消息/回执与人工跟进记录不得暴露其他学生、教师待复核正文或敏感判断。
- 投递、接收回执、重试和跟进均按 R3 幂等/版本原则处理并记录最小审计；临时故障采用有界重试，永久拒绝或耗尽转授权人工跟进。具体次数、间隔、时限、供应商及费用留待实际条件确认，不在本草案中虚构。

### 3.5 个人信息权利请求与用途同意

以下仅定义未来边界，不是当前运行时接口或正式隐私政策：

- `GET /privacy-notices/{purpose}` 只返回经过负责人/专业人员批准的当前告知版本、适用目的和生效状态；没有真实主体/联系方式/接收方/期限等必要信息时，不发布可供真实用户确认的版本。
- `POST /privacy-consents` 只在该用途依法/经专业审阅确定采用同意作为处理依据时使用，记录用途、最小范围、告知版本、授权主体/经核验监护关系和明确动作。不能因为请求里带了 `tenant_id`、`campus_id` 或 `student_id` 就扩大授权；服务端由可信身份和关系解析范围。
- `POST /privacy-consents/{id}:withdraw` 仅允许当前主体或对该范围有有效权限的监护人撤回，追加不可覆盖的撤回事实并立即停止依赖该同意的后续处理。撤回动作不自动代表关联数据已全部删除；数据删除必须走独立权利请求和保存依据评估。
- `POST /privacy-requests` 接收 `ACCESS/COPY/CORRECT/DELETE/RESTRICT/EXPLAIN` 等受控请求类型及最小对象引用，不接收任意 SQL、字段列表、租户/校区 ID 或未核验的学生 ID。服务端只创建本人/有效关系范围内的请求，并返回不透明 request ID。
- `GET /privacy-requests/{id}` 仅向申请人本人或当前有效且匹配范围的监护人返回状态和安全结果摘要。状态为 `RECEIVED`、`VERIFICATION_PENDING`、`IN_REVIEW`、`NEEDS_CLARIFICATION`、`APPROVED`、`REJECTED`、`IN_PROGRESS`、`COMPLETED`；所有动作带版本和幂等约束，不预设法律规定的办理期限。
- `POST /admin/privacy-requests/{id}:decide` 与 `:complete` 只允许未来获批准的租户受理职责执行。拒绝/部分完成写入受控理由类别；完成前核对相关来源、衍生对象、缓存、文件/导出副本、受托方和备份状态。受理角色/复核人及期限待实际治理确认；平台管理员不因接口存在自动获得学生正文权限。
- `ACCESS/COPY` 的交付复用 R4 `POST /exports`、状态和下载意图，不复制一个绕过 R4 的临时文件通道；普通业务导出继续使用角色投影，个人信息复制以 `DATA_SUBJECT_RIGHTS_COPY` 和已批准的 `privacy_request_id` 单独授权，服务端解析范围并复用 R4 私有存储、5 分钟下载授权、撤销和审计。`CORRECT` 进入对应业务对象的核实/更正流程并保留必要版本审计；`DELETE/RESTRICT` 先撤销未来访问/任务，再按保存义务、技术能力和副本清单执行。因保存期限或技术限制不能立即完成时只保留必要保护性存储并显示待处理原因，不把“已受理”伪装成“已删除”。
- 个人信息权利请求与已有 `POST /guardian/ai-deletion-requests` 分离；Membership 停用、监护关系解除、AI 监督关闭、R4 导出撤销和 R5 消息撤回边界按各自契约执行，不互相替代。

## 4. 输入与输出

- 输入使用稳定不透明对象 ID，不用姓名、手机号或租户 ID 拼接。
- 字段采用允许列表；未知敏感字段拒绝或丢弃并记录安全事件，不能透传给日志/AI。
- 输出按角色与对象投影。公开教师只返批准字段；内部/学生/AI 正文不因对象序列化而意外外泄。
- 时间统一使用带时区的标准格式；最终存储时区策略在正式设计确认。
- 文件和 AI 响应不返回供应商凭据、内部对象键或长期签名 URL。

## 5. 错误格式

概念错误包：

```json
{
  "error": {
    "code": "FORBIDDEN_SCOPE",
    "message": "无法执行此操作",
    "request_id": "simulated-request-id",
    "details": []
  }
}
```

`details` 只放可安全修正的字段错误。建议错误码：`VALIDATION_ERROR`、`UNAUTHENTICATED`、`FORBIDDEN_SCOPE`、`NOT_FOUND_OR_FORBIDDEN`、`STATE_CONFLICT`、`VERSION_CONFLICT`、`SCOPE_STALE`、`IDEMPOTENCY_CONFLICT`、`RATE_LIMITED`、`DEPENDENCY_UNAVAILABLE`、`SAFETY_BLOCKED`。对敏感对象，未找到与无权限不得泄露差异。

## 6. 幂等与版本冲突

- 创建关系、提交绑定、文件上传意图/完成、导出申请、隐私请求/同意撤回、状态终态动作、AI 会话开启和删除请求等写操作使用由服务端限制范围的幂等键。
- 幂等记录键至少绑定环境、当前 `scope_fingerprint`、动作和请求摘要；同键不同载荷或范围变化返回冲突，不能用旧范围重放。
- 更新带对象 `version` 或等价条件写；版本冲突拒绝覆盖并返回最新安全状态。
- 重试不能重复建立关系、重复发布、重复生成摘要或重复收费。当前没有支付接口。

## 7. 分页、筛选与排序

列表优先使用服务端签名的不透明 cursor，返回 `items` 与 `next_cursor`，并固定稳定排序键。cursor 绑定当前 `scope_fingerprint`、filter 摘要、sort 摘要、最后位置、数据/策略版本和 expiry；任一范围/版本变化或过期都返回 `SCOPE_STALE` 并要求重新开始。筛选、搜索和排序都在可信租户/校区范围内执行；客户端不能用大页、旧 cursor 或排序字段绕过范围。管理列表的业务 `sort_order` 变更是受审计写操作，与 API 列表查询排序参数不同。

## 8. 审计

发布/下架/排序、角色分配、绑定审核/解除、接送核验、异常处理、日报确认/退回、文件上传意图/完成校验/引用变更/下载授权/撤销/删除、业务导出申请/生成/下载授权/撤销/过期/失败、个人信息复制申请/生成/下载授权、隐私告知版本/同意/撤回、个人信息权利请求/决定/执行/受限删除待办、消息事件/接收人解析/尝试/渠道回执/重试/读取/知悉/人工跟进、AI 会话/转教师/删除请求以及跨租户支持例外必须审计。审计含主体、Membership、可信租户/校区范围、用途、对象或任务 ID、策略/字段版本、动作、结果、时间和请求关联 ID；不记录密钥、令牌、签名 URL、接收人联系方式、证件材料、文件/学生正文或 AI 原始正文。

## 9. 外部适配器与降级

微信、COS、AI Provider 等只能由服务端适配器调用，并有环境隔离、超时、重试上限与安全降级。伙伴云当前不设 API 适配器，只返回受控快捷链接确认状态。外部依赖不可用时返回 `DEPENDENCY_UNAVAILABLE` 或进入 AI 转教师路径，不伪造成功、不回退到其他租户缓存。

## 10. 非范围

当前不定义生产域名、完整 REST/GraphQL 选型、令牌格式、具体速率、正式状态码映射、SDK、OpenAPI、Webhook、支付、伙伴云 API、模型供应商或任何实现。这些需后续任务按真实约束批准。
