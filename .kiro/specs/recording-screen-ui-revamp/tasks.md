# Implementation Plan: Recording Screen UI Revamp

## Overview

Expand the presentation layer from 3 to ~15 pure functions, extend PillButton and StatusChip with accessibility props, then rewrite RecordScreen.tsx to compose design system components with all copy from presentation and all styles from theme tokens. Tests cover every presentation function (example-based) plus one property-based test for timer accessibility labels.

## Tasks

- [x] 1. Expand the presentation layer with all pure functions
  - [x] 1.1 Add hero section functions (`getHeroEyebrow`, `getHeroHeadline`, `getHeroBody`) to `src/features/recording/presentation.ts`
    - `getHeroEyebrow()` returns an uppercase-friendly eyebrow string
    - `getHeroHeadline()` returns the screen headline
    - `getHeroBody()` returns a 1–2 sentence body paragraph in active voice, no jargon
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Add recording controls functions (`getTitlePlaceholder`) to `src/features/recording/presentation.ts`
    - `getTitlePlaceholder()` returns a placeholder suggesting concrete meeting types
    - _Requirements: 2.3, 2.4_

  - [x] 1.3 Refactor status functions (`getStatusLabel`, `getStatusTone`) to accept `RecordingPhase` instead of boolean
    - `getStatusLabel(phase)` returns label for all 4 phases (idle, recording, saving, error)
    - `getStatusTone(phase)` returns the correct `StatusChipTone` per phase
    - Remove old `getRecordingStatusLabel(isRecording: boolean)` and `getRecordingSupportLabel()`
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [x] 1.4 Add button functions (`getButtonLabel`, `getButtonVariant`, `getButtonDisabled`, `getButtonIconName`) to `src/features/recording/presentation.ts`
    - Each function takes `RecordingPhase` and returns the correct value per phase
    - `getButtonVariant` returns `'primary'` for idle/error, `'danger'` for recording, `'primary'` for saving
    - `getButtonDisabled` returns `true` only for saving
    - `getButtonIconName` returns `'microphone-outline'` or `'stop-circle-outline'`
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 1.5 Add notice functions (`getNoticeTitle`, `getNoticeBody`) to `src/features/recording/presentation.ts`
    - Replace existing `getRecordingNoticeBody` with `getNoticeBody` that avoids "force-quit" and uses plain language
    - Add `getNoticeTitle()` for the notice banner heading
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 1.6 Add consent functions (`getConsentHeading`, `getConsentBody`) to `src/features/recording/presentation.ts`
    - `getConsentHeading()` returns a short heading
    - `getConsentBody()` returns a one-sentence supportive, non-legalistic reminder
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 1.7 Add accessibility functions (`getTimerAccessibilityLabel`, `getButtonAccessibilityLabel`) to `src/features/recording/presentation.ts`
    - `getTimerAccessibilityLabel(durationMillis)` converts ms to human-friendly format (e.g., "2 minutes 15 seconds")
    - `getButtonAccessibilityLabel(phase)` returns descriptive action labels per phase
    - _Requirements: 9.1, 9.2, 9.5_

- [ ] 2. Write example-based tests for all presentation functions
  - [x] 2.1 Update `src/features/recording/presentation.test.ts` with tests for every new function
    - Verify every function returns a non-empty string (smoke tests for Req 7.3)
    - Verify `getStatusLabel` / `getStatusTone` for all 4 phases
    - Verify `getButtonLabel` / `getButtonVariant` / `getButtonDisabled` / `getButtonIconName` for all 4 phases
    - Verify `getNoticeBody` does not contain "force-quit"
    - Verify `getHeroBody` contains at most two sentences
    - Verify `getTimerAccessibilityLabel` for specific durations: 0ms, 1000ms, 61000ms, 3661000ms
    - Verify `getButtonAccessibilityLabel` for all 4 phases
    - _Requirements: 7.3, 3.2–3.5, 4.2–4.6, 5.4, 1.4, 9.2, 9.1_

  - [-] 2.2 Write property-based test for timer accessibility label using fast-check
    - **Property 1: Timer accessibility label produces a valid human-friendly string for any duration**
    - Generate random non-negative integers for `durationMillis`
    - Assert result is a non-empty string containing human-friendly time units, not raw ms values
    - Minimum 100 iterations
    - **Validates: Requirements 9.2, 9.5**

- [x] 3. Checkpoint — Ensure all presentation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend design system components with accessibility props
  - [x] 4.1 Add `accessibilityLabel` prop to `PillButton` in `src/components/ui/PillButton.tsx`
    - Accept optional `accessibilityLabel?: string` in props
    - Forward it to the underlying `Pressable`
    - _Requirements: 9.1_

  - [x] 4.2 Add `accessibilityLabel` prop to `StatusChip` in `src/components/ui/StatusChip.tsx`
    - Accept optional `accessibilityLabel?: string` in props
    - Forward it to the outer `View`
    - _Requirements: 9.3_

- [x] 5. Rewrite RecordScreen to compose design system components
  - [x] 5.1 Rewrite `src/screens/RecordScreen.tsx` to use design system components and presentation layer
    - Use `EditorialHero` for the hero section with props from `getHeroEyebrow`, `getHeroHeadline`, `getHeroBody`
    - Use `SurfaceCard` (default) for the recording controls card containing TextInput, StatusChip, timer, and PillButton
    - Use `SurfaceCard` (muted) for the notice banner with `SectionHeading` and body text from `getNoticeTitle` / `getNoticeBody`
    - Use `SectionHeading` and body text for the consent footer from `getConsentHeading` / `getConsentBody`
    - Wrap each section in `FadeInView` with staggered delays (0, 70, 140, 210)
    - Use `ScreenBackground` behind the scroll content
    - Timer text uses `typography.display` token
    - All copy comes from presentation functions — no hardcoded user-facing strings
    - All styles use theme tokens — no hardcoded hex colors, font weights, or border radii
    - Pass `accessibilityLabel` to PillButton, StatusChip, timer View, and TextInput
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 4.1, 4.6, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The recording session service layer (`recordingSession.ts`) is unchanged
- Property test validates the timer accessibility label over a large input space using fast-check
- Example-based tests exhaustively cover the 4-phase enum for all status/button functions
