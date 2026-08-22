# V0.1 Observability and Operations Baseline

Status: approved design baseline for Phase 1B planning only.

## Structured logs

Each request log contains timestamp, level, service, environment, request ID, correlation ID, route template, method, status, duration, actor class, tenant scope hash, and error code. It must not contain child names, contact details, free text, raw prompts, tokens, signed URLs, or full request bodies.

## Metrics

Required metrics include request count and latency by route class, error count by stable code, authentication denials, policy denials, tenant-scope mismatches, upload scan failures, job retries, outbox lag, database pool saturation, cache health, and learning safety decisions. Labels are bounded and never contain IDs or free text.

## Audit events

Audit events are append-only and include actor, tenant, campus when applicable, action, object type, object ID, result, reason code, request ID, and timestamp. Child content is referenced by opaque ID and is not copied into the event. Read access to sensitive summaries is auditable as well as writes.

## Health and alerting

Liveness checks process availability only. Readiness checks database, cache, migration compatibility, and required adapters without exposing credentials. Alerts cover sustained 5xx, authorization-denial spikes, cross-scope mismatch, queue growth, storage failures, and backup verification failure. Alert payloads are redacted.

## Operations procedures

An incident record names impact scope, start time, evidence location, containment action, owner, and recovery verification. Operators use least privilege and time-limited access. A support action against child content requires a separately approved audited grant, which is not enabled in V0.1.
