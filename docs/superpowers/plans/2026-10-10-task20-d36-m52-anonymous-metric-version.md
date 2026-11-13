# TASK20 D36：M5.2 匿名学习指标口径版本

## 目标

为平台管理端本机合成学习安全汇总增加固定、可见、可校验的指标口径版本 `LEARNING_SAFETY_V1`。服务端与共享契约返回该版本，管理端只接受该版本并在页面标明“指标口径：V1（本机合成数据）”。保持汇总匿名、只读和本机内存范围。

## 精确写集

- `packages/contracts/src/learning-session.ts`
- `apps/api/src/local-synthetic/learning-session.service.ts`
- `apps/api/test/local-synthetic-learning-session.test.ts`
- `tests/local-synthetic/learning-session.test.mjs`
- `apps/admin-web/src/local-review/learning-safety.ts`
- `apps/admin-web/test/learning-safety.test.mjs`
- `apps/admin-web/test/learning-safety-browser.mjs`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `docs/superpowers/plans/2026-10-10-task20-d36-m52-anonymous-metric-version.md`

## 规则与边界

1. `metricVersion` 的唯一允许值为 `LEARNING_SAFETY_V1`，由 API 返回并通过共享类型传递。
2. 管理端对缺少、错误或未知版本的汇总必须拒绝显示数字并给出当前格式错误状态；不能把未知口径悄悄当作 V1。
3. 管理页面明确显示口径版本；现有匿名数字和说明保持不变，不增加个人、学生、班级或会话明细。
4. 只使用本机内存中的合成数据；不连接真实认证、网络服务、数据库、伙伴云或正式 AI，不加入持久化或新的路由。
5. 不修改 Mini、其他管理页面、API 路由、权限、依赖或 lockfile；不访问、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
6. 不提交、推送、部署或发布。

## 验收与验证

- 先增加 API、HTTP 和管理端测试，验证版本字段确实传递、显示且未知版本关闭数字展示，再完成实现。
- API 与 Admin Web 定向构建/类型检查、定向测试、现有浏览器级本机无外网验证、ESLint、Prettier API、`git diff --check` 和精确写集审计均须有真实结果记录。
- 浏览器验证只访问本机合成服务，确认页面版本标签、匿名计数、无横向溢出、无浏览器错误且无外网请求。
- 验证结果、合同 SHA-256、状态及下一目标写回本合同和治理计划；没有运行的检查明确标记为 `NOT_RUN`。

## 验证结果（2026-10-10）

- Red 阶段证实缺口：API 单测与 HTTP 测试因版本字段缺失失败；Admin 页面缺少版本显示，客户端会接受缺版本汇总。补齐后全部通过。
- API：`pnpm --filter @student-care/api build` 通过；`node --test dist/test/local-synthetic-learning-session.test.js` 为 `7/7`；`node --test tests/local-synthetic/learning-session.test.mjs` 为 `1/1`。
- Admin：`pnpm --filter @student-care/admin-web build` 通过；`node --test apps/admin-web/test/learning-safety.test.mjs` 为 `3/3`；`node apps/admin-web/test/learning-safety-browser.mjs` 退出码 `0`。浏览器复核了 V1 标签、匿名数字、页面无横向溢出/错误响应/外网请求；浏览器测试使用当前仓库构建出的 API，不依赖其他工作树。
- D35 回归：User Web 构建和页面测试 `6/6`；Mini 客户端/页面 `12/12`、Mini 共享 Page/服务流程 `11/11`、Mini 定向类型检查和注册护栏通过。
- ESLint 对 9 个本合同代码/测试文件通过；Prettier API 对本合同代码和 D35/D36 合同共 11 个文件通过；`git diff --check` 退出码 `0`，仅提示七个无关既有文件的换行风格，不存在空白错误。
- 范围审计：D36 的 11 条路径均在合同写集内；D35 的 20 条路径保持在 D35 写集内；两合同去重后共 25 条目标路径。`pnpm-lock.yaml` 未修改。未读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 独立只读代码复审 `PASS`，未修改文件、未访问受保护测试。
- 微信开发者工具原生画面复核 `NOT_RUN`；本地浏览器验证不代表原生小程序验收。
- `TASK20_D36_STATUS=PASS_LOCAL_SYNTHETIC_IMPLEMENTATION_AND_AUTOMATION`；`TASK20_NEXT_TARGET=TASK20_D37_M61_CROSS_CLIENT_SCOPE_MATRIX_AUDIT`。
- 仅本地合成演示；未接真实服务；未安装依赖；未提交、推送、部署或发布。
