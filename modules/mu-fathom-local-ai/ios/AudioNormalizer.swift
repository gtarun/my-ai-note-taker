import AVFoundation
import ExpoModulesCore
import Foundation

struct AudioNormalizer {
  private let outputSampleRate: Double = 16_000
  private let outputChannels: AVAudioChannelCount = 1
  private let readFrameCount: AVAudioFrameCount = 4096

  func normalizeForWhisper(inputUri: String) throws -> URL {
    let inputURL = try resolveInputURL(from: inputUri)
    let outputURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("whisper-\(UUID().uuidString)")
      .appendingPathExtension("wav")

    do {
      let inputFile = try AVAudioFile(forReading: inputURL)
      guard let outputFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16,
        sampleRate: outputSampleRate,
        channels: outputChannels,
        interleaved: true
      ) else {
        throw normalizationException("Unable to create a 16 kHz mono WAV output format.")
      }

      guard let converter = AVAudioConverter(from: inputFile.processingFormat, to: outputFormat) else {
        throw normalizationException("Unable to configure audio conversion for local transcription.")
      }

      let outputFile = try AVAudioFile(
        forWriting: outputURL,
        settings: outputFormat.settings,
        commonFormat: outputFormat.commonFormat,
        interleaved: outputFormat.isInterleaved
      )

      let inputToOutputRatio = outputFormat.sampleRate / inputFile.processingFormat.sampleRate

      while true {
        guard let inputBuffer = AVAudioPCMBuffer(
          pcmFormat: inputFile.processingFormat,
          frameCapacity: readFrameCount
        ) else {
          throw normalizationException("Unable to allocate an input audio buffer.")
        }

        try inputFile.read(into: inputBuffer, frameCount: readFrameCount)

        if inputBuffer.frameLength == 0 {
          break
        }

        var didProvideInput = false
        try drainConvertedAudio(
          converter: converter,
          outputFile: outputFile,
          outputFormat: outputFormat,
          estimatedInputFrameCount: inputBuffer.frameLength,
          inputToOutputRatio: inputToOutputRatio
        ) { _, outStatus in
          if didProvideInput {
            outStatus.pointee = .noDataNow
            return nil
          }

          didProvideInput = true
          outStatus.pointee = .haveData
          return inputBuffer
        }
      }

      try drainConvertedAudio(
        converter: converter,
        outputFile: outputFile,
        outputFormat: outputFormat,
        estimatedInputFrameCount: readFrameCount,
        inputToOutputRatio: inputToOutputRatio
      ) { _, outStatus in
        outStatus.pointee = .endOfStream
        return nil
      }

      return outputURL
    } catch let exception as Exception {
      try? FileManager.default.removeItem(at: outputURL)
      throw exception
    } catch {
      try? FileManager.default.removeItem(at: outputURL)
      throw normalizationException(error.localizedDescription)
    }
  }

  private func resolveInputURL(from inputUri: String) throws -> URL {
    let trimmedUri = inputUri.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedUri.isEmpty else {
      throw Exception(name: "E_LOCAL_TRANSCRIBE_INPUT", description: "Missing local audio URI.")
    }

    let inputURL: URL
    if trimmedUri.hasPrefix("file://"), let fileURL = URL(string: trimmedUri), fileURL.isFileURL {
      inputURL = fileURL
    } else {
      inputURL = URL(fileURLWithPath: (trimmedUri as NSString).expandingTildeInPath)
    }

    guard FileManager.default.fileExists(atPath: inputURL.path) else {
      throw Exception(
        name: "E_LOCAL_TRANSCRIBE_INPUT",
        description: "Local audio file was not found at the provided URI."
      )
    }

    return inputURL
  }

  private func normalizationException(_ description: String) -> Exception {
    Exception(name: "E_LOCAL_TRANSCRIBE_NORMALIZE_FAILED", description: description)
  }

  private func outputCapacity(
    estimatedInputFrameCount: AVAudioFrameCount,
    inputToOutputRatio: Double
  ) -> AVAudioFrameCount {
    max(
      AVAudioFrameCount(1024),
      AVAudioFrameCount(ceil(Double(estimatedInputFrameCount) * inputToOutputRatio)) + 1024
    )
  }

  private func drainConvertedAudio(
    converter: AVAudioConverter,
    outputFile: AVAudioFile,
    outputFormat: AVAudioFormat,
    estimatedInputFrameCount: AVAudioFrameCount,
    inputToOutputRatio: Double,
    inputBlock: @escaping AVAudioConverterInputBlock
  ) throws {
    while true {
      let frameCapacity = outputCapacity(
        estimatedInputFrameCount: estimatedInputFrameCount,
        inputToOutputRatio: inputToOutputRatio
      )
      guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: frameCapacity) else {
        throw normalizationException("Unable to allocate an output audio buffer.")
      }

      var conversionError: NSError?
      let status = converter.convert(to: outputBuffer, error: &conversionError, withInputFrom: inputBlock)

      if let conversionError {
        throw conversionError
      }

      if outputBuffer.frameLength > 0 {
        try outputFile.write(from: outputBuffer)
      }

      switch status {
      case .haveData:
        continue
      case .inputRanDry, .endOfStream:
        return
      case .error:
        throw normalizationException("Audio conversion failed while preparing whisper input.")
      @unknown default:
        throw normalizationException("Audio conversion returned an unknown status.")
      }
    }
  }
}
