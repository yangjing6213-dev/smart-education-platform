# TASK20 D49 User Web 学习页快速离开时的请求竞态

> 复用当前项目完成计划与 V3 路线图；仅修复本轮定位到的本机页面切换缺陷。

## 0. 依据与基线

- **任务 ID：** `TASK20_D49_WEB_LEARNING_NAVIGATION_SESSION_RACE`。
- **来源：** D48 后重新核对 V3 M3.3 时，确认 User Web 家长接送授权/凭证/历史入口已经在主树；现有接送浏览器流程却因导航时 `/local/learning-knowledge` 返回 401 而失败。直接调用本机服务并提供已审核合成关系时，该接口返回 200。代码显示学习页离开时会清除会话，而未完成的 `refresh()` 仍可能继续用已清除的会话发起后续请求。
- **隔离工作树：** `C:\Users\HU\.codex\worktrees\task20-web-completion`。
- 写入前 `apps/user-web/src/local-synthetic/learning.ts` 主树与隔离树 SHA-256 相同：`CF9CDCF4B25387A92963A53848F8C5A027D6F040CE2128E7FF44120E6BBA5875`。
- 本地预览生成文件 `apps/user-web/dist/local-synthetic/learning.js` 两树基线相同：`0656689EA943279E6872A2D7F0442C7536C183595B313FB8B57604E446BD97BC`。
- 对应 source map `apps/user-web/dist/local-synthetic/learning.js.map` 两树基线相同：`9AA241846B3E2416140DDEB559D927F921311FBEC379B74C8B51EEE7AFB9B1E3`。
- **数据与操作边界：** 用可控的内存假响应测试，不访问真实学生或外部服务；浏览器复核只访问 loopback。禁止安装依赖、改 lockfile、提交、推送、部署、发布。

## 1. 完成标准

1. 用户离开学习页或切换身份后，已失效的连接、刷新和学习操作不得发起后续 API 请求，也不得覆盖新页面的连接状态。覆盖开启学习、答题、查看提示、结束、教师接手和删除操作；身份变化后旧请求不得更新当前身份快照。
2. 新增延迟响应回归测试：在家长资料列表请求尚未完成时断开页面；在开启学习请求尚未完成时切换到教师身份；在删除请求尚未完成时断开页面。旧逻辑分别会继续请求或写入过期状态，修复后页面保持当前身份/断开状态且不混入旧记录。
3. 对应 TypeScript 源和仅本轮生成的 `dist/local-synthetic/learning.js` 及其 source map 行为一致；不重建其他 Web 或 API 产物。
4. 重新运行既有家长接送浏览器流程；不允许把服务 401、外部请求、浏览器错误或溢出当成可忽略结果。

## 2. 精确写集

- `apps/user-web/src/local-synthetic/learning.ts`
- `apps/user-web/src/local-synthetic/learning-client.test.ts`（新建）
- `apps/user-web/dist/local-synthetic/learning.js`（仅由本轮 TypeScript 源生成且内容变化时）
- `apps/user-web/dist/local-synthetic/learning.js.map`（仅由本轮 TypeScript 源生成且内容变化时）
- 本合同
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`

只读复核 `apps/user-web/test/parent-pickup-browser.mjs`，不得修改。其他路由、页面、API、配置、依赖、lockfile 与 Mini 文件不在范围内。若任何额外路径成为必要，先记录原因与精确范围，再作为独立任务继续，不扩大本任务写集。

## 3. 步骤

1. 先新增延迟响应测试，运行并确认其在当前实现下因断开后仍发出学习资料请求/覆盖断开状态而失败。
2. 为连接、刷新和所有异步学习操作增加最小身份代次检查；断开或换身份使旧操作失效。旧操作只可结束自身，不得发新请求或写回页面状态。请求固定使用发起操作时捕获的本机会话句柄。
3. 重跑回归；通过已安装 TypeScript API 仅转译 `learning.ts` 到列出的本地预览 JS/source map，若字节未变化不重写。
4. 在隔离树运行客户端测试、User Web typecheck、目标 ESLint/Prettier、生成 JS 语法检查及差异/范围审计。隔离树没有 `apps/user-web/test/parent-pickup-browser.mjs`，不复制它。
5. 逐文件确认主树基线未变化后选择性同步精确写集；在主树重跑客户端测试与接送浏览器流程，并完成同范围检查。

## 4. 验收命令与边界

- `node --experimental-transform-types --test apps/user-web/src/local-synthetic/learning-client.test.ts`
- User Web TypeScript no-emit 检查、目标 ESLint 与 Prettier API 检查。
- `node --check apps/user-web/dist/local-synthetic/learning.js`。
- 仅在主树同步之后，将 `TASK20_LOCAL_SYNTHETIC_SERVER_MODULE` 指向现有本机 API 构建并运行：`node --test apps/user-web/test/parent-pickup-browser.mjs`；预览与 API 均限定 loopback，不设置截图输出环境变量。
- 运行精确目标的 `git diff --check`、新增文件尾随空格检查、基线/同步 SHA 与写集审计。
- 微信开发者工具实际点按不属于本 Web 任务，也不得由浏览器测试替代。

## 5. 结果

- TDD 红绿：最初的延迟刷新测试在旧实现中复现断开后仍继续发出 `/local/learning-knowledge` 请求；修复后客户端 3 项测试通过，覆盖刷新时断开、开启学习期间切换到教师身份、删除请求期间断开。独立复核又发现答题、提示、结束、教师接手及教师摘要刷新也需要相同的身份保护，已为所有异步学习操作统一捕获代次、会话句柄和角色，并在响应后检查再写入。
- 隔离树与主树验证：客户端 `3/3`；User Web typecheck、目标 ESLint、目标 Prettier API、生成 JS 语法检查通过。TypeScript API 只重建 `learning.js` 与 `learning.js.map` 两个允许产物；未生成或改动既有声明文件。
- 主树家长接送浏览器流程 `1/1` 通过；测试验证导航过程中无 401、无浏览器异常/失败响应/外部请求及无横向溢出。
- 独立复核：无 Critical、Important 或 Minor 发现。主树与隔离树的四个任务文件哈希一致，写集为四个 User Web 文件和四个治理文件；真实认证、数据、外部服务、依赖/lockfile 与其他配置均未改。
- 尚未完成：此结果是本地合成自动化证据，不等于负责人验收；微信开发者工具手工点击不属于本 Web 任务，仍按 G25 记录为未运行。
