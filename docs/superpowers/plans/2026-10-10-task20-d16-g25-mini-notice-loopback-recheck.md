# TASK20 D16 G2.5 Mini 通知本机跨角色回归复核

- 任务标识：`TASK20_D16_G25_MINI_NOTICE_LOOPBACK_RECHECK`
- 状态：`PASS_LOCAL_SYNTHETIC_SOURCE_AND_GENERATED_LOOPBACK`
- 目的：在 G25 微信开发者工具连接不可用期间，补足可自动完成的证据；通过真实 Mini Page 事件处理器和临时本机合成服务，复核员工提交、负责人审核发布、家长读取/知悉、版本更新、撤回和解绑。
- 验证来源工作树：`C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`
- 来源 HEAD：`bd0001faa8e2fd7bbabe86e3d778ba24431107e8`
- 本轮无产品代码或测试代码改动；测试服务监听临时回环端口，结束后关闭，不写入持久数据。

## 写集

仅更新以下治理文档：

1. `PLANS.md`
2. `docs/exec-plans/active/project-completion.md`
3. `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
4. 本任务合同

## 禁止范围

- 不修改 Mini/Web/API/数据库产品代码、测试或生成文件。
- 不安装依赖、不修改 lockfile 或配置。
- 不调用或重试微信开发者工具连接/点击自动化；原生视觉和触控验收继续记录为 `NOT_RUN`。
- 不访问真实认证、真实数据、外部服务或正式 AI；不提交、推送、部署或发布。

## 验证与结果

在来源 Mini 工作树以 Node 24.14.0 的原生 TypeScript 剥离功能运行同一测试文件：

1. 源码模式：设置 `LOCAL_SYNTHETIC_CORE_ROOT=C:\Users\HU\.codex\worktrees\task20-local-shared-core`，清除 `MINI_WORKFLOW_RUNTIME`，运行 `node --experimental-strip-types --test --test-concurrency=1 apps/mini-program/src/pages/shared-notice.test.ts`：4/4 通过。
2. 编译页面模式：设置相同的本机核心目录和 `MINI_WORKFLOW_RUNTIME=generated`，运行同一命令：4/4 通过。
3. 初次 `node --import tsx` 未启动，原因是隔离工作树未安装该测试启动器；改用 Node 原生方式后通过，没有安装依赖。
4. 测试将 Mini 请求限制到本机服务，并直接触发页面处理器；覆盖发布前家长不可见、打开与知悉分开、不同家长独立回执、新版本重置回执、过期版本拒绝、撤回/解绑清除正文及迟到响应清理。
5. 自动化通过不等于微信开发者工具实际点击或负责人验收。G25 原生完整流程因现有连接错误继续 `NOT_RUN`；仅在工具连接/状态恢复后再复核。

文件指纹（来源工作树验证前后未变）：

- `apps/mini-program/src/pages/shared-notice.test.ts`：`3DECBFA8B7A9F8C802E2357456200DD33B408D80F5FC40778211DC36F1001F94`
- `apps/mini-program/pages/staff/quick-action/index.ts`：`86FD97698A026BF3E20D4245E69DB518A47394C9CAAA25F8FDFF78A173019C16`
- `apps/mini-program/pages/staff/quick-action/index.js`：`ED18580BFC7A6ACC19C943CD60C98B1BA9B652B7CCF016C8E6B5B85C57910A4C`
- `apps/mini-program/pages/parent/home/index.ts`：`7D98B8449051F9354FE548C1975C2B3DF58BC01C978D1404692E9C066CF5466E`
- `apps/mini-program/pages/parent/home/index.js`：`99A5B764D3F5A0DFEB1447F6C58272626C27C9D91E1F10908E14CB5FA564D77F`
