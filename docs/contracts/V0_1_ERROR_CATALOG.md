# V0.1 Error Catalog

Status: stable transport error contract for Phase 1B planning.

All errors use HTTP JSON with `request_id`, a stable `code`, a safe user-facing `message`, and optional structured `details`. Details never contain SQL, stack traces, credentials, raw prompts, or child free text.

| Code | HTTP | Meaning | Retry | Audit |
|---|---:|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session or service identity | after authentication | yes |
| `FORBIDDEN_ROLE` | 403 | Role lacks the route capability | no | yes |
| `FORBIDDEN_SCOPE` | 403 | Tenant, campus, or object is outside resolved scope | no | yes |
| `NOT_FOUND_SCOPED` | 404 | Object is absent or intentionally hidden by scope | no | yes |
| `VALIDATION_FAILED` | 400 | Syntax, field, size, or enum validation failed | after correction | no |
| `CONSENT_REQUIRED` | 403 | Guardian or teacher supervision is missing | after consent | yes |
| `CONFLICT_STATE` | 409 | Requested workflow transition is not legal | after current-state review | yes |
| `VERSION_MISMATCH` | 409 | Optimistic version is stale | after refresh | yes |
| `IDEMPOTENCY_REPLAY_MISMATCH` | 409 | Key was reused with a different request | no | yes |
| `RATE_LIMITED` | 429 | Route quota exceeded | bounded retry | yes |
| `FILE_TYPE_REJECTED` | 415 | Media type or signature is not permitted | no | yes |
| `FILE_SCAN_PENDING` | 409 | File is not available until scanning completes | later poll | yes |
| `AI_SAFETY_BLOCKED` | 422 | Safety gateway rejected or could not classify output | no automatic retry | yes |
| `PROVIDER_UNAVAILABLE` | 503 | Approved provider adapter is unavailable | bounded retry | yes |
| `DELETION_PENDING` | 409 | Data access is closed while deletion workflow runs | later poll | yes |
| `INTERNAL_ERROR` | 500 | Unexpected server failure | bounded retry with request ID | yes |

## Mapping rules

Authentication and scope errors do not reveal whether another tenant's object exists. State errors return the current public state version only. Provider errors are translated into the catalog before leaving the API. A retry is safe only when the endpoint declares idempotency and the same key and body are reused.
