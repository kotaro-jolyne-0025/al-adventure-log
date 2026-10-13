# Spec Delta

## ADDED Requirements

### Requirement: Protect drafts when applying app updates

Before an application update reloads an active adventure form, the current input SHALL be captured and its local draft write awaited. The app MUST NOT reload while that write is pending or failed. A failed write SHALL leave the form open, retain its input, and provide retry without rendering a draft preview or copy action. Where supported, the app SHALL request persistent browser storage for draft data; denial or lack of support MUST NOT prevent online saving or imply that local storage is guaranteed.

#### Scenario: Update waits for draft persistence
- **WHEN** the player chooses to reload for a ready update while the form has unsaved changes
- **THEN** the current form values are durably stored before reload and are offered for explicit recovery on reopening

#### Scenario: Persistence fails during update
- **WHEN** the local draft cannot be stored before applying an update
- **THEN** the page remains open, all current values remain available, no draft preview or copy action is shown, and the player can retry or submit online

#### Scenario: Browser storage is not persistent
- **WHEN** the browser does not support or denies persistent storage
- **THEN** the app continues normal local draft writes and online cloud submission without claiming protection from browser eviction

### Requirement: Restore or discard a draft as one operation
Restoring an adventure draft SHALL rebuild the form from its loaded baseline and the saved snapshot without mixing other form state. Discarding a draft SHALL wait for local deletion before allowing navigation or a new form for the same target. If deletion fails, the app SHALL keep the draft visible and explain that it remains on the device.

#### Scenario: Restoring an older partial snapshot
- **WHEN** a saved draft lacks fields that exist in the current form baseline
- **THEN** the app starts from the current form baseline, applies saved fields, and does not retain unrelated transient form values

#### Scenario: Navigation during discard
- **WHEN** the player confirms discard and immediately leaves the form
- **THEN** navigation waits for deletion to finish and the next new form does not load the old draft

#### Scenario: Draft deletion fails
- **WHEN** local deletion fails
- **THEN** the draft remains visible, the app explains the failure, and the same-target form cannot be entered as though deletion succeeded
