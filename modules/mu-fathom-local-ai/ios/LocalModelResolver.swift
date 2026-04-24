import ExpoModulesCore
import Foundation

struct LocalModelResolver {
  private static let supportedTranscriptionModelId = "whisper-base"
  private static let supportedSummaryModelIds: Set<String> = [
    "qwen2.5-1.5b-instruct-gguf-q4"
  ]

  func resolveWhisperBasePath(for modelId: String) throws -> String {
    guard modelId == Self.supportedTranscriptionModelId else {
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

  func resolveSummaryModelPath(for modelId: String) throws -> String {
    guard Self.supportedSummaryModelIds.contains(modelId) else {
      throw Exception(
        name: "E_LOCAL_SUMMARY_MODEL_UNSUPPORTED",
        description: "This summary model is not supported on iOS in this phase."
      )
    }

    let modelsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("models", isDirectory: true)
    let candidateURLs = [
      modelsDirectory.appendingPathComponent("\(modelId).gguf"),
      modelsDirectory.appendingPathComponent(modelId, isDirectory: true).appendingPathComponent("\(modelId).gguf"),
    ]

    if let installedModelURL = candidateURLs.first(where: { FileManager.default.fileExists(atPath: $0.path) }) {
      return installedModelURL.path
    }

    throw Exception(
      name: "E_LOCAL_SUMMARY_MODEL_MISSING",
      description: "Local summary model is not installed in the app documents/models directory."
    )
  }
}
