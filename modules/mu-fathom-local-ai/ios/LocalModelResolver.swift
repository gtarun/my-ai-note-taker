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

  func resolveSummaryModelPath(for modelId: String) throws -> String {
    let trimmedModelId = modelId.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !trimmedModelId.isEmpty else {
      throw Exception(
        name: "E_LOCAL_SUMMARY_MODEL",
        description: "Missing local summary model ID."
      )
    }

    let modelsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("models", isDirectory: true)

    let candidateURLs = [
      modelsDirectory.appendingPathComponent("\(trimmedModelId).task"),
      modelsDirectory.appendingPathComponent("\(trimmedModelId).bin"),
      modelsDirectory.appendingPathComponent("\(trimmedModelId).litertlm"),
      modelsDirectory.appendingPathComponent(trimmedModelId, isDirectory: true).appendingPathComponent("\(trimmedModelId).task"),
      modelsDirectory.appendingPathComponent(trimmedModelId, isDirectory: true).appendingPathComponent("\(trimmedModelId).bin"),
      modelsDirectory.appendingPathComponent(trimmedModelId, isDirectory: true).appendingPathComponent("\(trimmedModelId).litertlm"),
    ]

    if let installedModelURL = candidateURLs.first(where: { FileManager.default.fileExists(atPath: $0.path) }) {
      return installedModelURL.path
    }

    if let discoveredURL = discoverInstalledSummaryModel(in: modelsDirectory, modelId: trimmedModelId) {
      return discoveredURL.path
    }

    throw Exception(
      name: "E_LOCAL_SUMMARY_MODEL_MISSING",
      description: "\(trimmedModelId) is not installed in the app documents/models directory."
    )
  }

  private func discoverInstalledSummaryModel(in modelsDirectory: URL, modelId: String) -> URL? {
    guard let enumerator = FileManager.default.enumerator(
      at: modelsDirectory,
      includingPropertiesForKeys: [.isRegularFileKey],
      options: [.skipsHiddenFiles]
    ) else {
      return nil
    }

    let allowedExtensions = Set(["task", "bin", "litertlm"])

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
