# TASK20_PHASE2_M33_PICKUP_SYNTHETIC

## 0. 合同状态与前置门

- TASK_ID：TASK20_PHASE2_M33_PICKUP_SYNTHETIC
- 合同状态：CONTRACT_READY_IMPLEMENTATION_GATED_BY_M3_2_CLOSEOUT
- 来源：V3 §7 M3.3、M32G Web/Mini/Admin 覆盖矩阵及负责人 2026-10-01 的继续开发要求。
- V3 文件：docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md
- V3 SHA-256：ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38
- 本地合成实现已获负责人当前指令授权；先决条件仍是 M3.2 收口。不得绕过 M32D/M32F 小程序原生复核或把未运行检查标成通过。
- 计划隔离工作树：C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign。该树含已有 M32D–H 和品牌 UI 未提交现场，实施时逐文件记录基线并保留现场；不新建或清理工作树。
- 主工作树业务代码不在本合同写集；PLANS.md 仅同步本合同路径和状态。

## 1. 目标、边界与验收结果

为用户网页、微信小程序和管理网页分别补齐 M3.3 接送授权/接送记录的本机合成流程。每端仅使用各自独立的内存样例；不得声称跨端同步、真实身份核验、真实通知送达或真实放行。

用户网页的家长可从已有家长首页查看固定合成接送授权、启用/撤销预置授权和查看本端事件历史。小程序复用现有家长首页与员工快捷页，在同一小程序运行进程内完成家长授权、员工选择有效授权条目、确认人工核对、教师确认接送、家长看到本机模拟通知状态。管理网页提供范围内异常队列及仅含元数据的审计视图；平台管理员只能看到匿名汇总，不得看逐条对象。

每次操作都重新检查合成角色、成员状态、有效监护关系、租户/校区/班级、授权有效期、授权版本和接送记录当前状态。无有效授权、跨校区、撤销/过期授权、错误授权对象、重复接送、旧版本、无权角色或异常时一律拒绝放行，且不得产生部分成功。

明显标记“模拟数据 / 仅本机演示”。只允许预置的虚构学生代号、授权人代号和固定选项；禁止自由输入姓名、手机号、证件号、证件照片、住址或自由文本。禁止人脸识别、扫描证件/二维码、摄像头、定位、真实设备门禁、真实接送判断、真实推送/短信、网络、持久化、API、数据库、伙伴云、正式 AI、新依赖及 lockfile 变更。

## 2. 精确写集（23 个路径）

只允许以下文件。开始实施前记录隔离工作树 HEAD、索引状态、这些路径的存在性和 SHA-256。任何写集外路径需要变化、任何已有内容无法安全保留或编译改写额外 Mini JS 时立即停止。

### 用户网页（5）

1. MODIFY apps/user-web/src/main.ts：将本机授权状态和家长首页投影接入现有事件分发；清除无效关系的演示状态。
2. MODIFY apps/user-web/src/pages/parent-home.ts：显示授权列表、固定操作、事件历史和仅本机通知状态。
3. CREATE apps/user-web/src/pages/pickup-authorizations.ts：家长端合成授权模型、范围验证、历史投影和渲染。
4. CREATE apps/user-web/src/pages/pickup-authorizations.test.ts：授权启停、范围、有效期、版本、关系清除和禁止副作用测试。
5. CREATE tests/e2e/pickup-workflow.spec.ts：验证现有家长页内授权/历史流程、管理员异常只读边界、窄屏布局和无网络/存储。

### 管理网页（3）

6. MODIFY apps/admin-web/src/main.ts：在现有分发器接入接送审核/异常入口；不改构建或权限配置。
7. CREATE apps/admin-web/src/pages/pickup-review.tsx：机构/校区异常队列、元数据审计与平台匿名汇总。
8. CREATE apps/admin-web/test/pickup-review.test.mjs：范围、异常处理、匿名汇总、旧版本与无放行权限测试。

### 微信小程序（15）

