# Tasks

## 1. Authentication boundaries

- [x] 1.1 Change Google/Discord matching to reject unbound email collisions, preserve existing subject bindings, reject unverified provider emails, disable linked local password after verified Google sign-in, and reject disabled accounts; verify service tests cover each case.
- [x] 1.2 Remove reset URL/token and personal email from logs and returned errors, keep delivery failures observable, and verify captured logs contain no synthetic credentials.

## 2. Shared request limits

- [x] 2.1 Add an idempotent Flyway operations table for hashed rate-limit keys with indexed expiry; verify all migrations on embedded PostgreSQL and no existing user table columns change.
- [x] 2.2 Implement atomic database-backed limits for login/register/forgot-password with account and source scopes, 429 and Retry-After; verify concurrent calls and independent endpoints on embedded PostgreSQL.
- [x] 2.3 Apply limits before auth/email work, retain generic forgot-password responses, handle 429 in frontend without automatic retries, and verify frontend request behavior.

## 3. Private backups and restore checks

- [x] 3.1 Add scheduled GHA backup using GitHub OIDC and PostgreSQL custom dump to a configured private GCS bucket; fail closed without configuration, avoid committed secrets, and verify workflow syntax/static checks.
- [x] 3.2 Add a manual isolated restore drill using a disposable PostgreSQL container, schema and safe row-count checks, guaranteed cleanup, and verify it never targets production.
- [x] 3.3 Document bucket access prevention, lifecycle retention, workload identity setup and required GitHub variables/secrets in private local operations guidance; verify public docs and git diff contain no resource IDs or credentials.
- [x] 3.4 Guide the operator through private bucket, 30-day lifecycle, restricted service account, GitHub federation and protected environment setup; verify GCP policies and correct the workflows against the actual gcloud metadata format and shared container temporary directory.
- [x] 3.5 Publish the backup workflows through an authorized PR, successfully run the first cloud backup and isolated restore drill, and record the results before reporting backups as active.

## 4. Verification and specifications

- [x] 4.1 Add regression tests for account-link collision, disabled/unverified providers, sensitive log redaction, rate-limit boundaries and concurrent cross-instance counters; run focused backend/frontend tests.
- [x] 4.2 Sync updated main specs and SRS/database notes, run strict OpenSpec validation and relevant builds/tests, and confirm README.md remains untouched by this change.
