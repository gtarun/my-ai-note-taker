# Running Locally

## What To Use

There are two practical ways to run this app locally:

- `Expo Go`: fastest way to test recording, import, remote transcription, summaries, and most UI
- `Xcode` or a custom dev build: use this when you need native iOS debugging, native modules, or anything the Expo Go shell does not include

Blunt rule:

- if you just want to test the current remote-provider app, use Expo Go
- if you want to work on local/offline model runtime, Expo Go is not enough

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

- the future local/offline inference runtime
- anything that depends on the native `MuFathomLocalAI` module

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

- [mufathom.xcworkspace](/Users/tarun/Documents/projects/mu-fathom/ios/mufathom.xcworkspace)

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

## Option 4: Use EAS Builds

Use EAS when you want a real installable build instead of running everything directly from Xcode or Expo Go.

This repo currently has these EAS build profiles in [eas.json](/Users/tarun/Documents/projects/mu-fathom/eas.json):

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
- use `Xcode` only if you need iOS-native debugging or want to start wiring native runtime pieces
- use `EAS development` if you want a custom dev client on a real device without living in Xcode

The local/offline model system is not fully runnable yet because the native `MuFathomLocalAI` runtime is still missing.

## Common Problems

### Phone cannot connect to Expo

- make sure phone and Mac are on the same Wi-Fi
- use `npx expo start --lan --clear`
- retry the QR code

### iOS recording fails

- make sure microphone permission is granted
- use a real device, not web
- restart the app after granting permission

### Xcode build opens but JS does not load

- start Metro first with `npx expo start --dev-client --clear`
- rebuild after Metro is running

### EAS build confusion

- `development` is the one you want for a custom dev client
- `preview` is for installable internal testing
- `production` is for release builds, not normal local iteration

### Local model mode fails

That is expected right now unless you implement the native local AI runtime.

The JS app supports:

- local model catalog
- local model selection
- local provider routing

But it still does not include:

- actual on-device `whisper.cpp`
- actual Gemma-family local summary runtime
- the native `MuFathomLocalAI` module
