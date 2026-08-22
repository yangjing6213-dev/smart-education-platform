# V0.1 Acceptance Traceability

Status: design-to-evidence matrix for Phase 1A Batch B and the future Phase 1B start gate.

| Requirement | Contract source | Evidence path or command | Pass condition |
|---|---|---|---|
| Batch A acceptance anchor | Batch B contract section 2 | `docs/project/PHASE_1A_BATCH_A_ACCEPTANCE.md`, source commit and ZIP hashes | all frozen values match |
| Contract integrity | Batch B contract metadata | SHA-256 command on `PHASE_1A_BATCH_B_CODEX_EXECUTION.md` | exact approved digest |
| Visual input integrity | contract section 3 | four input SHA-256 records | four exact digests |
| Cross-end design system | contract section 7 | `docs/design/*.md` | all design decisions and QA rules present |
| Route inventory | contract section 8 | `docs/contracts/V0_1_ROUTE_AND_PAGE_CONTRACT.md`, catalog, browser log | 47 A + 12 B = 59, unique IDs and paths |
| Flow guards | contract section 8 | browser negative tests and prototype state checks | illegal jumps and role violations denied |
| Technical baseline | contract section 9 | `docs/architecture/*_BASELINE.md` | 14 baselines, no unresolved decision markers |
| API and data contracts | contract section 9 | `docs/contracts/*.json` and Markdown contracts | JSON parses and error/permission rules are consistent |
| Phase 1B planning | contract section 10 | `docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md` | 18 independent TDD tasks with exact paths and gates |
| Automated verification | contract section 14 | `scripts/verify_phase_1a_batch_b.py` and command output | standard-library verifier exits 0 |
| Browser verification | contract section 14 | `artifacts/screenshots-batch-b/browser-verification.md` | 59/59, zero page/severe/request failures |
| Responsive and accessibility checks | contract section 14 | browser evidence and screenshots | 320, 390, 768, 1024, 1440 checks pass |
| Screenshot evidence | contract section 13 | `artifacts/screenshots-batch-b/*.png` | exactly 15 real browser PNGs with valid CRC and dimensions |
| Review inventory | contract section 15 | `docs/reviews/PHASE_1A_BATCH_B_FILE_INVENTORY.md` | every ZIP member has purpose and SHA |
| Review package | contract section 15 | fixed ZIP and independent manifest | exactly 86 approved members and approved list digest |
| Git discipline | contract section 16 | `git log`, `git status`, `git remote` | five messages, clean worktree, zero remotes |
| Stop invariants | contract section 18 | final receipt and file scan | Phase 1B not started; owner acceptance pending |

## Evidence rule

A prose assertion is not evidence. Each PASS must point to a file, command result, browser result, checksum, or Git object that can be re-run without network access. A missing browser or screenshot artifact is a blocking state, not a partial PASS.
