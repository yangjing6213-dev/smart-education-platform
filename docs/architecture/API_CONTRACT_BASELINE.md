# V0.1 API Contract Baseline

Status: approved design baseline for Phase 1B planning only.

## Transport

The API is JSON over HTTPS under `/api/v1`. Every response includes `request_id`. Success responses use `{ "data": ... }`; collection responses also include `page` and `page_size`. Errors use the shared shape in `V0_1_ERROR_CATALOG.md` and never expose stack traces, SQL, provider tokens, or private child content.

## Request rules

- JSON body size is limited by route class; the default is 256 KiB.
- All identifiers are opaque UUIDs or server-issued cursors.
- List endpoints use bounded `page_size` with a maximum of 100 and stable ordering.
- Mutating requests that can be retried require an `Idempotency-Key`; the server stores the result for the defined replay window.
- `tenant_id`, `campus_id`, role, actor, and permission fields are never trusted from a client body.
- Optimistic writes require `If-Match` or a body `version` validated against the stored version.

## Resource groups

| Group | Representative resources | Scope |
|---|---|---|
| Identity | `/me`, `/memberships` | account and membership |
| Public content | `/public/institution`, `/public/teachers`, `/public/activities`, `/public/meals` | published tenant content |
| Management | `/admin/content`, `/admin/files`, `/admin/audit-events` | tenant and campus policy |
| Care | `/care-records`, `/tasks`, `/daily-reports`, `/pickup-authorizations` | campus and relationship policy |
| Guardian | `/guardian/relationships`, `/guardian/supervision` | guardian relationship |
| Learning | `/learning/sessions`, `/learning/hints`, `/learning/consolidation`, `/learning/summaries` | supervised student scope |

## State and errors

State-changing endpoints return the new resource version and audit reference. Invalid transitions return `CONFLICT_STATE`; a policy denial returns `FORBIDDEN_SCOPE` or `FORBIDDEN_ROLE`; malformed input returns `VALIDATION_FAILED`; a stale idempotency key returns `IDEMPOTENCY_REPLAY_MISMATCH`. Error codes are stable contracts, while human messages are localized presentation text.

## Compatibility

Adding optional response fields is backward compatible. Removing or changing field meaning requires a new API version and a migration note. Contract schemas are tested against recorded synthetic fixtures. Provider-specific errors are translated at the adapter boundary.

## AI endpoint boundary

Learning routes accept only a supervised session ID and the student's recorded attempt. They do not accept an arbitrary prompt or a requested answer. The response contains a hint level, safe content classification, and next allowed action. Teacher summaries require a separate capability and contain no raw model prompt or hidden chain-of-thought.