9. CREATE apps/mini-program/src/pages/pickup-workflow.ts：小程序独立内存模型、授权与接送状态转换、权限/范围校验和本机通知投影。
10. CREATE apps/mini-program/src/pages/pickup-workflow.test.ts：正常闭环、撤销/过期、跨范围、重复、旧版本、异常拒绝和无网络/存储测试。
11. CREATE（仅编译生成）apps/mini-program/src/pages/pickup-workflow.js：只有由既有 TypeScript 编译器生成且内容确有变化时写入。
12. MODIFY apps/mini-program/src/pages/parent/session.ts：将接送合成状态纳入现有页面会话；关系、成员、角色或范围失效时清理。
13. MODIFY（仅编译生成）apps/mini-program/src/pages/parent/session.js：仅更新本合同必要的生成差异。
14. MODIFY apps/mini-program/pages/parent/home/index.ts：接入家长授权启停、事件历史和通知状态。
15. MODIFY（仅编译生成）apps/mini-program/pages/parent/home/index.js：仅更新本合同必要的生成差异。
16. MODIFY apps/mini-program/pages/parent/home/index.wxml：增加中文固定控件与明显的模拟标识。
17. MODIFY apps/mini-program/pages/parent/home/index.wxss：只增加接送区域局部样式。
18. MODIFY apps/mini-program/src/pages/staff/quick-action.ts：为接送动作保留现有员工访问门并按每次操作重验身份与范围。
19. MODIFY（仅编译生成）apps/mini-program/src/pages/staff/quick-action.js：仅更新本合同必要的生成差异。
20. MODIFY apps/mini-program/pages/staff/quick-action/index.ts：在现有员工快捷页提供选择授权对象、人工核对确认、接送确认及失败结果。
21. MODIFY（仅编译生成）apps/mini-program/pages/staff/quick-action/index.js：仅更新本合同必要的生成差异。
22. MODIFY apps/mini-program/pages/staff/quick-action/index.wxml：增加固定选择、明确的模拟核对和禁止放行提示。
23. MODIFY apps/mini-program/pages/staff/quick-action/index.wxss：只增加接送区域局部样式。

不新增 Mini 路由或页面注册，不修改 app.json、index.json、staff.test.ts、项目配置、其他家长/员工页面、网站公共访客页、API、数据库、依赖或 lockfile。

## 3. 状态与安全规则

- 家长授权只从两个预置合成授权对象中选取；有效期只能从固定时段选择。家长可启用或撤销自己关系范围内的授权，不能编辑他人或任意添加身份。
- 接送个案状态：READY → VERIFIED → RELEASED；任何安全条件失败直接转为 BLOCKED。异常仅可进入 EXCEPTION_PENDING，由有范围的机构审核员记录“保持阻断/已复核”，不得通过管理端覆盖失败条件放行。
- VERIFIED 需要员工显式选择有效且同范围的授权对象，并勾选“已完成本机模拟人工核对”；该勾选不构成真实身份核验。
- RELEASED 为本机模拟终态。同一合成学生/接送时段只允许一次；重复、并发版本或失效授权的第二次动作均 fail closed。
- 家长页面的模拟通知只是同端内存投影。User Web、Mini、Admin 状态彼此独立，Admin 的操作不改变家长网页或另一设备状态。
- Admin 审计仅含事件类型、范围代号、时间、结果、固定原因类别及版本；不得含学生/授权人代号、姓名、日期细节或身份材料。平台管理员只看不可反推个体的计数。
- 任何失败返回原状态并留下不含个人内容的拒绝结果；不得建立 RELEASED 记录或家长“已接送”通知。

## 4. 验证与完成门

在隔离工作树使用现有依赖，仅运行：

- Mini：node --test apps/mini-program/src/pages/pickup-workflow.test.ts apps/mini-program/src/pages/parent-entry.test.ts apps/mini-program/src/pages/mini-brand-ui.test.ts；Mini tsconfig noEmit 类型检查。
- User Web：现有 TypeScript noEmit 检查与本地构建；运行编译后的授权 focused test 和 tests/e2e/pickup-workflow.spec.ts。
- Admin Web：类型检查、构建及 pickup-review.test.mjs。
- 对本合同编写的 TS/TSX/MJS/WXSS 做现有 ESLint/Prettier --check；WXML 用页面完整性测试和微信开发者工具编译验证，不得为了通用 HTML 格式器大规模重排既有整页。
- 本地浏览器查看 320×568、390×844、1365×900；确认无溢出/遮挡，网络请求、浏览器存储和页面错误为零。
- 执行 Mini 页面完整性测试、源码网络/存储/摄像头/位置调用审计、精确 23 路径范围审计和 git diff --check。
- 微信开发者工具从指定隔离工作树全量编译，由负责人人工复核家长启停授权 → 员工人工模拟核验与确认 → 家长查看本地通知 → 撤销/重复/跨校区均失败。助手不得以普通浏览器截图代替原生复核。

只有以上本地检查通过且 M3.2 门已经关闭，才可报告本阶段实现完成；仍只表示本地合成演示。禁止 commit、push、部署、上传、发布或选择性同步到主工作树。

## 5. 技能与停止条件

- long-horizon-development：将父家长授权、Mini 员工操作、Admin 异常审计分成同一合同下可单独验收的子目标。
- test-driven-development：每类安全失败先增加失败测试，再写最小实现。
- frontend-design 与 frontend-design-review：延续新版绿黄中文界面，检查窄屏、卡片间距、按钮对齐、触达尺寸与状态可读性。
- using-git-worktrees：仅复用既有隔离树，保护未提交现场；不新建、清理或切换到主树实施。
- verification-before-completion 与 requesting-code-review：执行完整矩阵并独立审查精确差异后再报告。

如果 M3.2 原生复核未完成、需要超出 23 条路径、生成额外 JS、添加依赖/服务/配置、引入真实个人资料或无法避免任何真实放行含义，立即停止并报告，不自行扩大合同。
