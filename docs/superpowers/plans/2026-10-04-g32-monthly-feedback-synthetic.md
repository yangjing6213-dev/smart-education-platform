# TASK20 / G3.2 月度反馈合成实施合同

- 版本：2026-10-04
- 需求依据：C:/Users/HU/Desktop/同芯机构项目/开发方案/student-care-platform-complete-plan-v2.0.pdf
- 当前目标：在现有合成共享服务上补齐“来源汇总 → 教师固定项补充 → 负责人确认 → 家长限定摘要”的月度反馈最小闭环。
- 运行边界：只使用明显标注的合成数据和内存会话；不接入真实认证、真实未成年人、真实通知、数据库、伙伴云、正式 AI、文件存储或外部网络；不安装依赖、不改 lockfile、不提交、不推送、不部署、不发布。
- 产品边界：不自动生成能力、纪律、心理或成绩标签；不把内部原文直接投影给家长；来源撤回、范围变化或版本过期时，家长摘要立即失效并要求负责人复核。

## 1. 最小行为

1. 教师只能查看当前租户、校区和班级范围内的固定来源摘要：已发布成长记录、已确认考勤概览和已确认工作日报状态；来源仅显示必要的日期与固定标签，不包含自由文本。
2. 教师用固定选项补充月度反馈，不开放自由文本。补充项固定为：学习参与、日常习惯、活动参与、家校协作；每项只有“保持关注 / 已有进步 / 需要跟进”。
3. 教师提交后，负责人只能在同一范围内确认或退回；每次提交、退回、确认都递增版本并记录本机审计动作。
4. 负责人确认后另建家长摘要，只显示固定摘要项和月份，不显示内部来源编号、教师内部备注或审核意见；家长只能读取与已批准关系匹配的摘要并确认知悉。
5. 任何来源版本变化、来源撤回、租户/校区/班级不匹配或旧版本操作都使摘要进入 `REVIEW_REQUIRED`，不得继续展示为有效家长摘要。

## 2. 精确写集

### 共享本地服务 worktree

路径：C:/Users/HU/.codex/worktrees/task20-local-shared-core

- packages/contracts/src/monthly-feedback.ts
- packages/contracts/src/index.ts
- apps/api/src/local-synthetic/repository.ts
- apps/api/src/local-synthetic/sessions.ts
- apps/api/src/local-synthetic/routes.ts
- apps/api/src/local-synthetic/server.ts
- apps/api/src/local-synthetic/monthly-feedback.service.ts
- apps/api/test/local-synthetic-monthly-feedback.test.ts
- tests/local-synthetic/monthly-feedback.test.mjs
- docs/exec-plans/active/monthly-feedback-core.md

### 用户网页 worktree

路径：C:/Users/HU/.codex/worktrees/task20-web-completion

- apps/user-web/src/local-synthetic/client.ts
- apps/user-web/src/local-synthetic/monthly-feedback.ts
- apps/user-web/src/local-synthetic/monthly-feedback.test.ts
- apps/user-web/src/main.ts
- apps/user-web/src/styles/user-web.css
- apps/user-web/test/monthly-feedback-browser.mjs
- docs/exec-plans/active/web-monthly-feedback.md

### 管理网页 worktree

路径：C:/Users/HU/.codex/worktrees/task20-admin-completion

- apps/admin-web/src/main.ts
- apps/admin-web/src/local-review/monthly-feedback.ts
- apps/admin-web/src/local-proxy.mjs
- apps/admin-web/preview.mjs
- apps/admin-web/test/monthly-feedback.test.mjs
- docs/exec-plans/active/admin-monthly-feedback.md

### 微信小程序 worktree

路径：C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign

- apps/mini-program/pages/staff/quick-action/index.ts
- apps/mini-program/pages/staff/quick-action/index.wxml
- apps/mini-program/pages/staff/quick-action/index.wxss
- apps/mini-program/pages/staff/quick-action/index.js（仅编译确有变化时）
- apps/mini-program/src/pages/monthly-feedback.ts
- apps/mini-program/src/pages/monthly-feedback.test.ts
- docs/exec-plans/active/mini-monthly-feedback.md

受保护文件：`apps/mini-program/src/pages/staff.test.ts`、`app.json`、所有 `index.json`、根配置、依赖和 lockfile 不得修改。

## 3. 实施与验证顺序

1. 先为共享服务写失败测试：固定来源、固定补充项、同范围校验、版本冲突、来源变化使摘要失效、家长只读限定摘要。
2. 实现内存服务和路由，再接通 Web、Admin 和 Mini；前端只传对象版本与固定值，不传租户或校区作为授权依据。
3. 每端增加页面级验证：教师创建/提交、负责人确认/退回、来源变更后复核、家长读取并确认；断言不出现自由文本和外部请求。
4. 仅在生成内容确有变化时更新 `index.js`；运行类型检查、focused tests、浏览器 smoke、Mini runtime、ESLint、Prettier、`git diff --check` 和范围审计。

## 4. 验收标准

- 服务覆盖创建、提交、确认、退回、重提、摘要生成、摘要失效和旧版本拒绝；家长越权读取失败。
- Web/Admin browser smoke 完成教师→负责人→家长三角色流程；无页面错误、无外部请求、无内部原文泄露。
- Mini typecheck、页面测试和页面注册/生成护栏通过；原生微信开发者工具未实点时必须保持 `NATIVE_NOT_RUN`。
- 写集之外无新增或修改；不得以复制旧 JS、降低断言或跳过范围检查代替实现。

## 5. 停止条件

发现需要修改合同写集外文件、增加路由或配置、接入真实服务/数据、安装依赖、修改 `staff.test.ts`/`app.json`/`index.json`，或必须把内部原文发送给家长时，停止在审计状态并记录原因。

