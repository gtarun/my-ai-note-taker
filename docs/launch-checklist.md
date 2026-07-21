# Launch checklist

What has to be true before a build ships, and what is deliberately still open.
Keep this honest — an unchecked box here is cheaper than a rejected build.

## Before a TestFlight beta

- [ ] `npm test` passes and `npx tsc --noEmit` is clean.
- [ ] `npx expo export --platform ios` completes (catches bad imports that
      typecheck misses).
- [ ] Deploy the `delete-account` edge function:
      `supabase functions deploy delete-account`. **The in-app Delete account
      button fails until this is deployed** — it is the only path that can
      remove an auth user, since that requires the service role key.
- [ ] Smoke-test the first run on a clean install: onboarding → pick a
      processing route → record → analyze → read the summary.
- [ ] Confirm `expo.extra.showDeveloperTools` is `true` if you want testers to
      be able to export diagnostic logs.

## Before external TestFlight or App Store submission

External TestFlight goes through Beta App Review, so these apply there too.

- [ ] **Host the legal documents.** `docs/privacy-policy.md` and
      `docs/terms-of-use.md` are written but have unfilled `TODO` fields
      (entity, contact, jurisdiction). Fill them in, have them reviewed, publish
      them, and set `expo.extra.privacyPolicyUrl` and `expo.extra.termsUrl` in
      `app.json`. **The in-app links do not render while these are empty**, and
      an app that records audio and sends it to third parties will be asked for
      a policy.
- [ ] **Set `expo.extra.showDeveloperTools` to `false`.** It gates the
      diagnostics screen and the "Replay onboarding" row. Both are useful in a
      beta and neither belongs in a public build.
- [ ] Verify Delete account end to end against the deployed function — App Store
      Guideline 5.1.1(v) requires in-app account deletion, and reviewers do test
      it.
- [ ] Complete App Privacy answers in App Store Connect. At minimum the app
      handles: audio recordings (on device), email address and name (only when
      signed in), and user content sent to the AI provider the user configures.
- [ ] Confirm the store listing describes the app as a **manual** recorder.
      Do not describe it as a stealth recorder, an automatic Zoom/Meet recorder,
      or a background call capture tool — see `docs/product.md`.

## Before shipping Android

- [ ] Run `npx expo prebuild -p android` — Android native project files are not
      checked in, so nothing about the Android build has been verified here.
- [ ] Android has no local inference (boundary-only contract), so Android users
      are cloud-only. Onboarding already reflects this and offers them only the
      cloud route.
- [ ] `FOREGROUND_SERVICE_MICROPHONE` and `POST_NOTIFICATIONS` were removed from
      `app.json` because nothing in the app used them. If background recording
      or notifications are added later, re-add them **and** file the
      foreground-service declaration Play requires.

## Known open items

These are understood and deliberately not done yet. None blocks a beta.

- **Background recording now declares `UIBackgroundModes: ["audio"]`.** The
  audio session already asked for `allowsBackgroundRecording`, but iOS suspends
  an app that has not declared the background mode — so recording stopped on
  background while the Record screen told the user it continued. Apple
  scrutinises this entitlement: be ready to explain in review that the app is a
  recorder and the mode is used only while a recording is running. Verify on a
  device that a recording actually survives backgrounding before relying on it.
- **Local summarization does not work on-device.** iOS transcription is real
  (Apple Speech, and whisper.cpp for other languages), but summaries always
  require a cloud API key. Onboarding says so plainly rather than implying
  otherwise.
- **Imported files have no duration.** `createMeetingFromImport` stores
  `durationMs: 0`, so imported meetings show no length and skip the
  transcript-quality heuristic.
- **Google Sheets sync is not idempotent.** A retry after a lost response
  appends a second row; there is no idempotency key.
- **Drive backup covers recordings only**, not imported files, and a failed
  upload is not retried later.
- **Orphaned audio on failure.** Audio is copied into app storage before the
  meeting row is inserted, so a failed insert leaks the file. The recorder's
  original temp file is also never deleted, so each recording briefly occupies
  disk twice.
- **`getAppSettings()` makes two network round-trips** and is called from hot
  paths including `processMeeting`. Offline, each call waits out a full network
  timeout before falling back to cache.
- **Model IDs are duplicated** between `localInference.ts` and `localModels.ts`
  with comments asking that they be kept in sync.
- **Several catalog models can never install** — the Gemma entries have an empty
  `downloadUrl` and `requiresExternalSetup: true`, yet `gemma-3-1b-it-q4` is
  still user-selectable as a summary model.
