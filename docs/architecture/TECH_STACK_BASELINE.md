# V0.1 Technical Stack Baseline

Status: approved design baseline for Phase 1B planning only.

## Decisions

| Area | V0.1 choice | Reason |
|---|---|---|
| Runtime | Node.js 22 LTS | One runtime for API, validation tools, and server-rendered support tasks. |
| Language | TypeScript 5.7 with strict mode | Shared types reduce drift between API contracts and endpoint clients. |
| API | Fastify 5 with a thin route layer | Explicit request boundaries and low framework overhead. |
| Web clients | React 19 with Vite 6 | Shared web UI package while preserving separate visitor and admin shells. |
| Mini program | Native WeChat TypeScript/WXML/WXSS adapter | Uses the platform navigation and lifecycle model without duplicating domain rules. |
| Database | PostgreSQL 16 | Transactions, row-level constraints, JSON fields for bounded content, and mature backup tooling. |
| Cache and jobs | Redis 7, only for short-lived coordination and queues | No authoritative business state is stored in cache. |
| Object storage | Tencent Cloud COS through a storage port | Provider details remain outside domain modules and short links are server-issued. |
| Validation | Zod 3 at transport boundaries plus database constraints | Rejects malformed input before domain writes and keeps shared schemas executable. |
| Testing | Node test runner, Playwright already present in the validation environment, and SQL integration fixtures | TDD without introducing a second test framework. |
| Package manager | pnpm 10 with a committed lockfile in Phase 1B | Deterministic workspace installs and efficient monorepo storage. |
| Observability | Structured JSON logs, request correlation IDs, metrics, and append-only audit events | Supports incident reconstruction without logging child content. |
| AI boundary | Internal AI adapter and safety gateway with a disabled default provider | Product code cannot call a model directly and V0.1 ships no live model. |

## Candidate server baseline

The approved V0.1 test and single-institution pilot candidate is a Tencent Cloud Light Application Server, general purpose, 4 CPU cores, 8 GB memory, 180 GB SSD, 12 Mbps bandwidth, and 2,000 GB monthly transfer. This is a sizing input only. It is not evidence of deployment, production readiness, or support for unrestricted multi-tenant production.

## Runtime rules

1. All timestamps are UTC in storage and ISO 8601 with an explicit offset at API boundaries.
2. Monetary values, where later introduced, use integer minor units; V0.1 has no payment route.
3. The API, jobs, and clients consume versioned contracts from `packages/contracts`.
4. No client chooses `tenant_id`, `campus_id`, role, or membership scope in a trusted write request.
5. No web or mini client imports database, COS, Redis, or provider SDKs.
6. The AI adapter accepts only a redacted learning context and returns a typed safety decision; it cannot emit a final grade, discipline label, diagnosis, or sensitive conclusion.

## Explicit non-deliverables

This phase creates no application scaffold, package manifest, dependency installation, database migration, credential, provider connection, model call, payment integration, or deployment configuration. Those actions require a separately approved Phase 1B task contract.

## Verification

The Phase 1B start gate must confirm the selected runtime versions, lockfile policy, database version, storage adapter contract, and disabled AI provider with executable environment checks before implementation begins.
