# TASK20_A1_83E_USER_WEB_GUARDIAN_BINDING_CLIENT_SYNTHETIC

## 目标

让网页家长关系申请通过本机 Nest 关系接口提交，同时继续从同一进程的旧本机接口读取状态，使现有授权页面和小程序员工审核继续看到同一条合成申请。网页只访问同源 Next 路由；该路由只允许固定的本机 Nest 地址和本任务列明的接口。

## 验收标准

1. 未绑定家长可从本机学生候选中选取服务端提供的虚构学生标识，并提交 `GUARDIAN` 申请；不得接受页面传入租户、校区、申请者或其他身份字段。
2. 网页请求通过同源 `/local/...` 路由转发到 `http://127.0.0.1:4321`。代理保留 Bearer 会话、限制路径/方法、拒绝查询参数及非 JSON/过大正文，且不允许外部主机、重定向或公网监听。
3. Nest 申请提交成功后，网页客户端从既有 `/local/binding-applications` 读回同一申请并显示等待审核状态；重复提交及未授权响应不得显示成功。
4. 现有授权、隐私申请和非关系数据仍使用原本的本机 Fastify 接口；Nest 断开时页面显示连接/错误状态，不伪造已提交或已审核状态。
5. 测试先证明旧提交路径或缺少 Nest 代理会使新验收失败，再实现并验证通过。随后运行 user-web 单元测试、类型检查、Lint、生产构建及实际本机 Nest/Fastify + Next 浏览器流程；确认没有外网请求。

## 精确写集

隔离工作树 `C:/Users/HU/.codex/worktrees/task20-a1-53-staff-daily-author-review-20261016`：

- MODIFY `apps/user-web/src/pages/parent-consent.ts`
- MODIFY `apps/user-web/src/pages/parent-consent.test.ts`
- MODIFY `apps/user-web/src/app/local/[...path]/route.page.ts`

上述 3 个产品文件验证通过后，仅同步这 3 个路径到主工作树。主工作树另外 MODIFY `PLANS.md` 与 `docs/exec-plans/active/project-completion.md`，并 CREATE 本合同。只在隔离工作树 CREATE `artifacts/task20-a1-83e-user-web-guardian-binding-20261017/{contract.md,baseline.json,red.log,result.json,scope-audit.json,validation.log}`；写入前目录必须不存在。不得写入本清单之外的路径。

## 基线与执行

- 隔离工作树 HEAD：`bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。
- 产品文件合同前 SHA-256：`apps/user-web/src/pages/parent-consent.ts` `A74875F9F676FA27C826ED3059FCFB845AEB0157DAACED1E7D6108744AAD4BE4`；`apps/user-web/src/pages/parent-consent.test.ts` `1971C14BE3D87B63FCC7CA433B739C9B51C9734C6BE832B6779FE38AA1C33BB4`；`apps/user-web/src/app/local/[...path]/route.page.ts` `B5922707E82B8DCD6512B968EBA067D05D9FFC321B29A76356BE63900A1C1A31`。三者在主工作树与隔离工作树哈希一致，均为既有未跟踪文件；本合同明确将这三条路径纳入本批写集。
- 先在 `parent-consent.test.ts` 加入候选标识校验、Nest 请求路径/请求体、错误关闭及 Nest 提交后旧接口读回的测试，运行目标测试确认失败；再实现最小客户端与同源代理。
- 使用仓库已有 `@student-care/user-web` 脚本运行 `test`、`next:typecheck`、`next:lint`、`next:build`，对三条路径运行格式与差异检查。随后启动现有 `scripts/start-local-synthetic.mjs --local-synthetic` 与 Next 本机应用，通过浏览器完成父页面连接、申请提交、状态读回；确认 4317/4321 均只监听 `127.0.0.1`，退出后端口释放。
- 仅合成数据；不安装依赖、不改 lockfile、不读写 `apps/mini-program/src/pages/staff.test.ts`，不改变原生小程序、API 业务实现、权限、持久化、真实认证、外部服务或公开网络配置；不 commit、push、部署或发布。
- 若候选学生无法从可信本机候选中获得、Next 代理无法限制在固定 loopback 接口、API 流程不能与旧页面共享记录，或基线哈希不符，立即停止并在本计划记录阻塞，不扩写写集、不放宽测试或身份边界。

## 合同 SHA-256

`94505DF37AAF61EA4965206362E994A1563E38CEF1EB776D8CF4E71F33CA9620`（本合同标题至本节之前的 UTF-8/LF 内容；执行结果不纳入合同哈希）。
