# Proposal

## Why

The authenticated character list and character page spend hundreds of milliseconds in cross-region database requests even though their SQL runs in under a millisecond. Blanket read transactions add isolation setup round trips where a single SQL statement already provides a consistent snapshot.

## What Changes

- Remove the unnecessary multi-statement read transaction from the single-query character list.
- Load a character, its live soul-coin total, and adventure presence in one owner-scoped query, preserving one-statement snapshot consistency.
- Keep repeatable-read transactions on endpoints that assemble a response from multiple reads, including complete adventure records and defaults.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is an internal query and transaction optimization with no observable contract changes.

## Impact

`CharacterService`, `CharacterMapper`, the character mapper XML, and focused service/persistence tests. No API, schema, migration, dependency, cache, or deployment changes.
