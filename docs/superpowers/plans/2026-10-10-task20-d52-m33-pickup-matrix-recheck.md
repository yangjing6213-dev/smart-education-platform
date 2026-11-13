# TASK20 D52：M3.3 接送本机流程矩阵复核

## 任务边界

- 任务 ID：`TASK20_D52_M33_PICKUP_MATRIX_RECHECK`
- 目标：依据 PDF v2.0/V3 和当前 G2.3 证据，核实 M3.3 接送是否仍是“待实施”，用当前自动化结果纠正 V3 状态，保留 M3.2、负责人和微信原生验收门。
- 分类：`LIGHTWEIGHT`，只读代码/测试核对、定向自动验证和文档更新。
- 权威依据：PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。
- 基线：`PLANS.md` SHA-256 `766530EEAD946AD63311FFAF114B79993B803344C5EC5B0A1A27E31F9DA92F68`。

## 精确写集

- MODIFY `PLANS.md`：更正 M3.3 表格状态并记录 D52 自动验证。
- CREATE 本合同。

只读范围：现有 G2.3 API、User Web、Mini 页面、核心服务实现与测试；禁止读取、复制、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。不改业务源码、测试、配置、生成文件、依赖或 lockfile。

## 验收标准

1. 按当前可执行的项目测试入口核验接送授权、员工人工核验、固定异常处理、撤销、家长安全结果和旧版本/越权拒绝。
2. 只有本机自动化证据通过的客户端能力标为本机已实现/已验证；Admin 覆盖、Owner Review、M3.2 阶段门和微信原生点击不得推断通过。
3. `PLANS.md` 不再把已有的 G2.3 本机接送实现表述为未来待实施；M3.3 阶段验收仍待其独立门槛。
4. 精确写集检查、`git diff --check`、合同 Markdown 格式核验通过；不提交、推送、部署或发布。

## 验证结果

- API 当前编译输出：`node --test apps/api/dist/test/local-synthetic-pickup.test.js`，`6/6` 通过。
- User Web 当前编译输出：`node --test apps/user-web/dist/local-synthetic/parent-pickup.test.js`，`9/9` 通过。
- Mini 页面源码：`node scripts/mini-safe-test-runner.mjs apps/mini-program/src/pages/pickup.test.ts apps/mini-program/src/pages/shared-pickup.test.ts`，`4/4` 通过。
- Mini 当前生成 JS 页面：设置 `MINI_PICKUP_RUNTIME=generated` 后通过同一安全入口运行 `shared-pickup.test.ts`，`1/1` 通过。
- 本机合成 HTTP 服务：`node --test tests/local-synthetic/pickup.test.mjs`，`1/1` 通过。
- 合同 Markdown 格式：通过已安装 Prettier 3.9.6 的 API 检查。`pnpm exec prettier` 启动失败，原因是本机 `prettier.cjs` 文件开头含无效字节；未修改依赖或锁文件。
- 直接将 API/User Web 的 TypeScript 测试交给 Node 运行各自出现 `ERR_MODULE_NOT_FOUND`，原因是源码以 `.js` 扩展名引用尚未编译的 TS；改用项目现有 `dist` 测试入口后通过。此为命令选择错误，不是产品缺陷。未触发编译、未修改生成输出。
- 微信开发者工具全流程人工点击 `NOT_RUN`；负责人 Owner Review `PENDING`；M3.2 阶段收口仍独立等待原生/负责人门槛，不能以本任务关闭 M3.3。

## 状态

`PASS_LOCAL_SYNTHETIC_RECHECK;M33_CODE_NOT_PENDING;OWNER_AND_NATIVE_ACCEPTANCE_PENDING;M32_GATE_REMAINS_SEPARATE`
