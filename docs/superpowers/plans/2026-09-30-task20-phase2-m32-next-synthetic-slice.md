# TASK20_PHASE2_M32C2_HEALTH_INCIDENT_REVIEW_SYNTHETIC

## 合同状态

- TASK_ID：TASK20_PHASE2_M32C2_HEALTH_INCIDENT_REVIEW_SYNTHETIC
- 当前状态：CONTRACT_DRAFT_COMPLETE_PENDING_OWNER_REVIEW
- 实施授权：NOT_GRANTED
- 数据边界：仅合成数据、应用内存；无真实服务
- 前置门：TASK20_PHASE2_M32C1_OWNER_REVIEW_GATE 必须通过
- M3.2 总状态：PARTIALLY_COMPLETE_SYNTHETIC_ONLY
- 发布就绪：NO

本文件是下一阶段合同草案，不是实施授权。负责人审阅本合同并另外明确授权实施前，不得创建本阶段工作树或修改业务文件。

## 0. 依据与阶段证据

1. V3 计划 docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md 的 SHA-256 为 ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38。V3 §7 M3.2 要求日报、通知、请假、健康异常；对象为 Student、GuardianRelation、CareRecord、Leave、Notice、HealthIncident、ConsentRecord；状态为 DRAFT、SUBMITTED、CONFIRMED、RETURNED、CANCELLED、EXCEPTION_PENDING。Mini 快速查看/提交，Web 历史/详情/批量处理，admin-web 审核和范围统计；六种状态均需回退、重复和越权测试。
2. M3.2A 日报/通知已由负责人确认合成范围 Owner Review 通过。双端本地验证、Web 浏览器和 Mini DevTools 用户复核见隔离集成树中的 TASK20_PHASE2_PARENT_DAILY_NOTICE_SYNTHETIC 合同。此结果不表示真实送达、共享后端或完整 M3.2。
3. M3.2B 请假已由负责人确认合成范围 Owner Review 通过。表单重叠、幼圆字体与首页间距修正有本地复现和自动检查；最后一次微信原生复核没有新证据，记为 NOT_RUN。
4. M3.2C1 健康异常家长查看/知悉的 Web/Mini 本地验证、Web 浏览器复核、独立代码审查和范围审计通过。原实现合同回执记录 Mini DevTools 视觉与 Owner Review 待确认；负责人随后回复“确认无问题”，当前复核结论见本文件第 7 节。该复核只解除前置门，不授权 C2 实施。
5. 上述合同和实现位于隔离树 C:\Users\HU\.codex\worktrees\task20-phase2-parent-relation-binding-contract；尚未整合进主树。当前任务的主树写入限 PLANS.md 与本合同。

## 1. 目标与边界

补齐健康异常流程的员工和管理侧合成切片：教师用固定选项上报；授权范围内的校区/机构审核角色人工处理、补充或升级；审核者明确发布后，家长才可查看并收到页面内模拟通知；管理端提供受限审核和范围统计。Web 提供历史、详情和批量审核；Mini 提供现场快速上报与跟进。

沿用已注册 Mini 员工快捷处理页和家长首页，不新增小程序页面或注册项；Web 复用现有教师报告和家长页；Admin Web 新增一个审核入口，精确写集见第 2 节。

- 仅使用固定虚构记录和有限选项，界面标注“模拟数据”。不输入自由文本、姓名、手机号、学生身份、诊断、体温、药物、照片、附件或真人健康细节。
- 处理、补充、升级和家长可见摘要均用固定选项。禁止 AI 自动判断、医疗建议、自动处置和未经人工复核的对外结论。
- 每次动作重验当前合成 actor/关系、角色、成员状态、tenant、campus、class 和关系状态。教师与审核人只能操作获准范围。
- 平台管理员只能看去标识化合计；机构/校区审核角色按最小必要原则查看固定合成摘要。
- 必须由授权审核角色明确发布；撤回后家长摘要和通知立即隐藏。页面内通知无推送、短信或实际送达。
- 家长回执仅代表本机阅读/知悉，不改变员工处理状态，不代表诊疗或实际沟通。
- 仅内存状态；刷新、解绑/换绑、成员停用、角色或范围改变时清除草稿、详情、通知和失效回执。
- 不接真实认证、API、数据库、伙伴云、正式 AI、网络、持久化或新依赖；不改 lockfile。

## 2. 拟议实施精确写集

仅在负责人另行授权本合同实施后可写下列路径。开始时逐项核对存在状态、哈希和工作树现场；基线不符或发生冲突即停止，不覆盖、不增补白名单。

### Web（8）

