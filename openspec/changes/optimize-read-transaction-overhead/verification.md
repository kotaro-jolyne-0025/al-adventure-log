# Verification

2026-10-15. Local implementation only; no push or deployment.

## Changes

- Character list remains one owner-scoped mapper query with its batched soul-coin totals; removed the surrounding `REPEATABLE_READ` transaction.
- Character detail now fetches the owner-filtered character, live soul-coin total, and adventure-presence flag in one SQL statement. The response fields and checks are unchanged.
- Kept repeatable-read transactions on the three multi-query adventure read endpoints for list, detail, and defaults. These still return related records and timestamps from one snapshot.
- No API contract, cache behavior, schema, migration, or production setting changes.

## Validation

- `mvnw.cmd clean package -DskipTests`: successful. Main and test sources compiled; tests were skipped.
- Ran read-only PostgreSQL `EXPLAIN` for the detail query using placeholder UUIDs. Query parsed and planned with the character, inventory, and adventure indexes. No application query or data write was executed.
- `openspec validate optimize-read-transaction-overhead --strict`: passed.
- `git diff --check`: passed.
- No browser or post-deployment latency comparison has been run; improvement in the live site is not yet measured.
