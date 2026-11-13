# Mini 日期显示与健康共享流程修正

## 0. 依据、流程与边界

依据 PDF V2（SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`）、现行项目总路线 G2.1/G2.6，以及负责人自主完成普通本地开发要求。本合同是现有总执行计划的一次精确分片，不另建并行总计划。

先使用 `using-superpowers` 选择调试、测试和独立复核技能，再由 `long-horizon-development` 判定本跨端任务采用 Long-Horizon；共享已有上下文和验证证据。主线程管理合同、日期修复与整体验证；各执行者只修改自己的隔离树写集。

仅本机合成数据和内存服务。不接真实机构、认证、健康资料、外部通知、数据库、正式 AI、持久化或付费服务；不安装依赖、不改 lockfile、不提交、推送、部署、上传或发布。保留既有现场、通知和其他增量。不得把工具超时记为产品通过或产品失败。

## 1. 已复现问题与最小目标

1. 原生截图中日期控件呈空白短胶囊：共享模板读取 `sharedHistory`，四个页面调用却漏传。同类检查还发现考勤选择项 `sharedAttendanceStatuses`、`sharedAttendanceReasons` 漏传。仅补三项模板参数，保留现有状态、事件和样式；在既有 UI 测试增加模板参数完整性检查，防止新增选择器再漏接。
2. 健康事件确认后离开 `SUBMITTED`，唯一负责人查询返回空数组，其他作者列表拒绝负责人。复用 `health-incident-review` 查询，返回负责人当前范围内 `SUBMITTED/CONFIRMED/PUBLISHED` 三种仍可处理状态；不新增权限、路由或把作者草稿公开给负责人。
3. Web 以旧记录合并缓存掩盖权威查询缺口；Admin 以动作回包替换旧行延续。改为每次以服务列表覆盖，动作后刷新，失败/身份变化清空，不能补回已失效资料。
4. 家长健康摘要已有事件版本，但缺少学生与关系标识。补 `studentId/bindingId/bindingVersion`，客户端按当前有效关系、孩子和范围验证。保留现行单绑定监护人可见规则：不是通知的双监护人共享规则，不在本轮扩大数据权限。
5. Mini 将健康记录接入已有共享页面：固定观察项创建/提交，负责人退回或确认、固定补充、单独发布/撤回，家长查看摘要后独立知悉。使用真实服务字段和版本，不复制离线状态。

## 2. 精确写集

### 主工作树

新建本合同，修改 `PLANS.md` 与 `docs/exec-plans/active/project-completion.md`。主树业务文件不整合。

### Mini 日期修正：`C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign`

- MODIFY `apps/mini-program/pages/parent/home/index.wxml`
- MODIFY `apps/mini-program/pages/parent/binding/index.wxml`
- MODIFY `apps/mini-program/pages/staff/workbench/index.wxml`
- MODIFY `apps/mini-program/pages/staff/quick-action/index.wxml`
- MODIFY `apps/mini-program/src/pages/mini-workflow-ui.test.ts`（仅增加共享模板使用变量须由四处调用传入的检查）
- CREATE `docs/exec-plans/active/mini-history-binding-repair.md`

四个 WXML 仅在共享模板 data 参数加入 `sharedHistory`、`sharedAttendanceStatuses`、`sharedAttendanceReasons`，不调整其他结构或样式。

### 共享服务：`C:/Users/HU/.codex/worktrees/task20-local-shared-core`

- MODIFY `apps/api/src/local-synthetic/health-incident.service.ts`
- MODIFY `apps/api/test/local-synthetic-health-incident.test.ts`
- CREATE `docs/exec-plans/active/health-shared-refresh-repair.md`

### User Web：`C:/Users/HU/.codex/worktrees/task20-web-completion`

- MODIFY `apps/user-web/src/local-synthetic/client.ts`
- MODIFY `apps/user-web/src/local-synthetic/projections.ts`（仅修正家长首页仍称通知/健康未共享的过时说明）
- MODIFY `apps/user-web/src/local-synthetic/health-incident.ts`
- MODIFY `apps/user-web/src/local-synthetic/health-incident.test.ts`
- MODIFY `apps/user-web/test/health-incident-browser.mjs`
- CREATE `docs/exec-plans/active/web-health-shared-refresh-repair.md`

### Admin Web：`C:/Users/HU/.codex/worktrees/task20-admin-completion`

- MODIFY `apps/admin-web/src/local-review/health-incident-shared.ts`
- MODIFY `apps/admin-web/test/health-incident-shared.test.mjs`
- CREATE `docs/exec-plans/active/admin-health-shared-refresh-repair.md`

### Mini 健康共享：`C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign`

- MODIFY `apps/mini-program/src/local-synthetic/client.ts`
- MODIFY `apps/mini-program/src/local-synthetic/client.js`（仅编译变化内容）
- MODIFY `apps/mini-program/src/local-synthetic/page.ts`
- MODIFY `apps/mini-program/src/local-synthetic/page.js`（仅编译变化内容）
- MODIFY `apps/mini-program/templates/local-synthetic.wxml`
- CREATE `apps/mini-program/src/pages/shared-health.test.ts`
- CREATE `docs/exec-plans/active/mini-health-shared-integration.md`

健康共 19 路径，日期及选择项修正另 6 路径。编译可以更新既有忽略构建目录；Mini 可分发 JS 仅上述两个。保护 `staff.test.ts`、注册配置、所有 `index.json`、项目配置、依赖和锁文件。

2026-10-07 范围修正：原合同 SHA `5E2A47526034D8473A9791B194F732FB2F99070EA5751A2868C4D1897D19EB24` 的日期段只列日期参数；继续检查同一模板时确认考勤两个列表也漏传。按自主本地授权增加上述两参数及既有 UI 测试的一项检查；健康 18 路径和行为不变。修改前先记录此修正。

同日第二次精确修正：上一 SHA `6AA7D91A061F1AE7E4D6569C31B8346350C1C64973DB7D0B68FB4CF154486704` 下独立检查发现 Web 家长首页仍明确称通知和健康未共享，与当前实现相矛盾。增加 `projections.ts` 一条说明文字修正，由主线程负责；其余代码写集及健康权限不变。初次严格回执校验修复仍在已列出的 `health-incident.ts/test.ts` 内，无需扩大该行为范围。

## 3. 三步执行与验收

1. 日期修正与共享服务：先静态复现模板漏参数、服务确认后查询丢失；补最小实现，验证日期参数完整，服务重连可继续补充/发布/撤回。保留作者、班级、校区、租户隔离、单绑定与未发布隐藏。
2. 三端接线：Web/Admin 清理旧缓存补回，Mini 接入真实共享状态；新增有价值的页面/客户端失败测试，再修复。以同一事件 ID/版本完成创建→提交→退回重提→确认→固定补充→单独发布→家长阅读/知悉→再补充隐藏旧摘要→再发布→撤回。负责人重连及第二客户端变化后仍按最新数据处理。
3. 核验：相关 focused/真实回环测试、Web/Admin 实际预览浏览器、源码/生成 Mini Page、类型、Lint、相关格式、运行产物及 diff/写集审计；独立复核。复用未变的已通过验证。原生 DevTools 自动化通道恢复前单独保留 `PARTIAL/NOT_RUN`，不重复盲试，不阻断可继续的本地实现。

## 4. 限制与停止条件

- 本轮未增加教师编辑健康观察、升级或撤回接口；退回只能原值重新提交，不能宣称这些能力已完成。多监护人共享同一健康事件属于后续显式数据权限设计。
- 固定观察和跟进摘要不构成诊断、医疗建议或自动决定。仍有人审与单独发布。
- 需要超出写集时先记录最小范围修正和依据；不静默顺手修改。真实服务、费用、权限外扩、生产或破坏性操作继续停止。
