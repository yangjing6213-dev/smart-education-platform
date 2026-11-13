# TASK20 D61：员工经营记录机构与校区范围护栏

**状态：** `CONTRACT_READY`
**目标任务：** `TASK20_D61_M61_STAFF_OPERATIONS_SCOPE_GUARD`
**日期：** 2026-10-10
**产品依据：** PDF v2.0 多租户基线与 V3 M6.1；D60 已确认 D59 员工工作回顾，以及同一管理端员工经营存储中的工作材料、招聘跟进对象都缺少机构/校区范围字段。
**授权依据：** 负责人已明确要求执行者自主继续本地合成开发；本合同仅补齐本机合成对象范围字段与越界输入拒绝。

## 1. 目标与边界

给管理端现有 `StaffPerformanceReview`、`StaffWorkMaterial` 和 `RecruitmentLead` 记录加入固定的合成 `tenantId` 与 `campusId`。创建记录时由本地存储注入范围，不接受调用方传入范围；预置记录也必须包含范围。增加测试证明三个对象均保留相同范围，且企图注入其他机构/校区字段会被拒绝且不改变既有状态。

本项只证明单一固定合成机构/东校区的本机演示数据形状及输入护栏，不代表服务端身份注入、跨租户数据库隔离、生产授权或真实员工绩效决策。保留人工确认、固定选项、不打分、不排名、不作人事决定、内存态刷新复位。不得读取、运行、复制或修改 `apps/mini-program/src/pages/staff.test.ts`，不连接 API/数据库/真实认证/外部服务，不加依赖、不改 lockfile、不提交/推送/部署/发布。

## 2. 精确写集

### 隔离实现工作树

使用现有 `C:\Users\HU\.codex\worktrees\task20-admin-completion`。实施前核对以下源文件和保留已有现场；D59 模型与页面在主树/该树哈希一致，当前已知模型 SHA-256 为 `C70B2752BDAB6960A89F881B0EA2BBABF8F9D8AD8BDC351D42E71D6A93E079E1`，专用测试 SHA-256 为 `7C5C934E00675D0766DE0523C371373CF259FF5A67DA286F2FEC100DD0CF9FA7`。

- MODIFY `apps/admin-web/src/local-synthetic/staff-operations.ts`
- MODIFY `apps/admin-web/test/staff-performance.test.mjs`

不修改 Admin 页面、`main.ts`、其他测试、API、Mini、User Web 或配置。

### 主工作树选择性整合

- MODIFY `apps/admin-web/src/local-synthetic/staff-operations.ts`
- MODIFY `apps/admin-web/test/staff-performance.test.mjs`
- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- MODIFY 本 D61 合同

仅逐文件选择性整合以上两个代码/测试增量；保留主树所有其他未提交和未跟踪现场。不得读取、运行、复制或修改受保护的 Mini `staff.test.ts`。

## 3. 实施顺序

1. 先扩展专用模型测试，确认当前三个员工经营对象没有范围字段且越界注入测试失败。
2. 在模型内定义唯一固定的合成机构/校区范围，将其注入三个对象的种子和创建结果；保持输入字段白名单不变，使调用方提供 `tenantId`、`campusId` 或其他未知字段时失败关闭。
3. 补充测试：全部既有/新增工作材料、工作回顾、招聘记录具有固定范围；三类对象收到伪造范围字段时均拒绝，状态快照无变化；现有版本冲突与只读行为继续通过。
4. 在隔离树运行 Admin 专用测试、TypeScript `--noEmit` 类型/编译检查、变更模块的内存编译检查、ESLint、Prettier API、`git diff --check`；不向 `dist` 生成白名单外文件。逐文件比较后选择性整合，再在主树重跑同类验证及写集审计。

## 4. 验收标准与验证

- 所有三个员工经营对象具有非空 `tenantId`、`campusId`，且与项目当前固定合成范围一致。
- 范围由存储注入；任何用户输入附带机构/校区字段都会失败，已有对象保持不变。
- 不新增跨租户能力或真实权限声明；界面功能和人员决定保持 D59 边界。
- D59 已验证的人工审核、版本历史、旧版本冲突、只读拒绝和刷新复位继续通过。
- 隔离树与主树聚焦测试、Admin TypeScript `--noEmit` 检查、变更模块内存编译检查、ESLint、Prettier API、`git diff --check` 与范围审计通过；不生成白名单外 `dist` 文件。
- 无 `staff.test.ts` 读取/执行/复制/修改，无配置、依赖、lockfile、外部服务或发布操作。

## 5. 停止条件

若需要调用真实成员身份/API/数据库、支持用户选择或提交租户/校区、扩展到其他业务对象或路径、修改白名单外文件，或发现现有页面角色权限必须调整，停止越界部分并记录原因。Owner Review、微信原生验收及生产多租户安全仍分别保持开放。
