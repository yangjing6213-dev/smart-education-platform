# Phase 1B V0.1 Task Dependency Graph

Status: active planned graph. Task 01, Task 02, and Task 03 are completed and
remain frozen evidence. Task 04 has not started and has no implementation
authorization.

Current governance authority:
`docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V1.md`
(`SHA-256=FD9DC8D4FA11222B70ED549818C431FD12B7E87B0F045EFAE856991EE008F051`).
Dependency authority:
`docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md`
(`SHA-256=B7F7509914399DD660D02F6FFD52E735EDF9EA850C0BF5C92F95698D8104F007`).
The T10 and T12 edges below must remain consistent with that authority. The authority SHA is
historical dependency evidence; it does not authorize `/goal`, Task 04, or any
implementation.

```text
PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_03_ONLY
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03
TASK_04_STARTED=NO
TASK_04_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_04_PRECONDITION=NEW_INDEPENDENT_CONTRACT_AND_SEPARATE_IMPLEMENTATION_AUTHORIZATION
PHASE_1B_API_FRAMEWORK=FASTIFY_5.12.1
NESTJS_REFERENCE_POLICY=HISTORICAL_DRAFT_ONLY
```

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
