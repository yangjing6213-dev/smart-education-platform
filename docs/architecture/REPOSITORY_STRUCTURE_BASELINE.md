# V0.1 Repository Structure Baseline

Status: approved design baseline for Phase 1B planning only.

## Required layout

```text
apps/
  mini-program/       WeChat adapter, pages, navigation, and client-only view state
  user-web/            visitor and member web shell
  admin-web/           institution management web shell
  api/                 HTTP routes, application services, workers, and adapters
packages/
  contracts/           versioned request, response, event, and error schemas
  validation/          shared boundary validators and test helpers
  auth/                identity, membership, role, and authorization policies
  tenant/              tenant and campus scope resolution
  config/              typed environment configuration with fail-closed parsing
  ui-web/              web-only design tokens and components
  ui-mini/             mini-program tokens and components
  test-utils/          fixtures, factories, fake clock, and test server helpers
infrastructure/        local and future environment descriptions; no secrets
docs/                  product, architecture, contracts, operations, and decisions
tests/                 unit, contract, integration, security, and browser suites
```

## Ownership and dependency direction

`packages/contracts` and `packages/validation` are the lowest shared layers. `packages/auth` and `packages/tenant` may depend on them. `apps/api` may depend on all server-safe packages and owns provider adapters. Client apps may depend on contracts and their matching UI package, but never on `auth` server internals, database modules, or provider SDKs. UI packages contain presentation primitives only.

## Naming and placement rules

- One bounded context owns each write command and its state transition.
- Public route names use the route contract; internal module names use nouns, not transport verbs.
- A new cross-app type belongs in `packages/contracts` only when two independently deployed surfaces consume it.
- Test fixtures belong in `packages/test-utils` or the nearest test directory and are visibly synthetic.
- Environment files contain variable names and validation rules only; secret values are never committed.

## Change control

Moving a module requires an import graph check, contract compatibility check, and an explicit migration note. A directory must not be created merely for a future feature; the Phase 1B task list is the authorization boundary.

## Current-phase boundary

This document describes a future structure. Batch B does not create `apps/`, `packages/`, `infrastructure/`, or `tests/` implementation directories.
