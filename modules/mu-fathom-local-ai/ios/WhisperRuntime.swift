import ExpoModulesCore
import Foundation

struct WhisperRuntime {
  func sdkVersion() -> String {
    WhisperBridge.sdkVersion()
  }

  func transcribe(audioPath: String, modelPath: String) throws -> String {
    do {
      return try WhisperBridge.transcribeFile(atPath: audioPath, modelPath: modelPath)
    } catch {
      throw Exception(name: "E_LOCAL_TRANSCRIBE_FAILED", description: error.localizedDescription)
    }
  }
}
