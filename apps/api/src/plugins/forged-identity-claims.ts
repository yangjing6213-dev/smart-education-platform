const FORGED_IDENTITY_QUERY_FIELDS = ["actor_id", "identity_id", "role", "roles"];
const FORGED_IDENTITY_HEADERS = ["x-actor-id", "x-identity-id", "x-role", "x-roles"];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function containsForgedIdentityClaim(query: unknown, headers: unknown): boolean {
  const queryRecord = asRecord(query);
  const headerRecord = asRecord(headers);

  return (
    FORGED_IDENTITY_QUERY_FIELDS.some((field) => field in queryRecord) ||
    FORGED_IDENTITY_HEADERS.some((header) => headerRecord[header] !== undefined)
  );
}
