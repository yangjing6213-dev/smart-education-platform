# G2.1 多孩子与历史记录：本地实施批次

状态：PASS_LOCAL_IMPLEMENTATION_AND_INDEPENDENT_REVIEW。依据负责人“取消普通本地逐项授权、由执行者负责完成”的当前指令自主执行；不代表真实机构启用或发布许可。微信原生控件实际点击仍NOT_RUN，不能以此状态代替。

产品来源为58页项目方案PDF v2.0及2026-10-03总实施方案G2.1；G1.5共享核心及三端接线已通过独立自动验证，小程序原生实点仍待完成。先以两位明显虚构学生验收多关系，不导入任何真实档案。

## 1. 目标与操作

当前共享服务只有示例学生甲。家长能提交关系、请假和查看成长记录，但不能切换多个孩子；各端也没有统一的历史过滤。先解决数据归属与切换，再在G2.2/G2.3增加考勤和接送，避免后来重复补权限。

- 家长绑定：在服务提供的固定示例邀请范围内选择学生→确认提交。现有学生甲与测试保留，新增同校区同班的示例学生乙；不新增真实姓名、手机号或自由学生搜索。
- 家长首页：只列当前监护人已审核关系。选择孩子后，只显示该关系对应的成长记录与请假；切换立即清除旧详情、编辑选择和待知悉状态。两个监护人仍分别确认，解除一个关系不解除其他关系。
- 网页：按孩子、日期区间查看成长/请假历史；空结果明确显示“该条件下暂无记录”。过滤只作用于已获授权的服务结果，不用前端过滤替代服务端权限。
- 小程序：默认当天，提供日期选择和查看历史；保留当前绿黄玻璃界面和九个既有页面。不另造一套业务队列，不复制网页复杂筛选面板。
- 教师：填报成长记录时明确选择当前授权学生；同学生同日期不得重复创建，但不同学生同一天互不冲突。负责人审核列表显示准确的学生与日期。
- 管理网页：在既有成长记录审核页明确学生归属，可按授权学生查看；切换过滤不改变审核身份或服务范围。

## 2. 服务与界面责任

共享服务增加固定合成学生名册，并保留现有学生甲的稳定ID/别名。新增只读 `GET /local/student-options`，由当前会话的固定成员/邀请范围生成可用选择；无权限返回空结果，未知或越范围别名提交统一不可用，不泄露其他机构是否存在某个学生。现有申请接口继续接受固定别名，由服务决定实际学生ID、租户、校区和班级，页面不得自报这些范围。

绑定、请假和成长记录继续使用同一内存仓库与版本规则。家长查询只返回本人已批准关系中的记录；服务投影带可校验的学生ID/标签，前端只能选择服务器允许的学生或本人已批准关系。成长记录的查看/知悉按监护人、绑定、记录、发布版本隔离，不能因切换学生继承别人的已读状态。

客户端只保存当前选择和筛选条件。取消关系、身份切换、断线、401时清空相关选择/详情；迟到的旧请求不能覆盖新选择。切换孩子本身不创建记录、不发送知悉、不模拟授权成功。固定示例邀请列表不代表正式身份验证。

## 3. 精确写集与隔离责任

每个执行者先在自己的日志记录现状指纹；下列为本批候选写集，只写实际需要的路径。新增名单之外的实现必须先更新该批记录并自审范围，不能顺手修改历史模型、受保护测试或其他工作树。

### 共享核心树 `task20-local-shared-core`

- apps/api/src/local-synthetic/sessions.ts
- apps/api/src/local-synthetic/binding-leave.service.ts
- apps/api/src/local-synthetic/care-record.service.ts
- apps/api/src/local-synthetic/repository.ts
- apps/api/src/local-synthetic/routes.ts
- apps/api/test/local-synthetic-multi-student.test.ts（新增）
- tests/local-synthetic/multi-student.test.mjs（新增）
- docs/exec-plans/active/multi-student-core.md（新增）
- docs/exec-plans/active/multi-student-core-baseline.json（新增）
- 已忽略的现有API编译产物。

