# Proposal

## Why

Adventure records currently save even when the magic item change count has no matching item details, creating unnamed placeholder inventory entries. Players need to record every gained item, including consumables.

## What Changes

- Require the number of submitted permanent item details plus consumable quantities to equal all positive magic item changes before saving.
- Reject mismatched saves in both the form and backend; stop creating placeholders or silently changing the recorded count.
- Negative changes remain losses and do not require gain details.

## Capabilities

### Modified Capabilities

- `adventure-log`: require matching item detail counts for positive magic item changes.

## Impact

- Adventure form validation and adventure entry save service.
- Adventure log specification.
