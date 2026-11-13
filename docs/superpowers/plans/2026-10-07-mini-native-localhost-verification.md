# TASK20 / G0 微信原生本机连接复核

## 依据与诊断

- 依据负责人自主完成本地合成开发、无需普通步骤重复批准的要求，记录本机开发设置修正。
- 原生首页、员工入口与快捷页可打开；原生数据刷新问题已在 G3.4 既有写集修复。
- 2026-10-07，微信原生 `wx.request` 返回 `request:fail url not in domain list`；同机 `http://127.0.0.1:4317/local/profiles` 正常响应。原因已经确认：当前项目私有开发配置的 `setting.urlCheck=true` 阻止现有固定本机服务。

## 精确写集与限制

- 隔离树 `C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign`：仅 MODIFY `apps/mini-program/project.private.config.json` 的 `setting.urlCheck` 为 `false`，CREATE `docs/exec-plans/active/mini-native-localhost.md`。
- 主树：CREATE 本合同；MODIFY `PLANS.md`、`docs/exec-plans/active/project-completion.md`。
- 只适用于本机微信开发者工具。公共项目配置、根配置、`app.json`、`index.json`、域名平台登记、生产网络、认证、服务监听地址保持原样；不修改依赖或 lockfile，不提交、推送、上传或发布。
- Mini 请求适配器仍只允许既有 `http://127.0.0.1:4317` 精确路径，服务仍只监听本机且仅合成内存数据；不为外部地址新增例外。
- 保存原配置 hash 与字段前值。回退只恢复该布尔字段，不整体覆盖配置。

## 验证

1. 修改前已确认原生失败与本机服务正常；设置修正后重新编译一次，从首页员工入口实际点击进入协同模式。
2. 实点固定物资选择、草稿、提交、角色切换、负责人审核、教师领取；核对同一对象及版本。能覆盖更多既有绑定/成长路径则逐项记录，不凭截图替代操作。
3. 截图、页面文字与实际请求均仅取合成必要信息，不回显会话句柄或登录资料。复查所有原受保护文件 hash，唯一配置变化须为上述字段。
4. 工具故障与产品缺陷分开记录；原生未走通的流程仍为 NOT_RUN/PARTIAL，不把本机结果宣称真机、跨设备或正式可用。
