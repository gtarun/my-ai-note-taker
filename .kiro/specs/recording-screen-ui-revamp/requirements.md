# Requirements Document

## Introduction

A full UI/UX revamp of the "New Recording" tab in AI Notes. The current screen is functional but lacks polish — the goal is to elevate it to a professional, editorial-quality experience using the existing design system (SurfaceCard, PillButton, StatusChip, EditorialHero, FadeInView, ScreenBackground) and the Manrope + Inter type scale. The revamp covers layout, visual hierarchy, micro-interactions, copy quality, and accessibility — without changing the underlying recording state machine or service layer.

## Glossary

- **Record_Screen**: The "New Recording" tab screen (`RecordScreen.tsx`) where users start, monitor, and stop audio recordings.
- **Recording_Session**: The state machine service (`recordingSession.ts`) that manages the idle → recording → saving → idle lifecycle.
- **Presentation_Layer**: The pure-function module (`features/recording/presentation.ts`) that computes status labels, notice copy, and support text for the Record_Screen.
- **Design_System**: The shared UI primitives in `src/components/ui/` (SurfaceCard, PillButton, StatusChip, EditorialHero, SectionHeading) plus theme tokens from `src/theme.ts`.
- **Timer_Display**: The large elapsed-time counter shown during a recording session.
- **Status_Indicator**: The chip or badge that communicates the current recording phase (idle, recording, saving).
- **Hero_Section**: The top editorial area of the screen that sets context and tone before the user interacts with recording controls.
- **Consent_Footer**: The informational section at the bottom of the screen reminding users about recording consent.
- **Notice_Banner**: An informational card displayed on the screen to communicate operational guidance (e.g., background recording behavior).

## Requirements

### Requirement 1: Editorial Hero Section

**User Story:** As a user, I want the recording screen to greet me with a clear, professional headline and context, so that I immediately understand what this screen does and feel confident using it.

#### Acceptance Criteria

1. THE Record_Screen SHALL display a Hero_Section at the top of the scrollable content using the EditorialHero component from the Design_System.
2. THE Hero_Section SHALL include an eyebrow label, a headline, and a short body paragraph that communicate the screen's purpose.
3. THE Presentation_Layer SHALL provide the eyebrow text, headline text, and body text for the Hero_Section as pure functions.
4. THE Hero_Section copy SHALL use active voice, avoid jargon, and be no longer than two sentences for the body paragraph.

### Requirement 2: Recording Controls Card

**User Story:** As a user, I want the recording controls to be visually grouped in a polished card with clear hierarchy, so that I can quickly find and use the title input, timer, and record button.

#### Acceptance Criteria

1. THE Record_Screen SHALL render the meeting title input, Timer_Display, Status_Indicator, and record/stop button inside a single SurfaceCard from the Design_System.
2. THE SurfaceCard SHALL use the default (non-muted) variant with the standard card elevation and border radius tokens from the Design_System.
3. THE meeting title TextInput SHALL use a placeholder that suggests concrete meeting types (e.g., "Team standup, client call, 1-on-1…").
4. THE Presentation_Layer SHALL provide the placeholder text for the meeting title input as a pure function.

### Requirement 3: Timer Display and Status Indicator

**User Story:** As a user, I want to see a large, prominent timer and a clear status badge so that I always know whether a recording is active and how long it has been running.

#### Acceptance Criteria

1. THE Timer_Display SHALL render the elapsed duration in a large display-weight typeface using the `typography.display` token from the Design_System.
2. WHILE the Recording_Session phase is "recording", THE Status_Indicator SHALL display a StatusChip with a "danger" tone and a label indicating active recording.
3. WHILE the Recording_Session phase is "idle", THE Status_Indicator SHALL display a StatusChip with a "secondary" tone and a label indicating readiness.
4. WHILE the Recording_Session phase is "saving", THE Status_Indicator SHALL display a StatusChip with a "tertiary" tone and a label indicating the save is in progress.
5. THE Presentation_Layer SHALL provide the status label text and the StatusChip tone for each Recording_Session phase as pure functions.

### Requirement 4: Record and Stop Button

