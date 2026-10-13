# Verification

## Automated checks

- `frontend`: `npm test -- --watch=false` — passed, 26 test files / 154 tests. Coverage includes quota-specific draft failure, update reload blocked when persistence fails, current form recovery, atomic draft restoration, and discard/navigation races.
- `frontend`: `npm run build` — passed.
- `openspec validate optimize-pwa-experience --strict` — valid. The validator reports that the three delta requirements now also exist in the main specs; the SRS and main specs were synchronized as requested.
- `git diff --check` — passed (Git only emitted line-ending normalization notices).
- Production `manifest.webmanifest` parsed as JSON; the generated maskable icon exists in the build output.

## Production asset measurements

Measured from `frontend/dist/frontend/browser` after the production build:

| Resource group | Files | Raw bytes | Install behavior |
|---|---:|---:|---|
| `app` | 5 | 890,496 | Prefetched shell |
| `lazy-app` | 31 | 838,524 | Lazy install, prefetched on update |
| `assets` | 13 | 766,247 | Lazy install, prefetched on update |

The prior configuration prefetched 37 application files (about 1.73 MB raw). The shell now prefetched 5 files (about 0.89 MB raw), a reduction of roughly 49% in prefetched raw bytes. The prior production main bundle was about 963 KB raw; the current main bundle is about 829 KB raw (roughly 14% smaller). Build output is generated and not tracked.

## Not exercised here

Install prompts and installed-state detection, deployed Firebase cache headers, real update activation, and online/offline deep links on Chrome, Edge, Android, and iOS still need browser/device validation against the deployed site. First visits to uncached lazy routes were covered by the service-worker configuration and app recovery handling, not by a deployed offline browser session.
