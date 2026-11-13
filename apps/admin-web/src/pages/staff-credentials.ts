import {
  CREDENTIAL_CATEGORY_LABELS,
  CREDENTIAL_ROLE_LABELS,
  SYNTHETIC_CREDENTIAL_STAFF,
  type CredentialCategory,
  type CredentialDraft,
  type CredentialResponsibleRole,
  type StaffCredential,
  type StaffCredentialStore,
} from "../local-synthetic/staff-credentials.js";

const EXPIRY_LABELS = {
  EXPIRED: "已过期",
  DUE_SOON: "即将到期（30 天内）",
  VALID: "有效",
  INVALID_DATE: "日期无效",
} as const;

function makeElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className !== undefined) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function addSelectField<K extends string>(
  form: HTMLFormElement,
  labelText: string,
  name: string,
  options: readonly (readonly [K, string])[],
  selected: string,
  disabled: boolean,
): void {
  const label = makeElement("label", "field", labelText);
  const select = makeElement("select");
  select.name = name;
  select.required = true;
  select.disabled = disabled;
  for (const [value, text] of options) {
    const option = makeElement("option", undefined, text);
    option.value = value;
    option.selected = value === selected;
    select.append(option);
  }
  label.append(select);
  form.append(label);
}

function addDateField(
  form: HTMLFormElement,
  labelText: string,
  name: "issueDate" | "expiryDate",
  value: string,
  disabled: boolean,
): void {
  const label = makeElement("label", "field", labelText);
  const input = makeElement("input");
  input.type = "date";
  input.name = name;
  input.value = value;
  input.required = true;
  input.disabled = disabled;
  label.append(input);
  form.append(label);
}

function readDraft(form: HTMLFormElement, staffId?: string): CredentialDraft {
  const values = new FormData(form);
  return {
    staffId: staffId ?? String(values.get("staffId") ?? ""),
    category: String(values.get("category") ?? "") as CredentialCategory,
    issueDate: String(values.get("issueDate") ?? ""),
    expiryDate: String(values.get("expiryDate") ?? ""),
    responsibleRole: String(values.get("responsibleRole") ?? "") as CredentialResponsibleRole,
  };
}

function showResult(
  result: ReturnType<StaffCredentialStore["create"]>,
  onChange: (message: string) => void,
): void {
  onChange(
    result.ok
      ? "资格材料已保存。状态仅作到期提醒，不影响员工状态。"
      : result.error === "VERSION_CONFLICT"
        ? "记录版本已变化，请刷新后再修改。"
        : "日期或固定选项无效，未保存。",
  );
}

function recordCard(
  record: StaffCredential,
  store: StaffCredentialStore,
  editable: boolean,
  onChange: (message: string) => void,
): HTMLElement {
  const card = makeElement("article", "panel");
  const title = makeElement("h3", undefined, record.staffName);
  const summary = makeElement(
    "p",
    "summary",
    `${CREDENTIAL_CATEGORY_LABELS[record.category]} · 模拟东校区 · 版本 ${record.version}`,
  );
  const expiry = makeElement(
    "p",
    "notice",
    `${record.issueDate} 至 ${record.expiryDate} · ${EXPIRY_LABELS[record.expiryStatus]}`,
  );
  const responsible = makeElement(
    "p",
    "notice",
    `责任岗位：${CREDENTIAL_ROLE_LABELS[record.responsibleRole]}`,
  );
  card.append(title, summary, expiry, responsible);

  if (editable) {
    const details = makeElement("details");
    details.append(makeElement("summary", undefined, "更新这条记录"));
    const form = makeElement("form", "actions");
    addSelectField(
      form,
      "材料类别",
      "category",
      Object.entries(CREDENTIAL_CATEGORY_LABELS) as [CredentialCategory, string][],
      record.category,
      false,
    );
    addDateField(form, "签发日期", "issueDate", record.issueDate, false);
    addDateField(form, "到期日期", "expiryDate", record.expiryDate, false);
    addSelectField(
      form,
      "责任岗位",
      "responsibleRole",
      Object.entries(CREDENTIAL_ROLE_LABELS) as [CredentialResponsibleRole, string][],
      record.responsibleRole,
      false,
    );
    const save = makeElement("button", "save", "保存变更");
    save.type = "submit";
    form.append(save);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const result = store.update(record.id, record.version, readDraft(form, record.staffId));
      showResult(result, onChange);
    });
    details.append(form);
    card.append(details);
  }

  const historyHeading = makeElement("h4", undefined, "更新记录");
  const history = makeElement("ul");
  for (const event of record.history) {
    const action = event.action === "CREATED" ? "建立" : "更新";
    history.append(
      makeElement("li", undefined, `${event.date} · ${action} · 版本 ${event.version}`),
    );
  }
  card.append(historyHeading, history);
  return card;
}

export function createStaffCredentialsSection(
  store: StaffCredentialStore,
  editable: boolean,
  notice: string,
  onChange: (message: string) => void,
): HTMLElement {
  const section = makeElement("section", "panel");
  section.dataset.staffCredentials = "true";
  section.append(makeElement("h2", undefined, "资格材料与到期提醒"));
  section.append(
    makeElement(
      "p",
      "summary",
      "只显示固定合成资料；不上传证件或附件。到期状态仅作提醒，不自动改变员工状态。",
    ),
  );
  section.append(makeElement("p", "notice", notice));

  const form = makeElement("form", "actions");
  form.dataset.credentialCreate = "true";
  const staffOptions = SYNTHETIC_CREDENTIAL_STAFF.map((staff) => [staff.id, staff.name] as const);
  const categoryOptions = Object.entries(CREDENTIAL_CATEGORY_LABELS) as [
    CredentialCategory,
    string,
  ][];
  const roleOptions = Object.entries(CREDENTIAL_ROLE_LABELS) as [
    CredentialResponsibleRole,
    string,
  ][];
  addSelectField(form, "员工", "staffId", staffOptions, staffOptions[0]?.[0] ?? "", !editable);
  addSelectField(form, "材料类别", "category", categoryOptions, "TEACHER_QUALIFICATION", !editable);
  addDateField(form, "签发日期", "issueDate", "", !editable);
  addDateField(form, "到期日期", "expiryDate", "", !editable);
  addSelectField(form, "责任岗位", "responsibleRole", roleOptions, "CAMPUS_OWNER", !editable);
  const create = makeElement("button", "publish", "新增资格材料");
  create.type = "submit";
  create.disabled = !editable;
  form.append(create);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!editable) return;
    showResult(store.create(readDraft(form)), onChange);
  });
  section.append(form);

  for (const record of store.list()) {
    section.append(recordCard(record, store, editable, onChange));
  }
  return section;
}
