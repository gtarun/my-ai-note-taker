import ExpoModulesCore
import Foundation

#if canImport(MediaPipeTasksGenAI)
import MediaPipeTasksGenAI

final class SummaryRuntime {
  private let queue = DispatchQueue(label: "com.gtarun.mu-fathom.local-summary", qos: .userInitiated)
  private var cachedModelPath: String?
  private var cachedInference: LlmInference?

  func summarize(prompt: String, modelPath: String) throws -> String {
    let trimmedPrompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !trimmedPrompt.isEmpty else {
      throw Exception(
        name: "E_LOCAL_SUMMARY_INPUT",
        description: "Missing local summary prompt."
      )
    }

    return try queue.sync {
      let inference = try inference(for: modelPath)
      let response = try inference.generateResponse(inputText: trimmedPrompt)
      let trimmedResponse = response.trimmingCharacters(in: .whitespacesAndNewlines)

      guard !trimmedResponse.isEmpty else {
        throw Exception(
          name: "E_LOCAL_SUMMARY_EMPTY",
          description: "Local summary model returned no content."
        )
      }

      return trimmedResponse
    }
  }

  private func inference(for modelPath: String) throws -> LlmInference {
    if let cachedInference, cachedModelPath == modelPath {
      return cachedInference
    }

    let options = LlmInference.Options(modelPath: modelPath)
    options.maxTokens = 1024

    let inference = try LlmInference(options: options)
    cachedModelPath = modelPath
    cachedInference = inference
    return inference
  }
}

#else

final class SummaryRuntime {
  func summarize(prompt: String, modelPath: String) throws -> String {
    throw Exception(
      name: "E_LOCAL_SUMMARY_RUNTIME_UNAVAILABLE",
      description: "This build does not include the iOS local summary runtime yet."
    )
  }
}

#endif
