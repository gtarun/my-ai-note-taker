import AVFoundation
import ExpoModulesCore
import Foundation
import Speech

/// Live, streaming transcription via Apple's SFSpeechRecognizer.
///
/// **Long-form support via segment chaining.** SFSpeechAudioBufferRecognitionRequest
/// auto-finalizes on detected utterance boundaries (sentence ends, long pauses).
/// For a 30-minute meeting that's many segments — if we naively resolved on the
/// first `isFinal`, we'd lose 99% of the recording. Instead, every time the
/// recognizer reports a final segment we (a) append it to a completed-segments
/// buffer and (b) start a fresh recognition task on the same audio engine, so
/// new buffers feed into the new task. The user-visible transcript is the
/// concatenation of all completed segments + the current in-flight hypothesis.
///
/// **Privacy.** All requests run with `requiresOnDeviceRecognition = true`. If
/// a locale only supports server-side recognition, start() throws and the JS
/// caller falls back to post-stop transcription.
///
/// **Concurrency.** Callers serialize start/stop/cancel; one session at a time.
final class LiveTranscriptionSession {
  private let audioEngine = AVAudioEngine()
  private var recognizer: SFSpeechRecognizer?
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?

  private var partialHandler: ((String) -> Void)?
  private var completedSegments: [String] = []
  private var currentSegmentText: String = ""

  private var finalContinuation: CheckedContinuation<String, Error>?
  private var isRunning = false
  /// Set in stop() so the result handler knows the next isFinal is the *real*
  /// end (and shouldn't try to chain another recognition task).
  private var isStopping = false

