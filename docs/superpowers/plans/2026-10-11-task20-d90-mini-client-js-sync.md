# TASK20 D90：同步 Mini 本机合成客户端生成 JS

## 目标

修复 D89 查明的唯一过期运行文件，使主树小程序加载的 `client.js` 与当前 `client.ts` 一致。只重新生成该文件，不改 TypeScript 源码或其他业务文件。

## 基线

- 工作树：`C:/Users/HU/Documents/student-care-saas-platform`，HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。
- D89 合同 SHA-256：`E827F314EB8337B04490C0942E3F591ABC7F3B116E9CAC94685A2DD3413030D0`；只读发现唯一陈旧输出 `src/local-synthetic/client.js`。
- TypeScript 源码 `apps/mini-program/src/local-synthetic/client.ts` SHA-256：`EA949C257D7496A4BF3EB7980250DB4EFEE5837D510EC2F7070A770DF805F561`。
- 生成 JS `apps/mini-program/src/local-synthetic/client.js` 执行前 SHA-256：`1F7A2A87ED0A5F6A6FB7E8D1DEECACC2324CA1C9BF93DFA719AF90ECEFB97BD5`。

## 精确写集

- CREATE：`docs/superpowers/plans/2026-10-11-task20-d90-mini-client-js-sync.md`。
- MODIFY：仅生成文件 `apps/mini-program/src/local-synthetic/client.js`。
- MODIFY：`PLANS.md`，记录 D90 与下一目标。
- MODIFY：`docs/exec-plans/active/project-completion.md`，同步 D90 结果。
- Mini TypeScript 业务源、其他生成文件、页面、配置、测试、依赖、lockfile、其他应用均只读。

## 实施与验证

1. 运行 D89 的无写入核对，只有当输出仍严格为 `pages=11 stale=1` 且唯一相对路径为 `src/local-synthetic/client.js` 时，才允许继续。若差异数量或路径变化，停止，不写任何文件。
2. 使用已审阅的 `mini-runtime.mjs` 对主树 Mini 根目录运行 `--write`，记录实际输出；生成器完成所有编译和边界校验后才写入。
3. 立刻再次运行无写入核对，必须输出 `updated=0`。
4. 运行 Mini TypeScript `--noEmit`、页面注册护栏、32 个安全 Mini 测试文件的生成 JS 模式全套（并发 1，明确排除 `apps/mini-program/src/pages/staff.test.ts`）。
5. 复核该 JS 新 SHA、D90 精确写集、`git diff --check`；不得通过格式化或手改编译结果。

## 禁止事项与停止条件

- 若写入前清单不是唯一 `client.js`，立即停止并记录，不扩大写集。
- 不传写回标志到任何非授权文件，不读、运行、编译或修改受保护 `staff.test.ts`。
- 不安装依赖，不改 lockfile，不连接真实服务/数据，不提交、推送、部署或发布。
- 自动化通过不代表微信开发者工具人工点击/视觉验收或 Owner Review 通过。

## 状态

`PASS_SINGLE_GENERATED_JS_SYNC;POST_COMPILE_PARITY_PASS;GENERATED_SAFE_SUITE_226_OF_226`

- 写入前两份基线哈希均匹配，编译器只报告 `src/local-synthetic/client.js` 一个过期输出；保护测试不在编译清单。
- 生成器结果：`MINI_RUNTIME_PASS pages=11 outputs=34 updated=1`，唯一更新路径为 `src/local-synthetic/client.js`。随后只读复核为 `MINI_RUNTIME_PASS pages=11 outputs=34 updated=0`。
- 32 个安全 Mini 测试文件生成 JS 模式共 226/226 通过，退出码 0；明确排除受保护 `staff.test.ts`。Mini TypeScript `--noEmit`、页面注册生成文件护栏和该 JS 的 Node 语法检查均通过。
- TypeScript 源文件 SHA 保持 `EA949C257D7496A4BF3EB7980250DB4EFEE5837D510EC2F7070A770DF805F561`；更新后 `client.js` SHA-256 为 `684250982A06FF8FFED60C3FAA7851BE1F775AD80CD50714A049DCAD2F7722E7`。
- 本合同 Prettier API 核对通过，`git diff --check` 退出码 0；Git 只提示既有文件的换行符转换。除 `client.js` 外没有修改 Mini 产品或生成文件；依赖和 lockfile 未改。
- 微信开发者工具原生运行/视觉验收仍 `NOT_RUN`。JS 同步消除了已确认的 TS/JS 差异，但不代替本机模拟器实点。
- 下一步 D91：把 D89/D90 的运行文件一致性结果同步到 V3，保留人工 DevTools 点按和 Owner Review 为待完成项。
