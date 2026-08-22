# V0.1 Multi-Tenancy Baseline

Status: approved design baseline for Phase 1B planning only.

## Isolation model

The platform uses shared PostgreSQL tables with mandatory `tenant_id` columns and explicit `campus_id` on campus-scoped records. Every repository method receives a server-created `ScopeContext`; no repository accepts a free-form tenant identifier from a client. Composite uniqueness includes tenant scope, and campus uniqueness includes both tenant and campus.

## Scope resolution

1. Verify the session or service identity.
2. Load active membership for the requested institution context.
3. Resolve allowed campuses from membership and role policy.
4. Create an immutable `ScopeContext` containing tenant, allowed campuses, actor, role set, and correlation ID.
5. Reject the request when the context is missing, ambiguous, suspended, or inconsistent with the object.

The client may request a campus filter only within the resolved allowed set. Server-side policy remains authoritative.

## Enforcement points

- SQL predicates include tenant scope on every select, update, and delete.
- Writes set tenant and campus from `ScopeContext`.
- Cache keys begin with tenant and campus scope.
- Job payloads carry scope and are rejected if the worker cannot reconstruct it.
- Object keys use `tenant/{tenantId}/campus/{campusId}/...` and are never assembled from untrusted text.
- Audit events always carry tenant scope and record cross-campus access explicitly.

## Platform administrator rule

Platform administrators cannot read student, family, learning, health, attendance, pickup, or care content by default. A separately approved support grant is time-limited, object-scoped, read-minimal, dual-approved, and fully audited. No support grant is implemented in V0.1.

## Isolation tests

The test suite must prove same-tenant allowed access, cross-tenant denial, disallowed-campus denial, cache-key separation, object-key separation, job-scope rejection, and uniqueness behavior. A missing tenant predicate is a release-blocking failure.
