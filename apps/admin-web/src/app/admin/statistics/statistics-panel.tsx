"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  isOperationalStatisticsProfile,
  OperationalStatisticsAdminClient,
  type AdminStatisticsProfile,
  type AdminStatisticsSnapshot,
} from "../../../local-review/statistics";
import styles from "./statistics-panel.module.css";

const PROFILE_OPTIONS: ReadonlyArray<{ value: AdminStatisticsProfile; label: string }> = [
  { value: "owner-east", label: "东校区负责人" },
  { value: "owner-west", label: "西校区负责人" },
  { value: "teacher-east", label: "东校区教师" },
  { value: "platform-admin", label: "平台管理员" },
];

const KIND_LABELS = {
  TASK: "工作任务",
  ATTENDANCE: "考勤",
  PICKUP_EXCEPTION: "接送异常",
  HEALTH_INCIDENT: "健康异常",
} as const;

const STATUS_LABELS: Readonly<Record<string, string>> = {
  ASSIGNED: "待处理",
  CLAIMED: "处理中",
  STARTED: "进行中",
  COMPLETED: "已完成",
  CHECKED: "已检查",
  ARRIVED: "已到校",
  DEPARTED: "已离校",
  OPEN: "待处理",
  RESOLVED: "已处理",
  CONFIRMED: "已确认",
  PUBLISHED: "已发布",
};

