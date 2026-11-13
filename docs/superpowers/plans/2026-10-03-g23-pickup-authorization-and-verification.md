# G2.3 接送授权、现场人工核验与异常跟进

STATUS=INDEPENDENT_DESIGN_REVIEW_PASSED_WAITING_G2_2_VALIDATION

依据项目方案PDF v2.0第30页完整接送链、第29/31页双端分工、第43页隐私、第53页高频操作和高风险审计要求。当前负责人已允许自主安排普通本地批次；本批仍仅合成数据，不能用于真实学生放行。输入为已验证的多孩关系、共享服务和G2.2到离考勤；G2.2各端自动复核闭合后才修改服务，避免并行变更既有接口。

## 1. 必须实现的闭环

1. 家长在自己已审核的孩子下设置固定示例常用接送人或临时授权。只提供“示例接送人甲/乙”等虚构选项，不收集真实姓名、手机号、证件、面部或照片。
2. 显示学生、班级、接送人、有效期，家长再点一次“确认授权”才生效。撤销也先展示将失效的授权，再明确确认。更换接送人采用撤销原授权后新建并确认，不静默改写已生效授权或接送历史。
3. 家长从有效授权生成短时动态凭证，仅在当前页面显示；教师从当前负责学生入口核验凭证，再人工勾选“学生一致”“接送人一致”“授权信息一致”，最后确认离校。
4. 服务在最后确认时重新验证当前绑定、授权版本、有效期、凭证、教师范围与考勤版本。任一失效都不生成成功接送，不修改离校状态；不能只相信第一次核验结果。
5. 同一操作生成不可覆盖的接送记录、同步考勤离校事件和审计；家长在自己的孩子下看到该次离校反馈。这里是本机页面结果，不假称已推送微信消息或短信；正式消息接入仍待G2.5及真实服务启用。
6. 无授权、凭证失效、信息不匹配或超时未接走，教师登记待跟进项，负责人记录处理结果。处理异常不能绕过授权直接放行；解决异常后如需离校仍重新走有效核验。

## 2. 数据与安全规则

- `PickupAuthorization` 与 `PickupRecord` 分开。授权含服务生成ID/版本、批准绑定、学生/机构/校区/班级、创建监护人、固定接送人、常用或临时类型、有效时间、状态与修订审计。状态 `DRAFT→ACTIVE→REVOKED`；过期由服务当前时间判定，不能因页面缓存仍显示有效。
- 时间设计：临时授权用于明确的一天和时间窗；常用授权有明确开始/截止日期以及每天的有效时段，首批最长90天。首批同日时间窗，不处理跨午夜；无期限、非法日期、开始晚于结束、超长范围一律拒绝。任何调整重新二次确认，不在确认页面自动激活。
- 一个监护人只能管理自己有效绑定所创建的授权。多个监护人的独立绑定不互相代替，也不允许撤销他人的授权；每份授权实际有效性每次重新看其来源绑定。解除甲的绑定仅使甲来源授权/凭证失效，乙的有效关系与授权保留。
- 动态凭证是服务生成的高熵一次性值，最长5分钟，绑定授权ID/版本、学生、关系和有效时段。仅创建它的家长能领取；不写浏览器存储、文件、日志或审计正文。普通列表不返回凭证。页面关闭不意味着授权撤销；服务重启清除全部本地数据及凭证。
- 同一授权再次领取时轮换旧凭证，并让引用旧凭证的待确认步骤失效；不保留多个并存有效凭证。测试截图隐藏凭证正文，不在失败日志打印请求中的凭证值。
- 核验结果是短时待确认步骤，不能当作已接走。教师确认时凭证未过期、未使用，授权和批准关系仍有效；信息人工确认项全为真，学生已到校且未离校，无待审核考勤纠正。重复点击或另一个教师用同凭证不得产生第二条接送或第二个离校事件。
- 核验步骤ID绑定执行核验的教师actor、学生、授权ID/版本及考勤ID/版本，不能交给另一教师确认。步骤有效期不长于凭证或授权的剩余有效期；最终确认再取当前可信成员范围。任何失败不消耗凭证；只有完整成功写入才标记已使用。
- 服务统一按 `Asia/Shanghai` 判定日期、当天、授权时窗和考勤日期，使用服务可信时钟；客户端日期只作输入。跨午夜和到期边界用可注入时钟验证，不依赖测试机器所在时区。
- 每个学生同日期最多一条成功接送记录。即便之后通过考勤纠正把状态改回已到校，也不能拿新凭证制造第二次成功接送；事后更正走追加复核，不能绕开不可覆盖历史。
- 接送记录包含学生、授权引用和版本、固定接送人、日期/时刻、教师、服务侧示例终端标识、人工核对事实和审计。示例终端标识不宣称识别了真实设备。记录创建后不可PATCH/覆盖；如事后发现录错，另建追加说明/复核事件，不把历史删除后重写。
- 接送记录与考勤离校要在服务中一次校验并一起写入，不能先写成功接送、后因考勤版本冲突留下半条流程。当前单进程内存仓库也必须有失败全不写、成功只写一次的测试。
- 家长只读投影不包含其他监护人、教师内部ID、凭证、内部核验详情或异常处理原文。按自己当前批准关系查看孩子的离校时间和必要结果；解绑即清旧内容，切换孩子不带走旧凭证或详情。
- 教师只看负责班级，负责人只处理其机构/校区，平台默认无学生明细。所有请求中的客户端身份/范围注入拒绝；无权和未知对象使用统一不可用响应，不能探测其他学生是否存在。
- 不做人脸识别、自动身份判断或自动真实放行；核验责任由现场人员承担。仅使用固定虚构素材/数据，无真实拍摄、定位、微信扫码权限、外部服务或新依赖。本批可输入仅由本地服务生成的短时凭证；二维码呈现作为后续可选便利，不代替凭证与人审规则。

