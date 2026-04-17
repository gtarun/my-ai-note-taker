# Running Locally

## Fresh Machine Bootstrap

If you are picking this repo up on another machine, do this first:

### 1. Clone and install

```bash
git clone <your-repo-url>
cd mu-fathom
npm install
```

`npm install` runs the repo `postinstall` patch automatically.

### 2. Install the platform toolchains you actually need

- `Expo Go only`: Node.js, npm, Expo Go on your phone
- `iOS native/dev build`: Xcode, CocoaPods, an installed iOS simulator runtime or a real iPhone
- `Android native/dev build`: Android Studio, Android SDK, and a working Java runtime/JDK

If Java is missing, local Android builds will fail before Gradle even starts.

### 3. Regenerate native folders if needed

If you pulled config/plugin changes, or the native folders are missing on the new machine:

```bash
npx expo prebuild --platform ios --platform android --no-install
```

Then, for iOS:

```bash
cd ios
pod install
cd ..
```

### 4. Choose the right validation path

- use `Expo Go` for the remote-provider app flow
- use `Xcode` or a custom dev build for iOS native features
- use `expo run:android` or Android Studio only if the machine has Java + Android SDK set up

Important:

- background recording is a native-capability feature
- validate it on a real device with a dev build or native run, not just Expo Go
- if Xcode says an iOS platform/runtime is not installed, install that simulator runtime from Xcode settings or use a real device

## What To Use

There are two practical ways to run this app locally:

- `Expo Go`: fastest way to test recording, import, remote transcription, summaries, and most UI, but not the local engine or native background-recording validation
- `Xcode` or a custom dev build on iPhone: use this when you need native iOS debugging, background recording, or the real local transcription runtime

Blunt rule:

- if you just want to test the current remote-provider app, use Expo Go
- if you want to test iOS local transcription, Expo Go is not enough

## Prerequisites

- Node.js installed
- npm installed
- Xcode installed if you want to run the iOS project directly
- CocoaPods working on your Mac for iOS native builds
- Expo Go installed on your phone if you use the Expo path

## Option 1: Run With Expo Go

This is the fastest path for normal app testing.

### 1. Install dependencies

```bash
npm install
```

### 2. Start Metro

```bash
npx expo start --lan --clear
```

Use `--lan` so your phone can see the dev server on the same Wi-Fi.

### 3. Open the app on your phone

- iPhone: scan the QR code with the Camera app or open it in Expo Go
- Android: scan the QR code inside Expo Go

### 4. Test the main flow

1. Open `Settings`
2. Add a remote provider API key
3. Pick providers for transcription and summary
4. Record or import audio
5. Open the meeting
6. Tap `Run transcript + summary`

### What works in Expo Go

- recording
- import
- local storage
- remote transcription
- remote summary
- share/export
- most settings/account UI

### What does not work in Expo Go

- the local/offline inference runtime
- anything that depends on the native `MuFathomLocalAI` module
- reliable validation of the new background-recording capability on iOS/Android native app configs

## Option 2: Run From Xcode

Use this when you want a native iOS run/debug loop.

### 1. Install dependencies

```bash
npm install
```

### 2. Make sure the iOS project exists

This repo already has an `ios/` folder checked into the workspace.

If you ever blow it away or need to regenerate native files after config/plugin changes:

```bash
npx expo prebuild -p ios
```

### 3. Install pods

If pods are not already installed or need refresh:

```bash
cd ios
pod install
cd ..
```

### 4. Open the workspace

Open:

- [mufathom.xcworkspace](../ios/mufathom.xcworkspace)

Important:

- open the `.xcworkspace`
- do not open the `.xcodeproj` by itself

### 5. Configure signing

In Xcode:

1. Select the `mufathom` project
2. Select the `mufathom` target
3. Open `Signing & Capabilities`
4. Pick your Apple team if needed
5. Make sure the bundle id is one you can run locally

### 6. Start Metro

In the repo root:

```bash
npx expo start --dev-client --clear
```

### 7. Run from Xcode

In Xcode:

1. Choose the `mufathom` scheme
2. Pick an iPhone simulator or your connected device
3. Press Run

If the app launches but does not connect to JS, make sure Metro is already running.

### Background recording note

If you are specifically validating background recording on iPhone:

1. run a native/dev build, not Expo Go
2. start a recording on a real device
3. lock the screen or background the app
4. wait 15 to 30 seconds
5. return to the app and confirm the timer advanced
6. stop and confirm the meeting still saves

