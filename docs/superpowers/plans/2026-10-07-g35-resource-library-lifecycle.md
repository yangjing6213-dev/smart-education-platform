# TASK20 G3.5 / M4.3 教学资源生命周期合成实施合同

## 0. 目标和依据

- 路线依据：`docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md` 中 M4.3：年级、学科、标签、版本、搜索、筛选、收藏、最近使用、来源/责任人/适用范围、过期和撤回。
- 项目当前执行记录：`docs/exec-plans/active/project-completion.md`；G3.3 记录月度反馈跨端完成情况，G3.4 的原生缺货/取消复核与主树同步仍保留为待办。
- 用户已授权自主推进本地合成开发。继续使用现有四个隔离工作树；不把业务代码同步至主树。
- 只用明显虚构的固定示例资源和内存状态；不收集儿童信息、不用真实附件/链接/内容，不接真实认证、数据库、伙伴云、外部网络或 AI。
- 本合同不新增页面或路由，复用 Web `/web/staff/resources`、Admin `/admin/resources` 和 Mini 员工快捷页。

## 1. 行为设计和边界

1. 共享服务从登录的本机合成会话确定租户、校区、班级和角色。客户端不能提交或覆盖这些授权范围。
2. 只提供固定示例资源。每项含固定分类、年级、学科、标签、版本、来源、责任角色、租户/校区/班级适用范围、状态和到期日；正文只能是项目内合成的短文本，不含附件或外链。
3. 员工可按标题/简介、年级、学科和标签筛选，只能打开同租户/校区且角色和班级范围匹配、已发布且未到期的资源；可收藏及记录最近使用。收藏和最近使用按当前示例身份保存在本机内存，不落盘。
4. 机构负责人只能管理当前会话授权范围内的资源，可通过固定选项更新适用范围/到期日并递增版本，或撤回资源。平台管理员只得到匿名计数，不得看到正文、负责人、班级或资源详情。
5. 过期或撤回资源不得通过列表、搜索、详情、收藏、最近使用或直接 ID 读取重新显示；已收藏/最近使用的旧项应从员工可见投影中消失。旧版本写入必须拒绝。
6. Web 提供完整搜索、筛选、详情、收藏和最近使用；Admin 负责范围内版本/到期/撤回；Mini 在现有快捷页提供轻量列表、详情和收藏/最近入口。三端读写同一服务端资源 ID 与版本。

## 2. 精确写集

### 共享本机服务 worktree

路径：`C:/Users/HU/.codex/worktrees/task20-local-shared-core`

- CREATE `packages/contracts/src/resource-library.ts`
- MODIFY `packages/contracts/src/index.ts`
- MODIFY `apps/api/src/local-synthetic/repository.ts`
- MODIFY `apps/api/src/local-synthetic/sessions.ts`
- MODIFY `apps/api/src/local-synthetic/routes.ts`
- MODIFY `apps/api/src/local-synthetic/server.ts`
- CREATE `apps/api/src/local-synthetic/resource-library.service.ts`
- CREATE `apps/api/test/local-synthetic-resource-library.test.ts`
- CREATE `tests/local-synthetic/resource-library.test.mjs`
- CREATE `docs/exec-plans/active/resource-library-core.md`

### 用户网页 worktree

路径：`C:/Users/HU/.codex/worktrees/task20-web-completion`

- CREATE `apps/user-web/src/local-synthetic/resource-library.ts`
- MODIFY `apps/user-web/src/pages/resources.tsx`
- MODIFY `apps/user-web/src/main.ts`
- MODIFY `apps/user-web/preview.mjs`：仅添加资源库固定 API 路径/方法白名单
- CREATE `apps/user-web/src/pages/resources.test.ts`
- CREATE `apps/user-web/test/resource-library-browser.mjs`
- CREATE `docs/exec-plans/active/web-resource-library.md`

### 管理网页 worktree

路径：`C:/Users/HU/.codex/worktrees/task20-admin-completion`

- CREATE `apps/admin-web/src/local-review/resource-library.ts`
- MODIFY `apps/admin-web/src/main.ts`
- MODIFY `apps/admin-web/src/local-proxy.mjs`：仅添加资源生命周期固定 API 路径/方法白名单
- CREATE `apps/admin-web/test/resource-library.test.mjs`
- CREATE `docs/exec-plans/active/admin-resource-library.md`

### 微信小程序 worktree

路径：`C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign`

- MODIFY `apps/mini-program/src/local-synthetic/client.ts`
- MODIFY `apps/mini-program/src/local-synthetic/client.test.ts`
- MODIFY `apps/mini-program/src/local-synthetic/page.ts`
- MODIFY `apps/mini-program/templates/local-synthetic.wxml`
- MODIFY `tests/mini-shared-service.test.mjs`
- CREATE `docs/exec-plans/active/mini-resource-library.md`
- GENERATED `apps/mini-program/src/local-synthetic/client.js`
- GENERATED `apps/mini-program/src/local-synthetic/page.js`

生成 JS 只能由现有 `scripts/mini-runtime.mjs --write` 根据 TypeScript 输出更新，且仅当运行时护栏报告内容变化时写入。

### 主工作树控制面

- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- No business source files in the main worktree.

## 3. 验证顺序

1. 先写 API 与页面失败测试并确认按预期失败，再实现服务和各端交互。
2. 服务：合同/API 类型检查、资源范围/角色/版本/过期撤回/匿名统计 focused tests 和真实 loopback HTTP 测试。
3. Web/Admin：类型检查、focused tests；真实本机预览代理浏览器操作覆盖搜索筛选、详情、收藏/最近使用、管理端更新版本/过期/撤回以及失效资源不可见；检查无页面错误、失败请求或外网请求。
4. Mini：源码页面与真实本机共享服务 Page 流程；生成 JS 模式复测；Mini typecheck、页面注册/运行时护栏、ESLint、Prettier；开发者工具人工点击仅在实际操作后记录。
5. 四树分别运行 ESLint、Prettier、`git diff --check` 和精确路径审计；复核客户/学生信息、外链和资源失效后投影；主树只更新控制面。

## 4. 验收标准

- 年级、学科、固定标签、版本、搜索筛选、来源/责任人/范围、过期和撤回均可在既有页面中理解和验证。
- 员工收藏和最近使用在当前进程内按身份区分；服务重启/断开后不声称持久保存。
- 过期、撤回、越权或跨范围的资源在所有客户端入口均不可见；旧版本动作被拒绝。
- Web、Admin、Mini 使用同一服务端资源 ID/版本，不新增路由，不暴露越权资源明细。
- 仅精确写集发生变化；没有依赖/lockfile、生产数据、外部服务或主树业务代码变化。

## 5. 禁止项与停止条件

- 不改本合同写集之外的文件，不新增页面/路由、依赖或配置，不改 lockfile。
- 不接真实认证、学生数据、真实资源附件、伙伴云、数据库、正式 AI 或外部服务。
- 不修改 `apps/mini-program/src/pages/staff.test.ts`、`app.json`、任何 `index.json` 或项目配置。
- 不整合主树业务代码，不提交、推送、部署或发布。
- 如发现既有资源内容含真实儿童资料、无法通过会话推导访问范围，或必须触及白名单外路径，停止相关切片并记录原因。

初始状态：`IN_PROGRESS_LOCAL_SYNTHETIC`。
