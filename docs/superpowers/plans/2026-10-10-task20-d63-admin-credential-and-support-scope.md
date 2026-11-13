# TASK20 D63：管理端证照与平台支持事项范围护栏

**状态：** `CONTRACT_READY`
**目标任务：** `TASK20_D63_ADMIN_CREDENTIAL_AND_SUPPORT_SCOPE`
**日期：** 2026-10-10
**权威依据：** 项目方案 PDF v2.0，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；实施计划 V3，SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。
**授权依据：** 负责人已明确要求执行者自主继续本地项目开发；本合同只修复管理端两类合成记录的范围归属，不扩大真实服务或发布权限。

## 1. 目标与边界

依据 D62 审计，修复两类本地合成记录的范围缺口：

1. 员工资格材料：保存固定合成 `tenantId=tenant-synthetic-a`、`campusId=campus-synthetic-east`；存储层将其写入种子、新建和更新结果，创建/更新表单仍不能传入或更改范围。
2. 平台支持事项：账号支持和配额咨询各绑定一个现有合成租户 `tenant-synthetic-001`、`tenant-synthetic-002`。支持事项是平台级处理队列，因此只需租户归属，不添加校区字段；状态更新不能改变所属租户。

仅使用固定合成数据；不连接真实身份、员工资料、API、数据库、伙伴云或其他外部服务。不修改页面、路由、配置、依赖或 lockfile。不读取、运行、复制或修改受保护的 Mini `staff.test.ts`，不提交、推送、部署或发布。

## 2. 精确写集

隔离实现工作树：新建 `C:\Users\HU\.codex\worktrees\task20-d63-admin-object-scope`，以主树当前 `HEAD=bd0001faa8e2fd7bbabe86e3d778ba24431107e8` 创建独立本地分支。保留其他工作树和所有既有现场。基线同步只允许将下列模型文件从主树逐文件复制到新工作树：复制前记录并核对 SHA-256，目标已有文件只有哈希相同才可替换；已有非同哈希内容时停止。

- MODIFY `apps/admin-web/src/local-synthetic/staff-credentials.ts`
- MODIFY `apps/admin-web/src/local-synthetic/platform-operations.ts`
- CREATE `apps/admin-web/test/local-synthetic-scope.test.mjs`

主树选择性整合仅限以上三个源/测试路径，另可修改 `PLANS.md`、`docs/exec-plans/active/project-completion.md`、`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` 与本合同。逐文件确认基线和最终哈希；不得复制、覆盖或清理任何其他路径。

## 3. 实施顺序

1. 新增定向测试并先运行，证明证照种子和新建记录缺少固定机构/校区范围，平台支持事项缺少所属租户；验证失败前不改模型。
2. 给证照记录和内部存储类型增加范围字段；预置记录带范围，新建由存储注入，严格输入字段清单保持不变，更新保留既有范围。
3. 给支持事项种子增加对应的合成 `tenantId`；状态更新只接收既有固定状态并保留租户归属。平台租户自身仍以 `id` 表示租户，不添加冗余 `tenantId`；平台级对象不添加 `campusId`。
4. 在隔离树运行专用测试、Admin TypeScript `--noEmit`、ESLint、Prettier API、内存编译及空白/写集检查。禁止生成项目内 `dist` 或其他未列文件。
5. 哈希核对后只选择性整合三个源/测试增量；主树重跑专用与相关聚焦测试、类型/Lint/格式/范围检查。

## 4. 验收标准与验证

- 每条证照种子、新建与更新后记录均包含指定固定机构/校区范围；调用方伪造或补充范围字段会失败，存储状态不变。
- 每条支持事项均指向现有模拟租户；状态更新保留该关联，错误状态或附带伪造租户数据会失败且不改状态。
- 平台租户主键语义不变；平台级支持队列不误加校区范围。
- 新增测试先红后绿；隔离树和主树定向测试通过；Admin 类型检查、ESLint、Prettier API、内存编译、`git diff --check` 与精确范围审计通过。
- 只改第 2 节列出的五个代码/测试/治理路径；没有 UI、API、Mini、User Web、配置、依赖、lockfile、生成文件或外部服务变化。
- Owner Review、微信原生验收与生产多租户安全仍分别开放；本任务不将本机数据形状描述为生产隔离。

## 5. 停止条件

若隔离树出现既存非同哈希目标、实现必须修改上述写集外文件、需要真实身份/网络/API/数据库/外部服务、需要接触受保护测试、或验证会生成白名单外文件，停止对应部分并记录证据；不得为了通过而放宽输入校验或范围检查。
