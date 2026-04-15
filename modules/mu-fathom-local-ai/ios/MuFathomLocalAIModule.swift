import ExpoModulesCore
import Foundation

public class MuFathomLocalAIModule: Module {
  private let whisperRuntime = WhisperRuntime()
  private let modelResolver = LocalModelResolver()
  private let audioNormalizer = AudioNormalizer()

  public func definition() -> ModuleDefinition {
    Name("MuFathomLocalAI")

    AsyncFunction("getDeviceSupport") {
      return [
        "platform": "ios",
        "localProcessingAvailable": true,
        "supportsSummary": false,
        "supportsTranscription": true,
        "requiresCustomBuild": true,
        "reason": "iOS local transcription is available in this build."
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

    AsyncFunction("summarize") { (_: LocalSummarizeParams) in
      throw Exception(
        name: "E_LOCAL_SUMMARY_UNAVAILABLE",
        description: "Local summary is not supported on iOS in this phase."
      )
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
