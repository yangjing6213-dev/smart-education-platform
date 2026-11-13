import Link from "next/link";

const QUICK_LINKS = [
  {
    href: "/admin/binding-review",
    title: "家长关系审核",
    description: "查看家长提交的关系申请。",
  },
  {
    href: "/admin/care-record-review",
    title: "成长记录审核与发布",
    description: "审核成长记录，再决定是否向家长开放。",
  },
  {
    href: "/admin/home-content",
    title: "首页内容管理",
    description: "编辑本机展示内容并查看发布状态。",
  },
  {
    href: "/admin/public-teachers",
    title: "教师介绍管理",
    description: "维护模拟教师介绍的本机展示状态。",
  },
] as const;

export function InstitutionOverviewPanel() {
  return (
    <section aria-labelledby="institution-overview-title" className="institution-overview-panel">
      <header className="institution-overview-header">
        <p className="institution-overview-eyebrow">机构概览 · 本机模拟资料</p>
        <h1 id="institution-overview-title">机构概览</h1>
        <p>查看当前模拟范围，并直接进入常用管理工作。</p>
      </header>

      <dl aria-label="当前合成范围" className="institution-overview-scope">
        <div>
          <dt>机构</dt>
          <dd>模拟机构</dd>
        </div>
        <div>
          <dt>校区</dt>
          <dd>模拟东校区</dd>
        </div>
      </dl>

      <section
        aria-labelledby="institution-overview-shortcuts"
        className="institution-overview-work"
      >
        <div className="institution-overview-section-heading">
          <div>
            <p className="institution-overview-eyebrow">常用工作</p>
            <h2 id="institution-overview-shortcuts">从这里继续</h2>
          </div>
          <span>4 个已接入页面</span>
        </div>
        <ul className="institution-overview-links">
          {QUICK_LINKS.map((item) => (
            <li key={item.href}>
              <Link className="institution-overview-link" href={item.href}>
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>
                <span aria-hidden="true" className="institution-overview-arrow">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="institution-overview-note">
        本页只展示本机模拟资料；链接不会连接真实机构服务，也不会执行真实审核或发布。
      </p>
    </section>
  );
}
