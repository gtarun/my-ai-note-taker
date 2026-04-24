import ExpoModulesCore
import Foundation

public class MuFathomLocalAIModule: Module {
  private let whisperRuntime = WhisperRuntime()
  private let llamaRuntime = LlamaRuntime()
  private let modelResolver = LocalModelResolver()
  private let audioNormalizer = AudioNormalizer()

  public func definition() -> ModuleDefinition {
    Name("MuFathomLocalAI")

    AsyncFunction("getDeviceSupport") {
      return [
        "platform": "ios",
        "localProcessingAvailable": true,
        "supportsSummary": true,
        "supportsTranscription": true,
        "requiresCustomBuild": false,
        "reason": "iOS local transcription and summary are available in this build."
      ]
    }

    AsyncFunction("transcribe") { (params: LocalTranscribeParams) -> String in
      let audioUri = params.audioUri.trimmingCharacters(in: .whitespacesAndNewlines)
      let modelId = params.modelId.trimmingCharacters(in: .whitespacesAndNewlines)

      if audioUri.isEmpty {
        throw Exception(name: "E_LOCAL_TRANSCRIBE_INPUT", description: "Missing local audio URI.")
      }
      if modelId.isEmpty {
        throw Exception(name: "E_LOCAL_TRANSCRIBE_MODEL", description: "Missing local transcription model ID.")
      }

      let modelPath = try modelResolver.resolveWhisperBasePath(for: modelId)
      let normalizedAudioURL = try audioNormalizer.normalizeForWhisper(inputUri: audioUri)
      defer {
        try? FileManager.default.removeItem(at: normalizedAudioURL)
      }

      let transcript = try whisperRuntime.transcribe(audioPath: normalizedAudioURL.path, modelPath: modelPath)
      let trimmedTranscript = transcript.trimmingCharacters(in: .whitespacesAndNewlines)

      guard !trimmedTranscript.isEmpty else {
        throw Exception(name: "E_LOCAL_TRANSCRIBE_EMPTY", description: "Local transcription returned no text.")
      }

      return trimmedTranscript
    }

    AsyncFunction("summarize") { (params: LocalSummarizeParams) -> String in
      let prompt = params.prompt.trimmingCharacters(in: .whitespacesAndNewlines)
      let modelId = params.modelId.trimmingCharacters(in: .whitespacesAndNewlines)

      if prompt.isEmpty {
        throw Exception(name: "E_LOCAL_SUMMARY_INPUT", description: "Missing local summary prompt.")
      }
      if modelId.isEmpty {
        throw Exception(name: "E_LOCAL_SUMMARY_MODEL", description: "Missing local summary model ID.")
      }

      let modelPath = try modelResolver.resolveSummaryModelPath(for: modelId)
      return try await llamaRuntime.generate(prompt: prompt, modelPath: modelPath, maxTokens: 1024)
    }
  }
}

struct LocalTranscribeParams: Record {
  @Field
  var audioUri: String = ""

  @Field
  var modelId: String = ""
}

struct LocalSummarizeParams: Record {
  @Field
  var prompt: String = ""

  @Field
  var modelId: String = ""
}
