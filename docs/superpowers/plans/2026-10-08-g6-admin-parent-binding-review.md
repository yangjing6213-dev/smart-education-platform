# TASK20_G6_ADMIN_PARENT_BINDING_REVIEW

**日期：** 2026-10-08  
**状态：** `AUTHORIZED_AUTONOMOUS_LOCAL_SYNTHETIC_IMPLEMENTATION`  
**授权依据：** 负责人已委托自主完成本地功能开发；当前 `AGENTS.md` 要求先记录精确写集、在隔离工作树实施并验证。  
**需求依据：** `student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`，重点核对第 16、35、55、56 页。  
**实施工作树：** `C:\Users\HU\.codex\worktrees\task20-g6-parent-admin-fees-entry`。  
**前置发现：** 共享本机服务已有按负责人能力与校区范围过滤的家长关系审核接口；当前主工作树 Admin Web 没有独立可达的审核页面。既有管理工作树含其他未提交页面与测试，本任务只在其精确写集内增加本功能。

## 目标

在机构管理网页新增“家长关系审核”入口，使负责人可查看当前授权校区范围内的合成关系申请，并经明确确认后通过或拒绝申请。页面必须使用现有会话、权限和关系审核接口；关系提交后家长可在原家长页面查看状态。仅本机合成数据，不宣称已满足正式机构审核、真实身份核验或法定留痕要求。

## 精确写集

### 隔离工作树内产品与测试文件

- `MODIFY apps/admin-web/src/main.ts`：增加 `/admin/binding-review` 导航、路由、页面连接和离页清理；不替换现有管理页面。
- `CREATE apps/admin-web/src/local-review/binding-review.ts`：loopback-only 客户端、严格响应解析、固定合成负责人、服务端权限确认、范围数据加载与版本化审核。
- `CREATE apps/admin-web/src/pages/binding-review.ts`：中文队列页面、状态与校区/班级摘要、显式审核确认和可访问状态提示；不渲染内部编号。
- `CREATE apps/admin-web/test/binding-review.test.mjs`：固定角色、权限拒绝、范围、异常响应、确认门槛、版本化通过/拒绝、断开连接和无外网行为测试。
- `CREATE apps/admin-web/test/binding-review-browser.mjs`：本地浏览器流程；仅对一次性 4319 内存服务执行写操作，结束时关闭并丢弃数据；对现有 4317 只允许只读 smoke。

### 主工作树治理文件

- `MODIFY PLANS.md`：记录合同 SHA、来源比较、验证结果、仍未完结的人工/正式审核证据及当前数据服务状态。
- `CREATE docs/superpowers/plans/2026-10-08-g6-admin-parent-binding-review.md`：本合同。

以上路径是完整写集；隔离工作树已经存在的其他修改均保持不变。

## 明确限制

- 只允许固定演示身份 `owner-east` 与 `owner-west`，不接受页面或 URL 自行指定租户、校区或班级范围；权限与范围以服务端会话为准。
- 只请求 `http://127.0.0.1`/`localhost` 的 `/local/sessions`、`/local/session`、`/local/binding-applications`、`/local/binding-applications/:id/review`；无其他网络请求。
- 仅展示已由服务端投影的虚构监护人称呼、学生别名、关系、校区、班级和申请状态；不显示学生或关系内部 ID、手机号、微信号、真实姓名或真实申请人资料。
- 批准/拒绝必须有显式确认，并携带服务端返回的版本号。错误、权限拒绝、过期版本不得显示成功。
- 现有审核 API 不接收拒绝理由，也不提供审核人显示名或审计时间。本任务不得伪造这些证据；它们将继续列为正式方案的未完成项。
- 不改 API、Mini、User Web、数据库、真实认证、持久化、配置、依赖或 lockfile；不读取或修改受保护的 `apps/mini-program/src/pages/staff.test.ts`；不修改主工作树产品代码；不提交、推送、部署或发布。
- 4317 当前运行实例不得重启、清空或写入；通过/拒绝等浏览器写流程只可在一次性 4319 服务完成并随后关闭。

## 验收与验证

1. 先新增 focused 测试并确认缺少页面/客户端时测试失败，再实现。
2. 运行 Admin focused tests、typecheck、ESLint、目标文件 Prettier、`git diff --check` 与精确写集审计。
3. 在临时 Admin 预览和一次性 4319 服务执行真实本机浏览器流程：提交合成关系、负责人审核、家长刷新查看；用两个负责人会话检查校区隔离；断言无外网请求、无页面错误。
4. 对 4317 仅做页面读取 smoke，不执行批准、拒绝、撤回、清空或重启。
5. 把通过的最小页面增量逐文件选择性整合到主工作树，保留该树所有已有修改，并重跑 Admin focused tests、typecheck、ESLint、Prettier、`git diff --check` 与范围审计。
6. 人工负责人/机构验收、原生微信开发者工具点击、正式身份与审计字段仍分别记录 `NOT_RUN` 或 `PENDING`，不得用自动测试代替。

## 停止条件

若现有服务不能保证服务端校区隔离，若要修改本合同写集外路径才能完成，或遇到未知真实资料、真实服务/持久化、依赖变化要求，停止相应部分并报告证据；不得放宽权限断言、覆盖其他工作树现场或改用 4317 写测试数据。
