import AVFoundation
import ExpoModulesCore
import Foundation

struct AudioNormalizer {
  private let outputSampleRate: Double = 16_000
  private let outputChannels: AVAudioChannelCount = 1
  private let readFrameCount: AVAudioFrameCount = 4096

  func normalizeForWhisper(inputUri: String) throws -> Data {
    let inputURL = try resolveInputURL(from: inputUri)

    do {
      return try normalizeWithAudioFile(inputURL)
    } catch {
      return try normalizeWithAssetReader(inputURL)
    }
  }

  private func normalizeWithAudioFile(_ inputURL: URL) throws -> Data {
    let inputFile = try AVAudioFile(forReading: inputURL)
    let outputFormat = try makeOutputFormat()

    guard let converter = AVAudioConverter(from: inputFile.processingFormat, to: outputFormat) else {
      throw normalizationException("Unable to configure audio conversion for local transcription.")
    }

    let inputToOutputRatio = outputFormat.sampleRate / inputFile.processingFormat.sampleRate
    var sampleData = Data()

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
        outputFormat: outputFormat,
        estimatedInputFrameCount: inputBuffer.frameLength,
        inputToOutputRatio: inputToOutputRatio,
        onOutput: { outputBuffer in
          try appendSamples(from: outputBuffer, to: &sampleData)
        },
        inputBlock: { _, outStatus in
          if didProvideInput {
            outStatus.pointee = .noDataNow
            return nil
          }

          didProvideInput = true
          outStatus.pointee = .haveData
          return inputBuffer
        }
      )
    }

    try drainConvertedAudio(
      converter: converter,
      outputFormat: outputFormat,
      estimatedInputFrameCount: readFrameCount,
      inputToOutputRatio: inputToOutputRatio,
      onOutput: { outputBuffer in
        try appendSamples(from: outputBuffer, to: &sampleData)
      },
      inputBlock: { _, outStatus in
        outStatus.pointee = .endOfStream
        return nil
      }
    )

    guard !sampleData.isEmpty else {
      throw normalizationException("Local transcription could not find any audio samples in this recording.")
    }

    return sampleData
  }

  private func normalizeWithAssetReader(_ inputURL: URL) throws -> Data {
    do {
      let asset = AVURLAsset(url: inputURL)
      guard let audioTrack = asset.tracks(withMediaType: .audio).first else {
        throw normalizationException("This recording does not contain a readable audio track.")
      }

      let reader = try AVAssetReader(asset: asset)
      let output = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: assetReaderOutputSettings())
      output.alwaysCopiesSampleData = false

      guard reader.canAdd(output) else {
        throw normalizationException("iOS could not prepare this recording for audio sample reading.")
      }

      reader.add(output)

      guard reader.startReading() else {
        throw reader.error ?? normalizationException("iOS could not start reading this recording.")
      }

      var sampleData = Data()
      while let sampleBuffer = output.copyNextSampleBuffer() {
        try appendSamples(from: sampleBuffer, to: &sampleData)
      }

      switch reader.status {
      case .completed:
        break
      case .failed:
        throw reader.error ?? normalizationException("iOS failed while reading this recording.")
      case .cancelled:
        throw normalizationException("iOS cancelled audio sample reading before transcription could start.")
      default:
        break
      }

      guard !sampleData.isEmpty else {
        throw normalizationException("Local transcription could not find any audio samples in this recording.")
      }

      return sampleData
    } catch let exception as Exception {
      throw exception
    } catch {
      throw normalizationException(for: error)
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

  private func makeOutputFormat() throws -> AVAudioFormat {
    guard let outputFormat = AVAudioFormat(
      commonFormat: .pcmFormatFloat32,
      sampleRate: outputSampleRate,
      channels: outputChannels,
      interleaved: false
    ) else {
      throw normalizationException("Unable to create a 16 kHz mono audio format.")
    }

    return outputFormat
  }

  private func assetReaderOutputSettings() -> [String: Any] {
    [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVSampleRateKey: outputSampleRate,
      AVNumberOfChannelsKey: Int(outputChannels),
      AVLinearPCMBitDepthKey: 32,
      AVLinearPCMIsFloatKey: true,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsNonInterleaved: false,
    ]
  }

  private func normalizationException(_ description: String) -> Exception {
    Exception(name: "E_LOCAL_TRANSCRIBE_NORMALIZE_FAILED", description: description)
  }

  private func normalizationException(for error: Error) -> Exception {
    let nsError = error as NSError
    let details = nsError.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)

    if details.contains("Foundation._GenericObjCError") || nsError.domain.contains("Foundation") {
      return normalizationException(
        "iOS could not decode or convert this recording for local transcription. Try recording again, or use a standard M4A, WAV, or MP3 file."
      )
    }

    if details.isEmpty {
      return normalizationException("iOS could not prepare this audio for local transcription.")
    }

    return normalizationException("iOS could not prepare this audio for local transcription: \(details)")
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
    outputFormat: AVAudioFormat,
    estimatedInputFrameCount: AVAudioFrameCount,
    inputToOutputRatio: Double,
    onOutput: (AVAudioPCMBuffer) throws -> Void,
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
        try onOutput(outputBuffer)
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

  private func appendSamples(from outputBuffer: AVAudioPCMBuffer, to sampleData: inout Data) throws {
    guard outputBuffer.format.commonFormat == .pcmFormatFloat32,
          outputBuffer.format.channelCount == outputChannels,
          let channelData = outputBuffer.floatChannelData?[0] else {
      throw normalizationException("Audio conversion produced an unexpected sample format.")
    }

    let frameLength = Int(outputBuffer.frameLength)
    if frameLength == 0 {
      return
    }

    sampleData.append(Data(bytes: channelData, count: frameLength * MemoryLayout<Float>.stride))
  }

  private func appendSamples(from sampleBuffer: CMSampleBuffer, to sampleData: inout Data) throws {
    guard CMSampleBufferDataIsReady(sampleBuffer) else {
      return
    }

    guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else {
      throw normalizationException("iOS produced an audio sample buffer without PCM data.")
    }

    let byteCount = CMBlockBufferGetDataLength(blockBuffer)
    if byteCount == 0 {
      return
    }

    var bytes = [UInt8](repeating: 0, count: byteCount)
    let status = bytes.withUnsafeMutableBytes { destination -> OSStatus in
      guard let baseAddress = destination.baseAddress else {
        return -1
      }

      return CMBlockBufferCopyDataBytes(
        blockBuffer,
        atOffset: 0,
        dataLength: byteCount,
        destination: baseAddress
      )
    }

    guard status == noErr else {
      throw normalizationException("iOS could not copy decoded audio samples for transcription.")
    }

    sampleData.append(contentsOf: bytes)
  }
}
