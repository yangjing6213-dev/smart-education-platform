# TASK20 G5.5 文件引用与生命周期本地合成实施合同

**状态：** `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`  
**日期：** 2026-10-08  
**项目权威：** `C:\Users\HU\Desktop\同芯机构项目\开发方案\student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。方案 `PAGE_INVENTORY.md` 的 A-ADM-12 定义 `/admin/files` 模拟媒体列表、选择/替换/归档、引用冲突和权限校验；文件存储设计明确真实 COS 上传与签名链接尚未实施。  
**授权依据：** 主工作树 `PLANS.md` 的当前自主本地开发控制面及用户持续开发指令。此合同仅表示本地合成演示实现范围，不代表负责人验收、主工作树业务整合或真实运营授权。

## 1. 目标与边界

把现有 `/admin/files` 静态说明升级为可操作的本机文件生命周期演示，并在共享本机服务中强制执行范围、状态、有效期、版本和引用规则。只保存固定样例的元数据，不创建、上传、读取或下载任何文件字节。

- 校区负责人只能看和操作自己当前租户/校区的合成媒体；普通教师和监护人无权查看管理列表；平台管理员只能读取匿名计数，不得获得文件名、引用位置或任何学生/个人明细。
- 页面支持查看、权限检查、替换内容引用、归档无引用素材、撤回素材，以及将已归档且无引用素材标记为本机软删除。所有动作由服务端核验当前会话、租户/校区、允许动作、对象状态、有效期和版本；不能只靠前端隐藏按钮。
- 替换只创建新的引用关系，不覆盖旧文件或发布历史；旧/新素材必须属于相同租户、校区和媒体类型，并提交双方当前版本。
- 仍被引用的素材不能归档或软删除。撤回被引用素材必须显式确认影响；操作后引用关系继续可见并产生本机审计记录，后续查看权限被拒绝。
- 有效期过期、已撤回、已归档或软删除的素材不得通过查看权限检查。检查只返回本机合成的准许/拒绝结果，不签发 URL、不返回存储路径或文件内容。
- 所有记录、变更与审计只在内存中；服务重启恢复固定样例。页面明确标注“合成数据 · 本机演示 · 不是真实文件”。
- 本机负责人会话只提交受合同支持的身份能力；文件管理、成员管理等业务动作仍由本机服务根据会话中的角色动作重新核验。负责人身份不得因为包含未获正式身份合同支持的能力而整体失效。
- `?mode=readonly` 只是页面只读演示状态，页面不得发送变更请求；它不是服务端权限凭据。服务端仅依据可信的本机合成身份与对象范围授权。
- 不改 Web、Mini 或真实机构工作流。后续真实存储仍需单独设计、审批与实现，包含上传校验、短时签名授权、病毒/MIME/大小检查、密钥、保留期限和删除审计。

## 2. 精确写集与基线

主工作树：`C:\Users\HU\Documents\student-care-saas-platform`，基线 `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。开始时 `PLANS.md` SHA-256 `A19F493A6991C7DE10A82D30E2A3C3CEA2FC203E0207F7E427356DE3DFA14177`，项目路线图 SHA-256 `C67453716C66DC0F8F9E3745BB780E162620A1ADE5B077E283A0E2E49457A98B`。仅允许：

