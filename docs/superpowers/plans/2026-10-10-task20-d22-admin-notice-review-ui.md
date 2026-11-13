# TASK20 D22 Admin 通知审核与家长确认闭环

- 任务标识：`TASK20_D22_ADMIN_NOTICE_REVIEW_UI`
- 状态：`PASS_LOCAL_SYNTHETIC; OWNER_REVIEW_PENDING; WECHAT_NATIVE_REVIEW_NOT_RUN`
- 依据：项目方案的通知审核/知悉要求、V3 G2.5、既有 G2.5 本机合成服务与 Mini 页面流程。
- 基线发现：共享服务已支持通知提交、负责人审核、发布、撤回与家长独立阅读/确认；Mini Page 已有员工与家长通知操作。主工作树 Admin 导航、审核模块和本地预览代理没有通知审核入口，负责人无法在管理网页实际处理同一条待审通知。
- 目标：增加简洁的 Admin 通知审核页；在同一条本机合成通知上验证 Mini 员工提交 → Admin 负责人审核/发布 → Mini 家长查看并确认。不得把本机发布描述为真实送达。
- 设计约束：沿用 Admin 现有导航、卡片、操作按钮、角色/权限和状态提示；仅展示固定模板已有内容、模拟提交人和授权校区/班级范围；审核与发布分两步，页面提供刷新、空队列、失败、只读和无权限状态。

## 精确写集

1. `apps/admin-web/src/local-review/notice-shared.ts`（新建）：本机回环客户端、严格会话/范围/版本校验、通知审核页渲染。
2. `apps/admin-web/src/main.ts`：接入 Admin 导航、通知审核路由与按钮事件。
3. `apps/admin-web/src/local-proxy.mjs`：仅为现有通知队列/历史及审核、发布、撤回接口增加精确本机代理白名单。
4. `apps/admin-web/test/notice-shared.test.mjs`（新建）：通知页状态/动作/范围测试、代理白名单测试及 Admin 预览浏览器点击。
5. `tests/mini-shared-service.test.mjs`：增加 Mini 实际员工/家长 Page 与 Admin 实际通知客户端共用同一通知 ID/版本的本机流程。
6. `PLANS.md`：记录 D22 状态、验证和剩余原生门禁。
7. `docs/exec-plans/active/project-completion.md`：追加 D22 已验证事实及未完成事项。
8. `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`：核对并更新 G2.5 的 Admin UI 与下一目标状态。
9. 本合同。

## 禁止项

- 不修改 API、合同、数据库、Mini 页面、User Web、生成 JS、应用配置或 UI 设计系统；共享 API 已有路由作为唯一服务端实现复用。
- 不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 不接入真实身份、儿童/机构资料、网络通知、外部服务、持久化、正式 AI 或真实发布。
- 不安装依赖、不修改 lockfile，不改 Windows/转储/分页设置。
- 不清理或覆盖其他现场；不提交、推送、部署或发布。
- 微信开发者工具当前连接错误仍保持未复试；本轮仅做 Admin 浏览器点击和自动化 Mini Page 验证，不声称微信原生验收。

## 验收与验证

- Admin 页面读取并严格限定 `owner-east` 固定合成身份、当前租户/校区/班级；拒绝 malformed、越界、重复或过期数据/动作，非授权模式不可编辑。
- Admin 浏览器实点可见“待审核通知”→“确认通过”→“发布给家长”→“撤回发布”；通过真实 Admin 客户端的本机预览代理调用已有服务端路径，页面无错误、失败请求、外网访问或横向溢出。
- Mini 员工实际页面提交一条固定模板后，Admin 实际客户端从共享服务读到同一 ID/版本并完成审核/发布；Mini 家长实际页面看到同一 ID/新版本，独立完成阅读和确认。家长只会看到已发布记录；旧版本动作不产生写请求。
- 运行 Admin focused tests、Admin typecheck/build、Mini shared-service 测试源码与生成 JS 两模式、Mini typecheck、目标 ESLint/Prettier、页面注册护栏、`git diff --check`、精确路径范围审计和 lockfile 指纹审计。
- 原生微信完整通知流程继续单独记录为 `NOT_RUN`，直到工具交互连接恢复；不得将网页浏览器点击或自动测试当成原生验收。

## 执行记录

- 开工前已检查根 `AGENTS.md`、G2.5 路线合同、D16/D21 证据、Admin 现有审核页/代理及 Notice 服务端接口；未读取保护测试。
- `frontend-design` 与 `frontend-design-review` 采用 Admin 既有信息层级、绿色品牌和轻量审核页面；TDD 先补红测再实现，完成前按本合同复核。
- 结果：Admin 聚焦测试 `6/6`、全量测试 `116/116`、typecheck/build/ESLint 通过；Mini 共享服务流程源码与生成 JS 各 `9/9` 通过；Mini typecheck、注册护栏和 `git diff --check` 通过。Prettier API 核验新文件和本次编辑代码块通过；全文件已有格式漂移的文件未整文件重排。CLI 入口因首字符异常不能启动，未安装或修改依赖。
- 浏览器实点覆盖负责人审核、发布与撤回；跨端同一 ID/版本覆盖 Mini 员工提交、Admin 审核发布、Mini 家长阅读确认。无页面错误、失败响应、外网请求或 390px/1365px 横向溢出。真实通知不发送。
- 范围与指纹审计：仅合同 9 路径；lockfile SHA-256 `01BCB5E41D0E3C786F5EACF933791BAB767ACF17B4487D919C04BB2582F4CD64` 不变；受保护测试未读取、运行或修改。微信开发者工具实点仍 `NOT_RUN`，不影响本机合成闭环，但不能据此宣称原生验收。
