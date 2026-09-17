export type AuditLogPageStatus = "LOADING" | "EMPTY" | "DENIED" | "ERROR" | "READY";

export interface AuditLogEventViewModel {
  readonly event_id: string;
  readonly actor_id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly action: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly occurred_at: string;
  readonly correlation_id: string;
  readonly trace_id: string;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
  readonly synthetic_data: true;
}

export interface AuditLogsPageState {
  readonly status: AuditLogPageStatus;
  readonly events: readonly AuditLogEventViewModel[];
}

export interface AuditLogRow {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly actorReference: string;
  readonly action: string;
  readonly targetReference: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
  readonly syntheticData: true;
}

export type AuditLogsMessage =
  | "LOADING_AUDIT_EVENTS"
  | "NO_AUDIT_EVENTS"
  | "ACCESS_DENIED"
  | "AUDIT_LOGS_UNAVAILABLE"
  | "AUDIT_EVENTS_READY";

export interface AuditLogsPageView {
  readonly route: "/admin/audit-logs";
  readonly heading: "Operation logs and audit";
  readonly filters: readonly [
    "ACTION",
    "ACTOR_REFERENCE",
    "TARGET_REFERENCE",
    "OCCURRED_AT",
    "CORRELATION_ID",
    "TRACE_ID",
  ];
  readonly columns: readonly [
    "OCCURRED_AT",
    "ACTOR_REFERENCE",
    "ACTION",
    "TARGET_REFERENCE",
    "CORRELATION_ID",
    "TRACE_ID",
    "REDACTED_METADATA",
  ];
  readonly availableActions: readonly ["REFRESH"];
  readonly message: AuditLogsMessage;
  readonly rows: readonly AuditLogRow[];
}

const FILTERS = Object.freeze([
  "ACTION",
  "ACTOR_REFERENCE",
  "TARGET_REFERENCE",
  "OCCURRED_AT",
  "CORRELATION_ID",
  "TRACE_ID",
] as const);

const COLUMNS = Object.freeze([
  "OCCURRED_AT",
  "ACTOR_REFERENCE",
  "ACTION",
  "TARGET_REFERENCE",
  "CORRELATION_ID",
  "TRACE_ID",
  "REDACTED_METADATA",
] as const);

const AVAILABLE_ACTIONS = Object.freeze(["REFRESH"] as const);

function messageFor(status: AuditLogPageStatus, eventCount: number): AuditLogsMessage {
  if (status === "LOADING") return "LOADING_AUDIT_EVENTS";
  if (status === "DENIED") return "ACCESS_DENIED";
  if (status === "ERROR") return "AUDIT_LOGS_UNAVAILABLE";
  if (status === "EMPTY" || eventCount === 0) return "NO_AUDIT_EVENTS";
  return "AUDIT_EVENTS_READY";
}

export function AuditLogsPage(state: AuditLogsPageState): AuditLogsPageView {
  const rows =
    state.status === "READY"
      ? state.events.map((event) => ({
          eventId: event.event_id,
          occurredAt: event.occurred_at,
          actorReference: event.actor_id,
          action: event.action,
          targetReference: `${event.target_type}:${event.target_id}`,
          correlationId: event.correlation_id,
          traceId: event.trace_id,
          metadata: { ...event.metadata },
          syntheticData: true as const,
        }))
      : [];

  return {
    route: "/admin/audit-logs",
    heading: "Operation logs and audit",
    filters: FILTERS,
    columns: COLUMNS,
    availableActions: AVAILABLE_ACTIONS,
    message: messageFor(state.status, rows.length),
    rows,
  };
}
