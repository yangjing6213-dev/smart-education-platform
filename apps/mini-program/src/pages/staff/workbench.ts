import { getStaffRoute, getStaffScope, type StaffAccessInput } from "../../routes/staff.routes.ts";

export type SyntheticStaffRecord = {
  id: string;
  tenantId: string;
  campusId: string;
  title: string;
  dataKind: "SYNTHETIC" | "REAL";
  status: "PUBLISHED" | "DRAFT" | "UNPUBLISHED";
  enabled: boolean;
  visibility: "PUBLIC" | "PRIVATE";
  stale: boolean;
};

export type WorkbenchProjection = {
  status: "READY" | "EMPTY" | "DENIED";
  focusOrder: string[];
  items: Array<{ id: string; title: string; kind: "SYNTHETIC" }>;
};

export function buildWorkbenchProjection(
  input: StaffAccessInput,
  records: readonly unknown[],
): WorkbenchProjection {
  const scope = getStaffScope(input);
  if (!scope || !getStaffRoute(input, "workbench", scope).allowed) {
    return { status: "DENIED", focusOrder: [], items: [] };
  }

  const items = records
    .filter((record): record is SyntheticStaffRecord =>
      isSafeSyntheticRecord(record, scope.tenantId, scope.campusId),
    )
    .map(({ id, title }) => ({ id, title, kind: "SYNTHETIC" as const }));

  return {
    status: items.length > 0 ? "READY" : "EMPTY",
    focusOrder: ["workbench", "quick-action"],
    items,
  };
}

function isSafeSyntheticRecord(
  value: unknown,
  tenantId: string,
  campusId: string,
): value is SyntheticStaffRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<SyntheticStaffRecord>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.title === "string" &&
    record.title.length > 0 &&
    record.tenantId === tenantId &&
    record.campusId === campusId &&
    record.dataKind === "SYNTHETIC" &&
    record.status === "PUBLISHED" &&
    record.enabled === true &&
    record.visibility === "PUBLIC" &&
    record.stale === false
  );
}
