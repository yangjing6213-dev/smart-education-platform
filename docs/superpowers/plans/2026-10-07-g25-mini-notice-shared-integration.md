# TASK20 / G2.5 Mini 通知共享接线

## 0. 依据与授权

- 依据 PDF V2、现行总路线 G2.5 与负责人持续自主完成本地合成开发要求；不再逐子步骤等待批准。
- 当前缺口：已有通知服务/Web/Admin流程，Mini 仍读取离线通知。目标是让已注册家长首页与员工快捷页使用同一通知对象，保留离线展示并明确区分。
- 仅本机合成数据、既有服务/身份和内存；不新增 API、页面、路由、依赖，不接外部服务，不改真实身份、数据库或持久化，不提交、推送、部署、上传或发布。

## 1. 最小行为与限制

1. 教师从既有两个固定模板创建并提交；负责人退回或确认，另行发布。退回后原作者重提同一对象。仅服务端实际授予的当前范围能力生效。
2. 家长仅看到其批准关系可读的已发布通知；点击查看只记阅读，另点“我已知悉”才记确认。两名监护人的结果分开。
3. 再发布形成新版本，旧知悉不复用；撤回、解绑、身份切换、断线、旧异步响应不得恢复旧内容或旧详情。
4. 内容编辑示例身份当前没有通知权限，继续拒绝，不在客户端添加权限。没有正文编辑 API，本轮新版本是固定模板的再次发布，不声称支持任意正文编辑或全机构广播。
5. 适配实际服务字段 `synthetic:true`、`requiresAcknowledgment`、`PUBLISHED`；不改旧离线模型以假装共享。每次以授权服务列表替换旧资料。

## 2. 精确写集

隔离树：`C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign`。

- MODIFY `apps/mini-program/src/local-synthetic/client.ts`
- MODIFY `apps/mini-program/src/local-synthetic/client.js`，仅对应编译内容有变化时。
- MODIFY `apps/mini-program/src/local-synthetic/page.ts`
- MODIFY `apps/mini-program/src/local-synthetic/page.js`，仅对应编译内容有变化时。
- MODIFY `apps/mini-program/templates/local-synthetic.wxml`
- CREATE `apps/mini-program/src/pages/shared-notice.test.ts`
- CREATE `docs/exec-plans/active/mini-notice-shared-integration.md`，不覆盖既有同名旧任务记录。

主树仅新增本合同并修改 `PLANS.md`、`docs/exec-plans/active/project-completion.md`。所有其他代码、保护测试、配置、注册工件与 lockfile 不变。

## 3. 接口与验证

- 使用既有 `GET /local/notice-owned`、`GET /local/notices`、`POST /local/notices` 与 `POST /local/notices/:id/{submit,review,publish,revoke,read,ack}`；固定 `http://127.0.0.1:4317`。请求仅带固定模板或版本/审核动作，不传伪造授权范围。
- 先以真实 Page 事件测试复现缺少共享通知；不得在测试中替换或掩盖原生 `setData` 注册问题。
- 真实随机回环服务验证创建→提交→退回重提→审核→单独发布→家长查看→独立知悉→再次发布→清旧知悉→撤回隐藏。测试旧版本、跨班/校区/租户、异常响应、离线和迟到回复。
- 运行相关测试、源码/生成版 Page、类型、Lint、Prettier、9页运行工件护栏和 diff/写集审计；独立只读复核。微信开发者工具实点结果另记，不用 Node 测试替代。

## 4. 停止条件

- 实际需要超出写集时先记录最小范围修正，不静默修改。真实服务/数据、费用、生产和破坏性操作继续禁止。
- 不把本通知接线通过宣称为接送、费用、健康、日报、月度反馈共享已完成。
