# TASK20 G3.5 网页资源生命周期主工作树选择性整合合同

## 目标与依据

- 目标：把已在隔离工作树验证的 G3.5 教学资源生命周期接入主工作树网页端，并让统一本机合成启动器正确转发资源请求。
- 需求依据：`student-care-platform-complete-plan-v2.0.pdf`（SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`）及 V3 实施计划 M4.3。
- 来源实现合同：`docs/superpowers/plans/2026-10-07-g35-resource-library-lifecycle.md`（SHA-256 `FE54AB8130FC4A5C9EAB1D8E5B4D571FCEE13AD8236380F8DC002C11E5B43933`）。该合同禁止主树整合；本文件是后续、独立的选择性整合授权记录。
- 用户已明确要求自主完成本地合成开发和验证。无需再按子步骤请求批准。

## 当前基线审计

- 主工作树 API 已有 G3.5 资源服务和 `/local/resources*` 路由；原 Mini 资源客户端、模板和生成 JS 与隔离来源逐字节一致，主树已有相关源码测试。本任务不改 API 或 Mini。
- `/web/staff/resources` 和 `/admin/resources` 路由已存在。用户网页目前仍显示离线目录，管理网页仍显示静态占位页；来源隔离工作树里的资源客户端与管理客户端尚未接入主树。
- Admin 预览已支持 loopback 代理，但现有代理白名单没有 G3.5 路径。User Web 预览是静态文件预览，没有 `/local/*` 代理。统一启动器未向两端传入本机服务端口。
- 隔离来源 `task20-web-completion`、`task20-admin-completion` 是长期累积工作树。它们的 `main.ts`、预览和其他入口文件含 G3.5 以外的后续改动；禁止整份复制，必须按本合同所列 G3.5 行为选择性接入。
- 保留主树 `apps/user-web/src/pages/resources.tsx` 现有离线页面。来源该页同时包含其他阶段的共享页面改动，本任务不复制该文件；共享模式由新增资源生命周期模块呈现。

## 精确写集

来源：`C:\Users\HU\.codex\worktrees\task20-web-completion`、`C:\Users\HU\.codex\worktrees\task20-admin-completion`，只读；主树现有修改均须增量保留。

1. CREATE `apps/user-web/src/local-synthetic/resource-library.ts`
2. MODIFY `apps/user-web/src/main.ts`：仅接入资源客户端、既有 `/web/staff/resources` 的共享模式呈现和资源页面固定选项动作。
3. MODIFY `apps/user-web/preview.mjs`：只新增显式 loopback 服务端口参数及 G3.5 所需资源 API 的严格白名单代理；保留静态资源路径安全检查。
4. CREATE `apps/user-web/src/pages/resources.test.ts`
5. CREATE `apps/user-web/test/resource-library-browser.mjs`
6. CREATE `apps/admin-web/src/local-review/resource-library.ts`
7. MODIFY `apps/admin-web/src/main.ts`：仅把现有 `/admin/resources` 接入范围内版本更新、到期和撤回界面。
8. MODIFY `apps/admin-web/src/local-proxy.mjs`：仅加入 G3.5 资源读取、固定选项更新和撤回请求白名单。
9. CREATE `apps/admin-web/test/resource-library.test.mjs`
10. MODIFY `scripts/start-local-demo.mjs`：仅把已选定的本机合成服务端口传给 User/Admin 预览。
11. MODIFY `tests/local-synthetic/demo-launcher.test.mjs`：覆盖两端预览均收到同一 loopback 服务端口；保留其他断言。
12. MODIFY `PLANS.md`
13. MODIFY `docs/exec-plans/active/project-completion.md`
14. CREATE 本合同文件。

`apps/admin-web/preview.mjs` 已支持资源代理所需的 `--local-service-port` 参数，禁止修改该文件。

不得修改其他文件。原有文件编辑前必须仍与下列审计快照一致，或先重新审计并在本合同中追加新快照：

- `apps/user-web/src/main.ts`: `0BAF82516E54C75A7FD66E2D27F64E7FA2C794EEE83DA203B4B988E35D30ED67`
- `apps/user-web/preview.mjs`: `9A85D3924245B4682EE3AE3BF46A8039797D77ACD44F0B216BB19A0F6DECD0A7`
- `apps/admin-web/src/main.ts`: `C96DE60A170C701997B116C007B0C04B104DE8E928FB0925E0F200EC2C9A3C6D`
- `apps/admin-web/src/local-proxy.mjs`: `A3C2CF04C6D326913A6B2C9E8B6EFF30A53B49BF930A306B65B64D18F0E17427`
- `scripts/start-local-demo.mjs`: `DB19E3AA0419EA6AD351A5CB17946E9EAD891F768A46FCCAECEEBCF179A9FBA8`
- `tests/local-synthetic/demo-launcher.test.mjs`: `76B6202ACB5341A7045C57B3A01B298400180114F479BC97EAD9E972BB97508E`

CREATE 来源文件 SHA-256：

- User Web client: `AC64B016C14389D941A1DE0064C72A07175D97800CE2A7D67E390DC9B95F9F1F`
- User Web page test: `9BC48047712746DF120E91029B5DCD457A5BFEBD6427F3BB1F9E96307C8F3D2A`
- User Web browser test: `FDB6E97B336FB10F149A5487B2939B5AEF0AFA37145368106585D2686F92322F`
- Admin client: `FC1E4CA24746006CC289B7564E8EAF2C3C81EA691EE3D9A427FBCE987D53A0BB`
- Admin focused/browser test: `2D7E56C2EBEBAED5002BFEB1EBE15381C72FF47DD5D12C84C74B2ABDB9B5AD8C`

## 非目标和安全边界

- 仅固定、明显虚构的资源；收藏、最近使用和管理动作仍是内存态。本任务不表示真实机构业务已上线。
- 不新增页面或路由，不接真实身份、儿童资料、附件、外链、数据库、正式 AI、伙伴云或外部网络。
- 不安装依赖、不修改 lockfile；不读写 `apps/mini-program/src/pages/staff.test.ts`。
- 不提交、推送、部署、发布或清理既有现场。来源工作树保持只读。

## 验收与验证

- 员工在现有 `/web/staff/resources` 里可搜索、筛选、查看版本和范围、收藏、查看最近使用；负责人在现有 `/admin/resources` 内可按授权范围查看并用固定选项更新版本/适用范围/到期日或撤回。
- 过期、撤回、越校区/越班级资源不可经列表、收藏、最近使用或直接 ID 重新显示；平台视图只呈现匿名总数。
- User/Admin 通过本机预览 loopback 代理调用同一 API 资源 ID/版本；代理只允许本合同所列路径、方法、查询键和请求大小。
- 先运行新增 renderer/API 边界测试，再运行 User/Admin 类型检查、构建、聚焦测试、ESLint、Prettier、`git diff --check`、Mini 资源回归、启动器回归及两端真实本机浏览器流程。
- 浏览器覆盖搜索/筛选、收藏、最近使用、管理更新、过期/撤回失效、匿名统计和授权边界；检查无页面错误、失败请求、外网请求和手机横向溢出。
- 重启主树本机合成服务后复核入口和空态。重启只清除本机内存模拟数据；此前已获用户明确许可。
- 完成后审计写集与来源差异；Owner Review 状态按真实证据记录，不把本地测试等同验收或发布。

## 停止条件

若需要写集外文件、扩大代理能力、整份覆盖累积入口、加入依赖/配置、接入外部服务，或发现来源与本树业务语义冲突且不能安全选择性保留，停止该片并记录证据。

## 实施与验证记录（2026-10-08）

- 按 14 条精确写集完成选择性整合；来源工作树保持只读。未修改 API、Mini、`apps/admin-web/preview.mjs`、受保护测试、依赖或 lockfile；未提交、推送、部署或发布。
- User/Admin 资源客户端按本树现有 API 路由工作；来源客户端原先依赖的共享 `client.ts` 不在写集内，因此在两个新增模块中只保留合同所需的固定合成身份校验，未复制来源工作树的累积客户端。
- 启动器回归测试在实现前先扩展为实际启动共享服务并验证两端资源代理；本轮使用显式空闲环回端口，9/9 通过。该测试文件相对合同基线的差异属于合同白名单内的测试先行补充。
- 构建和类型检查：User Web、Admin Web 通过。API 教学资源测试 4/4、User Web 页面模型测试 3/3、User Web 实际预览浏览器流程通过、Admin Web 实际预览浏览器流程 1/1、统一启动器回归 9/9 通过；Mini 既有资源共享客户端聚焦回归 2/2 通过，未修改 Mini 文件。
- ESLint、所有新增/独立文件 Prettier、User/Admin 主入口本轮编辑范围 Prettier、`git diff --check` 和精确写集审计通过。User/Admin 主入口整文件存在本轮前已有的格式差异，未进行整文件重排。
- 微信开发者工具之外的实际本机网页视觉检查已在 390px 宽度完成：资源列表、搜索、详情、收藏/使用和管理动作可见；无页面异常、失败响应、外部请求或横向溢出。管理网页沿用现有简洁工作台外观，进一步视觉精修不属于本合同写集，留待剩余矩阵复核。
- 2026-10-08 用户授权后重启统一本机合成服务，当前 API/User/Admin 地址为 `4317`/`4050`/`4051`；User/Admin 资源页面与 Admin 统计页均连接到本机合成接口。统计页浏览器复核通过且无外网请求、页面异常、失败响应或横向溢出。服务重启清空内存演示记录。合成服务不注册通用 `/health` 路由；首次统计检查的浏览器拦截规则也曾误挡本机 API，改为只允许当前网页端口和本机 `4317` 后复测通过。
- 当前状态：`PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`。Owner Review、Mini 原生人工视觉验收仍未据此推断完成；本地自动验证不代表真实机构运行或发布。
