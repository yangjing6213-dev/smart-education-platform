# TASK20 D32：M5.1 分层提示三端实现与证据核对

## 目标

对照项目方案 V2.0 与已确认的 V3 路线图，核对 M5.1“学生先尝试、按 0/1/2/3 级提示、完成固定巩固题”的 API、家长/教师网页、小程序和管理端匿名学习汇总现状。区分已有本地合成实现、自动化证据、负责人验收与微信开发者工具原生验收；不得把本地演示或自动化测试写成真实服务或生产验收。

## 精确写集

- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `docs/superpowers/plans/2026-10-10-task20-d32-m51-learning-tier-audit.md`

本轮只允许更新以上治理记录。产品源码、测试、生成文件和配置均为只读。若发现可复现的业务缺陷，记录复现证据与影响，并建立单独的精确写集实施任务后继续；不得在本审计合同下顺手改产品代码。

## 审计范围与边界

- API：成人监督、已批准家长关系、固定学生/题目/时长、作答与提示顺序、提示后巩固题、关闭/过期后拒绝继续、教师班级摘要与平台匿名汇总。
- User Web：家长/教师入口、成人同意、分层提示交互、巩固题、教师接手、来源信息与安全说明。
- Mini：家长学习页、成人同意、固定选择项、提示逐级开放、巩固题和教师接手；只读现有页面与共享本机流程测试。
- Admin：平台学习安全页面只显示匿名汇总，不显示学生、班级或会话详情。
- 禁止正式 AI、开放输入、真实认证、真实学生资料、外部网络、持久化或真实机构服务；不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 不安装依赖、不修改 lockfile、不提交、推送、部署或发布；保留工作树已有其他修改。

## 验收标准

1. 对 API、User Web、Mini、Admin 的相关测试和页面流程执行有记录的定向验证，注明实际执行结果。
2. 代码路径与计划状态逐项对照，识别 M5.1 是否已实现、是否有跨端缺口，并据证据更新三份计划文件。
3. 明确记录 Owner Review 和微信开发者工具原生复核状态；没有实际执行不得写为通过。
4. 最终 SHA-256、精确路径审计、Prettier API 核验与 `git diff --check` 均通过；不得改动本合同写集外文件。

## 验证记录

### 已执行

- API `apps/api/dist/test/local-synthetic-learning-session.test.js`：`6/6`；User Web `apps/user-web/dist/pages/parent-learning.test.js`：`5/5`。
- Mini `apps/mini-program/src/pages/parent/learning.test.ts` 与 `apps/mini-program/src/local-synthetic/learning-client.test.ts`：`11/11`；Admin `apps/admin-web/test/learning-safety.test.mjs`：`2/2`。
- `tests/e2e/learning.spec.ts` 与 `tests/local-synthetic/learning-session.test.mjs`：`4/4`；`apps/user-web/test/learning-session-browser.mjs` 与 `apps/admin-web/test/learning-safety-browser.mjs` 均退出码 `0`。
- V3 第 9 节明确禁止直接给答案；`apps/api/src/local-synthetic/learning-session.service.ts` 第 3 级提示原文含最终结果 `403`。这是已确认的 M5.1 安全内容缺陷；当前 API 集成测试检查提示顺序，但没有断言提示不泄露答案。
- Mini 微信开发者工具原生复核 `NOT_RUN`；Owner Review `PENDING`。本轮只读审计并更新治理文档；未改业务代码、测试或 lockfile，也未接入正式 AI、网络或真实资料。
- 结论：`GAP_CONFIRMED_PENDING_D33_REPAIR`。下一目标 `TASK20_D33_M51_NO_DIRECT_ANSWER_REPAIR`；D33 将仅移除第 3 级提示中的最终数值并补 API 服务/API 集成断言。