## Option 3: Build A Dev Client From CLI

This is useful when you want native modules but do not want to live entirely inside Xcode.

### iOS

```bash
npx expo run:ios
```

Then keep Metro running with:

```bash
npx expo start --dev-client --clear
```

### Android

```bash
npx expo run:android
```

Then keep Metro running with:

```bash
npx expo start --dev-client --clear
```

This path needs a working local Java runtime and Android SDK.

## Option 4: Use EAS Builds

Use EAS when you want a real installable build instead of running everything directly from Xcode or Expo Go.

This repo currently has these EAS build profiles in [eas.json](../eas.json):

- `development`: internal dev client build
- `preview`: internal preview build
- `production`: production build with auto-incremented versioning

### Login first

```bash
eas login
```

### Development build

Use this when you want a custom dev client that can talk to Metro and support native modules.

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

After installing the development build on your device, run:

```bash
npx expo start --dev-client --clear
```

### Preview build

Use this when you want an installable internal QA build without the live dev loop.

```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

### Production build

Use this when you are preparing store-ready binaries.

```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

### Submit builds

When you are ready to submit production builds:

```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

### Which EAS profile should you use

- use `development` for native/local-runtime work and normal device testing with Metro
- use `preview` for sharing a build with testers
- use `production` for App Store / Play Store submission

## Which Mode You Should Use Right Now

For this repo today:

- use `Expo Go` if you want to test the current working app
- use `Xcode` or an `EAS development` build on a real iPhone if you want to test iOS local transcription
- use `EAS development` if you want a custom dev client on a real device without living in Xcode

The iOS local transcription slice is real now for `whisper-base`. The supported offline validation path is a custom iPhone build running a transcript-only flow; local summary is still unsupported on-device.

## Phase 2 Runtime Reality

What is true now:

- the repo includes a real Expo local module at `modules/mu-fathom-local-ai`
- iOS custom builds can run the `whisper-base` local transcription path
- iOS is the first platform with real local transcription
- Android is a later-phase local-engine target

What is still not true:

- local summary on-device is still unsupported
- Expo Go still cannot do real local inference

## iOS Everyday Flow

The iOS project is already checked in, so this is the normal path for local-transcription work:

1. Keep using the checked-in `ios/` project.
2. Install pods if needed:

```bash
cd ios
pod install
```

3. Open [mufathom.xcworkspace](../ios/mufathom.xcworkspace) in Xcode or run `npx expo run:ios` for a dev build.
4. Install `whisper-base` in the app.
5. Select `Local` for transcription on iOS.
6. Run a meeting transcription flow on the device.
7. Verify the transcript comes back offline.
8. Do not expect local summary to work yet.

## Optional iOS Regeneration

Only regenerate native files when config or plugin changes require it:

```bash
npx expo prebuild -p ios
```

That path is optional, not the day-to-day default.

If you need Android later, the app-root `android/` project directory is still not checked in. The native module does include Android code under `modules/mu-fathom-local-ai/android`.

## Common Problems

### Phone cannot connect to Expo

- make sure phone and Mac are on the same Wi-Fi
- use `npx expo start --lan --clear`
- retry the QR code

### iOS recording fails

- make sure microphone permission is granted
- use a real device, not web
- restart the app after granting permission

### Background recording does not continue

- test with a native/dev build, not Expo Go
- test on a real phone, not only the simulator
- confirm the current app config includes the `expo-audio` plugin with background recording enabled
- on iOS, confirm the generated native app includes `UIBackgroundModes = audio`
- on Android, confirm the generated manifest includes foreground-service microphone permissions

### Xcode build opens but JS does not load

- start Metro first with `npx expo start --dev-client --clear`
- rebuild after Metro is running

### Xcode says the iOS platform/runtime is not installed

- open Xcode
- install the missing iOS simulator runtime from Xcode settings
- or run on a real device instead of the simulator

### Android build fails immediately

- make sure Java/JDK is installed and available on `PATH`
- make sure Android Studio and the Android SDK are installed
- then retry `npx expo run:android`

### EAS build confusion

- `development` is the one you want for a custom dev client
- `preview` is for installable internal testing
- `production` is for release builds, not normal local iteration

### Local model mode fails

That is expected right now for local summary, or if you try to use anything other than `whisper-base` for iOS transcription.

The JS app supports:

- local model catalog
- local model selection
- local provider routing

But it still does not include:

- local summary on-device
- iOS local transcription for models other than `whisper-base`
