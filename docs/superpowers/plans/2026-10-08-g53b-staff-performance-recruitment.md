# TASK20 G5.3B 员工工作材料与招聘跟进合成实施合同

**状态：** `LOCAL_IMPLEMENTATION_VERIFIED_PENDING_OWNER_REVIEW`  
**日期：** 2026-10-08  
**项目权威：** `C:\Users\HU\Desktop\同芯机构项目\开发方案\student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。相关要求见 PDF 第 26、35、47、50、55 页：公开教师资料与内部档案分开；管理工作放在机构管理网页；绩效、招聘和证照属于后续经营能力；不以系统自动判断个人权益。  
**授权依据：** `PLANS.md` 当前“项目剩余开发”自主执行控制面，以及负责人要求继续按推荐方案推进。只覆盖本地合成实现和验证；不代表负责人验收、主树业务整合或发布授权。

## 1. 目标与边界

在隔离管理端工作树现有 `/admin/staff` 页面补充一个简洁的“员工工作材料与招聘跟进”区域，覆盖 G5.3 中尚未实现的人工材料整理与候选人跟进。只使用醒目标注的虚构员工和候选人，资料只保存在页面内存，刷新后恢复初始样例。

- 工作材料只记录固定类别、月份、责任岗位和人工核对状态；不生成分数、排名、绩效结论，不自动影响员工任用、薪酬、岗位或其他权益。
- 招聘只记录自动生成的合成代号、岗位类别、固定来源、人工阶段、责任岗位和下次跟进日期；不采集姓名、手机号、地址、简历、面试自由文本或其他可识别个人的资料。阶段由负责人手动选择，不由系统推荐或决定录用。
- 页面只属于机构管理网页。公开教师介绍、家长端、员工小程序继续保持原有边界；不把内部材料对外展示。
- 新增模块只使用内存模型，不连接 API、数据库、伙伴云、真实认证、文件上传或持久化。现有员工页仍保留其既有的本地合成成员/任务请求；浏览器验证可以启动同一套仅监听 `127.0.0.1` 的临时内存服务来支撑旧面板，但本任务新增功能不得发起请求或访问外部地址。
- 页面状态仅是本地演示，不构成真实员工管理或招聘流程。

## 2. 精确写集

### 隔离管理端工作树

工作树：`C:\Users\HU\.codex\worktrees\task20-admin-completion`  
分支：`codex/task20-admin-completion`  
基线 HEAD：`bd0001faa8e2fd7bbabe86e3d778ba24431107e8`  
实施前 `apps/admin-web/src/main.ts` SHA-256：`E3970CF6282BC3A4D89FD2BC0A565A2B71627DAD7385EAC6CA369B800DC81294`。

仅允许以下增量：

- CREATE `apps/admin-web/src/local-synthetic/staff-operations.ts`
- CREATE `apps/admin-web/src/pages/staff-operations.ts`
- MODIFY `apps/admin-web/src/main.ts`
- CREATE `apps/admin-web/test/staff-operations.test.mjs`
- CREATE `apps/admin-web/test/staff-operations-browser.mjs`

实施前已存在但不属于本任务写集的工作树现场必须保留；尤其不得修改既有 `apps/admin-web/test/staff-credentials.test.mjs`（SHA-256 `4982E532FE5ED370EC3D36A529B6C37F1C025D844260E89F0060B6E7BFC9DD00`）及其他 Admin/Core/Mini/Web 路径。

### 主工作树治理记录

- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- CREATE 本合同 `docs/superpowers/plans/2026-10-08-g53b-staff-performance-recruitment.md`

不得把产品代码整合至主工作树。不得安装依赖或修改 lockfile；不得修改真实认证、API、数据库、文件/网络服务、Mini 或 User Web；不得修改 `staff.test.ts`；不得 commit、push、部署或发布。

## 3. 实施顺序

1. 先新增模型行为测试，覆盖固定选项校验、人工核对、版本冲突、历史记录、候选人阶段与日期校验；运行测试确认因目标实现缺失而失败。
2. 新增最小的内存数据模型，再实现员工材料与招聘两个面板，并接入既有 `/admin/staff` 路由。授权/只读/无权模式须显示不同的可操作状态；页面不增加自由文本资料框。
3. 增加实际浏览器操作脚本，验证创建与更新、权限只读、无权隐藏和刷新重置；如旧员工面板需要本地服务，只启动既有内存合成服务并限制到 `127.0.0.1`；检查无外部地址请求，新增功能不读写浏览器存储。
4. 运行精确目标类型检查、聚焦测试、浏览器复核、ESLint、Prettier、`git diff --check` 与写集审计；只记录本任务增量，不整理工作树其他已有改动。

## 4. 验收标准

- 员工工作材料可用固定合成员工、月份、材料类别、责任岗位建立；只能由人工核对为“已核对”或“需跟进”，记录版本和变更历史。
- 招聘跟进可新建自动编号的合成候选人，并用固定岗位、来源、阶段、责任岗位与日期记录人工跟进；无姓名、联系方式、简历、面试自由文本或自动录用判断。
- 只读模式不能提交；无权模式不显示记录明细；过期版本更新被拒绝；表单校验失败不改变现有记录。
- 页面刷新回到固定样例；新增产品模块不使用网络、浏览器存储、上传或后端。旧员工页原有的本地合成请求不属于新增模块，不得转为真实服务。
- 验证证据和未运行项目记录到 `PLANS.md` 与 `docs/exec-plans/active/project-completion.md`；状态明确标为本地通过、负责人验收待定、主树产品同步未执行。

## 5. 验证命令

在隔离工作树根目录运行：

```powershell
node node_modules/typescript/bin/tsc -p apps/admin-web/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p apps/admin-web/tsconfig.json
node --test apps/admin-web/test/staff-operations.test.mjs apps/admin-web/test/staff-credentials.test.mjs
node apps/admin-web/test/staff-operations-browser.mjs
node node_modules/eslint/bin/eslint.js apps/admin-web/src/local-synthetic/staff-operations.ts apps/admin-web/src/pages/staff-operations.ts apps/admin-web/src/main.ts apps/admin-web/test/staff-operations.test.mjs apps/admin-web/test/staff-operations-browser.mjs
node node_modules/prettier/bin/prettier.cjs --check apps/admin-web/src/local-synthetic/staff-operations.ts apps/admin-web/src/pages/staff-operations.ts apps/admin-web/test/staff-operations.test.mjs apps/admin-web/test/staff-operations-browser.mjs
git diff --check
```

`main.ts` 实施前已有改动；若整文件格式检查会重写无关旧代码，只格式化本任务区域，并记录目标格式复查结果。构建输出只允许为本地验证产生且不得纳入写集审计。

## 6. 停止条件

若实现必须新增第 2 节以外路径、引入真实个人资料/外部服务/持久化/新依赖、改变认证权限、改变公开教师资料或主树业务代码，应停止相关实现并记录原因。禁止通过降低测试断言或扩大权限制造通过。任何已有现场冲突均保留并绕开；不能安全绕开时停止并报告。