export function StatisticsPanel({ baseUrl }: Readonly<{ baseUrl: string }>) {
  const client = useMemo(
    () =>
      new OperationalStatisticsAdminClient((input, init) =>
        fetch(new URL(String(input), baseUrl), init),
      ),
    [baseUrl],
  );
  const [snapshot, setSnapshot] = useState<AdminStatisticsSnapshot>(client.snapshot);
  const [filters, setFilters] = useState({
    from: snapshot.filters.from,
    to: snapshot.filters.to,
    classId: "",
  });

  useEffect(() => {
    let active = true;
    void client.connect("owner-east").then(() => {
      if (active) setSnapshot(client.snapshot);
    });
    return () => {
      active = false;
      client.disconnect();
    };
  }, [client]);

  useEffect(() => {
    setFilters({
      from: snapshot.filters.from,
      to: snapshot.filters.to,
      classId: snapshot.filters.classId ?? "",
    });
  }, [snapshot.profile, snapshot.filters.from, snapshot.filters.to, snapshot.filters.classId]);

  async function run(operation: Promise<void>) {
    setSnapshot(client.snapshot);
    await operation;
    setSnapshot(client.snapshot);
  }

  async function connect(profile: AdminStatisticsProfile) {
    const pending = client.connect(profile);
    setSnapshot(client.snapshot);
    await pending;
    setFilters({ from: client.snapshot.filters.from, to: client.snapshot.filters.to, classId: "" });
    setSnapshot(client.snapshot);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(
      client.applyFilters({
        from: filters.from,
        to: filters.to,
        ...(filters.classId ? { classId: filters.classId } : {}),
      }),
    );
  }

  const busy = snapshot.status === "BUSY" || snapshot.status === "CONNECTING";
  const denied = snapshot.status === "DENIED";
  const disconnected = snapshot.status === "DISCONNECTED";
  const scoped = snapshot.status === "READY" && snapshot.mode === "SCOPED";
  const anonymous = snapshot.status === "READY" && snapshot.mode === "ANONYMOUS";

  return (
    <section aria-labelledby="statistics-title" className={`${styles.panel} statistics-panel`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>机构管理 · 本机合成数据</p>
          <h1 id="statistics-title">运营统计</h1>
          <p className={styles.description}>按授权范围查看任务、考勤、接送和健康异常的汇总。</p>
          <span className={styles.syntheticBadge}>模拟数据 · 仅本机展示</span>
        </div>
        <label className={styles.profileField}>
          管理身份
          <select
            aria-label="管理身份"
            disabled={busy}
            onChange={(event) => {
              const profile = event.currentTarget.value;
              if (isOperationalStatisticsProfile(profile)) void connect(profile);
            }}
            value={snapshot.profile ?? "owner-east"}
          >
            {PROFILE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <p aria-live="polite" className={styles.message} data-statistics-status role="status">
        {snapshot.message}
      </p>

      {denied ? (
        <section aria-label="无权查看统计" className={styles.stateCard}>
          <h2>当前身份无权查看统计内容</h2>
          <p>请切换到已授权的负责人身份。当前页面不会显示其他身份先前读取的数据。</p>
        </section>
      ) : null}

      {disconnected ? (
        <section aria-label="统计连接失败" className={styles.stateCard}>
          <h2>统计服务暂时无法连接</h2>
          <button
            className={styles.secondaryButton}
            onClick={() => snapshot.profile && void connect(snapshot.profile)}
            type="button"
          >
            重新连接
          </button>
        </section>
      ) : null}

      {scoped ? (
        <section
          aria-labelledby="statistics-scope-title"
          className={styles.results}
          data-operational-statistics
          data-statistics-mode="scoped"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>当前授权范围</p>
              <h2 id="statistics-scope-title">校区运营概况</h2>
              <p className={styles.description}>
                {snapshot.campusLabel} · 统计范围由当前身份决定，筛选项不能更改校区范围。
              </p>
            </div>
            <button
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => void run(client.refresh())}
              type="button"
            >
              刷新统计
            </button>
          </div>

          <dl aria-label="统计总量" className={styles.totals}>
            <div>
              <dt>工作任务</dt>
              <dd>{snapshot.totals.tasks}</dd>
            </div>
            <div>
              <dt>考勤</dt>
              <dd>{snapshot.totals.attendance}</dd>
            </div>
            <div>
              <dt>接送异常</dt>
              <dd>{snapshot.totals.pickupExceptions}</dd>
            </div>
            <div>
              <dt>健康异常</dt>
              <dd>{snapshot.totals.healthIncidents}</dd>
            </div>
            <div>
              <dt>统计总数</dt>
              <dd>{snapshot.totals.total}</dd>
            </div>
          </dl>

          <form className={styles.filterForm} data-statistics-filter onSubmit={applyFilters}>
            <label>
              开始日期
              <input
                disabled={busy}
                max={filters.to}
                name="from"
                onChange={(event) => setFilters({ ...filters, from: event.currentTarget.value })}
                type="date"
                value={filters.from}
              />
            </label>
            <label>
              结束日期
              <input
                disabled={busy}
                min={filters.from}
                name="to"
                onChange={(event) => setFilters({ ...filters, to: event.currentTarget.value })}
                type="date"
                value={filters.to}
              />
            </label>
            <label>
              班级
              <select
                disabled={busy}
                name="classId"
                onChange={(event) => setFilters({ ...filters, classId: event.currentTarget.value })}
                value={filters.classId}
              >
                <option value="">当前授权范围内全部班级</option>
                {snapshot.classOptions.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className={styles.primaryButton} disabled={busy} type="submit">
              应用筛选
            </button>
          </form>

          {snapshot.groups.length > 0 ? (
            <div aria-label="统计明细" className={styles.groupList}>
              {snapshot.groups.map((group) => (
                <article
                  className={styles.groupCard}
                  data-statistics-group
                  key={`${group.date}-${group.classId}-${group.kind}-${group.status}`}
                >
                  <div className={styles.groupHeading}>
                    <div>
                      <p className={styles.eyebrow}>{group.date}</p>
                      <h3>{group.classLabel}</h3>
                    </div>
                    <span className={styles.count}>{group.count} 条</span>
                  </div>
                  <p className={styles.groupStatus}>
                    {KIND_LABELS[group.kind]} · {STATUS_LABELS[group.status] ?? group.status}
                  </p>
                  <ul className={styles.sourceList}>
                    {group.sources.map((source) => (
                      <li data-statistics-source={source.id} key={source.id}>
                        来源编号 {source.id} · 第 {source.version} 版
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState} data-statistics-empty>
              当前筛选条件下暂无统计。
            </p>
          )}
        </section>
      ) : null}

      {anonymous ? (
        <section
          aria-labelledby="statistics-anonymous-title"
          className={styles.results}
          data-operational-statistics
          data-statistics-anonymous="true"
          data-statistics-mode="anonymous"
        >
          <p className={styles.eyebrow}>平台视图 · 匿名汇总</p>
          <h2 id="statistics-anonymous-title">匿名运营总量</h2>
          <p className={styles.description}>
            只显示本机模拟样本的分类数量，不包含校区、班级、日期、状态或来源明细。
          </p>
          <dl aria-label="匿名统计总量" className={styles.totals}>
            <div>
              <dt>工作任务</dt>
              <dd>{snapshot.totals.tasks}</dd>
            </div>
            <div>
              <dt>考勤</dt>
              <dd>{snapshot.totals.attendance}</dd>
            </div>
            <div>
              <dt>接送异常</dt>
              <dd>{snapshot.totals.pickupExceptions}</dd>
            </div>
            <div>
              <dt>健康异常</dt>
              <dd>{snapshot.totals.healthIncidents}</dd>
            </div>
            <div>
              <dt>统计总数</dt>
              <dd>{snapshot.totals.total}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {snapshot.status === "READY" ? (
        <p className={styles.footnote}>
          页面仅用于本机开发测试；统计数据为合成样本，不代表真实运营情况或学习效果。
        </p>
      ) : null}
    </section>
  );
}
