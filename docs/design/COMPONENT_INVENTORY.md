# 组件库存

## 基础组件

| 组件 | 变体 | 必须状态 | 适用端 |
|---|---|---|---|
| Button | primary、secondary、quiet、danger、icon | default、hover、focus、disabled、loading | 全端 |
| TextField | text、search、number | empty、filled、error、disabled | 全端 |
| Select/Segment | single、multi、date | default、selected、empty、error | 全端 |
| StatusBadge | success、info、warning、danger、neutral | 文字+图标 | 全端 |
| Toast/InlineAlert | info、success、warning、error | 自动消失仅用于非关键提示 | 全端 |
| Modal/Drawer | confirm、form、detail | open、loading、error、closed | 网页/必要小程序 |

## 业务组件

| 组件 | 内容 | 关键动作 |
|---|---|---|
| BrandHeader | Logo、页面标题、上下文 | 返回、通知或菜单 |
| BottomNav | 当前端角色的 4 个入口 | 切换路由 |
| SideNav | 管理端分组入口 | 展开、选中、折叠 |
| ContextBar | 租户、校区、模拟身份 | 查看范围、切换允许范围 |
| MetricStrip | 数字、标签、趋势文本 | 进入对应详情 |
| ContentCard | 标题、摘要、状态、下一步 | 查看、编辑或返回 |
| FilterBar | 搜索、筛选、清除 | 提交、重置 |
| DataTable | 行、列、状态、批量区 | 排序、查看、编辑 |
| Timeline | 时间点、事实、负责人 | 展开详情 |
| FlowStepper | 当前阶段和合法下一步 | 继续、退回、关闭 |
| AIHintPanel | 尝试、层级、巩固题 | 逐层提示、转教师、关闭 |
| AuditRow | 动作、对象、范围、时间 | 查看最小摘要 |

## 统一约束

- 组件不内置真实请求、持久化或权限绕过；所有动作调用原型内存状态。
- 每个组件有空、错误、加载和终态；不可操作时说明原因。
- 卡片保持单层；表格在窄屏转为行卡片或横向滚动，不压缩文字。
- 组件文案使用模拟数据，状态守卫在路由和动作两个层级检查。
