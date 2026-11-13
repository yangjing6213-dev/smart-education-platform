# Repeatable Web and Mini Program Release Pipeline

## Status

Proposed design selected by the project owner on 2026-09-23. Implementation is
not authorized by this document; owner review of this specification is the next
gate.

## Goal

Make each accepted phase releasable from one immutable Git commit, deploy the
user website to Tencent Cloud with automatic health verification and rollback,
and prepare/upload the native WeChat mini-program from the same commit without
confusing an experience upload with a reviewed public release.

## Current Evidence and Root Cause

- Local `HEAD` and the live GitHub branch both resolve to
  `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`.
- The Tencent systemd service is active on `127.0.0.1:8501` and serves a
  versioned directory whose name contains that commit prefix.
- On the server, Nginx reaches `/visitor/` successfully, while the root URL
  responds with a redirect. The requested behavior is for `/` itself to render
  the homepage; it must not depend on redirecting to `/visitor/`. The public
  URL could not be verified from this workstation during this review.
- The working tree currently contains 23 modified tracked files plus
  untracked paths. Those edits are not part of the deployed commit and are not
  an approved release manifest.
- The repository has no checked-in release workflow or deployment script.
  The user-web package currently defines build, preview, and focused test
  commands only.
- The native mini-program project is TypeScript/WXML/WXSS. The WeChat
  Developer Tools installation and CLI entrypoint are present locally, but an
  authenticated upload has not been verified.
- The public GitHub repository has no root `LICENSE`; this remains a separate
  publication-readiness decision and must not be silently guessed.

## Chosen Release Model

Use an explicit release command against an already accepted, committed SHA.
The command runs locally in an isolated export/worktree and uses the existing
local SSH credential source. It does not upload a server private key to GitHub
Actions or store credentials in the repository. No deployment is triggered by
an arbitrary push or by a dirty working tree.

Every phase release records the same source SHA for the GitHub commit, web
artifact, mini-program artifact, Tencent deployment, and WeChat experience
upload. GitHub updates remain an explicit ordinary push after an exact-file
manifest and the repository publication gates pass.

## Website Deployment

1. Require an exact release SHA that exists locally and is the reviewed phase
   checkpoint. Reject a dirty or ambiguous source snapshot; do not include
   untracked files unless they are explicitly part of the approved commit.
2. Run the repository's configured web tests, typecheck, lint, format checks,
   and production build. Record command results and the built asset hashes.
3. Upload only the static user-web build to a new server release directory
   named by the full source SHA. Verify transferred file paths and SHA-256
   values before changing the live pointer.
4. Keep the current release intact. Atomically switch a stable `current`
   symlink and restart/reload only the user-web static service if required.
   Do not modify databases, uploads, unrelated services, or Nginx configuration
   as part of a routine release.
5. Probe the production origin and the required routes/assets, including `/`
   and `/visitor/`. Require `/` to render the homepage without redirecting,
   `/visitor/` to remain functional, all required assets to load, and no
   unexpected error. If any probe fails, restore the prior symlink, restart
   the static service, and verify the previous SHA is serving.
6. Record source SHA, artifact SHA, server release directory, probe results,
   active SHA, and rollback result in a local release receipt. Never record
   credential values.

Initial setup may need a separately reviewed one-time systemd directory change
to point at the stable symlink. Routine releases must not rewrite systemd or
Nginx configuration.

## WeChat Mini Program

1. Build the existing native TypeScript/WXML/WXSS project from the same
   approved source SHA. Do not convert it to a web-view application or copy
   generated files from a dirty main worktree.
2. Run the focused visitor and staff checks and validate page registration,
   TypeScript compilation, local routes, and project configuration.
3. Produce an upload-ready project directory and a manifest containing the
   source SHA and file hashes. Keep private IDE configuration and credentials
   out of Git and release artifacts.
4. Use the installed WeChat Developer Tools CLI only after its supported
   upload command and logged-in account are verified. Upload as an experience
   version with a description containing the source SHA. If CLI upload is
   unavailable, open that exact artifact in Developer Tools and follow the
   same manifest; do not rebuild from another checkout.
5. Verify the uploaded experience version in Developer Tools and test preview
   on device. Submission for review and public release remain an explicit
   owner action after visual and functional acceptance.

## Release Gates and Failure Behavior

- No release from a dirty/unknown working tree, a non-committed source, an
  unapproved file set, or a SHA that differs between the two clients.
- No broad staging, force push, fetch, automatic history rewrite, or silent
  cleanup of existing untracked paths.
- No new dependency or lockfile change merely to make deployment convenient;
  any necessary dependency expansion is reviewed separately.
- No server write until SSH access, current service target, backup/rollback
  path, and route expectations are rechecked read-only.
- Any build/test failure stops before upload. Any production health failure
  triggers automatic rollback and stops the release. Any mini-program upload
  identity/config mismatch stops before upload.
- A successful website deployment does not imply a successful mini-program
  upload, WeChat review, or public release. Report each state separately.

## Acceptance Criteria

- A single committed source SHA is recorded for both client deliverables.
- Website build and focused quality checks run from an isolated clean snapshot.
- `/` renders the homepage directly and `/visitor/` remains functional.
- Deployment uses a new SHA-named directory, verifies hashes, switches
  atomically, probes root and visitor routes, and demonstrably rolls back in a
  non-production failure simulation before the first production activation.
- Routine releases do not overwrite the previous server release or change
  Nginx/systemd configuration.
- Mini-program output is generated from the same SHA and its upload manifest
  matches the exact directory opened/uploaded in Developer Tools.
- Experience upload, on-device preview, review submission, and public release
  are recorded as distinct states.
- No credential values, user data, or unrelated untracked paths enter Git,
  release artifacts, logs, or receipts.

## Out of Scope

- Database migrations, API deployment, data or upload deletion, service
  replacement, domain/DNS/ICP changes, certificate changes, and broad server
  cleanup.
- Automatic WeChat submission or public publication without owner review.
- Automatic GitHub push, PR merge, deployment, or release on every commit.
- Product feature changes unrelated to the release pipeline.

## Open Decisions Before Implementation

1. Select the public repository license or decide to stop publishing source to
   the public repository until licensing is settled.
2. Verify the installed WeChat CLI's supported upload syntax and logged-in
   account without exposing credentials.
3. Confirm whether the first production activation may make the one-time
   systemd symlink-target change described above.
