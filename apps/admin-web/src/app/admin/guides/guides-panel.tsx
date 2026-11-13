"use client";

import { useState } from "react";
import styles from "./guides-panel.module.css";

type Guide = Readonly<{
  id: string;
  title: string;
  summary: string;
  body: string;
  version: number;
  status: "PUBLISHED" | "DRAFT";
  reference: string;
}>;

const GUIDES: readonly Guide[] = [
  {
    id: "guide-welcome",
    title: "新成员指南",
    summary: "介绍报到、校区范围和内部支持入口。",
    body: "这是一份仅用于管理端本机展示的虚构内部指南。实际报到安排请以机构正式通知为准。",
    version: 2,
    status: "PUBLISHED",
    reference: "示例文件引用：new-member-guide.pdf",
  },
  {
    id: "guide-routine",
    title: "值班流程",
    summary: "查看模拟校区每日值班准备事项。",
    body: "这是一份仅用于管理端本机展示的虚构草稿，不包含真实学生或员工信息。",
    version: 1,
    status: "DRAFT",
    reference: "示例文件引用：duty-routine.pdf",
  },
];

const STATUS_LABEL: Readonly<Record<Guide["status"], string>> = {
  PUBLISHED: "已发布",
  DRAFT: "草稿",
};

export function GuidesPanel() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(GUIDES[0]?.id ?? "");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleGuides = GUIDES.filter((guide) =>
    `${guide.title} ${guide.summary}`.toLocaleLowerCase().includes(normalizedQuery),
  );
  const selectedGuide =
    visibleGuides.find((guide) => guide.id === selectedId) ?? visibleGuides[0] ?? null;

  return (
    <section aria-labelledby="guides-title" className={`guides-panel ${styles.panel}`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>内部内容 · 模拟东校区</p>
          <h1 id="guides-title">内部指南</h1>
          <p className={styles.description}>搜索当前校区可查看的指南，并查看版本和发布状态。</p>
        </div>
        <span className={styles.scope}>仅显示当前校区的虚构内部指南</span>
      </header>

      <div className={styles.layout}>
        <section aria-labelledby="guide-list-title" className={styles.card}>
          <h2 id="guide-list-title">指南列表</h2>
          <label className={styles.searchLabel} htmlFor="guide-search">
            搜索指南
          </label>
          <input
            autoComplete="off"
            className={styles.search}
            id="guide-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入标题或摘要"
            type="search"
            value={query}
          />
          {visibleGuides.length > 0 ? (
            <ul aria-label="指南搜索结果" className={styles.list}>
              {visibleGuides.map((guide) => (
                <li key={guide.id}>
                  <button
                    aria-pressed={selectedGuide?.id === guide.id}
                    className={styles.result}
                    data-guide-id={guide.id}
                    onClick={() => setSelectedId(guide.id)}
                    type="button"
                  >
                    <span className={styles.resultTitle}>{guide.title}</span>
                    <span className={styles.resultMeta}>
                      v{guide.version} · {STATUS_LABEL[guide.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty} role="status">
              没有匹配的指南。
            </p>
          )}
        </section>

        <section
          aria-labelledby="guide-detail-title"
          className={`guide-detail ${styles.card} ${styles.detail}`}
        >
          <h2 id="guide-detail-title">指南详情</h2>
          {selectedGuide ? (
            <>
              <h3 className={styles.detailTitle}>{selectedGuide.title}</h3>
              <p className={styles.summary}>{selectedGuide.summary}</p>
              <p className={styles.body}>{selectedGuide.body}</p>
              <dl className={styles.metadata}>
                <div>
                  <dt>版本</dt>
                  <dd>v{selectedGuide.version}</dd>
                </div>
                <div>
                  <dt>发布状态</dt>
                  <dd>{STATUS_LABEL[selectedGuide.status]}</dd>
                </div>
                <div>
                  <dt>资料引用</dt>
                  <dd>{selectedGuide.reference}</dd>
                </div>
              </dl>
              <p className={styles.note}>仅展示本机合成资料，不提供真实文件下载。</p>
            </>
          ) : (
            <p className={styles.empty} role="status">
              搜索条件没有对应的指南详情，请调整搜索词。
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
