# TASK20 D35：M5.2 小程序清除与教师接手记录删除

## 目标

补齐 D34 确认的 M5.2 清理缺口：家长/教师在 Mini 中可删除已结束的本人学习记录；教师完成本班接手后，可在 Web 与 Mini 的班级摘要清除该条已接手记录。删除前必须先结束练习；教师只能清除已接手且属于其授权校区/班级的记录。

## 精确写集

- `apps/api/src/local-synthetic/learning-session.service.ts`
- `apps/api/src/local-synthetic/sessions.ts`
- `apps/api/test/local-synthetic-learning-session.test.ts`
- `tests/local-synthetic/learning-session.test.mjs`
- `apps/user-web/src/pages/parent-learning.ts`
- `apps/user-web/src/pages/parent-learning.test.ts`
- `apps/mini-program/src/local-synthetic/learning-client.ts`
- `apps/mini-program/src/local-synthetic/learning-client.test.ts`
- `apps/mini-program/src/local-synthetic/learning-client.js`（仅编译后内容变化时）
- `apps/mini-program/src/local-synthetic/client.ts`（仅将学习记录 `/delete` 加入现有本机路径白名单）
- `apps/mini-program/src/local-synthetic/client.js`（仅编译后内容变化时）
- `apps/mini-program/pages/parent/learning/index.ts`
- `apps/mini-program/pages/parent/learning/index.wxml`
- `apps/mini-program/pages/parent/learning/index.js`（仅编译后内容变化时）
- `apps/mini-program/src/pages/parent/learning.test.ts`
- `tests/mini-shared-service.test.mjs`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `docs/superpowers/plans/2026-10-10-task20-d35-m52-mini-and-teacher-delete.md`

## 安全规则

1. 本人只能删除自己已结束的记录；进行中的记录必须先点“结束练习”。
2. 教师可删除自己已结束的本班记录，也可删除本人已接手且仍在授权班级范围内的记录；不能删除其他校区/班级记录、未接手的家长记录或进行中记录。
3. 删除沿用现有本机 API 删除路由并保留不含敏感内容的审计记录；不新增存储或服务。
4. Mini 最近练习列表仅在非进行中记录上显示删除入口；教师班级摘要仅在“教师已接手”记录上显示清除入口。Web 教师摘要复用已有删除事件处理。

## 边界

- 只使用本机合成题目和关系，不连接真实 AI、机构、学生资料、外网、持久化或生产服务。
- 不改 Admin 指标版本（单独列入 D36），不修改路由注册、`app.json`、Mini 其他页面或全局权限配置。
- 不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`；不安装依赖、不修改 lockfile、不提交、推送、部署或发布。
- 生成 JS 仅限合同明确列出的三个文件且仅内容变化时更新；若需要其他生成文件或白名单外修改，停止并回报。
- D35 删除实际复核发现 Mini 共用传输层尚未允许学习记录删除路径；因此将 `client.ts` 的单一路径白名单修正及对应生成 JS 纳入本合同，不扩大到其他请求路径。

## 验收标准

- 先添加服务/路由/客户端/页面测试并确认旧实现失败，再实现最小修复。
- 父家长不能删除进行中练习；结束后可以清除，刷新后不再显示。
- 教师只能删除自己已结束的记录或自己已接手的同班记录；跨班、未接手记录和进行中记录均拒绝。
- Web/Mini 均提供清晰、适时的删除按钮；Mini 实际 Page handler 与本机共享 API 流程通过。
- API/Mini/User Web 定向测试、相关类型检查、ESLint、Prettier API、Mini 页面注册护栏、生成 JS 新鲜度、范围审计和 `git diff --check` 的真实结果写入本合同与计划。

## 本轮验证结果（2026-10-10）

- API：`pnpm --filter @student-care/api build` 通过；`node --test dist/test/local-synthetic-learning-session.test.js` 为 `7/7`；`node --test tests/local-synthetic/learning-session.test.mjs` 为 `1/1`。API build 同时完成类型检查。
- User Web：`pnpm --filter @student-care/user-web build` 通过；`node --test apps/user-web/dist/pages/parent-learning.test.js` 为 `6/6`。build 同时完成类型检查。
- Mini：客户端与页面定向测试 `12/12`；Mini 实际 Page + 本机 HTTP 服务流程 `11/11`，覆盖家长删除已结束练习、教师接手后删除本班记录；定向 TypeScript 检查通过；`node scripts/verify_mini_page_registration.mjs` 输出 `MINI_PAGE_REGISTRATION_PASS`。
- ESLint 对本合同 TypeScript 与 MJS 写集通过。Prettier API 对 11 个代码文件、D35 新增文档段落及合同本身通过；没有重排既有长计划表格。三份 Mini TypeScript 源对应的 JS 均与当前编译输出一致（`GENERATED_JS_FRESH files=3`）。
- `git diff --check` 退出码为 `0`。它提示七个既有无关文件存在 Git 换行风格提示，没有空白错误；本合同 20 条写集均在本合同内，`pnpm-lock.yaml` 未修改。`app.json` 和受保护的 `staff.test.ts` 显示为本轮开始前已有的脏状态，本轮未读取、运行或编辑。
- 独立只读代码审查发现两项覆盖缺口：教师删除“已结束但未接手”的家长记录缺少明确拒绝断言，网页历史可能给其他仍进行中的记录显示删除入口。已补充同班教师删除未接手记录返回 `403` 的测试，并保留进行中记录返回 `409`；网页现在隐藏所有 `ACTIVE` 历史记录的删除入口，新增页面测试确认进行中不可删、已结束可删。复审确认两项均已解决；审查员未改文件、未访问受保护的 `staff.test.ts`。
- 本轮没有微信开发者工具真机/模拟器视觉操作；页面行为由本机合成服务和实际 Page handler 自动验证。未接真实服务，未安装依赖，未提交、推送、部署或发布。
- 结果：`PASS_LOCAL_SYNTHETIC_IMPLEMENTATION_AND_AUTOMATION`; 独立代码复审 `PASS`。Owner Review 与微信开发者工具人工复核未声称通过。
