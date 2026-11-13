# TASK20 D87：主工作树 User Web 访客与员工 E2E 复核

## 目标

复核主工作树 User Web 访客公开页面、员工入口和本地预览服务。此前发现这些 E2E 文件使用 Node 内置测试工具，不依赖 Playwright；使用当前已安装 Node 运行，不下载浏览器或安装工具。

## 基线

- 工作树：`C:/Users/HU/Documents/student-care-saas-platform`，HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。
- D86 主树 User Web/Admin Web 测试、类型检查和 ESLint 已通过；User Web 编译输出已刷新在 `apps/user-web/dist/`。
- 目标测试：`tests/e2e/visitor.spec.ts`、`tests/e2e/user-web-runtime.spec.ts`。

## 精确写集

- CREATE：`docs/superpowers/plans/2026-10-11-task20-d87-user-web-e2e-recheck.md`。
- MODIFY：`PLANS.md`，记录本轮 E2E 结果和下一步。
- MODIFY：`docs/exec-plans/active/project-completion.md`，同步本轮结论。
- 上述两个 E2E 文件、User Web/Admin Web 业务代码、配置、依赖与 lockfile 只读。预览进程只能绑定 `127.0.0.1` 随机端口，并在测试结束时关闭。

## 验证顺序

1. 串行运行 `node --experimental-strip-types --test --test-concurrency=1 tests/e2e/visitor.spec.ts tests/e2e/user-web-runtime.spec.ts`。
2. 记录通过/失败数、进程退出码、预览路由状态、页面错误、失败响应和外网请求检查结果。
3. 运行 `git diff --check` 与本合同/两份测试的范围审计；禁止安装依赖或修改任何源码和配置。
4. 若失败，先判定是断言陈旧、预览缺陷还是运行环境问题；D87 不修改业务代码，必要时建立 D88 最小修复任务。

## 结果与状态

`PASS_USER_WEB_VISITOR_AND_RUNTIME_E2E_4_OF_4`

- 指定的两份 E2E 共 4 项全部通过，退出码 0；访客投影与本地预览均在主工作树运行。
- loopback 预览实际响应访客首页、兼容入口、机构介绍、一日流程，以及员工工作台、日报、指南、资源页，均为 HTTP 200；`main.js` 可读取；目录穿越路径返回 404。
- 访客检查确认仅展示合成公开内容，并断言没有外网请求；联系意向仍为本地行为。预览进程在测试结束后关闭。
- Node 输出既存的模块类型性能提示，不影响测试。测试文件、源码、配置、依赖和 lockfile 未修改；没有下载或启动真实浏览器，所以本次是 HTTP/投影级 E2E smoke，不是人工视觉复核。
- 没有新增业务代码缺陷证据。Mini 微信开发者工具人工点按与负责人验收仍未完成；D87 不把本机预览证据外推到这些门槛。
