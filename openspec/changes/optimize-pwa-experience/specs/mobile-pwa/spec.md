# Spec Delta

## ADDED Requirements

### Requirement: Safe install and update experience

The app SHALL provide an install entry while the app is not installed. On browsers with a native install prompt, the entry SHALL invoke it only after a user action; on other supported platforms it SHALL explain the platform's install steps. The entry MUST be hidden when the app is already installed. Manifest identity, language, theme color, launch background, and icons SHALL consistently describe the app. Before applying a ready app update, the app SHALL wait for active adventure draft data to be durably saved; if saving fails, it SHALL keep the current page and input, omit the draft preview and copy action, and provide a retry path.

#### Scenario: Install from supported browser
- **WHEN** an eligible browser exposes its install prompt and the user chooses Install
- **THEN** the app requests installation and hides its install entry after installation

#### Scenario: Install guidance on other platforms
- **WHEN** the browser has no native install prompt and the app is not installed
- **THEN** the install entry explains the platform-appropriate add-to-home-screen steps without claiming installation succeeded

#### Scenario: Update with active unsaved form
- **WHEN** an app update is ready while an adventure form has unsaved input
- **THEN** applying the update waits for the local draft write to complete, and a failed write leaves the form open with its input preserved, no draft preview or copy action, and a retry path

### Requirement: Efficient offline application delivery

The app SHALL keep its initial application resources small by deferring infrequently used interface and third-party authentication resources until needed. Service worker installation and updates SHALL prefetch only the application resources needed to launch the public shell and common authenticated pages offline; other resources SHALL be cached on demand. Cached resources MUST remain version-consistent when an update is activated.

#### Scenario: First installation
- **WHEN** a user installs or first opens the app on a metered connection
- **THEN** the app downloads launch-critical resources without eagerly downloading unrelated feature resources

#### Scenario: Previously unopened offline page
- **WHEN** the user opens a feature page offline whose lazy resources were never cached
- **THEN** the app shows a recoverable connection message, offers retry after reconnecting, and keeps the current shell usable
