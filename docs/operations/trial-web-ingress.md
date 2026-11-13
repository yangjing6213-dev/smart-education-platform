# 网站与微信小程序的 HTTPS 试用入口

访客、家长、员工和机构管理人员使用同一个网站域名。两个 Next.js 应用各自运行并提供自己的构建资源。微信小程序使用独立的 API 域名，后端仍为同一套 Nest 服务。这里假定 Nginx 直接终止 HTTPS，所有上游都在同一台主机的回环地址。

| 入口 | 上游服务 |
| --- | --- |
| `/`、`/visitor`、`/web` 和它们的业务页面，`/api-local`、`/assets/`、`/_next/static/` | 用户网站，监听 `127.0.0.1:3101` |
| `/admin`、`/api/admin` 及其下级路径，`/admin-static/_next/static/`、`/icon.png` | 管理网站，监听 `127.0.0.1:3102` |

上述网站只需在 Nginx 的 `http {}` 中包含一次 `trial-web.nginx.conf`。小程序准备好后，再在它的下一行包含可选的 `trial-mini-api.nginx.conf`。小程序使用自己的证书，转发到 `127.0.0.1:4321`。网页证书、登录 Cookie 和资源前缀沿用原配置。

管理网站必须用 `assetPrefix: "/admin-static"` 重新构建。用户网站使用默认的静态资源前缀。两个服务都从对应版本的完整 standalone 包启动，保留随包的静态资源和公开图片。

## 让两套网站连到邀请试用后端

网站的服务端会访问 Nest 完成受邀登录、读取家长与管理资料，并为访客页面读取公开内容。试用环境中按以下顺序接通三个进程。

1. 用本版锁定依赖在 `apps/api` 执行 `pnpm run build`，随运行目录保留 `dist/`、生产运行依赖及同版 `prisma/migrations/`。待试用数据库已应用本版迁移、已配置受邀账号且有关联用户，再从此目录运行 `pnpm run start:nest-api:trial`。为该进程设置 `NODE_ENV=production`、`STUDENT_CARE_API_HOST=127.0.0.1` 和 `PORT=4321`。从部署环境的保密配置注入 `DATABASE_URL` 与 `STUDENT_CARE_INVITE_ACCOUNTS_JSON`。如预检退出，先核对连接、迁移、数据库权限和账号。该命令本身不准备试用数据。
2. 为网站进程准备一个内部 DNS 别名，同时将它配置在证书 SAN、模板的 `server_name` 和带端口的 Host 白名单中。示例为 `nest-internal.example.invalid`。它在两个 Next 进程的运行环境中均须解析到 `127.0.0.1`。提供对应的证书链及受限私钥，路径见 `trial-web-backend.nginx.conf`，并确保 Nginx 可写状态日志。在同机 Nginx 的 `http {}` 中额外包含该模板，运行 `nginx -t` 后加载。该独立监听使用 `127.0.0.1:8443`。同机多个独立容器具有不同的回环地址，使用此模板时须让这三个应用与代理共享相应网络命名空间。
3. 用同一份公开 CA 信任链设置两个 Next **进程**的 `NODE_EXTRA_CA_CERTS`（受运行环境信任的公共 CA 可直接使用系统对应的 Node 信任链）。使用专用 CA 时，向此参数提供 PEM 格式的签发 CA 链，在两个进程启动前设置。别名、证书和连接验证均须匹配。每个包分别从其根目录按下表启动。

| 进程 | 生产环境变量 | 启动命令 |
| --- | --- | --- |
| 用户网站 | `NODE_ENV=production`、`HOSTNAME=127.0.0.1`、`PORT=3101`、`USER_WEB_NEST_API_BASE_URL=https://nest-internal.example.invalid:8443`、`PUBLIC_API_BASE_URL=https://nest-internal.example.invalid:8443`、`PUBLIC_CAMPUS_REF` 为已发布内容所属校区的公开引用 | `node apps/user-web/server.js` |
| 管理网站 | `NODE_ENV=production`、`HOSTNAME=127.0.0.1`、`PORT=3102`、`ADMIN_WEB_NEST_API_BASE_URL=https://nest-internal.example.invalid:8443` | `node apps/admin-web/server.js` |

内部地址仅填写来源（协议、域名、端口）。Nest 负责授权，Next 负责同源检查以及从各自的 HttpOnly Cookie 提取受邀会话。内网代理只转发所需的 JSON 和 Bearer 信息，状态日志仅记录时间、状态码、上游状态和耗时。把私钥保留在 Nginx 所在环境。

