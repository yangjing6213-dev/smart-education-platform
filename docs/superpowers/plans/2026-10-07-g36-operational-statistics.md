# TASK20 G3.6 合成运营统计合同与实施计划

**状态：** `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`

**授权依据：** 用户已明确要求由我自主完成项目开发，并指示进入下一批。项目 V3 路线与 `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 的 G3.6 定义本批产品边界。

**目标：** 在管理网页为当前授权范围提供任务、考勤、接送异常和健康异常的日期/班级汇总及可核对来源；平台角色只获得不含范围、日期、状态和来源明细的匿名数量。

**设计：** 共享本机合成服务从当前会话推导租户、校区、班级和角色，不接受客户端指定租户范围。机构负责人可在当前授权校区、授权班级和 31 天以内日期区间查看按日期、班级、来源类别和状态分组的计数；每组只附来源类型、记录 ID、版本和日期，不返回学生标识、姓名或事件细节。平台管理员通过单独的只读接口查看跨本地样本的匿名分类总数，不能筛选或下钻。管理端复用现有页面壳和本机代理，新增 `/admin/statistics` 入口。

**实施方式：** 复用当前 core 与 Admin 隔离工作树；共享服务测试先红后绿，再连接管理网页和真实本机预览。初次浏览器验证发现预览静态页面白名单不含新增统计路由；已将 `apps/admin-web/preview.mjs` 纳入写集作为必要路由登记修正。所有数据固定合成并只在进程内存中存在。

## 验收范围

- 管理角色只能看到服务端会话授权租户、单一当前校区和授权班级内的汇总；日期筛选按 `staffTask.dueDate`、`attendance.date`、`pickupException.date`、`healthIncident.updatedAt` 的上海本地日期计算。
- 来源追溯只包含 `kind`、不透明 `id`、`version` 与 `date`；不返回学生 ID/姓名、自由文本、健康观察/处置内容、任务目标或接送对象。
- 过滤器拒绝非法日期、超过 31 天范围、伪造校区/班级及未知参数；越权请求失败关闭。
- 平台视图只包含四类来源的数量与总数；不得返回日期、校区、班级、状态分布、记录来源 ID 或可下钻链接。
- 管理网页提供中文空状态、范围提示、日期/班级筛选和来源编号/版本；实际浏览器通过本机代理验证，页面错误、失败请求和外网请求均为 0。
- 不以成长记录 `CareRecord` 替代内部日报 `StaffDailyReport`；本批不汇总日报或家长成长内容。

## 精确写集

### 共享本机服务隔离工作树

路径：`C:/Users/HU/.codex/worktrees/task20-local-shared-core`

- MODIFY `apps/api/src/local-synthetic/sessions.ts`
- MODIFY `apps/api/src/local-synthetic/routes.ts`
- MODIFY `apps/api/src/local-synthetic/server.ts`
- MODIFY `packages/contracts/src/index.ts`
- CREATE `packages/contracts/src/operational-statistics.ts`
- CREATE `apps/api/src/local-synthetic/operational-statistics.service.ts`
- CREATE `apps/api/test/local-synthetic-operational-statistics.test.ts`
- CREATE `tests/local-synthetic/operational-statistics.test.mjs`

### 管理网页隔离工作树

路径：`C:/Users/HU/.codex/worktrees/task20-admin-completion`

- MODIFY `apps/admin-web/src/main.ts`
- MODIFY `apps/admin-web/preview.mjs`
- MODIFY `apps/admin-web/src/local-proxy.mjs`
- MODIFY `apps/admin-web/src/local-review/view.ts`
- CREATE `apps/admin-web/src/local-review/statistics.ts`
- CREATE `apps/admin-web/test/statistics.test.mjs`
- CREATE `apps/admin-web/test/statistics-browser.mjs`

### 主工作树控制面

- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY 本合同记录实施进度、命令和结果
- 不修改主工作树业务代码

## 分阶段实施清单

1. [x] 在共享服务测试中先覆盖范围过滤、日期/班级过滤、版本来源、无身份字段、平台匿名汇总和非法请求；运行并确认因目标能力缺失而失败。
2. [x] 增加统计类型、会话能力、聚合服务和固定 API；重跑测试确认通过，再运行 API/契约类型检查与 loopback HTTP 测试。
3. [x] 先为管理端展示模型和权限失败状态写页面测试并确认失败；新增 `/admin/statistics` 页面、班级/日期筛选、来源编号与平台匿名模式，并从已有管理首页提供入口；将页面加入本机预览路由白名单。
4. [x] 本机代理浏览器测试：通过真实共享服务创建合成任务/考勤/接送异常，查看明细来源；验证过滤、跨校区身份隔离、平台匿名页无来源和无下钻、无外网请求。
5. [x] 运行本批 focused tests、类型检查、ESLint、Prettier、`git diff --check`、精确路径审计；复核当前工作树现场后更新本合同、`PLANS.md` 与项目完成记录。

## 验证命令

- Core：`node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json`；API TypeScript 编译使用位于系统临时目录的临时 tsconfig，将 `@student-care/contracts` 映射到当前隔离工作树生成的 `.d.ts`，再执行 `node --test apps/api/dist/test/local-synthetic-operational-statistics.test.js tests/local-synthetic/operational-statistics.test.mjs`。这是因为当前工作树的 `node_modules` 联接指向主工作树的 workspace 包；未改项目配置、依赖或 lockfile。
- Admin：`node node_modules/typescript/bin/tsc -p apps/admin-web/tsconfig.json`；`node apps/admin-web/test/statistics.test.mjs`；`node apps/admin-web/test/statistics-browser.mjs`。
- 两树分别对合同写集运行 ESLint、Prettier、`git diff --check` 和精确路径审计。

## 验证结果（2026-10-07）

- Core：合同类型编译 PASS；API 编译 PASS；统计单元与 HTTP loopback 测试 5/5 PASS；连同既有任务分派、资源库测试的共享服务回归 14/14 PASS；合同写集 ESLint、Prettier 和 `git diff --check` PASS。
- Admin：TypeScript 编译 PASS；展示模型测试 4/4 PASS；真实本机预览/共享服务浏览器 PASS，页面错误、失败响应和外网请求均为 0。浏览器还验证负责人/平台页面只请求各自统计接口，不请求学生关系或学生选项明细。ESLint、Prettier 和 `git diff --check` PASS。
- 初次浏览器复核暴露 `/admin/statistics` 未登记到本机预览页面白名单；已纳入写集并修复后重跑通过。
- `OWNER_REVIEW=PENDING`、`MAIN_TREE_BUSINESS_SYNC=NOT_EXECUTED`；微信开发者工具原生验收未运行，不能把本机浏览器证据当作原生或负责人验收。

## 禁止项与停止条件

- 只使用合成数据；不接真实认证、数据库、机构服务、伙伴云、AI、外部网络、文件或真实通知。
- 不修改 Mini、User Web、`staff.test.ts`、项目配置、`app.json`、依赖或 lockfile。
- 不新增依赖；不改本合同写集外文件；不覆盖、清理、暂存或重分类其他既有现场。
- 不提交、推送、合并、部署、上传、发布或修改生产数据。
- 如需扩大写集或改变业务口径，停止对应切片并记录原因；不得用放宽隔离、匿名要求或测试断言制造通过。

## 验收与开放项

自动化和本机浏览器全部通过后，本批状态最多记为 `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`。微信开发者工具人工点击、Owner Review 和任何主树业务整合需分别记录；本合同不把这些状态推断为已完成。
