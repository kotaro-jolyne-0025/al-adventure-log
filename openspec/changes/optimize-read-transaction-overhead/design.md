# Design

## Context

See `proposal.md`. Character list is one owner-filtered SQL statement with live soul-coin aggregation. Character detail currently uses separate statements for the owner-filtered character, soul coins, and adventure presence. Multi-query adventure and defaults responses rely on repeatable-read snapshots.

## Goals / Non-Goals

**Goals:** Reduce database round trips for role list/detail while retaining owner isolation, live totals, the response shape, and statement-level snapshot consistency.

**Non-Goals:** Change adventure list/detail/defaults isolation, cache freshness, schemas, API behavior, or production configuration.

## Decisions

- Remove `@Transactional(REPEATABLE_READ)` from `getAllCharacters`: the mapper returns all list fields and aggregated soul coins in one SQL statement, already a coherent PostgreSQL statement snapshot.
- Add one detail mapper query that filters by both character ID and user ID, computes soul coins with the same consumable/flag predicates as the list, and computes adventure presence with `EXISTS`. Map both summary fields onto the existing response path. The one statement gives all returned fields the same snapshot and removes the need for a transaction around this read.
- Keep repeatable-read annotations on multi-query methods. A broader removal would allow child collections and `updated_at` to come from different moments, undermining timestamp conflict protection.

Alternative considered: retain the detail transaction and only remove the list transaction. Rejected because the detail's three reads can be combined without changing semantics, removing two additional network round trips and the isolation setup.

## Risks / Trade-offs

- Detail aggregation could drift from list semantics → use identical item type, soul-coin flag, ownership predicate, and `EXISTS` behavior; verify with the PostgreSQL mapper integration test.
- Future code could add another query to list/detail and assume transaction isolation → keep the query count explicit in focused tests and add a transaction only if a multi-statement consistent snapshot becomes necessary.

## Migration Plan

No database migration or deployment configuration is needed. Validate the mapper and service with backend tests/package. Deploy only through the established CI/CD workflow when separately authorized.
