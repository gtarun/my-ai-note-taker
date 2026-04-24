import ExpoModulesCore
import Foundation

struct LocalModelResolver {
  private static let supportedTranscriptionModelId = "whisper-base"

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

  /// Resolves an installed summary model path on disk. The `engine` argument
  /// drives which file extensions to probe:
  /// - `llama.cpp` → `.gguf`
  /// - `mediapipe-llm` / `litert-lm` → `.task`, `.bin`, `.litertlm`, with a
  ///   directory-walk fallback that tolerates catalog-id/file-id drift.
  func resolveSummaryModelPath(for modelId: String, engine: String) throws -> String {
    let trimmedModelId = modelId.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedEngine = engine.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

    guard !trimmedModelId.isEmpty else {
      throw Exception(
        name: "E_LOCAL_SUMMARY_MODEL",
        description: "Missing local summary model ID."
      )
    }

    let modelsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("models", isDirectory: true)

    let extensions: [String]
    let allowDiscovery: Bool
    switch trimmedEngine {
    case "llama.cpp":
      extensions = ["gguf"]
      allowDiscovery = false
    case "mediapipe-llm", "litert-lm":
      extensions = ["task", "bin", "litertlm"]
      allowDiscovery = true
    default:
      throw Exception(
        name: "E_LOCAL_SUMMARY_ENGINE_UNSUPPORTED",
        description: "Unsupported local summary engine: \(engine)."
      )
    }

    var candidateURLs: [URL] = []
    for ext in extensions {
      candidateURLs.append(modelsDirectory.appendingPathComponent("\(trimmedModelId).\(ext)"))
      candidateURLs.append(
        modelsDirectory
          .appendingPathComponent(trimmedModelId, isDirectory: true)
          .appendingPathComponent("\(trimmedModelId).\(ext)")
      )
    }

    if let installedModelURL = candidateURLs.first(where: { FileManager.default.fileExists(atPath: $0.path) }) {
      return installedModelURL.path
    }

    if allowDiscovery,
       let discoveredURL = discoverInstalledSummaryModel(
        in: modelsDirectory,
        modelId: trimmedModelId,
        allowedExtensions: Set(extensions)
       ) {
      return discoveredURL.path
    }

    throw Exception(
      name: "E_LOCAL_SUMMARY_MODEL_MISSING",
      description: "\(trimmedModelId) is not installed in the app documents/models directory."
    )
  }

  private func discoverInstalledSummaryModel(
    in modelsDirectory: URL,
    modelId: String,
    allowedExtensions: Set<String>
  ) -> URL? {
    guard let enumerator = FileManager.default.enumerator(
      at: modelsDirectory,
      includingPropertiesForKeys: [.isRegularFileKey],
      options: [.skipsHiddenFiles]
    ) else {
      return nil
    }

    for case let fileURL as URL in enumerator {
      guard allowedExtensions.contains(fileURL.pathExtension.lowercased()) else {
        continue
      }

      let fileName = fileURL.deletingPathExtension().lastPathComponent.lowercased()
      let normalizedModelId = modelId.lowercased()

      if fileName == normalizedModelId || fileName.hasPrefix("\(normalizedModelId)-") {
        return fileURL
      }
    }

    return nil
  }
}
