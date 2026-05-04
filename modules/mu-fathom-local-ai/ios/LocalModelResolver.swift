import ExpoModulesCore
import Foundation

struct LocalModelResolver {
  /// Whisper variants the iOS bridge accepts. Keep in sync with
  /// `IOS_SUPPORTED_TRANSCRIPTION_MODEL_IDS` in `localModels.ts` and
  /// `IOS_LOCAL_TRANSCRIPTION_MODEL_IDS` in `localInference.ts`.
  private static let supportedTranscriptionModelIds: Set<String> = [
    "whisper-base",
    "whisper-small",
  ]

  /// Map of catalog id → ggml file name pattern shipped on Hugging Face.
  /// Used as a legacy fallback when older installs stored the file by its
  /// upstream name instead of the catalog id.
  private static let legacyFileNames: [String: String] = [
    "whisper-base": "ggml-base.bin",
    "whisper-small": "ggml-small.bin",
  ]

  func resolveWhisperBasePath(for modelId: String) throws -> String {
    let trimmedModelId = modelId.trimmingCharacters(in: .whitespacesAndNewlines)

    guard Self.supportedTranscriptionModelIds.contains(trimmedModelId) else {
      let supported = Self.supportedTranscriptionModelIds.sorted().joined(separator: ", ")
      throw Exception(
        name: "E_LOCAL_TRANSCRIBE_MODEL_UNSUPPORTED",
        description:
          "This local transcription model is not supported on iOS in this build. Install one of: \(supported)."
      )
    }

    let modelsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("models", isDirectory: true)
    let legacyName = Self.legacyFileNames[trimmedModelId]

    var candidateURLs: [URL] = [
      // Default path used by the JS download code: models/{modelId}.bin
      modelsDirectory.appendingPathComponent("\(trimmedModelId).bin"),
      modelsDirectory.appendingPathComponent(trimmedModelId, isDirectory: true)
        .appendingPathComponent("\(trimmedModelId).bin"),
    ]

    // Legacy/upstream filename fallbacks (e.g. ggml-base.bin) for installs that
    // predate the catalog-id naming convention.
    if let legacyName {
      candidateURLs.append(modelsDirectory.appendingPathComponent(legacyName))
      candidateURLs.append(
        modelsDirectory
          .appendingPathComponent(trimmedModelId, isDirectory: true)
          .appendingPathComponent(legacyName)
      )
    }

    if let installedModelURL = candidateURLs.first(where: { FileManager.default.fileExists(atPath: $0.path) }) {
      return installedModelURL.path
    }

    throw Exception(
      name: "E_LOCAL_TRANSCRIBE_MODEL_MISSING",
      description: "\(trimmedModelId) is not installed in the app documents/models directory."
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
