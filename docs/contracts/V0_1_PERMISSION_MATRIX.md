# V0.1 Permission Matrix

Status: design contract for Phase 1B.

Legend: `A` allowed within resolved scope, `R` read-only within resolved scope, `D` denied, `C` conditional on relationship and workflow state.

| Capability | Visitor | Guardian | Teacher | Staff | Campus manager | Tenant admin | Platform support |
|---|---:|---:|---:|---:|---:|---:|---:|
| Read published public content | A | A | A | A | A | A | R |
| Read own membership and account | D | A | A | A | A | A | D |
| Read related student summary | D | C | C | D | C | D | D |
| Submit guardian binding request | D | C | D | D | C | C | D |
| Approve or release relationship | D | C | D | D | C | C | D |
| Read assigned tasks | D | D | C | C | C | C | D |
| Complete assigned task | D | D | C | C | D | D | D |
| Submit teacher daily report | D | D | C | D | D | D | D |
| Confirm or return daily report | D | D | C | D | C | C | D |
| Read AI learning session | D | C | C | D | D | D | D |
| Open hint level 0 | D | C | C | D | D | D | D |
| Open hint levels 1-3 | D | C | C | D | D | D | D |
| Complete consolidation | D | C | C | D | D | D | D |
| Read teacher AI summary | D | D | C | D | D | D | D |
| Mark summary for intervention | D | D | C | D | D | D | D |
| Change supervision setting | D | C | D | D | D | D | D |
| Manage published content | D | D | D | D | C | A | D |
| Manage staff membership | D | D | D | D | C | A | D |
| Issue file upload intent | D | C | C | C | C | C | D |
| Read audit metadata | D | D | D | D | C | A | R |

## Non-negotiable denies

1. A client-supplied tenant or campus cannot widen scope for any role.
2. Platform support cannot read child content by virtue of being a platform role.
3. Guardians cannot read teacher-only summaries or internal staff resources.
4. Teachers cannot approve their own restricted administrative actions unless the explicit workflow allows it.
5. No role can skip a state transition, open a higher AI hint before the prior step, or access a released relationship as active.
6. File links do not grant permission beyond the object policy that issued them.

## Policy evidence

Each row requires an allow test, a denial test, an audit action, and a route mapping. Conditional rows must test relationship, tenant, campus, membership status, and expected workflow version.
