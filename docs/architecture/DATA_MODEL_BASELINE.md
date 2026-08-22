# V0.1 Data Model Baseline

Status: approved design baseline for Phase 1B planning only.

## Core entities

| Entity | Required identity and scope | Important state or fields |
|---|---|---|
| `account` | `id`, timestamps | provider-independent identity, display label, status |
| `tenant` | `id`, timestamps | name, status, retention policy reference |
| `campus` | `id`, `tenant_id` | name, status, timezone |
| `membership` | `id`, `tenant_id`, `account_id` | role set, campus set, status, version |
| `student_profile` | `id`, `tenant_id`, optional `campus_id` | synthetic label, status, supervision flags |
| `guardian_student_relation` | `id`, `tenant_id`, `student_id`, `guardian_account_id` | `PENDING`, `ACTIVE`, `RELEASE_REQUESTED`, `RELEASED`, reason metadata |
| `content_item` | `id`, `tenant_id`, optional `campus_id` | type, draft/published state, version, public fields |
| `care_record` | `id`, `tenant_id`, `campus_id`, `student_id` | date, bounded summary, visibility policy |
| `task` | `id`, `tenant_id`, `campus_id` | assignee, state, due time, completion reason |
| `daily_report` | `id`, `tenant_id`, `campus_id`, `author_id` | draft, submitted, returned, confirmed, version |
| `pickup_authorization` | `id`, `tenant_id`, `campus_id`, `student_id` | grant, verification state, expiry |
| `learning_session` | `id`, `tenant_id`, `student_id` | supervision state, attempt state, hint level, consolidation count |
| `learning_summary` | `id`, `tenant_id`, `student_id`, `teacher_id` | redacted facts, review state, source session |
| `file_object` | `id`, `tenant_id`, optional `campus_id` | object key, media type, byte size, scan state, retention state |
| `audit_event` | `id`, `tenant_id`, optional `campus_id` | actor, action, object reference, result, correlation ID |

## Constraints

Every tenant-owned table has a non-null tenant foreign key. Campus references must belong to the same tenant. Relationship and content uniqueness keys include tenant scope. State updates use an expected version and reject stale writes. Deletes of child-related records are policy operations that create an audit event; direct unrestricted deletes are unavailable to application routes.

## Privacy rules

V0.1 fixtures use synthetic labels and values that cannot identify a real child or family. Free text is bounded, redacted before any learning summary, and excluded from operational logs. A student profile is not a user login. A guardian relationship is not inferred from a name, phone number, or imported file.

## Lifecycle

Published content is immutable by version. Care records and learning sessions have retention classes. A deletion request creates a tracked workflow, removes access first, then schedules provider-specific erasure after review. Audit metadata is retained separately from child content and does not reproduce the deleted content.

## Transaction rules

Binding, release, task transitions, report confirmation, pickup verification, hint unlocking, and summary publication are single-transaction state changes with an audit event. Cross-context notifications use an outbox record carrying an idempotency key.
