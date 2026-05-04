import ExpoModulesCore
import Foundation

public class MuFathomLocalAIModule: Module {
  // Combined analysis prompts emit JSON with summary + extraction values, which can
  // exceed 600 tokens on a multi-field layer. 1024 keeps headroom for that and for
  // the JSON repair pass (also bounded by this limit).
  private let maxSummaryTokens: Int32 = 1024
  private let whisperRuntime = WhisperRuntime()
  private let summaryRuntime = SummaryRuntime()
  private let llamaRuntime = LlamaRuntime()
  private let speechRecognizerRuntime = SpeechRecognizerRuntime()
  private let liveTranscriptionSession = LiveTranscriptionSession()
  private let modelResolver = LocalModelResolver()
  private let audioNormalizer = AudioNormalizer()

  public func definition() -> ModuleDefinition {
    Name("MuFathomLocalAI")

    // Streaming transcription emits this event roughly each time the recognizer
    // updates its hypothesis. JS subscribers display the running text live.
    Events("onLivePartialTranscript")

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

    // ─── Live (streaming) transcription ──────────────────────────────────
    // Drives Apple Speech off a parallel mic tap while expo-audio records to
    // disk. By the time the user stops, the transcript is essentially done.

    AsyncFunction("startLiveTranscription") { [weak self] (params: LiveTranscribeStartParams) in
      guard let self = self else { return }
      let locale = params.locale.trimmingCharacters(in: .whitespacesAndNewlines)
      let resolvedLocale = locale.isEmpty ? "en-US" : locale
      try await self.liveTranscriptionSession.start(locale: resolvedLocale) { [weak self] partial in
        // Bounce to the main actor so JS subscribers see updates on the JS
        // thread rather than whatever queue Speech is calling us back on.
        self?.sendEvent("onLivePartialTranscript", ["transcript": partial])
      }
    }

    AsyncFunction("stopLiveTranscription") { [weak self] () -> String in
      guard let self = self else { return "" }
      return try await self.liveTranscriptionSession.stop()
    }

    AsyncFunction("cancelLiveTranscription") { [weak self] in
      self?.liveTranscriptionSession.cancel()
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

      // Apple Speech path — system-provided, no model file on disk, ANE-accelerated.
      // Used by default for English meetings on iOS 17+; whisper.cpp stays as the
      // fallback for power users / non-English locales / older devices.
      if modelId == SpeechRecognizerRuntime.modelId {
        let locale = params.locale.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedLocale = locale.isEmpty ? "en-US" : locale
        return try await speechRecognizerRuntime.transcribe(
          audioUri: audioUri,
          locale: resolvedLocale
        )
      }

      let modelPath = try modelResolver.resolveWhisperBasePath(for: modelId)
      let normalizedAudio = try audioNormalizer.normalizeForWhisper(inputUri: audioUri)
      let language = params.language.trimmingCharacters(in: .whitespacesAndNewlines)
      let transcript = try whisperRuntime.transcribe(
        samples: normalizedAudio,
        modelPath: modelPath,
        language: language
      )
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
        return try await llamaRuntime.generate(prompt: prompt, modelPath: modelPath, maxTokens: maxSummaryTokens)
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

  /// BCP-47 locale tag for Apple Speech (e.g. `en-US`, `hi-IN`). Empty
  /// string defaults to en-US.
  @Field
  var locale: String = ""

  /// ISO 639-1 language code for whisper.cpp (e.g. `en`, `hi`, `pa`). Empty
  /// string is the sentinel for "let whisper auto-detect language".
  @Field
  var language: String = ""
}

struct LiveTranscribeStartParams: Record {
  /// BCP-47 locale tag for the streaming recognizer. Empty defaults to en-US.
  @Field
  var locale: String = ""
}

struct LocalSummarizeParams: Record {
  @Field
  var prompt: String = ""

  @Field
  var modelId: String = ""

  @Field
  var engine: String = ""
}
