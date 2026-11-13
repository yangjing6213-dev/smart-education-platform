# TASK20 D28：M6.2 管理端匿名经营摘要

## 目标与依据

V3 路线图的 M6.2 要求管理网页提供只读合成经营摘要。现有 `/admin/platform-operations` 已显示合成租户、配额、支持事项和成本/安全汇总；既有本机费用客户端也已支持平台身份只读汇总，但费用、退款、员工工作材料、证照和招聘数量尚未汇总到该页面。

本批只扩展现有平台运营页面，不加路由、不改服务或数据模型。新增经营摘要只呈现合成计数，不呈现业务费用/收款/退款金额、员工姓名/编号、学生或家长资料、账单明细，也不提供任何财务写操作。保留现有固定成本估算卡片；它是预置成本估算，不是业务收费或收款金额。数据只取现有管理端页面内存快照和平台费用接口的匿名返回。

## 精确写集

- `apps/admin-web/src/pages/platform-operations.ts`
- `apps/admin-web/src/main.ts`
- `apps/admin-web/test/platform-operations.test.mjs`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 本合同文件

不得修改 Mini、User Web、API、数据库、配置、其他测试、依赖或 lockfile。

## 实施与验收

1. 先扩展平台运营页面测试，验证从合成费用、员工工作材料、证照和招聘快照产生匿名计数；验证错误/非平台范围费用响应不显示旧数据或明细，唯读模式没有写操作。
2. 将现有平台费用客户端接入 `/admin/platform-operations` 的只读快照生命周期；离开此页面或拒绝访问时断开，进入时只使用服务端认可的平台合成身份。汇总只显示费用资料与收费/收款/退款笔数，不显示金额和对象信息。
3. 复用当前页面内存中的员工材料、招聘跟进和证照记录，只显示总量、待复核/到期分类数量，不渲染姓名、ID、候选人别名或记录内容。
4. 运行 Admin 聚焦与全量测试、typecheck、build、目标 ESLint、Prettier API 检查、平台路由本机 smoke、浏览器复核、`git diff --check` 与精确范围审计。拒绝模式和外部请求也必须验证。
5. 如果需要修改 API、数据模型、其他业务端或白名单外文件，先停止并调整合同，不扩大写集。

## 完成记录

### 实施结果

- 已在现有平台运营页加入费用资料与流水笔数、工作材料、证照到期和招聘跟进计数。费用数据只接受平台范围且标记为合成的精确计数字段；错误、角色/范围不匹配、异常字段或金额字段存在时不显示旧数量。固定成本估算卡片保留。
- TDD 证据：新增的两条页面断言在旧实现上先红（原页面无该摘要与错误提示），接入实现后聚焦测试 `7/7` 通过；错误提示用例也单独执行过红/绿验证。
- 验证命令与结果：
  - `corepack pnpm --dir apps/admin-web test`，设置已有 `LOCAL_SYNTHETIC_CORE_ROOT=C:\Users\HU\.codex\worktrees\task20-local-shared-core`：`118/118` 通过。
  - `corepack pnpm --dir apps/admin-web run typecheck`、`run lint`、`run build`：通过。
  - 已安装 Prettier API 检查新增页面、页面测试、合同及本次编辑区：通过；未修改 Prettier 安装文件或 lockfile。
  - 本机浏览器合成响应复核 390px/1365px：无横向溢出；拒绝模式无汇总；只读控件不可提交；无页面错误、失败请求或外部请求。
  - `git diff --check` 与目标文件尾随空白/冲突标记检查通过。`main.ts` 的既有 CRLF 仅产生 Git 行尾提示，未为消除提示重写整文件。
- 精确写集七条路径内完成；`pnpm-lock.yaml` 未改。页面仅呈现合成计数，没有业务费用/收退款金额、明细或人员/学生/家长身份，也没有财务写操作。

### 未完成门槛

- M6.2 全项仍未关闭：Web/Mini 角色视图和跨端边界仍需按 V3 矩阵核查。
- 本轮微信开发者工具复核与负责人验收均为 `NOT_RUN`。浏览器复核只覆盖本地管理网页合成响应，不表示真实财务业务或发布就绪。
- 下阶段先重核 V3 未完成项和依赖关系，再实施无需等待人工原生验收的最早网页/Mini 本地缺口。
