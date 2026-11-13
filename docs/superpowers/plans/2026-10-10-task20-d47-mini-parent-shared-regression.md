# TASK20 D47 Mini 家长共享流程回归收敛

> 本任务复用现有项目完成计划和 Task 20 控制面；采用本机合成身份与回环服务，不启动独立的长期计划。

## 0. 授权与基线

- **任务 ID：** `TASK20_D47_MINI_PARENT_SHARED_REGRESSION_RECONCILIATION`。
- **授权依据：** 负责人已明确要求继续剩余项目开发并取消普通本地开发的逐项授权。此任务仅清理新版共享入口切换后已经失效的旧页面控制器断言，并补足真实注册 Mini Page 的绑定/请假端到端合成回归。
- **实现工作树：** `C:\Users\HU\.codex\worktrees\task20-d46-mini-shared-default-entry`，分支 `codex/task20-d46-mini-shared-default-entry`。沿用当前隔离 Mini 树，避免复制或覆盖主树其他现场。
- **主工作树：** `C:\Users\HU\Documents\student-care-saas-platform`。四个旧家长测试当前均为已有未跟踪文件；初始 SHA-256：
  - `apps/mini-program/src/pages/parent/binding.test.ts`：`43900E67BB12FCFDA2766ABB86CD212F4D90D390A5CCEA493542C811CFFA5733`
  - `apps/mini-program/src/pages/parent/health.test.ts`：`61C23907D856A7DF69C4E8BFBB83B88D8AE8B605F437849AAF0225FB14E5A85A`
  - `apps/mini-program/src/pages/parent/leave.test.ts`：`97810F3E9ACEC2A80C34BF61FC9A9F2CF65CE84072212E8B0B5722197E9B562E`
  - `apps/mini-program/src/pages/parent/updates.test.ts`：`6CBE9C77EECA313CF9B06AB3A29106DFCB6692300C981F857035E1F9076B445F`
- **已核对实现基线：** 主树与实现工作树中的 `apps/mini-program/src/local-synthetic/page.ts`、编译文件 `page.js` 和 `templates/local-synthetic.wxml` SHA-256 分别一致：`8A563FACFAB6240E978609035624FA2FFEF1A44A67EC0F45BE288EA3AFF7D87D`、`29A9D9DB3F0E1B28FDA2E64FBDAC91EAA8F85ED5DE7141AE8A3626A424F3041A`、`E9446EF1716A87E2B52AE5478025A155CE9E825C6A83C2DF96E745BD91CD0981`。本任务不修改产品代码或生成文件。
- **已观察缺陷：** 受保护文件以外的小程序安全测试清单为 `193` 项，其中 4 项仍通过新版共享默认入口不可见的 `parent/home` 旧控制器执行关系、健康、请假和通知操作，因旧处理器被有意门控而失败。共享健康、通知和接送已有实际 Mini Page 回环测试；当前缺口是关系申请/员工审核/请假审核的真实 Page 流程覆盖。
- **合成与服务边界：** 只使用既有虚构身份、虚构学生和本机 `127.0.0.1` 回环服务；Mini `wx.request` 由测试桩转发到现有本机合成 API。不得访问互联网、真实身份、真实儿童资料、持久化或外部服务。不得读取、运行、复制或修改 `apps/mini-program/src/pages/staff.test.ts`。

## 1. 验收标准

1. 新的 `shared-parent-workflows.test.ts` 加载已注册的家长与员工 Mini Page，证明首次显示时共享入口默认可见、身份列表已载入且没有自动选择身份；随后显式选择虚构身份。
2. 同一服务实例中，家长提交关系申请、当前授权负责人审核通过、家长重新进入可见已审核关系；家长提交固定选项请假申请，员工审核后家长可见审核结果。所有身份和请求均限定当前合成校区。
3. 四个旧家长测试中仅替换已不属于当前页面入口的控制器测试；保留文件内其他纯函数、字段白名单、租户/校区隔离和旧控制器无副作用断言。关系/请假业务覆盖必须由第 1、2 条的新真实 Page 测试承接；健康/通知由已有共享 Page 测试承接。
4. 不修复或恢复旧离线入口，不改业务实现、页面模板、生成 JS、路由、配置或依赖。
5. 运行新共享流程测试、原 4 个页面测试、Mini 安全全套（明确列出路径并排除受保护文件）、Mini typecheck、相关 ESLint/Prettier、页面注册护栏、`git diff --check` 和逐文件写集审计。主树选择性同步后重跑相关检查。
6. 微信开发者工具人工点击若当前无交互控制器则准确记录 `NOT_RUN`；不以自动化测试冒充原生视觉验收。

## 2. 精确写集

