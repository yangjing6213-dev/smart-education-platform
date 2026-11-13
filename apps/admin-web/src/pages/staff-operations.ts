import {
  STAFF_OPERATION_LABELS,
  STAFF_OPERATION_OPTIONS,
  type PerformanceReviewStatus,
  type RecruitmentLead,
  type StaffOperationRole,
  type StaffOperationsSnapshot,
  type StaffPerformanceReview,
  type StaffWorkMaterial,
  type WorkMaterialStatus,
} from "../local-synthetic/staff-operations.js";

type StaffOperationsStore = ReturnType<
  typeof import("../local-synthetic/staff-operations.js").createStaffOperationsStore
>;

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function addSelect(
  form: HTMLFormElement,
  labelText: string,
  name: string,
  options: readonly (readonly [string, string])[],
  selected: string,
  disabled: boolean,
): void {
  const label = node("label", "field", labelText);
  const select = node("select");
  select.name = name;
  select.required = true;
  select.disabled = disabled;
  for (const [value, text] of options) {
    const option = node("option", undefined, text);
    option.value = value;
    option.selected = value === selected;
    select.append(option);
  }
  label.append(select);
  form.append(label);
}

function addDate(
  form: HTMLFormElement,
  labelText: string,
  name: "period" | "nextFollowUpDate",
  type: "month" | "date",
  value: string,
  disabled: boolean,
): void {
  const label = node("label", "field", labelText);
  const input = node("input");
  input.type = type;
  input.name = name;
  input.value = value;
  input.required = true;
  input.disabled = disabled;
  label.append(input);
  form.append(label);
}

function materialCard(
  record: StaffWorkMaterial,
  editable: boolean,
  review: (id: string, version: number, status: WorkMaterialStatus) => void,
): HTMLElement {
  const card = node("article", "panel");
  card.dataset.workMaterialId = record.id;
  card.append(
    node("h3", undefined, STAFF_OPERATION_LABELS.staff[record.staffId]),
    node(
      "p",
      "summary",
      `${record.period} · ${STAFF_OPERATION_LABELS.materialCategory[record.category]} · ${STAFF_OPERATION_LABELS.responsibleRole[record.responsibleRole]}`,
    ),
    node("p", "notice", STAFF_OPERATION_LABELS.materialStatus[record.status]),
  );
  if (record.status === "PENDING_REVIEW") {
    const actions = node("div", "actions");
    for (const [status, label] of STAFF_OPERATION_OPTIONS.materialStatus) {
      const button = node("button", status === "REVIEWED" ? "publish" : "save", label);
      button.type = "button";
      button.dataset.workMaterialAction = status;
      button.disabled = !editable;
      button.addEventListener("click", () => review(record.id, record.version, status));
      actions.append(button);
    }
    card.append(actions);
  }
  card.append(node("p", "notice", `版本 ${record.version} · 历史变更 ${record.history.length} 次`));
  return card;
}

function performanceReviewCard(
  record: StaffPerformanceReview,
  editable: boolean,
  review: (id: string, version: number, status: PerformanceReviewStatus) => void,
): HTMLElement {
  const card = node("article", "panel");
  const history =
    record.history
      .map(
        (entry) =>
          `v${entry.version} ${STAFF_OPERATION_LABELS.performanceReviewStatus[entry.status]}`,
      )
      .join(" → ") || "暂无状态变更";
  card.dataset.performanceReviewId = record.id;
  card.append(
    node("h3", undefined, STAFF_OPERATION_LABELS.staff[record.staffId]),
    node(
      "p",
      "summary",
      `${record.period} · ${STAFF_OPERATION_LABELS.performanceArea[record.area]}`,
    ),
    node(
      "p",
      "notice",
      `${STAFF_OPERATION_LABELS.performanceOutcome[record.outcome]} · 支持措施：${STAFF_OPERATION_LABELS.performanceSupportAction[record.supportAction]}`,
    ),
    node("p", "notice", STAFF_OPERATION_LABELS.performanceReviewStatus[record.status]),
  );
  if (record.status === "PENDING_REVIEW") {
    const actions = node("div", "actions");
    for (const [status, label] of STAFF_OPERATION_OPTIONS.performanceReviewStatus) {
      const button = node("button", status === "CONFIRMED" ? "publish" : "save", label);
      button.type = "button";
      button.dataset.performanceReviewAction = status;
      button.disabled = !editable;
      button.addEventListener("click", () => review(record.id, record.version, status));
      actions.append(button);
    }
    card.append(actions);
  }
  card.append(node("p", "notice", `版本 ${record.version} · 历史：${history}`));
  return card;
}

