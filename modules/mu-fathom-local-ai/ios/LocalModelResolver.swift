import ExpoModulesCore
import Foundation

struct LocalModelResolver {
  private static let supportedModelId = "whisper-base"

  func resolveWhisperBasePath(for modelId: String) throws -> String {
    guard modelId == Self.supportedModelId else {
      throw Exception(
        name: "E_LOCAL_TRANSCRIBE_MODEL_UNSUPPORTED",
        description: "Only whisper-base is supported for local transcription on iOS in this phase."
      )
    }

    let modelsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("models", isDirectory: true)
    let candidateURLs = [
      modelsDirectory.appendingPathComponent("\(modelId).bin"),
      modelsDirectory.appendingPathComponent("ggml-base.bin"),
      modelsDirectory.appendingPathComponent(modelId, isDirectory: true).appendingPathComponent("\(modelId).bin"),
      modelsDirectory.appendingPathComponent(modelId, isDirectory: true).appendingPathComponent("ggml-base.bin"),
    ]

    if let installedModelURL = candidateURLs.first(where: { FileManager.default.fileExists(atPath: $0.path) }) {
      return installedModelURL.path
    }

    throw Exception(
      name: "E_LOCAL_TRANSCRIBE_MODEL_MISSING",
      description: "whisper-base is not installed in the app documents/models directory."
    )
  }
}
