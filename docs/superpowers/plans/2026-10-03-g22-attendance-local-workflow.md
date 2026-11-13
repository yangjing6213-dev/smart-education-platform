# G2.2 到校、离校与考勤纠正：本地实施方案

STATUS=PASS_LOCAL_IMPLEMENTATION_AND_INDEPENDENT_REVIEW_NATIVE_PENDING

日期：2026-10-03。产品依据为58页项目方案PDF v2.0第29页家长到离校查看、第31页教师当天班级考勤、第47页Phase 2考勤、第55页到离与审计矩阵。继承总实施方案的本地自主执行授权。PDF的正式试点和真实服务门槛没有因此完成；本批不涉及真实学生或实际接送放行。

## 1. 用户目标与最小操作

成长记录中的“到离状态”是每日反馈摘要，不能充当有时间、有操作者和可追溯纠正的考勤记录。本批建立独立 `AttendanceRecord`，使用G2.1已完成的授权学生名册和批准关系，不另建学生或身份来源。

- 员工：在现有工作台进入考勤，选当前负责学生，按实际演示情景点“登记到校”“登记离校”或“标记未到”。常用登记以不超过三步为目标，时间默认本机当前日期/时分，可在确认前调整为合法示例值。
- 家长：现有首页直接查看当前孩子的当天到离信息；网页可按日期查历史，小程序以当天为主。只读，不把“打开页面”记作知悉，也不发送真实通知。
- 负责人：在管理端查看待纠正项目、原值和拟改值，批准或退回。教师不能自行批准纠正；审核前保留原生效值，不能静默覆盖历史。
- 请假与未到分开：已确认且日期覆盖的请假在考勤旁标注“已确认请假”，没有到校记录不能自动标成旷课、迟到或惩罚。请假不自动创建到离记录。
- 接送授权是下一批G2.3的独立对象。离校登记记录示例事实，不代表系统已经验证接送人或允许真实放行。

## 2. 数据、状态与边界

每名学生每个日期只有一个有效考勤对象，含服务端生成ID、版本、机构/校区/班级/学生范围、日期、到校时间、离校时间、状态、更新操作者/时间、修订历史和至多一条待审纠正。首次登记后不删除原始记录，不使用自由文本保存学生情况。

正常状态：`NOT_ARRIVED`（人工标记未到）、`ARRIVED`、`DEPARTED`。没有记录显示“尚未登记”，不能默认成功。首次只允许到校或未到；孩子稍后实际到校时，`NOT_ARRIVED→ARRIVED` 是正常登记，保留此前未到历史，无需负责人纠正审核。离校必须已有到校，且同一天离校时间不得早于到校。同学生同一天重复首次登记、重复到校/离校或旧版本命令返回冲突，不重复记成功审计。不同学生同一天互不冲突。

日期与时间独立校验，沿用本地合成业务可测试日期边界，时间为严格24小时 `HH:mm`。未到的到校/离校时间均为null；到校必须有到校时间且离校时间为null；离校必须有两者且顺序合法。普通登记和纠正拟值复用相同校验。不根据客户端时钟自动判定迟到，不生成健康、纪律或能力结论。本批不处理跨午夜托管；不合法跨日应明确拒绝，而非猜测时间。

纠正流程：教师从当前记录选择固定原因（时间录入有误／事件录入有误／补登记），提交拟修改的状态与时间→负责人核对原值及新值→批准或退回。申请和审核都携带当前版本；相同记录存在待审纠正时不接受另一个覆盖性操作。批准才改变家长看到的有效值，并保留原值、申请人、审核人、时间和版本；退回不改变有效值，可重新申请。校区/班级/成员权限每次请求复查。

家长服务投影只含自身已批准关系下的学生、日期、当前到离值和明确的“已更正”标记；不返回员工内部纠正原因、审核人ID、内部原文或其他监护人信息。请假旁标注只投影 `confirmedLeave:boolean`，依据同一学生/范围、仍有效的已批准绑定和覆盖日期的已确认请假计算；不暴露申请监护人、申请对象ID或原因。关系解除、失效或切换后旧详情清空；家长不能用其他孩子的绑定ID读取记录。平台账号仍无学生明细权限。

审计记录必要元数据，不保存学生内容到公共日志。服务端按可信成员注入机构/校区/班级；客户端提交身份、角色或范围字段统一拒绝。仍只监听本机，内存数据随服务重启清空，无存储、短信、微信通知、定位、人脸识别或外部请求。

## 3. 接口与界面落点

新增授权动作 `attendance:write`（负责班级教师）、`attendance:review`（负责人）、`attendance:read`（有效关系家长）。学生名册不会因为新增动作扩大既有机构或班级范围。

候选接口：

- `GET /local/attendance-records` / `GET /local/attendance-records/:id`：按当前权限裁剪；家长只读安全投影。
- `POST /local/attendance-records`：固定学生别名、日期、首次事件和时间；实际范围由服务决定。
- `POST /local/attendance-records/:id/arrive`：仅未到状态，当前版本和到校时间；与录错纠正分开。
- `POST /local/attendance-records/:id/depart`：当前版本和离校时间。
- `POST /local/attendance-records/:id/correction`：当前版本、固定原因、拟生效状态及时间。
- `POST /local/attendance-records/:id/review`：当前版本、批准或退回；无客户端角色/校区字段。

接口结构在实现第一步由测试固定，若状态实现需要细化，只在本方案和各树日志记录后执行，不扩展真实业务。三端只消费该服务的同一对象ID/版本，旧独立离线体验不伪装为已联通考勤。