function recruitmentCard(
  lead: RecruitmentLead,
  editable: boolean,
  save: (id: string, version: number, stage: string, date: string) => void,
): HTMLElement {
  const card = node("article", "panel");
  card.dataset.recruitmentLead = lead.id;
  card.append(
    node("h3", undefined, lead.alias),
    node(
      "p",
      "summary",
      `${STAFF_OPERATION_LABELS.position[lead.position]} · ${STAFF_OPERATION_LABELS.source[lead.source]}`,
    ),
    node(
      "p",
      "notice",
      `${STAFF_OPERATION_LABELS.recruitmentStage[lead.stage]} · 下次跟进 ${lead.nextFollowUpDate} · ${STAFF_OPERATION_LABELS.responsibleRole[lead.responsibleRole]}`,
    ),
  );
  const form = node("form", "actions");
  form.dataset.recruitmentUpdate = "true";
  addSelect(
    form,
    "跟进阶段",
    "stage",
    STAFF_OPERATION_OPTIONS.recruitmentStage,
    lead.stage,
    !editable,
  );
  addDate(form, "下次跟进日期", "nextFollowUpDate", "date", lead.nextFollowUpDate, !editable);
  const button = node("button", "save", "保存跟进");
  button.type = "submit";
  button.disabled = !editable;
  form.append(button);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(form);
    save(
      lead.id,
      lead.version,
      String(values.get("stage") ?? ""),
      String(values.get("nextFollowUpDate") ?? ""),
    );
  });
  card.append(
    form,
    node("p", "notice", `版本 ${lead.version} · 历史变更 ${lead.history.length} 次`),
  );
  return card;
}

