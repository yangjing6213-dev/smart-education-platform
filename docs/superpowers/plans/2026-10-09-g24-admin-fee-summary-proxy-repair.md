# TASK20_G24_ADMIN_FEE_SUMMARY_PROXY_REPAIR

## 0. 任务来源与当前证据

- 主项目方案：`student-care-platform-complete-plan-v2.0.pdf`；当前 V3 计划固定 SHA-256：`ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。
- 用户已明确要求由 Codex 自主继续剩余项目开发；本批只修复本机合成演示里的管理网页费用读取代理，不扩展到真实服务或发布。
- 原 G2.4 合同：`docs/superpowers/plans/2026-10-07-g24-mini-admin-shared-fees.md`，SHA-256 `65DC0B5ADB42588ECD6B195FEA7DB8C6F482B584B45D0F9D0025BD85FEA271B4`。
- 主工作树基线 HEAD：`bd0001faa8e2fd7bbabe86e3d778ba24431107e8`；实现分支从该基线建立独立工作树，不合并或重置任何既存工作。
- 当前主树已有 `/admin/fees` 页面、费用客户端与合成费用测试；客户端读取 `/local/fee-summary` 和 `/local/fee-ledger-summary`，但 `apps/admin-web/src/local-proxy.mjs` 的路径白名单未放行这两个只读地址，浏览器实际请求会被代理拒绝。
- G2.4 Mini 的客户端、页面、生成 JS、模板和 `shared-fees.test.ts` 与原 G2.4 实施树对应文件逐文件 SHA-256 完全一致；本批不再复制或修改 Mini 文件。
- 主树代理基线 SHA-256：`656147007748B98126F5E8B496A6939324EF3E0FFE391E00ECFD19B0DDAB651F`；新增回归测试文件当前不存在。

## 1. 目标与验收

1. 仅允许对 `/local/fee-summary` 和 `/local/fee-ledger-summary` 的无查询参数 `GET` 请求通过本机代理。
2. 两个地址的写请求、带查询参数请求、其他路径、伪造身份/范围请求仍被拒绝；成功请求只转发到 `127.0.0.1` 本机服务，并保留原有短时会话头。
3. 新增一个不安装依赖的 Node HTTP 回归测试，使用进程内本机夹具验证允许与拒绝边界，并确认上游只收到两个预期的只读请求。
4. 主树现有费用页面、校区汇总/平台匿名汇总与 Mini 费用能力保持不变。
5. 通过后按基线 SHA 复核，选择性同步一个代理文件和一个新测试文件；主树复跑定向检查。

## 2. 精确写集

隔离工作树 `C:\Users\HU\.codex\worktrees\task20-g24-admin-fee-proxy-sync`：

- `MODIFY apps/admin-web/src/local-proxy.mjs`
- `CREATE apps/admin-web/test/fees-proxy.test.mjs`

主树治理记录：

- `MODIFY PLANS.md`
- `MODIFY docs/exec-plans/active/project-completion.md`
- `MODIFY docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `CREATE docs/superpowers/plans/2026-10-09-g24-admin-fee-summary-proxy-repair.md`

为隔离测试，仅把主树现有 `apps/admin-web/src/local-proxy.mjs` 按上述 SHA 复制为隔离基线；不覆盖其他文件。实现后只选择性同步上述两个产品文件，且主树原代理 SHA 与新增测试不存在状态必须保持一致。

## 3. 限制与停止条件

- 只使用本机合成数据，不连接外部网络、真实认证、数据库、支付或合作方服务。
- 不修改 Mini、User Web、Admin 页面/客户端、API、数据库、路由注册、配置、依赖或 lockfile；不得读取或修改 Mini `apps/mini-program/src/pages/staff.test.ts`。
- 不覆盖、清理或重排主树其他工作；不提交、推送、部署、发布。
- 若需要增加写集、发现代理基线变化，或上游接口无法支持最小只读转发，停止并记录证据。

## 4. 验证

- 先运行新增代理测试并观察两个费用 GET 被拒绝的预期失败，再修改白名单并重跑。
- 运行 Admin 费用客户端定向测试、代理集成测试、Admin 定向类型检查/构建、ESLint、Prettier、`git diff --check` 和写集审计。
- 主树整合前后均核对产品文件哈希；整合后重复相同定向验证。
- 只读独立代码复核记录 Critical/Important/Minor 数量。Admin 费用页面当前已有的自动验证不替代负责人验收；管理端人工浏览器点击未执行时记录 `NOT_RUN`。

## 5. 状态

- 初始状态：`IN_PROGRESS`；流程深度：`LIGHTWEIGHT_WITH_PROXY_BOUNDARY_REVIEW`。
- 独立复核、主树选择性同步和 Owner Review 分别记录；任何一项均不得互相代替。
