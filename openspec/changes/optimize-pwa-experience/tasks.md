## 1. Update-safe draft persistence

- [x] 1.1 Coordinate an update reload with active adventure forms: capture the latest values, await the existing IndexedDB write, and keep the page open with retry and online-save recovery on failure.
- [x] 1.2 Request persistent storage once per app session when supported, without blocking draft writes or online saves if denied.
- [x] 1.3 Verify update and draft flows with focused tests, including persistence failure and recovery.
- [x] 1.4 Restore from the loaded baseline plus the saved snapshot, and wait for discard completion before same-target navigation.

## 2. Fast read-cache presentation

- [x] 2.1 Adapt the existing read facade and its page consumers to show valid copies immediately and reconcile a complete cloud response in the background.
- [x] 2.2 Keep cached content read-only; preserve permission, deletion, session, mutation invalidation, and late-result protection.
- [x] 2.3 Verify cache timing, temporary failure, account switch, invalidation, and cloud refresh with focused tests.

## 3. Installation and shell delivery

- [x] 3.1 Add a responsive install entry using native browser prompts where available, platform guidance otherwise, and installed-state detection.
- [x] 3.2 Align language, stable app ID, theme/background colors, icon purposes, and maskable safe area in the manifest/HTML.
- [x] 3.3 Defer low-frequency dialogs and login-only third-party scripts; remove unused remote font/icon resources.
- [x] 3.4 Tune Angular worker precache and Firebase Hosting cache headers for shell availability, safe updates, and hashed-asset caching.
- [ ] 3.5 Record bundle and precache sizes; real-browser install, update, online/offline deep-link, and uncached-route checks remain for deployment validation.

## 4. Draft storage recovery and specification

- [x] 4.1 Keep the current form intact when local draft persistence fails or storage quota is reached; show retry feedback without a draft preview or copy action.
- [x] 4.2 Update SRS and the three affected OpenSpec main specs after implementation matches the delta.
- [x] 4.3 Run focused frontend tests, production build, OpenSpec strict validation, and diff checks; record real-device checks that remain unavailable.