  func start(locale: String, onPartial: @escaping (String) -> Void) async throws {
    if isRunning {
      throw Exception(
        name: "E_LIVE_TRANSCRIBE_ALREADY_RUNNING",
        description: "A live transcription session is already running. Stop or cancel it before starting a new one."
      )
    }

    try await ensureAuthorization()

    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)) else {
      throw Exception(
        name: "E_LIVE_TRANSCRIBE_LOCALE",
        description: "Apple Speech does not support the locale '\(locale)' on this device."
      )
    }

    guard recognizer.isAvailable else {
      throw Exception(
        name: "E_LIVE_TRANSCRIBE_UNAVAILABLE",
        description: "Apple Speech recognition is temporarily unavailable on this device. Try again in a moment."
      )
    }

    if !recognizer.supportsOnDeviceRecognition {
      throw Exception(
        name: "E_LIVE_TRANSCRIBE_NOT_OFFLINE",
        description:
          "On-device live transcription is not supported for the locale '\(locale)' on this device. Audio will be transcribed after recording stops instead."
      )
    }

    self.recognizer = recognizer
    self.partialHandler = onPartial
    self.completedSegments = []
    self.currentSegmentText = ""
    self.isStopping = false

    // Tap the input node BEFORE starting any recognition task. The tap reads
    // self.recognitionRequest each callback rather than capturing a particular
    // request — that way segment chaining can swap requests without losing
    // any audio (the tap fires every ~100ms; the swap is atomic on the same
    // queue).
    let inputNode = audioEngine.inputNode
    let recordingFormat = inputNode.outputFormat(forBus: 0)
    inputNode.removeTap(onBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 4096, format: recordingFormat) { [weak self] buffer, _ in
      self?.recognitionRequest?.append(buffer)
    }

    audioEngine.prepare()
    do {
      try audioEngine.start()
    } catch {
      inputNode.removeTap(onBus: 0)
      self.recognizer = nil
      throw Exception(
        name: "E_LIVE_TRANSCRIBE_ENGINE_START",
        description:
          "Could not start live audio engine (\(error.localizedDescription)). Try recording again, or use post-recording transcription for this meeting."
      )
    }

    do {
      try startRecognitionTask()
    } catch {
      audioEngine.stop()
      inputNode.removeTap(onBus: 0)
      self.recognizer = nil
      throw error
    }

    self.isRunning = true
  }

  /// End audio input and wait for the recognizer to flush its final segment.
  /// Returns the concatenation of all completed segments + the trailing one.
  func stop() async throws -> String {
    guard isRunning else {
      return combinedText()
    }

    isStopping = true
    audioEngine.stop()
    audioEngine.inputNode.removeTap(onBus: 0)
    recognitionRequest?.endAudio()
    isRunning = false

    return try await withCheckedThrowingContinuation { continuation in
      // Race protection: if the recognizer already finalized between
      // endAudio() above and this continuation being installed, finalize()
      // already cleared recognitionTask. Resume immediately with whatever
      // we collected.
      if recognitionTask == nil {
        continuation.resume(returning: combinedText())
        return
      }
      finalContinuation = continuation
    }
  }

  /// Throw away anything in flight. Used when the user discards a recording.
  func cancel() {
    audioEngine.stop()
    audioEngine.inputNode.removeTap(onBus: 0)
    recognitionTask?.cancel()
    recognitionRequest?.endAudio()
    isRunning = false
    isStopping = false
    completedSegments = []
    currentSegmentText = ""
    recognitionRequest = nil
    recognitionTask = nil
    recognizer = nil
    partialHandler = nil
    finalContinuation?.resume(throwing: Exception(
      name: "E_LIVE_TRANSCRIBE_CANCELLED",
      description: "Live transcription was cancelled."
    ))
    finalContinuation = nil
  }

  // MARK: - Private

  private func startRecognitionTask() throws {
    guard let recognizer = self.recognizer else {
      throw Exception(
        name: "E_LIVE_TRANSCRIBE_NO_RECOGNIZER",
        description: "Speech recognizer is no longer available."
      )
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.requiresOnDeviceRecognition = true
    request.shouldReportPartialResults = true
    if #available(iOS 16.0, *) {
      request.addsPunctuation = true
    }

    // Cancel the previous task if any (chaining case) — we keep its accepted
    // text in completedSegments already.
    recognitionTask?.cancel()

    self.recognitionRequest = request
    self.recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self = self else { return }
      self.handleRecognitionResult(result, error: error)
    }
  }

  private func handleRecognitionResult(_ result: SFSpeechRecognitionResult?, error: Error?) {
    if let error = error {
      // SFSpeech reports task cancellation as an error too. If we cancelled
      // because we're chaining, ignore — the next task will pick up. Only
      // surface mid-stream errors when we're not stopping or chaining.
      let nsError = error as NSError
      let isCancellation = nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 209
      if isCancellation && !isStopping {
        return
      }
      finalize(.failure(error))
      return
    }

    guard let result = result else { return }

    let text = result.bestTranscription.formattedString
    currentSegmentText = text
    partialHandler?(combinedText())

    guard result.isFinal else { return }

    let trimmedSegment = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedSegment.isEmpty {
      completedSegments.append(trimmedSegment)
    }
    currentSegmentText = ""

    if isStopping {
      // We were waiting for this — the user-initiated stop has now produced
      // its final segment. Resolve the awaiting stop() with everything.
      finalize(.success(combinedText()))
      return
    }

    // Mid-recording finalization. Roll over to a fresh recognition task so
    // we keep capturing audio for the rest of the meeting. If creating the
    // new task throws, finalize what we have rather than silently going dark.
    do {
      try startRecognitionTask()
    } catch {
      finalize(.failure(error))
    }
  }

  /// Concatenate completed segments + the current in-flight hypothesis. Used
  /// for both partial event payloads and the final transcript.
  private func combinedText() -> String {
    var pieces = completedSegments
    let trimmedCurrent = currentSegmentText.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedCurrent.isEmpty {
      pieces.append(trimmedCurrent)
    }
    return pieces.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private func finalize(_ result: Result<String, Error>) {
    // Always run on the same queue as the recognizer's resultHandler so we
    // don't double-resume.
    let continuation = finalContinuation
    finalContinuation = nil
    recognitionTask = nil
    recognitionRequest = nil
    recognizer = nil
    partialHandler = nil

    guard let continuation = continuation else { return }

    switch result {
    case .success(let text):
      continuation.resume(returning: text)
    case .failure(let error):
      continuation.resume(throwing: error)
    }
  }

  private func ensureAuthorization() async throws {
    let status = SFSpeechRecognizer.authorizationStatus()

    switch status {
    case .authorized:
      return
    case .denied:
      throw Exception(
        name: "E_LIVE_TRANSCRIBE_PERMISSION",
        description:
          "Speech recognition permission was denied. Enable it in iOS Settings → Privacy & Security → Speech Recognition → Mu Fathom."
      )
    case .restricted:
      throw Exception(
        name: "E_LIVE_TRANSCRIBE_PERMISSION",
        description:
          "Speech recognition is restricted on this device by parental controls or device management policy."
      )
    case .notDetermined:
      let granted = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
        SFSpeechRecognizer.requestAuthorization { status in
          continuation.resume(returning: status == .authorized)
        }
      }
      if !granted {
        throw Exception(
          name: "E_LIVE_TRANSCRIBE_PERMISSION",
          description: "Speech recognition permission was not granted."
        )
      }
    @unknown default:
      throw Exception(
        name: "E_LIVE_TRANSCRIBE_PERMISSION",
        description: "Unknown speech recognition permission state."
      )
    }
  }
}
