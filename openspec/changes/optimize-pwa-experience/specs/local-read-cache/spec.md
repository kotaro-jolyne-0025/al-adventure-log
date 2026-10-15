# Spec Delta

## ADDED Requirements

### Requirement: Show valid copies during weak connections

When an account has a valid previously viewed copy, reading pages SHALL show it promptly while requesting fresh cloud data in the background. The page SHALL clearly identify the copy and its saved time, and remain read-only until all data required for the corresponding operation has been successfully refreshed. Authentication, permission, deletion, account-switch, and mutation invalidation behavior SHALL retain their existing precedence.

#### Scenario: Slow cloud response with an available copy
- **WHEN** the user opens a reading page with a valid copy and the cloud request is still pending
- **THEN** the copy appears promptly with its saved time, editing and mutation controls remain disabled, and a successful complete cloud response replaces it and enables eligible controls

#### Scenario: Cloud refresh fails
- **WHEN** the background cloud request fails temporarily
- **THEN** the valid copy remains visible and read-only with a retry action

#### Scenario: Access is revoked during refresh
- **WHEN** the cloud reports an expired session, forbidden access, or a deleted target while a copy is displayed
- **THEN** existing authentication or access-error handling takes effect and the invalid copy is not retained as an accessible view
