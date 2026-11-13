# TASK20_PHASE2_M32F_CARE_RECORD_SYNTHETIC

## 1. 目标与授权

- `TASK_ID=TASK20_PHASE2_M32F_CARE_RECORD_SYNTHETIC`
- 状态：由负责人 2026-10-01 当前请求授权继续的本地合成实现；不需要再次申请子步骤授权。
- 工作树：`C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`
- 依据：V3 §7 M3.2、M32A/M32D/M32E 既有合成实现；本合同仅补 CareRecord 教师创建/审核/家长查看的缺口。
- V3 完整的 M3.2 关闭仍须另做 M32G 覆盖矩阵，不能因本任务通过而提前标记完整。

## 2. 写集（21 路径）

只可修改或创建以下路径。已存在文件按当前内容增量修改，不覆盖或清理既有 M32D/M32E 现场。所有 JS 限由现有 TypeScript 编译器生成且仅在内容变化时写入。

### User Web（6）

1. `MODIFY apps/user-web/src/main.ts` — 接入员工日报与家长已发布日报动作，保持既有路由、健康、请假与访客行为。
2. `MODIFY apps/user-web/src/pages/staff-report.tsx` — 接入日报固定选项编辑/提交/历史/审核控件。
3. `CREATE apps/user-web/src/pages/care-record-workflow.ts` — 六状态、固定选项、角色/租户/校区/班级范围、整批原子审核、独立发布/撤回与家长投影。
4. `CREATE apps/user-web/src/pages/care-record-workflow.test.ts` — 六状态、非法回退、失效权限、版本、重复、批量零部分成功、撤回隐藏、家长回执及无网络/存储测试。
5. `CREATE tests/e2e/care-record-review.spec.ts` — 员工创建、审核发布、家长查看/知悉、撤回及窄屏无溢出流程；只使用 loopback。
6. `MODIFY apps/user-web/src/pages/parent-home.ts` — 在家长打开已发布日报后提供独立的本机知悉回执入口，并显示当前版本回执。

### Mini（12）

7. `CREATE apps/mini-program/src/pages/care-records.ts` — 与 Web 独立的本机合成 CareRecord 状态模型。
8. `CREATE apps/mini-program/src/pages/care-records.test.ts` — 状态、范围、原子批量、发布和副作用测试。
9. `CREATE apps/mini-program/src/pages/care-records.js` — 仅本合同编译生成。
10. `MODIFY apps/mini-program/src/pages/parent/session.ts` — 保存 CareRecord 内存状态，合并已发布投影并在关系失效时清空。
11. `MODIFY apps/mini-program/src/pages/parent/session.js` — 仅本合同编译且输出变化时生成。
12. `MODIFY apps/mini-program/pages/staff/quick-action/index.ts` — 固定日报选项、角色切换与版本化操作。
13. `MODIFY apps/mini-program/pages/staff/quick-action/index.js` — 仅本合同编译且输出变化时生成。
14. `MODIFY apps/mini-program/pages/staff/quick-action/index.wxml` — 员工日报草稿、审核队列和分离发布控件。
15. `MODIFY apps/mini-program/pages/staff/quick-action/index.wxss` — 仅日报区域样式。
16. `MODIFY apps/mini-program/pages/parent/home/index.ts` — 将家长查看/知悉事件接入本机日报回执。
17. `MODIFY apps/mini-program/pages/parent/home/index.js` — 仅本合同编译且输出变化时生成。
18. `MODIFY apps/mini-program/pages/parent/home/index.wxml` — 为已打开的已发布日报显示单独的知悉按钮和回执状态。

### Admin Web（3）

19. `MODIFY apps/admin-web/src/main.ts` — 保留既有请假/健康入口并接入 CareRecord 审核演示。
20. `CREATE apps/admin-web/src/pages/care-record-review.tsx` — 校区/机构最小范围审核与平台匿名统计。
21. `CREATE apps/admin-web/test/care-record-review.test.mjs` — 范围拒绝、六状态、匿名汇总和无个体明细断言。

## 3. 行为与安全边界

- V3 状态仅为 `DRAFT`、`SUBMITTED`、`CONFIRMED`、`RETURNED`、`CANCELLED`、`EXCEPTION_PENDING`。确认与面向家长发布是两个明确动作；撤回发布立即隐藏家长侧摘要。
- 日报只提供固定的到离、作业、餐食、午休、活动和一般状态选项；不接收自由文本、真实学生身份、具体健康细节、照片或附件。
- 每次操作重验 active membership、角色、tenant、campus、class、relationship、状态和版本。权限失败关闭；批量任一无效时整批零修改。
- 家长端只显示与现有合成绑定关系同租户、校区、班级和学生的已确认且明确发布摘要。必须先打开摘要，再单独确认知悉；回执不改变业务审核状态。解绑/更换关系、身份或成员状态变化时清空详情、草稿与回执。
- Mini、Web、Admin 分别使用本地合成内存；不得声称跨端同步或真实通知送达。Admin 平台角色只看匿名计数，不得展示学生行或摘要正文。
- 禁止网络、持久化、真实认证、API、数据库、伙伴云、推送、正式 AI、依赖/lockfile 变更、主树业务同步、删除/清理既有文件、commit、push、部署和发布。

## 4. 验收与验证

