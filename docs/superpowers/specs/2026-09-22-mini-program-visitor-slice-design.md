# 微信小程序访客切片设计

## 目标

为家长提供一个可识别、可浏览、可返回的微信小程序访客入口：查看同芯机构公开介绍与模拟公开内容，并在内容不可用时得到明确的空状态或错误状态。

本切片只完成访客首页和公开内容详情，不接入登录、真实 API、数据库、伙伴云、外部图片、外部字体或任何真实未成年人数据。

## 用户路径

1. 家长打开 `pages/visitor/home`，看到品牌头部、服务方向和公开内容。
2. 家长点击公开内容卡片，进入 `pages/visitor/content` 并通过本地安全 key 读取展示投影。
3. 家长点击返回按钮回到访客首页。
4. 没有可展示内容时，首页显示可读空状态；缺失或不合规内容时，详情页显示不可用状态，不泄露原始数据。

## 视觉与交互

- 页面优先使用微软雅黑或微信系统无衬线字体。
- 主色使用深蓝与蓝紫，暖黄色作为 CTA/重点色，背景使用浅色分层；不复制参考网站的代码、图片、文案或品牌素材。
- 首页采用单列移动布局：品牌头部、场景主视觉、三项服务说明、公开内容卡片和底部说明。
- 卡片使用不超过 8px 的圆角、轻微阴影和清晰边界；页面不使用嵌套卡片。
- 所有按钮与可点击内容的可触区域不小于 44px；焦点状态有可见的高对比度轮廓。
- 图片和远程资源不是本切片依赖；主视觉使用本地 CSS 几何装饰和语义文字，避免版权和联网风险。
- 尊重 `prefers-reduced-motion`，动效仅用于轻微入场和按压反馈，禁用时完全静止。

## 数据和安全边界

- 页面只消费 `apps/mini-program/src/pages/visitor/home.ts` 与 `content.ts` 提供的合成公开投影。
- 只有 `PUBLISHED + PUBLIC + PUBLIC scope + SIMULATED + FRESH + ENABLED` 内容可见。
- 页面不得渲染 tenant、campus、内部 ID、provider URL、权限声明或任何原始未过滤字段。
- 不使用网络请求、持久化存储、浏览器 API、外部链接、第三方 SDK 或凭据。
- 所有 loading、empty、error、published 状态均有明确的可读状态文案。

## 文件边界

本切片允许新增或修改的文件只包括：

- `apps/mini-program/app.json`
- `apps/mini-program/app.ts`
- `apps/mini-program/app.wxss`
- `apps/mini-program/pages/visitor/home/index.ts`
- `apps/mini-program/pages/visitor/home/index.wxml`
- `apps/mini-program/pages/visitor/home/index.wxss`
- `apps/mini-program/pages/visitor/content/index.ts`
- `apps/mini-program/pages/visitor/content/index.wxml`
- `apps/mini-program/pages/visitor/content/index.wxss`
- `apps/mini-program/src/pages/visitor.test.ts`
- `apps/mini-program/tsconfig.json`

已有安全投影模块 `apps/mini-program/src/pages/visitor/home.ts`、`content.ts` 和 `src/navigation/routes.ts` 保持不变，除非测试证明本切片确实需要最小兼容修复。

## 验收标准

- 首页和详情页的原生页面入口、配置和样式文件完整。
- 首页能展示合成公开内容，详情页能安全展示正文并返回首页。
- loading、empty、error、published 四类状态均可渲染。
- 公开过滤、路由安全 key、无外部请求和无敏感字段规则保持通过。
- TypeScript、focused test、ESLint、Prettier 和 `git diff --check` 通过。
- 代码不触碰 API、数据库、lockfile、冻结测试、Task 19 工件或伙伴云。

## 非目标

本切片不实现课程目录、课程报名、校区目录、接送、家长绑定、学生日报、考勤、请假、健康、费用、AI、支付、伙伴云、后台管理、腾讯云部署或微信体验版发布。
