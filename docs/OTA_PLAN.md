# OTA (over-the-air) JS updates for WehdatHub mobile app

## Context
Fixing a critical bug today means a new store release: an AAB to Google Play, an IPA to the App Store, review, then waiting for users to update. The goal is to push **small critical JS fixes** straight to installed Android and iOS apps, with no store release. Requirements:
- Secure, stable, and invisible to non-tech brokers.
- Cheap at the current scale.
- Portable: the plan is to leave Render and Supabase for Hetzner, and Cloudflare R2 is acceptable for storage.

What the app already has:
- **Version gate:** `GET /api/v1/config` returns `minAppVersion` and `storeUrl` (`WehdatHub-Server/api/index.js:18-33,94-96`, env `APP_MIN_VERSION`). `App.tsx:53-59,140-141` shows `UpdateScreen` when the app is outdated. This stays as the safety net for native bugs that OTA can't fix.
- **App stack:** bare RN 0.88.1 with Hermes and New Architecture on both platforms. Android uses `ReactHost` (`MainApplication.kt:14-23`). iOS uses `RCTReactNativeFactory` with the bundle loaded in `SceneDelegate.swift:49-55` `bundleURL()`.
- **Missing pieces:** no React error boundary, no Crashlytics attributes, no iOS release workflow (`.github/workflows` has only `ci.yml` and `release-android.yml`), no OTA library.
- **Native code:** about 25 native modules plus in-house `ShareIntentModule` and the `ShareExt` target. Any change to these needs a store release, not OTA.

## Options assessed

| | A. Hot Updater (Cloudflare: R2 + Worker + D1) — **recommended** | B. expo-updates (bare) + own manifest endpoint + R2 | C. Hosted SaaS (Revopush, EAS Update) | D. Self-hosted code-push-server |
|---|---|---|---|---|
| Fit for bare RN 0.88 | Built for bare RN. Verify 0.88 + New Arch in the spike | Needs `expo-modules-core` in a bare app. Expo SDK must support RN 0.88 | Revopush supports 0.76+ and New Arch | Client repo archived. Community forks only |
| Security (bundle signing) | **Must verify in spike.** It's a hard gate | Mature RSA code signing, certificate baked into the binary | Vendor-held keys and data | Weak or legacy |
| Rollback | Console rollback and force update. Crash auto-rollback to verify | Built-in: falls back to the embedded bundle after a crash on launch | Yes | Yes |
| Native/JS mismatch guard | Fingerprint or app-version targeting | `runtimeVersion` / `@expo/fingerprint` | Yes | appVersion only |
| Hetzner portability | Runs fully on Cloudflare, so moving off Render/Supabase doesn't affect it. Storage and DB plugins also cover S3 and Postgres | Endpoint lives in our Express server and moves with it. Bundles in R2 | Locked to vendor | Self-host anywhere |
| Cost now | About $0. R2 free tier: 10 GB, 10M reads/mo, free egress. Workers free tier: 100k req/day | About $0 (R2) plus our server CPU | Paid per MAU | Server cost |
| Build effort | Low to medium. Has CLI, console and CI deploy | Medium to high: protocol endpoint, signing, Expo native install | Low | Medium |
| Main risk | Pre-1.0, small maintainer team | Heavy Expo native dependency in a bare app | Lock-in and data leaves our control | Dead ecosystem |

**Option E (added after review): `@bravemobile/react-native-code-push` + R2.** This is an open-source CodePush client fork that needs no server. Bundles and a release-history JSON sit on static storage (R2). It keeps CodePush's proven RSA bundle signing. Rollout %, rollback and the critical flag are JSON edits made by CI, with no console. RN 0.88 + New Arch support still needs checking.

**Decision:** the spike tests **A against E** with the same hard gates. Whichever passes with less setup wins. If both fail, fall back to B, which costs more to build but has the strongest security story and is fully owned. Hosted forks (Revopush, AppZung) are the easiest route but bring lock-in and per-user cost. `code-push-server` forks are rejected because they mean running an extra server.

## Cross-cutting design (applies to A or B)

### Security
- Every bundle is **signed in CI** with an OTA private key. The app checks the signature against a public key compiled into the binary, and rejects any bundle that doesn't verify. Without signing, a leaked R2 or Worker credential means attacker code runs inside every broker's app, with access to the Keychain token.
- The OTA signing key is **separate from `upload.jks`**. `upload.jks` only signs the AAB for Play and doesn't protect OTA. The OTA key is stored as a GitHub secret and backed up offline.
- R2 write credentials are held by CI only. The Worker gets read-only bucket access. All traffic is HTTPS. The publish token is scoped to the bucket.
- OTA is limited to bug fixes, never new features or a changed app purpose. This keeps it inside Apple 2.5.2 and Google Play policy, and matches "critical small fixes".

### Stability
- Each bundle targets an exact native fingerprint, so a bundle never runs on a binary missing the native code it needs. CI fails if native code changed and someone tries an OTA.
- **Auto-rollback:** a new bundle only counts as good after the first screen renders. A crash before that sends the app back to the previous or embedded bundle.
- Add a root **ErrorBoundary** (none exists today), so a render crash shows a recovery screen instead of a white screen, and gets reported.
- **Staged rollout:** 10%, then 50%, then 100%, with a **kill switch** (rollback from console or CLI).
- Crashlytics gets `setAttribute('ota_bundle', id)`, and the server sees an `X-App-Bundle` header logged in `lib/failureLog.js`. Crashes can then be traced to a specific bundle.

