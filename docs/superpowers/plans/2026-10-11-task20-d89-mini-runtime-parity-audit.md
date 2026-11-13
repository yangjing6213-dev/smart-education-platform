# TASK20 D89：主工作树 Mini TypeScript/生成 JS 一致性只读审计

## 目标

确认主工作树 Mini 当前 TS 源码与微信开发者工具读取的相邻 JS 文件是否同步。只在内存中编译并与现有 JS 比较；本任务不写回、不格式化或修复任何 Mini 文件。

## 基线

- 工作树：`C:/Users/HU/Documents/student-care-saas-platform`，HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。
- D88 V3 证据校准合同 SHA-256：`F9B83EE92F607725A2149D0774638DCE16BEA129247072683D9F35E0ABB6C691`。
- 主树 Mini 有 38 个非测试 TypeScript 源文件；注册页工件存在性与 Mini TypeScript 检查已通过，但 JS 内容同步尚未核对。
- 主树与只读参考脚本所在隔离树的 TypeScript 版本均为 `5.7.3`，可用同版本比较编译结果。
- 复用脚本 `C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign/scripts/mini-runtime.mjs`。已审阅其逻辑：默认仅内存编译和比较；只有显式传入 `--write` 才写文件。D89 禁止传入 `--write`。

## 精确写集

- CREATE：`docs/superpowers/plans/2026-10-11-task20-d89-mini-runtime-parity-audit.md`。
- MODIFY：`PLANS.md`，记录审计结果和下一目标。
- MODIFY：`docs/exec-plans/active/project-completion.md`，同步结论。
- Mini 配置、源码、测试、页面、生成 JS、依赖、lockfile 与参考隔离树全部只读。

## 验证步骤

1. 在运行编译器前确认参考树与主树 TypeScript 版本相同；再解析主树 `apps/mini-program/tsconfig.json` 文件清单并断言它不含 `apps/mini-program/src/pages/staff.test.ts`。若版本不一致或文件清单包含该路径，立即停止，不运行脚本。
2. 执行 `node C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign/scripts/mini-runtime.mjs --mini-root C:/Users/HU/Documents/student-care-saas-platform/apps/mini-program`，不得添加 `--write`。记录注册页数量、编译输出数、差异数和退出码。
3. 若结果无差异，记录静态/内存编译一致性通过，但不等同微信开发者工具实点。若发现差异，只记录具体路径，不修改；建立 D90 精确生成文件修复任务。
4. 对本合同、PLANS 与活动计划执行 Prettier 3 API、尾随空白、`git diff --check` 和精确写集审计。

## 禁止事项与停止条件

- 不读取、编译或运行受保护 `apps/mini-program/src/pages/staff.test.ts`；不以通配符测试或编译。
- 不使用 `--write`，不调用微信开发者工具 CLI，不打开网络、不安装依赖。
- 若脚本依赖解析失败、编译清单包含受保护文件或目标路径超出 Mini 子目录，立即停止并报告。

## 状态

`PARTIAL_MINI_RUNTIME_STALE_ONE_OUTPUT;STAFF_TEST_EXCLUDED;READ_ONLY_NO_WRITE`

- 主树与参考树 TypeScript 均为 `5.7.3`；主树配置解析出 15 个输入文件，受保护测试未列入编译清单。
- 内存编译器检查了 11 个注册页面，发现 1 个不一致输出：`apps/mini-program/src/local-synthetic/client.js`。脚本退出码 1。未传 `--write`，因此本任务没有修改 Mini 文件。
- 这说明该 JS 生成文件与当前 TypeScript 源码不同，可能导致微信开发者工具执行旧逻辑；具体影响需在同步后重跑生成模式测试和人工点按，不能仅凭差异推断页面已坏。
- D89 未读取、运行、编译或修改受保护测试；未触及配置、依赖、lockfile 或其他产品文件。
- D90 将在写入前再次断言唯一陈旧路径仍是 `src/local-synthetic/client.js`，再只重新生成该文件，并运行 Mini 全套安全测试的生成 JS 模式。