用户网页沿用现有家长首页、员工工作台/学生记录入口，增加清楚的“考勤”区及日期过滤；管理网页增加现有本机协同导航下的“考勤纠正”视图；小程序沿用九个现有页面、统一模板和绿黄玻璃样式。无需新增Mini路由、修改注册文件或编译配置。

## 4. 候选写集与责任

实施前每树记录当前Git状态、受影响文件指纹及既有失败。只修改本批实际需要的路径；新增辅助文件须先补入本节和本树日志，不能借机改动历史受保护测试。

共享核心树 `C:/Users/HU/.codex/worktrees/task20-local-shared-core`：

- apps/api/src/local-synthetic/attendance.service.ts（新增）
- apps/api/src/local-synthetic/repository.ts
- apps/api/src/local-synthetic/sessions.ts
- apps/api/src/local-synthetic/routes.ts
- apps/api/src/local-synthetic/server.ts
- apps/api/test/local-synthetic-attendance.test.ts（新增）
- tests/local-synthetic/attendance.test.mjs（新增）
- docs/exec-plans/active/attendance-core.md（新增）
- docs/exec-plans/active/attendance-core-baseline.json（新增）
- 已忽略API编译输出。

用户网页树 `task20-web-completion`：

- apps/user-web/src/local-synthetic/client.ts
- apps/user-web/src/local-synthetic/attendance-ui.ts（新增）
- apps/user-web/src/local-synthetic/attendance-ui.test.ts（新增）
- apps/user-web/src/local-synthetic/client.test.ts（仅新增考勤响应与操作验证）
- apps/user-web/src/main.ts
- apps/user-web/src/styles/user-web.css
- apps/user-web/preview.mjs
- apps/user-web/test/preview.test.mjs（仅新增代理允许路径负测）
- apps/user-web/test/shared-attendance-browser.mjs（新增）
- docs/exec-plans/active/web-attendance.md / web-attendance-baseline.json（新增）
- 已忽略Web编译输出。

管理网页树 `task20-admin-completion`：

- apps/admin-web/src/local-review/client.ts
- apps/admin-web/src/local-review/attendance-view.ts（新增）
- apps/admin-web/src/local-review/view.ts
- apps/admin-web/src/main.ts
- apps/admin-web/index.html
- apps/admin-web/local-proxy.mjs
- apps/admin-web/preview.mjs（新增考勤视图的精确静态路径，其他404规则不变）
- apps/admin-web/test/preview.test.mjs（新增考勤视图直接打开/刷新验证）
- apps/admin-web/test/attendance.test.mjs（新增）
- apps/admin-web/test/local-proxy.test.mjs
- apps/admin-web/test/attendance-browser.mjs（新增）
- docs/exec-plans/active/admin-attendance.md / admin-attendance-baseline.json（新增）
- 已忽略Admin编译输出。

小程序树 `task20-mini-brand-redesign`：

- apps/mini-program/src/local-synthetic/client.ts
- apps/mini-program/src/local-synthetic/page.ts
- apps/mini-program/src/local-synthetic/attendance.test.ts（新增）
- apps/mini-program/templates/local-synthetic.wxml
- apps/mini-program/app.wxss
- apps/mini-program/src/local-synthetic/client.js / page.js（仅当前TS编译确实变化）
- docs/exec-plans/active/mini-attendance.md / mini-attendance-baseline.json（新增）

主树仅本方案、PLANS.md与总实施方案进度更新。不改受保护 `staff.test.ts` / `staff.test.tsx`、依赖、lockfile、Mini注册/配置或历史回退树；不提交、推送、部署或发布。

## 5. 实施与验收门

1. 共享核心先失败测试：到校→离校、未到→稍后到校→离校，未到与请假区分、非法时间/日期和空时刻、重复/旧版本、纠正批准与退回、同日双学生、多监护人、跨机构/校区/班级和伪造身份拒绝；原29项共享服务测试保持通过。批准前家长值不变，批准后看到同一ID的新版本，审计可追溯。
2. 三端适配：真实浏览器教师登记→家长查看→教师申请纠正→负责人批准/退回→家长刷新；小程序使用实际生成JS Page和本机HTTP重复同一流程。孩子切换、日期空结果、旧按钮、慢响应、401/409和断线均不能显示或写入旧学生内容；没有真实外发或持久化。
3. 相关类型、Lint、格式、编译新鲜度、页面注册和差异范围检查，至少390/1280网页检查，独立人员复核。微信原生控件点击仍须单列证据，未执行即NOT_RUN；不把网页/页面函数测试当作原生操作通过。完成本批自动验证后继续G2.3接送授权与人工核验，正式接送始终不在本地合成范围。

## 6. 本批实际结果

共享服务37项（原29+新8）、基础45项通过，独立复跑新8项通过。Web196项、4独立窗口5组真实流程通过，独立50项及浏览器通过。Admin61项与两窗口/真实服务9组通过，独立19项/浏览器及修后6项通过；48个编译输出一致。

Mini75项目标源码检查、生成模式新4/原多孩4/原Page8三组和5项护栏通过，九页27个输出复编零变化。生成模式的前三个新客户端用例仍用TS，实际Page用例才加载生成JS并发送本机HTTP，不把16项都称为生成代码或原生控件检查。第二人独立源码4与生成模式4通过。补了未选时间、离校早于到校的明确中文提示，无效输入不发请求；微信原生实际点击仍NOT_RUN。

全部只在各自隔离树实施；精确差异和命令见各树 `docs/exec-plans/active/attendance-core.md`、`web-attendance.md`、`admin-attendance.md`、`mini-attendance.md`。真实认证、通知、数据存储、机构启用与发布没有实施。统一启动器正在以本批最新产物执行最终检查。
