import ExpoModulesCore
import Foundation

/// Serializes llama.cpp calls. `llama_decode` is not safe to call concurrently
/// on the same context; an actor keeps invocations strictly sequential while
/// still letting the Expo async-function thread pool park on `await`.
actor LlamaRuntime {
  private let bridge = LlamaBridge()

  func generate(prompt: String, modelPath: String, maxTokens: Int32) throws -> String {
    do {
      let output = try bridge.generate(
        prompt: prompt,
        modelPath: modelPath,
        maxTokens: maxTokens
      )
      let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
      if trimmed.isEmpty {
        throw Exception(
          name: "E_LOCAL_SUMMARY_EMPTY",
          description: "Local summary model returned no text."
        )
      }
      return trimmed
    } catch let error as NSError {
      throw Exception(name: "E_LOCAL_SUMMARY_FAILED", description: error.localizedDescription)
    }
  }

  func unload() {
    bridge.unload()
  }
}
