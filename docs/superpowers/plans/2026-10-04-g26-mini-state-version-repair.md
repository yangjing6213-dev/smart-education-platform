# G2.6 Mini 状态与版本语义最小修复记录

- 日期：2026-10-04
- 触发：G2.6 只读审查发现 Mini 健康异常模型仍使用旧的 CANCELLED/EXCEPTION_PENDING 状态，并且关键动作没有递增 version。
- 依据：docs/superpowers/plans/2026-10-04-g26-health-shared-synthetic.md；本记录只修复 Mini 合成投影与其生成运行文件，不改变共享服务、Web、Admin 或真实服务边界。
- 精确修改集（隔离树 C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign）：
  - apps/mini-program/src/pages/health-incidents.ts
  - apps/mini-program/src/pages/health-incidents.test.ts
  - apps/mini-program/src/pages/health-incidents.js（由 TypeScript 编译生成，内容确有变化）
  - docs/exec-plans/active/mini-health-incident.md
- 状态收敛：DRAFT、SUBMITTED、RETURNED、CONFIRMED、PUBLISHED、REVOKED。
- 版本规则：创建为 1；提交、审核、发布、撤回和退回重提均推进版本；旧版本动作拒绝。
- 隐私规则：家长仅可见 PUBLISHED 的固定摘要；员工观察、审核和内部信息不投影。
- 不新增路由、index.json、app.json、配置、依赖或网络；不修改 apps/mini-program/src/pages/staff.test.ts；不整合主树、不提交、不推送、不部署、不发布。
- 验证：health focused 6/6、parent health/entry 20/20、staff binding/leave 12/12、Mini typecheck、runtime 9 pages/30 outputs、runtime guard 5/5、git diff --check。
- 结论：PASS_LOCAL_SYNTHETIC_MINI_STATE_VERSION_REPAIRED；原生微信全角色点击仍为 NATIVE_NOT_RUN。
