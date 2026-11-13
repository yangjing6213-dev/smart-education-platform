# TASK20 G5.5 管理网页主工作树选择性整合合同

**状态：** `PASS_LOCAL_AUTOMATED_AND_INDEPENDENT_REVIEW; UI_VISUAL_CLICK_NOT_RUN; OWNER_REVIEW_PENDING`  
**日期：** 2026-10-08  
**上游实现合同：** `docs/superpowers/plans/2026-10-08-g55-media-asset-lifecycle-synthetic.md`，SHA-256 `A5C2B142B685C4D024D2E6DA2D84AE92E17EB0A7DC2247286EE706970769F342`。  
**依据：** 用户已授权由执行者继续项目本地开发；主控制面 `PLANS.md` 明确当前使用合成资料与隔离工作树，并要求按批次选择性整合。本合同只记录本次主工作树同步范围，不代表负责人验收或真实运营批准。

## 1. 目标与约束

把 G5.5 已验证的文件引用生命周期页面选择性接入主工作树的机构管理网页，并从统一本机启动入口获取本机服务端口。页面沿用既有 `/admin/files` 路由，支持查看本机合成媒体、替换引用、检查查看权限、归档、撤回和本机软删除。页面不得连接非回环地址；没有合法的本机服务端口时不得发网络请求。只处理固定合成元数据，不处理文件字节。

隔离来源 `C:\Users\HU\.codex\worktrees\task20-admin-completion` 保持只读。媒体模型 SHA-256 `697FA2B850308ED50C5D9BD093A858AFD6AE5F911509F07E0CA12EEDB074063E`，页面 SHA-256 `5CC95E6399107A4884B7BA86BC2F978AA45CED7445A7DC7D783F7B49D467DD48`，测试 SHA-256 `7E05F5BDD660F72B407ED0CC9D1F51ACB275E27812C07C5A6C4DFC01214C3281`。不复制来源 `main.ts`、预览服务或其他工作树文件。

## 2. 精确写集

仅允许：

- CREATE `apps/admin-web/src/local-review/media-assets.ts`：来自上述来源文件；增加只允许 `http://127.0.0.1:<有效端口>/local/*` 的传输适配。无效端口、非回环主机或 `/local/` 以外路径均拒绝，且不得调用底层网络传输；客户端断开时使旧异步操作失效，防止切页后恢复过期状态。
- CREATE `apps/admin-web/src/pages/file-lifecycle.ts`：逐字选择性复制来源页面。
- CREATE `apps/admin-web/test/file-lifecycle.test.mjs`：逐字复制来源测试后，只增加回环地址限制、端口传递、真实本机合成服务客户端集成和断开期间异步请求失效的覆盖。
- MODIFY `apps/admin-web/src/main.ts`：只增加媒体客户端/页面导入与实例，替换既有静态 `renderFiles()` 占位，增加离开 `/admin/files` 或权限被拒时断开客户端；异步回调仅在仍处于允许的文件页时重绘；保留 G5.3B/G5.4/G6.4 及其他现有主工作树代码。
- MODIFY `scripts/start-local-demo.mjs`：仅给管理网页入口 URL 附加实际本机合成服务端口参数 `mediaServicePort`；不改监听地址、端口选择、服务顺序、路径或其他 URL。
- MODIFY `tests/local-synthetic/demo-launcher.test.mjs`：仅增加断言，验证管理网页入口携带的端口与实际本机服务端口一致。
- MODIFY `PLANS.md`：记录本合同、执行状态、验证结果和下一目标；保留已有现场及历史回执。
- MODIFY `docs/superpowers/plans/2026-10-08-g6-roadmap-reconciliation-after-g62.md`：仅同步 G5.5 主树整合结果及剩余视觉验收门槛，不重写其他阶段记录。
- CREATE 本合同 `docs/superpowers/plans/2026-10-08-g55-main-tree-selective-sync.md`。

当前主工作树已有文件基线：`apps/admin-web/src/main.ts` SHA-256 `0958914241992C912B88162EB316F1CC0B306D8BBA2615E62EFCAD7172FE6DD8`；`scripts/start-local-demo.mjs` SHA-256 `621C52945ADC28ECBE6B49FD739450D165F38031097DE73724EF2E464A3B15CE`；`tests/local-synthetic/demo-launcher.test.mjs` SHA-256 `75123B104397133C6B4ABDAEA87ADE0ABA305837A8BC0B124DA4E6F1BA204419`。三个 CREATE 源目标当前均不存在。

允许的生成输出仅为已忽略的 `apps/admin-web/dist/**`。不得触碰其他既有脏文件或未跟踪文件；特别是不读取或修改 `apps/mini-program/src/pages/staff.test.ts`。

## 3. 明确禁止

- 修改本合同写集以外任何文件，或整文件覆盖既有 `main.ts`、启动器和测试。
- 修改 API、合同包、用户网页、小程序、真实认证、数据库、存储、伙伴云、外部服务、配置、依赖、lockfile 或生产数据。
- 读取真实文件字节、上传/下载文件、创建签名链接或使用真实个人资料。
- 修改/清理其他工作树、安装依赖、提交、推送、部署或发布。

## 4. 验收与验证

1. 先加入失败测试，证明端口参数随 Admin 入口传递；媒体客户端传输只接受当前端口的 `127.0.0.1` 与 `/local/` 路径。无效端口和外站地址不得调用底层传输。
2. 运行管理网页媒体生命周期测试，包含与本机内存合成服务的实际 HTTP 客户端回归，并验证断开期间不会继续请求或恢复旧页面数据；运行统一启动器测试，验证随机测试端口被带入 Admin URL、来源被 API CORS 允许、静态页面可达且服务停止后监听已关闭。
3. 运行 Admin typecheck/build、相关 API 媒体合成测试、目标 ESLint、目标 Prettier、`git diff --check` 和精确写集审计。不得安装依赖或修改 lockfile。
4. 如受支持的浏览器控制工具可用，再执行本机页面实际点击与页面错误/请求检查；否则如实记录 `UI_VISUAL_CLICK=NOT_RUN`。仅 HTTP 路由返回成功不算视觉验收。
5. 进行独立代码复核并修复 Critical/Important 项。最终状态只报告本地自动化/代码复核的实际证据；负责人验收、微信开发者工具验证、真实文件存储仍保持未完成。

本次独立复核指出断开页面后异步请求可能恢复旧状态；已增加连接中、资料加载中、刷新中、管理中和权限校验中的断开回归测试，并用递增请求代次使旧操作失效。复核还指出权限变为拒绝时旧回调可能重绘空文件页；回调现同时检查当前路径与访问状态。

**执行结果：** Admin 媒体生命周期测试 `11/11` 通过；本机媒体 API 测试 `5/5` 通过；启动器测试 `8` 通过、`1` 项因本机 `127.0.0.1:4317` 已被其他进程占用而跳过、`0` 失败。Admin TypeScript 无输出检查与构建、目标 ESLint、目标 Prettier、已修改 `main.ts` 片段 Prettier 核对、写集 `git diff --check` 均通过。独立复核无 Critical/Important；先前 Minor 的异步覆盖和拒绝页重绘问题已修复。当前没有可用浏览器控制器，页面实际点击和视觉验收为 `NOT_RUN`；负责人验收仍待进行。

## 5. 停止条件

若来源文件哈希变化、主树 CREATE 目标已出现内容、必须修改白名单外路径、端口处理必须访问非回环地址、测试指向外部服务或发现会暴露真实资料，立即停止对应实现并记录原因；不得绕过限制扩大范围。
