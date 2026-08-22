(() => {
  'use strict';

  const CATALOG = window.PAGE_CATALOG;
  const DATA = window.MOCK_DATA;
  const app = document.getElementById('app');

  const state = {
    route: '',
    toast: null,
    binding: { step: 0, contact: '', invite: '', learner: '', group: '', error: '' },
    report: { stage: 'draft', note: '', error: '' },
    ai: { status: 'idle', attempted: '', unlocked: -1, needsRetry: false, awaiting: -1, completed: [], understood: [], consolidation: 0, summary: false, error: '', guardError: '', role: 'guardian' },
    supervision: { consent: '未同意', enabled: false, institutionEnabled: false, relationshipValid: true, teacherScopeValid: false, deletion: '未申请' },
    genericFlows: {},
    adminActions: {},
    signedIn: false
  };

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const icon = (name, className) => '<svg class="' + (className || 'icon') + '" aria-hidden="true"><use href="assets/icons/symbols.svg#' + name + '"></use></svg>';
  const href = (route) => '#' + route;
  const pageForPath = (path) => CATALOG.find((page) => {
    if (page.route === path) return true;
    const expression = '^' + page.route.replace(/[.*+?^()|[\]\\]/g, '\\$&').replace(/:id/g, '[^/]+') + '$';
    return new RegExp(expression).test(path);
  }) || CATALOG[0];

  const currentPath = () => {
    const raw = location.hash ? location.hash.slice(1).split('?')[0] : '/web/visitor/home';
    return raw.startsWith('/') ? raw : '/' + raw;
  };

  const pageLink = (page, compact) => '<a class="route-link' + (page.route === state.route ? ' is-current' : '') + '" href="' + href(page.route) + '"' +
    (page.route === state.route ? ' aria-current="page"' : '') + '>' +
    icon(page.flow ? 'spark' : page.endpoint === 'admin' ? 'settings' : page.endpoint === 'mini' ? 'clipboard' : 'book', 'icon icon--sm') +
    '<span class="route-link__body"><span class="route-link__title">' + esc(page.title) + '</span>' +
    (compact ? '' : '<span class="route-link__meta">' + esc(page.id) + ' · ' + esc(page.route) + '</span>') + '</span></a>';

  const statusBadge = (text, tone) => '<span class="badge badge--' + (tone || 'neutral') + '">' + esc(text) + '</span>';
  const actionButton = (label, action, tone, extra) => '<button class="btn btn--' + (tone || 'secondary') + '" type="button" data-action="' + action + '"' + (extra || '') + '>' + esc(label) + '</button>';
  const illustrationFor = (page) => {
    if (page.flow && page.id === 'B-FLOW-10') return 'assets/illustrations/ai-learning.svg';
    if (page.flow && page.id === 'B-FLOW-05') return 'assets/illustrations/safety-pickup.svg';
    if (page.group === '访客端' && page.title.indexOf('教师') >= 0) return 'assets/illustrations/teacher-team.svg';
    if (page.group === '访客端' && page.title.indexOf('餐食') >= 0) return 'assets/illustrations/meal-care.svg';
    if (page.endpoint === 'admin') return 'assets/illustrations/success-state.svg';
    if (page.endpoint === 'mini') return 'assets/illustrations/welcome-children.svg';
    return 'assets/illustrations/empty-state.svg';
  };

  const endpointLabel = (endpoint) => ({ mini: '微信小程序', web: '用户网页端', admin: '机构管理网页端', flow: '关键流程' }[endpoint] || endpoint);
  const endpointClass = (endpoint) => endpoint === 'mini' ? 'endpoint-mini' : endpoint === 'admin' ? 'endpoint-admin' : endpoint === 'flow' ? 'endpoint-flow' : 'endpoint-web';
  const currentGroup = (page) => page.endpoint === 'admin' ? '管理端' : page.endpoint === 'flow' ? '流程' : page.endpoint === 'mini' ? '小程序' : '用户网页';

  const quickRoutes = [
    '/web/visitor/home',
    '/mini/staff/workbench',
    '/web/staff/workbench',
    '/admin/dashboard',
    '/flow/guardian-binding',
    '/flow/teacher-daily-report',
    '/flow/ai-learning-assistant'
  ].map((route) => CATALOG.find((page) => page.route === route)).filter(Boolean);

  const renderSideNav = (page) => {
    const groups = [
      ['快速入口', quickRoutes],
      ['访客与用户', CATALOG.filter((item) => item.tier === 'A' && (item.group === '访客端' || item.group === '用户网页')).slice(0, 7)],
      ['机构管理', CATALOG.filter((item) => item.endpoint === 'admin').slice(0, 7)],
      ['关键流程', CATALOG.filter((item) => item.tier === 'B')]
    ];
    return '<aside class="side-nav" aria-label="原型路由导航"><div class="side-nav__top">' +
      '<a class="brand-lockup" href="#/web/visitor/home">' +
      '<img src="assets/brand/tongxin-logo.png" alt="同芯学园 Logo">' +
      '<span><strong>同芯学园</strong><small>高保真审查原型</small></span></a></div>' +
      groups.map((group) => '<section class="side-nav__section"><div class="side-nav__label">' + esc(group[0]) + '</div><nav class="side-nav__links">' +
        group[1].map((item) => pageLink(item, true)).join('') + '</nav></section>').join('') +
      '</aside>';
  };

  const renderTopbar = (page) => '<header class="topbar"><div class="topbar__context">' +
    '<button class="btn btn--icon mobile-only" type="button" title="打开路由目录" aria-label="打开路由目录" data-action="scroll-directory">' + icon('clipboard') + '</button>' +
    '<span class="eyebrow">' + esc(currentGroup(page)) + '</span><span class="muted">/</span><span>' + esc(page.title) + '</span></div>' +
    '<div class="cluster topbar__actions">' +
    '<label class="sr-only" for="route-jump">跳转到原型路由</label><select id="route-jump" class="route-jump" aria-label="跳转到原型路由">' +
    '<option value="">跳转到路由</option>' + CATALOG.map((item) => '<option value="' + esc(item.route) + '"' + (item.route === page.route ? ' selected' : '') + '>' + esc(item.id + ' · ' + item.title) + '</option>').join('') +
    '</select>' + actionButton('路由目录', 'scroll-directory', 'quiet') + '</div></header>';

  const renderBottomNav = (page) => {
    const candidates = page.endpoint === 'admin'
      ? ['/admin/dashboard', '/admin/publishing', '/admin/audit-logs', '/admin/staff']
      : page.endpoint === 'mini'
        ? ['/mini/visitor/home', '/mini/staff/workbench', '/flow/teacher-workbench', '/mini/staff/account']
        : ['/web/visitor/home', '/web/staff/workbench', '/flow/guardian-home', '/web/staff/account'];
    return '<nav class="bottom-nav" aria-label="移动端原型导航">' + candidates.map((route) => {
      const item = CATALOG.find((candidate) => candidate.route === route) || CATALOG[0];
      return '<a href="' + href(item.route) + '"' + (item.route === page.route ? ' class="is-current" aria-current="page"' : '') + '>' +
        icon(item.endpoint === 'admin' ? 'settings' : item.flow ? 'spark' : item.title.indexOf('账号') >= 0 ? 'users' : 'home') +
        '<span>' + esc(item.title) + '</span></a>';
    }).join('') + '</nav>';
  };

  const renderHero = (page) => '<section class="hero-band" aria-labelledby="page-title">' +
    '<div class="hero-band__copy"><span class="eyebrow">' + esc(page.id) + ' · ' + esc(page.tier === 'A' ? 'A级页面' : 'B级流程') + '</span>' +
    '<h1 id="page-title" class="page-title">' + esc(page.title) + '</h1><p class="muted">' + esc(page.summary) + '</p>' +
    '<div class="cluster">' + statusBadge(endpointLabel(page.endpoint), page.endpoint === 'admin' ? 'info' : 'neutral') +
    statusBadge('模拟数据', 'warning') + statusBadge(page.role, 'neutral') + '</div></div>' +
    '<div class="hero-band__visual"><img class="illustration" src="' + illustrationFor(page) + '" alt="本地原创插画：' + esc(page.title) + '"></div></section>';

  const renderMetrics = (page) => {
    const metrics = page.flow ? [
      ['当前状态', flowStatus(page), 'lime'],
      ['合法步骤', page.id === 'B-FLOW-10' ? '5 层守卫' : '状态机', 'sky'],
      ['权限范围', page.endpoint === 'flow' ? '按角色' : '本机构', 'mint'],
      ['数据性质', '模拟', 'yellow']
    ] : page.endpoint === 'admin' ? [
      ['待处理', '06', 'yellow'], ['已发布', '18', 'mint'], ['本周操作', '32', 'sky'], ['范围', '1 校区', 'lime']
    ] : [
      ['可导航路由', '59', 'lime'], ['A级页面', '47', 'sky'], ['B级流程', '12', 'coral'], ['外部请求', '0', 'mint']
    ];
    return '<div class="metrics-grid" aria-label="页面摘要指标">' + metrics.map((metric) =>
      '<div class="metric" style="--accent: var(--' + metric[2] + ')"><span class="metric__label">' + esc(metric[0]) + '</span><strong class="metric__value">' + esc(metric[1]) + '</strong></div>'
    ).join('') + '</div>';
  };

  const renderRouteDirectory = () => {
    const groups = [
      ['A级 · 小程序', CATALOG.filter((item) => item.id.indexOf('A-MP') === 0)],
      ['A级 · 用户网页', CATALOG.filter((item) => item.id.indexOf('A-WEB') === 0)],
      ['A级 · 机构管理网页', CATALOG.filter((item) => item.id.indexOf('A-ADM') === 0)],
      ['B级 · 关键流程', CATALOG.filter((item) => item.tier === 'B')]
    ];
    return '<section id="route-directory" class="section"><div class="section__head"><div><span class="eyebrow">ROUTE CATALOG</span><h2 class="section-title">完整路由目录</h2></div>' +
      '<span class="muted">A 47 · B 12 · 总计 59</span></div><div class="content-grid content-grid--2">' +
      groups.map((group) => '<div class="card card--pad"><div class="card__head"><h3 class="card__title">' + esc(group[0]) + '</h3><span class="badge badge--neutral">' + group[1].length + '</span></div><div class="stack" style="margin-top:14px">' +
        group[1].map((item) => pageLink(item, false)).join('') + '</div></div>').join('') + '</div></section>';
  };

  const renderPageFooter = (page) => '<section class="section"><div class="notice"><span>' + icon('shield', 'icon icon--lg') +
    '</span><p><strong>审查边界：</strong>本页仅为离线高保真原型，所有内容为模拟数据；无真实登录、支付、后端、正式 AI 或外部请求。当前路由 <span class="mono">' + esc(page.route) + '</span>。</p></div></section>';

  const renderVisitorPage = (page) => {
    const isHome = page.title === '访客首页';
    const isTeacher = page.title.indexOf('教师') >= 0;
    const isMeal = page.title.indexOf('餐食') >= 0;
    const isActivity = page.title.indexOf('活动') >= 0;
    const isTimeline = page.title === '一日流程';
    const isContact = page.title.indexOf('校区') >= 0;
    let primary = '';
    if (isHome) {
      primary = '<div class="content-grid content-grid--2">' +
        ['机构介绍','家校共育','一日流程','教师团队','精彩活动','餐食与食谱'].map((title, index) => {
          const item = CATALOG.find((candidate) => candidate.title === title && candidate.endpoint === page.endpoint);
          return '<a class="card card--pad card--accent" style="--accent: var(--' + ['lime','mint','sky','coral','yellow','mint'][index] + ')" href="' + href(item ? item.route : page.route) + '"><div class="card__head"><h3 class="card__title">' + esc(title) + '</h3>' + icon('arrow') + '</div><p class="card__meta">查看公开信息与下一步入口</p></a>';
        }).join('') + '</div>';
    } else if (isTeacher) {
      primary = '<div class="content-grid content-grid--3">' + DATA.teachers.map((teacher) =>
        '<article class="card card--pad card--accent" style="--accent: var(--' + teacher.color + ')"><div class="card__head"><div><h3 class="card__title">' + esc(teacher.name) + '</h3><p class="card__meta">' + esc(teacher.role) + '</p></div>' + statusBadge('公开字段', 'success') + '</div><p>' + esc(teacher.note) + '</p><a class="btn btn--quiet" href="' + href(page.endpoint === 'mini' ? '/mini/visitor/teachers/:id' : '/web/visitor/teachers/:id') + '">查看公开详情 ' + icon('arrow', 'icon icon--sm') + '</a></article>'
      ).join('') + '</div>';
    } else if (isMeal) {
      primary = '<div class="card card--pad"><div class="section__head"><div><span class="eyebrow">MEAL PLAN</span><h2 class="section-title">本周示例菜单</h2></div><div class="segmented"><button class="is-selected" type="button" data-action="filter-demo">本周</button><button type="button" data-action="filter-demo">下周</button></div></div><div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>日期</th><th>餐次</th><th>内容</th><th>说明</th></tr></thead><tbody>' +
        DATA.meals.map((meal) => '<tr><td>' + esc(meal.day) + '</td><td>' + esc(meal.meal) + '</td><td><strong>' + esc(meal.items) + '</strong></td><td class="muted">' + esc(meal.note) + '</td></tr>').join('') +
        '</tbody></table></div></div>';
    } else if (isTimeline) {
      primary = '<div class="card card--pad"><div class="timeline">' + DATA.timeline.map((item) => '<div class="timeline__item"><div class="timeline__time">' + esc(item.time) + '</div><div class="timeline__body"><h3 class="card__title">' + esc(item.title) + '</h3><p class="muted">' + esc(item.note) + '</p></div></div>').join('') + '</div></div>';
    } else if (isActivity) {
      primary = '<div class="content-grid content-grid--3">' + DATA.activities.map((item) => '<article class="card card--pad card--accent" style="--accent: var(--yellow)"><div class="card__head"><h3 class="card__title">' + esc(item.title) + '</h3>' + statusBadge(item.status, 'success') + '</div><p class="card__meta">' + esc(item.date) + '</p><p>' + esc(item.note) + '</p><button class="btn btn--secondary btn--small" type="button" data-action="show-toast">打开详情</button></article>').join('') + '</div>';
    } else if (isContact) {
      primary = '<div class="content-grid content-grid--2"><div class="card card--pad"><span class="eyebrow">CAMPUS</span><h2 class="section-title">选择一个模拟校区</h2><div class="stack" style="margin-top:14px">' + DATA.campuses.map((campus, index) => '<button type="button" class="route-link' + (index === 0 ? ' is-current' : '') + '" data-action="select-campus"><span class="route-link__body"><span class="route-link__title">' + esc(campus.name) + '</span><span class="route-link__meta">' + esc(campus.note) + '</span></span></button>').join('') + '</div></div><form class="card card--pad" data-form="contact"><span class="eyebrow">CONTACT INTENT</span><h2 class="section-title">模拟联系意向</h2><p class="muted">不填写真实手机号、地址或学生信息。</p><div class="stack"><div class="field"><label for="intent-topic">想了解的内容</label><select id="intent-topic" name="topic"><option>参观环境（模拟）</option><option>一日流程（模拟）</option><option>餐食安排（模拟）</option></select></div><div class="field"><label for="intent-note">补充说明</label><textarea id="intent-note" name="note" placeholder="只填写虚构内容"></textarea></div><button class="btn btn--primary" type="submit">提交模拟意向</button></div></form></div>';
    } else {
      primary = '<div class="content-grid content-grid--2"><article class="card card--pad"><span class="eyebrow">PUBLIC CONTENT</span><h2 class="section-title">' + esc(page.title) + '说明</h2><p>这里展示同芯学园对外发布的模拟内容。发布状态、返回路径和空/错状态均在原型中保留。</p><div class="notice notice--success">' + icon('check', 'icon') + '<p>当前为已发布模拟版本，未包含个人信息。</p></div></article><div class="card card--pad"><img class="illustration" src="' + illustrationFor(page) + '" alt="本地原创插画"></div></div>';
    }
    return '<section class="section"><div class="section__head"><div><span class="eyebrow">PUBLIC VIEW</span><h2 class="section-title">对外公开内容</h2></div>' + actionButton('模拟加载失败', 'show-toast', 'quiet') + '</div>' + primary + '</section>';
  };

  const renderStaffPage = (page) => {
    if (page.title === '员工登录') {
      return '<section class="section"><div class="content-grid content-grid--2"><form class="card card--pad" data-form="staff-login"><span class="eyebrow">SIMULATED MEMBERSHIP</span><h2 class="section-title">选择模拟身份</h2><p class="muted">不收集手机号、密码或微信授权。</p><div class="stack"><div class="field"><label for="staff-role">角色</label><select id="staff-role" name="role"><option>教师（模拟）</option><option>工作人员（模拟）</option></select></div><div class="field"><label for="staff-scope">范围</label><select id="staff-scope" name="scope"><option>青禾校区（模拟）</option><option>松果校区（模拟）</option></select></div><button class="btn btn--primary" type="submit">进入模拟工作台</button></div></form><div class="card card--pad"><img class="illustration" src="assets/illustrations/teacher-team.svg" alt="本地原创教师团队插画"><div class="notice notice--warning" style="margin-top:14px"><p>这是原型身份，不是正式登录。</p></div></div></div></section>';
    }
    if (page.title === '内部工作台') {
      const staffPrefix = page.route.startsWith('/web/') ? '/web/staff' : '/mini/staff';
      const staffSuffixes = page.route.startsWith('/web/')
        ? ['/guides','/resources','/partner-cloud','/account']
        : ['/guides','/resources','/resources/search','/partner-cloud','/account'];
      const links = staffSuffixes.map((suffix) => staffPrefix + suffix);
      return '<section class="section"><div class="content-grid content-grid--3">' + links.map((route, index) => {
        const item = CATALOG.find((candidate) => candidate.route === route) || CATALOG.find((candidate) => candidate.route === route.replace('/mini/', '/web/'));
        return '<a class="card card--pad card--accent" style="--accent: var(--' + ['sky','mint','yellow','coral','deep'][index] + ')" href="' + href(item.route) + '"><div class="card__head"><h3 class="card__title">' + esc(item.title) + '</h3>' + icon('arrow') + '</div><p class="card__meta">' + esc(item.summary) + '</p></a>';
      }).join('') + '</div><div class="card card--pad"><div class="section__head"><h2 class="section-title">今日工作提示</h2>' + statusBadge('Membership 有效（模拟）', 'success') + '</div><ul class="list" style="margin-top:10px">' + DATA.tasks.map((task) => '<li class="list-item"><div><strong>' + esc(task.title) + '</strong><div class="card__meta">' + esc(task.owner) + ' · ' + esc(task.due) + '</div></div>' + statusBadge(task.status, task.status === '已完成' ? 'success' : 'warning') + '</li>').join('') + '</ul></div></section>';
    }
    const isGuide = page.title.indexOf('指南') >= 0;
    const rows = isGuide ? DATA.guides : DATA.resources;
    return '<section class="section"><div class="card card--pad"><div class="section__head"><div><span class="eyebrow">INTERNAL CONTENT</span><h2 class="section-title">' + esc(page.title) + '</h2></div>' + statusBadge('按 Membership 过滤', 'info') + '</div><div class="field" style="margin-top:14px"><label for="content-search">搜索模拟内容</label><input id="content-search" type="search" placeholder="例如：阅读、活动" data-model="content-search"></div><div class="content-grid content-grid--3" style="margin-top:18px">' + rows.map((item) => '<article class="card card--pad card--accent" style="--accent: var(--' + (isGuide ? 'sky' : 'mint') + ')"><h3 class="card__title">' + esc(item.title) + '</h3><p class="card__meta">' + esc(item.category || item.scope) + ' · ' + esc(item.version || '受控入口') + '</p><p>只展示授权范围内的模拟内容。</p><button type="button" class="btn btn--secondary btn--small" data-action="show-toast">查看模拟详情</button></article>').join('') + '</div></div></section>';
  };

  const renderAdminPage = (page) => {
    if (page.title === '登录') {
      return '<section class="section"><div class="content-grid content-grid--2"><form class="card card--pad" data-form="admin-login"><span class="eyebrow">ADMIN CONSOLE</span><h2 class="section-title">进入模拟管理后台</h2><p class="muted">机构管理员与校区负责人只能看到自己的模拟范围。</p><div class="stack"><div class="field"><label for="admin-role">模拟角色</label><select id="admin-role" name="role"><option>机构管理员（模拟）</option><option>校区负责人（模拟）</option></select></div><div class="field"><label for="admin-campus">当前校区</label><select id="admin-campus" name="campus"><option>青禾校区（模拟）</option><option>松果校区（模拟）</option></select></div><button class="btn btn--primary" type="submit">进入管理看板</button></div></form><div class="card card--pad"><img class="illustration" src="assets/illustrations/success-state.svg" alt="本地原创完成状态插画"><div class="notice notice--warning" style="margin-top:14px"><p>原型只模拟身份和权限，不执行真实认证。</p></div></div></div></section>';
    }
    if (page.title === '管理看板') {
      return '<section class="section"><div class="content-grid content-grid--3">' + [
        ['待发布内容','06','发布与下架','/admin/publishing','yellow'],
        ['公开教师','08','教师公开介绍','/admin/public-teachers','coral'],
        ['审计记录','32','基础操作日志','/admin/audit-logs','sky']
      ].map((item) => '<a class="metric" style="--accent: var(--' + item[4] + ')" href="' + href(item[3]) + '"><span class="metric__label">' + item[0] + '</span><strong class="metric__value">' + item[1] + '</strong><span class="card__meta">' + item[2] + ' ' + icon('arrow','icon icon--sm') + '</span></a>').join('') + '</div><div class="card card--pad"><div class="section__head"><h2 class="section-title">范围上下文</h2>' + statusBadge('tenant: 模拟机构 · campus: 青禾', 'info') + '</div><p>所有动作均显示租户和校区范围，不能从前端输入覆盖范围。</p><div class="route-summary"><div><strong>18</strong><span class="card__meta">已发布版本</span></div><div><strong>06</strong><span class="card__meta">待处理动作</span></div><div><strong>0</strong><span class="card__meta">跨范围结果</span></div></div></div></section>';
    }
    const isAudit = page.title === '基础操作日志';
    const isFiles = page.title === '文件管理';
    const rows = isAudit ? DATA.audit : isFiles ? DATA.resources.map((item) => ({ action: '模拟文件', object: item.title, actor: '机构管理员（模拟）', time: item.version, scope: item.scope })) : DATA.tasks.map((task) => ({ action: '状态', object: task.title, actor: task.owner, time: task.due, scope: '青禾校区' }));
    const actionState = state.adminActions[page.route] || '未保存';
    return '<section class="section"><div class="card admin-table-card"><div class="admin-table-card__toolbar"><div><span class="eyebrow">ADMIN WORKSPACE</span><h2 class="section-title">' + esc(page.title) + '</h2></div><div class="cluster">' + statusBadge('范围：青禾校区（模拟）', 'info') + actionButton('保存模拟草稿', 'admin-save', 'secondary') + '</div></div><div class="notice" style="margin:16px 20px 0"><p><strong>当前动作：</strong>' + esc(actionState) + '。保存草稿不会对外发布；发布、下架和排序均写入模拟审计。</p></div><div class="table-wrap" style="margin:16px 20px 20px"><table><thead><tr><th>对象</th><th>动作</th><th>操作者</th><th>时间</th><th>范围</th><th>操作</th></tr></thead><tbody>' + rows.map((row) => '<tr><td><strong>' + esc(row.object) + '</strong></td><td>' + statusBadge(row.action, isAudit ? 'info' : 'neutral') + '</td><td>' + esc(row.actor) + '</td><td>' + esc(row.time) + '</td><td>' + esc(row.scope) + '</td><td><button class="btn btn--quiet btn--small" type="button" data-action="admin-row">查看</button></td></tr>').join('') + '</tbody></table></div></div></section>';
  };

  const flowStages = {
    'B-FLOW-02': ['未绑定', '待审核', '已关联', '待办处理中'],
    'B-FLOW-03': ['未记录', '草稿', '已提交', '家长已阅'],
    'B-FLOW-04': ['草稿', '待确认', '已确认', '已撤回'],
    'B-FLOW-05': ['草稿授权', '有效', '待核验', '已完成'],
    'B-FLOW-06': ['无待办', '有待办', '处理中', '已更新'],
    'B-FLOW-07': ['待处理', '进行中', '已完成', '已取消'],
    'B-FLOW-08': ['未汇总', '汇总中', '待跟进', '已处理'],
    'B-FLOW-11': ['待生成', '待教师查看', '已阅', '需介入']
  };

  const flowContinuations = {
    'B-FLOW-06': ['/flow/teacher-tasks', '进入教师任务'],
    'B-FLOW-07': ['/flow/class-student-status', '查看班级学生情况'],
    'B-FLOW-08': ['/flow/teacher-daily-report', '生成教师工作日报']
  };

  const flowStatus = (page) => {
    if (page.id === 'B-FLOW-01' && state.binding.step >= 5) return '已解除';
    if (page.id === 'B-FLOW-01') return ['未提交','待审核','已通过','已解除'][state.binding.step === 2 ? 1 : state.binding.step >= 4 ? 2 : 0];
    if (page.id === 'B-FLOW-09') return state.report.stage === 'confirmed' ? '已确认' : state.report.stage === 'submitted' ? '待处理' : state.report.stage === 'returned' ? '退回修改' : '草稿';
    if (page.id === 'B-FLOW-10') return state.ai.status === 'teacher' ? '需教师介入' : state.ai.status === 'closed' ? '已关闭' : state.ai.status === 'complete' ? '已完成巩固' : state.ai.status === 'active' ? '引导中' : '未开始';
    if (page.id === 'B-FLOW-12') return state.supervision.enabled ? '已开启' : state.supervision.consent === '已拒绝' ? '已拒绝' : '未开启';
    return (flowStages[page.id] || ['准备中'])[state.genericFlows[page.id] || 0];
  };

  const aiRoleLabel = (role) => ({ guardian: '家长监护角色', teacher: '授权教师角色', visitor: '访客角色' }[role] || role);
  const aiGuardError = () => {
    const s = state.supervision;
    if (s.consent !== '已同意') return '无法开启：需要有效的监护人同意。';
    if (!s.institutionEnabled) return '无法开启：机构 AI 能力开关未开启。';
    if (!s.enabled) return '无法开启：监督会话开关未开启。';
    if (!s.relationshipValid && !s.teacherScopeValid) return '无法开启：家长关系和授权教师范围均无效。';
    if (!['guardian', 'teacher'].includes(state.ai.role)) return '无法开启：当前角色未获授权。';
    if (state.ai.role === 'guardian' && !s.relationshipValid) return '无法开启：家长与学生关系无效。';
    if (state.ai.role === 'teacher' && !s.teacherScopeValid) return '无法开启：教师未获授权班级范围。';
    return '';
  };

  const renderAiGuards = () => {
    const s = state.supervision;
    const ok = (value) => statusBadge(value ? '已满足' : '未满足', value ? 'success' : 'warning');
    return '<div class="card card--pad" data-testid="ai-guards"><div class="card__head"><div><span class="eyebrow">START GUARDS</span><h2 class="section-title">开启前置条件</h2></div>' + statusBadge(aiRoleLabel(state.ai.role), 'info') + '</div><ul class="list" style="margin-top:12px"><li class="list-item"><span>监护人同意</span>' + ok(s.consent === '已同意') + '</li><li class="list-item"><span>机构能力开关</span>' + ok(s.institutionEnabled) + '</li><li class="list-item"><span>关系或教师范围</span>' + ok(s.relationshipValid || s.teacherScopeValid) + '</li><li class="list-item"><span>允许角色</span>' + ok(state.ai.role === 'guardian' ? s.relationshipValid : state.ai.role === 'teacher' && s.teacherScopeValid) + '</li></ul><div class="flow-actions" style="margin-top:14px">' + actionButton('模拟家长关系', 'ai-context', 'quiet', ' data-role="guardian"') + actionButton('模拟授权教师', 'ai-context', 'quiet', ' data-role="teacher"') + actionButton('模拟无权角色', 'ai-context', 'danger', ' data-role="visitor"') + '<a class="btn btn--secondary" href="#/flow/guardian-ai-supervision">打开监督设置</a></div>' + (state.ai.guardError ? '<div class="field__error" role="alert" style="margin-top:12px">' + esc(state.ai.guardError) + '</div>' : '') + '</div>';
  };

  const renderGenericFlow = (page) => {
    const stages = flowStages[page.id] || ['准备', '处理中', '待确认', '已完成'];
    const index = state.genericFlows[page.id] || 0;
    const isAdmin = page.role.indexOf('管理') >= 0;
    const continuation = flowContinuations[page.id] ? '<nav class="flow-actions" aria-label="教师日报闭环" style="margin-top:14px"><span class="muted">下一步：</span><a class="btn btn--secondary" href="#' + flowContinuations[page.id][0] + '">' + flowContinuations[page.id][1] + '</a></nav>' : '';
    return '<section class="section"><div class="card flow-panel" style="--accent: var(--' + page.accent + ')"><div class="flow-panel__status"><strong>流程状态</strong>' + statusBadge(stages[index], index === stages.length - 1 ? 'success' : 'info') + '<span class="muted">角色守卫：' + esc(page.role) + '</span></div><div class="card--pad"><div class="stepper">' + stages.map((stage, step) => '<div class="step ' + (step === index ? 'is-active' : step < index ? 'is-done' : '') + '"><strong>' + (step + 1) + '</strong><br>' + esc(stage) + '</div>').join('') + '</div><div class="content-grid content-grid--2" style="margin-top:22px"><div><h2 class="section-title">可操作状态转换</h2><p class="muted">每次动作只推进一个合法状态；越权或跳步不会被接受。</p><ul class="list">' + stages.map((stage, step) => '<li class="list-item"><span>' + (step + 1) + '. ' + esc(stage) + '</span>' + statusBadge(step <= index ? '可追溯' : '锁定', step <= index ? 'success' : 'neutral') + '</li>').join('') + '</ul></div><div class="card card--pad"><img class="illustration" src="' + illustrationFor(page) + '" alt="流程原创插画"><p class="card__meta">输入、错误、加载、空状态与终态均在此离线原型中模拟。</p></div></div><div class="flow-actions" style="margin-top:22px">' + actionButton(index < stages.length - 1 ? '推进到下一合法状态' : '已完成 · 重新演示', index < stages.length - 1 ? 'generic-next' : 'generic-reset', index < stages.length - 1 ? 'primary' : 'secondary') + (isAdmin ? actionButton('模拟越权动作', 'reject-unauthorized', 'danger') : '') + actionButton('重置流程', 'generic-reset', 'quiet') + '</div>' + continuation + '</div></div></section>';
  };

  const bindingSteps = ['未开始', '填写必要信息', '待审核', '审核结果', '关系终态'];
  const renderBinding = () => {
    const b = state.binding;
    const step = b.step >= 4 ? 4 : b.step;
    let body = '';
    if (b.step === 0) {
      body = '<div class="notice"><p>必须由受监督的家长概念入口开始；学生不能独立注册。</p></div><div class="flow-actions">' + actionButton('开始模拟绑定', 'binding-start', 'primary') + '</div>';
    } else if (b.step === 1) {
      body = '<form class="stack" data-form="binding"><div class="notice notice--warning"><p>只填写虚构内容。缺少任一项不能提交。</p></div><div class="field"><label for="binding-contact">模拟联系方式</label><input id="binding-contact" name="contact" value="' + esc(b.contact) + '" placeholder="例如：模拟联系人" autocomplete="off"><span class="field__hint">不填写真实手机号。</span></div><div class="field"><label for="binding-invite">机构邀请码（模拟）</label><input id="binding-invite" name="invite" value="' + esc(b.invite) + '" placeholder="例如：SIM-001" autocomplete="off"></div><div class="field"><label for="binding-learner">学生姓名（模拟）</label><input id="binding-learner" name="learner" value="' + esc(b.learner) + '" placeholder="例如：模拟学员甲" autocomplete="off"></div><div class="field"><label for="binding-group">班级（模拟）</label><input id="binding-group" name="group" value="' + esc(b.group) + '" placeholder="例如：春芽组" autocomplete="off"></div>' + (b.error ? '<div class="field__error" role="alert">' + esc(b.error) + '</div>' : '') + '<div class="flow-actions"><button class="btn btn--primary" type="submit">提交审核申请</button>' + actionButton('返回未开始', 'binding-reset', 'quiet') + '</div></form>';
    } else if (b.step === 2) {
      body = '<div class="notice notice--success"><p><strong>申请已进入待审核。</strong>机构管理员或授权校区负责人可以处理；前端不能自行建立关系。</p></div><div class="flow-actions">' + actionButton('模拟审核通过', 'binding-approve', 'primary') + actionButton('模拟审核拒绝', 'binding-reject', 'secondary') + '</div>';
    } else if (b.step === 3) {
      body = '<div class="notice notice--danger"><p><strong>申请被拒绝（模拟）。</strong>可以回到通用编辑节点修改后重提。</p></div><div class="flow-actions">' + actionButton('修改后重提', 'binding-edit', 'primary') + '</div>';
    } else if (b.step === 4) {
      body = '<div class="notice notice--success"><p><strong>关系已建立（模拟）。</strong>现在可以进入家长首页，只显示已授权学生摘要。</p></div><div class="flow-actions"><a class="btn btn--primary" href="#/flow/guardian-home">进入家长首页</a>' + actionButton('申请解除关系', 'binding-release', 'danger') + '</div>';
    } else {
      body = '<div class="notice notice--warning"><p><strong>关系已解除（模拟）。</strong>如需继续，需要重新完成字段校验和审核。</p></div><div class="flow-actions">' + actionButton('重新开始', 'binding-reset', 'primary') + '</div>';
    }
    return '<section class="section"><div class="card flow-panel" style="--accent: var(--lime)"><div class="flow-panel__status"><strong>绑定闭环</strong>' + statusBadge(flowStatus(CATALOG.find((p) => p.id === 'B-FLOW-01')), b.step >= 4 ? 'success' : 'info') + '<span class="muted">家长/管理者按范围协作</span></div><div class="card--pad"><div class="stepper">' + bindingSteps.map((label, index) => '<div class="step ' + (index === step ? 'is-active' : index < step ? 'is-done' : '') + '"><strong>' + (index + 1) + '</strong><br>' + label + '</div>').join('') + '</div><div style="margin-top:22px">' + body + '</div></div></div></section>';
  };

  const renderReport = () => {
    const r = state.report;
    const steps = ['自动汇总草稿', '教师补充', '提交审核', '确认或退回'];
    const index = r.stage === 'draft' ? 0 : r.stage === 'submitted' ? 2 : r.stage === 'returned' ? 1 : 3;
    let body = '';
    if (r.stage === 'draft' || r.stage === 'returned') {
      body = '<div class="notice' + (r.stage === 'returned' ? ' notice--warning' : '') + '"><p>' + (r.stage === 'returned' ? '负责人已退回，请补充事实并重新提交。' : '系统只生成必要事实摘要，教师负责补充工作总结。') + '</p></div><form class="stack" data-form="report"><div class="field"><label for="report-note">教师总结 / 交接 / 次日重点</label><textarea id="report-note" name="note" placeholder="只填写模拟事实和下一步安排">' + esc(r.note) + '</textarea><span class="field__hint">不用于自动绩效结论，不写敏感诊断。</span></div>' + (r.error ? '<div class="field__error" role="alert">' + esc(r.error) + '</div>' : '') + '<div class="flow-actions"><button class="btn btn--primary" type="submit">提交工作日报</button>' + actionButton('重新生成模拟汇总', 'report-generate', 'secondary') + (r.stage === 'returned' ? '<a class="btn btn--quiet" href="#/flow/teacher-workbench">返回教师工作台</a>' : '') + '</div></form>';
    } else if (r.stage === 'submitted') {
      body = '<div class="notice notice--success"><p><strong>日报已提交（模拟）。</strong>机构管理员或校区负责人可以按范围退回或确认。</p></div><div class="flow-actions">' + actionButton('负责人确认', 'report-confirm', 'primary') + actionButton('退回修改', 'report-return', 'secondary') + '</div>';
    } else {
      body = '<div class="notice notice--success"><p><strong>日报已确认（模拟）。</strong>状态已回写教师工作台，不进入自动绩效判断。</p></div><div class="flow-actions"><a class="btn btn--primary" href="#/flow/teacher-workbench">返回教师工作台</a>' + actionButton('重新演示', 'report-reset', 'quiet') + '</div>';
    }
    return '<section class="section"><div class="card flow-panel" style="--accent: var(--lime)"><div class="flow-panel__status"><strong>教师任务 → 工作日报</strong>' + statusBadge(flowStatus(CATALOG.find((p) => p.id === 'B-FLOW-09')), r.stage === 'confirmed' ? 'success' : 'info') + '<span class="muted">教师补充，负责人按范围确认</span></div><div class="card--pad"><div class="stepper">' + steps.map((label, i) => '<div class="step ' + (i === index ? 'is-active' : i < index ? 'is-done' : '') + '"><strong>' + (i + 1) + '</strong><br>' + label + '</div>').join('') + '</div><div class="content-grid content-grid--2" style="margin-top:22px"><div>' + body + '</div><div class="card card--pad"><span class="eyebrow">AUTO SUMMARY · 模拟</span><h2 class="section-title">今日事实摘要</h2><ul class="list" style="margin-top:12px"><li class="list-item"><span>任务完成</span>' + statusBadge('2 项', 'success') + '</li><li class="list-item"><span>异常待跟进</span>' + statusBadge('1 项', 'warning') + '</li><li class="list-item"><span>敏感结论</span>' + statusBadge('不生成', 'neutral') + '</li></ul></div></div></div></div></section>';
  };

  const aiSteps = ['学生先尝试', '第0层', '第1层', '第2层', '第3层', '巩固层'];
  const renderAi = () => {
    const a = state.ai;
    const active = a.status === 'idle' ? 0 : a.status === 'complete' || a.status === 'teacher' ? 5 : Math.min(5, a.unlocked + 1);
    const layers = [
      ['0', '确认已知条件、目标与自己的尝试', '把题目中的已知条件和目标说出来。'],
      ['1', '提示知识点或方向', '想一想这是哪一种数量关系。'],
      ['2', '拆解一个关键步骤', '先找出第一步，再检查单位或顺序。'],
      ['3', '必要时讲解完整过程', '只在仍然需要时展开完整的模拟讲解。']
    ];
    let intro = '';
    if (a.status === 'idle') intro = renderAiGuards() + '<div class="notice" style="margin-top:14px"><p>家长或教师从学生档案开启；学生没有独立注册入口。</p></div>' + actionButton('开启受监督学习', 'ai-start', 'primary');
    else if (!a.attempted) intro = '<form class="stack" data-form="ai-attempt"><div class="notice notice--warning"><p><strong>先尝试。</strong>没有学生尝试，任何提示层都不能打开。</p></div><div class="field"><label for="ai-attempt">学生的模拟尝试</label><textarea id="ai-attempt" name="attempt" placeholder="例如：我先把 12 分成 3 份……">' + esc(a.attempted) + '</textarea></div>' + (a.error ? '<div class="field__error" role="alert">' + esc(a.error) + '</div>' : '') + '<button class="btn btn--primary" type="submit">记录尝试并进入第0层</button></form>';
    else intro = '<div class="notice notice--success"><p><strong>已记录学生尝试。</strong>提示按层级解锁，不能跳过第0层直接查看答案。</p></div>';
    const layerHtml = layers.map((layer, index) => {
      const lastUnderstood = a.understood.length ? a.understood[a.understood.length - 1] : -1;
      const skipped = lastUnderstood >= 0 && index > lastUnderstood;
      const available = a.attempted && a.unlocked >= index && !skipped;
      const complete = a.completed.indexOf(index) >= 0;
      const canOpen = available && !complete && !a.needsRetry && a.awaiting < 0;
      const branch = a.awaiting === index ? '<div class="flow-actions" style="margin-top:8px">' + actionButton('我已理解，进入巩固', 'ai-understood', 'primary', ' data-layer="' + index + '"') + actionButton('还需要帮助', 'ai-need-more', 'secondary', ' data-layer="' + index + '"') + '</div>' : '';
      return '<div class="ai-layer ' + (!available && !complete ? 'is-locked ' : '') + (complete ? 'is-complete' : '') + '"><span class="ai-layer__number">' + (complete ? icon('check', 'icon icon--sm') : layer[0]) + '</span><div><strong>' + esc(layer[1]) + '</strong><p class="card__meta">' + esc(layer[2]) + '</p>' + (a.needsRetry && complete && index < 3 ? '<p class="field__hint">等待学生重新尝试后解锁下一层。</p>' : '') + '</div>' +
        (complete ? statusBadge('已完成', 'success') + branch : canOpen ? actionButton('打开提示', 'ai-hint', 'secondary', ' data-layer="' + index + '"') : statusBadge(skipped ? '已理解，跳过' : available ? '等待重新尝试' : '锁定', 'neutral')) + '</div>';
    }).join('');
    const retry = a.needsRetry ? actionButton('记录一次重新尝试', 'ai-retry', 'primary') : '';
    const consolidation = '<div class="card card--pad" style="margin-top:14px"><div class="card__head"><div><span class="eyebrow">CONSOLIDATION</span><h2 class="section-title">巩固层 · 1—3 道同类题</h2></div>' + statusBadge(a.consolidation + ' / 3', a.consolidation > 0 ? 'success' : 'neutral') + '</div><p class="muted">完成至少 1 道即可生成最小学习摘要；不生成能力、纪律或绩效结论。</p><div class="flow-actions">' + actionButton('完成一道模拟巩固题', 'ai-consolidate', 'primary', a.unlocked < 4 || a.needsRetry || a.awaiting >= 0 ? ' disabled' : '') + (a.consolidation > 0 ? actionButton('转教师介入', 'ai-transfer', 'secondary') + actionButton('关闭会话', 'ai-close', 'quiet') : '') + '</div></div>';
    const end = a.status === 'teacher' ? '<div class="notice notice--success"><p><strong>已转教师介入。</strong>摘要正文只对授权教师可见。</p></div>' : a.status === 'closed' ? '<div class="notice notice--warning"><p><strong>会话已关闭。</strong>没有继续生成内容。</p></div>' : a.status === 'complete' ? '<div class="notice notice--success"><p><strong>巩固完成。</strong>可进入教师摘要回流页面。</p><a class="btn btn--primary" href="#/flow/ai-teacher-summary">查看教师摘要入口</a></div>' : '';
    return '<section class="section"><div class="card flow-panel" style="--accent: var(--coral)"><div class="flow-panel__status"><strong>监督式学习流程</strong>' + statusBadge(flowStatus(CATALOG.find((p) => p.id === 'B-FLOW-10')), a.status === 'complete' ? 'success' : 'info') + '<span class="muted">家长或教师监督 · 模拟题</span></div><div class="card--pad"><div class="stepper">' + aiSteps.map((label, i) => '<div class="step ' + (i === active ? 'is-active' : i < active ? 'is-done' : '') + '"><strong>' + (i + 1) + '</strong><br>' + label + '</div>').join('') + '</div><div style="margin-top:22px">' + (a.status === 'idle' ? intro : renderAiGuards() + intro) + '</div><div class="card card--pad" style="margin-top:18px"><div class="card__head"><div><span class="eyebrow">HINT LADDER</span><h2 class="section-title">按需打开提示</h2></div>' + statusBadge('不调用正式 AI', 'warning') + '</div>' + layerHtml + retry + '</div>' + consolidation + end + '</div></div></section>';
  };

  const renderAiSummary = () => {
    const ready = state.ai.summary || state.ai.status === 'teacher' || state.ai.status === 'complete';
    return '<section class="section"><div class="content-grid content-grid--2"><div class="card card--pad"><span class="eyebrow">TEACHER ONLY</span><h2 class="section-title">授权教师摘要</h2>' + (ready ? '<div class="notice notice--success"><p>摘要来自受监督模拟会话，只包含尝试、提示层和巩固结果。</p></div><ul class="list" style="margin-top:14px"><li class="list-item"><span>学生先尝试</span>' + statusBadge('已记录', 'success') + '</li><li class="list-item"><span>提示层</span>' + statusBadge('0 → 2', 'info') + '</li><li class="list-item"><span>巩固题</span>' + statusBadge('1 / 3', 'success') + '</li><li class="list-item"><span>自动能力标签</span>' + statusBadge('不生成', 'neutral') + '</li></ul><div class="flow-actions" style="margin-top:16px">' + actionButton('确认已阅', 'summary-read', 'primary') + actionButton('标记需介入', 'summary-intervene', 'secondary') + '</div>' : '<div class="empty-state"><img class="illustration" src="assets/illustrations/empty-state.svg" alt="空状态原创插画"><strong>尚无可回流摘要</strong><p class="muted">完成受监督会话或转教师后，这里才显示最小摘要。</p></div>') + '</div><div class="card card--pad"><img class="illustration" src="assets/illustrations/ai-learning.svg" alt="分层学习原创插画"><div class="notice notice--warning" style="margin-top:14px"><p>家长不接收摘要正文；机构管理端只看无正文审计元数据。</p></div></div></div></section>';
  };

  const renderSupervision = () => {
    const s = state.supervision;
    return '<section class="section"><div class="content-grid content-grid--2"><div class="card card--pad"><span class="eyebrow">GUARDIAN CONTROL</span><h2 class="section-title">监督与同意</h2><p class="muted">同意、机构开关和学生关系必须同时有效；关闭后不再创建会话。</p><div class="stack" style="margin-top:16px"><div class="list-item"><span>监护人同意</span>' + statusBadge(s.consent, s.consent === '已同意' ? 'success' : 'warning') + '</div><div class="list-item"><span>机构能力开关</span>' + statusBadge(s.institutionEnabled ? '已开启' : '未开启', s.institutionEnabled ? 'info' : 'warning') + '</div><div class="list-item"><span>会话开关</span>' + statusBadge(s.enabled ? '已开启' : '未开启', s.enabled ? 'success' : 'neutral') + '</div><div class="list-item"><span>学生关系</span>' + statusBadge(s.relationshipValid ? '有效' : '无效', s.relationshipValid ? 'success' : 'warning') + '</div><div class="list-item"><span>教师范围</span>' + statusBadge(s.teacherScopeValid ? '已授权' : '未授权', s.teacherScopeValid ? 'success' : 'neutral') + '</div></div><div class="flow-actions" style="margin-top:18px">' + actionButton('同意并开启', 'supervision-enable', 'primary') + actionButton('暂停会话', 'supervision-pause', 'secondary') + actionButton('关闭能力', 'supervision-close', 'danger') + '</div></div><div class="card card--pad"><span class="eyebrow">DATA CONTROL</span><h2 class="section-title">模拟数据删除请求</h2><p class="muted">删除请求与监督开关独立；不在原型中写入持久化数据。</p><div class="notice ' + (s.deletion === '已完成' ? 'notice--success' : '') + '"><p>当前状态：<strong>' + esc(s.deletion) + '</strong></p></div><div class="flow-actions" style="margin-top:18px">' + actionButton('提交删除请求', 'deletion-request', 'primary') + actionButton('模拟完成处理', 'deletion-complete', 'secondary') + actionButton('模拟拒绝并返回原因', 'deletion-reject', 'quiet') + '</div></div></div></section>';
  };

  const renderFlowPage = (page) => {
    if (page.id === 'B-FLOW-01') return renderBinding();
    if (page.id === 'B-FLOW-09') return renderReport();
    if (page.id === 'B-FLOW-10') return renderAi();
    if (page.id === 'B-FLOW-11') return renderAiSummary();
    if (page.id === 'B-FLOW-12') return renderSupervision();
    return renderGenericFlow(page);
  };

  const renderPageContent = (page) => {
    if (page.flow) return renderFlowPage(page);
    if (page.endpoint === 'admin') return renderAdminPage(page);
    if (page.route.startsWith('/web/visitor/')) return renderVisitorPage(page);
    if (page.group === '内部端' || page.group === '用户网页') return renderStaffPage(page);
    return renderVisitorPage(page);
  };

  const renderToast = () => state.toast ? '<div class="toast-region" role="status" aria-live="polite"><div class="toast">' + esc(state.toast.message) + '</div></div>' : '';

  const render = () => {
    const path = currentPath();
    const page = pageForPath(path);
    state.route = page.route;
    const endpoint = endpointClass(page.endpoint);
    app.innerHTML = '<div class="simulation-banner">Phase 1A 批次B高保真审查原型 · 全部内容为模拟数据 · 无真实登录、支付、后端、正式 AI 或外部请求</div><div class="app-shell ' + endpoint + '">' +
      renderSideNav(page) + '<div class="main-shell">' + renderTopbar(page) + '<main id="main-content" class="main-content">' +
      renderHero(page) + renderMetrics(page) + renderPageContent(page) + renderRouteDirectory() + renderPageFooter(page) + '</main></div></div>' + renderBottomNav(page) + renderToast();
    const select = document.getElementById('route-jump');
    if (select) select.addEventListener('change', (event) => { if (event.target.value) location.hash = event.target.value; });
  };

  const notify = (message) => {
    state.toast = { message: message };
    render();
    window.setTimeout(() => { state.toast = null; render(); }, 2600);
  };

  const rejectUnauthorized = () => notify('已拒绝：当前角色、租户或校区范围不足，未执行越权动作。');

  const handleAction = (element) => {
    const action = element.dataset.action;
    if (action === 'scroll-directory') { document.getElementById('route-directory')?.scrollIntoView({ behavior: 'smooth' }); return; }
    if (action === 'show-toast' || action === 'filter-demo' || action === 'select-campus' || action === 'admin-row') { notify('已完成模拟交互；没有外部请求或持久化写入。'); return; }
    if (action === 'reject-unauthorized') { rejectUnauthorized(); return; }
    if (action === 'admin-save') { state.adminActions[state.route] = '已保存模拟草稿'; render(); return; }
    if (action === 'generic-next') {
      const page = pageForPath(state.route);
      const stages = flowStages[page.id] || ['准备','处理中','待确认','已完成'];
      state.genericFlows[page.id] = Math.min(stages.length - 1, (state.genericFlows[page.id] || 0) + 1);
      render(); return;
    }
    if (action === 'generic-reset') { state.genericFlows[pageForPath(state.route).id] = 0; render(); return; }
    if (action === 'binding-start') { state.binding.step = 1; state.binding.error = ''; render(); return; }
    if (action === 'binding-reset') { state.binding = { step: 0, contact: '', invite: '', learner: '', group: '', error: '' }; render(); return; }
    if (action === 'binding-approve') { state.binding.step = 4; render(); return; }
    if (action === 'binding-reject') { state.binding.step = 3; render(); return; }
    if (action === 'binding-edit') { state.binding.step = 1; state.binding.error = ''; render(); return; }
    if (action === 'binding-release') { state.binding.step = 5; render(); return; }
    if (action === 'report-generate') { state.report.note = ''; state.report.error = ''; render(); notify('已生成新的模拟事实摘要。'); return; }
    if (action === 'report-confirm') { state.report.stage = 'confirmed'; render(); return; }
    if (action === 'report-return') { state.report.stage = 'returned'; render(); return; }
    if (action === 'report-reset') { state.report = { stage: 'draft', note: '', error: '' }; render(); return; }
    if (action === 'ai-context') {
      state.ai.role = element.dataset.role || 'visitor';
      state.supervision.relationshipValid = state.ai.role === 'guardian';
      state.supervision.teacherScopeValid = state.ai.role === 'teacher';
      state.ai.guardError = '';
      render(); return;
    }
    if (action === 'ai-start') {
      const guardError = aiGuardError();
      if (guardError) { state.ai.guardError = guardError; render(); return; }
      state.ai.guardError = ''; state.ai.status = 'active'; render(); return;
    }
    if (action === 'ai-hint') {
      const layer = Number(element.dataset.layer);
      if (aiGuardError() || !state.ai.attempted || layer !== state.ai.unlocked || state.ai.needsRetry || state.ai.awaiting >= 0) { state.ai.guardError = aiGuardError() || '当前提示层不在合法状态。'; render(); return; }
      state.ai.completed.push(layer);
      state.ai.needsRetry = layer === 0;
      state.ai.awaiting = layer === 1 || layer === 2 ? layer : -1;
      if (layer === 3) { state.ai.unlocked = 4; state.ai.needsRetry = false; }
      render(); return;
    }
    if (action === 'ai-retry') {
      if (aiGuardError() || !state.ai.needsRetry) { state.ai.guardError = aiGuardError() || '当前没有等待重新尝试的提示层。'; render(); return; }
      state.ai.needsRetry = false; state.ai.unlocked = Math.min(4, state.ai.unlocked + 1); render(); return;
    }
    if (action === 'ai-understood' || action === 'ai-need-more') {
      const layer = Number(element.dataset.layer);
      if (aiGuardError() || ![1, 2].includes(layer) || state.ai.awaiting !== layer) { state.ai.guardError = aiGuardError() || '理解分支不在合法状态。'; render(); return; }
      state.ai.awaiting = -1;
      if (action === 'ai-understood') { state.ai.understood.push(layer); state.ai.unlocked = 4; }
      else state.ai.unlocked = layer + 1;
      render(); return;
    }
    if (action === 'ai-consolidate') {
      if (aiGuardError() || state.ai.unlocked < 4 || state.ai.needsRetry || state.ai.awaiting >= 0) { state.ai.guardError = aiGuardError() || '必须完成合法提示路径后才能进入巩固层。'; render(); return; }
      state.ai.consolidation = Math.min(3, state.ai.consolidation + 1);
      state.ai.status = state.ai.consolidation > 0 ? 'complete' : 'active';
      state.ai.summary = true;
      render(); return;
    }
    if (action === 'ai-transfer') {
      if (aiGuardError() || state.ai.consolidation < 1) { state.ai.guardError = aiGuardError() || '必须先完成至少一道巩固题。'; render(); return; }
      state.ai.status = 'teacher'; state.ai.summary = true; location.hash = '/flow/ai-teacher-summary'; return;
    }
    if (action === 'ai-close') { state.ai.status = 'closed'; render(); return; }
    if (action === 'summary-read' || action === 'summary-intervene') { notify(action === 'summary-read' ? '已记录教师确认（模拟）。' : '已创建教师介入待办（模拟）。'); return; }
    if (action === 'supervision-enable') { state.supervision.consent = '已同意'; state.supervision.institutionEnabled = true; state.supervision.enabled = true; render(); return; }
    if (action === 'supervision-pause') { state.supervision.enabled = false; render(); return; }
    if (action === 'supervision-close') { state.supervision.enabled = false; state.supervision.institutionEnabled = false; state.supervision.consent = '已关闭'; render(); return; }
    if (action === 'deletion-request') { state.supervision.deletion = '待处理'; render(); return; }
    if (action === 'deletion-complete') { state.supervision.deletion = '已完成'; render(); return; }
    if (action === 'deletion-reject') { state.supervision.deletion = '已拒绝，可重提'; render(); return; }
  };

  const handleSubmit = (event) => {
    const form = event.target.closest('[data-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const type = form.dataset.form;
    if (type === 'binding') {
      state.binding.contact = String(data.get('contact') || '').trim();
      state.binding.invite = String(data.get('invite') || '').trim();
      state.binding.learner = String(data.get('learner') || '').trim();
      state.binding.group = String(data.get('group') || '').trim();
      if (!state.binding.contact || !state.binding.invite || !state.binding.learner || !state.binding.group) {
        state.binding.error = '请补齐四项模拟字段后再提交。'; render(); return;
      }
      state.binding.error = ''; state.binding.step = 2; render(); return;
    }
    if (type === 'report') {
      state.report.note = String(data.get('note') || '').trim();
      if (!state.report.note) { state.report.error = '请先补充一段模拟总结或交接内容。'; render(); return; }
      state.report.error = ''; state.report.stage = 'submitted'; render(); return;
    }
    if (type === 'ai-attempt') {
      state.ai.attempted = String(data.get('attempt') || '').trim();
      if (!state.ai.attempted) { state.ai.error = '必须先记录学生尝试，提示层才会解锁。'; render(); return; }
      state.ai.error = ''; state.ai.unlocked = 0; state.ai.status = 'active'; render(); return;
    }
    if (type === 'contact') { notify('模拟意向已提交；未保存真实信息，也未发送请求。'); return; }
    if (type === 'staff-login') { state.signedIn = true; location.hash = state.route.startsWith('/mini/') ? '/mini/staff/workbench' : '/web/staff/workbench'; return; }
    if (type === 'admin-login') { state.signedIn = true; location.hash = '/admin/dashboard'; return; }
  };

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (action) handleAction(action);
  });
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.toast) { state.toast = null; render(); }
  });
  window.addEventListener('hashchange', render);

  if (!location.hash) history.replaceState(null, '', '#/web/visitor/home');
  render();
})();
