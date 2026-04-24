import ExpoModulesCore
import Foundation

public class MuFathomLocalAIModule: Module {
  private let whisperRuntime = WhisperRuntime()
  private let summaryRuntime = SummaryRuntime()
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
        "reason": Self.supportReason
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
      let normalizedAudio = try audioNormalizer.normalizeForWhisper(inputUri: audioUri)
      let transcript = try whisperRuntime.transcribe(samples: normalizedAudio, modelPath: modelPath)
      let trimmedTranscript = transcript.trimmingCharacters(in: .whitespacesAndNewlines)

      guard !trimmedTranscript.isEmpty else {
        throw Exception(name: "E_LOCAL_TRANSCRIBE_EMPTY", description: "Local transcription returned no text.")
      }

      return trimmedTranscript
    }

    AsyncFunction("summarize") { (params: LocalSummarizeParams) -> String in
      let prompt = params.prompt.trimmingCharacters(in: .whitespacesAndNewlines)
      let modelId = params.modelId.trimmingCharacters(in: .whitespacesAndNewlines)
      let engine = params.engine.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

      if prompt.isEmpty {
        throw Exception(name: "E_LOCAL_SUMMARY_INPUT", description: "Missing local summary prompt.")
      }
      if modelId.isEmpty {
        throw Exception(name: "E_LOCAL_SUMMARY_MODEL", description: "Missing local summary model ID.")
      }
      if engine.isEmpty {
        throw Exception(name: "E_LOCAL_SUMMARY_ENGINE", description: "Missing local summary engine.")
      }

      let modelPath = try modelResolver.resolveSummaryModelPath(for: modelId, engine: engine)

      switch engine {
      case "llama.cpp":
        return try await llamaRuntime.generate(prompt: prompt, modelPath: modelPath, maxTokens: 1024)
      case "mediapipe-llm", "litert-lm":
        return try summaryRuntime.summarize(prompt: prompt, modelPath: modelPath)
      default:
        throw Exception(
          name: "E_LOCAL_SUMMARY_ENGINE_UNSUPPORTED",
          description: "Unsupported local summary engine: \(params.engine)."
        )
      }
    }
  }
}

private extension MuFathomLocalAIModule {
  static var supportReason: String {
    #if canImport(MediaPipeTasksGenAI)
    return "iOS local transcription and summary are available in this build (MediaPipe + llama.cpp)."
    #else
    return "iOS local transcription and llama.cpp summary are available in this build. MediaPipe summary engines require a dev build with the MediaPipe Tasks GenAI pod linked."
    #endif
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

  @Field
  var engine: String = ""
}