## 3. 异常与最简页面

异常对象与成功记录分开，状态 `OPEN→FOLLOWING→RESOLVED`，固定类别“暂无有效授权／信息不符／凭证不可用／超时未接走”。教师登记自己范围内的学生；负责人选择固定处理结果，并保留操作者/时间。不能用“已解决”自动生成成功接送。

当天预计接走时间来自有效授权的明确时间窗。到截止仍是已到校、未接走，页面显示待跟进提示；只读查询不暗中创建业务对象。教师确认登记“超时未接走”才产生异常项。页面显示待联系家长/负责人，不伪造实际消息已送达。无授权时由教师直接登记对应异常，不要求先编造授权才能进入队列。

操作分工：

- 家长网页：当前孩子→接送授权列表/新建/二次确认/撤销、领取凭证、完整历史与日期过滤；长历史主要在网页。
- 小程序：当前孩子当天授权与凭证、教师当天待接学生→人工核对→确认，共用当前九页和统一模板。高频教师操作目标不超过三步；错误情形清楚告诉用户改什么。
- 管理网页：授权只读、异常待办与处理、不可覆盖记录的审计摘要，不提供绕过人工核验的“强制放行”。

## 4. 接口设计与候选写集

服务接口在首个失败测试固定：`/local/pickup-authorizations` 的列举/创建、`/:id/activate`、`/:id/revoke`、`/:id/credential`；`/local/pickup-verifications` 的核验及 `/:id/confirm`；`/local/pickup-records` 家长/员工各自安全投影；`/local/pickup-exceptions` 的登记、列举和 `/:id/review`。请求版本和服务端范围规则沿用既有实现，不接入生产入口。

每树实施前保存指纹与Git状态，以下仅为本批候选：

共享服务树 `task20-local-shared-core`：

- apps/api/src/local-synthetic/pickup.service.ts（新）
- apps/api/src/local-synthetic/pickup-credentials.ts（新，仅短时内存凭证和核验步骤）
- apps/api/src/local-synthetic/repository.ts
- apps/api/src/local-synthetic/sessions.ts
- apps/api/src/local-synthetic/routes.ts
- apps/api/src/local-synthetic/server.ts
- apps/api/test/local-synthetic-pickup.test.ts（新）
- tests/local-synthetic/pickup.test.mjs（新）
- docs/exec-plans/active/pickup-core.md / pickup-core-baseline.json（新）
- 已忽略API编译输出。

