"use client";

import { useState, type FormEvent } from "react";
import {
  createStaffOperationsStore,
  STAFF_OPERATION_LABELS,
  STAFF_OPERATION_OPTIONS,
  type OperationResult,
  type StaffOperationsSnapshot,
} from "../../../local-synthetic/staff-operations";
import styles from "./staff-operations.module.css";

export function StaffOperationsPanel() {
  const [store] = useState(() => createStaffOperationsStore());
  const [snapshot, setSnapshot] = useState<StaffOperationsSnapshot>(() => store.snapshot);
  const [feedback, setFeedback] = useState("仅使用固定选项维护本校区的模拟资料。");

  function applyResult<T>(result: OperationResult<T>, successMessage: string) {
    if (!result.ok) {
      setFeedback("记录没有保存，请检查所选内容后重试。");
      return;
    }
    setSnapshot(store.snapshot);
    setFeedback(successMessage);
  }

  function createWorkMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    applyResult(
      store.createWorkMaterial({
        staffId: values.get("staffId"),
        period: values.get("period"),
        category: values.get("category"),
        responsibleRole: values.get("responsibleRole"),
      }),
      "工作材料已加入待人工核对列表。",
    );
    if (store.snapshot.workMaterials.length > snapshot.workMaterials.length) form.reset();
  }

  function createPerformanceReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    applyResult(
      store.createPerformanceReview({
        staffId: values.get("staffId"),
        period: values.get("period"),
        area: values.get("area"),
        outcome: values.get("outcome"),
        supportAction: values.get("supportAction"),
      }),
      "工作回顾已加入负责人复核列表。",
    );
    if (store.snapshot.performanceReviews.length > snapshot.performanceReviews.length) form.reset();
  }

  function createRecruitmentLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    applyResult(
      store.createRecruitmentLead({
        position: values.get("position"),
        source: values.get("source"),
        responsibleRole: values.get("responsibleRole"),
        nextFollowUpDate: values.get("nextFollowUpDate"),
      }),
      "招聘跟进对象已加入列表。",
    );
    if (store.snapshot.recruitmentLeads.length > snapshot.recruitmentLeads.length) form.reset();
  }

  return (
    <div className={styles.content} data-staff-operations>
      <p aria-live="polite" className={styles.feedback}>
        {feedback}
      </p>

      <section aria-labelledby="materials-title" className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>固定选项 · 人工核对</p>
            <h2 id="materials-title">员工工作材料</h2>
          </div>
          <span>{snapshot.workMaterials.length} 条记录</span>
        </header>
        <form className={styles.form} data-work-material-form onSubmit={createWorkMaterial}>
          <label>
            员工
            <select name="staffId" defaultValue={STAFF_OPERATION_OPTIONS.staff[0][0]}>
              {STAFF_OPERATION_OPTIONS.staff.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            月份
            <input defaultValue="2026-10" name="period" required type="month" />
          </label>
          <label>
            材料类别
            <select name="category" defaultValue={STAFF_OPERATION_OPTIONS.materialCategory[0][0]}>
              {STAFF_OPERATION_OPTIONS.materialCategory.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            负责人岗位
            <select
              name="responsibleRole"
              defaultValue={STAFF_OPERATION_OPTIONS.responsibleRole[0][0]}
            >
              {STAFF_OPERATION_OPTIONS.responsibleRole.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.primaryButton} type="submit">
            新增工作材料
          </button>
        </form>
        <div className={styles.records}>
          {snapshot.workMaterials.map((record, index) => (
            <article className={styles.record} data-work-material-row={index} key={record.id}>
              <div>
                <h3>{STAFF_OPERATION_LABELS.staff[record.staffId]}</h3>
                <p>
                  {record.period} · {STAFF_OPERATION_LABELS.materialCategory[record.category]} ·{" "}
                  {STAFF_OPERATION_LABELS.responsibleRole[record.responsibleRole]}
                </p>
              </div>
              <span className={styles.status} data-material-status={record.status}>
                {STAFF_OPERATION_LABELS.materialStatus[record.status]}
              </span>
              {record.status === "PENDING_REVIEW" ? (
                <div className={styles.actions}>
                  <button
                    className={styles.secondaryButton}
                    onClick={() =>
                      applyResult(
                        store.reviewWorkMaterial(record.id, record.version, "REVIEWED"),
                        "工作材料已标记为已核对。",
                      )
                    }
                    type="button"
                  >
                    确认已核对
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() =>
                      applyResult(
                        store.reviewWorkMaterial(record.id, record.version, "NEEDS_FOLLOW_UP"),
                        "工作材料已标记为需跟进。",
                      )
                    }
                    type="button"
                  >
                    标记需跟进
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="reviews-title" className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>不打分 · 负责人复核</p>
            <h2 id="reviews-title">人工工作回顾</h2>
          </div>
          <span>{snapshot.performanceReviews.length} 条记录</span>
        </header>
        <form
          className={styles.form}
          data-performance-review-form
          onSubmit={createPerformanceReview}
        >
          <label>
            员工
            <select name="staffId" defaultValue={STAFF_OPERATION_OPTIONS.staff[0][0]}>
              {STAFF_OPERATION_OPTIONS.staff.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            月份
            <input defaultValue="2026-10" name="period" required type="month" />
          </label>
          <label>
            工作方面
            <select name="area" defaultValue={STAFF_OPERATION_OPTIONS.performanceArea[0][0]}>
              {STAFF_OPERATION_OPTIONS.performanceArea.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            回顾结果
            <select name="outcome" defaultValue={STAFF_OPERATION_OPTIONS.performanceOutcome[0][0]}>
              {STAFF_OPERATION_OPTIONS.performanceOutcome.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            支持安排
            <select
              name="supportAction"
              defaultValue={STAFF_OPERATION_OPTIONS.performanceSupportAction[0][0]}
            >
              {STAFF_OPERATION_OPTIONS.performanceSupportAction.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.primaryButton} type="submit">
            新增工作回顾
          </button>
        </form>
        <div className={styles.records}>
          {snapshot.performanceReviews.map((record, index) => (
            <article className={styles.record} data-performance-review-row={index} key={record.id}>
              <div>
                <h3>{STAFF_OPERATION_LABELS.staff[record.staffId]}</h3>
                <p>
                  {record.period} · {STAFF_OPERATION_LABELS.performanceArea[record.area]} ·{" "}
                  {STAFF_OPERATION_LABELS.performanceOutcome[record.outcome]}
                </p>
                <p>
                  支持安排：{STAFF_OPERATION_LABELS.performanceSupportAction[record.supportAction]}
                </p>
              </div>
              <span className={styles.status} data-performance-status={record.status}>
                {STAFF_OPERATION_LABELS.performanceReviewStatus[record.status]}
              </span>
              {record.status === "PENDING_REVIEW" ? (
                <div className={styles.actions}>
                  <button
                    className={styles.secondaryButton}
                    onClick={() =>
                      applyResult(
                        store.reviewPerformanceReview(record.id, record.version, "CONFIRMED"),
                        "工作回顾已由负责人确认。",
                      )
                    }
                    type="button"
                  >
                    确认记录
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() =>
                      applyResult(
                        store.reviewPerformanceReview(record.id, record.version, "FOLLOW_UP"),
                        "工作回顾已标记为需持续跟进。",
                      )
                    }
                    type="button"
                  >
                    标记需持续跟进
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="recruitment-title" className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>虚构别名 · 不作录用判断</p>
            <h2 id="recruitment-title">招聘跟进</h2>
          </div>
          <span>{snapshot.recruitmentLeads.length} 条记录</span>
        </header>
        <form className={styles.form} data-recruitment-form onSubmit={createRecruitmentLead}>
          <label>
            岗位
            <select name="position" defaultValue={STAFF_OPERATION_OPTIONS.position[0][0]}>
              {STAFF_OPERATION_OPTIONS.position.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            来源
            <select name="source" defaultValue={STAFF_OPERATION_OPTIONS.source[0][0]}>
              {STAFF_OPERATION_OPTIONS.source.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            负责人岗位
            <select
              name="responsibleRole"
              defaultValue={STAFF_OPERATION_OPTIONS.responsibleRole[0][0]}
            >
              {STAFF_OPERATION_OPTIONS.responsibleRole.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            下次跟进日期
            <input defaultValue="2026-10-25" name="nextFollowUpDate" required type="date" />
          </label>
          <button className={styles.primaryButton} type="submit">
            新增跟进对象
          </button>
        </form>
        <div className={styles.records}>
          {snapshot.recruitmentLeads.map((record, index) => (
            <article className={styles.record} data-recruitment-row={index} key={record.id}>
              <div>
                <h3>{record.alias}</h3>
                <p>
                  {STAFF_OPERATION_LABELS.position[record.position]} ·{" "}
                  {STAFF_OPERATION_LABELS.source[record.source]} ·{" "}
                  {STAFF_OPERATION_LABELS.responsibleRole[record.responsibleRole]}
                </p>
              </div>
              <form
                className={styles.followUpForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget);
                  applyResult(
                    store.updateRecruitmentLead(record.id, record.version, {
                      stage: values.get("stage"),
                      nextFollowUpDate: values.get("nextFollowUpDate"),
                    }),
                    "招聘跟进进度已保存。",
                  );
                }}
              >
                <label>
                  跟进阶段
                  <select defaultValue={record.stage} name="stage">
                    {STAFF_OPERATION_OPTIONS.recruitmentStage.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  下次跟进日期
                  <input
                    defaultValue={record.nextFollowUpDate}
                    name="nextFollowUpDate"
                    required
                    type="date"
                  />
                </label>
                <button className={styles.secondaryButton} type="submit">
                  保存跟进
                </button>
                <span data-recruitment-stage={record.stage}>
                  当前阶段：{STAFF_OPERATION_LABELS.recruitmentStage[record.stage]} · 下次跟进：
                  {record.nextFollowUpDate}
                </span>
              </form>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
