# V0.1 File Storage Baseline

Status: approved design baseline for Phase 1B planning only.

## Upload flow

1. The client requests an upload intent for a declared purpose and bounded size.
2. The API authenticates, resolves tenant and campus scope, checks capability, and creates a pending `file_object`.
3. The storage adapter returns a short-lived signed upload target for the server-generated object key.
4. The client uploads directly to COS without receiving bucket credentials.
5. The API verifies size, MIME signature, checksum, and malware-scan result before marking the object available.
6. A read request returns a short-lived signed URL only after the same scope and relationship checks.

## Key and metadata rules

Object keys use `tenant/{tenantId}/campus/{campusId}/{purpose}/{fileId}/{safeName}`. `safeName` is normalized and never controls the directory. The database stores the provider key, media type, byte size, checksum, scan state, owner object, retention class, and timestamps. A client cannot enumerate a bucket or address an arbitrary key.

## Limits

V0.1 accepts only explicitly allowed image and document types, with route-specific size limits, a maximum of 10 MiB per image and 25 MiB per document. SVG uploads are rejected unless a separately reviewed sanitization path is enabled. Executables, archives with executable content, and unknown media types are rejected.

## Access and expiry

Read links expire after 5 minutes; upload links expire after 10 minutes. Links are single-purpose and do not grant list or delete permission. The application records issuance and use metadata without logging the URL itself.

## Deletion and recovery

Deletion first revokes application access, then marks the object for provider deletion through an idempotent job. A backup retention policy is documented separately and does not restore revoked application access. Failed deletion is visible in operations and retried with a bounded schedule.
