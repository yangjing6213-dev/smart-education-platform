"use client";

import { useState } from "react";
import {
  PublicTeacherIntroductionsPage,
  type PublicTeacherEditorState,
} from "../../../pages/public-teachers";

const INITIAL_TEACHER: PublicTeacherEditorState = {
  profileId: "synthetic-teacher-east",
  displayName: "模拟教师甲",
  headline: "小学数学教师",
  subjects: ["数学"],
  bio: "专注于用耐心和清晰的步骤陪伴孩子学习。此介绍为虚构内容。",
  version: 1,
  status: "DRAFT",
  canPublish: true,
};

const STATUS_LABEL: Readonly<Record<PublicTeacherEditorState["status"], string>> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  UNPUBLISHED: "已下架",
  CONFLICT: "待处理冲突",
};

export function PublicTeachersPanel() {
  const [state, setState] = useState(INITIAL_TEACHER);
  const [notice, setNotice] = useState("内容仅保存在当前页面；刷新后恢复初始虚构资料。");
  const view = PublicTeacherIntroductionsPage(state);
  const actionsDisabled = !view.state.canPublish || state.status === "CONFLICT";

  function updateText(field: "displayName" | "headline" | "bio", value: string) {
    setState((current) => ({ ...current, [field]: value, status: "DRAFT" }));
  }

  function saveDraft() {
    setState((current) => ({
      ...current,
      status: "DRAFT",
      version: current.version + 1,
    }));
    setNotice("草稿已保存（本机演示状态）");
  }

  function publish() {
    if (actionsDisabled) return;
    setState((current) => ({
      ...current,
      status: "PUBLISHED",
      version: current.version + 1,
    }));
    setNotice("介绍已发布（本机演示状态）");
  }

  function unpublish() {
    if (actionsDisabled) return;
    setState((current) => ({
      ...current,
      status: "UNPUBLISHED",
      version: current.version + 1,
    }));
    setNotice("介绍已下架（本机演示状态）");
  }

  return (
    <section
      aria-labelledby="public-teachers-title"
      className="public-teachers-panel home-content-panel"
    >
      <header className="pickup-review-header">
        <p className="pickup-review-eyebrow">教师介绍 · 本机合成资料</p>
        <h1 id="public-teachers-title">教师介绍管理</h1>
        <p>仅展示虚构教师介绍。草稿、发布和下架状态只在当前页面有效，不会对外发布。</p>
      </header>

      <div className="home-content-layout public-teachers-layout">
        <article className="home-content-card">
          <h2>介绍内容</h2>
          <div className="public-teacher-fields">
            <label className="public-teacher-field">
              教师姓名
              <input
                aria-label="教师姓名"
                onChange={(event) => updateText("displayName", event.target.value)}
                value={state.displayName}
              />
            </label>
            <label className="public-teacher-field">
              介绍标题
              <input
                aria-label="介绍标题"
                onChange={(event) => updateText("headline", event.target.value)}
                value={state.headline}
              />
            </label>
            <label className="public-teacher-field">
              任教科目
              <input
                aria-label="任教科目"
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    subjects: event.target.value
                      .split(/[、,，]/u)
                      .map((subject) => subject.trim())
                      .filter(Boolean),
                    status: "DRAFT",
                  }))
                }
                value={state.subjects.join("、")}
              />
            </label>
            <label className="public-teacher-field">
              教师简介
              <textarea
                aria-label="教师简介"
                onChange={(event) => updateText("bio", event.target.value)}
                rows={5}
                value={state.bio}
              />
            </label>
          </div>
        </article>

        <aside aria-label="发布状态" className="home-content-card">
          <h2>发布状态</h2>
          <dl className="home-content-meta public-teacher-meta">
            <div>
              <dt>当前状态</dt>
              <dd className="public-teacher-status">{STATUS_LABEL[view.state.status]}</dd>
            </div>
            <div>
              <dt>版本</dt>
              <dd data-public-teacher-version>v{view.state.version}</dd>
            </div>
          </dl>
          <div aria-label="介绍操作" className="home-content-actions public-teacher-actions">
            <button onClick={saveDraft} type="button">
              {view.saveAction}
            </button>
            <button data-primary="true" disabled={actionsDisabled} onClick={publish} type="button">
              {view.publishAction}
            </button>
            <button disabled={actionsDisabled} onClick={unpublish} type="button">
              {view.unpublishAction}
            </button>
          </div>
          <p aria-live="polite" className="home-content-notice" role="status">
            {notice}
          </p>
        </aside>
      </div>
    </section>
  );
}