| 操作   | 路径                                                     | 用途                                         |
| ------ | -------------------------------------------------------- | -------------------------------------------- |
| CREATE | apps/user-web/src/pages/health-incident-workflow.ts      | 合成事件、状态、范围校验、发布和本地通知投影 |
| CREATE | apps/user-web/src/pages/health-incident-workflow.test.ts | 状态机、权限、回退、幂等、隐私和无副作用测试 |
| MODIFY | apps/user-web/src/pages/parent-health.ts                 | 只投影已发布摘要与本地知悉回执               |
| MODIFY | apps/user-web/src/pages/parent-health.test.ts            | 发布/撤回、关系失效、通知和回执测试          |
| MODIFY | apps/user-web/src/pages/parent-home.ts                   | 现有家长首页展示已发布摘要                   |
| MODIFY | apps/user-web/src/pages/staff-report.tsx                 | 现有教师报告入口的历史、详情和审核/批量控件  |
| MODIFY | apps/user-web/src/main.ts                                | 动作、焦点和会话清理；不新增 user-web 路由   |
| CREATE | tests/e2e/health-incident-review.spec.ts                 | 上报、审核发布、家长可见、撤回和越权 E2E     |

### Admin Web（3）

| 操作   | 路径                                                | 用途                                                       |
| ------ | --------------------------------------------------- | ---------------------------------------------------------- |
| CREATE | apps/admin-web/src/pages/health-incident-review.tsx | 中文合成审核页；范围审核只显示最小摘要，平台管理员只看合计 |
| MODIFY | apps/admin-web/src/main.ts                          | 注册单个 /admin/health-review 入口                         |
| CREATE | apps/admin-web/test/health-incident-review.test.mjs | 路由、范围、匿名聚合和拒绝测试                             |

### Mini（18）

| 操作   | 路径                                                  | 用途                                      |
| ------ | ----------------------------------------------------- | ----------------------------------------- |
| CREATE | apps/mini-program/src/pages/health-incidents.ts       | 员工/家长共用的本地状态转换和安全投影     |
| CREATE | apps/mini-program/src/pages/health-incidents.test.ts  | 模型、控制器、权限、清空和无网络/存储测试 |
| CREATE | apps/mini-program/src/pages/health-incidents.js       | 仅由现有编译器生成                        |
| MODIFY | apps/mini-program/src/pages/parent/health.ts          | 只展示已发布内容和知悉回执                |
| MODIFY | apps/mini-program/src/pages/parent/health.js          | 仅本轮编译且输出变化时生成                |
| MODIFY | apps/mini-program/src/pages/parent/health.test.ts     | C1 家长行为和发布/撤回回归                |
| MODIFY | apps/mini-program/src/pages/parent/session.ts         | 角色/关系/范围改变时清空状态              |
| MODIFY | apps/mini-program/src/pages/parent/session.js         | 仅本轮编译且输出变化时生成                |
| MODIFY | apps/mini-program/pages/parent/home/index.ts          | 重新进入时读取当前有效发布投影            |
| MODIFY | apps/mini-program/pages/parent/home/index.js          | 仅本轮编译且输出变化时生成                |
| MODIFY | apps/mini-program/pages/parent/home/index.wxml        | 显示已发布摘要、模拟提醒和本地知悉动作    |
| MODIFY | apps/mini-program/pages/parent/home/index.wxss        | 仅增加本区样式                            |
| MODIFY | apps/mini-program/src/pages/staff/quick-action.ts     | 复用快捷页处理模拟上报和跟进              |
| MODIFY | apps/mini-program/src/pages/staff/quick-action.js     | 仅本轮编译且输出变化时生成                |
| MODIFY | apps/mini-program/pages/staff/quick-action/index.ts   | 每次操作重验员工范围                      |
| MODIFY | apps/mini-program/pages/staff/quick-action/index.js   | 仅本轮编译且输出变化时生成                |
| MODIFY | apps/mini-program/pages/staff/quick-action/index.wxml | 固定选项上报与跟进控件                    |
| MODIFY | apps/mini-program/pages/staff/quick-action/index.wxss | 仅增加本区样式                            |

### 隔离工作树内的合同回执（1）

| 操作   | 路径                                                                        | 用途                                                        |
| ------ | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| CREATE | docs/superpowers/plans/2026-09-30-task20-phase2-m32-next-synthetic-slice.md | 获实施授权后，将已批准合同复制到隔离树并只记录实施/验证回执 |

产品实现与测试共 29 路径，另有 1 个隔离树合同回执路径；合计 30 条。主树上的本合同仅为授权来源，本次没有将其复制到其他工作树。

禁止修改其它路径，包括 app.json、任何 index.json、project.config.json、project.private.config.json、tsconfig.json、staff.test.ts、API、数据库、访客页、全局样式、依赖和 lockfile。若导入或路由结构不匹配，停止并申请新合同。

## 3. 行为与验收

