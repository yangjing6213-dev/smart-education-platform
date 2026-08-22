# V0.1 System Architecture Baseline

Status: approved design baseline for Phase 1B planning only.

## Logical request path

```text
mini program / user web / admin web
        -> API route adapter
        -> authentication and membership resolver
        -> tenant and campus scope resolver
        -> authorization policy
        -> application command or query
        -> domain state transition
        -> PostgreSQL transaction
        -> audit event and optional job
```

Reads follow the same identity and scope path. A response is assembled from a scoped query; clients never receive an unrestricted table or object-storage listing.

## Bounded contexts

1. Identity and membership: accounts, membership status, roles, and session claims.
2. Institution content: institution profile, home content, public teacher profiles, activities, meals, guides, and resources.
3. Care operations: student care summaries, leave, pickup authorization, tasks, and daily reports.
4. Guardian relationship: supervised binding and release state machine.
5. Learning assistance: attempt capture, hint ladder, consolidation, teacher summary, and supervision controls.
6. Files and audit: scoped file metadata, signed access, audit events, and retention decisions.

## Synchronous and asynchronous work

User-visible state transitions are synchronous and transactional. Image processing, notification delivery, report aggregation, and retention cleanup are jobs with idempotency keys. A job carries tenant and campus scope, actor identity, source event ID, and a bounded retry count. Job failure never silently changes the business state.

## Trust boundaries

- Browser and mini clients are untrusted.
- The API boundary validates syntax and size before application code.
- The authorization layer verifies membership and object ownership before every read and write.
- Provider adapters are untrusted dependencies and receive only the minimum scoped payload.
- AI output is untrusted text; the safety gateway filters, labels, and routes it for human review.

## Data flow invariants

- Every institution object carries `tenant_id`; campus-scoped objects also carry `campus_id`.
- Scope is derived from the authenticated membership and server-side policy, never accepted from a client as authority.
- Audit records contain actor, action, object type, object ID, tenant, campus where applicable, result, correlation ID, and timestamp, but not child free text or raw prompts.
- Public content is explicitly published and contains no private student or family relationship data.

## Failure behavior

Authentication failure returns the shared unauthorized error. Scope ambiguity, missing membership, policy denial, provider timeout, and stale state each have distinct error codes. Transactions roll back on domain rejection. Retries are limited to operations proven idempotent.

## AI safety boundary

The learning assistant calls `LearningSafetyGateway`, never a model SDK. The gateway enforces guardian or teacher supervision, records the student's attempt before hints, limits the hint ladder to levels 0 through 3, allows one to three consolidation items, and exposes only a minimal authorized summary to a teacher. Live model use is disabled for V0.1.
