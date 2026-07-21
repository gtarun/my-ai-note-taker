# Privacy Policy — AI Notes

**Last updated: 21 July 2026**

> **Before you publish:** this document is written from the app's actual data
> flows as implemented, but it is not legal advice. Have it reviewed, fill in
> the contact details and controlling entity below, host it at a public URL, and
> set `expo.extra.privacyPolicyUrl` in `app.json` to that URL. App review will
> look for it, and the in-app links stay hidden until it is set.

AI Notes is a meeting recorder that turns audio into transcripts and summaries.
It is local-first: your recordings live on your device, and nothing is sent
anywhere until you explicitly ask for a meeting to be processed.

## What stays on your device

By default, all of this stays on your device and is never transmitted:

- **Audio recordings**, stored in the app's private storage area.
- **Transcripts, summaries, action items, and decisions**, stored in a local
  database.
- **Diagnostic logs**, kept in a rolling local buffer of the most recent
  entries. Values that look like credentials are redacted before being written.
  These are only shared if you choose to export them.

Deleting a meeting in the app deletes its local record and audio file.

## What leaves your device, and when

### When you process a meeting

Processing is always an explicit action — you tap to analyze a specific
meeting. What happens then depends on the provider you choose in Settings:

- **On-device (iOS only).** Apple's built-in Speech framework, or a Whisper
  model you downloaded, transcribes the audio locally. The audio does not leave
  your device for this step.
- **A cloud provider.** Your audio and/or transcript is sent to the provider you
  configured — for example OpenAI, Anthropic, Google Gemini, OpenRouter, or
  Groq — using your own API key. **That provider's own privacy policy and data
  retention terms govern what happens to it there.** We do not control, receive,
  or store a copy of that traffic. Please read the policy of whichever provider
  you choose.

AI summaries require a cloud provider today, even when transcription runs
on-device.

### When you sign in

Signing in is optional. The app is fully usable without an account. If you do
sign in (by email or with Google), we store:

- your email address, and your name if your sign-in provider supplies it;
- your app preferences, such as which provider and language you selected;
- your provider API keys, **encrypted before storage**;
- your extraction layer definitions (the field schemas you create).

This is used only to sync your setup between your own devices.

### When you connect Google Drive

Optional, and off unless you connect it. If you do:

- We request access only to the Drive folder you pick.
- New recordings are uploaded to `mu-fathom/recordings/YYYY-MM` inside that
  folder, in your own Google account.
- Google access and refresh tokens are stored encrypted on our server so uploads
  can continue without re-prompting you.

### When you connect Google Sheets

Optional. If you connect a sheet to an extraction layer, the field values
extracted from a meeting are appended as a row to the spreadsheet you chose, in
your own Google account.

## What we do not do

- We do not sell or rent your data.
- We do not use your recordings, transcripts, or summaries to train any model.
- We do not run analytics or advertising SDKs in the app.
- We do not record automatically, join calls, or capture audio in the
  background. Recording only happens while you have explicitly started it.

## Recording consent is your responsibility

Laws on recording conversations vary by country and state, and in many places
every participant must consent. You are responsible for obtaining the consent
required where you are and where the other participants are.

## Your choices and rights

- **Use the app without an account.** Everything local works signed out.
- **Delete your account.** Settings → Account → Delete account permanently
  removes your account and its server-side data: preferences, provider
  configurations, extraction layers, and Google connection tokens. Recordings
  already on your device are not touched, and files already uploaded to your own
  Google Drive remain yours in your own Drive.
- **Disconnect Google.** You can revoke the app's access at any time from your
  Google account's security settings.
- **Delete individual meetings** at any time from the meeting screen.

Depending on where you live, you may also have rights to access, correct, port,
or erase your personal data. Contact us using the details below to exercise
them.

## Data retention

Local data stays until you delete it or uninstall the app. Server-side account
data is retained while your account exists and is removed when you delete your
account.

## Children

AI Notes is not directed at children and we do not knowingly collect personal
information from children.

## Changes

If this policy changes materially, we will update the date at the top and, where
appropriate, notify you in the app.

## Contact

<!-- TODO: fill in before publishing -->

- Controlling entity: _[legal entity name]_
- Contact: _[privacy contact email]_
- Address: _[postal address, if required in your jurisdiction]_
