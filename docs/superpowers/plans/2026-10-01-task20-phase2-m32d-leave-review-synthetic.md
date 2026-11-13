# TASK20_PHASE2_M32D_LEAVE_REVIEW_SYNTHETIC

## 合同状态

- `TASK_ID`：`TASK20_PHASE2_M32D_LEAVE_REVIEW_SYNTHETIC`
- 合同状态：`DRAFT_COMPLETE_PENDING_OWNER_REVIEW`
- 实施授权：`NOT_GRANTED`
- 数据边界：仅虚构合成数据、各端本机内存；不连接外部服务
- 前置门：C2 Owner Review 与控制面记录一致；精确写集经负责人审阅并另行授权
- M3.2 总状态：`PARTIALLY_COMPLETE_SYNTHETIC_ONLY`
- M3.3：`NOT_AUTHORIZED`

本文件是实施合同草案，不是业务实现授权。负责人审阅并另行明确授权前，不得新建本阶段实现工作树或修改业务代码。

## 0. 依据、缺口与治理核对

1. V3 主实施计划 `docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md` 的 SHA-256 为 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38`。V3 §7 M3.2 列出 `Student`、`GuardianRelation`、`CareRecord`、`Leave`、`Notice`、`HealthIncident`、`ConsentRecord` 七个对象和 `DRAFT`、`SUBMITTED`、`CONFIRMED`、`RETURNED`、`CANCELLED`、`EXCEPTION_PENDING` 六种状态；要求 Mini 快速查看/提交、Web 历史/详情/批量处理、admin-web 审核/范围统计，并测试状态回退、重复提交和越权。
2. 已批准的 M3.2 后续切片计划要求：健康异常 C2 通过后，仍须分别补齐 Leave 审核和 CareRecord 教师创建/处理，再做 M3.2 收口；这两项不得合并成一个模糊的“大功能”，也不得提前进入 M3.3。
3. Mini 家长请假演示目前已有固定选项、提交、撤回和预置“已确认/已退回”记录；当前提交记录的活动状态只有 `SUBMITTED` 与 `CANCELLED`，尚无员工审核、退回后重交、异常升级、家长查看审核结果的同一内存闭环。主树里尚无 Leave 审核 Web/Admin 页面或专用测试。
4. 2026-10-01 负责人明确确认 M3.2C2 Owner Review 通过，并确认 Mini 首页卡片间距修复。当前品牌工作树中的 C2 合同 SHA-256 为 `FF2FEC39EF1DE1BAEA369852B18EF79B9BDA184F59678D8E36654C9B8488C5D3`；合同记录自动定向测试、类型检查、ESLint、Prettier 与差异检查通过。C2 合同中修复后的微信开发者工具复核仍记为 `NOT_RUN`；负责人对间距的确认按手动复核记载，不扩大成全量原生流程复核。
5. **控制面偏差：** 主树 `PLANS.md` 仍将 C2 标记为待合同审阅/授权（当前 C2 下一任务及审阅门仍指向旧状态），与负责人后续明确的 C2 授权、Owner Review 和间距确认不一致。本轮只创建本合同草案，不修改 `PLANS.md`。在启动 M32D 实施前，必须单独完成控制面状态同步或在实施授权中明确纳入该同步；不得把聊天确认伪装成 `PLANS.md` 已更新。
6. 本合同仅处理 Leave 审核闭环。CareRecord 教师创建/处理、七对象整体映射、全局六状态覆盖与 M3.2 收口仍留待后续独立合同。此合同通过也不表示 M3.2 完成。

## 1. 目标与边界

为现有合成请假申请补上可复核的员工审核闭环，并使三个端各自具备符合 V3 职责的本地演示：

- **Mini：** 家长提交固定选项申请；员工在现有快捷处理页查看合成队列、确认/退回/升级；家长返回首页后看到审核结果和本机模拟通知，可单独确认知悉。家长提交与员工审核共用 Mini 当前运行进程中的合成内存状态。
- **用户网页：** 在现有员工站点增加请假审核入口，提供历史、详情、同范围批量确认/退回和结果反馈。
- **机构管理网页：** 提供当前合成租户/校区内的审核入口与范围统计；平台管理员角色只见去标识化汇总，不见逐条学生内容。

各端是彼此独立的本地演示，不共享数据；不得声称 Web/Admin 能读取 Mini 刚提交的同一真实或实时记录。Web/Admin 使用各自明确标为模拟数据的固定内存队列。不得新增 Mini 页面或改动路由注册。

仅使用不对应真人的合成数据。不得采集姓名、手机号、身份证、真实学生/监护人关系、地址、照片或健康详情；不得新增自由文本原因或备注。拒绝真实认证、网络、API、数据库、伙伴云、推送、持久化、正式 AI、新依赖及 lockfile 变更。所有 UI 使用中文；Mini 延续负责人确认的新绿/黄品牌界面、幼圆优先字体栈和已有卡片规范。

## 2. 拟议精确写集（共 23 个实现路径）

实施前逐项记录目标工作树 HEAD、索引状态、Git 状态、文件存在性和 SHA-256。生成文件按字节比较；任何写集外冲突、同名未知文件或基线不符均立即停止。不得改动 `staff.test.ts`、任何 `app.json`/`index.json`、项目配置、依赖或 lockfile。

### Mini（15）

| 操作           | 路径                                                     | 限定用途                                                                   |
| -------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| MODIFY         | `apps/mini-program/src/pages/parent/leave.ts`            | 扩展申请状态、员工审核、重交与家长结果投影；保持固定原因和范围校验         |
| MODIFY         | `apps/mini-program/src/pages/parent/leave.test.ts`       | 补状态转换、回退、越权、重复动作和失效关系测试                             |
| MODIFY         | `apps/mini-program/src/pages/parent/session.ts`          | 让家长提交与现有员工快捷页审核共用当前 Mini 进程内存，并在上下文失效时清理 |
| MODIFY（生成） | `apps/mini-program/src/pages/parent/session.js`          | 仅由现有 TypeScript 编译器生成，且输出有字节变化时更新                     |
| MODIFY         | `apps/mini-program/pages/parent/home/index.ts`           | 刷新时读取审核状态、显示模拟通知与独立知悉动作                             |
| MODIFY（生成） | `apps/mini-program/pages/parent/home/index.js`           | 仅由现有编译器生成，且输出有字节变化时更新                                 |
| MODIFY         | `apps/mini-program/pages/parent/home/index.wxml`         | 展示家长请假状态及固定控件，无自由文本                                     |
| MODIFY         | `apps/mini-program/pages/parent/home/index.wxss`         | 仅新增/调整本功能局部样式，避免重叠和按钮偏位                              |
| CREATE         | `apps/mini-program/src/pages/staff/leave-review.ts`      | 员工角色、范围校验及请假状态转换的本机合成逻辑                             |
| CREATE         | `apps/mini-program/src/pages/staff/leave-review.test.ts` | 覆盖状态机、重复/越权、整批拒绝、清理和无网络/存储                         |
| CREATE（生成） | `apps/mini-program/src/pages/staff/leave-review.js`      | 仅由现有 TypeScript 编译器生成                                             |
| MODIFY         | `apps/mini-program/pages/staff/quick-action/index.ts`    | 在现有页面接入请假队列动作；每次动作重新核验员工角色与范围                 |
| MODIFY（生成） | `apps/mini-program/pages/staff/quick-action/index.js`    | 仅由现有编译器生成，且输出有字节变化时更新                                 |
| MODIFY         | `apps/mini-program/pages/staff/quick-action/index.wxml`  | 增加中文、固定选项的请假审核控件                                           |
| MODIFY         | `apps/mini-program/pages/staff/quick-action/index.wxss`  | 仅增加请假审核区局部样式，沿用绿/黄品牌                                    |

### 用户网页（5）

| 操作   | 路径                                                 | 限定用途                                               |
| ------ | ---------------------------------------------------- | ------------------------------------------------------ |
| MODIFY | `apps/user-web/src/routes/staff.routes.tsx`          | 增加请假审核路由能力并按当前合成员工身份 fail closed   |
| MODIFY | `apps/user-web/src/main.ts`                          | 注册内部页面分发与员工导航，不触碰访客页面和联系意向   |
| CREATE | `apps/user-web/src/pages/staff-leave-review.tsx`     | 历史、详情、固定原因审核及同范围全有或全无批量动作     |
| CREATE | `apps/user-web/src/pages/staff-leave-review.test.ts` | 页面状态、权限、范围、批量原子性、隐私和零外部请求测试 |
| CREATE | `tests/e2e/leave-review.spec.ts`                     | 本地网页入口、审核、批量拒绝和窄屏流程 E2E             |

### 机构管理网页（3）

| 操作   | 路径                                        | 限定用途                                                              |
| ------ | ------------------------------------------- | --------------------------------------------------------------------- |
| MODIFY | `apps/admin-web/src/main.ts`                | 添加 `/admin/leave-review` 本地分发与导航；沿用现有视图模式和合成范围 |
| CREATE | `apps/admin-web/src/pages/leave-review.tsx` | 合成机构审核及去标识化范围统计；平台管理员只显示汇总                  |
| CREATE | `apps/admin-web/test/leave-review.test.mjs` | 审核角色、范围、匿名汇总、状态与拒绝行为测试                          |

**验证产物边界：** 只允许现有构建流程写入各应用已忽略的构建目录；不删除或清理目录中任何既存内容。Mini 生成 JS 限于上表列出的 5 个精确路径。若实际构建会改写写集外的受跟踪文件，停止并回报。

## 3. 行为验收

1. 全部记录均有清楚的“模拟数据/仅本机演示”标识；表单只允许预定日期和两种非健康原因 `FAMILY_ARRANGEMENT`、`TEMPORARY_MATTER`，不接收备注、健康描述或任意 dataset 字段。
2. 在本机 Mini 单次运行内可完成“家长提交 → 员工审核 → 家长查看通知并单独知悉”；刷新、解绑、关系/成员停用、角色或租户/校区/班级变化时清除受影响的演示状态。此流程不调用网络、不写存储。
3. 状态仅允许 V3 六值：`DRAFT`、`SUBMITTED`、`CONFIRMED`、`RETURNED`、`CANCELLED`、`EXCEPTION_PENDING`。合同须明确合法边及每个状态的非法回退；至少覆盖草稿提交/取消、申请提交/取消、审核确认/退回/升级、退回后固定字段重交，以及异常待处理后的授权处理。
4. 每次动作重新检查角色、成员状态、有效绑定关系及 tenant/campus/class。无效角色、缺少范围、跨租户/校区/班级、伪造 dataset、过期版本和未知状态均 fail closed，不产生部分写入。
5. Web 批量审核先对整批每个对象做权限/范围/状态校验；任一对象失败则整批拒绝、零项改变。重复确认/退回/撤回/知悉是明确拒绝或幂等，不可倒退为较早状态。
6. 机构审核页面按当前合成租户/校区展示最少必要固定摘要；平台管理员只得到无法反推个体的计数，不出现学生姓名、学生 ID、班级明细、请假日期或原因。
7. 家长知悉与审核状态互相独立；模拟通知只在当前页面显示，不代表真实送达。各应用队列相互独立，不出现跨端同步或共享后端的文案。
8. 无 `fetch`、`XMLHttpRequest`、`wx.request`、上传、文件/本地存储、推送、定时任务、AI 或外部请求。所有新增交互中文、键盘/焦点可用，320×568、390×844 与桌面视口无横向溢出、卡片重叠或按钮文字偏位。
9. Mini 沿用现有页面注册，不增删路由、不触碰任何 `index.json`；微信开发者工具中人工编译并检查家长提交、员工处理、家长结果与解绑清理。若当前无法自动操控 DevTools，助手状态必须记 `NOT_RUN`，由负责人明确报告手动检查结果。
10. 此阶段只关闭 Leave 审核缺口。CareRecord、其它五对象、全局批量审核覆盖及 M3.2 总体收口仍标为未完成；不得宣布 M3.2 完成或启动 M3.3。

## 4. TDD 与验证

实施时先为六态转换、越权、越范围、重复动作、整批原子性、通知/知悉分离及无网络写测试，确认新增行为失败后再实现。不得改弱既有断言。

### 测试与类型检查

- Mini 定向测试：

  ```powershell
  node --test apps/mini-program/src/pages/parent/leave.test.ts apps/mini-program/src/pages/staff/leave-review.test.ts apps/mini-program/src/pages/parent/binding.test.ts apps/mini-program/src/pages/parent/updates.test.ts apps/mini-program/src/pages/parent/health.test.ts apps/mini-program/src/pages/health-incidents.test.ts apps/mini-program/src/pages/parent-entry.test.ts apps/mini-program/src/pages/mini-brand-ui.test.ts apps/mini-program/src/pages/staff-verticals.test.ts apps/mini-program/src/pages/visitor.test.ts
  node C:\Users\HU\Documents\student-care-saas-platform\node_modules\typescript\bin\tsc -p apps/mini-program/tsconfig.json --noEmit --typeRoots C:\Users\HU\Documents\student-care-saas-platform\node_modules\@types
  node scripts/verify_mini_page_registration.mjs --require-generated-js
  ```

- 用户网页（在隔离工作树根目录运行；只读复用主树已安装 TypeScript）：

  ```powershell
  node C:\Users\HU\Documents\student-care-saas-platform\node_modules\typescript\bin\tsc -p apps/user-web/tsconfig.json --noEmit --typeRoots C:\Users\HU\Documents\student-care-saas-platform\node_modules\@types
  node C:\Users\HU\Documents\student-care-saas-platform\node_modules\typescript\bin\tsc -p apps/user-web/tsconfig.json --typeRoots C:\Users\HU\Documents\student-care-saas-platform\node_modules\@types
  node apps/user-web/build.mjs
  node --test apps/user-web/dist/pages/staff-leave-review.test.js
  node --test tests/e2e/leave-review.spec.ts
  ```

- 机构管理网页（同样使用主树已安装 TypeScript，不改 package 文件）：

  ```powershell
  node C:\Users\HU\Documents\student-care-saas-platform\node_modules\typescript\bin\tsc -p apps/admin-web/tsconfig.json --noEmit --typeRoots C:\Users\HU\Documents\student-care-saas-platform\node_modules\@types
  node C:\Users\HU\Documents\student-care-saas-platform\node_modules\typescript\bin\tsc -p apps/admin-web/tsconfig.json --typeRoots C:\Users\HU\Documents\student-care-saas-platform\node_modules\@types
  node --test apps/admin-web/test/home-content.test.mjs apps/admin-web/test/leave-review.test.mjs
  ```

  `tests/e2e/*.spec.ts` 在本仓库使用 Node `node:test`，不是 Playwright 测试。浏览器视觉复核可用负责人此前安装的 `C:\Users\HU\Tools\task20-browser\node_modules\playwright` 与现有本地预览；不在项目增加浏览器依赖。若本地预览不可用，视觉状态记为 `NOT_RUN`，不以 Node 集成测试代替。

- 对写集内全部 TS/TSX 执行现有 ESLint；用已安装 Prettier 对 TS/TSX、MJS、WXML（HTML parser）、WXSS（CSS parser）运行 `--check`。不得安装或升级依赖；若 Playwright 不可用，记录 `NOT_RUN`，不安装替代品。
- 在目标工作树执行 `git diff --check`、逐路径写集审计、无网络/存储源码审计和页面注册检查；保存开始/结束的定向 Git 状态快照，不清理既存现场。

### 视觉复核

- User Web 和 Admin Web 用现有浏览器工具检查 320×568、390×844、1365×900；核对错误/空/成功状态、键盘焦点、批量拒绝和无外部请求。
- Mini 使用微信开发者工具从授权的隔离工作树重新编译；人工逐步检查“家长服务 → 请假提交 → 员工快捷页审核 → 家长结果/知悉 → 解绑清空”。原生检查由负责人提供截图或结果，助手不得把浏览器截图当成微信复核。

## 5. 实施工作树、顺序与停止条件

- 建议沿用 `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign` 作为隔离目标，因为该树含有未提交的 C2 Mini 基线，直接另建基于 HEAD 的工作树会丢失这组尚未整合的页面现场。负责人授权后逐项核对第 2 节路径和当前基线；旧来源树 `C:\Users\HU\.codex\worktrees\task20-phase2-parent-relation-binding-contract` 仍保持只读。
- 主工作树仅新增本合同草案；M32D 实施不得修改主树。控制面同步、Owner Review 同步和向主树选择性整合都须单独授权。
- 启动 M32D 前，先通过独立授权的治理同步把主树 `PLANS.md` 中的 C2 状态改为与负责人确认相符；治理同步不属于本合同的 23 路径写集。同步通过后，按 Mini 家长/员工闭环 → Web 历史/详情/批量 → Admin 范围审核/匿名统计 → 三端 focused 验证、浏览器与 DevTools 复核 → 写集审计和独立评审的顺序实施。
- 如必须修改上述 23 路径以外文件、修改路由注册/页面配置、使用新依赖、产生外部调用或引入真实个人资料，立即停止并报告，不自行扩大范围。
- 同一缺陷最多自动修复两轮；仍失败时标记 `PRODUCT_ISSUE` 或 `INFRASTRUCTURE_ISSUE`，保留证据并停止，不通过放宽测试伪造通过。
- 禁止修改 `apps/mini-program/src/pages/staff.test.ts`，禁止改 Mini 注册配置、访客页面、API、数据库、认证、伙伴云、依赖和 lockfile；禁止删除或覆盖工作树中的既有现场；禁止 commit、push、部署、上传或发布。

## 6. 前端与开发技能选择

- `long-horizon-development`：将 M3.2 缺口分成 Leave、CareRecord 和总体收口三个有前后门槛的独立任务。
- `writing-plans`：本合同已按精确写集、验收、验证和停止条件形成草案。
- `test-driven-development`：实现前先建立对应行为的失败测试。
- `using-git-worktrees`：业务实现限定在隔离工作树，并保留 C2 与旧来源现场。
- `frontend-design`、`frontend-design-review`：适用于新增 Web/Admin 审核界面与 Mini 员工控件；沿用现有视觉语言，重点复核窄屏、留白、中文可读性和按钮位置。
- `verification-before-completion`、`requesting-code-review`：完成前以真实命令和逐路径审计确认结果，并进行独立审查；不能把本地演示称为生产功能。

## 7. Owner Review 门

本合同完成后等待负责人审阅。负责人需确认精确 23 路径写集、工作树复用方式、控制面同步安排和 M32D 验收范围，并另外明确授权实施。合同审阅或 C2 间距确认本身不授权本合同的业务代码修改、主树整合或发布。