**User Story:** As a user, I want a prominent, clearly labeled button that adapts its appearance and label to the current recording state, so that I always know what action I am about to take.

#### Acceptance Criteria

1. THE Record_Screen SHALL render the primary action button using the PillButton component from the Design_System.
2. WHILE the Recording_Session phase is "idle" or "error", THE PillButton SHALL use the "primary" variant and display a label that invites the user to start recording.
3. WHILE the Recording_Session phase is "recording", THE PillButton SHALL use a danger-styled appearance and display a label that communicates stopping and saving.
4. WHILE the Recording_Session phase is "saving", THE PillButton SHALL be disabled and display a label indicating the save is in progress.
5. THE Presentation_Layer SHALL provide the button label text for each Recording_Session phase as a pure function.
6. THE PillButton SHALL include an icon (microphone for start, stop-circle for stop) rendered to the left of the label.

### Requirement 5: Operational Notice Banner

**User Story:** As a user, I want to see a concise, helpful notice about background recording behavior, so that I understand how the app works without being overwhelmed by technical details.

#### Acceptance Criteria

1. THE Record_Screen SHALL display a Notice_Banner inside a SurfaceCard with the muted variant from the Design_System.
2. THE Notice_Banner SHALL include a short title and a body paragraph explaining background recording behavior.
3. THE Presentation_Layer SHALL provide the notice title and notice body as pure functions.
4. THE notice body copy SHALL be one to two sentences, use active voice, and avoid technical jargon like "force-quit" in favor of plain language.

### Requirement 6: Consent Footer

**User Story:** As a user, I want a brief, respectful reminder about recording consent at the bottom of the screen, so that I am prompted to inform meeting participants.

#### Acceptance Criteria

1. THE Record_Screen SHALL display the Consent_Footer below the recording controls card.
2. THE Consent_Footer SHALL include a short heading and a one-sentence body that reminds the user to inform participants about the recording.
3. THE Presentation_Layer SHALL provide the consent heading and consent body as pure functions.
4. THE consent copy SHALL use a supportive, non-legalistic tone.

### Requirement 7: Professional Copy Throughout

**User Story:** As a user, I want all text on the recording screen to feel polished and intentional, so that the app feels trustworthy and well-crafted.

#### Acceptance Criteria

1. THE Presentation_Layer SHALL be the single source of truth for all user-facing copy on the Record_Screen.
2. THE Record_Screen SHALL not contain any hardcoded user-facing strings — all copy SHALL come from the Presentation_Layer.
3. THE Presentation_Layer SHALL have a co-located test file (`presentation.test.ts`) that verifies each copy function returns a non-empty string.

### Requirement 8: Layout, Spacing, and Visual Hierarchy

**User Story:** As a user, I want the recording screen to have consistent spacing, clear visual hierarchy, and a polished layout, so that the interface feels professional and easy to scan.

#### Acceptance Criteria

1. THE Record_Screen SHALL use the ScreenBackground component to render ambient gradient blobs behind the content.
2. THE Record_Screen SHALL wrap all content sections in FadeInView with staggered delay values to create a sequential entrance animation.
3. THE Record_Screen SHALL use a vertical gap of at least 16 logical pixels between top-level content sections.
4. THE Record_Screen SHALL use the `palette`, `radii`, `typography`, and `elevation` tokens from the Design_System for all styling — no hardcoded color hex values, font weights, or border radii.

### Requirement 9: Accessibility

**User Story:** As a user who relies on assistive technology, I want the recording screen to be navigable and understandable with a screen reader, so that I can record meetings independently.

#### Acceptance Criteria

1. THE record/stop PillButton SHALL include an `accessibilityLabel` that describes the action (e.g., "Start recording" or "Stop and save recording").
2. THE Timer_Display SHALL include an `accessibilityLabel` that reads the elapsed time in a human-friendly format (e.g., "2 minutes 15 seconds").
3. THE Status_Indicator StatusChip SHALL include an `accessibilityLabel` that reads the current recording status.
4. THE meeting title TextInput SHALL include an `accessibilityLabel` of "Meeting title".
5. THE Presentation_Layer SHALL provide the accessibility label text for the timer and the record button as pure functions.
