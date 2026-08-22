(() => {
  window.MOCK_DATA = {
    simulationLabel: '模拟数据 · 不连接真实服务',
    institution: {
      name: '同芯学园 · 模拟校区',
      tagline: '让每一次托管，都有清楚的回应。',
      description: '以稳定的日常、透明的沟通和循序的学习支持陪伴成长。',
      culture: '尊重尝试，及时回应，把复杂的事情讲清楚。',
      campus: '青禾校区（模拟）',
      contact: '仅用于原型演示，不接收真实预约。'
    },
    campuses: [
      { name: '青禾校区（模拟）', note: '近社区、安静阅读区、分时接送' },
      { name: '松果校区（模拟）', note: '小组活动区、开放餐桌、雨天动线' }
    ],
    teachers: [
      { id: 'teacher-a', name: '林老师（模拟）', role: '阅读与表达', note: '擅长把长任务拆成小步骤。', color: 'mint' },
      { id: 'teacher-b', name: '周老师（模拟）', role: '数学引导', note: '重视先尝试，再复盘。', color: 'sky' },
      { id: 'teacher-c', name: '许老师（模拟）', role: '活动与生活', note: '负责活动节奏和日常关怀。', color: 'coral' }
    ],
    activities: [
      { title: '小小观察员（模拟）', date: '周三 15:30', note: '记录一片叶子的变化。', status: '已发布' },
      { title: '安静阅读角（模拟）', date: '周五 16:00', note: '选择一本书，分享一个发现。', status: '已发布' },
      { title: '雨天创作桌（模拟）', date: '下周一 15:00', note: '用纸和线条搭建想象中的路线。', status: '已发布' }
    ],
    meals: [
      { day: '周一', meal: '午餐', items: '番茄鸡蛋面、时蔬、温水', note: '示例菜单，不构成健康建议。' },
      { day: '周二', meal: '午餐', items: '杂粮饭、香菇豆腐、青菜汤', note: '示例菜单，不构成健康建议。' },
      { day: '周三', meal: '点心', items: '玉米、酸奶、当季水果', note: '示例菜单，不构成健康建议。' }
    ],
    timeline: [
      { time: '12:30', title: '午间到达', note: '教师完成现场清点和交接记录。' },
      { time: '14:00', title: '作业引导', note: '先确认任务，再安排安静工作区。' },
      { time: '16:00', title: '活动与点心', note: '按当日计划进行活动，记录必要事实。' },
      { time: '17:30', title: '接送核验', note: '只对有效授权进行现场核验。' }
    ],
    resources: [
      { title: '分步提问卡（模拟）', category: '数学引导', version: 'v0.3', scope: '青禾校区' },
      { title: '阅读分享记录表（模拟）', category: '阅读表达', version: 'v0.2', scope: '全机构' },
      { title: '雨天活动清单（模拟）', category: '生活活动', version: 'v0.1', scope: '松果校区' }
    ],
    guides: [
      { title: '新同事第一天（模拟）', category: '入职', version: 'v1.0', scope: '全机构' },
      { title: '现场交接检查（模拟）', category: '安全', version: 'v1.2', scope: '青禾校区' },
      { title: '日报提交前核对（模拟）', category: '记录', version: 'v0.8', scope: '全机构' }
    ],
    tasks: [
      { title: '确认今日活动记录', owner: '林老师（模拟）', status: '待处理', due: '今天 17:00' },
      { title: '补充班级交接摘要', owner: '周老师（模拟）', status: '进行中', due: '今天 17:30' },
      { title: '查看异常跟进结果', owner: '许老师（模拟）', status: '已完成', due: '今天 16:20' }
    ],
    audit: [
      { action: '保存草稿', object: '首页内容（模拟）', actor: '机构管理员（模拟）', time: '今天 09:18', scope: '青禾校区' },
      { action: '提交日报', object: '教师工作日报（模拟）', actor: '教师（模拟）', time: '昨天 17:42', scope: '青禾校区' },
      { action: '更新链接状态', object: '伙伴云入口（模拟）', actor: '机构管理员（模拟）', time: '周一 11:06', scope: '全机构' }
    ]
  };
})();
