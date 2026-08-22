# Phase 1B Task 02 implementation plan

## Authority and boundary

Task 02 implements only shared V0.1 TypeScript contracts and strict executable validation.
It creates no tenant resolver, identity, database, migration, client, business route, storage,
AI, payment, or deployment implementation. `TASK_03_STARTED=NO` remains invariant.

The package direction is fixed:

```text
@student-care/contracts
        -> @student-care/validation
        -> @student-care/api and later approved consumers
```

`contracts` has no runtime external dependency or parser side effect. `validation` depends only
on `contracts` and exact `zod@3.25.76`. API consumption is proven without changing `/health` or
adding a business route.

## Approved contract decisions

| ID     | Executable decision                                                                                                                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D02-01 | Zod UUID structure plus lowercase refinement; no coercion and no version restriction.                                                                                                         |
| D02-02 | `contentInputSyntaxSchema` accepts untrusted optional `campus_id`; `contentInputSchema` excludes and strictly rejects it; `separateContentInputScope()` returns `body` and `untrusted_scope`. |
| D02-03 | Only request pagination is implemented: integer `page_size` 1–100 default 20 and cursor max 500. Collection response metadata is deferred.                                                    |
| D02-04 | `details` is an optional scalar dictionary with at most 20 lowercase snake-case keys, key length 1–64, string max 500, finite numbers, and the approved denylist.                             |
| D02-05 | `request_id` is 1–128 characters matching `^[A-Za-z0-9._:-]+$`.                                                                                                                               |
| D02-06 | `PUBLISHED` requires non-null timezone-aware `published_at`; other states allow missing or null; all supplied timestamps are validated.                                                       |
| D02-07 | Content inputs reuse shared enums plus `contentTitleSchema` and `contentBodySchema`; validation does not duplicate the stable value sets.                                                     |
| D02-08 | Shared header names remain `Idempotency-Key` and `If-Match`; both are optional at the generic strict boundary.                                                                                |
| D02-09 | `href` is only nullable string max 500; protocol and domain policy are deferred.                                                                                                              |

The generic success envelope contains only `data` and `request_id`. Task 02 does not invent
`page`, `total`, `has_next`, or cursor response metadata.

## Public surface

`@student-care/contracts` exports all 16 stable error codes; content type, status, visibility,
and block-kind readonly sets; their corresponding TypeScript types; content item/body/block
types; the five source-defined request input types; pagination/header types; and generic success
and error envelope types.

`@student-care/validation` exports UUID, request ID, pagination, canonical headers, content,
daily-report, relationship, learning-start, hint, success-envelope, error-envelope, and safe
error-details schemas, plus `separateContentInputScope()`.

Implemented request schemas are `ContentInput`, `DailyReportInput`, `RelationshipInput`,
`LearningStartInput`, and `HintInput`. Identity, membership, care, response pagination, and all
business-state schemas not fully defined by the approved sources remain deferred.

## Red-green sequence

1. Missing package exports fail compilation; add stable constants/types and explicit ESM exports.
2. Missing validators fail compilation; add strict Zod schemas and the approved scope separator.
3. Boundary tests fail for oversized safe error messages; add only the approved 500-character
   client-safe ceiling.
4. Package-direction test fails while the Task 02 verifier is absent; add the minimum reusable
   forbidden-import detector and prove a synthetic reverse import is rejected.
5. Run package tests, API health regression, typecheck, lint, format, build, audit, composite
   verify, and a second frozen install. Temporary red fixtures are not retained.

## Quality and Git gates

All root quality commands run contracts, validation, and API in dependency order. Build output,
dependencies, caches, and temporary fixtures remain ignored and outside Git and the ZIP.

Exactly one commit is authorized:

```text
feat: add shared v0.1 contracts and validation
```

Only explicit approved paths may be staged. There is no remote, push, PR, deployment, or second
commit. The fixed ZIP contains the project-owner-approved 49-member set with member-list SHA-256
`2F95991DD733B355EBAA212E7BEF904DD7DE412B2B09AC374FEC8A3DAE458A8A`.
