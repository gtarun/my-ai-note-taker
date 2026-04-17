# Profile Avatar And Version Design

## Goal

Add a persistent profile entry in the top-right of the app header, move profile/account settings under that entry, and show a Blinkit-style build/version label at the bottom of the profile page.

## Decisions

- Add a shared top-right avatar button to the tab header for all tab screens.
- Tapping the avatar opens the existing `/account` route.
- The avatar is always visible, even when signed out.
- Signed-in state prefers the user's Google profile photo when available.
- If no profile photo is available, fall back to initials derived from display name or email.
- Signed-out state uses a generic avatar/person treatment.
- The Settings tab remains focused on app/provider/model configuration.
- Profile/account concerns move under the profile page accessed from the avatar button.
- The profile page includes a low-emphasis footer showing app version and native build number in the format `v1.0.0 (12)` when build info is available.

## Information Architecture

### Header entry

- The shared tab layout in `app/(tabs)/_layout.tsx` becomes responsible for rendering the top-right avatar button.
- The avatar button should be visually consistent across Meetings, Record, Settings, and Layers.
- Tapping the button always opens `/account`.

### Profile page

The existing account screen remains the destination, but its role expands into the main profile hub.

It should contain:
- identity summary at the top
  - avatar
  - display name
  - email
- signed-in actions
  - sign out
  - refresh account state if still useful
- Google integration status
  - Google connected / not connected
  - Drive save folder state
  - reconnect prompt if needed
- integration actions
  - sign in with Google
  - connect Google integration if needed
  - choose Drive save folder
- profile footer
  - app version/build string at the bottom of the page

### Settings tab scope

Settings continues to own:
- provider selection
- model selection/downloads
- local processing preferences
- other app behavior settings unrelated to account identity/integrations

Settings should not be the primary home for account/profile entry once the header avatar exists.

## UX Details

### Avatar rendering

Priority order:
1. remote profile image if available from account/profile metadata
2. initials from display name
3. initials from email
4. generic person icon

Avatar states:
- signed in with image: circular image
- signed in without image: soft filled circle with initials
- signed out: soft filled circle with person icon

### Profile footer

- centered at bottom of scroll content
- lower emphasis than section content
- format should be `v<appVersion> (<buildNumber>)` when build number exists
- in environments where build number is unavailable, the UI should degrade gracefully without looking broken

## Technical Notes

### Data sources

- Existing auth/session state from `src/services/account.ts` remains the basis for user identity.
- The session shape will need to expose avatar/profile photo metadata if it is not already mapped.
- App version can come from Expo config/constants.
- Native build number should be read from the platform/native constants source when available.

### Likely implementation areas

- `app/(tabs)/_layout.tsx`
  - inject shared headerRight avatar button
- `app/account.tsx`
  - evolve into fuller profile hub
- `src/services/account.ts`
  - map avatar/photo metadata into session model if needed
- `src/types.ts`
  - extend account/session typing if avatar URL is added
- settings screen files if any account shortcut needs removal

## Non-goals For This Pass

- editing avatar image
- editing profile fields like display name/timezone
- introducing a dedicated Profile tab
- adding environment badges such as Release/Preview/Dev next to the version footer

## Acceptance Criteria

- A top-right avatar button appears on tab screens.
- The avatar button is visible whether the user is signed in or not.
- Signed-in users see their Google photo when available, otherwise initials.
- Tapping the avatar opens the profile/account screen.
- Profile/account actions live on the profile page rather than being buried in Settings.
- The profile page shows a version footer formatted like `v1.0.0 (12)` when build data is available.
- The version footer degrades gracefully if build number metadata is missing in development.
