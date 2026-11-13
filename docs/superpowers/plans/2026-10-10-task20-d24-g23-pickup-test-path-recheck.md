# TASK20 D24：G2.3 Mini 接送页面主树测试路径复核

## 依据与目标

- 产品依据：V2.0 项目方案 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；当前阶段状态以 `PLANS.md` 为准。
- 用户已授权自主推进本地项目开发。本批针对 `G2_3_NEXT_AUDIT` 中“主树页面测试未运行、依赖相邻共享核心路径”的记录做复核。
- 只验证既有 `shared-pickup.test.ts`：从主工作树根目录指定 `LOCAL_SYNTHETIC_CORE_ROOT`，分别运行 TypeScript 源码页面模式和编译 JS 页面模式，确认家长与员工页面仍共用同一临时本机服务。
- 如果测试通过，只校准治理记录；不修改接送业务、共享测试、配置或生成文件。`SERVICE_SEPARATES_AUTHORIZATION_AND_COMPLETED_PICKUP_RECORD` 继续作为既有业务设计边界，不在本批改动。

## 精确写集

- `MODIFY PLANS.md`
- `MODIFY docs/exec-plans/active/project-completion.md`
- `MODIFY docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `CREATE docs/superpowers/plans/2026-10-10-task20-d24-g23-pickup-test-path-recheck.md`

不修改产品代码、测试、配置、依赖、lockfile 或生成文件；不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。

## 验收与验证

1. 使用 `LOCAL_SYNTHETIC_CORE_ROOT` 指向当前主工作树，源码模式和生成 JS 模式各运行 `apps/mini-program/src/pages/shared-pickup.test.ts`。
2. 两种模式的家长/员工页面测试均通过；记录 Node 输出中的环境提示，不通过增加 `package.json` 配置消除提示。
3. 对精确写集运行 `git diff --check`、新合同 Markdown 格式核验与范围审计；核对 lockfile 未变化。
4. 明确保持负责人验收和微信开发者工具完整点击验收为未完成。

## 执行记录

- 状态：`PASS_LOCAL_TEST_RECHECK_ONLY`。
- 源码模式：`$env:LOCAL_SYNTHETIC_CORE_ROOT=(Get-Location).Path; node --experimental-strip-types --test --test-concurrency=1 apps/mini-program/src/pages/shared-pickup.test.ts`，1/1 通过。
- 编译 JS 模式：在同一主工作树路径下设置 `MINI_PICKUP_RUNTIME=generated` 后运行同一命令，1/1 通过。
- Node 两次均提示根 `package.json` 未声明 module type，属于性能提示；没有改包配置。`git diff --check`、本合同 Markdown Prettier API、精确路径审计通过；lockfile SHA 与 D23 记录一致 `01BCB5E41D0E3C786F5EACF933791BAB767ACF17B4487D919C04BB2582F4CD64`。
- 没有产品代码或测试修改；负责人验收、微信开发者工具原生完整点击仍 `NOT_RUN`。受保护 `staff.test.ts` 未读取、运行或修改。
