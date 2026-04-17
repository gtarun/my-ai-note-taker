# Product Notes

## Product Shape

`AI Notes by Masters' Union` is a local-first AI meeting companion.

The MVP is not trying to auto-join meetings or invisibly capture everything. It is a manual tool for solo users who want fast post-meeting notes.

## Core Flow

1. User records a meeting or imports an audio file
2. App stores the audio locally on the device
3. User runs transcription after the meeting
4. App generates summary, action items, and decisions
5. User reviews and shares the output

## Target User

- solo builders
- indie hackers
- consultants
- operators
- anyone who wants a simple transcript + summary workflow without enterprise junk

## MVP Scope

- manual audio recording
- manual audio import
- post-meeting transcription
- AI-generated summary
- action items
- transcript view
- local storage
- native share/export
- experimental local model setup flow for future offline processing

## Explicit Non-Goals

- auto-joining calls
- calendar integrations
- real-time processing
- team collaboration
- enterprise permissions
- CRM sync
- search across every meeting ever recorded

## Review / Store Positioning

The app should be described as:

"A manual meeting recorder and import tool that turns audio into transcript and action items."

It should not be described as:

- stealth recorder
- automatic Zoom recorder
- background call capture tool

## Local Processing Position

Local processing is a second track, not the core MVP claim.

What is true today:

- the app can manage a curated local model catalog
- users can install/select local models
- the processing pipeline can route to a local runtime

What is not true yet:

- Expo Go does not run local inference
- the repo still needs the native `MuFathomLocalAI` implementation before Gemma-family summary and whisper.cpp transcription work on-device

## Product Principle

If a feature makes the app harder to ship in a week, it is probably out of scope for the MVP.
