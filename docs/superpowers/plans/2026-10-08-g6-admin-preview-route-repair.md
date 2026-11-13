# TASK20_G6_ADMIN_PREVIEW_ROUTE_REPAIR

**日期：** 2026-10-08  
**状态：** `AUTHORIZED_LOCAL_SYNTHETIC_REPAIR`  
**依据：** 用户委托自主完成本地项目开发；当前 `AGENTS.md` 要求隔离工作树、精确写集和可复核验证。  
**问题证据：** 实际浏览器请求 `/admin/fees?localServicePort=4319` 返回 HTML，但其模块脚本 `/admin/dist/main.js` 也返回 `text/html`，浏览器报严格 MIME 类型错误并显示空白页。

## 目标

修正 Admin Web 本地预览服务器的静态路径映射，使 `/admin/*` 页面继续返回入口 HTML，同时 `/admin/dist/*` 及其嵌套模块返回真实编译 JavaScript 和正确 MIME 类型。

## 精确写集

- `MODIFY apps/admin-web/preview.mjs`
- `CREATE apps/admin-web/test/preview.test.mjs`
- `MODIFY PLANS.md`
- `CREATE docs/superpowers/plans/2026-10-08-g6-admin-preview-route-repair.md`

仅在隔离工作树实现；主工作树只选择性同步这两个产品文件和本合同/计划记录。不得整文件覆盖既有主树内容。

## 非目标与安全边界

- 不修改 `apps/admin-web/index.html`、业务页面、API、数据库、Mini、认证、依赖或 lockfile。
- 不安装依赖，不清理或重启已有 `127.0.0.1:4317` 服务，不触碰其内存演示申请与会话。
- 仅监听 loopback，使用现有本地构建和合成数据；不访问外网，不提交、推送、部署或发布。
- `dist` 仅作为忽略的本地构建产物，不纳入写集。

## 验收标准

1. 新回归测试先失败，明确指出 `/admin/dist/main.js` 被错误返回为 HTML。
2. `/admin/fees` 仍返回管理入口 HTML；`/admin/dist/main.js` 和嵌套模块资源返回 200、JavaScript MIME 与非 HTML 内容。
3. 非管理静态路径仍为 404，非 GET/HEAD 方法仍为 405；现有文件根目录隔离检查继续生效。
4. 运行 focused preview tests、Admin Web typecheck/build/ESLint、Prettier、`git diff --check` 和精确写集审计。
5. 使用现有 Playwright 浏览器打开管理费用页，确认无模块 MIME 错误、脚本加载成功、页面正文正常，并记录控制台/网络错误。此为自动浏览器复核，不冒称微信开发者工具人工验收。

## 停止条件

若修复必须修改白名单外文件、改变业务路由或权限、重启/清空既有服务状态、安装依赖或接入外部服务，停止并记录证据；不得扩大本合同写集。
