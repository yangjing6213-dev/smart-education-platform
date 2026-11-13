# TASK20 G5.3A 员工资格材料与到期提醒实施合同

**状态：** `APPROVED_FOR_IMPLEMENTATION`
**日期：** 2026-10-07
**设计依据：** `docs/superpowers/specs/2026-10-07-g53a-staff-credential-lifecycle-design.md`；负责人批准的设计内容 SHA-256 `5CBD8E415175BC849B9EAD124D66AB06CB8B6C6C7765EE1C8FB496043C24CDBE`。仅设计状态和审阅记录随后同步，当前文件 SHA-256 `A5C92E1704FD73E406572352835A24D166FFC4A80EEA083C8098E9E10DF58222`。
**授权依据：** 负责人于 2026-10-07 指示“按推荐方案继续”；项目当前控制面授权自主完成本地合成开发和验证。

## 1. 目标与边界

在现有机构管理端 `/admin/staff` 员工账号页面加入一个本机合成资格材料台账。获授权负责人可查看当前校区记录、创建和更新固定类别的材料，并看到根据到期日产生的状态与简要历史。

数据只保存在当前演示服务进程内。员工身份来自既有本地会话和成员列表；机构与校区范围只能由服务端可信会话确定。复用现有 `memberships:manage` 权限，不增加权限或角色。

固定类别限于教师资格、急救培训、托育培训；责任角色限于校区负责人、员工本人。签发日和到期日须为有效日期，到期日不得早于签发日。到期日早于今天显示“已过期”；今天至 30 天内显示“即将到期”；更晚显示“有效”。状态只作提醒，不改变员工状态或其他权益。

## 2. 精确写集

只能修改或创建以下文件；不得读改其他代码以绕过范围：

### Core 隔离工作树 `C:\Users\HU\.codex\worktrees\task20-local-shared-core`

- CREATE `apps/api/src/local-synthetic/staff-credentials.service.ts`
- MODIFY `apps/api/src/local-synthetic/routes.ts`
- MODIFY `apps/api/src/local-synthetic/server.ts`
- CREATE `apps/api/test/local-synthetic-staff-credentials.test.ts`

### Admin 隔离工作树 `C:\Users\HU\.codex\worktrees\task20-admin-completion`

- MODIFY `apps/admin-web/src/local-review/membership-management.ts`
- MODIFY `apps/admin-web/src/main.ts`
- MODIFY `apps/admin-web/src/local-proxy.mjs`
- MODIFY `apps/admin-web/test/local-proxy.test.mjs`
- MODIFY `apps/admin-web/test/membership-management-browser.mjs`
- CREATE `apps/admin-web/test/staff-credentials.test.mjs`

### 主工作树治理记录

