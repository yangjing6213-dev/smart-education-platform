# TASK20 D66：M5.2 本机合成学习评测指标

**状态：** `IMPLEMENTED_AND_VALIDATED_LOCAL_SYNTHETIC;ADMIN_BROWSER_SMOKE_NOT_RUN`
**目标任务：** `TASK20_D66_M52_LEARNING_EVALUATION_METRICS`
**日期：** 2026-10-10
**依据：** 项目方案 PDF v2.0 SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`；V3 M5.2（“严重安全事件为 0；提示后重做率、同类题完成率、教师介入率和错误率可统计”）；D65 审计合同 SHA-256 `5556F786B9858DF7DBC9837030E46657C25EB83BF7EA2BA69E1406CB658D4C54`。
**授权依据：** 用户已要求由执行者持续完成项目本地开发，不再逐项等待普通开发授权。此项仅完善本机固定题演示的匿名聚合统计，不启用真实模型、真实学生数据或正式 AI。

## 1. 目标与边界

当前平台学习安全页只显示次数，无法回答 V3 要求的提示后重做、同类巩固题完成、教师实际介入与作答错误比例。补充一个版本化、仅聚合的 `LEARNING_SAFETY_V2` 摘要，并在既有 Admin “学习安全汇总”页展示明确的分子/分母、比例和无样本状态。

固定指标定义：

- **提示后继续作答率**：至少使用过一个提示、并且在任意提示后再次提交过主问题答案的会话数 ÷ 使用过提示的会话数。内部新增一个不对页面或接口单独暴露的计数器，避免“最后一次提示后未作答”掩盖此前已发生的提示后作答。
- **同类巩固题完成率**：已回答巩固题数量 ÷ 已答对主问题会话可完成的巩固题总数。每个符合条件的合成会话固定有两道巩固题。
- **教师实际介入率**：发生过已接受“教师接手”审计事件的不同会话数 ÷ 学习会话总数。统计不同会话，避免重复事件放大比例；“需要教师跟进”保留为独立原始计数，不冒充实际介入。
- **作答错误率**：主问题错误次数与巩固题错误数之和 ÷ 主问题和巩固题的总作答次数。
- **本机合成流程记录的严重安全事件数**：只数明确标记为 `learning.safety-incident` 的合成审计事件；拒绝/越权操作不等同于严重安全事件。该数字只描述没有正式模型的固定本机演示，不代表真实 AI 或真实服务安全结论。
- 比例保留一位小数；分母为零时返回 `null`，页面显示“暂无样本”，不得显示为 `0%`。

保留现有摘要计数并要求未知版本、缺字段、负值、越界比例或额外个人/会话字段均 fail closed。页面只服务现有平台匿名统计权限，不展示姓名、学生/会话编号、机构、校区、班级或个人学习轨迹。不得连接真实 AI、外网、数据库、伙伴云或持久化；不新增路由、依赖、配置、构建输出或 lockfile；不提交、推送、部署或发布。小程序保护测试保持未读取、未复制、未运行、未修改。

## 2. 精确写集

隔离工作树：`C:\Users\HU\.codex\worktrees\task20-d66-learning-evaluation-metrics`。创建前记录主树目标路径哈希与 Git 状态；目标缺失时才从主树只读复制同名基线；目标已存在且内容不同则停止，不覆盖。

- MODIFY `packages/contracts/src/learning-session.ts`
- MODIFY `apps/api/src/local-synthetic/learning-session.service.ts`
- MODIFY `apps/api/test/local-synthetic-learning-session.test.ts`
- MODIFY `apps/admin-web/src/local-review/learning-safety.ts`
- MODIFY `apps/admin-web/test/learning-safety.test.mjs`
- MODIFY `apps/admin-web/test/learning-safety-browser.mjs` (update the existing browser smoke assertion from V1 to V2)
- MODIFY `tests/local-synthetic/learning-session.test.mjs` (assert the versioned V2 response in the existing integration flow)
- MODIFY `PLANS.md`
- MODIFY `docs/exec-plans/active/project-completion.md`
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- MODIFY this contract with final status and evidence

主树只选择性整合以上七个产品/测试路径及四个治理路径。发现这两处既有 V1 断言后将其加入写集，原因是它们会在真实接口/浏览器运行回归时拒绝新版本；这不是扩大业务范围。不得整文件覆盖目标；逐文件保留现有现场，且整合前后核对来源/目标 SHA 和范围。

## 3. 实施顺序

1. 在隔离工作树使用 TDD：先为四项指标、严重事件精确计数、零分母、匿名字段白名单和未知版本写失败断言；尤其覆盖教师介入按不同会话计数、多次提示下仍保留此前提示后作答事实，以及错误分母。
2. 在 API 聚合逻辑计算指标，不保存新的个人字段、不复制会话记录；契约版本改为 `LEARNING_SAFETY_V2`。Admin 客户端必须精确校验允许字段、数值范围和版本；页面以明确分母展示比例，样本不足时显示“暂无样本”。
3. 更新 Admin 定向测试，使其在内存中加载当前 TypeScript 页面模块，不依赖过期 `dist`；同步更新已有 API 集成版本断言和 Admin 浏览器 smoke 的版本断言。运行 API 学习服务测试、API 集成学习流程测试、Admin 学习安全页测试、Admin 浏览器 smoke、两个 TypeScript 检查、目标 ESLint、Prettier API、内存页面渲染与差异/写集审计；不写 `dist`。
4. 逐文件选择性整合到主树，重复上述聚焦验证和范围审计。锁定本机环回之外无请求；不触碰受保护测试或既有服务。

## 4. 验收标准

- 四项 V3 比例指标有可解释且在测试中固定的分子/分母；显示结果与 API 聚合计算一致。
- 没有样本时返回 `null` 并显示“暂无样本”；严重事件只计明确事件类型，拒绝操作不会被算作严重事件。
- 未知版本、错误比例、负计数、缺失字段及任何额外身份/范围字段均被拒绝，不能留下旧汇总数字。
- API 和 Admin 页面针对性测试先失败后通过；类型检查、ESLint、Prettier API、内存渲染、差异检查和精确范围审计通过。
- 既有学习流程集成检查和 Admin 浏览器 smoke 对 V2 返回/展示通过，不遗留 V1 断言。
- 只使用固定合成会话；页面响应不含个人或会话级数据；无正式 AI、外部请求、存储写入或新构建产物。

## 5. 停止条件

若计算任一比例必须访问个人明细、无法定义可靠分母、须新增路由/配置/依赖/生成文件/白名单外路径，或主树目标文件已发生不可安全保留的变化，则停止该部分并记录证据，不扩大写集、不覆盖现场。

## 6. 实施与验证结果

- 隔离分支：`codex/task20-d66-learning-evaluation-metrics`，起点 `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`；七个产品/测试路径逐文件同步前均与记录的主树基线 SHA 完全一致，整合后源/目标 SHA 一致。
- TDD：API 定向测试先因 V1/缺少比例失败；Admin 测试先因 V1 文案与缺少“暂无样本”失败。实现后 API 学习服务 `10/10`、Admin 学习安全页 `4/4`。
- 既有 API 学习流程集成测试通过 `1/1`。为避免仓库产生构建产物，API 编译到系统临时目录，再用该目录运行现有集成流程；临时 `dist` 不在仓库中。
- API 和 Admin Web TypeScript `--noEmit` 检查通过；七个写集文件 ESLint 检查通过；已安装 Prettier 3.9.6 的 API 检查通过；限定写集空白/末尾换行检查通过。
- 浏览器自动化 `NOT_RUN`：当前环境没有已安装的 Playwright，且禁止安装依赖。Admin 页面已由内存渲染测试覆盖比率、分母、V2 版本及零样本文案；浏览器 smoke 的 V1 断言已更新为 V2，未声称实际浏览器复核通过。
- Prettier 命令入口文件首字节异常，命令行无法启动；改用同一已安装 Prettier 包 API 对七个目标文件检查，未修改工具、依赖或 lockfile。
- 未改真实 AI、身份、个人资料、数据库、网络配置、依赖、lockfile 或项目内构建产物；受保护 `staff.test.ts` 未读取、复制、运行或修改；没有提交、推送、部署或发布。
- 状态只证明本机固定题合成流程的聚合指标完成，不关闭 G4.2/G4.3 Owner Review、微信开发者工具原生验收或真实 AI/生产安全门槛。
