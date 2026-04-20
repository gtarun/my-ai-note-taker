# Current State (as of April 2026)

## What Works

- Full recording flow (manual start/stop, background recording on native builds)
- Audio file import via document picker
- Remote transcription via 9 providers (OpenAI, OpenRouter, Groq, Anthropic, Gemini, Together, Fireworks, DeepSeek, Custom)
- Remote summary generation with structured output (summary, action items, decisions, follow-ups)
- Local SQLite storage for meetings, models, extraction layers
- Meeting detail screen with transcript, summary, action items, decisions
- Native share/export
- Settings screen with multi-provider configuration
- Supabase Auth (sign-up, sign-in, session management)
- Google Drive backup (OAuth connect, folder picker, recording upload)
- Google Sheets integration for extraction layer sync
- Extraction layers (user-defined structured data extraction from transcripts)
- Cloud sync of settings, providers, and extraction layers when signed in
- Onboarding flow with offline setup guidance
- Local model catalog (built-in starter + optional custom URL)
- Local model download with size + SHA-256 verification
- iOS local transcription with whisper-base (real, works on native builds)
- Tab navigation (Meetings, Record, Layers, Settings)
- Editorial UI design system (Manrope + Inter fonts, semantic palette)
- Comprehensive test suite (vitest, co-located tests)

## What Doesn't Work Yet

- Local summary on-device (unsupported, needs Gemma-family runtime)
- iOS local transcription for models other than whisper-base
- Android local inference (boundary-only contract, later phase)
- Expo Go local inference (requires native build)
- Real-time transcription
- Auto-join meetings / calendar integration
- Imported file duration metadata
- Google Drive backup for imported files (only works for recordings)
- Drive upload retry/persistence (failures are alerts, not retryable jobs)
- Full multi-device meeting data sync
- Team features / collaboration

## Known Limitations

- No background job system for uploads or processing
- Recording is manual only
- Processing is post-meeting only
- Audio leaves device only when user triggers transcription
- The built-in local model catalog is a starter shape; real downloads need hosted model files
- Arbitrary local model import is intentionally not supported in v1
- Android native project not checked into git (needs `npx expo prebuild -p android`)
- Web build is scaffold-level, not production-ready

## Recent Work (from superpowers/plans)

- First-run onboarding flow
- Editorial UI refresh
- iOS local transcription (whisper-base real)
- Meeting detail UI refresh
- Native local runtime module
- Navigation shell + settings cleanup
- Layer editor + tab navigation
- Supabase hybrid user data sync
- Background recording
- Dashboard cleanup
- Layer save + sheet picker
- Profile avatar + version display
- Onboarding offline setup flow

## Suggested Next Work

- Native MuFathomLocalAI runtime for real on-device summary
- Better processing progress and retry UX
- Drive upload status/history in meeting detail
- Imported-file backup to Google Drive
- Optional metadata sync beyond file backup
- iOS transcription support for models beyond whisper-base
- Android local engine implementation
