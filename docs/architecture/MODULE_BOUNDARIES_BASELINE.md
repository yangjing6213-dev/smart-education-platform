# V0.1 Module Boundaries Baseline

Status: approved design baseline for Phase 1B planning only.

## Module table

| Module | Owns | May depend on | Must not depend on |
|---|---|---|---|
| `identity` | account and session identity | contracts, validation, config | UI, domain repositories |
| `membership` | tenant membership and role status | identity, tenant, contracts | client-provided scope |
| `tenant` | scope resolution and isolation helpers | identity, contracts | feature-specific writes |
| `authorization` | route and object policies | membership, tenant, contracts | database tables directly |
| `content` | public and internal content lifecycle | authorization, file ports, contracts | care or AI tables |
| `care` | tasks, daily care, leave, pickup | authorization, audit port, contracts | model providers |
| `guardian-relationship` | binding and release transitions | authorization, care references, audit port | direct client scope |
| `learning` | attempts, hints, consolidation, summaries | authorization, safety gateway, contracts | direct model SDK |
| `files` | metadata and storage ports | tenant, authorization, contracts | public bucket listing |
| `audit` | append-only event port and query policy | tenant, identity, contracts | mutable feature state |
| `adapters` | HTTP, PostgreSQL, Redis, COS, future AI | ports and config | domain policy decisions |

## Direction rules

Domain modules expose commands and queries through application interfaces. Repositories are ports owned by the domain module and implemented by `apps/api`. HTTP handlers translate transport input and never contain a state transition. A module may publish a typed event; consumers do not reach into its tables.

## Transaction ownership

The application service that owns a state transition opens the transaction, performs the scoped read, validates the expected version, writes the new state, and records the audit event. Cross-context workflows use an outbox event rather than a distributed transaction.

## Review gates

Every new import is checked for direction violations. Every new command names its actor, tenant scope, campus scope, idempotency key, input schema, output schema, and audit action. A policy test must exist before a route is exposed.
