# V0.1 Identity and Authorization Baseline

Status: approved design baseline for Phase 1B planning only.

## Identity model

An account is a person or institution-controlled service identity. A membership links an account to one tenant and an optional campus set. Membership status is `INVITED`, `ACTIVE`, `SUSPENDED`, or `REVOKED`. Sessions reference an account and a server-resolved membership; they do not carry mutable authority supplied by a client.

## Roles

V0.1 roles are `GUARDIAN`, `TEACHER`, `STAFF`, `CAMPUS_MANAGER`, `TENANT_ADMIN`, and a platform support role with no default content access. Role names are not permission checks by themselves; policies also evaluate membership status, tenant, campus, object relationship, and workflow state.

## Policy sequence

1. Authenticate the identity.
2. Confirm active membership.
3. Resolve tenant and campus scope.
4. Check route capability.
5. Check object relationship and state transition.
6. Perform the scoped operation and write the audit event.

Any missing input fails closed. A client cannot elevate a role, select another tenant, bypass a workflow state, or request a teacher-only learning summary.

## Session and credential boundary

V0.1 uses an adapter interface for future organization-approved login providers. The prototype and current batch use no real login, SMS, WeChat authorization, or production credentials. Session cookies, when implemented, will be secure, HttpOnly, same-site, short-lived, rotated on privilege change, and invalidated on membership suspension.

## Object-level rules

- Guardians see only explicitly related student records and their own supervision controls.
- Teachers see assigned class and authorized summary records.
- Campus managers see only their campuses.
- Tenant administrators manage tenant content and memberships but do not automatically see child private content.
- Platform support sees operational metadata only unless a separately approved audited grant exists.

## Required evidence

Each policy has allow and deny tests, an audit action, and a route-to-capability mapping in `V0_1_PERMISSION_MATRIX.md`.
