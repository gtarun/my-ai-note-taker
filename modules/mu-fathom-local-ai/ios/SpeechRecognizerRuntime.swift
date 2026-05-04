import ExpoModulesCore
import Foundation
import Speech

/// Wraps Apple's SFSpeechRecognizer for offline, on-device transcription.
///
/// Runs on the Neural Engine on Apple Silicon; no model download required.
/// Selected by JS when the user picks the `apple-speech-recognizer` model id;
/// see `LocalModelEngine = 'apple-speech'` in `src/types.ts` and the catalog
/// entry in `src/services/localModels.ts`.
final class SpeechRecognizerRuntime {
  /// Catalog id used by the JS layer to select this runtime.
  /// Keep in sync with `localModels.ts` and `localInference.ts`.
  static let modelId = "apple-speech-recognizer"

  func transcribe(audioUri: String, locale: String = "en-US") async throws -> String {
    try await ensureAuthorization()

    let audioURL = try resolveAudioURL(from: audioUri)

    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)) else {
      throw Exception(
        name: "E_LOCAL_TRANSCRIBE_LOCALE",
        description: "Apple Speech does not support the locale '\(locale)' on this device."
      )
    }

    guard recognizer.isAvailable else {
      throw Exception(
        name: "E_LOCAL_TRANSCRIBE_UNAVAILABLE",
        description:
          "Apple Speech recognition is temporarily unavailable on this device. Try again in a moment, or pick a different transcription provider."
      )
    }

    // We require true on-device recognition for privacy. If the OS would have
    // to round-trip audio through Apple servers for this locale, refuse rather
    // than silently leaking data — the JS layer can fall back to whisper.cpp.
    if !recognizer.supportsOnDeviceRecognition {
      throw Exception(
        name: "E_LOCAL_TRANSCRIBE_NOT_OFFLINE",
        description:
          "On-device Apple Speech recognition is not supported for the locale '\(locale)' on this device. Switch to whisper.cpp or a cloud provider."
      )
    }

    let request = SFSpeechURLRecognitionRequest(url: audioURL)
    request.requiresOnDeviceRecognition = true
    request.shouldReportPartialResults = false
    if #available(iOS 16.0, *) {
      request.addsPunctuation = true
    }

    return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
      // SFSpeechRecognizer's resultHandler can fire several times (partials,
      // intermediate errors). Guard so the continuation only resumes once.
      var didResume = false
      let resumeOnce: (Result<String, Error>) -> Void = { result in
        guard !didResume else { return }
        didResume = true
        switch result {
        case .success(let text):
          continuation.resume(returning: text)
        case .failure(let error):
          continuation.resume(throwing: error)
        }
      }

      let task = recognizer.recognitionTask(with: request) { result, error in
        if let error = error {
          resumeOnce(.failure(error))
          return
        }

        guard let result = result, result.isFinal else { return }

        let text = result.bestTranscription.formattedString
          .trimmingCharacters(in: .whitespacesAndNewlines)

        if text.isEmpty {
          resumeOnce(.failure(Exception(
            name: "E_LOCAL_TRANSCRIBE_EMPTY",
            description: "Apple Speech completed but produced no transcript. The recording may be silent or too quiet — try again with the mic closer to the speaker."
          )))
        } else {
          resumeOnce(.success(text))
        }
      }

      // Hold on to the task so ARC doesn't tear it down before resultHandler fires.
      // Without this the Speech framework can cancel mid-flight on iOS 16+.
      _ = task
    }
  }

  private func resolveAudioURL(from audioUri: String) throws -> URL {
    let trimmed = audioUri.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      throw Exception(
        name: "E_LOCAL_TRANSCRIBE_INPUT",
        description: "Missing audio URI for Apple Speech transcription."
      )
    }

    let url: URL
    if trimmed.hasPrefix("file://"), let parsed = URL(string: trimmed), parsed.isFileURL {
      url = parsed
    } else {
      url = URL(fileURLWithPath: (trimmed as NSString).expandingTildeInPath)
    }

    guard FileManager.default.fileExists(atPath: url.path) else {
      throw Exception(
        name: "E_LOCAL_TRANSCRIBE_INPUT",
        description: "Audio file was not found before Apple Speech transcription started."
      )
    }

    return url
  }

  private func ensureAuthorization() async throws {
    let status = SFSpeechRecognizer.authorizationStatus()

    switch status {
    case .authorized:
      return
    case .denied:
      throw Exception(
        name: "E_LOCAL_TRANSCRIBE_PERMISSION",
        description:
          "Speech recognition permission was denied. Enable it in iOS Settings → Privacy & Security → Speech Recognition → Mu Fathom."
      )
    case .restricted:
      throw Exception(
        name: "E_LOCAL_TRANSCRIBE_PERMISSION",
        description:
          "Speech recognition is restricted on this device by a parental controls or MDM policy."
      )
    case .notDetermined:
      let granted = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
        SFSpeechRecognizer.requestAuthorization { status in
          continuation.resume(returning: status == .authorized)
        }
      }
      if !granted {
        throw Exception(
          name: "E_LOCAL_TRANSCRIBE_PERMISSION",
          description: "Speech recognition permission was not granted."
        )
      }
    @unknown default:
      throw Exception(
        name: "E_LOCAL_TRANSCRIBE_PERMISSION",
        description: "Unknown speech recognition permission state."
      )
    }
  }
}
