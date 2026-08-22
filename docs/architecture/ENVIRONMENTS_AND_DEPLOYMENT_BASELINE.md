# V0.1 Environments and Deployment Baseline

Status: approved design baseline for Phase 1B planning only.

## Environment separation

| Environment | Purpose | Data | External access |
|---|---|---|---|
| `local` | developer unit and contract tests | generated synthetic fixtures | disabled by default |
| `validation` | browser, security, and integration evidence | reset synthetic fixtures | provider fakes only |
| `pilot` | separately approved single-institution trial | approved synthetic or explicitly consented pilot data | allowlisted operators |
| `production` | future controlled service | governed data | not part of Batch B |

Each environment has separate database, cache, object-storage prefix, signing keys, log sink, and audit namespace. A configuration parser rejects missing or cross-environment endpoints. Production values are never copied into local or validation.

## Release sequence

1. Validate source, lockfile, configuration schema, migrations, and contract compatibility.
2. Build an immutable artifact in the approved environment.
3. Run unit, contract, integration, security, and smoke checks.
4. Apply additive database changes with a recorded migration ID.
5. Deploy API and workers with health and readiness checks.
6. Run scoped synthetic smoke flows and observe error rate before exposure.
7. Record artifact digest, migration ID, operator, and rollback target.

## Server candidate

The V0.1 test and single-institution pilot candidate is the specified Tencent Cloud Light Application Server profile: general purpose, 4 CPU cores, 8 GB memory, 180 GB SSD, 12 Mbps, and 2,000 GB monthly transfer. No deployment or capacity claim is made by this document.

## Secret handling

Secrets are injected by an approved secret store or environment mechanism, validated at process start, and redacted from logs. No secret is placed in source, fixtures, screenshots, manifests, or the review ZIP. Remote configuration, push, PR, and cloud deployment remain outside Batch B.
