(function () {
  "use strict";

  const CONTRACT_SHA256 = "892521A36DF3A3A1E76C3923E00705E6F9405515020701279F2AB328F00436AC";

  function definePage(spec) {
    const isFlow = spec.level === "B";
    return Object.freeze({
      ...spec,
      stage: isFlow ? "B/关键流程原型" : "A/V0.1",
      normal: `${spec.name}使用离线模拟数据展示主要区域与操作。`,
      empty: spec.empty || `${spec.name}暂无模拟记录；保留开始或返回入口。`,
      error: spec.error || `${spec.name}模拟失败；可重试且不丢失非敏感状态。`,
      permission: spec.permission || `${spec.name}仅向页面所列角色及范围开放；越权时隐藏正文。`,
      terminal: spec.terminal || `${spec.name}操作已形成明确模拟终态，可返回来源页面。`
    });
  }

  // ROUTE_CATALOG_BEGIN — 只能包含 47 个 A 级和 12 个 B 级条目。
  const PAGE_CATALOG = Object.freeze([
    definePage({ id: "A-MP-01", level: "A", endpoint: "mini", route: "/mini/visitor/home", name: "访客首页", role: "访客", regions: ["机构摘要", "公开模块卡片", "家校共育摘要", "联系入口"], actions: ["进入机构/教师/活动/餐食/流程/联系", "返回公开导航"], empty: "暂无已发布内容；仍保留基础联系入口。", error: "公开内容加载失败；可重试或返回。", permission: "仅公开读取已发布投影；草稿不可见。" }),
    definePage({ id: "A-MP-02", level: "A", endpoint: "mini", route: "/mini/visitor/institution", name: "机构介绍", role: "访客", regions: ["简介", "服务", "理念", "企业文化独立区块与锚点"], actions: ["定位企业文化", "返回访客首页"], empty: "暂无机构介绍。", error: "介绍加载失败；返回访客首页。", permission: "公开读取已发布机构资料。" }),
    definePage({ id: "A-MP-03", level: "A", endpoint: "mini", route: "/mini/visitor/home-school", name: "家校共育", role: "访客", regions: ["共育理念", "家长沟通方式", "服务边界"], actions: ["展开/收起区块", "返回访客首页"], empty: "暂无家校共育内容。", error: "内容加载失败；返回访客首页。", permission: "仅公开内容；不出现学生信息。" }),
    definePage({ id: "A-MP-04", level: "A", endpoint: "mini", route: "/mini/visitor/day-flow", name: "一日流程", role: "访客", regions: ["时间轴", "活动", "注意事项"], actions: ["按时段查看", "返回访客首页"], empty: "暂无已发布流程。", error: "流程加载失败；可重试。", permission: "公开读取已发布一日流程。" }),
    definePage({ id: "A-MP-05", level: "A", endpoint: "mini", route: "/mini/visitor/teachers", name: "教师团队", role: "访客", regions: ["公开教师卡片", "筛选占位"], actions: ["选择教师", "返回访客首页"], empty: "暂无公开教师。", error: "教师列表加载失败；可重试。", permission: "只显示批准的公开字段。" }),
    definePage({ id: "A-MP-06", level: "A", endpoint: "mini", route: "/mini/visitor/teachers/:id", name: "教师详情", role: "访客", regions: ["公开简介", "擅长方向", "公开经历"], actions: ["查看公开资料", "返回教师团队"], empty: "该教师公开资料已下架。", error: "对象不存在或加载失败；返回团队。", permission: "仅已发布公开对象；内部档案字段不可见。" }),
    definePage({ id: "A-MP-07", level: "A", endpoint: "mini", route: "/mini/visitor/activities", name: "精彩活动", role: "访客", regions: ["活动卡片", "日期筛选"], actions: ["筛选活动", "进入活动详情", "清除筛选"], empty: "暂无活动或筛选无结果。", error: "活动列表加载失败；可重试。", permission: "仅已发布活动公开可见。" }),
    definePage({ id: "A-MP-08", level: "A", endpoint: "mini", route: "/mini/visitor/activities/:id", name: "活动详情", role: "访客", regions: ["标题", "时间", "正文", "模拟媒体"], actions: ["查看详情", "返回活动列表"], empty: "活动已下架。", error: "对象不存在或加载失败；返回列表。", permission: "详情不显示参与学生信息。" }),
    definePage({ id: "A-MP-09", level: "A", endpoint: "mini", route: "/mini/visitor/meals", name: "餐食与食谱", role: "访客", regions: ["日期", "餐次", "菜品", "一般提示"], actions: ["切换日期", "切换餐次"], empty: "暂无已发布食谱。", error: "食谱加载失败；可重试。", permission: "不显示个人健康资料，不构成医疗建议。" }),
    definePage({ id: "A-MP-10", level: "A", endpoint: "mini", route: "/mini/visitor/campuses", name: "校区与联系方式", role: "访客", regions: ["校区环境", "公开地址描述", "联系区块", "预约模拟意向"], actions: ["选择校区", "提交最小模拟意向", "返回访客首页"], empty: "暂无公开校区或联系方式。", error: "模拟提交失败；保留非敏感输入并可重试。", permission: "公开读取；意向仅在内存中模拟。", terminal: "显示模拟联系/预约确认；未发送任何外部请求。" }),
    definePage({ id: "A-MP-11", level: "A", endpoint: "mini", route: "/mini/staff/login", name: "员工登录", role: "教师、工作人员", regions: ["模拟账号选择", "租户/校区范围提示", "非真实登录说明"], actions: ["选择模拟身份", "进入内部工作台", "取消"], empty: "无可用模拟身份。", error: "模拟校验失败；可返回。", permission: "仅模拟 Membership；不收集手机号或密码。" }),
    definePage({ id: "A-MP-12", level: "A", endpoint: "mini", route: "/mini/staff/workbench", name: "内部工作台", role: "教师、工作人员", regions: ["新人指南", "教学资源", "资源搜索", "伙伴云", "我的账号"], actions: ["进入内部模块", "退出模拟身份"], empty: "暂无授权模块。", error: "Membership失效或无权限；返回登录。", permission: "有效模拟 Membership，按租户/校区范围。" }),
    definePage({ id: "A-MP-13", level: "A", endpoint: "mini", route: "/mini/staff/guides", name: "新人指南列表", role: "教师、工作人员", regions: ["分类", "指南卡片"], actions: ["选择分类", "选择指南", "清除条件"], empty: "暂无指南或筛选无结果。", error: "加载失败或无权限；返回工作台。", permission: "内部读取权限；访客不可见。" }),
    definePage({ id: "A-MP-14", level: "A", endpoint: "mini", route: "/mini/staff/guides/:id", name: "新人指南详情", role: "教师、工作人员", regions: ["标题", "版本", "正文", "模拟附件"], actions: ["查看正文", "返回指南列表"], empty: "指南已下架。", error: "不存在、无权限或加载失败。", permission: "内部读取权限与租户范围；失败时隐藏正文。" }),
    definePage({ id: "A-MP-15", level: "A", endpoint: "mini", route: "/mini/staff/resources/categories", name: "教学资源分类", role: "教师、工作人员", regions: ["分类卡片", "适用范围"], actions: ["选择分类", "进入资源列表", "返回工作台"], empty: "暂无可见分类。", error: "加载失败或无权限。", permission: "内部资源读取权限，按角色/校区过滤。" }),
    definePage({ id: "A-MP-16", level: "A", endpoint: "mini", route: "/mini/staff/resources", name: "教学资源列表", role: "教师、工作人员", regions: ["资源卡片", "分类与搜索条件摘要"], actions: ["筛选资源", "清除条件", "进入资源详情"], empty: "暂无资源或无匹配结果。", error: "加载失败或无权限。", permission: "内部资源读取权限；仅显示授权字段。" }),
    definePage({ id: "A-MP-17", level: "A", endpoint: "mini", route: "/mini/staff/resources/:id", name: "教学资源详情", role: "教师、工作人员", regions: ["标题", "版本", "适用范围", "正文与模拟附件"], actions: ["查看资源", "保留条件返回来源"], empty: "资源已下架。", error: "不存在、无权限或加载失败。", permission: "内部资源读取权限；隐藏未授权字段。" }),
    definePage({ id: "A-MP-18", level: "A", endpoint: "mini", route: "/mini/staff/resources/search", name: "资源搜索", role: "教师、工作人员", regions: ["搜索框", "分类筛选", "结果列表"], actions: ["输入模拟关键词", "筛选", "清除", "进入详情"], empty: "无匹配资源；可清除条件。", error: "查询失败或无权限；可重试。", permission: "内部资源读取权限；作为资源信息架构内的独立逻辑路由。" }),
    definePage({ id: "A-MP-19", level: "A", endpoint: "mini", route: "/mini/staff/partner-cloud", name: "伙伴云链接", role: "教师、工作人员", regions: ["已发布且启用的链接说明", "角色限制", "安全确认"], actions: ["选择模拟链接", "确认或取消", "返回工作台"], empty: "草稿、已下架或停用时无入口。", error: "非法直达或无权限；返回工作台。", permission: "仅 PUBLISHED + ENABLED 双守卫；不调用接口、不保存凭据。" }),
    definePage({ id: "A-MP-20", level: "A", endpoint: "mini", route: "/mini/staff/account", name: "我的账号", role: "教师、工作人员", regions: ["模拟身份", "机构", "校区", "角色范围"], actions: ["切换允许角色", "退出模拟身份"], empty: "无有效 Membership。", error: "角色切换失败；保留原角色。", permission: "只读本人范围；不显示敏感凭据。" }),

    definePage({ id: "A-WEB-01", level: "A", endpoint: "web", route: "/web/visitor/home", name: "访客首页", role: "访客", regions: ["机构摘要", "公开导航", "家校共育独立区块", "校区联系与预约意向"], actions: ["导航或锚点定位", "提交最小模拟意向"], empty: "暂无公开内容；保留基础联系说明。", error: "加载或模拟提交失败；可重试与返回。", permission: "公开读取；合并区块保留独立入口和终态。" }),
    definePage({ id: "A-WEB-02", level: "A", endpoint: "web", route: "/web/visitor/institution", name: "机构介绍", role: "访客", regions: ["简介", "服务", "企业文化独立区块", "校区环境", "共育链接"], actions: ["定位锚点", "进入联系/预约", "返回首页"], empty: "暂无机构介绍。", error: "加载失败；返回首页。", permission: "公开读取已发布机构资料；合并内容不丢字段。" }),
    definePage({ id: "A-WEB-03", level: "A", endpoint: "web", route: "/web/visitor/teachers", name: "教师团队", role: "访客", regions: ["公开教师卡片", "筛选"], actions: ["筛选", "选择教师", "清除"], empty: "暂无公开教师或无结果。", error: "教师列表加载失败；可重试。", permission: "仅公开字段。" }),
    definePage({ id: "A-WEB-04", level: "A", endpoint: "web", route: "/web/visitor/teachers/:id", name: "教师详情", role: "访客", regions: ["公开简介", "擅长方向", "公开经历"], actions: ["查看公开资料", "保持筛选返回团队"], empty: "教师公开资料已下架。", error: "对象不存在或加载失败。", permission: "不显示内部教师档案。" }),
    definePage({ id: "A-WEB-05", level: "A", endpoint: "web", route: "/web/visitor/activities", name: "活动", role: "访客", regions: ["活动列表", "筛选", "详情抽屉"], actions: ["筛选", "打开详情", "关闭并返回"], empty: "暂无活动或无匹配结果。", error: "活动加载失败；可重试。", permission: "仅已发布活动与模拟媒体。" }),
    definePage({ id: "A-WEB-06", level: "A", endpoint: "web", route: "/web/visitor/meals", name: "餐食与食谱", role: "访客", regions: ["周期", "日期", "餐次", "菜品"], actions: ["切换周期", "选择日期或餐次"], empty: "暂无已发布食谱。", error: "食谱加载失败；可重试。", permission: "公开读取；不含个人健康信息。" }),
    definePage({ id: "A-WEB-07", level: "A", endpoint: "web", route: "/web/visitor/day-flow", name: "一日流程", role: "访客", regions: ["完整时间轴", "活动说明"], actions: ["选择时段", "返回访客首页"], empty: "暂无已发布流程。", error: "流程加载失败；可重试。", permission: "公开读取；网页端适配长内容阅读。" }),
    definePage({ id: "A-WEB-08", level: "A", endpoint: "web", route: "/web/staff/login", name: "员工登录", role: "教师、工作人员", regions: ["模拟身份", "角色与范围", "非正式系统提示"], actions: ["选择模拟身份", "进入工作台", "取消"], empty: "无可用模拟身份。", error: "模拟校验失败；返回公开页。", permission: "仅模拟 Membership；不收集密码、手机号或授权。" }),
    definePage({ id: "A-WEB-09", level: "A", endpoint: "web", route: "/web/staff/workbench", name: "内部工作台", role: "教师、工作人员", regions: ["指南", "教学资源", "伙伴云", "账号", "完整阅读入口"], actions: ["进入内部模块", "退出模拟身份"], empty: "暂无授权模块。", error: "无权限或 Membership 失效。", permission: "有效模拟 Membership，按租户/校区范围。" }),
    definePage({ id: "A-WEB-10", level: "A", endpoint: "web", route: "/web/staff/guides", name: "新人指南", role: "教师、工作人员", regions: ["分类与列表", "正文阅读", "版本", "模拟附件"], actions: ["筛选", "选文", "返回列表"], empty: "暂无指南或无匹配结果。", error: "加载失败或无权限。", permission: "内部读取权限；访客不可见。" }),
    definePage({ id: "A-WEB-11", level: "A", endpoint: "web", route: "/web/staff/resources", name: "教学资源", role: "教师、工作人员", regions: ["分类", "搜索", "筛选", "列表与详情"], actions: ["搜索", "筛选", "清除", "打开详情", "返回"], empty: "暂无资源或无结果。", error: "查询/加载失败或无权限。", permission: "内部资源读取权限；搜索合并但独立验收。" }),
    definePage({ id: "A-WEB-12", level: "A", endpoint: "web", route: "/web/staff/partner-cloud", name: "伙伴云入口", role: "教师、工作人员", regions: ["已发布且启用的快捷链接", "角色限制", "安全确认"], actions: ["选择", "确认或取消", "返回工作台"], empty: "草稿、已下架或停用时无入口。", error: "非法直达或无权限；返回工作台。", permission: "仅 PUBLISHED + ENABLED 双守卫；不接接口、不存凭据。" }),
    definePage({ id: "A-WEB-13", level: "A", endpoint: "web", route: "/web/staff/account", name: "我的账号", role: "教师、工作人员", regions: ["模拟身份", "Membership", "机构/校区/角色"], actions: ["切换允许角色", "退出模拟身份"], empty: "无有效 Membership。", error: "切换失败；保留原角色。", permission: "多角色权限不合并；不显示密钥或真实身份数据。" }),

    definePage({ id: "A-ADM-01", level: "A", endpoint: "admin", route: "/admin/login", name: "登录", role: "机构管理员、校区负责人", regions: ["模拟身份", "租户/校区范围", "非正式提示"], actions: ["选择模拟身份", "进入管理看板", "取消"], empty: "无模拟管理员。", error: "模拟登录失败。", permission: "模拟管理 Membership；无真实认证。" }),
    definePage({ id: "A-ADM-02", level: "A", endpoint: "admin", route: "/admin/dashboard", name: "管理看板", role: "机构管理员、校区负责人", regions: ["内容待办", "发布摘要", "14个后台入口"], actions: ["进入管理页", "切换授权校区"], empty: "无待办；保留创建入口。", error: "加载失败或无权限。", permission: "仅所属机构/授权校区；不显示跨范围数据。" }),
    definePage({ id: "A-ADM-03", level: "A", endpoint: "admin", route: "/admin/institution", name: "机构资料", role: "机构管理员、校区负责人", regions: ["简介", "服务", "企业文化独立字段", "校区环境与联系字段"], actions: ["编辑", "保存草稿", "预览"], empty: "尚未创建机构资料。", error: "校验、冲突或模拟保存失败。", permission: "机构编辑权限；校区负责人限范围。", terminal: "草稿已模拟保存；保存不等于发布。" }),
    definePage({ id: "A-ADM-04", level: "A", endpoint: "admin", route: "/admin/home-content", name: "首页内容", role: "机构管理员", regions: ["区块配置", "家校共育", "联系/预约入口", "预览"], actions: ["编辑", "保存", "预览", "列表上移/下移并记录排序"], empty: "尚无首页配置。", error: "校验、冲突或模拟保存失败。", permission: "机构内容管理权限；合并区块独立可验收。" }),
    definePage({ id: "A-ADM-05", level: "A", endpoint: "admin", route: "/admin/public-teachers", name: "教师公开介绍", role: "机构管理员、校区负责人", regions: ["公开教师列表", "字段编辑", "预览"], actions: ["新建/编辑", "发布/下架", "上移/下移并保存排序"], empty: "暂无公开教师；可新建模拟记录。", error: "校验、冲突或模拟保存失败。", permission: "公开内容管理权限；与内部档案分离。" }),
    definePage({ id: "A-ADM-06", level: "A", endpoint: "admin", route: "/admin/activities", name: "活动管理", role: "机构管理员、校区负责人", regions: ["活动列表", "编辑", "模拟媒体", "预览"], actions: ["新建/编辑", "发布/下架", "上移/下移并保存排序"], empty: "暂无活动；可新建模拟记录。", error: "校验、冲突或模拟媒体失败。", permission: "内容管理权限与校区范围；操作记模拟日志。" }),
    definePage({ id: "A-ADM-07", level: "A", endpoint: "admin", route: "/admin/meals", name: "餐食与食谱", role: "机构管理员、校区负责人", regions: ["日期/餐次列表", "菜品编辑", "预览"], actions: ["新建/编辑", "发布/下架", "上移/下移并保存排序"], empty: "暂无食谱；可新建模拟记录。", error: "校验、冲突或模拟保存失败。", permission: "内容管理权限与校区范围；无学生健康字段。" }),
    definePage({ id: "A-ADM-08", level: "A", endpoint: "admin", route: "/admin/guides", name: "新人指南", role: "机构管理员、校区负责人", regions: ["指南列表", "正文", "版本", "适用范围"], actions: ["新建/编辑", "发布/下架", "上移/下移并保存排序"], empty: "暂无指南；可新建模拟记录。", error: "校验、冲突或无权限。", permission: "内部内容管理权限；只在授权范围可见。" }),
    definePage({ id: "A-ADM-09", level: "A", endpoint: "admin", route: "/admin/resources", name: "教学资源", role: "机构管理员、校区负责人", regions: ["分类/资源列表", "适用范围", "模拟媒体"], actions: ["新建/编辑", "发布/下架", "上移/下移并保存排序"], empty: "暂无资源；可新建模拟记录。", error: "校验、冲突或无权限。", permission: "内部资源管理权限；支持网页搜索投影。" }),
    definePage({ id: "A-ADM-10", level: "A", endpoint: "admin", route: "/admin/partner-cloud", name: "伙伴云链接", role: "机构管理员", regions: ["链接列表", "发布状态", "运行状态", "角色范围"], actions: ["新建/编辑", "发布/下架", "启用/停用", "上移/下移并保存排序"], empty: "暂无链接；可新建模拟记录。", error: "地址校验、状态组合冲突或无权限。", permission: "发布与运行双轴正交；只读模拟地址说明。" }),
    definePage({ id: "A-ADM-11", level: "A", endpoint: "admin", route: "/admin/staff", name: "员工账号", role: "机构管理员、校区负责人", regions: ["模拟成员列表", "角色", "租户/校区范围"], actions: ["新建模拟成员", "启用/停用", "分配概念角色"], empty: "暂无模拟员工。", error: "范围冲突或无权限。", permission: "不能分配超出自身范围的角色；不实现真实账号。" }),
    definePage({ id: "A-ADM-12", level: "A", endpoint: "admin", route: "/admin/files", name: "文件管理", role: "机构管理员、校区负责人", regions: ["模拟媒体列表", "引用信息"], actions: ["选择", "替换", "归档模拟文件"], empty: "暂无模拟文件。", error: "类型、权限或引用冲突。", permission: "文件管理权限与租户前缀；无真实上传。" }),
    definePage({ id: "A-ADM-13", level: "A", endpoint: "admin", route: "/admin/publishing", name: "发布与下架", role: "机构管理员、校区负责人", regions: ["状态筛选", "预览", "动作确认"], actions: ["发布", "下架", "再次发布", "相关列表上移/下移并留排序证据"], empty: "暂无待处理内容。", error: "版本冲突、无权限或校验失败。", permission: "发布权限与校区范围；非法转换拒绝。" }),
    definePage({ id: "A-ADM-14", level: "A", endpoint: "admin", route: "/admin/audit-logs", name: "基础操作日志", role: "机构管理员、校区负责人", regions: ["操作者", "时间", "对象", "动作", "前后状态"], actions: ["按时间/对象/动作筛选", "查看详情", "清除筛选"], empty: "暂无日志或筛选无结果。", error: "加载失败或无权限。", permission: "只读且按校区范围；不显示超范围敏感正文。" }),

    definePage({ id: "B-FLOW-01", level: "B", endpoint: "flow", route: "/flow/guardian-binding", name: "家长与学生绑定", role: "访客、家长、机构管理员、校区负责人", regions: ["微信登录概念", "手机号占位", "邀请码+学生姓名+班级", "提交与范围审核", "通过/拒绝/解除终态"], actions: ["按锁定顺序填写", "提交", "审核通过/拒绝", "通用编辑重提", "家长解除"], empty: "无申请；提供开始入口。", error: "字段错误、邀请码无效、重复申请或审核冲突。", permission: "申请人限本人；审核者限所属机构与授权校区。", terminal: "通过进入家长首页；拒绝可编辑重提；解除回到未绑定。" }),
    definePage({ id: "B-FLOW-02", level: "B", endpoint: "flow", route: "/flow/guardian-home", name: "家长首页", role: "家长", regions: ["关联学生卡片", "每日记录", "请假", "接送", "AI监督状态"], actions: ["选择授权学生", "进入待办", "确认已读", "解除关系"], empty: "无关联学生；提供绑定入口。", error: "关系失效或加载失败；回到绑定入口。", permission: "仅已通过 GuardianRelationship；学生甲/示例班级均为模拟数据。" }),
    definePage({ id: "B-FLOW-03", level: "B", endpoint: "flow", route: "/flow/student-daily-care", name: "学生每日托管记录", role: "家长、教师", regions: ["当日出勤", "活动", "餐食", "接送", "一般备注摘要"], actions: ["教师保存草稿/提交", "家长确认已阅", "发起更正"], empty: "当日暂无记录。", error: "越权、模拟保存失败或版本冲突。", permission: "教师限班级写；家长限已通过关系读。" }),
    definePage({ id: "B-FLOW-04", level: "B", endpoint: "flow", route: "/flow/leave", name: "请假", role: "家长、教师、机构管理员、校区负责人", regions: ["日期", "最小原因类别", "状态", "处理意见"], actions: ["家长保存/提交/撤回", "授权人员确认/拒绝"], empty: "无请假；提供新建入口。", error: "时间冲突、越权或处理冲突。", permission: "家长限关系；教师限班级；管理者限机构/授权校区。" }),
    definePage({ id: "B-FLOW-05", level: "B", endpoint: "flow", route: "/flow/pickup", name: "安全接送", role: "家长、教师、机构管理员、校区负责人", regions: ["授权对象占位", "有效期", "核验", "接送记录", "异常入口"], actions: ["家长创建/撤销", "教师核验/开始/完成或标异常", "负责人跟进"], empty: "无有效授权；禁止放行。", error: "授权失效、核验失败或越权；转负责人。", permission: "关系、班级、机构与校区四重范围。" }),
    definePage({ id: "B-FLOW-06", level: "B", endpoint: "flow", route: "/flow/teacher-workbench", name: "教师工作台", role: "教师", regions: ["今日任务", "班级摘要", "请假/接送/异常", "日报草稿"], actions: ["领取下一任务", "进入班级", "生成/打开日报", "查看AI教师摘要"], empty: "无任务；仍显示班级与日报入口。", error: "Membership或班级范围失效。", permission: "教师当前租户、校区与班级范围。" }),
    definePage({ id: "B-FLOW-07", level: "B", endpoint: "flow", route: "/flow/teacher-tasks", name: "教师任务管理", role: "教师、机构管理员、校区负责人", regions: ["任务列表", "详情", "完成原因", "普通未完成原因"], actions: ["教师开始/完成/记录未完成", "请求取消", "负责人创建/取消", "受信时钟演示"], empty: "无任务；返回教师工作台。", error: "版本冲突、越权或必填原因缺失。", permission: "教师限本人任务；管理者限机构/授权校区。" }),
    definePage({ id: "B-FLOW-08", level: "B", endpoint: "flow", route: "/flow/class-student-status", name: "班级学生情况", role: "教师、机构管理员、校区负责人", regions: ["考勤/请假/接送汇总", "学生记录", "异常跟进"], actions: ["选择必要汇总项", "确认汇总", "跟进异常", "生成日报草稿"], empty: "暂无班级记录。", error: "班级越权或数据冲突；保留汇总前状态。", permission: "只展示授权班级的必要汇总；不得自动贴标签。" }),
    definePage({ id: "B-FLOW-09", level: "B", endpoint: "flow", route: "/flow/teacher-daily-report", name: "教师工作日报", role: "教师、机构管理员、校区负责人", regions: ["任务/班级/考勤/请假/接送/异常汇总", "总结", "交接", "次日重点"], actions: ["生成草稿", "教师补充/提交", "负责人确认/退回", "教师修订重提"], empty: "无可汇总数据时生成带说明的空草稿。", error: "汇总失败、冲突或越权；不丢教师补充。", permission: "教师限本人/班级；负责人限机构/授权校区。", terminal: "已确认并更新教师工作台；不是学生托管日报或绩效结论。" }),
    definePage({ id: "B-FLOW-10", level: "B", endpoint: "flow", route: "/flow/ai-learning-assistant", name: "同芯AI学习助手", role: "家长、教师（学生仅为受监督交互参与者）", regions: ["小学数学模拟题", "学生先尝试", "第0/1/2/必要时3层", "巩固1—3题", "安全转教师"], actions: ["监督者开启", "学生提交尝试与逐层重答", "转教师", "关闭"], empty: "无模拟题；返回监督设置。", error: "安全拦截或模拟服务不可用；转教师或关闭。", permission: "需家长关系或教师班级范围、同意和机构开关；学生无独立账号/角色。", terminal: "完成/需介入仅生成最小状态；摘要正文只回流授权教师。" }),
    definePage({ id: "B-FLOW-11", level: "B", endpoint: "flow", route: "/flow/ai-teacher-summary", name: "AI学习摘要回流教师", role: "教师", regions: ["尝试次数", "使用提示层", "巩固结果", "安全标记", "介入建议"], actions: ["教师查看", "确认已阅", "进入介入", "关闭摘要"], empty: "暂无摘要。", error: "摘要生成失败或越权；隐藏正文。", permission: "正文仅授权教师班级范围；家长、管理者和学生不可见。", terminal: "已阅/已处理后返回教师工作台；不生成能力、纪律或绩效结论。" }),
    definePage({ id: "B-FLOW-12", level: "B", endpoint: "flow", route: "/flow/guardian-ai-supervision", name: "家长AI监督设置", role: "家长", regions: ["监护人同意", "机构开关", "学生范围", "开启/暂停/关闭", "独立删除请求"], actions: ["同意/拒绝", "开启/暂停/恢复/关闭", "提交删除请求", "查看结果", "修改重提"], empty: "无关联学生或机构关闭能力；删除无申请时提供入口。", error: "关系失效、机构禁用或保存失败；保持原安全状态。", permission: "家长限已通过关系的学生；看不到AI摘要正文。", terminal: "监督开关与删除状态正交；删除处理有待处理、完成或拒绝终态。" })
  ]);
  // ROUTE_CATALOG_END

  const pageById = new Map(PAGE_CATALOG.map((page) => [page.id, page]));
  const pageByRoute = new Map(PAGE_CATALOG.map((page) => [page.route, page]));

  const endpointMeta = Object.freeze({
    index: { label: "统一入口", shell: "shell-index", description: "统一入口与跨端页面审查" },
    mini: { label: "微信小程序", shell: "shell-mini", description: "即时、现场、轻量、快捷处理" },
    web: { label: "用户网页", shell: "shell-web", description: "完整查看、历史、长内容与复杂阅读" },
    admin: { label: "机构管理网页", shell: "shell-admin", description: "配置、权限、表格、统计、审核与批量管理" },
    flow: { label: "关键流程", shell: "shell-flow", description: "12项可操作状态机与3条完整闭环" }
  });

  const endpointDefaults = Object.freeze({
    mini: "A-MP-01",
    web: "A-WEB-01",
    admin: "A-ADM-01",
    flow: "B-FLOW-01"
  });

  const relatedPageIds = Object.freeze({
    "A-MP-01": ["A-MP-02", "A-MP-03", "A-MP-04", "A-MP-05", "A-MP-07", "A-MP-09", "A-MP-10", "A-MP-11"],
    "A-MP-02": ["A-MP-10", "A-MP-01"],
    "A-MP-03": ["A-MP-01"],
    "A-MP-04": ["A-MP-01"],
    "A-MP-05": ["A-MP-06", "A-MP-01"],
    "A-MP-06": ["A-MP-05"],
    "A-MP-07": ["A-MP-08", "A-MP-01"],
    "A-MP-08": ["A-MP-07"],
    "A-MP-09": ["A-MP-01"],
    "A-MP-10": ["A-MP-01"],
    "A-MP-11": ["A-MP-12", "A-MP-01"],
    "A-MP-12": ["A-MP-13", "A-MP-15", "A-MP-18", "A-MP-19", "A-MP-20", "B-FLOW-06"],
    "A-MP-13": ["A-MP-14", "A-MP-12"],
    "A-MP-14": ["A-MP-13"],
    "A-MP-15": ["A-MP-16", "A-MP-12"],
    "A-MP-16": ["A-MP-17", "A-MP-18", "A-MP-15"],
    "A-MP-17": ["A-MP-16", "A-MP-18"],
    "A-MP-18": ["A-MP-16", "A-MP-17", "A-MP-12"],
    "A-MP-19": ["A-MP-12"],
    "A-MP-20": ["A-MP-12", "A-MP-11"],
    "A-WEB-01": ["A-WEB-02", "A-WEB-03", "A-WEB-05", "A-WEB-06", "A-WEB-07", "A-WEB-08"],
    "A-WEB-02": ["A-WEB-01"],
    "A-WEB-03": ["A-WEB-04", "A-WEB-01"],
    "A-WEB-04": ["A-WEB-03"],
    "A-WEB-05": ["A-WEB-01"],
    "A-WEB-06": ["A-WEB-01"],
    "A-WEB-07": ["A-WEB-01"],
    "A-WEB-08": ["A-WEB-09", "A-WEB-01"],
    "A-WEB-09": ["A-WEB-10", "A-WEB-11", "A-WEB-12", "A-WEB-13", "B-FLOW-06"],
    "A-WEB-10": ["A-WEB-09"],
    "A-WEB-11": ["A-WEB-09"],
    "A-WEB-12": ["A-WEB-09"],
    "A-WEB-13": ["A-WEB-09", "A-WEB-08"],
    "A-ADM-01": ["A-ADM-02"],
    "A-ADM-02": ["A-ADM-03", "A-ADM-04", "A-ADM-05", "A-ADM-06", "A-ADM-07", "A-ADM-08", "A-ADM-09", "A-ADM-10", "A-ADM-11", "A-ADM-12", "A-ADM-13", "A-ADM-14", "B-FLOW-01", "B-FLOW-09"],
    "A-ADM-03": ["A-ADM-02", "A-ADM-13"],
    "A-ADM-04": ["A-ADM-02", "A-ADM-13", "A-WEB-01"],
    "A-ADM-05": ["A-ADM-02", "A-ADM-13", "A-WEB-03"],
    "A-ADM-06": ["A-ADM-02", "A-ADM-13", "A-WEB-05"],
    "A-ADM-07": ["A-ADM-02", "A-ADM-13", "A-WEB-06"],
    "A-ADM-08": ["A-ADM-02", "A-ADM-13", "A-WEB-10"],
    "A-ADM-09": ["A-ADM-02", "A-ADM-13", "A-WEB-11"],
    "A-ADM-10": ["A-ADM-02", "A-ADM-13", "A-WEB-12"],
    "A-ADM-11": ["A-ADM-02", "A-ADM-14"],
    "A-ADM-12": ["A-ADM-02", "A-ADM-14"],
    "A-ADM-13": ["A-ADM-02", "A-ADM-14", "A-MP-01", "A-WEB-01"],
    "A-ADM-14": ["A-ADM-02"],
    "B-FLOW-01": ["A-MP-01", "B-FLOW-02"],
    "B-FLOW-02": ["B-FLOW-01", "B-FLOW-03", "B-FLOW-04", "B-FLOW-05", "B-FLOW-12"],
    "B-FLOW-03": ["B-FLOW-02"],
    "B-FLOW-04": ["B-FLOW-02", "B-FLOW-06"],
    "B-FLOW-05": ["B-FLOW-02", "B-FLOW-06", "B-FLOW-08"],
    "B-FLOW-06": ["B-FLOW-07", "B-FLOW-08", "B-FLOW-09", "B-FLOW-11"],
    "B-FLOW-07": ["B-FLOW-06", "B-FLOW-08"],
    "B-FLOW-08": ["B-FLOW-06", "B-FLOW-09"],
    "B-FLOW-09": ["B-FLOW-06", "B-FLOW-08"],
    "B-FLOW-10": ["B-FLOW-12", "B-FLOW-11"],
    "B-FLOW-11": ["B-FLOW-06"],
    "B-FLOW-12": ["B-FLOW-02", "B-FLOW-10"]
  });

  const simpleFlowModels = Object.freeze({
    "B-FLOW-03": {
      key: "dailyCare",
      initial: "未记录",
      states: ["未记录", "草稿", "已提交", "家长已阅", "更正中"],
      transitions: [
        { from: ["未记录"], actor: "教师", label: "教师保存草稿", to: "草稿", note: "模拟教师仅在示例班级范围编辑。" },
        { from: ["草稿"], actor: "教师", label: "教师提交", to: "已提交", note: "提交后家长只读查看。" },
        { from: ["已提交"], actor: "家长", label: "家长确认已阅", to: "家长已阅", note: "模拟已阅状态回写。" },
        { from: ["已提交", "家长已阅"], actor: "教师", label: "教师发起更正", to: "更正中", note: "更正保留前一版本状态说明。" },
        { from: ["更正中"], actor: "教师", label: "教师提交更正", to: "已提交", note: "更正完成后回到已提交，由家长重新查看。" }
      ]
    },
    "B-FLOW-04": {
      key: "leave",
      initial: "草稿",
      states: ["草稿", "待确认", "已确认", "已拒绝", "已撤回"],
      transitions: [
        { from: ["草稿"], actor: "家长", label: "家长提交", to: "待确认", note: "仅保存最小原因类别。" },
        { from: ["待确认"], actor: "授权教师/负责人", label: "授权人员确认", to: "已确认", note: "处理范围已核对。" },
        { from: ["待确认"], actor: "授权教师/负责人", label: "授权人员拒绝", to: "已拒绝", note: "本次请假进入已拒绝终态；原对象不能直接重提。" },
        { from: ["草稿", "待确认"], actor: "家长", label: "家长撤回", to: "已撤回", note: "草稿或待确认均可由家长撤回并返回待办。" },
        { from: ["已确认", "已拒绝", "已撤回"], actor: "家长", label: "新建请假（新对象）", to: "草稿", note: "创建新的模拟请假对象并进入草稿；原对象终态不变。", effect: "newLeaveRequest" }
      ]
    },
    "B-FLOW-05": {
      key: "pickup",
      initial: "无有效授权",
      states: ["无有效授权", "草稿授权", "授权有效", "已核验", "接送中", "已完成", "异常待跟进", "异常已处理", "已撤销", "已过期"],
      transitions: [
        { from: ["无有效授权", "已完成", "异常已处理", "已撤销", "已过期"], actor: "家长", label: "家长创建模拟授权", to: "草稿授权", note: "授权对象仅使用文字占位。" },
        { from: ["草稿授权"], actor: "授权教师/负责人", label: "确认授权有效", to: "授权有效", note: "关系和有效期概念校验通过。" },
        { from: ["授权有效"], actor: "家长", label: "家长撤销", to: "已撤销", note: "撤销后禁止放行。" },
        { from: ["授权有效"], actor: "受信时钟规则", label: "受信时钟：授权到期", to: "已过期", note: "授权已过期；无有效授权不能核验或放行。" },
        { from: ["授权有效"], actor: "教师", label: "教师核验通过", to: "已核验", note: "只记录核验结果，不采集真实证件。" },
        { from: ["已核验"], actor: "教师", label: "开始接送", to: "接送中", note: "进入现场过程状态。" },
        { from: ["接送中"], actor: "教师", label: "正常完成", to: "已完成", note: "完成后返回待办。" },
        { from: ["授权有效", "已核验", "接送中"], actor: "教师", label: "标记模拟异常", to: "异常待跟进", note: "不能强行完成，转负责人。" },
        { from: ["异常待跟进"], actor: "授权教师/负责人", label: "负责人记录处理", to: "异常已处理", note: "只保留必要审计摘要。" }
      ]
    },
    "B-FLOW-07": {
      key: "teacherTask",
      initial: "待处理",
      states: ["待处理", "进行中", "已完成", "已逾期", "已取消"],
      transitions: [
        { from: ["待处理"], actor: "教师", label: "教师开始任务", to: "进行中", note: "任务进入进行中。" },
        { from: ["进行中"], actor: "教师", label: "记录普通未完成原因", to: "进行中", note: "普通未完成不自动变为逾期。" },
        { from: ["进行中"], actor: "教师", label: "教师请求负责人取消", to: "进行中", note: "仅记录取消请求；任务仍为进行中，教师不能自行取消。", effect: "requestCancel" },
        { from: ["待处理", "进行中"], actor: "负责人", label: "负责人按范围取消", to: "已取消", note: "负责人记录一般原因后取消；不形成自动绩效结论。" },
        { from: ["进行中"], actor: "教师", label: "教师完成任务", to: "已完成", note: "完成摘要将进入日报汇总。", go: "B-FLOW-08" },
        { from: ["待处理", "进行中"], actor: "受信时钟规则", label: "受信时钟到达截止时间", to: "已逾期", note: "仅受信时钟规则触发已逾期；教师没有该状态写入动作。" },
        { from: ["已逾期"], actor: "教师", label: "教师补充原因并完成", to: "已完成", note: "任务完成，同时保留曾逾期事实与一般原因。", go: "B-FLOW-08" }
      ]
    },
    "B-FLOW-08": {
      key: "classSummary",
      initial: "未汇总",
      states: ["未汇总", "汇总中", "待跟进", "已处理", "已确认"],
      transitions: [
        { from: ["未汇总"], actor: "教师", label: "选择必要汇总项", to: "汇总中", note: "只汇总考勤、请假、接送、记录和异常必要状态。" },
        { from: ["汇总中"], actor: "教师", label: "发现模拟异常", to: "待跟进", note: "异常不生成能力或纪律标签。" },
        { from: ["待跟进"], actor: "负责人", label: "负责人处理异常", to: "已处理", note: "形成最小审计摘要。" },
        { from: ["已处理"], actor: "教师", label: "回到汇总核对", to: "汇总中", note: "异常处理结果回写后重新核对汇总。" },
        { from: ["汇总中"], actor: "教师", label: "确认班级汇总", to: "已确认", note: "确认后允许生成教师日报草稿。", go: "B-FLOW-09" }
      ]
    },
    "B-FLOW-09": {
      key: "dailyReport",
      initial: "草稿",
      states: ["草稿", "已提交", "退回修改", "已确认"],
      transitions: [
        { from: ["草稿", "退回修改"], actor: "教师", label: "教师补充并提交", to: "已提交", note: "只补充工作总结、交接和次日重点。" },
        { from: ["已提交"], actor: "负责人", label: "负责人退回", to: "退回修改", note: "保留教师补充，显示一般退回原因。" },
        { from: ["已提交"], actor: "负责人", label: "负责人确认", to: "已确认", note: "日报终态回写教师工作台。", go: "B-FLOW-06" }
      ]
    }
  });

  const flowActorOptions = Object.freeze({
    "B-FLOW-01": ["申请人", "机构/校区审核者"],
    "B-FLOW-03": ["教师", "家长"],
    "B-FLOW-04": ["家长", "授权教师/负责人"],
    "B-FLOW-05": ["家长", "教师", "授权教师/负责人", "受信时钟规则"],
    "B-FLOW-07": ["教师", "负责人", "受信时钟规则"],
    "B-FLOW-08": ["教师", "负责人"],
    "B-FLOW-09": ["教师", "负责人"]
  });

  const flowActorMemory = Object.fromEntries(
    Object.entries(flowActorOptions).map(([pageId, actors]) => [pageId, actors[0]])
  );

  const flowMemory = {
    binding: { state: "待提交", step: "未开始", note: "尚未开始锁定字段顺序。" },
    dailyCare: "未记录",
    leave: "草稿",
    leaveRequestId: "LEAVE-001",
    leaveRequestVersion: 1,
    pickup: "无有效授权",
    teacherTask: "待处理",
    taskCancelRequested: false,
    classSummary: "未汇总",
    dailyReport: "草稿",
    teacherWorkbench: "有待办",
    ai: { state: "未开始", step: "未开始", note: "需先选择家长或教师监督模式。", usedLayer3: false, supervisorMode: "未选择" },
    aiSummary: { state: "暂无摘要", source: "无" },
    aiSupervision: {
      consent: "未同意",
      switchState: "未开启",
      institutionSwitch: "已启用",
      teacherScope: "授权班级有效",
      deletion: "未申请",
      deletionNote: "无删除申请。",
      deletionContext: "家长申请人"
    }
  };

  const interactionMemory = {
    cultureExpanded: {},
    homeSchoolExpanded: {},
    homeSchoolAdminState: "未预览",
    contactState: {},
    resourceState: {},
    sortOrders: {},
    auditReceipts: {}
  };

  const uiState = {
    currentPage: null,
    currentEndpoint: "index",
    reviewMode: "normal",
    roleContext: "访客",
    actionMessage: "尚未执行页面操作。",
    focusRequest: null
  };

  const shell = document.getElementById("app-shell");
  const shellDescription = document.getElementById("shell-description");
  const roleContext = document.getElementById("role-context");
  const routeGroupTitle = document.getElementById("route-group-title");
  const routeCount = document.getElementById("route-count");
  const routeFilter = document.getElementById("route-filter");
  const routeList = document.getElementById("route-list");
  const pageView = document.getElementById("page-view");
  const pageMain = document.getElementById("page-main");
  const liveRegion = document.getElementById("live-region");

  function assertCatalog() {
    const ids = new Set();
    const routes = new Set();
    const counts = { mini: 0, web: 0, admin: 0, flow: 0, A: 0, B: 0 };

    PAGE_CATALOG.forEach((page) => {
      if (ids.has(page.id) || routes.has(page.route)) {
        throw new Error(`重复页面标识或路由：${page.id}`);
      }
      ids.add(page.id);
      routes.add(page.route);
      counts[page.endpoint] += 1;
      counts[page.level] += 1;
    });

    const expected = { mini: 20, web: 13, admin: 14, flow: 12, A: 47, B: 12 };
    Object.keys(expected).forEach((key) => {
      if (counts[key] !== expected[key]) {
        throw new Error(`页面计数不符：${key}=${counts[key]}，预期${expected[key]}`);
      }
    });

    Object.entries(relatedPageIds).forEach(([source, targets]) => {
      if (!ids.has(source) || targets.some((target) => !ids.has(target))) {
        throw new Error(`内部目标不存在：${source}`);
      }
    });
  }

  function escapeMarkup(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function pageFor(id) {
    const page = pageById.get(id);
    if (!page) {
      throw new Error(`未知页面ID：${id}`);
    }
    return page;
  }

  function buttonForPage(id, label) {
    const target = pageFor(id);
    return `<button type="button" data-route="${escapeMarkup(target.route)}">${escapeMarkup(label || target.name)}</button>`;
  }

  function announce(message) {
    liveRegion.textContent = "";
    window.setTimeout(() => {
      liveRegion.textContent = message;
    }, 20);
  }

  function setRoleContext(nextRole) {
    uiState.roleContext = nextRole;
    roleContext.textContent = nextRole;
  }

  function inferRoleContext(page) {
    if (page.id === "B-FLOW-11") return;
    if (page.id === "B-FLOW-10") {
      if (flowMemory.ai.supervisorMode === "家长监督") setRoleContext("家长监督者（模拟审查）");
      else if (flowMemory.ai.supervisorMode === "教师监督") setRoleContext("授权教师监督者（模拟审查）");
      else setRoleContext("未选择监督者");
      return;
    }
    if (flowActorOptions[page.id]) {
      setRoleContext(`${flowActorMemory[page.id]}（当前模拟身份）`);
      return;
    }
    if (page.endpoint === "admin") setRoleContext("机构管理员（模拟审查）");
    else if (page.id.startsWith("A-MP") && page.route.includes("/staff/")) setRoleContext("教师（模拟审查）");
    else if (page.id.startsWith("A-WEB") && page.route.includes("/staff/")) setRoleContext("教师（模拟审查）");
    else if (["B-FLOW-06", "B-FLOW-07", "B-FLOW-08", "B-FLOW-09"].includes(page.id)) setRoleContext("授权教师（模拟审查）");
    else if (["B-FLOW-02", "B-FLOW-03", "B-FLOW-04", "B-FLOW-05", "B-FLOW-10", "B-FLOW-12"].includes(page.id)) setRoleContext("家长（模拟审查）");
    else setRoleContext("访客");
  }

  function setEndpoint(endpoint) {
    const meta = endpointMeta[endpoint];
    uiState.currentEndpoint = endpoint;
    shell.className = `app-shell ${meta.shell}`;
    shellDescription.textContent = meta.description;
    document.querySelectorAll("[data-endpoint]").forEach((button) => {
      if (button.dataset.endpoint === endpoint) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    renderRouteList();
  }

  function navigateToPageId(id, nextRole) {
    const target = pageFor(id);
    if (window.location.hash.slice(1) === target.route) {
      renderCurrentRoute();
      if (nextRole) setRoleContext(nextRole);
    } else {
      if (nextRole) window.addEventListener("hashchange", () => setRoleContext(nextRole), { once: true });
      window.location.hash = target.route;
    }
  }

  function clearRoute() {
    if (window.location.hash) {
      window.location.hash = "";
    } else {
      renderIndex();
    }
  }

  function renderRouteList() {
    const endpoint = uiState.currentEndpoint;
    const query = routeFilter.value.trim().toLocaleLowerCase("zh-CN");
    const pages = endpoint === "index"
      ? []
      : PAGE_CATALOG.filter((page) => page.endpoint === endpoint && `${page.id} ${page.name}`.toLocaleLowerCase("zh-CN").includes(query));

    routeGroupTitle.textContent = endpointMeta[endpoint].label;
    routeCount.textContent = String(pages.length);
    routeList.replaceChildren();

    if (endpoint === "index") {
      const note = document.createElement("p");
      note.className = "notice";
      note.textContent = "选择上方端入口；C级仅在文档中预留，不提供可点击路由。";
      routeList.append(note);
      return;
    }

    pages.forEach((page) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "route-link";
      button.dataset.route = page.route;
      if (uiState.currentPage && uiState.currentPage.id === page.id) button.setAttribute("aria-current", "page");

      const id = document.createElement("span");
      id.className = "route-id";
      id.textContent = page.id;
      const name = document.createElement("span");
      name.textContent = page.name;
      button.append(id, name);
      routeList.append(button);
    });
  }

  function renderIndex() {
    uiState.currentPage = null;
    uiState.reviewMode = "normal";
    setEndpoint("index");
    setRoleContext("访客");
    document.title = "学生托管平台｜Phase 1A 批次A低保真原型";
    pageView.innerHTML = `
      <section class="page-header">
        <div>
          <p class="eyebrow">统一入口 · OFFLINE REVIEW</p>
          <h2>选择一个端或关键流程</h2>
          <p>三端共用概念后端、账号、权限和业务规则，但页面按使用场景区分；本原型只在浏览器内存中改变状态。</p>
        </div>
        <div class="tag-row">
          <span class="tag">合同 ${CONTRACT_SHA256.slice(0, 12)}…</span>
          <span class="tag">模拟数据</span>
        </div>
      </section>
      <div class="entry-grid">
        ${entryCard("20", "微信小程序", "现场与快捷处理", "A-MP-01")}
        ${entryCard("13", "用户网页", "完整查看与长内容", "A-WEB-01")}
        ${entryCard("14", "机构管理网页", "配置、审核与批量操作", "A-ADM-01")}
        ${entryCard("12", "关键流程", "三条闭环与AI五层", "B-FLOW-01")}
      </div>
      <section class="wire-card wide" aria-labelledby="index-boundary-title">
        <h2 id="index-boundary-title">审查边界</h2>
        <ul class="check-list">
          <li>A级页面恰好47项：小程序20、用户网页13、机构管理网页14。</li>
          <li>B级关键流程恰好12项，均可执行确定性状态转换并返回来源。</li>
          <li>C级10项只存在于产品文档，本原型不提供按钮或路由。</li>
          <li>不连接真实服务，不保存输入，不出现真实学生、家长或教师数据。</li>
        </ul>
      </section>`;
    pageMain.focus({ preventScroll: true });
  }

  function entryCard(number, name, description, pageId) {
    const page = pageFor(pageId);
    return `
      <article class="entry-card">
        <span class="entry-number">${escapeMarkup(number)}</span>
        <div>
          <h2>${escapeMarkup(name)}</h2>
          <p>${escapeMarkup(description)}</p>
        </div>
        <button class="button-link" type="button" data-route="${escapeMarkup(page.route)}">进入${escapeMarkup(name)}</button>
      </article>`;
  }

  function reviewTabs() {
    const modes = [
      ["normal", "正常"],
      ["empty", "空状态"],
      ["error", "错误"],
      ["permission", "权限"],
      ["terminal", "终态"]
    ];
    return modes.map(([mode, label]) => `
      <button type="button" data-review-mode="${mode}" aria-pressed="${String(uiState.reviewMode === mode)}">${label}</button>`).join("");
  }

  function statePanel(page) {
    const labelMap = { normal: "正常状态", empty: "空状态", error: "错误状态", permission: "权限状态", terminal: "终态" };
    const isAlert = /拒绝|失败|未通过/.test(uiState.actionMessage);
    return `
      <section class="state-panel" data-kind="${uiState.reviewMode}" aria-labelledby="state-panel-title" data-action-receipt tabindex="-1" role="${isAlert ? "alert" : "status"}">
        <h3 id="state-panel-title">${labelMap[uiState.reviewMode]}</h3>
        <p>${escapeMarkup(page[uiState.reviewMode])}</p>
        ${uiState.reviewMode === "normal" ? `<p><strong>本次操作：</strong>${escapeMarkup(uiState.actionMessage)}</p>` : ""}
      </section>`;
  }

  function quickLinks(page) {
    const targets = relatedPageIds[page.id] || [endpointDefaults[page.endpoint]];
    return targets.map((id) => buttonForPage(id)).join("");
  }

  function renderPage(page) {
    uiState.currentPage = page;
    uiState.currentEndpoint = page.endpoint;
    inferRoleContext(page);
    setEndpoint(page.endpoint);
    document.title = `${page.name}｜低保真原型`;
    const body = page.level === "B" ? renderFlow(page) : renderStandardPage(page);
    pageView.innerHTML = `
      <header class="page-header">
        <div>
          <p class="eyebrow">${escapeMarkup(page.id)} · ${escapeMarkup(endpointMeta[page.endpoint].label)}</p>
          <h2>${escapeMarkup(page.name)}</h2>
          <div class="route-path">${escapeMarkup(page.route)}</div>
        </div>
        <div class="tag-row">
          <span class="tag">${escapeMarkup(page.stage)}</span>
          <span class="tag">角色：${escapeMarkup(page.role)}</span>
          <span class="tag">模拟数据</span>
        </div>
      </header>
      <section class="review-strip" aria-label="页面状态审查器">
        <p>审查模式：同一页面可直接切换正常、空、错误、权限与终态。</p>
        <div class="state-tabs">${reviewTabs()}</div>
      </section>
      ${statePanel(page)}
      ${body}
      <section class="wire-card wide" aria-labelledby="related-title">
        <h3 id="related-title">内部返回与关联页面</h3>
        <div class="quick-links">${quickLinks(page)}</div>
      </section>`;
    renderRouteList();
    restoreActionFocus();
    announce(`已打开${page.id} ${page.name}`);
  }

  const actionFocusAttributes = Object.freeze([
    "simpleFlow", "bindingAction", "supervisionAction", "deletionAction", "deletionContext", "aiAction", "summaryAction",
    "cultureToggle", "cultureAnchor", "homeSchoolAction", "homeSchoolAdminAction", "contactAction",
    "resourceAction", "sortAction", "reviewMode", "demoAction", "teacherScopeToggle", "teacherSummary",
    "switchTeacher", "aiMode", "aiEnterMode", "flowActor", "resetFlow"
  ]);

  const actionFocusSelectors = Object.freeze({
    simpleFlow: "[data-simple-flow]",
    bindingAction: "[data-binding-action]",
    supervisionAction: "[data-supervision-action]",
    deletionAction: "[data-deletion-action]",
    deletionContext: "[data-deletion-action],[data-deletion-context]",
    aiAction: "[data-ai-action]",
    summaryAction: "[data-summary-action]",
    cultureToggle: "[data-culture-toggle]",
    cultureAnchor: "[data-culture-anchor]",
    homeSchoolAction: "[data-home-school-action]",
    homeSchoolAdminAction: "[data-home-school-admin-action]",
    contactAction: "[data-contact-action]",
    resourceAction: "[data-resource-action]",
    sortAction: "[data-sort-action]",
    reviewMode: "[data-review-mode]",
    demoAction: "[data-demo-action]",
    teacherScopeToggle: "[data-teacher-scope-toggle]",
    teacherSummary: "[data-teacher-summary]",
    switchTeacher: "[data-switch-teacher]",
    aiMode: "[data-ai-mode]",
    aiEnterMode: "[data-ai-enter-mode]"
  });

  function captureActionFocus(button) {
    const key = actionFocusAttributes.find((attribute) => button.dataset[attribute] !== undefined);
    if (!key) return;
    uiState.focusRequest = { key, pageId: uiState.currentPage?.id || null };
  }

  function visibleAction(element) {
    return !element.disabled && !element.hidden && !element.closest("[hidden]");
  }

  function restoreActionFocus() {
    const request = uiState.focusRequest;
    uiState.focusRequest = null;
    if (!request) {
      pageMain.focus({ preventScroll: true });
      return;
    }
    let familySelector = actionFocusSelectors[request.key];
    if (request.key === "flowActor") familySelector = "[data-simple-flow],[data-binding-action]";
    if (request.key === "resetFlow") familySelector = "[data-simple-flow]";
    if (request.key === "aiEnterMode") familySelector = "[data-ai-action],[data-ai-mode]";
    const nextLegalAction = familySelector ? [...pageView.querySelectorAll(familySelector)].find(visibleAction) : null;
    if (nextLegalAction) {
      nextLegalAction.focus({ preventScroll: true });
      return;
    }
    const receipt = pageView.querySelector("[data-action-receipt]");
    if (receipt) {
      receipt.focus({ preventScroll: true });
      return;
    }
    pageMain.focus({ preventScroll: true });
  }

  function renderStandardPage(page) {
    const specialized = specializedControls(page);
    return `
      <div class="content-grid">
        <section class="wire-card">
          <h3>主要区域</h3>
          <ul class="wire-list">${page.regions.map((item) => `<li>${escapeMarkup(item)}</li>`).join("")}</ul>
        </section>
        <section class="wire-card">
          <h3>主要操作</h3>
          <ul class="wire-list">${page.actions.map((item) => `<li>${escapeMarkup(item)}</li>`).join("")}</ul>
        </section>
        ${mergedInformationArchitecture(page)}
        ${specialized || `
          <section class="wire-card wide">
            <h3>离线操作演示</h3>
            <div class="action-row">
              ${page.actions.map((action, index) => `<button type="button" data-demo-action="${index}">${escapeMarkup(action)}</button>`).join("")}
            </div>
          </section>`}
      </div>`;
  }

  function specializedControls(page) {
    const parts = [];
    if (["A-MP-02", "A-WEB-02", "A-ADM-03"].includes(page.id)) parts.push(cultureControls(page));
    if (["A-WEB-01", "A-WEB-02"].includes(page.id)) parts.push(homeSchoolControls(page));
    if (page.id === "A-ADM-04") parts.push(homeSchoolAdminControls(page));
    if (["A-WEB-01", "A-WEB-02"].includes(page.id)) parts.push(contactControls(page));
    if (["A-MP-16", "A-MP-18", "A-WEB-11"].includes(page.id)) parts.push(resourceControls(page));
    if (page.endpoint === "admin" && page.actions.some((action) => action.includes("排序") || action.includes("上移"))) parts.push(sortControls(page));
    return parts.join("");
  }

  function cultureControls(page) {
    const expanded = Boolean(interactionMemory.cultureExpanded[page.id]);
    return `
      <section class="wire-card wide" aria-labelledby="culture-title-${page.id}">
        <h3 id="culture-title-${page.id}">机构介绍专用交互</h3>
        <div class="action-row">
          <button type="button" data-culture-anchor="${page.id}">定位企业文化锚点</button>
          <button type="button" class="button-primary" data-culture-toggle="${page.id}" aria-expanded="${String(expanded)}">${expanded ? "收起" : "展开"}企业文化</button>
        </div>
        <div id="culture-anchor-${page.id}" class="culture-section" ${expanded ? "" : "hidden"}>
          <h3>企业文化</h3>
          <p>独立字段、区块与锚点：尊重、安全、协作（模拟文案）。并入机构介绍不等于删除。</p>
        </div>
      </section>`;
  }

  function homeSchoolControls(page) {
    const expanded = Boolean(interactionMemory.homeSchoolExpanded[page.id]);
    return `
      <section class="wire-card wide" aria-labelledby="home-school-title-${page.id}">
        <h3 id="home-school-title-${page.id}">家校共育独立入口</h3>
        <div class="action-row">
          <button type="button" data-home-school-action="anchor" data-page-id="${page.id}">定位家校共育锚点</button>
          <button type="button" class="button-primary" data-home-school-action="toggle" data-page-id="${page.id}" aria-expanded="${String(expanded)}">${expanded ? "收起" : "展开"}家校共育</button>
        </div>
        <div id="home-school-anchor-${page.id}" class="culture-section" ${expanded ? "" : "hidden"}>
          <h3>家校共育</h3>
          <p>共育理念、家长沟通方式与服务边界均为独立模拟字段；不展示学生信息。</p>
          <button type="button" data-home-school-action="return" data-page-id="${page.id}">返回本页公开导航</button>
        </div>
      </section>`;
  }

  function homeSchoolAdminControls(page) {
    const state = interactionMemory.homeSchoolAdminState;
    return `
      <section class="wire-card wide" aria-labelledby="home-school-admin-title">
        <h3 id="home-school-admin-title">家校共育独立字段与预览</h3>
        <label class="field">
          <span>家校共育内容字段</span>
          <textarea readonly>共育沟通方式与服务边界（模拟内容）</textarea>
        </label>
        <p class="interaction-result"><strong>预览状态：</strong>${escapeMarkup(state)}</p>
        <div class="action-row">
          <button type="button" data-home-school-admin-action="save">保存模拟草稿</button>
          <button type="button" class="button-primary" data-home-school-admin-action="preview">预览独立区块</button>
          <button type="button" data-home-school-admin-action="close">关闭预览并返回列表</button>
        </div>
        ${state === "预览中" ? `<div class="culture-section"><h3>访客端家校共育预览</h3><p>共育理念、沟通方式、服务边界（模拟内容）。保存不等于发布。</p></div>` : ""}
      </section>`;
  }

  function contactControls(page) {
    const state = interactionMemory.contactState[page.id] || "未填写";
    const stateClass = state === "模拟提交失败" ? "is-error" : state === "模拟提交成功" ? "is-success" : "";
    return `
      <section class="wire-card wide" aria-labelledby="contact-title-${page.id}">
        <h3 id="contact-title-${page.id}">网页校区联系与预约模拟意向</h3>
        <div class="field-grid">
          <label class="field"><span>意向类型</span><select><option>了解校区（模拟数据）</option><option>预约参观（模拟数据）</option></select></label>
          <label class="field"><span>校区</span><select><option>示例校区（模拟数据）</option></select></label>
          <label class="field wide"><span>回复方式</span><input readonly value="仅显示站内模拟确认；不填写真实联系方式"></label>
        </div>
        <p class="interaction-result ${stateClass}" role="status"><strong>当前状态：</strong>${escapeMarkup(state)}</p>
        <div class="action-row">
          <button type="button" class="button-primary" data-contact-action="success" data-page-id="${page.id}">模拟提交成功</button>
          <button type="button" data-contact-action="failure" data-page-id="${page.id}">模拟提交失败</button>
          <button type="button" data-contact-action="cancel" data-page-id="${page.id}">取消并返回公开导航</button>
        </div>
      </section>`;
  }

  function resourceControls(page) {
    const state = interactionMemory.resourceState[page.id] || "空查询";
    const stateText = state === "有结果"
      ? "找到2条模拟资源，可进入详情。"
      : state === "无结果"
        ? "无匹配资源；可清除条件。"
        : state === "详情"
          ? "正在同页查看模拟资源详情；原搜索结果保留。"
          : "输入模拟关键词或使用确定性审查按钮。";
    return `
      <section class="wire-card wide" aria-labelledby="resource-title-${page.id}">
        <h3 id="resource-title-${page.id}">教学资源内嵌搜索</h3>
        <label class="field"><span>模拟关键词</span><input value="示例教案（模拟数据）" aria-describedby="resource-help-${page.id}"></label>
        <p id="resource-help-${page.id}" class="interaction-result"><strong>${escapeMarkup(state)}：</strong>${escapeMarkup(stateText)}</p>
        <div class="action-row">
          <button type="button" class="button-primary" data-resource-action="results" data-page-id="${page.id}">搜索示例资源</button>
          <button type="button" data-resource-action="empty" data-page-id="${page.id}">演示无结果</button>
          <button type="button" data-resource-action="clear" data-page-id="${page.id}">清除搜索和筛选</button>
          ${state === "有结果" && page.id === "A-WEB-11" ? `<button type="button" data-resource-action="detail" data-page-id="${page.id}">同页查看模拟资源详情</button>` : ""}
          ${state === "有结果" && page.endpoint === "mini" ? buttonForPage("A-MP-17", "查看模拟资源详情") : ""}
        </div>
        ${state === "详情" && page.id === "A-WEB-11" ? `
          <article class="summary-body" aria-label="同页模拟资源详情">
            <h3>示例教案｜模拟资源详情</h3>
            <p>版本：V0.1模拟；适用范围：示例班级；内容仅为低保真占位，不含真实附件。</p>
            <button type="button" data-resource-action="back" data-page-id="${page.id}">返回搜索结果</button>
          </article>` : ""}
        ${page.id === "A-MP-18" ? `<div class="notice"><p>A-MP-18保留独立逻辑路由，同时属于教学资源整合信息架构。</p></div>` : ""}
      </section>`;
  }

  function sortControls(page) {
    const order = interactionMemory.sortOrders[page.id] || ["条目甲", "条目乙", "条目丙"];
    interactionMemory.sortOrders[page.id] = order;
    const receipts = interactionMemory.auditReceipts[page.id] || [];
    return `
      <section class="wire-card wide" aria-labelledby="sort-title-${page.id}">
        <h3 id="sort-title-${page.id}">后台列表排序与审计</h3>
        <ol class="sort-list">${order.map((item, index) => `<li><span>${index + 1}</span>${escapeMarkup(item)}（模拟数据）</li>`).join("")}</ol>
        <div class="action-row">
          <button type="button" class="button-primary" data-sort-action="down" data-page-id="${page.id}">首项下移</button>
          <button type="button" data-sort-action="up" data-page-id="${page.id}">第二项上移</button>
          <button type="button" data-sort-action="reset" data-page-id="${page.id}">恢复初始顺序</button>
        </div>
        <div class="audit-receipt">
          <h3>新增模拟审计回执</h3>
          ${receipts.length ? `<ul class="wire-list">${receipts.slice(-3).map((receipt) => `<li>${escapeMarkup(receipt)}</li>`).join("")}</ul>` : "<p>尚无排序动作。</p>"}
        </div>
      </section>`;
  }

  function mergedInformationArchitecture(page) {
    const notes = [];
    if (["A-MP-02", "A-WEB-02", "A-ADM-03"].includes(page.id)) {
      notes.push("企业文化在机构资料内保留独立字段、区块与锚点，不被合并描述替代。");
    }
    if (["A-WEB-01", "A-WEB-02", "A-ADM-04"].includes(page.id)) {
      notes.push("家校共育、校区联系与预约意向在网页信息架构中合并呈现，但各有独立入口、字段、状态和验收点。");
    }
    if (["A-MP-16", "A-MP-18", "A-WEB-11", "A-ADM-09"].includes(page.id)) {
      notes.push("资源搜索属于教学资源信息架构；搜索、筛选、无结果、清除与逻辑路由仍独立可验收。");
    }
    if (page.endpoint === "admin" && page.actions.some((action) => action.includes("排序") || action.includes("上移"))) {
      notes.push("排序只作为后台列表操作呈现；保存前后顺序与模拟操作日志可见。单独排序页不进入范围。");
    }
    if (!notes.length) return "";
    return `
      <aside class="wire-card wide notice">
        <h3>合并信息架构保真点</h3>
        ${notes.map((note) => `<p>${escapeMarkup(note)}</p>`).join("")}
      </aside>`;
  }

  function renderFlow(page) {
    let stage;
    if (simpleFlowModels[page.id]) stage = renderSimpleFlow(page, simpleFlowModels[page.id]);
    else if (page.id === "B-FLOW-01") stage = renderGuardianBinding();
    else if (page.id === "B-FLOW-02") stage = renderGuardianHome();
    else if (page.id === "B-FLOW-06") stage = renderTeacherWorkbench();
    else if (page.id === "B-FLOW-10") stage = renderAiLearning();
    else if (page.id === "B-FLOW-11") stage = renderAiTeacherSummary();
    else if (page.id === "B-FLOW-12") stage = renderAiSupervision();
    else stage = `<div class="flow-stage"><p>该流程未配置。</p></div>`;

    return `
      <div class="content-grid">
        <section class="wire-card">
          <h3>主要区域</h3>
          <ul class="wire-list">${page.regions.map((item) => `<li>${escapeMarkup(item)}</li>`).join("")}</ul>
        </section>
        <section class="wire-card">
          <h3>主要操作</h3>
          <ul class="wire-list">${page.actions.map((item) => `<li>${escapeMarkup(item)}</li>`).join("")}</ul>
        </section>
        ${stage}
      </div>`;
  }

  function flowStatus(title, detail, marker) {
    return `
      <div class="flow-status">
        <span class="status-marker" aria-hidden="true">${escapeMarkup(marker || "→")}</span>
        <div><strong>${escapeMarkup(title)}</strong><span>${escapeMarkup(detail)}</span></div>
      </div>`;
  }

  function stepTrack(states, current) {
    const currentIndex = states.indexOf(current);
    return `
      <ol class="step-track" aria-label="流程状态">
        ${states.map((state, index) => {
          const stateClass = index === currentIndex ? "is-current" : index < currentIndex ? "is-done" : "";
          return `<li class="${stateClass}">${escapeMarkup(state)}</li>`;
        }).join("")}
      </ol>`;
  }

  function flowActorSwitcher(pageId) {
    const actors = flowActorOptions[pageId];
    if (!actors) return "";
    const current = flowActorMemory[pageId];
    return `
      <div class="actor-switcher" aria-label="当前模拟身份切换">
        <p><strong>当前模拟身份：</strong>${escapeMarkup(current)}</p>
        <div class="action-row">
          ${actors.map((actor) => `<button type="button" data-flow-actor-page="${pageId}" data-flow-actor="${escapeMarkup(actor)}" aria-pressed="${String(actor === current)}" class="${actor === current ? "button-primary" : ""}">${escapeMarkup(actor)}</button>`).join("")}
        </div>
      </div>`;
  }

  function renderSimpleFlow(page, model) {
    const current = flowMemory[model.key];
    const actor = flowActorMemory[page.id];
    const available = model.transitions.filter((transition) => transition.from.includes(current) && transition.actor === actor);
    return `
      <section class="flow-stage" aria-labelledby="flow-stage-${page.id}">
        <h3 id="flow-stage-${page.id}">可操作状态机</h3>
        ${flowStatus(`当前状态：${current}`, "点击合法动作后立即得到可见确定性结果；状态只存在于本页内存。", page.id.slice(-2))}
        ${flowActorSwitcher(page.id)}
        ${stepTrack(model.states, current)}
        ${page.id === "B-FLOW-04" ? `<div class="notice"><p><strong>当前请假对象：</strong>${escapeMarkup(flowMemory.leaveRequestId)}｜version ${flowMemory.leaveRequestVersion}</p></div>` : ""}
        ${page.id === "B-FLOW-07" && flowMemory.taskCancelRequested ? `<div class="notice"><p>取消请求：已记录，任务仍为进行中；等待负责人按范围决定。</p></div>` : ""}
        <div class="action-row">
          ${available.map((transition, index) => `<button type="button" data-simple-flow="${page.id}" data-transition-index="${model.transitions.indexOf(transition)}" class="${index === 0 ? "button-primary" : ""}">${escapeMarkup(transition.label)}</button>`).join("")}
          ${available.length ? "" : `<span class="role-action-empty">当前身份在此状态没有可执行业务动作；可切换批准身份或返回。</span>`}
          <button type="button" class="button-quiet" data-reset-flow="${page.id}">重置本流程审查</button>
        </div>
        <div class="notice"><p><strong>状态说明：</strong>${escapeMarkup(uiState.actionMessage)}</p></div>
      </section>`;
  }

  function renderGuardianBinding() {
    const binding = flowMemory.binding;
    const current = binding.state;
    const states = ["待提交", "待审核", "已通过", "已拒绝", "已解除"];
    const fieldSteps = ["未开始", "微信登录概念已确认", "手机号占位已填写", "字段已完成"];
    const actor = flowActorMemory["B-FLOW-01"];
    let actions = "";
    if (actor === "申请人" && current === "待提交" && binding.step === "未开始") actions = `<button type="button" class="button-primary" data-binding-action="wechat">1. 确认微信登录概念</button>`;
    else if (actor === "申请人" && current === "待提交" && binding.step === "微信登录概念已确认") actions = `<button type="button" class="button-primary" data-binding-action="phone">2. 填写手机号占位</button>`;
    else if (actor === "申请人" && current === "待提交" && binding.step === "手机号占位已填写") actions = `<button type="button" class="button-primary" data-binding-action="profile">3. 填写邀请码 + 学生姓名 + 班级</button>`;
    else if (actor === "申请人" && current === "待提交" && binding.step === "字段已完成") actions = `<button type="button" class="button-primary" data-binding-action="submit">4. 提交申请</button>`;
    else if (actor === "申请人" && current === "待审核") actions = `<button type="button" data-binding-action="withdraw">申请人撤回至待提交</button>`;
    else if (actor === "机构/校区审核者" && current === "待审核") actions = `
      <button type="button" class="button-primary" data-binding-action="approve">机构/校区授权审核：通过</button>
      <button type="button" data-binding-action="reject">机构/校区授权审核：拒绝</button>`;
    else if (actor === "申请人" && current === "已拒绝" && binding.step !== "通用编辑中") actions = `<button type="button" class="button-primary" data-binding-action="edit">进入通用编辑（四类字段）</button>`;
    else if (actor === "申请人" && current === "已拒绝" && binding.step === "通用编辑中") actions = `<button type="button" class="button-primary" data-binding-action="resubmit">校验修改并重新提交审核</button>`;
    else if (actor === "申请人" && current === "已通过") actions = buttonForPage("B-FLOW-02", "进入家长首页");
    else if (actor === "申请人" && current === "已解除") actions = `<button type="button" class="button-primary" data-binding-action="new">新建申请 / 返回绑定入口</button>`;

    return `
      <section class="flow-stage" aria-labelledby="binding-stage-title">
        <h3 id="binding-stage-title">完整闭环 1 · 家长与学生绑定</h3>
        ${flowStatus(`BindingState：${current}`, binding.note, "1")}
        ${flowActorSwitcher("B-FLOW-01")}
        ${stepTrack(states, current)}
        ${current === "待提交" ? `<div><p><strong>待提交内部字段顺序：</strong>${escapeMarkup(binding.step)}</p>${stepTrack(fieldSteps, binding.step)}</div>` : ""}
        <div class="field-grid" aria-label="全部为模拟输入占位">
          <label class="field"><span>手机号</span><input readonly value="手机号占位（模拟数据）"></label>
          <label class="field"><span>机构邀请码</span><input readonly value="邀请码占位（模拟数据）"></label>
          <label class="field"><span>学生姓名</span><input readonly value="学生甲（模拟数据）"></label>
          <label class="field"><span>班级</span><input readonly value="示例班级（模拟数据）"></label>
        </div>
        <div class="action-row">${actions}</div>
        <div class="notice"><p>锁定顺序：微信登录概念 → 手机号占位 → 邀请码、学生姓名、班级 → 提交 → 按范围审核。无真实微信、短信或后台服务。</p></div>
      </section>`;
  }

  function renderGuardianHome() {
    const linked = flowMemory.binding.state === "已通过";
    if (!linked) {
      return `
        <section class="flow-stage">
          <h3>家长关系守卫</h3>
          ${flowStatus("无已通过关系", "不能显示学生卡片；请完成绑定审核。", "!")}
          <div class="action-row">${buttonForPage("B-FLOW-01", "开始或继续家长绑定")}</div>
        </section>`;
    }
    return `
      <section class="flow-stage" aria-labelledby="guardian-home-title">
        <h3 id="guardian-home-title">已授权家长首页</h3>
        ${flowStatus("关系状态：已通过", "只显示学生甲（模拟数据）与示例班级的授权范围。", "✓")}
        <div class="wire-card">
          <h3>学生甲 · 示例班级</h3>
          <p>模拟数据｜当前关系有效｜不包含真实联系方式、健康、照片或家庭资料。</p>
        </div>
        <div class="action-row">
          ${buttonForPage("B-FLOW-03", "每日托管记录")}
          ${buttonForPage("B-FLOW-04", "请假")}
          ${buttonForPage("B-FLOW-05", "安全接送")}
          ${buttonForPage("B-FLOW-12", "AI监督设置（无摘要正文）")}
          <button type="button" data-binding-action="unbind">家长确认解除关系并查看“已解除”终态</button>
        </div>
      </section>`;
  }

  function renderTeacherWorkbench() {
    const report = flowMemory.dailyReport;
    const task = flowMemory.teacherTask;
    const summary = flowMemory.classSummary;
    return `
      <section class="flow-stage" aria-labelledby="teacher-workbench-title">
        <h3 id="teacher-workbench-title">完整闭环 2 · 教师任务到工作日报</h3>
        ${flowStatus(`工作台：${flowMemory.teacherWorkbench}`, `任务=${task}；班级汇总=${summary}；教师工作日报=${report}`, "2")}
        <div class="content-grid">
          <article class="wire-card"><h3>今日任务</h3><p>${escapeMarkup(task)}</p>${buttonForPage("B-FLOW-07", "进入任务管理")}</article>
          <article class="wire-card"><h3>示例班级汇总</h3><p>${escapeMarkup(summary)}</p>${buttonForPage("B-FLOW-08", "进入班级学生情况")}</article>
          <article class="wire-card"><h3>教师工作日报</h3><p>${escapeMarkup(report)}</p>${buttonForPage("B-FLOW-09", "生成/打开日报")}</article>
          <article class="wire-card"><h3>AI学习与教师摘要</h3><p>${escapeMarkup(flowMemory.aiSummary.state)}</p><div class="action-row"><button type="button" data-ai-enter-mode="teacher">以授权教师监督模式进入学习</button>${buttonForPage("B-FLOW-11", "查看教师摘要")}</div></article>
        </div>
        <div class="notice"><p>教师日报只汇总工作任务与班级必要状态，不是学生托管日报，也不用于自动绩效或纪律结论。</p></div>
      </section>`;
  }

  function renderAiSupervision() {
    const setting = flowMemory.aiSupervision;
    const relationValid = flowMemory.binding.state === "已通过";
    if (!relationValid || setting.institutionSwitch !== "已启用") {
      return `
        <section class="flow-stage">
          <h3>家长AI监督设置守卫</h3>
          ${flowStatus("监督设置保持安全关闭", `家长关系=${flowMemory.binding.state}；机构开关=${setting.institutionSwitch}。`, "!")}
          <ul class="check-list">
            <li>已通过家长关系：${relationValid ? "通过" : "未通过"}</li>
            <li>机构AI开关：${escapeMarkup(setting.institutionSwitch)}</li>
          </ul>
          <div class="action-row">${buttonForPage("B-FLOW-01", "先完成家长与学生绑定")}</div>
          <div class="notice"><p>关系无效或机构关闭时，不得同意、开启、恢复会话或提交删除请求。</p></div>
        </section>`;
    }
    const consentButtons = setting.consent === "未同意"
      ? `<button type="button" class="button-primary" data-supervision-action="consent">监护人同意</button><button type="button" data-supervision-action="refuse">拒绝</button>`
      : setting.consent === "已拒绝"
        ? `<button type="button" data-supervision-action="reconsider">重新审查同意</button>`
        : `<button type="button" data-supervision-action="withdraw">撤回同意并安全关闭</button>`;
    let switchButtons = "";
    if (setting.consent === "已同意" && ["未开启", "已关闭"].includes(setting.switchState)) switchButtons = `<button type="button" class="button-primary" data-supervision-action="enable">开启受监督学习</button>`;
    else if (setting.switchState === "已开启") switchButtons = `<button type="button" data-supervision-action="pause">暂停</button><button type="button" data-supervision-action="close">关闭</button><button type="button" class="button-primary" data-ai-enter-mode="guardian">以家长监督模式进入学习</button>`;
    else if (setting.switchState === "已暂停") switchButtons = `<button type="button" class="button-primary" data-supervision-action="resume">恢复</button><button type="button" data-supervision-action="close">关闭</button>`;
    else switchButtons = `<button type="button" disabled>需先同意才能开启</button>`;

    let deletionButtons = "";
    if (setting.deletionContext === "家长申请人") {
      if (setting.deletion === "未申请") deletionButtons = `<button type="button" data-deletion-action="request">家长提交模拟删除请求</button>`;
      else if (setting.deletion === "已拒绝") deletionButtons = `<button type="button" data-deletion-action="resubmit">家长按原因修改并重提</button>`;
      else deletionButtons = `<button type="button" disabled>家长仅查看处理状态，不能完成或拒绝</button>`;
      deletionButtons += `<button type="button" data-deletion-context="processor">切换到授权处理者模拟上下文</button>`;
    } else {
      if (setting.deletion === "待处理") deletionButtons = `<button type="button" class="button-primary" data-deletion-action="complete">授权处理者：完成</button><button type="button" data-deletion-action="reject">授权处理者：拒绝并给原因</button>`;
      else deletionButtons = `<button type="button" disabled>当前没有可处理的待处理请求</button>`;
      deletionButtons += `<button type="button" data-deletion-context="guardian">返回家长申请人模拟上下文</button>`;
    }

    return `
      <section class="flow-stage" aria-labelledby="supervision-title">
        <h3 id="supervision-title">完整闭环 3 · 起点：家长AI监督设置</h3>
        ${flowStatus(`同意=${setting.consent}｜监督=${setting.switchState}`, "家长仅见监督、会话与安全状态；看不到AI学习摘要正文。", "3")}
        <div class="wire-card">
          <h3>监护同意与机构开关</h3>
          <p>学生甲／示例班级（模拟数据）。家长关系：${escapeMarkup(flowMemory.binding.state)}；机构开关：${escapeMarkup(setting.institutionSwitch)}。学生无独立账号或角色。</p>
          <div class="action-row">${consentButtons}</div>
        </div>
        <div class="wire-card">
          <h3>受监督学习开关</h3>
          <div class="action-row">${switchButtons}</div>
        </div>
        <div class="wire-card">
          <h3>独立AI数据删除请求</h3>
          <p><strong>当前模拟角色：</strong>${escapeMarkup(setting.deletionContext)}</p>
          <p><strong>状态：</strong>${escapeMarkup(setting.deletion)}。${escapeMarkup(setting.deletionNote)}</p>
          <div class="action-row">${deletionButtons}</div>
        </div>
        <div class="notice"><p>监督开关和删除请求是两个正交状态机；暂停、关闭或撤回同意会禁止新会话与继续提示。</p></div>
      </section>`;
  }

  function aiGuardReport(mode) {
    const setting = flowMemory.aiSupervision;
    const checks = [
      { label: "明确家长或教师监督模式", pass: ["家长监督", "教师监督"].includes(mode) },
      { label: "有效监护同意", pass: setting.consent === "已同意" },
      { label: "家长监督开关", pass: setting.switchState === "已开启" },
      { label: "机构AI开关", pass: setting.institutionSwitch === "已启用" }
    ];
    if (mode === "家长监督") checks.push({ label: "已通过家长关系", pass: flowMemory.binding.state === "已通过" });
    if (mode === "教师监督") checks.push({ label: "授权教师/班级scope", pass: setting.teacherScope === "授权班级有效" });
    return { checks, pass: checks.every((check) => check.pass) };
  }

  function rejectAiStart(guard) {
    const failed = guard.checks.filter((check) => !check.pass).map((check) => check.label).join("、") || "启动条件不完整";
    flowMemory.ai.note = `启动已拒绝：${failed}。未创建学习会话；请返回B12监督设置。`;
    uiState.actionMessage = flowMemory.ai.note;
  }

  function renderAiLearning() {
    const setting = flowMemory.aiSupervision;
    const ai = flowMemory.ai;
    const mode = ai.supervisorMode;
    const modeButtons = `
      <button type="button" class="${mode === "家长监督" ? "button-primary" : ""}" data-ai-mode="guardian">家长监督模式</button>
      <button type="button" class="${mode === "教师监督" ? "button-primary" : ""}" data-ai-mode="teacher">教师监督模式</button>`;
    if (mode === "未选择") {
      return `
        <section class="flow-stage">
          <h3>选择受监督模拟上下文</h3>
          ${flowStatus("当前监督者：未选择", "不能固定推断家长；必须明确选择家长或授权教师。", "?")}
          <div class="action-row">${modeButtons}</div>
          <div class="action-row">${buttonForPage("B-FLOW-12", "返回家长AI监督设置")}${buttonForPage("B-FLOW-06", "返回教师工作台")}</div>
        </section>`;
    }

    const guard = aiGuardReport(mode);
    const supervisor = mode === "家长监督" ? "家长监督者／学生甲关系（模拟）" : "授权教师／示例班级scope（模拟）";
    if (!guard.pass) {
      const failed = guard.checks.filter((check) => !check.pass).map((check) => check.label).join("、") || "启动条件不完整";
      const rejectionNote = `启动已拒绝：${failed}。未创建学习会话；请返回B12监督设置。`;
      return `
        <section class="flow-stage">
          <h3>AI会话启动守卫</h3>
          ${flowStatus("启动已拒绝，AIStudyState保持原状态", `${rejectionNote} 当前监督者：${supervisor}`, "!")}
          <ul class="check-list">${guard.checks.map((check) => `<li class="${check.pass ? "check-pass" : "check-fail"}">${escapeMarkup(check.label)}：${check.pass ? "通过" : "未通过"}</li>`).join("")}</ul>
          <div class="action-row">${buttonForPage("B-FLOW-12", "返回B12监督设置")}</div>
        </section>`;
    }

    const states = ["未开始", "学生首次尝试待提交", "第0层", "第1层", "第1层重答", "第2层", "第2层重答", "第3层", "巩固1", "巩固2", "巩固3", "已完成"];
    const actionHtml = aiActions(ai.step);
    const active = ai.state === "引导中";
    return `
      <section class="flow-stage" aria-labelledby="ai-learning-title">
        <h3 id="ai-learning-title">小学作业引导 + 错题巩固（模拟）</h3>
        ${flowStatus(`AIStudyState：${ai.state}｜步骤：${ai.step}`, `当前监督者：${supervisor}。${ai.note}`, "AI")}
        <div class="action-row">${modeButtons}${mode === "教师监督" ? `<button type="button" data-teacher-scope-toggle>审查教师scope有效/失效</button>` : ""}</div>
        ${stepTrack(states, ai.step)}
        <div class="wire-card">
          <h3>模拟题目</h3>
          <p>“一盒彩笔有6支，2盒共有多少支？”仅用于演示提示顺序，不连接正式模型。</p>
        </div>
        <div class="action-row">${actionHtml}</div>
        ${active ? `
          <div class="action-row" aria-label="安全与降级操作">
            <button type="button" data-ai-action="safety">安全拦截 → 转教师</button>
            <button type="button" data-ai-action="unavailable">模拟服务不可用 → 转教师</button>
            <button type="button" data-ai-action="close">监督者关闭会话</button>
          </div>` : ""}
        ${["已完成", "需教师介入"].includes(ai.state) ? `
          <div class="notice">
            <p>${mode === "家长监督" ? "家长端只显示状态，不显示摘要正文。" : "授权教师可进入教师专属摘要页。"} 当前为“${escapeMarkup(ai.state)}／摘要已回流授权教师”。</p>
            <div class="action-row">
              ${buttonForPage("B-FLOW-12", "家长返回监督设置")}
              <button type="button" data-teacher-summary>切换为授权教师并查看摘要</button>
            </div>
          </div>` : ""}
        ${ai.state === "已关闭" ? `<div class="action-row">${buttonForPage("B-FLOW-12", "返回监督设置")}</div>` : ""}
        <div class="notice"><p>固定顺序：学生先尝试 → 第0层已知/目标/尝试 → 第1层方向 → 第2层关键步骤 → 必要时第3层完整过程 → 巩固1—3题。</p></div>
      </section>`;
  }

  function aiActions(state) {
    const actions = {
      "未开始": `<button type="button" class="button-primary" data-ai-action="start">由监督者开启会话</button>`,
      "学生首次尝试待提交": `<button type="button" class="button-primary" data-ai-action="attempt">学生提交自己的首次尝试</button>`,
      "第0层": `<button type="button" class="button-primary" data-ai-action="level1">确认已知条件、目标、尝试 → 第1层</button>`,
      "第1层": `<button type="button" class="button-primary" data-ai-action="retry1">学生根据知识点/方向重新作答</button>`,
      "第1层重答": `<button type="button" class="button-primary" data-ai-action="understood1">已理解 → 巩固1</button><button type="button" data-ai-action="level2">仍需帮助 → 第2层</button>`,
      "第2层": `<button type="button" class="button-primary" data-ai-action="retry2">学生根据关键步骤重新作答</button>`,
      "第2层重答": `<button type="button" class="button-primary" data-ai-action="understood2">已理解 → 巩固1</button><button type="button" data-ai-action="level3">仍需且安全 → 第3层</button>`,
      "第3层": `<button type="button" class="button-primary" data-ai-action="consolidation1">理解完整过程 → 巩固1</button>`,
      "巩固1": `<button type="button" class="button-primary" data-ai-action="consolidation2">提交巩固题1 → 巩固2</button>`,
      "巩固2": `<button type="button" class="button-primary" data-ai-action="consolidation3">提交巩固题2 → 巩固3</button>`,
      "巩固3": `<button type="button" class="button-primary" data-ai-action="finish">提交巩固题3并完成</button>`,
      "已完成": `<button type="button" data-ai-action="restart">开始新的模拟会话</button>`,
      "需教师介入": `<button type="button" data-teacher-summary>切换为授权教师并查看摘要</button>`,
      "已关闭": `<button type="button" data-ai-action="restart">在监督仍开启时重新开始</button>`
    };
    return actions[state] || "";
  }

  function renderAiTeacherSummary() {
    const isTeacherRole = uiState.roleContext.includes("授权教师");
    const teacherScopeValid = flowMemory.aiSupervision.teacherScope === "授权班级有效";
    const canReadSummary = isTeacherRole && teacherScopeValid;
    const summary = flowMemory.aiSummary;
    if (!canReadSummary) {
      return `
        <section class="flow-stage">
          <h3>教师摘要正文守卫</h3>
          <div class="locked-panel">
            <p><strong>正文已隐藏。</strong></p>
            <p>角色守卫：${isTeacherRole ? "授权教师" : "未通过"}；班级scope守卫：${teacherScopeValid ? "有效" : "失效"}。</p>
            <p>只有授权教师且teacherScope为“授权班级有效”同时成立时可见；家长、学生、工作人员和管理角色均不得查看正文。</p>
          </div>
          <div class="action-row">
            <button type="button" data-switch-teacher>切换为授权教师模拟审查上下文</button>
            <button type="button" data-teacher-scope-toggle>审查教师scope有效/失效</button>
            ${buttonForPage("B-FLOW-12", "家长返回监督设置")}
          </div>
        </section>`;
    }

    if (summary.state === "暂无摘要") {
      return `
        <section class="flow-stage">
          <h3>教师摘要队列</h3>
          ${flowStatus("暂无摘要", "可先完成AI受监督学习，或返回教师工作台。", "0")}
          <div class="action-row">${buttonForPage("B-FLOW-06", "返回教师工作台")}${buttonForPage("B-FLOW-12", "从监督设置开始AI闭环")}</div>
        </section>`;
    }

    const bodyVisible = ["待教师查看", "已阅", "需介入", "已处理"].includes(summary.state);
    let actions = "";
    if (summary.state === "待教师查看") actions = `<button type="button" class="button-primary" data-summary-action="read">确认已阅</button><button type="button" data-summary-action="intervene">进入人工介入</button>`;
    else if (summary.state === "已阅") actions = `<button type="button" data-summary-action="intervene">需要时进入人工介入</button>${buttonForPage("B-FLOW-06", "关闭摘要并返回工作台")}`;
    else if (summary.state === "需介入") actions = `<button type="button" class="button-primary" data-summary-action="resolve">教师记录已处理</button>`;
    else actions = buttonForPage("B-FLOW-06", "返回教师工作台");

    return `
      <section class="flow-stage" aria-labelledby="teacher-summary-title">
        <h3 id="teacher-summary-title">授权教师专属摘要</h3>
        ${flowStatus(`摘要状态：${summary.state}`, `来源：${summary.source}`, "T")}
        ${bodyVisible ? `
          <div class="summary-body">
            <p><strong>以下仅在授权教师模拟上下文显示</strong></p>
            ${summary.source.includes("无学习正文") ? `
              <ul class="wire-list">
                <li>启动守卫未通过；未创建题目、尝试、提示或巩固正文。</li>
                <li>安全标记：需要授权教师核对同意、开关或范围状态。</li>
                <li>介入建议：仅修复授权条件，不推断学生能力。</li>
              </ul>` : `
              <ul class="wire-list">
                <li>对象：学生甲／示例班级（模拟数据）</li>
                <li>尝试次数：模拟3次</li>
                <li>提示层：第0、1、2层${flowMemory.ai.usedLayer3 ? "、必要时第3层" : "；未使用第3层"}</li>
                <li>巩固结果：3道模拟题已完成</li>
                <li>安全标记：${summary.source.includes("拦截") || summary.source.includes("不可用") ? "需要人工核对" : "无新增标记"}</li>
                <li>介入建议：教师人工查看过程状态，不生成能力、情绪、纪律或绩效结论。</li>
              </ul>`}
          </div>` : ""}
        <button type="button" data-teacher-scope-toggle>模拟teacherScope失效并立即锁定正文</button>
        <div class="action-row">${actions}</div>
      </section>`;
  }

  function renderCurrentRoute() {
    const route = decodeURIComponent(window.location.hash.slice(1));
    if (!route) {
      renderIndex();
      return;
    }
    const page = pageByRoute.get(route);
    if (!page) {
      uiState.currentPage = null;
      setEndpoint("index");
      pageView.innerHTML = `
        <section class="state-panel" data-kind="error">
          <h2>内部路由不存在</h2>
          <p>该路径不属于批准的47个A级或12个B级页面；未发起任何外部导航。</p>
          <button type="button" data-clear-route>返回统一入口</button>
        </section>`;
      return;
    }
    renderPage(page);
  }

  function rerenderPage() {
    if (uiState.currentPage) renderPage(uiState.currentPage);
  }

  function handleFlowActor(pageId, actor) {
    const allowed = flowActorOptions[pageId] || [];
    if (!uiState.currentPage || uiState.currentPage.id !== pageId || !allowed.includes(actor)) {
      uiState.actionMessage = "模拟身份切换已拒绝：身份或页面不在批准范围。";
      rerenderPage();
      return;
    }
    flowActorMemory[pageId] = actor;
    setRoleContext(`${actor}（当前模拟身份）`);
    uiState.actionMessage = `当前模拟身份已切换为${actor}；仅显示该身份的合法动作。`;
    rerenderPage();
  }

  function handleSimpleFlow(button) {
    const pageId = button.dataset.simpleFlow;
    const model = simpleFlowModels[pageId];
    if (!model || !uiState.currentPage || uiState.currentPage.id !== pageId) {
      uiState.actionMessage = "状态动作已拒绝：目标流程不是当前批准页面。";
      rerenderPage();
      return;
    }
    const transition = model.transitions[Number(button.dataset.transitionIndex)];
    const current = flowMemory[model.key];
    const actor = flowActorMemory[pageId];
    if (!transition || !transition.from.includes(current) || transition.actor !== actor) {
      uiState.actionMessage = `动作已拒绝：当前模拟身份“${actor}”无权执行该状态动作。`;
      rerenderPage();
      return;
    }
    flowMemory[model.key] = transition.to;
    if (transition.effect === "requestCancel") flowMemory.taskCancelRequested = true;
    if (transition.effect === "newLeaveRequest") {
      flowMemory.leaveRequestVersion += 1;
      flowMemory.leaveRequestId = `LEAVE-${String(flowMemory.leaveRequestVersion).padStart(3, "0")}`;
    }
    if (pageId === "B-FLOW-07" && transition.to === "已取消") flowMemory.taskCancelRequested = false;
    uiState.actionMessage = transition.note;
    if (pageId === "B-FLOW-09" && transition.to === "已确认") {
      flowMemory.teacherWorkbench = "日报已确认，待办摘要已更新";
    }
    if (transition.go) navigateToPageId(transition.go);
    else rerenderPage();
  }

  function resetSimpleFlow(pageId) {
    const model = simpleFlowModels[pageId];
    if (!model || !uiState.currentPage || uiState.currentPage.id !== pageId) {
      uiState.actionMessage = "重置动作已拒绝：目标流程不是当前批准页面。";
      rerenderPage();
      return;
    }
    flowMemory[model.key] = model.initial;
    flowActorMemory[pageId] = flowActorOptions[pageId][0];
    if (pageId === "B-FLOW-07") flowMemory.taskCancelRequested = false;
    if (pageId === "B-FLOW-04") {
      flowMemory.leaveRequestId = "LEAVE-001";
      flowMemory.leaveRequestVersion = 1;
    }
    uiState.actionMessage = `${pageFor(pageId).name}已重置到${model.initial}。`;
    rerenderPage();
  }

  function handleBinding(action) {
    const binding = flowMemory.binding;
    if (action === "unbind") {
      if (!uiState.currentPage || uiState.currentPage.id !== "B-FLOW-02" || uiState.roleContext !== "家长（模拟审查）" || binding.state !== "已通过" || binding.step !== "字段已完成") {
        uiState.actionMessage = "解除动作已拒绝：仅有效关系内的家长首页可执行。";
        rerenderPage();
        return;
      }
      flowMemory.binding = { state: "已解除", step: "未开始", note: "关系已模拟解除；该终态保持可见，学生内容访问立即关闭。" };
      flowMemory.aiSupervision.consent = "未同意";
      flowMemory.aiSupervision.switchState = "已关闭";
      flowMemory.ai.state = "已关闭";
      flowMemory.ai.step = "已关闭";
      uiState.actionMessage = flowMemory.binding.note;
      navigateToPageId("B-FLOW-01", "访客");
      return;
    }
    const actorByAction = {
      wechat: "申请人",
      phone: "申请人",
      profile: "申请人",
      submit: "申请人",
      withdraw: "申请人",
      edit: "申请人",
      resubmit: "申请人",
      new: "申请人",
      approve: "机构/校区审核者",
      reject: "机构/校区审核者"
    };
    const actor = flowActorMemory["B-FLOW-01"];
    if (!uiState.currentPage || uiState.currentPage.id !== "B-FLOW-01" || actorByAction[action] !== actor) {
      uiState.actionMessage = `绑定动作已拒绝：当前模拟身份“${actor}”无权执行该动作。`;
      rerenderPage();
      return;
    }
    if (action === "wechat" && binding.state === "待提交" && binding.step === "未开始") {
      binding.step = "微信登录概念已确认";
      binding.note = "只确认登录概念；没有真实微信授权。";
    } else if (action === "phone" && binding.state === "待提交" && binding.step === "微信登录概念已确认") {
      binding.step = "手机号占位已填写";
      binding.note = "手机号仅为文字占位，不包含真实号码。";
    } else if (action === "profile" && binding.state === "待提交" && binding.step === "手机号占位已填写") {
      binding.step = "字段已完成";
      binding.note = "邀请码、学生甲和示例班级均为模拟数据。";
    } else if (action === "submit" && binding.state === "待提交" && binding.step === "字段已完成") {
      binding.state = "待审核";
      binding.note = "申请已进入模拟待审核状态。";
    } else if (action === "approve" && binding.state === "待审核" && binding.step === "字段已完成") {
      binding.state = "已通过";
      binding.note = "授权审核者在机构/校区范围内模拟通过。";
    } else if (action === "reject" && binding.state === "待审核" && binding.step === "字段已完成") {
      binding.state = "已拒绝";
      binding.step = "字段已完成";
      binding.note = "显示一般拒绝原因，可进入通用编辑。";
    } else if (action === "withdraw" && binding.state === "待审核" && binding.step === "字段已完成") {
      binding.state = "待提交";
      binding.step = "字段已完成";
      binding.note = "申请人已撤回；返回待提交，可编辑或再次提交。";
    } else if (action === "edit" && binding.state === "已拒绝") {
      binding.step = "通用编辑中";
      binding.note = "可修改手机号占位、邀请码、学生姓名或班级。";
    } else if (action === "resubmit" && binding.state === "已拒绝" && binding.step === "通用编辑中") {
      binding.state = "待审核";
      binding.step = "字段已完成";
      binding.note = "修改已重新校验并提交，进入新的待审核状态。";
    } else if (action === "new" && binding.state === "已解除") {
      binding.state = "待提交";
      binding.step = "未开始";
      binding.note = "新申请已创建，从锁定顺序重新开始。";
    } else {
      uiState.actionMessage = "绑定动作因当前状态不匹配而拒绝。";
      rerenderPage();
      return;
    }
    uiState.actionMessage = binding.note;
    rerenderPage();
  }

  function handleSupervision(action) {
    const setting = flowMemory.aiSupervision;
    if (!uiState.currentPage || uiState.currentPage.id !== "B-FLOW-12" || uiState.roleContext !== "家长（模拟审查）") {
      uiState.actionMessage = "监督动作已拒绝：仅B-FLOW-12家长模拟上下文可执行。";
      rerenderPage();
      return;
    }
    const allowedFrom = {
      consent: setting.consent === "未同意" && ["未开启", "已关闭"].includes(setting.switchState),
      refuse: setting.consent === "未同意" && ["未开启", "已关闭"].includes(setting.switchState),
      reconsider: setting.consent === "已拒绝" && ["未开启", "已关闭"].includes(setting.switchState),
      withdraw: setting.consent === "已同意",
      enable: setting.consent === "已同意" && ["未开启", "已关闭"].includes(setting.switchState),
      pause: setting.consent === "已同意" && setting.switchState === "已开启",
      resume: setting.consent === "已同意" && setting.switchState === "已暂停",
      close: setting.consent === "已同意" && ["已开启", "已暂停"].includes(setting.switchState)
    };
    const prerequisitesPass = flowMemory.binding.state === "已通过" && setting.institutionSwitch === "已启用";
    if (!prerequisitesPass) {
      uiState.actionMessage = "监督动作已拒绝：需已通过家长关系与已启用机构开关。";
      setting.switchState = "已关闭";
      flowMemory.ai.state = "已关闭";
      flowMemory.ai.step = "已关闭";
      rerenderPage();
      return;
    }
    if (!allowedFrom[action]) {
      uiState.actionMessage = "监督动作因当前同意/开关状态不匹配而拒绝。";
      rerenderPage();
      return;
    }
    const messages = {
      consent: "监护同意已模拟记录；学生仍无独立账号。",
      refuse: "监护人已拒绝；AI会话不能开启。",
      reconsider: "已返回未同意状态，可重新审查。",
      withdraw: "同意已撤回；活动会话已安全关闭。",
      enable: "监督开关已开启；现在可进入受监督会话。",
      pause: "监督已暂停；活动会话已关闭，不能继续写入。",
      resume: "监督已恢复；可重新开启模拟会话。",
      close: "监督已关闭；活动会话已安全关闭。"
    };
    if (action === "consent") setting.consent = "已同意";
    else if (action === "refuse") setting.consent = "已拒绝";
    else if (action === "reconsider") setting.consent = "未同意";
    else if (action === "withdraw") {
      setting.consent = "未同意";
      setting.switchState = "已关闭";
      flowMemory.ai.state = "已关闭";
      flowMemory.ai.step = "已关闭";
    } else if (action === "enable" || action === "resume") setting.switchState = "已开启";
    else if (action === "pause") {
      setting.switchState = "已暂停";
      flowMemory.ai.state = "已关闭";
      flowMemory.ai.step = "已关闭";
    } else if (action === "close") {
      setting.switchState = "已关闭";
      flowMemory.ai.state = "已关闭";
      flowMemory.ai.step = "已关闭";
    }
    uiState.actionMessage = messages[action] || "监督状态未变化。";
    rerenderPage();
  }

  function handleDeletion(action) {
    const setting = flowMemory.aiSupervision;
    const isGuardian = setting.deletionContext === "家长申请人";
    const isProcessor = setting.deletionContext === "授权处理者（机构管理员/校区负责人）";
    const relationValid = flowMemory.binding.state === "已通过";
    if (!uiState.currentPage || uiState.currentPage.id !== "B-FLOW-12" || uiState.roleContext !== "家长（模拟审查）" || !relationValid || setting.institutionSwitch !== "已启用") {
      uiState.actionMessage = "删除请求动作已拒绝：仅B-FLOW-12有效关系模拟上下文可执行。";
      rerenderPage();
      return;
    }
    if ((action === "request" || action === "resubmit") && (!isGuardian || !relationValid)) {
      uiState.actionMessage = "删除请求动作已拒绝：仅有效关系内的家长申请人可提交或重提。";
      rerenderPage();
      return;
    }
    if ((action === "complete" || action === "reject") && !isProcessor) {
      uiState.actionMessage = "删除处理动作已拒绝：家长不能完成或拒绝自己的请求。";
      rerenderPage();
      return;
    }
    if (action === "request" && setting.deletion === "未申请") {
      setting.deletion = "待处理";
      setting.deletionNote = "请求已创建并立即显示待处理；监督开关未被改变。";
    } else if (action === "complete" && setting.deletion === "待处理") {
      setting.deletion = "已完成";
      setting.deletionNote = "显示最小模拟处理结果；未操作任何真实数据。";
    } else if (action === "reject" && setting.deletion === "待处理") {
      setting.deletion = "已拒绝";
      setting.deletionNote = "一般原因：范围需重新选择；可返回设置修改重提。";
    } else if (action === "resubmit" && setting.deletion === "已拒绝") {
      setting.deletion = "待处理";
      setting.deletionNote = "已按一般原因修改范围并重提。";
    } else {
      uiState.actionMessage = "删除请求动作因当前状态不匹配而拒绝。";
      rerenderPage();
      return;
    }
    uiState.actionMessage = setting.deletionNote;
    rerenderPage();
  }

  function handleAi(action) {
    const ai = flowMemory.ai;
    const roleAllowed = ai.supervisorMode === "家长监督"
      ? uiState.roleContext === "家长监督者（模拟审查）"
      : ai.supervisorMode === "教师监督" && uiState.roleContext === "授权教师监督者（模拟审查）";
    if (!uiState.currentPage || uiState.currentPage.id !== "B-FLOW-10" || !roleAllowed) {
      uiState.actionMessage = "AI动作已拒绝：仅B-FLOW-10当前监督者模拟上下文可执行。";
      rerenderPage();
      return;
    }
    const guard = aiGuardReport(ai.supervisorMode);
    if (!guard.pass) {
      rejectAiStart(guard);
      rerenderPage();
      return;
    }
    const transitions = {
      start: ["学生首次尝试待提交", "会话已由监督者开启；必须先由学生提交自己的尝试。"],
      attempt: ["第0层", "第0层确认已知条件、目标和学生自己的尝试。"],
      level1: ["第1层", "第1层只给知识点、公式名称或观察方向。"],
      retry1: ["第1层重答", "学生已根据第1层方向重新作答。"],
      understood1: ["巩固1", "学生已理解，跳过更高提示层并进入第1道巩固题。"],
      level2: ["第2层", "第2层拆解一个关键步骤，不直接给最终答案。"],
      retry2: ["第2层重答", "学生已根据第2层关键步骤重新作答。"],
      understood2: ["巩固1", "学生已理解，直接进入第1道巩固题。"],
      level3: ["第3层", "仅因仍需帮助且安全，进入必要时完整过程讲解。"],
      consolidation1: ["巩固1", "进入第1道同类模拟巩固题。"],
      consolidation2: ["巩固2", "第1道巩固题已提交，进入第2道。"],
      consolidation3: ["巩固3", "第2道巩固题已提交，进入第3道。"],
      restart: ["学生首次尝试待提交", "新会话已开启；仍需学生先尝试。"]
    };

    const linearFrom = {
      start: "未开始",
      attempt: "学生首次尝试待提交",
      level1: "第0层",
      retry1: "第1层",
      understood1: "第1层重答",
      level2: "第1层重答",
      retry2: "第2层",
      understood2: "第2层重答",
      level3: "第2层重答",
      consolidation1: "第3层",
      consolidation2: "巩固1",
      consolidation3: "巩固2",
      finish: "巩固3",
      restart: ["已完成", "已关闭"]
    };
    const sourceStep = linearFrom[action];
    const linearStepAllowed = sourceStep !== undefined && (Array.isArray(sourceStep) ? sourceStep.includes(ai.step) : sourceStep === ai.step);
    const linearStateAllowed = action === "start"
      ? ai.state === "未开始"
      : action === "restart"
        ? ai.state === ai.step && ["已完成", "已关闭"].includes(ai.state)
        : ai.state === "引导中";
    const activeSteps = ["学生首次尝试待提交", "第0层", "第1层", "第1层重答", "第2层", "第2层重答", "第3层", "巩固1", "巩固2", "巩固3"];
    const safetyActionAllowed = ["safety", "unavailable", "close"].includes(action) && ai.state === "引导中" && activeSteps.includes(ai.step);
    if (!safetyActionAllowed && !(linearStepAllowed && linearStateAllowed)) {
      uiState.actionMessage = "AI动作因当前学习步骤不匹配而拒绝。";
      rerenderPage();
      return;
    }

    if (action === "finish") {
      ai.state = "已完成";
      ai.step = "已完成";
      ai.note = "3道巩固题已完成；家长只见状态，摘要正文已排入教师队列。";
      flowMemory.aiSummary = { state: "待教师查看", source: "模拟学习完成" };
    } else if (action === "safety" || action === "unavailable") {
      ai.state = "需教师介入";
      ai.step = "需教师介入";
      ai.note = action === "safety" ? "安全守卫已拦截，未继续生成提示。" : "模拟服务不可用，已执行安全降级。";
      flowMemory.aiSummary = { state: "待教师查看", source: action === "safety" ? "安全拦截" : "模拟服务不可用" };
    } else if (action === "close") {
      ai.state = "已关闭";
      ai.step = "已关闭";
      ai.note = "监督者已关闭会话；没有继续提示或写入。";
    } else if (transitions[action]) {
      ai.state = "引导中";
      ai.step = transitions[action][0];
      ai.note = transitions[action][1];
      if (action === "level3") ai.usedLayer3 = true;
      if (action === "restart") {
        ai.usedLayer3 = false;
        flowMemory.aiSummary = { state: "暂无摘要", source: "无" };
      }
    }
    uiState.actionMessage = ai.note;
    rerenderPage();
  }

  function selectAiMode(mode) {
    const nextMode = mode === "teacher" ? "教师监督" : "家长监督";
    if (flowMemory.ai.state === "引导中") {
      flowMemory.ai.state = "已关闭";
      flowMemory.ai.step = "已关闭";
      flowMemory.ai.note = "切换监督者前已安全关闭原会话。";
    } else {
      flowMemory.ai.state = "未开始";
      flowMemory.ai.step = "未开始";
      flowMemory.ai.note = `已选择${nextMode}，等待守卫检查后开启。`;
    }
    flowMemory.ai.supervisorMode = nextMode;
    setRoleContext(nextMode === "教师监督" ? "授权教师监督者（模拟审查）" : "家长监督者（模拟审查）");
  }

  function toggleTeacherScope() {
    const sourceAllowed = uiState.currentPage && (uiState.currentPage.id === "B-FLOW-11"
      || (uiState.currentPage.id === "B-FLOW-10" && flowMemory.ai.supervisorMode === "教师监督" && uiState.roleContext === "授权教师监督者（模拟审查）"));
    if (!sourceAllowed) {
      uiState.actionMessage = "教师scope动作已拒绝：仅B-FLOW-10/11授权教师模拟上下文可执行。";
      rerenderPage();
      return;
    }
    const setting = flowMemory.aiSupervision;
    setting.teacherScope = setting.teacherScope === "授权班级有效" ? "教师scope失效" : "授权班级有效";
    if (setting.teacherScope !== "授权班级有效" && ["引导中", "需教师介入"].includes(flowMemory.ai.state)) {
      flowMemory.ai.state = "已关闭";
      flowMemory.ai.step = "已关闭";
      flowMemory.ai.note = "教师scope失效；活动会话已安全关闭。";
    }
    uiState.actionMessage = `教师监督范围：${setting.teacherScope}。`;
    rerenderPage();
  }

  function activateTeacherSummary(navigate) {
    const sourceAllowed = navigate
      ? uiState.currentPage && uiState.currentPage.id === "B-FLOW-10" && ["已完成", "需教师介入"].includes(flowMemory.ai.state) && flowMemory.aiSummary.state !== "暂无摘要"
      : uiState.currentPage && uiState.currentPage.id === "B-FLOW-11";
    if (!sourceAllowed) {
      uiState.actionMessage = "教师摘要入口已拒绝：来源页面或摘要状态不匹配。";
      rerenderPage();
      return;
    }
    setRoleContext("授权教师（模拟审查）");
    const allowed = flowMemory.aiSupervision.teacherScope === "授权班级有效";
    uiState.actionMessage = allowed
      ? "角色与teacherScope守卫均通过，可查看授权教师摘要。"
      : "角色已切换，但teacherScope失效；摘要正文保持锁定。";
    if (navigate) navigateToPageId("B-FLOW-11");
    else rerenderPage();
  }

  function handleCulture(pageId, anchorOnly) {
    interactionMemory.cultureExpanded[pageId] = anchorOnly ? true : !Boolean(interactionMemory.cultureExpanded[pageId]);
    uiState.actionMessage = anchorOnly
      ? "已定位企业文化独立锚点。"
      : interactionMemory.cultureExpanded[pageId]
        ? "企业文化独立区块已展开。"
        : "企业文化独立区块已收起，锚点仍保留。";
    rerenderPage();
    if (anchorOnly) window.setTimeout(() => document.getElementById(`culture-anchor-${pageId}`)?.scrollIntoView({ block: "center" }), 20);
  }

  function handleContact(pageId, action) {
    const states = { success: "模拟提交成功", failure: "模拟提交失败", cancel: "已取消" };
    interactionMemory.contactState[pageId] = states[action];
    uiState.actionMessage = action === "success"
      ? "最小模拟意向已在内存确认；无外部请求。"
      : action === "failure"
        ? "模拟失败已显示；非敏感选择保留，可重试。"
        : "预约模拟意向已取消并返回公开导航状态。";
    rerenderPage();
  }

  function handleHomeSchool(pageId, action) {
    if (action === "anchor") interactionMemory.homeSchoolExpanded[pageId] = true;
    else if (action === "toggle") interactionMemory.homeSchoolExpanded[pageId] = !Boolean(interactionMemory.homeSchoolExpanded[pageId]);
    else interactionMemory.homeSchoolExpanded[pageId] = false;
    uiState.actionMessage = action === "anchor"
      ? "已定位家校共育独立锚点。"
      : action === "return"
        ? "已返回本页公开导航，家校共育入口仍可见。"
        : interactionMemory.homeSchoolExpanded[pageId]
          ? "家校共育独立区块已展开。"
          : "家校共育独立区块已收起。";
    rerenderPage();
    if (action === "anchor") window.setTimeout(() => document.getElementById(`home-school-anchor-${pageId}`)?.scrollIntoView({ block: "center" }), 20);
  }

  function handleHomeSchoolAdmin(action) {
    interactionMemory.homeSchoolAdminState = action === "save" ? "模拟草稿已保存" : action === "preview" ? "预览中" : "预览已关闭";
    uiState.actionMessage = action === "save"
      ? "家校共育独立字段已保存为模拟草稿；未发布。"
      : action === "preview"
        ? "正在预览家校共育独立区块。"
        : "预览已关闭并返回后台列表状态。";
    rerenderPage();
  }

  function handleResource(pageId, action) {
    interactionMemory.resourceState[pageId] = action === "results"
      ? "有结果"
      : action === "empty"
        ? "无结果"
        : action === "detail"
          ? "详情"
          : action === "back"
            ? "有结果"
            : "空查询";
    uiState.actionMessage = action === "results"
      ? "搜索返回2条模拟资源。"
      : action === "empty"
        ? "搜索进入无结果状态。"
        : action === "detail"
          ? "已在A-WEB-11同页打开模拟资源详情。"
          : action === "back"
            ? "已从同页详情返回并保留搜索结果。"
            : "搜索与筛选已清除。";
    rerenderPage();
  }

  function handleSort(pageId, action) {
    const initial = ["条目甲", "条目乙", "条目丙"];
    const order = interactionMemory.sortOrders[pageId] || initial.slice();
    const before = order.join(" > ");
    if (action === "down" || action === "up") [order[0], order[1]] = [order[1], order[0]];
    else order.splice(0, order.length, ...initial);
    const after = order.join(" > ");
    interactionMemory.sortOrders[pageId] = order;
    const receipts = interactionMemory.auditReceipts[pageId] || [];
    receipts.push(`SORT-${String(receipts.length + 1).padStart(2, "0")}｜动作=${action}｜前=${before}｜后=${after}`);
    interactionMemory.auditReceipts[pageId] = receipts;
    uiState.actionMessage = `排序已更新并新增审计回执 SORT-${String(receipts.length).padStart(2, "0")}。`;
    rerenderPage();
  }

  function handleSummary(action) {
    if (!uiState.currentPage || uiState.currentPage.id !== "B-FLOW-11" || uiState.roleContext !== "授权教师（模拟审查）" || flowMemory.aiSupervision.teacherScope !== "授权班级有效") {
      uiState.actionMessage = "摘要动作已拒绝：仅B-FLOW-11授权教师且teacherScope有效时可执行。";
      rerenderPage();
      return;
    }
    const summary = flowMemory.aiSummary;
    const allowedFrom = {
      read: ["待教师查看"],
      intervene: ["待教师查看", "已阅"],
      resolve: ["需介入"]
    };
    if (!allowedFrom[action] || !allowedFrom[action].includes(summary.state)) {
      uiState.actionMessage = "摘要动作因当前摘要状态不匹配而拒绝。";
      rerenderPage();
      return;
    }
    if (action === "read") summary.state = "已阅";
    else if (action === "intervene") summary.state = "需介入";
    else if (action === "resolve") {
      summary.state = "已处理";
      if (flowMemory.ai.state === "需教师介入") {
        flowMemory.ai.state = "已完成";
        flowMemory.ai.step = "教师处理完成";
        flowMemory.ai.note = "授权教师已记录最小处理结果并结束会话。";
      }
    }
    uiState.actionMessage = `教师摘要已进入${summary.state}。`;
    rerenderPage();
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (!target) return;
    captureActionFocus(target);

    if (target.dataset.endpoint) {
      const endpoint = target.dataset.endpoint;
      if (endpoint === "index") clearRoute();
      else navigateToPageId(endpointDefaults[endpoint]);
      return;
    }

    if (target.dataset.route) {
      const page = pageByRoute.get(target.dataset.route);
      if (page) navigateToPageId(page.id);
      else announce("内部目标不存在，导航已拒绝。");
      return;
    }

    if (target.dataset.aiEnterMode) {
      const mode = target.dataset.aiEnterMode;
      const guardianGuard = aiGuardReport("家长监督");
      const guardianEntry = mode === "guardian" && uiState.currentPage && uiState.currentPage.id === "B-FLOW-12" && uiState.roleContext === "家长（模拟审查）" && guardianGuard.pass;
      const teacherEntry = mode === "teacher" && uiState.currentPage && uiState.currentPage.id === "B-FLOW-06" && uiState.roleContext === "授权教师（模拟审查）";
      if (!guardianEntry && !teacherEntry) {
        uiState.actionMessage = "AI入口已拒绝：来源页面、监督模式或角色不在批准范围。";
        rerenderPage();
        return;
      }
      selectAiMode(mode);
      navigateToPageId("B-FLOW-10");
      return;
    }

    if (target.dataset.aiMode) {
      if (!uiState.currentPage || uiState.currentPage.id !== "B-FLOW-10" || !["guardian", "teacher"].includes(target.dataset.aiMode)) {
        uiState.actionMessage = "AI监督者切换已拒绝：目标页面或模式不在批准范围。";
        rerenderPage();
        return;
      }
      selectAiMode(target.dataset.aiMode);
      rerenderPage();
      return;
    }

    if (target.dataset.teacherScopeToggle !== undefined) {
      toggleTeacherScope();
      return;
    }

    if (target.dataset.reviewMode) {
      uiState.reviewMode = target.dataset.reviewMode;
      rerenderPage();
      return;
    }

    if (target.dataset.demoAction !== undefined && uiState.currentPage) {
      const action = uiState.currentPage.actions[Number(target.dataset.demoAction)];
      uiState.actionMessage = `已在内存中演示“${action}”；未发送外部请求。`;
      rerenderPage();
      return;
    }

    if (target.dataset.simpleFlow) {
      handleSimpleFlow(target);
      return;
    }

    if (target.dataset.flowActor) {
      handleFlowActor(target.dataset.flowActorPage, target.dataset.flowActor);
      return;
    }

    if (target.dataset.resetFlow) {
      resetSimpleFlow(target.dataset.resetFlow);
      return;
    }

    if (target.dataset.bindingAction) {
      handleBinding(target.dataset.bindingAction);
      return;
    }

    if (target.dataset.supervisionAction) {
      handleSupervision(target.dataset.supervisionAction);
      return;
    }

    if (target.dataset.deletionAction) {
      handleDeletion(target.dataset.deletionAction);
      return;
    }

    if (target.dataset.deletionContext) {
      const requestedContext = target.dataset.deletionContext;
      const currentContext = flowMemory.aiSupervision.deletionContext;
      const contextTransitionAllowed = (requestedContext === "processor" && currentContext === "家长申请人")
        || (requestedContext === "guardian" && currentContext === "授权处理者（机构管理员/校区负责人）");
      if (!uiState.currentPage || uiState.currentPage.id !== "B-FLOW-12" || uiState.roleContext !== "家长（模拟审查）" || flowMemory.binding.state !== "已通过" || flowMemory.aiSupervision.institutionSwitch !== "已启用" || !contextTransitionAllowed) {
        uiState.actionMessage = "删除请求模拟角色切换已拒绝：来源页面、关系或角色状态不匹配。";
        rerenderPage();
        return;
      }
      flowMemory.aiSupervision.deletionContext = target.dataset.deletionContext === "processor"
        ? "授权处理者（机构管理员/校区负责人）"
        : "家长申请人";
      uiState.actionMessage = `删除请求模拟角色已切换为${flowMemory.aiSupervision.deletionContext}。`;
      rerenderPage();
      return;
    }

    if (target.dataset.aiAction) {
      handleAi(target.dataset.aiAction);
      return;
    }

    if (target.dataset.teacherSummary !== undefined) {
      activateTeacherSummary(true);
      return;
    }

    if (target.dataset.switchTeacher !== undefined) {
      activateTeacherSummary(false);
      return;
    }

    if (target.dataset.summaryAction) {
      handleSummary(target.dataset.summaryAction);
      return;
    }

    if (target.dataset.cultureToggle) {
      handleCulture(target.dataset.cultureToggle, false);
      return;
    }

    if (target.dataset.cultureAnchor) {
      handleCulture(target.dataset.cultureAnchor, true);
      return;
    }

    if (target.dataset.homeSchoolAction) {
      handleHomeSchool(target.dataset.pageId, target.dataset.homeSchoolAction);
      return;
    }

    if (target.dataset.homeSchoolAdminAction) {
      handleHomeSchoolAdmin(target.dataset.homeSchoolAdminAction);
      return;
    }

    if (target.dataset.contactAction) {
      handleContact(target.dataset.pageId, target.dataset.contactAction);
      return;
    }

    if (target.dataset.resourceAction) {
      handleResource(target.dataset.pageId, target.dataset.resourceAction);
      return;
    }

    if (target.dataset.sortAction) {
      handleSort(target.dataset.pageId, target.dataset.sortAction);
      return;
    }

    if (target.dataset.clearRoute !== undefined) clearRoute();
  });

  routeFilter.addEventListener("input", renderRouteList);
  window.addEventListener("hashchange", renderCurrentRoute);

  assertCatalog();
  window.__PHASE_1A_BATCH_A_PROTOTYPE__ = Object.freeze({
    contractSha256: CONTRACT_SHA256,
    pageCatalog: PAGE_CATALOG,
    counts: Object.freeze({ a: 47, aMini: 20, aWeb: 13, aAdmin: 14, bOperational: 12 }),
    safeguards: Object.freeze({ externalRequests: false, persistentStorage: false, realData: false, formalAi: false })
  });
  renderCurrentRoute();
}());