- MODIFY `PLANS.md`：将当前目标从 G5.4 推进到 G5.5，追加 G5.5 当前状态与验证回执；保留历史记录。
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`：追加 2026-10-08 进度更正与剩余门槛，不重写历史阶段。
- CREATE 本合同 `docs/superpowers/plans/2026-10-08-g55-media-asset-lifecycle-synthetic.md`。

共享服务隔离工作树：`C:\Users\HU\.codex\worktrees\task20-local-shared-core`，分支 `codex/task20-local-shared-core`，HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。既有文件（已有修改/本地现场，以下值是本任务开始前实测指纹）：

- MODIFY `packages/contracts/src/index.ts` — `88983857607304F42208FADEBCDBABEEBCCCCE3F798988EE08EC45FC4213BB4B`
- MODIFY `apps/api/src/local-synthetic/sessions.ts` — `8DAA9868F6ACA1DCD617987A911955E6CF4DF65AAE3AF95F15410EC3DCFA8D06`
- MODIFY `apps/api/src/local-synthetic/routes.ts` — `6C4DAA28FA9C0453FA85B6277AD3C194358177D1B0BB771CE994FCFF1506E323`
- MODIFY `apps/api/src/local-synthetic/server.ts` — `216BBC8CFFE7B54292CE9A48836605BF0C80A40F607FBA24486469047674B42B`

仅新增：`packages/contracts/src/media-asset.ts`、`apps/api/src/local-synthetic/media-assets.service.ts`、`apps/api/test/local-synthetic-media-assets.test.ts`、`tests/local-synthetic/media-assets.test.mjs`、`docs/exec-plans/active/media-assets-core.md`。

管理网页隔离工作树：`C:\Users\HU\.codex\worktrees\task20-admin-completion`，分支 `codex/task20-admin-completion`，HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。既有文件：

- MODIFY `apps/admin-web/src/main.ts` — `3D90C043084821F070670A3E7D5EA8F379AAE6A18ED0B4B3BD83D19E295A41CD`
- MODIFY `apps/admin-web/src/local-proxy.mjs` — `FACB83193475062A65C580984EAD9BC684E428235C26FCC0F231FE04E1CB6683`

仅新增：`apps/admin-web/src/local-review/media-assets.ts`、`apps/admin-web/src/pages/file-lifecycle.ts`、`apps/admin-web/test/file-lifecycle.test.mjs`、`apps/admin-web/test/file-lifecycle-browser.mjs`、`docs/exec-plans/active/admin-files.md`。现有 `apps/admin-web/preview.mjs` 已注册 `/admin/files`，不修改。

小程序现有活动计划记录位于 `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`，分支 `codex/task20-mini-brand-redesign`、HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`；`docs/exec-plans/active/project-completion.md` 基线 SHA-256 `E58FCF8134F58705C3378853BD6B2098C8B1CB391048CB29EACA42EBA57AFF76`。仅允许追加本阶段状态和未完成门槛，不改 Mini 页面或测试。

类型检查/构建只允许产生各隔离树 `apps/api/dist/**` 与 `apps/admin-web/dist/**` 下已忽略的本机生成文件；浏览器测试只清理本测试自己创建的临时目录。所有其他既有脏文件、未跟踪文件、回退工作树和测试均为保护现场，不得读取、覆盖、清理、移动或纳入本合同。

## 3. 实施顺序

1. 先在 API 服务测试中写失败用例，覆盖负责人身份可用、业务能力仍受服务端约束、校区/租户隔离、无权拒绝、有效期、版本冲突、替换引用、引用冲突、归档、撤回、软删除和查看权限审计；再实现最小合成服务及会话动作检查。
2. 在 Admin 模型/UI 测试中验证授权、只读、无权、异常返回、操作后列表刷新与不显示存储地址；再接入现有 `/admin/files` 页面和本机代理白名单。
3. 运行真实本机 Admin 预览与共享服务的浏览器点击复核：东/西校区隔离、替换、引用冲突、归档/撤回、权限检查、软删除、只读/无权与刷新重置；拦截并断言没有外部网络请求。
4. 运行 API/Admin focused tests、类型检查与构建、ESLint、Prettier、`git diff --check`、精确路径审计；更新本合同、主控制面、路线图和三个执行记录，只记录实际结果。

## 4. 验收标准

- API 每次操作都从本机会话重建成员并使用服务端成员范围；不能通过请求参数、伪造身份头、旧版本或跨校区对象改变权限。
- 平台管理员只收到无对象明细的聚合计数；教师/家长不能通过 API 读取或改动管理素材。
- 同租户、同校区、同媒体类型和有效版本才能替换引用；被引用素材归档/删除失败，未经显式确认不能撤回引用中的素材。
- 有引用的素材处于 `REFERENCED`、`EXPIRED` 或 `REVOKED` 状态时，负责人可将引用迁移到同校区、同类型、可用且版本匹配的素材；源素材仍保留原状态与审计历史。
- 过期、撤回、归档、软删除素材查看权限均被拒绝并留下不含内容正文/路径的本机审计条目；有效素材也只返回合成权限结果，不返回下载地址或二进制。
- 页面提供清楚的中文状态、冲突原因和操作结果；只读或无权模式不可执行，刷新回到固定样例。
- 页面刷新从本机服务重新读取当前内存状态；本机服务重启后才恢复固定样例。所有测试与范围审计通过后，本合同状态只可写为 `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`；真实文件上传、COS/短时签名链接、用户端使用、主树业务同步和负责人验收仍应保持未完成。

## 5. 验证命令

在 Core 隔离树：

