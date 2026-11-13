# TASK20 G5.2A 本地合成账务流水只读核心（2026-10-07）

**状态：** `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`
**来源盘点：** `docs/superpowers/plans/2026-10-07-g52-finance-capability-audit.md`
**盘点结论：** 当前已有只读费用文档，但尚无独立流水/退款/对账数据模型。
**授权依据：** 用户明确委托继续完成本项目后续本地开发。本合同只新增固定合成流水的服务端只读投影；不表示真实账务或付款能力。

## 目标与验收

- 为现有费用/账单/收据提供固定合成的 `CHARGE`、`PAYMENT`、`REFUND` 流水；金额采用整数分，货币固定 CNY，行具有账期、发生日、关联费用文档 ID、版本、范围及 `synthetic=true`。
- 新增只读家长流水入口：只返回当前登录家长仍有效的已审核关系内学生记录，不接受客户端提交租户/校区/班级/学生筛选作为授权依据；解绑或关系版本变化后立即不再显示。
- 新增只读管理汇总：机构负责人只能得到本租户/校区范围合计；平台管理员仅可得到匿名记录数量和类型数量，不得得到金额或学生/文档明细。
- 所有流水均为固定预置示例，不能新增、修改、确认或删除；页面/接口说明不得暗示已发生真实付款或退款。
- 先添加失败测试，再实现；完成 Core focused tests、类型检查、ESLint、Prettier、`git diff --check` 和精确范围审计。

## 精确写集

### Core（隔离工作树 `C:\Users\HU\.codex\worktrees\task20-local-shared-core`）

- `packages/contracts/src/finance.ts`
- `packages/contracts/test/finance.test.ts`（新增）
- `apps/api/src/local-synthetic/repository.ts`
- `apps/api/src/local-synthetic/fees.service.ts`
- `apps/api/src/local-synthetic/routes.ts`
- `apps/api/test/local-synthetic-fee-ledger.test.ts`（新增）

### 治理

- `docs/superpowers/plans/2026-10-07-g52a-synthetic-ledger-readonly.md`
- `docs/superpowers/plans/2026-10-07-g52-finance-capability-audit.md`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`

类型构建可写入 Core 已忽略的 `packages/*/dist`、`apps/api/dist`；这些生成物不纳入交付。

## 明确不做

- 不连接真实银行、微信支付、第三方支付、外部网络、真实账户或真实财务数据。
- 不新增付款、退款或对账写入动作，不修改现有费用文档生命周期，不新增数据库或持久化。
- 不修改 User Web、Admin、Mini、`staff.test.ts`、`app.json`、其他配置、依赖或 lockfile。
- 不改主工作树业务代码，不覆盖或清理隔离工作树其他文件；不 commit、push、部署、发布。

## 停止条件

如真实费用数据、外部支付、数据库、依赖或写入动作成为必要条件，或必须修改白名单外路径，停止并记录缺口，不扩大合同。

## 验证结果

Core 合同与 API 测试共 11/11 通过：账务合同测试 1/1、流水 API 4/4、既有费用与成员权限回归 6/6。覆盖整数分/CNY、固定合成记录、只读接口、当前已批准家长关系、关系撤销后旧家长失去访问、另一位当前已批准监护人可读取学生级合成记录、负责人跨班同校区合计，以及平台匿名计数。

- `packages/contracts`：本地 TypeScript 编译通过；账务合同测试 1/1 通过。
- API focused：流水 4/4、费用与成员权限相关回归 6/6 通过。
- ESLint：六个写集文件通过。
- Prettier：六个写集文件通过。
- API 完整项目 TypeScript 检查：未通过。标准检查受隔离 worktree 的 workspace 包链接/既有其他模块类型诊断影响；补充的 workspace 源码路径映射检查总计报告 35 项项目诊断，六个写集文件为 0 项。此结果不得记作整个 API 项目类型检查通过。
- `pnpm exec`：当前隔离环境为 pnpm 11.19.0，项目要求 >=11.22.0；没有安装或升级依赖。验证通过直接调用已有本地 Prettier、ESLint 和 TypeScript 工具完成。
- 精确范围：产品改动仅为上列六个 Core 文件；类型构建输出仅进入已忽略的 `dist`；本轮目标文件无尾随空白，`git diff --check` 无输出。
- 独立静态复核：PASS。初审指出两项重要问题，均已以行为测试验证修复：校区流水汇总包含同校区不同班级；解绑的原家长不能读取，而新获批关系可以读取当前学生级合成账目。复核确认新获批监护人有当前关系，因此不应被错误地永久排除在学生级固定账务记录之外。复核未运行测试，本记录中的测试结果来自本轮命令。
- 不接入真实支付、数据库、网络或持久化；不修改主工作树业务代码；无提交、推送、部署或发布。

**剩余门槛：** Owner Review 与后续选择性主树整合仍未完成；本地合成验证不代表真实支付或机构账务可用。
