# Design

## Context

See proposal.md. The app already uses Angular Service Worker, lazy-loaded routes, an update prompt, IndexedDB drafts, and a bounded account-scoped read cache. Preserve the existing isolation, invalidation, and explicit cloud-write rules.

## Goals / Non-Goals

**Goals:** Make existing PWA features work together; make installation discoverable; reduce launch and update downloads; protect active input through an update.

**Non-Goals:** Add a service-worker framework, queue cloud writes offline, cache authenticated API responses in the service worker, or change backend APIs and persistence schema.

## Decisions

- Reuse `AdventureDraftSession` and `LocalStore` as the sole draft persistence path. Route update reload through a shared page-level guard/coordination mechanism so the form captures and flushes current input before reload. Preserve the existing copy-text recovery path on failure.
- Change the read facade to surface a valid copy immediately and then emit/reconcile a cloud result. Keep the existing 10-second timeout as a fallback when no copy exists, and preserve access errors and generation checks. Continue gating writes on successful current cloud data.
- Use the browser's `beforeinstallprompt` event when available and standalone display-mode detection to hide the install action. Provide concise Safari/iOS and unsupported-browser instructions without browser user-agent libraries.
- Align manifest and HTML metadata; make maskable icons genuinely safe-area aware and include install screenshots only when captured from the real app at documented viewport sizes.
- Defer low-frequency dialogs using dynamic imports and load Google Identity Services only on the login view. Remove redundant remote icon-font requests when code inspection confirms they are unused.
- Keep the existing Angular worker. Prefetch the launch shell and authentication/character-list essentials; cache secondary lazy chunks on demand. Use Firebase Hosting cache headers so HTML and worker manifests revalidate while hashed assets remain immutable.
- Use `navigator.storage.persist()` only as a best-effort request. On persistence errors, retain the live form and offer retry or online submission without rendering a draft preview or copy action; never represent browser storage as guaranteed.

## Risks / Trade-offs

- Showing cached data first can briefly show stale values → keep the page explicitly read-only until all required cloud reads succeed and retain account/epoch validation on every result.
- Reducing precache can make an unvisited route unavailable offline → show a recoverable shell-level offline message and verify previously visited deep links.
- Update guard integration may affect navigation flows → preserve existing route guard choices and test in-form, clean-form, failed-save, and unrelated routes.
- Browser persistent-storage requests may be denied → continue local writes and cloud saving, and clearly expose retry/copy recovery.

## Migration Plan

No server migration. Deploy through the existing Firebase Hosting workflow. Keep the manifest app identity stable once selected. Roll back by reverting the frontend change; retain existing IndexedDB schema and stored drafts.
