# Phase 1B V0.1 Task Dependency Graph

Status: planned graph only; no node has been executed in Batch B.

## Nodes

```text
T01 workspace quality
T02 contracts and validation       T01
T03 tenant scope                  T01 -> T02
T04 identity and membership       T02 -> T03
T05 content and publication       T02 -> T04
T06 institution and home          T05
T07 public teacher profiles       T05 -> T06
T08 activities and meals          T05
T09 guides                        T05 -> T07
T10 resources and search          T05 -> T08 -> T12
T11 partner link                  T04 -> T05 -> T10
T12 files and COS boundary        T02 -> T03 -> T05
T13 visitor web                   T05 -> T06 -> T07 -> T08 -> T12
T14 visitor mini                  T05 -> T08 -> T13
T15 staff web                     T04 -> T09 -> T10 -> T11 -> T13
T16 staff mini                    T04 -> T09 -> T11 -> T15
T17 audit trail                   T03 -> T04 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16
T18 E2E/security/release          T01 -> T02 -> T03 -> T04 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16 -> T17
```

## Execution lanes

After T05, T06, T08, and T12 can be scheduled as separate reviewable lanes. T07 follows T06; T09 follows T07; T10 follows T08 and T12; T11 follows T10. Client work starts only after its API contract and permission tests are green. T17 is a cross-cutting gate and T18 is the release gate.

## Critical path

`T01 -> T02 -> T03 -> T04 -> T05 -> T08 -> T12 -> T10 -> T11 -> T15 -> T16 -> T17 -> T18`.

## Stop propagation

A failed tenant, authorization, contract, privacy, migration, or AI safety test blocks every dependent node. A failed presentation test blocks only its client lane until its contract remains unchanged. No graph node authorizes production deployment, payment, real login, live AI, or real personal data.
