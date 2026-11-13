# TASK20 D09: Web/Admin 默认测试矩阵与本地资源更新修复

## 目标

让 Web 与 Admin 的默认测试命令运行各自现有的全部测试文件；修复完整测试运行中确认的两项问题：Admin 静态断言错误地禁止本机合成服务请求，以及资源范围更新接口把可选字段误判为必填，导致真实页面提交返回 `400 INVALID_REQUEST`。

所有数据仅为合成数据。所有服务仅绑定本机回环地址；不接入真实机构、真实认证、外部网络、数据库、伙伴云或正式 AI。

## 实施范围（精确写集）

允许修改：

1. `package.json`：根测试命令增加 User Web 全量测试入口；保留已有脚本改动。
2. `apps/admin-web/package.json`：测试命令运行 `test/` 下全部 `.test.mjs`，串行执行。
3. `apps/user-web/package.json`：测试命令运行编译输出中全部 `.test.js`，串行执行。
4. `apps/admin-web/test/home-content.test.mjs`：把旧的“禁止 fetch”断言修正为允许受限的本机请求、禁止外部地址及小程序请求。
5. `apps/admin-web/test/resource-library.test.mjs`：保留现有浏览器流程及视口检查，避免绑定到其他 worktree 的硬编码路径。
6. `apps/admin-web/preview.mjs`：重试浏览器禁用端口，避免随机端口导致 Chromium 无法打开本地预览。
7. `apps/api/src/local-synthetic/binding-leave.service.ts`：让 `exactBody` 可显式声明可选字段，继续拒绝缺失必填项和未知字段。
8. `apps/api/src/local-synthetic/routes.ts`：资源更新路由将 `classId`、`learningSourceAction` 声明为可选字段。
9. `apps/api/test/local-synthetic-resource-library.test.ts`：为必填、可选、未知字段行为增加单元覆盖。
10. `apps/user-web/src/pages/care-record-workflow.test.ts`：让源码检查在编译后的测试位置仍可定位源码。
11. `apps/user-web/src/pages/staff-content.test.tsx`：同上，使用模块相对路径读取三个页面源码。
12. `apps/user-web/src/pages/staff-leave-review.test.ts`：使用模块相对路径载入编译后的员工路由。
13. `PLANS.md`：记录 D09 结论、验证证据和下一项工作。
14. `docs/exec-plans/active/project-completion.md`：同步活动完成记录。
15. `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`：校准 D09 状态。
16. 本合同文件。

## 隔离工作树与基线

- Admin/API 实施工作树：`C:\Users\HU\.codex\worktrees\task20-admin-completion`
- User Web 测试入口工作树：`C:\Users\HU\.codex\worktrees\task20-web-completion`
- 两者 HEAD 均为 `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。
- 主工作树 `package.json` 已包含其他既有改动；任何合并都必须保留其完整原内容，并仅增加本任务所需的 User Web 测试调用。
- 主工作树 Admin 测试文件已存在未提交改动；必须逐文件、逐差异选择性整合，不得覆盖或清理其他现场。
- 主工作树 Admin、User Web 与 `apps/api/src/local-synthetic/` 含本阶段前已存在的修改/未跟踪源码。为让隔离树按同一份当前代码运行完整测试矩阵，只允许将这些应用目录中 `git status` 已列出的当前文件逐文件种入新的 D09 隔离树，并把现有 `apps/api/dist/` 作为只读测试基线。种入只复现已存在基线，不扩大可编辑写集；只允许改动上方精确写集中的文件，不得回拷或覆盖主工作树文件。
- D09 隔离实施树：`C:\Users\HU\.codex\worktrees\task20-d09-web-admin-test-matrix`，从同一 HEAD 新建；User Web 与 Admin/API 在这一项跨端测试覆盖任务中共享该专用隔离树，Mini 不参与本项。

## 禁止范围

- 禁止真实数据、真实认证、外部网络/服务、生产数据库、伙伴云或正式 AI。
- 禁止安装依赖、改依赖声明或修改任何 lockfile。
- 禁止修改 `staff.test.ts`、配置文件、其他页面/API 模块或本合同外路径。
- 禁止覆盖/清理主工作树既有未跟踪文件；禁止 `git add .`、`git add -A`、commit、push、部署和发布。
- 如果实现必须修改写集之外的文件，停止并报告。

## 验收与验证

1. 先确认当前资源管理浏览器测试在本机合成服务中失败，并且失败来自 `400 INVALID_REQUEST`；确认来源管理与普通更新仍使用相同的必填更新字段。
2. API 定向测试验证可选字段接受、必填字段缺失拒绝、未知字段拒绝；资源管理浏览器测试验证范围/到期时间保存、版本递增、教师可见范围、撤回与平台匿名汇总。
3. 管理端本机预览始终返回 Chromium 可访问的端口；家长网页全量测试从编译产物启动时也能找到源码检查目标。
4. User Web 全量测试：`node --test --test-concurrency=1 dist/**/*.test.js`。
5. Admin 全量测试：`node --test --test-concurrency=1 test/*.test.mjs`。
6. API 定向测试：资源库服务测试及相关类型检查；API 全量类型检查若仍受其他既有未导出类型影响，记录为 `FAIL/NOT_RUN` 并定位，不通过改动合同外依赖来消除。
7. 对改动的包和源文件运行 TypeScript、ESLint、Prettier（使用项目已安装工具）、`git diff --check` 和精确写集审计。
8. 不声称微信原生视觉验收、负责人验收或正式服务验收通过。

## 停止条件

发现外部请求、需新增依赖/lockfile、写集外修改、主工作树冲突无法安全保留，或页面流程根因超出本地合成资源更新边界时，停止该部分并记录证据；其余独立可完成测试入口修复可继续。
