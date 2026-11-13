# TASK20 D44：G3.2 日报关联已确认托管记录

## 0. 目标与依据

- 依据：项目方案 PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`，第 18、33–34 页；V3 路线图 G3.2。
- 审计发现：当前日报服务只自动记录任务、考勤、接送和接送异常四类来源。方案第 33 页还要求将托管记录纳入日报草稿来源。
- 本批只补第五类 `CARE_RECORD` 来源引用：同租户、同校区、同班级、同日报日期，且已经负责人确认并发布的托管记录。日报只保存 `{kind, id, version}`，各端只显示分类数量；不复制学生标识、记录正文、健康内容或其他源字段。
- 受监督学习摘要暂不纳入本批：它由独立的内存学习会话服务维护，当前没有与日报仓库一致的日期和服务端班级范围快照。须另行确认可安全聚合的字段后再连接；不调用正式 AI。
- 用户已授权继续项目本地开发；本批仅用明显虚构数据和本机合成服务，不接真实机构、学生、身份、通知、AI、数据库或外部网络。

## 1. 现有状态保护

- 使用既有隔离工作树：API/共享服务 `task20-local-shared-core`、User Web `task20-web-completion`、Admin Web `task20-admin-completion`、Mini `task20-mini-brand-redesign`。
- 主工作树中各 lane 的现有日报文件与来源工作树并非全部相同。特别是 User Web、Admin Web 和 Mini 客户端已存在各自增量；实现后必须按目标代码块选择性整合，禁止整文件覆盖。
- 保留所有既有未提交文件、页面与路由；`apps/mini-program/src/pages/staff.test.ts` 不读取、不运行、不修改。

## 2. 精确写集

### API/共享服务工作树

- `packages/contracts/src/staff-daily.ts`
- `apps/api/src/local-synthetic/repository.ts`（日报来源类型在本地仓储另有实际使用定义，必须与共享类型同步）
- `apps/api/src/local-synthetic/staff-daily.service.ts`
- `apps/api/test/local-synthetic-staff-daily.test.ts`
- `tests/local-synthetic/staff-daily.test.mjs`

### User Web 工作树

- `apps/user-web/src/local-synthetic/staff-daily.ts`
- `apps/user-web/src/local-synthetic/staff-daily.test.ts`

### Admin Web 工作树

- `apps/admin-web/src/local-review/staff-daily.ts`
- `apps/admin-web/test/staff-daily.test.mjs`

### Mini 工作树

- `apps/mini-program/src/local-synthetic/client.ts`
- `apps/mini-program/src/local-synthetic/client.test.ts`
- `apps/mini-program/src/local-synthetic/page.ts`
- `tests/mini-shared-service.test.mjs`
- `apps/mini-program/src/local-synthetic/client.js`（仅编译确实改变时）
- `apps/mini-program/src/local-synthetic/page.js`（仅编译确实改变时）

### 主工作树治理记录

- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 本合同文件

## 3. 实施步骤

1. 先扩展 API 测试，证明确认且已发布、日期和服务端范围完全匹配的托管记录才生成 `CARE_RECORD` 引用；待审核、撤回、不同日期、校区或班级的记录不得进入。响应仅含固定类型、不透明编号和版本。
2. 扩展共享契约和 API 来源投影；日报草稿创建、编辑及退回后重提均按原规则刷新来源，确认过的既有四类规则不变。
3. Web、Admin 和 Mini 客户端各补断言：能解析第五类来源，分类计数显示“托管记录”，不展示学生身份、记录正文或健康详情；未知来源仍拒绝。
4. Mini 集成测试用真实注册 Page 事件和临时本机服务验证托管记录→员工日报同一 ID/版本，并检查家长仍不能读取内部日报。运行已安装 TypeScript 编译器；仅当编译输出变化时更新对应生成 JS。
5. 对比每条来源工作树与主工作树目标路径，只整合本合同产生的必要差异，不覆盖主工作树其他增量。

## 4. 验收与验证

- API 服务聚焦测试、HTTP 合成测试、User Web 日报测试、Admin 日报测试、Mini 客户端测试和 Mini 同服务页面流程均通过。
- API、User Web、Admin Web 类型检查与构建，Mini typecheck、页面注册/生成文件护栏、受影响文件 ESLint、Prettier API、`git diff --check` 通过。
- 确认实际写集仅属于第 2 节路径；配置、依赖、lockfile、真实服务、外网与存储未变。
- 只报告本地合成自动化结果。负责人验收、微信开发者工具手动视觉/点击和真实业务数据仍分别保持未完成。

## 5. 停止条件

- 若必须新增白名单外路径、扩大到自由文本/健康详情/正式 AI、改路由或配置、安装依赖、连接外部服务，立即停止并记录差异。
- 若隔离基线或主树现状使目标代码块无法安全保留，停止整合该 lane，不覆盖现有内容。

初始状态：`IN_PROGRESS`。