- MODIFY `docs/superpowers/specs/2026-10-07-g53a-staff-credential-lifecycle-design.md`（只同步审阅结果）
- CREATE 本合同 `docs/superpowers/plans/2026-10-07-g53a-staff-credential-lifecycle.md`
- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`

不得整合到主工作树任何产品代码；不得修改 `staff.test.ts`、访客/Mini 页面、数据库、真实认证、项目配置、依赖或 lockfile。不得安装依赖、commit、push、部署或发布。

实施前 Core 与 Admin 既有目标文件的基线 SHA-256 如下；实现时只做局部补丁，不替换或清理此前 G5.1/G5.2 现场：

| 工作树 | 文件 | 实施前 SHA-256 |
| --- | --- | --- |
| Core | `apps/api/src/local-synthetic/routes.ts` | `4C3EE7687AC2D62117B7A5D8304027679BC953079DAF5CB523EF45564E278AFF` |
| Core | `apps/api/src/local-synthetic/server.ts` | `249F25F190075D9D5CCB0A0E240CF97032782E51315FF0A6BC716A9E798FA93E` |
| Admin | `apps/admin-web/src/local-review/membership-management.ts` | `BDA82C3169924BD2D8FF5375BC7D36F146785470B3A02FEFC5DE8A45E245CD77` |
| Admin | `apps/admin-web/src/main.ts` | `9BD3E12840EFEB630092963A14F517BF1E75C4ACF89FC082122D51077F4D9FAD` |
| Admin | `apps/admin-web/src/local-proxy.mjs` | `9E412A3698283D8D3D86468684FFD3BBF3950028A27436D209C840DA16B6DD75` |
| Admin | `apps/admin-web/test/local-proxy.test.mjs` | `CDC25C45E14C0A0AB61A979218ED2FE926208DF08C6A4A8ED31183BA1DE44D05` |
| Admin | `apps/admin-web/test/membership-management-browser.mjs` | `F3395E795EAA9AFFE056B66F0103ADB059E6C616A3A24FBEE3E52CD344B83C75` |

## 3. 实施顺序

1. 在 Core 新增接口测试，先确认无权限访问、跨校区访问、非法字段、日期边界、创建、版本冲突和历史记录行为失败，再实现内存服务及路由。
2. 在 Admin 现有员工页复用当前负责人会话展示台账和到期提醒，增加固定选项表单、错误反馈及更新历史；先补客户端/渲染测试，再接入精确本地代理路由和页面交互。
3. 执行本合同验证，复核本地浏览器操作、无外网请求、两棵工作树写集和主工作树治理差异；任何额外路径必需时停止并记录，不扩大写集。

## 4. 验收与验证命令

以下命令在各自指定工作树根目录执行，不安装依赖：

### Core

```powershell
pnpm exec tsc -p apps/api/tsconfig.json
node --test apps/api/dist/test/local-synthetic-staff-credentials.test.js apps/api/dist/test/local-synthetic-membership.test.js
pnpm exec eslint apps/api/src/local-synthetic/staff-credentials.service.ts apps/api/src/local-synthetic/routes.ts apps/api/src/local-synthetic/server.ts apps/api/test/local-synthetic-staff-credentials.test.ts
pnpm exec prettier --check apps/api/src/local-synthetic/staff-credentials.service.ts apps/api/src/local-synthetic/routes.ts apps/api/src/local-synthetic/server.ts apps/api/test/local-synthetic-staff-credentials.test.ts
git diff --check
```

### Admin

```powershell
pnpm exec tsc -p apps/admin-web/tsconfig.json
node --test apps/admin-web/test/staff-credentials.test.mjs apps/admin-web/test/local-proxy.test.mjs
node apps/admin-web/test/membership-management-browser.mjs
pnpm exec eslint apps/admin-web/src/local-review/membership-management.ts apps/admin-web/src/main.ts apps/admin-web/src/local-proxy.mjs apps/admin-web/test/local-proxy.test.mjs apps/admin-web/test/membership-management-browser.mjs apps/admin-web/test/staff-credentials.test.mjs
pnpm exec prettier --check apps/admin-web/src/local-review/membership-management.ts apps/admin-web/src/main.ts apps/admin-web/src/local-proxy.mjs apps/admin-web/test/local-proxy.test.mjs apps/admin-web/test/membership-management-browser.mjs apps/admin-web/test/staff-credentials.test.mjs
git diff --check
```

本机浏览器若缺少可用 Edge/Chrome，浏览器流程记为 `NOT_RUN` 并以 Admin 客户端/代理测试和静态检查作为部分验证；不得安装浏览器或自动化依赖。

### 4.1 执行环境与既存格式校准（2026-10-07）

原批准合同 SHA-256 为 `6C46F67A6F364EBE5F32ECFA12FF15C175CBE2371AD0AEEBD87D6811CB1467E5`。本节是在执行中发现工具限制和既存格式差异后的透明补记，不改变产品范围、角色权限或业务验收条件。实施时发现两棵工作树的 `pnpm` 为 `11.19.0`，低于仓库要求的 `11.22.0`。因本合同禁止升级或安装，实际调用已安装的本地 TypeScript、ESLint 和 Prettier 程序完成对应检查；Admin 的完整类型检查通过。

Core 完整 API 类型检查已实际运行，但被既有工作区链接状态阻塞：`@student-care/contracts` 指向主工作树的旧导出，且 API 既有 Fastify 权限配置类型冲突；报错还涉及学习和统计服务、会话类型等不在本合同写集中的路径。没有修改这些文件或依赖。随后以 TypeScript Compiler API 仅编译本合同四个 Core 目标文件及 API 声明文件，并将 `@student-care/contracts` 映射到 Core 工作树现有源码；该目标检查为 0 条诊断。完整 API 检查继续标记为基线失败，目标文件检查单独记为通过。

Core `routes.ts` 和 Admin `main.ts`、`local-proxy.test.mjs`、`membership-management-browser.mjs` 在本任务前已有整文件格式差异。整文件格式化会改写无关既有代码，因此只格式化本任务新增或调整的代码范围，并以第二次相同范围格式化不再改变文件 SHA-256 作为稳定性检查；其他目标文件执行整文件 Prettier 检查。此校准不声称上述四个既有文件已达到整文件格式一致。

### 主工作树治理文件

```powershell
git diff --check
```

还须逐项审计两棵工作树的本任务增量和主树文档改动均落在第 2 节精确写集；不以既有脏现场差异冒充本任务变更。

## 5. 完成标准

- 管理端只能看到并修改可信负责人当前校区员工的固定类别记录；教师、家长、平台管理员和跨校区负责人不能读取或写入。
- 创建、更新、日期边界、到期提醒、版本冲突、错误反馈、历史记录和权限拒绝都有测试。
- 浏览器实际流程在员工账号页完成读取、新建和更新，且没有控制台错误、失败请求或外网请求；若浏览器条件不具备则如实标为 `NOT_RUN`。
- 证照状态不会改变员工成员状态；服务重启会清空该台账。
- 精确写集与格式、类型、Lint、测试和差异检查结果如实记录到 `PLANS.md` 与当前执行记录。

## 6. 停止条件

若发现必须改第 2 节外文件、增加权限、使用真实材料/员工资料、保存文件或接入外部服务才能完成，应停止该部分并记录原因。出现测试失败时先定位原因；最多两轮最小修复，之后标记为产品问题或环境问题，不削弱权限、校区隔离和断言来制造通过。
