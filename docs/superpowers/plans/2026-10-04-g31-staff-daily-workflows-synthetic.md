# TASK20 / G3.1 员工日常工作流合成实施合同

- 版本：2026-10-04
- 需求依据：C:/Users/HU/Desktop/同芯机构项目/开发方案/student-care-platform-complete-plan-v2.0.pdf
- 当前目标：补齐员工工作台“待办任务 → 内部工作日报 → 负责人审核”的最小闭环，并把家长可见内容与内部原文严格分离。
- 运行边界：只使用明显标注的合成数据和内存会话；不接入真实认证、真实未成年人、短信/微信通知、数据库、伙伴云、正式 AI、文件存储或外部网络；不安装依赖、不改 lockfile、不提交、不推送、不部署、不发布。
- 证据要求：代码、自动测试、本地浏览器/HTTP、微信开发者工具原生点击四层分别记录；自动化通过不等于原生验收通过。

## 1. 目标与最小产品行为

1. 员工教师可在工作台看到同租户、同校区、同班级范围内的固定任务：
   - 完成接送登记；
   - 填写内部工作日报；
   - 处理待审核成长记录、请假、健康异常和通知。
2. 教师可以用固定选项创建“内部工作日报草稿”，补齐后提交审核；负责人可以看到待审核队列，确认或退回；退回后教师可重填并再次提交。
3. 内部日报原文仅对教师和负责人可见，不能出现在家长成长记录、通知或健康摘要中；家长侧只保留已有已发布对象。
4. 所有动作携带服务端返回的对象版本；租户、校区、班级和角色范围由本地合成会话服务端判断，前端传入的范围字段不作为授权依据。
5. 任务队列只做内存合成投影，刷新可重新拉取；不宣称实时推送和跨设备持久化。

固定日报字段（不得自由输入）：

- 到校状态：按计划到校 / 迟到 / 未到；
- 作业整理：已完成整理 / 正在完成 / 需要协助；
- 活动参与：参与活动 / 观察活动 / 未记录；
- 班级秩序：日常状态 / 需要老师留意 / 需要后续跟进；
- 今日后续：无需跟进 / 明日继续观察 / 交负责人关注。

状态：DRAFT → SUBMITTED → CONFIRMED，退回为 RETURNED；确认后可被负责人撤回到退回态，但不得修改已发布家长记录。

## 2. 精确写集

### 共享本地服务 worktree

路径：C:/Users/HU/.codex/worktrees/task20-local-shared-core

- packages/contracts/src/staff-daily.ts
- packages/contracts/src/index.ts
- apps/api/src/local-synthetic/repository.ts
- apps/api/src/local-synthetic/sessions.ts
- apps/api/src/local-synthetic/routes.ts
- apps/api/src/local-synthetic/server.ts
- apps/api/src/local-synthetic/staff-daily.service.ts
- apps/api/test/local-synthetic-staff-daily.test.ts
- tests/local-synthetic/staff-daily.test.mjs
- docs/exec-plans/active/staff-daily-core.md

### 用户网页 worktree

路径：C:/Users/HU/.codex/worktrees/task20-web-completion

- apps/user-web/src/local-synthetic/client.ts
- apps/user-web/src/local-synthetic/staff-daily.ts
- apps/user-web/src/local-synthetic/staff-daily.test.ts
- apps/user-web/src/main.ts
- apps/user-web/src/styles/user-web.css
- apps/user-web/test/staff-daily-browser.mjs
- docs/exec-plans/active/web-staff-daily.md

### 管理网页 worktree

路径：C:/Users/HU/.codex/worktrees/task20-admin-completion

- apps/admin-web/src/main.ts
- apps/admin-web/src/local-review/staff-daily.ts
- apps/admin-web/src/local-proxy.mjs
- apps/admin-web/preview.mjs
- apps/admin-web/test/staff-daily.test.mjs
- docs/exec-plans/active/admin-staff-daily.md

### 微信小程序 worktree

路径：C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign

- apps/mini-program/pages/staff/quick-action/index.ts
- apps/mini-program/pages/staff/quick-action/index.wxml
- apps/mini-program/pages/staff/quick-action/index.wxss
- apps/mini-program/pages/staff/quick-action/index.js（仅编译确有变化时）
- apps/mini-program/src/pages/staff/quick-action.ts
- apps/mini-program/src/pages/staff-daily.ts
- apps/mini-program/src/pages/staff-daily.test.ts
- docs/exec-plans/active/mini-staff-daily.md

受保护文件：apps/mini-program/src/pages/staff.test.ts、app.json、所有 index.json、根配置、依赖和 lockfile 不得修改。

## 3. 实施顺序

1. 先在共享服务写失败测试：固定字段、状态转换、同人不能自审、跨校区拒绝、版本冲突、内部原文不出现在家长投影。
2. 实现服务契约、仓储联合类型、会话动作和路由；用同一对象 ID/版本接通 Web、Admin、Mini。
3. Web 员工工作台增加任务队列和日报面板；Admin 增加负责人审核面板；Mini 快捷动作页增加固定选项和状态反馈。
4. 每端补页面级测试与无网络/无自由文本断言；编译生成 JS 只在内容变化时更新。
5. 运行服务 loopback、Web/Admin 浏览器、Mini 源码/类型/运行时护栏和 diff 范围审计；把 G3.1 状态写入 PLANS.md 后再进入 G3.2 月反馈规划。

## 4. 验收标准

- 服务 focused tests 全部通过，至少覆盖创建、提交、确认、退回、重提、版本冲突、跨范围拒绝和家长投影隔离。
- Web/Admin browser smoke 能完成教师创建→提交→负责人确认/退回→教师重提；无外部请求、无横向溢出。
- Mini typecheck、页面源测试、运行时注册护栏通过；可在开发者工具看到任务入口、日报字段、待审核状态。
- git diff --check、ESLint、Prettier 通过；写集之外无新文件或修改。
- 原生微信工具全角色点击尚未执行时，状态必须是 NATIVE_NOT_RUN，不得称为验收完成。

## 5. 停止条件

发现需要修改本合同写集外文件、需要新增路由/配置、真实服务或依赖，或必须触碰 staff.test.ts、app.json、index.json 时，先停在审计状态并记录原因；不通过放宽断言或复制旧产物解决。
