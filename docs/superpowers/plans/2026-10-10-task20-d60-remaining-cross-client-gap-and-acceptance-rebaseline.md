# TASK20 D60：跨端剩余缺口与验收状态重校准

**状态：** `CONTRACT_READY`
**目标任务：** `TASK20_D60_REMAINING_CROSS_CLIENT_GAP_AND_ACCEPTANCE_REBASELINE`
**日期：** 2026-10-10
**权威依据：** 项目方案 PDF v2.0，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；实施计划 V3，SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。
**授权依据：** 负责人已明确要求执行者自主继续本地项目开发；本任务为只读审计及其治理记录，不扩大真实服务、外部数据或发布权限。

## 1. 目标与边界

在 D59 完成后重新核对 V3 M1—M6 与 PDF v2.0 的端侧职责和未完成事项。把“本地代码缺失”“已有代码但缺人工/设备验收”“受真实机构或生产条件限制”分别记录，不用自动测试代替 Owner Review 或微信原生验收，也不把受禁止的生产能力写成已完成。

本轮发现的可本地处理缺口只转成下一份精确实施合同，不在 D60 内修改产品代码。不得读取、运行、复制或修改 `apps/mini-program/src/pages/staff.test.ts`；不得清理或覆盖其他现场；不接真实数据/认证/API/数据库/伙伴云/正式 AI/外部服务，不安装依赖、不改 lockfile、不 commit、push、部署或发布。

## 2. 精确写集

- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- CREATE 本 D60 合同
- CREATE `docs/superpowers/plans/2026-10-10-task20-d61-m61-staff-operations-scope-guard.md`

不修改产品代码、测试、配置、依赖或 lockfile。所有既有未提交与未跟踪文件保持不变。

## 3. 审计步骤

1. 复核 PDF/V3 SHA、当前主树进度控制面、D59 合同和 D59 实际源/测试；按 PDF 的页面职责核对 M6.2 员工经营内容应由管理端承担的部分。
2. 抽查 V3 M6.1 对租户/校区范围的要求和现有员工资料服务的做法，检查 D59 的 `StaffPerformanceReview` 以及同一员工经营存储中的 `StaffWorkMaterial`、`RecruitmentLead` 数据对象是否带有 `tenantId`、`campusId`。
3. 更新剩余矩阵：保留人工 Owner Review、微信原生点击和生产服务边界；如果确认本地代码缺口，为下一阶段创建独立合同后再实施。
4. 逐项审计 D60 写集，运行治理文档格式/API 检查和限定路径 `git diff --check`；不对其他未提交现场做格式化或修复。

## 4. 验收标准

- PDF 与 V3 权威哈希与已记录值一致。
- 明确记录 D59 的 M6.2 实施结果及其尚未完成的验收边界。
- 任何新发现的本地范围缺口都有文件证据、影响、精确下一阶段合同及停止条件。
- 明确区分代码实现、自动验证、人工 Owner Review、微信原生操作和真实生产能力。
- 仅修改第 2 节列出的五个治理文档路径；无产品代码、测试、配置、依赖或 lockfile 改动。
- 限定路径格式检查、`git diff --check` 和精确写集审计通过。

## 5. 停止条件

如果审计要求读取/运行/复制/修改受保护的 `staff.test.ts`、修改写集外文件、访问真实数据/外部服务、安装依赖或触及发布动作，停止对应部分并如实记录。发现设备工具无法连接时只记录 `NOT_RUN`，不伪称人工验收。