在代理主机上用 `curl --cacert <CA链路径> --resolve nest-internal.example.invalid:8443:127.0.0.1 https://nest-internal.example.invalid:8443/me` 检查内网链路，匿名请求应返回 401。再从公开网站打开一项已发布内容，分别用家长和管理员受邀账号登录并退出。从其他机器无法连接 8443。若公开网站可显示而登录失败，分别检查两个网站的受保护接口地址、访客公开资料地址、进程信任链和 Nest 的启动预检。回退时同时切回已验证的两个网站包和相应后端、证书及配置，再复核登录。只移除内网模板会使依赖它的试用功能失去后端连接。

## 配置准备

1. 在独立试用环境准备两个服务。只让 Nginx 对外监听，网站进程、后端和数据库使用内部地址。按对应网站的运行说明配置受邀账号后端；测试地址仅供本地使用。
2. 在网站模板中替换所有 `trial.example.invalid`，包括 Host 白名单中的带端口形式。将证书链和私钥路径指向该域名的有效证书，仅允许 Nginx 所需进程读取私钥。如主机有其他 HTTPS 站点，先选定整个监听地址唯一的默认虚拟主机。此处的默认主机会在 TLS 握手时拒绝未知站点名。
3. 在预定的 Nginx 配置中引入模板，在隔离环境运行 `nginx -t`。当入口前面还有负载均衡器或 CDN 时，需先按其可信来源和证书边界调整拓扑。本模板以直连客户端地址写入转发头，应用看到的外部协议固定为 HTTPS。

入口仅代理表中列出的路径，保留查询参数。应用收到的主机、协议与客户端地址由代理给出。来源和 Cookie 保持原样，仍由各端检查登录、角色及写请求来源。模板没有跨域授权。开发接口 `/local`、`/staff-local` 和内部服务路径不对外代理。

## 启用微信小程序

1. 准备独立 API 域名及其有效证书，和微信公众平台中该小程序的 request 合法域名对齐。将小程序模板中所有 `mini-api.example.invalid` 替换成这个小写域名。保留默认 443 端口，证书链及私钥默认从 `/etc/nginx/tls/trial-mini/` 读取。示例域名仅用于识别模板，试用构建需要填写机构实际使用的值。
2. 确认 Nest 正在 `127.0.0.1:4321` 监听，Nginx 可以写入 `/var/log/nginx/trial-mini-status.log`。加入小程序模板后先运行 `nginx -t`。此时开关仍关闭，访问小程序域名应返回 404。
3. 在小程序模板的 `$trial_mini_enabled` 映射中，取消实际域名后面值为 `1` 的那一行注释，再在隔离试用环境执行 `nginx -t` 并让该环境加载配置。复测完成后使用同一个 HTTPS 域名构建小程序。可单独重新注释该行并重载，关闭小程序入口。需要完全移除时先去掉可选的 include，再停用其证书及日志。
4. 在 `apps/mini-program-taro` 目录设置试用配置并运行构建。PowerShell 中可把以下变量值替换为试用环境提供的信息，输出目录要选尚未存在的路径。

   ```powershell
   $env:MINI_TRIAL_APP_ID = '<试用小程序的公开 AppID>'
   $env:TARO_APP_API_BASE_URL = '<完整的 HTTPS API 来源>'
   $env:TARO_APP_PUBLIC_REFERENCE = '<试用校区的餐单公开引用>'
   pnpm run build:weapp:trial --output '<新的工程目录>'
   ```

   微信开发者工具应导入输出目录的顶层，其中包含 `project.config.json` 和 `miniprogram/`。保持合法域名、TLS 和证书校验开启。在真正的微信账号和设备上验证 DNS、证书链、合法域名及受邀账号后，再向客户分发试用入口。

发布前的 15 项验证应直接产出要复核的小程序。在仓库根目录沿用上面三个已核实的公开变量，执行 `node scripts/local-release-preflight.mjs --plan --artifact-root=artifacts/<新批次>/run --mini-trial`，第 15 项应显示 `build:weapp:trial`。实际执行时给资源监测和临时合成数据库启动器的规划、执行入口均传入 `miniTrial: true` 及这三个变量。输出工程位于 `apps/mini-program-taro/dist-<新批次>-mini`。单独记录根部 `project.config.json` 的哈希和 `miniprogram/` 下的完整文件清单，在微信开发者工具复核同一份文件。

