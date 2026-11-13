# TASK20_D10A_MINI_TEST_ROOT_PORTABILITY

## 目标

修正 Mini 页面共享服务集成测试对本地目录布局的依赖，使其能够指向当前实际存在的本机共享服务工作树。保持所有页面行为、权限断言和合成数据不变，不改受保护的 `staff.test.ts`。

## 授权与依据

- 用户已授权由执行者自主继续项目本地开发，并明确要求停止系统故障调查、恢复项目开发。
- 只运行本机合成测试，不连接真实认证、真实数据、外部服务、云开发或正式 AI。

## 精确写集

仅允许修改以下文件：

- `apps/mini-program/src/pages/shared-health.test.ts`
- `apps/mini-program/src/pages/shared-notice.test.ts`
- `apps/mini-program/src/pages/shared-pickup.test.ts`
- `apps/mini-program/src/pages/supply-request.test.ts`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- 本合同文件

实现工作树：`C:\Users\HU\.codex\worktrees\task20-d10-mini-test-root-portability`。可把主树当前 Mini 文件作为只读基线逐文件复制进隔离树；不得回写或覆盖主树现场，最后只选择性同步上述四个测试文件及治理记录。

## 允许的实现

- 四个测试文件可读取环境变量 `LOCAL_SYNTHETIC_CORE_ROOT`，以其指定的本地共享核心工作树构造 API 服务入口路径。
- 未设置变量时，保留原有 `../task20-local-shared-core` 默认路径，兼容标准相邻工作树布局。
- 继续使用现有真实本机进程内服务和页面流程断言，不跳过测试、不降低断言、不修改业务页面或服务。

## 禁止范围

- 禁止修改 `apps/mini-program/src/pages/staff.test.ts`，以及 Mini 页面、路由、`app.json`、配置、生成 JS、API 或服务实现。
- 禁止安装依赖、修改依赖声明或 lockfile、接入真实服务/数据、访问云开发、提交、推送、部署或发布。
- 若需要修改上述写集之外的文件，停止并重新评估，不扩大范围。

## 验收与验证

1. 在隔离工作树使用 `LOCAL_SYNTHETIC_CORE_ROOT` 指向当前真实存在的本机共享核心工作树，确认四个文件内相关页面/API 集成流程全部通过。
2. Mini TypeScript 检查、四个测试文件 ESLint 和 `git diff --check` 通过。使用已安装 Prettier 接口检查本任务新增/替换代码片段；若全文件检查暴露本任务前就存在的格式差异，不对整份文件做无关重排，并如实记录。
3. 运行 Mini 页面测试矩阵并准确记录所有结果。受保护的 `staff.test.ts` 保持原样；其已知旧路由/文案断言结果单独记录，不得通过跳过或改写测试制造全绿。
4. 精确审计写集、四个目标文件哈希、依赖/lockfile 和主工作树保护路径。

## 停止条件

若本地共享核心工作树缺少已编译服务入口，测试需要真实网络/外部服务，或修复要求改动业务实现及白名单外文件，停止该部分并报告证据。
