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

- 创建关系、提交绑定、文件完成、状态终态动作、AI 会话开启和删除请求等写操作使用由服务端限制范围的幂等键。
- 幂等记录键至少绑定环境、当前 `scope_fingerprint`、动作和请求摘要；同键不同载荷或范围变化返回冲突，不能用旧范围重放。
- 更新带对象 `version` 或等价条件写；版本冲突拒绝覆盖并返回最新安全状态。
- 重试不能重复建立关系、重复发布、重复生成摘要或重复收费。当前没有支付接口。

## 7. 分页、筛选与排序

列表优先使用服务端签名的不透明 cursor，返回 `items` 与 `next_cursor`，并固定稳定排序键。cursor 绑定当前 `scope_fingerprint`、filter 摘要、sort 摘要、最后位置、数据/策略版本和 expiry；任一范围/版本变化或过期都返回 `SCOPE_STALE` 并要求重新开始。筛选、搜索和排序都在可信租户/校区范围内执行；客户端不能用大页、旧 cursor 或排序字段绕过范围。管理列表的业务 `sort_order` 变更是受审计写操作，与 API 列表查询排序参数不同。

## 8. 审计

发布/下架/排序、角色分配、绑定审核/解除、接送核验、异常处理、日报确认/退回、文件授权/删除、AI 会话/转教师/删除请求以及跨租户支持例外必须审计。审计含主体、可信范围、动作、对象、前后状态、结果、时间和请求关联 ID；不记录密钥、令牌、签名 URL、学生正文或 AI 原始正文。

## 9. 外部适配器与降级

微信、COS、AI Provider 等只能由服务端适配器调用，并有环境隔离、超时、重试上限与安全降级。伙伴云当前不设 API 适配器，只返回受控快捷链接确认状态。外部依赖不可用时返回 `DEPENDENCY_UNAVAILABLE` 或进入 AI 转教师路径，不伪造成功、不回退到其他租户缓存。

## 10. 非范围

当前不定义生产域名、完整 REST/GraphQL 选型、令牌格式、具体速率、正式状态码映射、SDK、OpenAPI、Webhook、支付、伙伴云 API、模型供应商或任何实现。这些需后续任务按真实约束批准。
