# Settings UX Cleanup Design

## Goal

Make Settings feel like a guided control panel instead of a long configuration form. The screen should ask the user to choose Cloud or Offline first, reveal only relevant controls, prevent duplicate paid local model downloads, and keep focused inputs visible above the keyboard.

## Approved Direction

- Add a top-level processing mode switch: `Cloud` or `Offline`.
- In Cloud mode, choose providers through dropdowns instead of an always-visible chip grid.
- Show configured providers as compact rows with a gear action that opens provider settings.
- In provider settings, choose transcription and summary models from dropdowns.
- Hide base URL behind an advanced endpoint section, except for the custom provider where base URL is required.
- In Offline mode, show runtime status and local model download cards only.
- Guard local model downloads so repeated taps cannot start duplicate downloads.
- Show download progress from the shared offline setup session.
- Add a Settings action to reopen onboarding after it has already been completed.
- Add keyboard-safe behavior to input-heavy screens, including Settings and layer field editing.

## Interaction Model

The mode switch updates the selected providers immediately in local component state. Cloud defaults to the first configured cloud provider, with OpenAI as the fallback. Offline selects the local transcription provider and keeps cloud summary available until native local summary support exists.

Provider dropdowns select the active transcription and summary provider. A provider configuration sheet lets users edit API key, model choices, and advanced endpoint settings. Users must still tap `Save settings`, but the save button is repeated near the active configuration area so the next action is obvious.

Local model download buttons are disabled while their model is actively downloading. The lower-level download service also rejects a second concurrent download for the same model ID as a safety net.

## Keyboard Behavior

Input-heavy screens should use a shared `KeyboardAwareScreen` wrapper built with `KeyboardAvoidingView` and `ScrollView`. Modal form bodies in Layers should also use `keyboardShouldPersistTaps="handled"` so fields and actions remain usable while the keyboard is open.

## Testing

- Settings and local inference focused tests cover the changed provider/download behavior.
- Local model download service rejects duplicate concurrent downloads.
- Existing Settings, onboarding, offline setup, local inference, and layer tests remain green.
