import ExpoModulesCore
import Foundation

struct WhisperRuntime {
  func sdkVersion() -> String {
    WhisperBridge.sdkVersion()
  }

  /// `language` is an ISO 639-1 code (`en`, `hi`, `pa`, …). Empty string ⇒
  /// whisper auto-detects the spoken language using its language-id step.
  func transcribe(samples: Data, modelPath: String, language: String = "") throws -> String {
    do {
      return try WhisperBridge.transcribeSamples(samples, modelPath: modelPath, language: language)
    } catch {
      throw Exception(name: "E_LOCAL_TRANSCRIBE_FAILED", description: error.localizedDescription)
    }
  }

  func transcribe(audioPath: String, modelPath: String, language: String = "") throws -> String {
    do {
      return try WhisperBridge.transcribeFile(atPath: audioPath, modelPath: modelPath, language: language)
    } catch {
      throw Exception(name: "E_LOCAL_TRANSCRIBE_FAILED", description: error.localizedDescription)
    }
  }
}