```powershell
node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json
node --test apps/api/dist/test/local-synthetic-media-assets.test.js
node --test tests/local-synthetic/media-assets.test.mjs
node node_modules/eslint/bin/eslint.js packages/contracts/src/media-asset.ts packages/contracts/src/index.ts apps/api/src/local-synthetic/sessions.ts apps/api/src/local-synthetic/media-assets.service.ts apps/api/src/local-synthetic/routes.ts apps/api/src/local-synthetic/server.ts apps/api/test/local-synthetic-media-assets.test.ts tests/local-synthetic/media-assets.test.mjs
node node_modules/prettier/bin/prettier.cjs --check packages/contracts/src/media-asset.ts packages/contracts/src/index.ts apps/api/src/local-synthetic/sessions.ts apps/api/src/local-synthetic/media-assets.service.ts apps/api/src/local-synthetic/routes.ts apps/api/src/local-synthetic/server.ts apps/api/test/local-synthetic-media-assets.test.ts tests/local-synthetic/media-assets.test.mjs docs/exec-plans/active/media-assets-core.md
git diff --check
```

在 Admin 隔离树：

```powershell
node node_modules/typescript/bin/tsc -p apps/admin-web/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p apps/admin-web/tsconfig.json
node --test apps/admin-web/test/file-lifecycle.test.mjs apps/admin-web/test/platform-operations.test.mjs
node apps/admin-web/test/file-lifecycle-browser.mjs
node node_modules/eslint/bin/eslint.js apps/admin-web/src/local-review/media-assets.ts apps/admin-web/src/pages/file-lifecycle.ts apps/admin-web/src/main.ts apps/admin-web/src/local-proxy.mjs apps/admin-web/test/file-lifecycle.test.mjs apps/admin-web/test/file-lifecycle-browser.mjs
node node_modules/prettier/bin/prettier.cjs --check apps/admin-web/src/local-review/media-assets.ts apps/admin-web/src/pages/file-lifecycle.ts apps/admin-web/test/file-lifecycle.test.mjs apps/admin-web/test/file-lifecycle-browser.mjs
git diff --check
```

### 实际验证结果与边界

- Core 和 Admin 的生命周期/平台操作测试共 19/19 PASS；浏览器实际点击验证东/西校区与租户隔离、普通/过期/撤回引用替换、归档、撤回确认、软删除、过期拒绝、只读、刷新、平台匿名汇总共 12 项 PASS，外部请求数为 0。
- 独立复核指出替换入口与过期/撤回源状态规则不一致、浏览器未实际切换西校区，以及启动阶段未受统一清理保护；已新增服务测试并修正规则，补做东/西负责人页面切换，并将服务/预览/浏览器启动与等待纳入统一 `try/finally`。清理会检查子进程退出，超时则测试失败。最终只读复核 PASS；浏览器成功复跑，测试自建临时目录确认清理；启动失败分支未单独注入故障模拟。
- Admin typecheck、build、目标 ESLint 与 G5.5 新增文件 Prettier 均 PASS。Core 合同包 typecheck、目标 ESLint、G5.5 新增文件 Prettier 均 PASS；`routes.ts` 中本次媒体路由段经独立 Prettier 片段复核 PASS。
- 普通 API `tsc -p apps/api/tsconfig.json --noEmit` 仍会从隔离树的 `node_modules` 交叉链接到主树旧版 workspace 包，报出缺少本批 `MediaAsset*` 及其他隔离树增量类型。没有改动依赖或链接。改用内存 TypeScript program 映射到当前 Core 工作树源代码、`noEmit`、`skipLibCheck` 后，全 API + workspace 源码为 0 条诊断；隔离树 API 源码编译输出到合同允许的 `apps/api/dist/**`，0 诊断且未跳过输出。
- 整个既有 `routes.ts` 与历史路线图文件的 Prettier 检查仍失败；两者在本批开始前已存在，整文件格式化会造成无关历史改动（仅 `routes.ts` 就至少改写 507 行），因此保留原现场，只对本批路由片段和路线图新增段进行格式核验。该限制不影响本批 ESLint、类型、构建或行为验证，不把整文件格式标为通过。
- 所有生成输出均留在隔离树内的 `apps/api/dist/**`、`apps/admin-web/dist/**`；未安装依赖、未改 lockfile，也未把业务代码同步到主工作树。真实文件字节、COS、签名链接和 Mini/用户端接线仍未实现。

## 6. 停止条件

若要修改本合同写集之外路径、安装依赖、改 lockfile、引入真实儿童/机构资料、创建/上传/读取实际文件、连接 COS/外部服务/数据库/持久化、发放实际签名 URL，或需要改变 Web/Mini 流程，则停止对应部分并先记录为后续独立目标；不得以本地演示名义绕过。
