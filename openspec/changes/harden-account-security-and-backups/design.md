# Design

## Context

See proposal.md for motivation. Public auth endpoints are Spring controllers, the database is Supabase PostgreSQL, and the current public service may run more than one Cloud Run instance. The existing repository's users and game records remain unchanged.

## Goals / Non-Goals

**Goals:** eliminate the unverified password path through third-party email linking, keep reset credentials out of logs, apply shared low-overhead rate limits, and make private database backups restorable in an isolated environment.

**Non-Goals:** revoke every previously issued JWT, verify existing email addresses retroactively, change the production Supabase plan, rotate production secrets, or create cloud resources as part of implementation.

## Decisions

- Existing provider + provider subject remains the identity key. A new, unbound provider subject that collides with an existing email is rejected; a bound Google login clears any remaining local password because that Google subject has now proved control of the verified email. Discord email matches are never used for binding, and unverified or disabled identities are rejected. Do not migrate or silently delete existing OAuth bindings.
- Remove token-bearing logs. SMTP absence/failure logs only a delivery status without email or credential. Return the existing generic forgot-password response.
- Rate limits use one small Flyway-managed operations table and atomic PostgreSQL upserts, so Cloud Run instances share counters without a new service. HMAC-SHA-256 keys derived from the existing JWT secret cover endpoint, normalized email and source address; raw identifiers are never stored. Apply an account and a source limit; return 429/Retry-After before doing password verification or email work. Expired rows are pruned on rate-limit writes using an indexed expiry timestamp.
- Scheduled backups use GitHub Actions workload identity federation to write PostgreSQL custom-format dumps to a private GCS bucket. The bucket and narrowly scoped service account are provisioned separately by the operator; workflow configuration fails closed when absent. Retention is configured on the bucket. A manually dispatched drill restores a selected dump into a disposable local PostgreSQL container, validates schema and row counts without printing row contents, then destroys the container.
- GCS artifacts are encrypted in transit and at rest by Google Cloud Storage. Public access prevention and uniform bucket-level access are prerequisites. Database URL and federation configuration are GitHub environment secrets/variables; no credential file is committed.

## Risks / Trade-offs

- [Google-login collision] Password-only accounts sharing an email with an unbound Google user must use their existing login until a separate authenticated linking flow exists → show a clear, non-enumerating error and preserve already-bound provider login.
- [Password reset and old JWT] Existing JWTs remain valid until expiry after a password is cleared/reset → do not claim immediate session revocation; keep the existing two-hour token maximum and revisit if account recovery policy requires immediate revocation.
- [Database rate-limit writes] Every auth attempt writes a small row and burst traffic adds database work → use indexed expiry, fixed bounded windows and a modest cleanup batch; verify concurrency and failure behavior against embedded PostgreSQL.
- [Unprovisioned backup destination] Source code alone cannot establish a private cloud bucket, GitHub federation trust or IAM → make these prerequisites explicit and report backup as inactive until an operator provisions and successfully verifies them.
- [Restore drill dependency] The isolated drill needs Docker and access to GCS → fail visibly if either is unavailable; never fall back to restoring production.

## Migration Plan

1. Deploy additive operations-table migration and backend code through the existing normal release path.
2. Provision private GCS bucket (uniform access, public access prevention and retention), workload identity provider and a service account limited to this bucket. Add required non-secret GitHub variables and database URL secret without exposing their values.
3. Run a scheduled backup and inspect only object metadata. Run the manual isolated restore drill and record its result.
4. Roll back by reverting application code while keeping the operations table; the table is harmless and can be removed in a later separately approved migration. Do not roll back or remove a backup bucket with the only recoverable copies.