- 状态只使用 V3 六种值：DRAFT、SUBMITTED、CONFIRMED、RETURNED、CANCELLED、EXCEPTION_PENDING。申请人可在审核前撤回；授权审核者可确认、退回或升级；退回后报告者只能按固定选项重交；补充/升级必须由审核者显式执行。
- CONFIRMED 不等于发布。审核者必须单独发布；撤回立即隐藏家长摘要。重复操作幂等；非法回退、重放、越权及跨范围动作拒绝且不记录成功审计。
- Web 历史、详情和批量操作每次检查整批范围；如任一对象失效或越权，整批拒绝，不产生部分成功。
- Admin Web 只展示合成队列/状态计数，不输出学生姓名、学生 ID、健康正文或可反推单个学生的行。
- 家长仅可读取有效关系范围内已发布的最小摘要。阅读/确认仅改变独立回执。
- TDD：先新增行为测试并观察正确原因的 RED，再实现。测试六态合法/非法转换、回退、重交、重复操作、补充/升级、发布/撤回、null/未知值、伪造 dataset、失效成员/关系、tenant/campus/class 越权、身份角色、重复 ID、隐藏节点与 setData 清空。
- 网络、存储、推送、AI、定时审核调用必须为 0；中文、焦点、窄屏、大字和无重叠需验证。微信 DevTools 原生视觉由负责人手动复核，浏览器复现不替代原生结果。
- C2 通过不代表 M3.2 完成。仍须核对 Leave 审核、CareRecord 教师创建/处理和 V3 全对象批量操作；缺口关闭前不得标记 M3.2 完成或进入 M3.3。

## 4. 实施授权后的验证

在隔离集成树使用已安装工具运行：

    node node_modules/typescript/bin/tsc -p apps/user-web/tsconfig.json --typeRoots node_modules/@types --noEmit
    node apps/user-web/build.mjs
    node --test apps/user-web/dist/pages/health-incident-workflow.test.js apps/user-web/dist/pages/parent-health.test.js
    node --test apps/admin-web/test/health-incident-review.test.mjs
    node --test tests/e2e/health-incident-review.spec.ts
    node node_modules/typescript/bin/tsc -p apps/admin-web/tsconfig.json --typeRoots node_modules/@types --noEmit
    node node_modules/typescript/bin/tsc -p apps/mini-program/tsconfig.json --noEmit --typeRoots node_modules/@types
    node --test apps/mini-program/src/pages/health-incidents.test.ts apps/mini-program/src/pages/parent/health.test.ts
    node scripts/verify_mini_page_registration.mjs --require-generated-js
    git diff --check

另对第 2 节非生成源码逐条运行现有 ESLint 和 Prettier；Mini WXML 使用 html parser，WXSS 使用 css parser。仅通过现有 TypeScript Compiler API 生成本合同列出的 JS，逐字节比较，仅写入实际变化的白名单输出。

Web/Admin E2E 与视觉复核覆盖 320×568、390×844、1365×900，无外部/失败请求、存储访问、页面错误或横向溢出。Mini 在 C1 集成树的 apps/mini-program 目录以普通编译复核上报、跟进、审核发布、家长通知/知悉和解绑清空。截图仅存既有忽略的 Web dist 并记录 SHA。

## 5. 工作树与停止条件

- 拟复用隔离集成树 C:\\Users\\HU\\.codex\\worktrees\\task20-phase2-parent-relation-binding-contract；仅当 C1 Owner Review 通过且 C2 另获实施授权后可修改。届时重查 HEAD、索引、文件哈希和未跟踪路径元数据。
- 主树缺少 parent-home、parent-health 与健康审核页面；C1/C2 不会因本合同复制到主树。主树整合需单独授权。
- 若页面注册要求修改白名单外文件，或需要新依赖/lockfile、真实数据/服务、网络、持久化、真实认证、AI、自由文本或扩大写集，立即停止并报告。
- C1 原生复核未通过、工作树基线与合同不符、同名路径内容改变或存在冲突时，不覆盖、重置、清理；先报告证据。
- 同一错误最多自动修复两轮；仍失败则记录 PRODUCT_ISSUE 或 INFRASTRUCTURE_ISSUE 和实际影响，不降低标准制造 PASS。
- 不 commit、push、部署、上传或发布；本地实现与 Owner Review 通过不等于主树整合或真实服务授权。

## 6. M3.2 完成门

C2 完成后建立逐项 V3 对照表，提供七对象、六状态、双端职责、审核范围、批量处理和权限/隐私负向测试的文件与实际结果。至少为 Leave 审核和 CareRecord 教师创建/处理另设合同并完成复核；之后才能提交 M3.2 收口合同。M3.3 接送流程另需合同和授权。

当前仍为待审批草案。C1 Owner Review 已由负责人确认通过；负责人仍需审阅本合同并另行明确授权，之后才能启动第 2 节实施。

## 7. C1 Owner Review 更新（2026-09-30）

负责人在收到微信开发者工具复核步骤后回复“确认无问题”。据此记录：

- TASK20_PHASE2_M32C1_OWNER_REVIEW=PASS_USER_CONFIRMED
- TASK20_PHASE2_M32C1_MINI_VISUAL_REVIEW=PASS_OWNER_REPORTED
- 本结果是负责人手动复核，不是助手通过自动化控制器编译或截图；范围仅限 C1 本地合成演示。
- TASK20_PHASE2_M32C2_CONTRACT_STATUS=PENDING_OWNER_APPROVAL
- TASK20_PHASE2_M32C2_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED

该确认不授权主树业务代码整合、commit、push、部署或发布。