实现文件：

- 修改 `apps/mini-program/src/pages/parent/binding.test.ts`
- 修改 `apps/mini-program/src/pages/parent/health.test.ts`
- 修改 `apps/mini-program/src/pages/parent/leave.test.ts`
- 修改 `apps/mini-program/src/pages/parent/updates.test.ts`
- 新增 `apps/mini-program/src/pages/shared-parent-workflows.test.ts`

治理记录：

- 本合同 `docs/superpowers/plans/2026-10-10-task20-d47-mini-parent-shared-regression.md`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`

除此以外任何路径变化均不在合同范围。`mini-workflow-ui.test.ts`、产品代码、API、`staff.test.ts`、配置、依赖及 lockfile 不修改。

## 3. 实施步骤

1. 将上述 4 个现有测试从主树逐文件复制到隔离工作树，并核对与本节第 0 节所记 SHA 对应的源版本；只在工作树编辑。
2. 先新增真实 Page 回环测试，用注册的 `parent/home`、`staff/quick-action` 页面验证共享默认入口、关系申请/审核和请假申请/审核。测试只能访问绑定到随机端口的本机服务器；页面传输桩仅将 Mini 固定 loopback URL 映射到该服务器。
3. 对新测试先运行，若失败先判断是断言/测试桩还是产品缺陷；若证明共享产品流程缺失，则停止并回报，不扩大本合同写集。
4. 在新的真实 Page 测试通过后，替换四个旧控制器测试为“新版入口不再把旧页面控制器当作业务入口”的窄断言，并删除导致误导的旧操作序列；同文件其他测试保持原样。
5. 执行验证、范围复核、独立只读复核，再逐文件选择性同步实现测试和治理增量到主树；不得整目录或整文件覆盖已有差异。

## 4. 验证命令

- 隔离工作树新增真实 Page 流程：`LOCAL_SYNTHETIC_CORE_ROOT=C:\Users\HU\Documents\student-care-saas-platform node --experimental-transform-types --test apps/mini-program/src/pages/shared-parent-workflows.test.ts`。隔离树没有项目根安全测试入口脚本和旧单元测试需要的编译模块，因此其他四个既有测试在选择性同步前不在此树运行；此限制不得通过复制额外生成 JS 或修改脚本解决。
- 主树定向：`node scripts/mini-safe-test-runner.mjs apps/mini-program/src/pages/shared-parent-workflows.test.ts apps/mini-program/src/pages/parent/binding.test.ts apps/mini-program/src/pages/parent/health.test.ts apps/mini-program/src/pages/parent/leave.test.ts apps/mini-program/src/pages/parent/updates.test.ts`
- 主树安全全套：明确列出 `apps/mini-program/src/pages/` 下全部 `*.test.ts` 路径，排除 `staff.test.ts` 后传给安全入口；不得使用通配符，也不得读取或运行受保护文件。
- Mini 类型检查：`node_modules/.bin/tsc.cmd -p apps/mini-program/tsconfig.json --noEmit --allowImportingTsExtensions`
- ESLint：仅针对本合同五个实现测试文件。
- Prettier：仅针对本合同五个实现测试文件；若现有 CLI 无法启动，使用已安装 Prettier API，不改依赖。
- 页面注册护栏：运行现有 Mini 页面注册完整性脚本，不触碰 `staff.test.ts`。
- 差异：对精确写集执行 `git diff --check`、逐文件 SHA/状态核对、`git status --short` 范围审计；未跟踪文件以哈希和路径确认，不做批量暂存。

禁止安装依赖、改 lockfile、改产品代码、读取或运行受保护测试、提交、推送、部署、发布或处理蓝屏/转储/分页文件。

## 5. 实施结果

- 五个目标 Mini 测试通过 `57/57`；Mini 安全子集通过 `194/194`，明确排除受保护测试。Mini typecheck、目标 ESLint、Prettier API、页面注册护栏、差异检查和写集审计通过。
- 新真实 Page 测试确认家长与员工查看同一关系编号、同一学生编号和同一请假编号，覆盖普通教师拒绝审核、授权校区负责人审核与家长回看结果。独立复核指出的编号关联断言已补齐并复验。
- 本合同测试仅证明冷启动未建立会话；后续界面核对发现身份选择控件本身仍将第一条身份设为当前 picker 值。该产品界面缺口由 D48 单独修复，不在本合同产品代码写集内。微信开发者工具人工点击/视觉复核 `NOT_RUN`，Owner Review 未宣称通过。
- `apps/mini-program/src/pages/staff.test.ts` 未读取、复制、运行或修改；未改产品源码、配置、依赖/lockfile，未提交、推送、部署或发布。