网关启用后，从公网以有效证书访问小程序域名的 `GET /me`，不带 Cookie 或令牌，期望返回后端的 401。再用试用后端登记的公开引用和有已发布合成菜单的日期请求 `GET /public/meals?date=YYYY-MM-DD&public_ref=<公开引用>`，按已知的公开菜单核对校区。Nest 的 `/health` 应在服务器本机检查，小程序网关按现有配置会拦截公网对该路径的请求。微信账号若把服务器域名托管给第三方，可在开发者工具的「详情 → 项目配置 → 域名信息」刷新并核对 request 合法域名。

仅启用证书时，公网 `/me` 与 `/health` 都应返回 404。等邀请试用后端及网关启用后，再在仓库根目录运行下面的只读检查。请从试用管理端的餐单发布记录取得校区公开引用、业务日期、餐单 UUID 和按顺序排列的全部菜品，用实际值替换引号中的占位符。校区引用应与构建小程序时的 `TARO_APP_PUBLIC_REFERENCE` 相同。

```powershell
node scripts/verify-trial-mini-api.mjs '<试用校区公开引用>' '<YYYY-MM-DD>' '<已发布虚构餐单的UUID>' '<第一道菜>' '<第二道菜>'
```

菜品按实际数量填写，每道菜占一个参数。检查器仅匿名访问 `https://api.enhe-tongxin.com`。退出码为 0 表示受保护的 `/me` 返回预期未登录错误，小程序能解析指定日期的菜单并与发布记录逐项匹配，且 `/health` 仍对外关闭。检查失败时先看输出指明的步骤。对客版本的登录、角色操作和微信合法域名仍由同包实点验证。

小程序网关检查原始 HTTP 方法及路径。当前 Taro 合同包括访客餐单、邀请登录、监护关系、成长记录、通知、健康、请假、接送、费用、学习监督及练习、员工日报和月报。动态路径只接受 UUID，服务端继续校验成员、校区、监护关系和业务动作。公开餐单按客户端生成的顺序传递 `date` 与 `public_ref` 两个参数，其余当前调用使用无查询参数的路径。新增客户端动作时应同时更新方法和路径清单，并重测未公开的 Nest 路由。

登录通过 JSON 请求体提交。已登录请求只传当前邀请会话的 Bearer，网关剥离网站 Cookie、外来转发头和自报身份头。JSON 写入上限为 64 KiB。登出允许无正文。登录按直连客户端地址限制为每分钟 10 次，突发 5 次；达到限制后返回 429。小程序请求日志只记录时间、状态码、上游状态和耗时，使用受限权限和轮转保留。排障可用下表核对，不在日志中追加原始 URI、请求正文、Authorization 或 Cookie。

| 试用现象 | 核对方式 |
| --- | --- |
| TLS 握手失败或 HTTP 421 | 核对证书、TLS 站点名、HTTP Host 和 443 端口是否对应同一域名 |
| 开关关闭、未公开的路径或错误方法返回 404 | 核对小程序专用域名、启用开关及版本匹配的 Taro 路由 |
| 合法路径返回 401 或 403 | 检查受邀账号会话以及该角色对当前对象的权限 |
| 歧义路径、过大写入或不支持的媒体类型 | 查看 400/404、413 或 415；使用客户端生成的原始路径与 JSON |
| 重复登录返回 429 | 停止连续尝试，核查凭据与客户端重试逻辑后再试 |

## 检查试用入口

如需从备份恢复数据库，先在隔离库完成凭证失效和现场交接核对，再开放网站及小程序入口。[试用数据库恢复步骤](./trial-db-restore.md)

在具有 DNS、有效证书和两套对应运行包的试用环境中，用普通浏览器分别打开 `/visitor`、`/web/login` 和 `/admin/login`。确认两端页面、样式、脚本和图片均能加载。网络面板中管理站的 CSS 和 JavaScript 应从 `/admin-static/_next/static/` 返回，用户站从 `/_next/static/` 返回。检查响应的内容类型，避免把返回 HTML 的错误页面当作已加载的脚本。

分别用合成家长与管理账号登录，验证允许的同源操作、跨源写入被拒、退出后仅本端会话结束。再用匿名会话访问受保护接口，核对拒绝响应。验证内部路径返回 404，未知 TLS 站点名无法建立连接，正确站点名配错误 HTTP 主机名的请求被拒绝。部署前保留上一版配置和两套完整运行包；需要回退时按同一个经过验证的版本组合恢复。
