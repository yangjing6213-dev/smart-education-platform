# V0.1 Route and Page Contract

Status: design contract for Phase 1B; the Batch B prototype is an offline simulation and does not provide real authentication.

## Route invariants

- Executable inventory is exactly 59 routes: 47 A pages and 12 B flows.
- Ten C pages remain future reservations and are not executable.
- IDs, paths, endpoint ownership, and role intent are stable contract fields.
- Visitor routes expose published content only. User web routes support long-form member and staff work. Admin routes are web-only.
- Flow routes enforce state order, role checks, tenant scope, and object relationships.
- A route change requires an inventory update, permission update, contract test, and browser coverage update in one review.

## A pages: mini program (20)

| ID | Path | Role intent |
|---|---|---|
| A-MP-01 | `/mini/visitor/home` | visitor |
| A-MP-02 | `/mini/visitor/institution` | visitor |
| A-MP-03 | `/mini/visitor/home-school` | visitor |
| A-MP-04 | `/mini/visitor/day-flow` | visitor |
| A-MP-05 | `/mini/visitor/teachers` | visitor |
| A-MP-06 | `/mini/visitor/teachers/:id` | visitor |
| A-MP-07 | `/mini/visitor/activities` | visitor |
| A-MP-08 | `/mini/visitor/activities/:id` | visitor |
| A-MP-09 | `/mini/visitor/meals` | visitor |
| A-MP-10 | `/mini/visitor/campuses` | visitor |
| A-MP-11 | `/mini/staff/login` | teacher or staff |
| A-MP-12 | `/mini/staff/workbench` | teacher or staff |
| A-MP-13 | `/mini/staff/guides` | teacher or staff |
| A-MP-14 | `/mini/staff/guides/:id` | teacher or staff |
| A-MP-15 | `/mini/staff/resources/categories` | teacher or staff |
| A-MP-16 | `/mini/staff/resources` | teacher or staff |
| A-MP-17 | `/mini/staff/resources/:id` | teacher or staff |
| A-MP-18 | `/mini/staff/resources/search` | teacher or staff |
| A-MP-19 | `/mini/staff/partner-cloud` | teacher or staff |
| A-MP-20 | `/mini/staff/account` | teacher or staff |

## A pages: user web (13)

| ID | Path | Role intent |
|---|---|---|
| A-WEB-01 | `/web/visitor/home` | visitor |
| A-WEB-02 | `/web/visitor/institution` | visitor |
| A-WEB-03 | `/web/visitor/teachers` | visitor |
| A-WEB-04 | `/web/visitor/teachers/:id` | visitor |
| A-WEB-05 | `/web/visitor/activities` | visitor |
| A-WEB-06 | `/web/visitor/meals` | visitor |
| A-WEB-07 | `/web/visitor/day-flow` | visitor |
| A-WEB-08 | `/web/staff/login` | teacher or staff |
| A-WEB-09 | `/web/staff/workbench` | teacher or staff |
| A-WEB-10 | `/web/staff/guides` | teacher or staff |
| A-WEB-11 | `/web/staff/resources` | teacher or staff |
| A-WEB-12 | `/web/staff/partner-cloud` | teacher or staff |
| A-WEB-13 | `/web/staff/account` | teacher or staff |

## A pages: admin web (14)

| ID | Path | Role intent |
|---|---|---|
| A-ADM-01 | `/admin/login` | tenant admin or campus manager |
| A-ADM-02 | `/admin/dashboard` | tenant admin or campus manager |
| A-ADM-03 | `/admin/institution` | tenant admin or campus manager |
| A-ADM-04 | `/admin/home-content` | tenant admin |
| A-ADM-05 | `/admin/public-teachers` | tenant admin or campus manager |
| A-ADM-06 | `/admin/activities` | tenant admin or campus manager |
| A-ADM-07 | `/admin/meals` | tenant admin or campus manager |
| A-ADM-08 | `/admin/guides` | tenant admin or campus manager |
| A-ADM-09 | `/admin/resources` | tenant admin or campus manager |
| A-ADM-10 | `/admin/partner-cloud` | tenant admin |
| A-ADM-11 | `/admin/staff` | tenant admin or campus manager |
| A-ADM-12 | `/admin/files` | tenant admin or campus manager |
| A-ADM-13 | `/admin/publishing` | tenant admin |
| A-ADM-14 | `/admin/audit-logs` | tenant admin or campus manager |

## B flows (12)

| ID | Path | Required guard |
|---|---|---|
| B-FLOW-01 | `/flow/guardian-binding` | guardian supervision, ordered binding and release |
| B-FLOW-02 | `/flow/guardian-home` | active guardian relationship |
| B-FLOW-03 | `/flow/student-daily-care` | related guardian or assigned teacher |
| B-FLOW-04 | `/flow/leave` | related guardian, assigned teacher, or manager |
| B-FLOW-05 | `/flow/pickup` | guardian authorization and staff verification |
| B-FLOW-06 | `/flow/teacher-workbench` | active teacher membership |
| B-FLOW-07 | `/flow/teacher-tasks` | assigned teacher or manager |
| B-FLOW-08 | `/flow/class-student-status` | assigned teacher or manager |
| B-FLOW-09 | `/flow/teacher-daily-report` | teacher author and scoped confirmer |
| B-FLOW-10 | `/flow/ai-learning-assistant` | guardian or teacher supervision and attempt-first |
| B-FLOW-11 | `/flow/ai-teacher-summary` | authorized teacher only |
| B-FLOW-12 | `/flow/guardian-ai-supervision` | related guardian |

## Flow transition contract

Binding proceeds from start to required fields, review, approval, active relationship, and release. A release request ends in `RELEASED`, displayed as `已解除` in the approved Chinese UI copy. A daily report proceeds from generated draft to teacher completion, submission, confirmation or return. Learning proceeds from student attempt to hint levels 0, 1, 2, and when necessary 3, then one to three consolidation items, teacher transfer or close. A skipped step, cross-role summary, or unauthorized action returns a policy or state error.