export function createStaffOperationsSection(
  store: StaffOperationsStore,
  editable: boolean,
): HTMLElement {
  const section = node("section", "panel");
  section.dataset.staffOperations = "true";
  let message = editable
    ? "仅展示合成资料；工作回顾由负责人手动记录，不打分、不排名、不影响员工权益。"
    : "当前为只读权限，不能修改工作材料、工作回顾或招聘进度。";

  const render = (): void => {
    section.replaceChildren(
      node("h2", undefined, "员工工作材料与招聘跟进"),
      node(
        "p",
        "summary",
        "仅使用本校区合成资料。材料由负责人人工核对；招聘阶段由负责人手动维护，不作录用建议。",
      ),
      node("p", "notice", message),
      node("h3", undefined, "员工工作材料"),
    );

    const materialForm = node("form", "actions");
    materialForm.dataset.workMaterialCreate = "true";
    addSelect(
      materialForm,
      "员工",
      "staffId",
      STAFF_OPERATION_OPTIONS.staff,
      STAFF_OPERATION_OPTIONS.staff[0][0],
      !editable,
    );
    addDate(materialForm, "月份", "period", "month", "2026-10", !editable);
    addSelect(
      materialForm,
      "材料类别",
      "category",
      STAFF_OPERATION_OPTIONS.materialCategory,
      STAFF_OPERATION_OPTIONS.materialCategory[0][0],
      !editable,
    );
    addSelect(
      materialForm,
      "责任岗位",
      "responsibleRole",
      STAFF_OPERATION_OPTIONS.responsibleRole,
      "CAMPUS_OWNER",
      !editable,
    );
    const createMaterial = node("button", "publish", "新增工作材料");
    createMaterial.type = "submit";
    createMaterial.disabled = !editable;
    materialForm.append(createMaterial);
    materialForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!editable) return;
      const values = new FormData(materialForm);
      const result = store.createWorkMaterial({
        staffId: String(values.get("staffId") ?? ""),
        period: String(values.get("period") ?? ""),
        category: String(values.get("category") ?? ""),
        responsibleRole: String(values.get("responsibleRole") ?? "") as StaffOperationRole,
      });
      message = result.ok
        ? "材料已建立，等待负责人人工核对。"
        : "资料未变更，请核对固定选项和日期后重试。";
      render();
    });
    section.append(materialForm);

    const snapshot: StaffOperationsSnapshot = store.snapshot;
    for (const record of snapshot.workMaterials) {
      section.append(
        materialCard(record, editable, (id, version, status) => {
          if (!editable) return;
          const result = store.reviewWorkMaterial(id, version, status);
          message = result.ok
            ? "人工核对结果已记录；不会自动改变员工权益。"
            : "记录已变化，请刷新后再操作。";
          render();
        }),
      );
    }

    section.append(
      node("h3", undefined, "员工工作回顾"),
      node(
        "p",
        "summary",
        "仅供内部沟通与支持安排；只用固定选项，不计算分数、不自动评价，也不用于薪酬或任用决定。",
      ),
    );
    const performanceForm = node("form", "actions");
    performanceForm.dataset.performanceReviewCreate = "true";
    addSelect(
      performanceForm,
      "员工",
      "staffId",
      STAFF_OPERATION_OPTIONS.staff,
      STAFF_OPERATION_OPTIONS.staff[0][0],
      !editable,
    );
    addDate(performanceForm, "月份", "period", "month", "2026-11", !editable);
    addSelect(
      performanceForm,
      "工作领域",
      "area",
      STAFF_OPERATION_OPTIONS.performanceArea,
      STAFF_OPERATION_OPTIONS.performanceArea[0][0],
      !editable,
    );
    addSelect(
      performanceForm,
      "人工回顾",
      "outcome",
      STAFF_OPERATION_OPTIONS.performanceOutcome,
      STAFF_OPERATION_OPTIONS.performanceOutcome[0][0],
      !editable,
    );
    addSelect(
      performanceForm,
      "支持措施",
      "supportAction",
      STAFF_OPERATION_OPTIONS.performanceSupportAction,
      STAFF_OPERATION_OPTIONS.performanceSupportAction[0][0],
      !editable,
    );
    const createReview = node("button", "publish", "新增工作回顾");
    createReview.type = "submit";
    createReview.disabled = !editable;
    performanceForm.append(createReview);
    performanceForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!editable) return;
      const values = new FormData(performanceForm);
      const result = store.createPerformanceReview({
        staffId: String(values.get("staffId") ?? ""),
        period: String(values.get("period") ?? ""),
        area: String(values.get("area") ?? ""),
        outcome: String(values.get("outcome") ?? ""),
        supportAction: String(values.get("supportAction") ?? ""),
      });
      message = result.ok
        ? "工作回顾已建立，等待负责人手动复核。"
        : "记录未变化，请核对固定选项和月份后重试。";
      render();
    });
    section.append(performanceForm);

    for (const record of snapshot.performanceReviews) {
      section.append(
        performanceReviewCard(record, editable, (id, version, status) => {
          if (!editable) return;
          const result = store.reviewPerformanceReview(id, version, status);
          message = result.ok
            ? "人工复核状态已记录；不会自动改变员工权益。"
            : "记录已变化，请刷新后再操作。";
          render();
        }),
      );
    }

    section.append(node("h3", undefined, "招聘跟进"));
    const leadForm = node("form", "actions");
    leadForm.dataset.recruitmentCreate = "true";
    addSelect(
      leadForm,
      "岗位",
      "position",
      STAFF_OPERATION_OPTIONS.position,
      STAFF_OPERATION_OPTIONS.position[0][0],
      !editable,
    );
    addSelect(
      leadForm,
      "来源",
      "source",
      STAFF_OPERATION_OPTIONS.source,
      STAFF_OPERATION_OPTIONS.source[0][0],
      !editable,
    );
    addSelect(
      leadForm,
      "责任岗位",
      "responsibleRole",
      STAFF_OPERATION_OPTIONS.responsibleRole,
      "CAMPUS_OWNER",
      !editable,
    );
    addDate(leadForm, "下次跟进日期", "nextFollowUpDate", "date", "2026-10-20", !editable);
    const createLead = node("button", "publish", "新增合成候选人");
    createLead.type = "submit";
    createLead.disabled = !editable;
    leadForm.append(createLead);
    leadForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!editable) return;
      const values = new FormData(leadForm);
      const result = store.createRecruitmentLead({
        position: String(values.get("position") ?? ""),
        source: String(values.get("source") ?? ""),
        responsibleRole: String(values.get("responsibleRole") ?? ""),
        nextFollowUpDate: String(values.get("nextFollowUpDate") ?? ""),
      });
      message = result.ok
        ? "合成候选人已加入跟进列表。"
        : "资料未变更，请核对固定选项和日期后重试。";
      render();
    });
    section.append(leadForm);

    for (const lead of snapshot.recruitmentLeads) {
      section.append(
        recruitmentCard(lead, editable, (id, version, stage, date) => {
          if (!editable) return;
          const result = store.updateRecruitmentLead(id, version, {
            stage,
            nextFollowUpDate: date,
          });
          message = result.ok ? "招聘跟进已更新并保留版本记录。" : "记录已变化，请刷新后再操作。";
          render();
        }),
      );
    }
  };

  render();
  return section;
}