### UX (non-tech brokers)
- **Default:** download in the background and apply on the next cold start. No prompts, no "restart" button.
- **Critical flag:** after download, reload on the next time the app comes back to the foreground, but only when no unsaved draft exists (`src/draft.ts`). Show a 1-second Arabic/English notice ("بنحدّث التطبيق…").
- The version label in `MoreScreen.tsx:164` becomes `1.0.35 (35) · u7` so support can identify the bundle.
- The update check never blocks startup. If it hasn't answered within 3 s, the app skips it.

### Performance
- The Hermes bundle is about 2–5 MB zipped. It downloads once per release, not on every launch.
- The launch check is one small Worker GET at the Cloudflare edge, which is fast from Egypt.

### Ops
- New workflow `ota-release.yml`, triggered by hand, with inputs: channel, rollout %, critical flag, and a required note. It runs typecheck and tests, checks the fingerprint, builds both platform bundles, signs, uploads, and records the release.
- Channels are `staging` (internal and test devices) and `production`.
- Runbook: `docs/OTA_RELEASE.md` covers when OTA is allowed, publishing, rollback, and key rotation.
- The React Query persist `buster` (`App.tsx:143`) gets bumped whenever an OTA changes the shape of cached data.

### Server compatibility
Migrations run on boot, so the API must stay backward compatible. OTA shrinks the share of users on old versions. `APP_MIN_VERSION` remains the cut-off for anything below it.

## Gap found: iOS release pipeline
There's no `release-ios.yml` or iOS release doc. OTA fingerprint targeting needs a reproducible native build per version on both platforms. The plan adds `release-ios.yml`: archive, sign, upload to TestFlight, with the same version stamping as Android.

## Rollback test device matrix
This is the set of devices and states where we prove that a bad bundle can't brick the app.

| Device | Why |
|---|---|
| Low-end Android 10 (2–3 GB RAM) | Typical broker phone. Slow apply and memory pressure |
| Mid Android 14/15 (Samsung/Xiaomi) | OEM background-kill behaviour |
| Oldest iOS supported (15.5) | Deployment-target floor |
| Current iOS 18/26 | Latest runtime |

Run every scenario on each device:
1. Normal update: applies on the next launch, and the label shows the new bundle.
2. Bundle that crashes on launch: auto-rollback, and the app opens on the previous bundle.
3. Bundle that crashes on render: the ErrorBoundary shows, then rollback.
4. Tampered or unsigned bundle: rejected.
5. Offline or flaky network during download: no partial apply.
6. Bundle for the wrong fingerprint: never offered.
7. Kill switch: devices return to the embedded bundle.
8. Critical flag: reloads only when no draft is open.
9. Store update installed over an OTA'd app: the new embedded bundle wins.

## Needed from owner before the spike
1. A Cloudflare account with R2 turned on (a card is required even on the free tier), and the **Account ID** sent over.
2. A domain decision: an `updates.<domain>` subdomain on Cloudflare DNS. `*.r2.dev` is rate-limited and for testing only.
3. Tokens. Never paste them in chat.
   - Setup token: Workers Scripts Edit, D1 Edit, R2 Edit. Option A only. Delete it after setup.
   - CI publish token: R2 Object Read & Write, limited to the OTA bucket. Goes in GitHub Actions secrets.
4. The OTA signing keypair. The owner generates it locally, puts the private key in a GitHub secret, and keeps an offline backup. It's separate from `upload.jks`.
5. Decisions: bucket name (default `wehdathub-ota`), location hint (Eastern Europe), and the staging test phones.
6. A separate task: an App Store Connect API key for `release-ios.yml`.

## Implementation phases (built via Sonnet subagents after approval)
0. **Prerequisites:**
   - ErrorBoundary in `App.tsx`.
   - Crashlytics attributes in `src/push.ts`.
   - `X-App-Bundle` header in `src/api.ts:11`, logged in `lib/failureLog.js`.
   - `release-ios.yml`.
1. **Spike (1–2 days, branch only).** Try A (Hot Updater with R2, D1 and a Worker) and E (bravemobile CodePush fork with R2). Hard gates for both:
   1. Bundle signing is supported and verified natively.
   2. Works with RN 0.88 + New Arch + Hermes on both platforms.
   3. Crash auto-rollback works.
   4. Fingerprint guard works.
   5. Coexists with `ShareExt` and the in-house `ShareIntent`.

   Pick whichever of A and E passes with less setup. If both fail, switch to option B.
2. **Integrate.**
   - Android: `MainApplication.kt` gets `jsBundleFilePath` (or the library's helper).
   - iOS: `SceneDelegate.swift` `bundleURL()` in release builds.
   - `App.tsx`: wrapper, update policy, critical-flag foreground reload.
   - `MoreScreen.tsx`: label.
3. **CI and ops.** `ota-release.yml`, OTA signing key secret, `docs/OTA_RELEASE.md`.
4. **Test.** Run the full device matrix on the `staging` channel, then the first production OTA at 10%.

### Critical files
- App: `apps/mobile/App.tsx`, `src/api.ts`, `src/push.ts`, `src/config.ts`, `src/screens/MoreScreen.tsx`, `android/app/src/main/java/com/wehdathub/MainApplication.kt`, `ios/WehdatHub/SceneDelegate.swift`, `.github/workflows/` (new `ota-release.yml` and `release-ios.yml`), `docs/OTA_RELEASE.md`.
- Server: `lib/failureLog.js`. `api/index.js` `/config` is unchanged; it already holds the gate.

## Verification
- Unit tests: update-policy logic (critical flag, draft guard, timeout) and the ErrorBoundary.
- `pnpm typecheck && pnpm test`. The CI iOS simulator build passes.
- Run the device matrix above on the staging channel, and record the result per cell.
- Crashlytics shows the `ota_bundle` attribute, and server logs show `X-App-Bundle`.
- Production: rollout at 10% with 24 h of crash-free monitoring before going to 100%.