- TDD：先加入模型/组件测试并观察预期 RED，再实现；不得降低已有断言。
- Mini/User Web/Admin Web 对各自应用内日报流程独立验证；含六状态、角色/租户/校区/班级负向、版本重放、原子批量、发布/撤回、绑定失效清空。
- 运行 User Web/Admin Web/Mini typecheck；User Web/Admin build；三端 focused tests；CareRecord E2E；Mini 页面注册完整性测试；ESLint、Prettier、WXML HTML parser、WXSS CSS parser、`git diff --check` 和 21 路径精确范围审计。
- Web/Admin 视口覆盖 320×568、390×844、1365×900，网络与存储调用为 0；Mini 原生 DevTools 结果只有用户实际复核后才能记录为 PASS，否则为 `NOT_RUN`。
- 任一需要本写集之外路径、配置、依赖、服务或真实信息时停止并报告，不扩大范围。

## 5. 前序复核与阶段门

- M32E：user-web 71 项、Mini 78 项、Admin 3 项、健康 E2E 1 项，以及 typecheck/build/ESLint/Prettier/diff/responsive 检查均 PASS。Mini 独立 page-guard 脚本不在目标工作树，未复制；页面注册完整性断言已在 Mini focused test 内 PASS。
- M32E Owner Review 尚待用户复核；当前用户“确认没有问题”对应前一阶段 M32D，不得误记为 M32E 验收。
- M3.2 最终关闭由 M32G 逐条对照 V3 七对象、六状态、三端职责、权限与批量行为后决定。M3.3 接送演示、M4 教师业务、M5 AI、M6 SaaS 仍为之后目标，不得混入本任务。

## 6. 执行时基线

实施前基线（2026-10-01）：目标 HEAD=`bd0001faa8e2fd7bbabe86e3d778ba24431107e8`；Git index 无暂存改动；目标工作树共有 81 个既存状态路径，完整现场按只读方式保留。第 2 节 21 路径的存在状态/SHA-256 如下，供实施后增量范围比较：

| Path | Baseline | SHA-256 |
| ---- | -------- | ------- |
| `apps/user-web/src/main.ts` | PRESENT | `DFB08C16B3D503FC8894D9A2E1B30CAF6A635A0EC4719213A9B8A0311511667A` |
| `apps/user-web/src/pages/staff-report.tsx` | PRESENT | `F91D677BD1383683252CE11FDD4660487B45EEF9699BAD5E9A1E963E49269BD7` |
| `apps/user-web/src/pages/care-record-workflow.ts` | ABSENT | — |
| `apps/user-web/src/pages/care-record-workflow.test.ts` | ABSENT | — |
| `tests/e2e/care-record-review.spec.ts` | ABSENT | — |
| `apps/user-web/src/pages/parent-home.ts` | PRESENT | `B863FE701679DD4BB5A0061B8D051BCD4DA8ABBFE406943FA6D3ABF60FB9073F` |
| `apps/mini-program/src/pages/care-records.ts` | ABSENT | — |
| `apps/mini-program/src/pages/care-records.test.ts` | ABSENT | — |
| `apps/mini-program/src/pages/care-records.js` | ABSENT | — |
| `apps/mini-program/src/pages/parent/session.ts` | PRESENT | `0433478B444DCD35BCB474CE809D36BCBDA7D13BE8BA18A88EDEDF88DB82E327` |
| `apps/mini-program/src/pages/parent/session.js` | PRESENT | `9C6EDB907EE6B0F5B41CD99921B2C5F92D3EA01F4D248E7C932256474B0B7877` |
| `apps/mini-program/pages/staff/quick-action/index.ts` | PRESENT | `B0CFF8BBA9B3841B380719FAC2AC1678243B5B89622BD85061CC309A5F434F79` |
| `apps/mini-program/pages/staff/quick-action/index.js` | PRESENT | `B808582D28FA193C3867546E466854E72FB73F86DD4C94F8901E93ED76CBB2EE` |
| `apps/mini-program/pages/staff/quick-action/index.wxml` | PRESENT | `02C12B3A171C12DF59028CEFD82238446BF99FA3EF6D4873E33019F4C3C0A81C` |
| `apps/mini-program/pages/staff/quick-action/index.wxss` | PRESENT | `03C3D1C1C1E716EFBF671ABDE1AB128BA41182675BFC17911803C28B0CDFF2F1` |
| `apps/mini-program/pages/parent/home/index.ts` | PRESENT | `1830289DF2094A1A6066BBBC88C0DB72884A25F50572933F7F8F597F3236DC11` |
| `apps/mini-program/pages/parent/home/index.js` | PRESENT | `36B29984F30B70E83D0490EF05D21DF0E150DE5AE3275597CF68AA47CD935F53` |
| `apps/mini-program/pages/parent/home/index.wxml` | PRESENT | `2969870DFE2125FAB8BB5C0254A60E45DBB22D474667DCF42A8AA9808BAAB573` |
| `apps/admin-web/src/main.ts` | PRESENT | `65E965262D208025ABEF24DB40C432C36F6DA04A30DC6BEE4CCCA9431ADB902C` |
| `apps/admin-web/src/pages/care-record-review.tsx` | ABSENT | — |
| `apps/admin-web/test/care-record-review.test.mjs` | ABSENT | — |

现有文件必须在其原内容上作语义增量；绝不重置、覆盖或清理其它现场。验证产物只写既有忽略 dist；如发生未能安全合并的内容变化，停止并报告。
