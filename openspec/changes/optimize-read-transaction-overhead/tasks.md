# Tasks

## 1. Character reads

- [x] 1.1 Remove the read transaction from the single-statement character list; verify the existing SQL remains owner-filtered and returns batched live totals, then confirm backend package succeeds.
- [x] 1.2 Combine character detail, live soul-coin quantity, and adventure presence in one owner-scoped mapper statement; verify the SQL with read-only `EXPLAIN` against the production schema.

## 2. Verification

- [x] 2.1 Confirm repeatable-read remains on every multi-query snapshot endpoint, validate the OpenSpec change, package the backend with tests skipped, and record deployment status in verification.md.
