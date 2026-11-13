export type ParentLearningStudent = {
  readonly studentId: string;
  readonly studentLabel: string;
  readonly classLabel: string;
};

export type ParentLearningStudentSummary = {
  readonly studentId: string;
  readonly studentLabel: string;
  readonly usedMinutes: number;
  readonly sessionCount: number;
  readonly completedSessions: number;
  readonly knowledgePoints: readonly {
    readonly label: string;
    readonly sessionCount: number;
    readonly completedSessions: number;
  }[];
  readonly attentionCount: number;
};

export type ParentLearningSettings = {
  readonly enabled: boolean;
  readonly maxDurationMinutes: number;
  readonly maxHintLevel: number;
};

export type ParentLearningControl = ParentLearningSettings & {
  readonly studentId: string;
  readonly studentLabel: string;
  readonly contactStatus: "NOT_REQUESTED" | "RECORDED_LOCAL";
};

export type ParentLearningProjection = {
  readonly approvedStudents: readonly ParentLearningStudent[];
  readonly parentSummary: readonly ParentLearningStudentSummary[];
  readonly parentSummaryUpdatedAt: string;
  readonly parentControls?: readonly ParentLearningControl[];
};

export function selectParentLearningStudent(
  projection: ParentLearningProjection | null,
  selectedStudentId: string | null,
): ParentLearningStudent | null {
  if (!projection?.approvedStudents.length) return null;
  return (
    projection.approvedStudents.find((student) => student.studentId === selectedStudentId) ??
    projection.approvedStudents[0] ??
    null
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function validSettings(
  value: Record<string, unknown>,
): value is Record<string, unknown> & ParentLearningSettings {
  return (
    typeof value.enabled === "boolean" &&
    typeof value.maxDurationMinutes === "number" &&
    [5, 10, 15].includes(value.maxDurationMinutes) &&
    typeof value.maxHintLevel === "number" &&
    [0, 1, 2, 3].includes(value.maxHintLevel)
  );
}

function parseControl(value: unknown): ParentLearningControl | null {
  if (
    !object(value) ||
    !hasExactKeys(value, [
      "studentId",
      "studentLabel",
      "enabled",
      "maxDurationMinutes",
      "maxHintLevel",
      "contactStatus",
    ]) ||
    typeof value.studentId !== "string" ||
    !UUID.test(value.studentId) ||
    typeof value.studentLabel !== "string" ||
    !value.studentLabel.trim() ||
    !validSettings(value) ||
    (value.contactStatus !== "NOT_REQUESTED" && value.contactStatus !== "RECORDED_LOCAL")
  )
    return null;
  return {
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    enabled: value.enabled,
    maxDurationMinutes: value.maxDurationMinutes,
    maxHintLevel: value.maxHintLevel,
    contactStatus: value.contactStatus,
  };
}

function parseStudent(value: unknown): ParentLearningStudent | null {
  if (
    !object(value) ||
    !hasExactKeys(value, ["studentId", "studentLabel", "classLabel"]) ||
    typeof value.studentId !== "string" ||
    !UUID.test(value.studentId) ||
    typeof value.studentLabel !== "string" ||
    !value.studentLabel.trim() ||
    typeof value.classLabel !== "string"
  )
    return null;
  return {
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    classLabel: value.classLabel,
  };
}

function parseKnowledgePoint(
  value: unknown,
): ParentLearningStudentSummary["knowledgePoints"][number] | null {
  if (
    !object(value) ||
    !hasExactKeys(value, ["label", "sessionCount", "completedSessions"]) ||
    typeof value.label !== "string" ||
    !value.label.trim() ||
    !nonNegativeInteger(value.sessionCount) ||
    !nonNegativeInteger(value.completedSessions)
  )
    return null;
  return {
    label: value.label,
    sessionCount: value.sessionCount,
    completedSessions: value.completedSessions,
  };
}

function parseStudentSummary(value: unknown): ParentLearningStudentSummary | null {
  if (
    !object(value) ||
    !hasExactKeys(value, [
      "studentId",
      "studentLabel",
      "usedMinutes",
      "sessionCount",
      "completedSessions",
      "knowledgePoints",
      "attentionCount",
    ]) ||
    typeof value.studentId !== "string" ||
    !UUID.test(value.studentId) ||
    typeof value.studentLabel !== "string" ||
    !value.studentLabel.trim() ||
    !nonNegativeInteger(value.usedMinutes) ||
    !nonNegativeInteger(value.sessionCount) ||
    !nonNegativeInteger(value.completedSessions) ||
    !nonNegativeInteger(value.attentionCount) ||
    !Array.isArray(value.knowledgePoints)
  )
    return null;
  const knowledgePoints = value.knowledgePoints.map(parseKnowledgePoint);
  if (knowledgePoints.some((point) => point === null)) return null;
  return {
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    usedMinutes: value.usedMinutes,
    sessionCount: value.sessionCount,
    completedSessions: value.completedSessions,
    knowledgePoints: knowledgePoints as ParentLearningStudentSummary["knowledgePoints"],
    attentionCount: value.attentionCount,
  };
}

export function parseParentLearningProjection(value: unknown): ParentLearningProjection | null {
  if (
    !object(value) ||
    !hasExactKeys(value, [
      "approvedStudents",
      "parentSummary",
      "parentSummaryUpdatedAt",
      ...(Object.prototype.hasOwnProperty.call(value, "parentControls") ? ["parentControls"] : []),
    ]) ||
    !Array.isArray(value.approvedStudents) ||
    !Array.isArray(value.parentSummary) ||
    typeof value.parentSummaryUpdatedAt !== "string" ||
    Number.isNaN(Date.parse(value.parentSummaryUpdatedAt))
  )
    return null;

  const approvedStudents = value.approvedStudents.map(parseStudent);
  const parentSummary = value.parentSummary.map(parseStudentSummary);
  if (
    approvedStudents.some((student) => student === null) ||
    parentSummary.some((row) => row === null)
  )
    return null;

  const students = approvedStudents as ParentLearningStudent[];
  const summaries = parentSummary as ParentLearningStudentSummary[];
  const approvedById = new Map(students.map((student) => [student.studentId, student]));
  if (approvedById.size !== students.length || summaries.length > approvedById.size) return null;

  const summaryIds = new Set<string>();
  for (const row of summaries) {
    const approved = approvedById.get(row.studentId);
    if (!approved || approved.studentLabel !== row.studentLabel || summaryIds.has(row.studentId))
      return null;
    summaryIds.add(row.studentId);
  }

  let controls: ParentLearningControl[] | undefined;
  if (Object.prototype.hasOwnProperty.call(value, "parentControls")) {
    if (!Array.isArray(value.parentControls) || value.parentControls.length !== students.length)
      return null;
    const controlIds = new Set<string>();
    controls = [];
    for (const candidate of value.parentControls) {
      const control = parseControl(candidate);
      if (
        !control ||
        !approvedById.has(control.studentId) ||
        approvedById.get(control.studentId)?.studentLabel !== control.studentLabel ||
        controlIds.has(control.studentId)
      )
        return null;
      controlIds.add(control.studentId);
      controls.push(control);
    }
  }

  return {
    approvedStudents: students,
    parentSummary: summaries,
    parentSummaryUpdatedAt: value.parentSummaryUpdatedAt,
    ...(controls === undefined ? {} : { parentControls: controls }),
  };
}

export async function saveParentLearningControls(
  write: (path: string, body: unknown) => Promise<unknown>,
  control: ParentLearningControl,
  settings: ParentLearningSettings,
): Promise<ParentLearningControl> {
  const current = parseControl(control);
  if (
    !current ||
    !object(settings) ||
    !hasExactKeys(settings, ["enabled", "maxDurationMinutes", "maxHintLevel"]) ||
    !validSettings(settings)
  )
    throw new Error("学习监督设置无效，请重新读取后再试。");
  const body = {
    enabled: settings.enabled,
    maxDurationMinutes: settings.maxDurationMinutes,
    maxHintLevel: settings.maxHintLevel,
  };
  const response = await write(`/parent/learning/${current.studentId}/controls`, body);
  if (
    !object(response) ||
    !hasExactKeys(response, [
      "studentId",
      "studentLabel",
      "enabled",
      "maxDurationMinutes",
      "maxHintLevel",
    ]) ||
    response.studentId !== current.studentId ||
    response.studentLabel !== current.studentLabel ||
    response.enabled !== body.enabled ||
    response.maxDurationMinutes !== body.maxDurationMinutes ||
    response.maxHintLevel !== body.maxHintLevel
  )
    throw new Error("保存结果暂时无法确认，请重新读取后再试。");
  return { ...current, ...body };
}

export async function requestParentLearningContact(
  write: (path: string, body: unknown) => Promise<unknown>,
  control: ParentLearningControl,
): Promise<ParentLearningControl> {
  const current = parseControl(control);
  if (!current) throw new Error("学习监督设置无效，请重新读取后再试。");
  const response = await write(`/parent/learning/${current.studentId}/contact`, {});
  if (
    !object(response) ||
    !hasExactKeys(response, ["studentId", "studentLabel", "status"]) ||
    response.studentId !== current.studentId ||
    response.studentLabel !== current.studentLabel ||
    response.status !== "RECORDED_LOCAL"
  )
    throw new Error("联系意向暂时无法确认，请重新读取后再试。");
  return { ...current, contactStatus: "RECORDED_LOCAL" };
}

export async function loadParentLearningSummary(
  read: (path: string) => Promise<unknown>,
): Promise<ParentLearningProjection> {
  const projection = parseParentLearningProjection(await read("/parent/learning"));
  if (!projection) throw new Error("家长学习摘要格式暂不可用，请稍后重试。");
  return projection;
}
