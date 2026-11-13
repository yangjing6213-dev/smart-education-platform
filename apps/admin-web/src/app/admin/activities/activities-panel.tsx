const ACTIVITIES = [
  { title: "科学小实验", version: "v2", status: "已发布" },
  { title: "阅读分享", version: "v1", status: "草稿" },
] as const;

export function ActivitiesPanel() {
  return (
    <section aria-labelledby="activities-title" className="activities-panel">
      <header className="activities-header">
        <p className="activities-eyebrow">活动内容 · 模拟东校区</p>
        <h1 id="activities-title">活动</h1>
        <p>查看当前校区允许公开展示的活动说明。</p>
      </header>

      <ul aria-label="合成活动列表" className="activities-list">
        {ACTIVITIES.map((activity) => (
          <li className="activity-card" key={activity.title}>
            <p className="activities-eyebrow">
              模拟活动 · {activity.version} · {activity.status}
            </p>
            <div className="activity-card-heading">
              <h2>{activity.title}</h2>
              <span
                className={`activity-status activity-status-${activity.status === "草稿" ? "draft" : "published"}`}
              >
                {activity.status}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="activities-note">
        仅展示固定合成活动；本机演示不连接报名或外部服务，也不会发布真实内容。
      </p>
    </section>
  );
}
