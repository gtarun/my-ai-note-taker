import ExpoModulesCore
import Foundation

public class MuFathomLocalAIModule: Module {
  private let whisperRuntime = WhisperRuntime()
  private let summaryRuntime = SummaryRuntime()
  private let modelResolver = LocalModelResolver()
  private let audioNormalizer = AudioNormalizer()

  public func definition() -> ModuleDefinition {
    Name("MuFathomLocalAI")

    AsyncFunction("getDeviceSupport") {
      return [
        "platform": "ios",
        "localProcessingAvailable": true,
        "supportsSummary": Self.supportsSummary,
        "supportsTranscription": true,
        "requiresCustomBuild": true,
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

      if prompt.isEmpty {
        throw Exception(name: "E_LOCAL_SUMMARY_INPUT", description: "Missing local summary prompt.")
      }
      if modelId.isEmpty {
        throw Exception(name: "E_LOCAL_SUMMARY_MODEL", description: "Missing local summary model ID.")
      }

      guard Self.supportsSummary else {
        throw Exception(
          name: "E_LOCAL_SUMMARY_UNAVAILABLE",
          description: "This build does not include the iOS local summary runtime yet."
        )
      }

      let modelPath = try modelResolver.resolveSummaryModelPath(for: modelId)
      return try summaryRuntime.summarize(prompt: prompt, modelPath: modelPath)
    }
  }
}

private extension MuFathomLocalAIModule {
  static var supportsSummary: Bool {
    #if canImport(MediaPipeTasksGenAI)
    return true
    #else
    return false
    #endif
  }

  static var supportReason: String {
    if supportsSummary {
      return "iOS local transcription and summary are available in this build."
    }

    return "iOS supports local transcription in this build. Local summary and structured analysis are not supported yet."
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