用户网页树 `task20-web-completion`：

- apps/user-web/src/local-synthetic/client.ts
- apps/user-web/src/local-synthetic/pickup-ui.ts / pickup-ui.test.ts（新）
- apps/user-web/src/local-synthetic/client.test.ts（仅本批接线/失败清空）
- apps/user-web/src/main.ts
- apps/user-web/src/styles/user-web.css
- apps/user-web/preview.mjs
- apps/user-web/test/preview.test.mjs
- apps/user-web/test/shared-pickup-browser.mjs（新）
- docs/exec-plans/active/web-pickup.md / web-pickup-baseline.json（新）
- 已忽略Web编译输出。

管理网页树 `task20-admin-completion`：

- apps/admin-web/src/local-review/client.ts
- apps/admin-web/src/local-review/pickup-view.ts（新）
- apps/admin-web/src/local-review/view.ts
- apps/admin-web/src/main.ts
- apps/admin-web/index.html（仅必要布局）
- apps/admin-web/local-proxy.mjs
- apps/admin-web/preview.mjs
- apps/admin-web/test/pickup.test.mjs / pickup-browser.mjs（新）
- apps/admin-web/test/local-proxy.test.mjs / preview.test.mjs
- docs/exec-plans/active/admin-pickup.md / admin-pickup-baseline.json（新）
- 已忽略Admin编译输出。

小程序树 `task20-mini-brand-redesign`：

- apps/mini-program/src/local-synthetic/client.ts
- apps/mini-program/src/local-synthetic/page.ts
- apps/mini-program/src/local-synthetic/pickup.test.ts（新）
- apps/mini-program/templates/local-synthetic.wxml
- apps/mini-program/app.wxss
- apps/mini-program/src/local-synthetic/client.js / page.js（仅当前编译变化）
- docs/exec-plans/active/mini-pickup.md / mini-pickup-baseline.json（新）

主树仅本文件、PLANS.md与总方案。若具体实现需要更多路径，先在本记录说明必要性再编辑；不借此改受保护staff测试、Mini注册/配置、依赖或lockfile，不改回退树，不提交、推送、部署或发布。

## 5. 必须拿到的验证

1. 核心先失败测试：草稿无效、二次激活/撤销、临时/常用时窗、凭证到期/版本变化/轮换/一次性、旧核验步骤/另一教师步骤拒绝、错学生/接送人/班级/校区/机构、父子关系失效、多监护人、重复/并发确认、考勤冲突整组不写且凭证未消费、考勤更正后仍禁止同日第二次接送、不可覆盖历史、自报身份字段拒绝和最少审计。用可注入时钟验证北京时间跨日、过期与超时，不让测试依赖真实等待五分钟。
2. 真实浏览器至少家长/教师/负责人三独立窗口：授权→二次确认→领取→人工核验→确认→家长结果，另跑取消授权发生在核验与确认之间、凭证过期、重复确认和异常跟进。不能用直接服务调用替代所有页面点击；各客户端的实际覆盖范围单列。
3. Mini源码和实际生成JS Page通过同一服务场景；所有相关旧绑定/请假/成长/考勤/多孩回归保留。类型、Lint、格式、编译/注册护栏、差异范围和独立审查通过。至少390/1280网页视觉；微信原生未实际点击仍标NOT_RUN，不假称已完成真实接送验收。

不以本批通过宣称完整Phase 2完成。之后仍有费用/收据/协议只读、共享通知和健康异常；教师内部日报、任务、月反馈、物资、受监督学习及SaaS经营继续按总方案排期。

第二人设计复核已通过：确认本地范围与最简页面可行，并补入教师步骤归属、原子消费、凭证轮换、统一时区和同日成功记录防重五项规则；这些是实施验收要求，目前尚无实现通过证据。