### 用户网页树 `task20-web-completion`

- apps/user-web/src/local-synthetic/client.ts
- apps/user-web/src/local-synthetic/projections.ts
- apps/user-web/src/local-synthetic/care-ui.ts
- apps/user-web/src/local-synthetic/client.test.ts
- apps/user-web/src/local-synthetic/projections.test.ts
- apps/user-web/src/local-synthetic/care-ui.test.ts
- apps/user-web/src/main.ts
- apps/user-web/src/styles/user-web.css
- apps/user-web/preview.mjs
- apps/user-web/test/preview.test.mjs（仅新增学生选择接口代理断言）
- apps/user-web/test/shared-multi-student-browser.mjs（新增）
- docs/exec-plans/active/web-multi-student.md（新增）
- docs/exec-plans/active/web-multi-student-baseline.json（新增）
- 已忽略的现有Web编译产物。

### 小程序树 `task20-mini-brand-redesign`

- apps/mini-program/src/local-synthetic/client.ts
- apps/mini-program/src/local-synthetic/page.ts
- apps/mini-program/src/local-synthetic/client.test.ts
- apps/mini-program/templates/local-synthetic.wxml
- apps/mini-program/app.wxss
- apps/mini-program/src/local-synthetic/client.js（仅当前TS编译变化）
- apps/mini-program/src/local-synthetic/page.js（仅当前TS编译变化）
- apps/mini-program/src/local-synthetic/multi-student.test.ts（新增）
- docs/exec-plans/active/mini-multi-student.md（新增）
- docs/exec-plans/active/mini-multi-student-baseline.json（新增）

### 管理网页树 `task20-admin-completion`

- apps/admin-web/src/local-review/client.ts
- apps/admin-web/src/local-review/view.ts
- apps/admin-web/src/main.ts
- apps/admin-web/local-proxy.mjs
- apps/admin-web/index.html
- apps/admin-web/test/local-review.test.mjs
- apps/admin-web/test/local-proxy.test.mjs
- apps/admin-web/test/multi-student-browser.mjs（新增）
- docs/exec-plans/active/admin-multi-student.md（新增）
- docs/exec-plans/active/admin-multi-student-baseline.json（新增）
- 已忽略的现有Admin编译产物。

### 主树记录

- PLANS.md
- docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md
- 本文件。

本批不改 `staff.test.ts` / `staff.test.tsx`、Mini注册/配置、依赖或lockfile，不触碰旧回退树；不接真实服务，不使用持久化，不提交/推送/部署/发布。启动器小批由另一个执行者在独立写集中收尾，与本批业务文件不交叉。

## 4. 实施顺序和验收

1. **共享核心先行。** 新测试先失败；学生甲旧23项保持通过。两学生分别绑定，同日成长互不冲突，解绑甲后乙仍可读；家长甲/乙的回执互不影响。拒绝未知学生、异机构、异校区、异班、他人绑定ID、旧版本和伪造身份字段，服务不泄露学生存在信息。
2. **各端接线。** 按服务返回ID/标签选择，不重写成旧演示字符串。网页实际多窗口、小程序实际生成JS Page处理函数、管理网页审核显示相同学生ID/版本；切换学生、迟到响应、日期空结果、无网络和解绑后旧详情清空均需测试。原绑定/请假/成长完整流程继续通过。
3. **独立复核与当前状态。** 相关focused tests、typecheck/build、ESLint、Prettier、Mini注册/编译护栏、diff与写集审计。至少390/1280网页截图和无溢出；微信开发者工具中的选择器/按钮实际点击若未执行，明确NOT_RUN，不凭Page测试声明原生验收完成。通过后进入G2.2考勤，再推进G2.3接送。

范围控制：不在本批实现正式邀请、短信、监护关系证件、学校学生查询、批量导入、真实同意记录或账单；这些需求保留总方案相应目标，不把固定合成名单算作正式功能完成。
