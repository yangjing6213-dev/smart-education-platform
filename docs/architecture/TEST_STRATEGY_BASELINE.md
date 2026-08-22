# V0.1 Test Strategy Baseline

Status: approved design baseline for Phase 1B planning only.

## Test layers

1. Unit tests cover pure policies, state machines, validators, key builders, and redaction.
2. Contract tests validate JSON schemas, error shapes, pagination, idempotency, and compatibility.
3. Integration tests use isolated PostgreSQL and provider fakes to prove transactions and scope predicates.
4. Security tests attempt cross-tenant reads, role elevation, workflow jumps, object-key access, replay, and unsafe AI paths.
5. Browser tests cover the three endpoint experiences, keyboard behavior, responsive layouts, and critical workflows.
6. Operational tests cover health, readiness, structured logs, audit events, retry limits, and rollback rehearsal.

## TDD loop

Each Phase 1B task starts with a failing test, implements the smallest behavior, runs the focused test, then runs the relevant regression suite. A task is not complete when only a browser screenshot looks correct.

## Release thresholds

All contract, authorization, tenant-isolation, migration, and safety tests must pass. Changed server modules require at least 90 percent statement coverage and 100 percent coverage of deny branches for tenant, role, object, and workflow policies. Browser critical paths require zero page errors, severe console errors, failed requests, and unexpected external requests.

## Fixture policy

Factories create clearly synthetic tenants, campuses, roles, and child labels. Fixtures are isolated per test, use a fixed fake clock where time matters, and never contain copied production or public-personal data. A test that needs a secret uses a generated test secret and never prints it.

## Evidence

Every release candidate records command, version, result, duration, artifact digest, database migration ID, and test report path. A focused pass does not override a failed higher-level gate.
