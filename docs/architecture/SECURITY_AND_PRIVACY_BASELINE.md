# V0.1 Security and Privacy Baseline

Status: approved design baseline for Phase 1B planning only.

## Threat priorities

The primary risks are cross-tenant disclosure, unauthorized child access, unsafe file links, workflow bypass, credential theft, accidental logging of sensitive content, and unsafe AI output. Controls are designed at the boundary and verified by deny tests.

## Required controls

- Validate and size-limit every transport input.
- Use parameterized SQL and allowlisted sort/filter fields.
- Resolve tenant and campus scope on the server.
- Enforce route and object policy before data access.
- Use secure session settings and rotate credentials on privilege changes.
- Apply CSRF protection where cookie-authenticated mutations are used.
- Set restrictive security headers and an allowlisted content security policy.
- Use short-lived signed object URLs and provider-side private buckets.
- Redact names, contact details, free text, prompts, and tokens from logs.
- Rate-limit authentication, upload intent, learning hint, and deletion routes.
- Keep dependencies locked and scan them before a Phase 1B release.

## Minor privacy rules

Only synthetic data is used in Batch B. A student is not an independent account in V0.1. Guardian or teacher supervision is required before a learning session. Collection is minimal, purpose-bound, reviewable, deletable, and auditable. The system must not infer health, emotion, ability, discipline, family status, or performance conclusions from free text.

## AI safety gateway

The gateway accepts a typed learning context, verifies consent and supervision, redacts unnecessary fields, enforces the attempt-first sequence, limits hint levels 0 through 3, caps consolidation at one to three items, and classifies unsafe or uncertain output for human review. It can close a session or transfer to a teacher, but cannot diagnose, punish, grade automatically, impersonate a person, or reveal hidden reasoning.

## Incident response

Suspected disclosure or unsafe output triggers access containment, evidence preservation without copying child content, scope review, notification according to the approved policy, and a tracked remediation. A release is blocked when a critical privacy or authorization test fails.
