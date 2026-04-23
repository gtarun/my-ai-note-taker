#import "WhisperBridge.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <limits>
#include <string>
#include <thread>
#include <vector>

#include "whisper.h"

static NSString *const WhisperBridgeErrorDomain = @"MuFathomLocalAIWhisperBridge";

typedef NS_ENUM(NSInteger, WhisperBridgeErrorCode) {
  WhisperBridgeErrorCodeInvalidInput = 1,
  WhisperBridgeErrorCodeAudioReadFailed = 2,
  WhisperBridgeErrorCodeModelLoadFailed = 3,
  WhisperBridgeErrorCodeTranscriptionFailed = 4,
};

namespace {

uint16_t ReadUInt16LE(const uint8_t * bytes) {
  return static_cast<uint16_t>(bytes[0] | (bytes[1] << 8));
}

uint32_t ReadUInt32LE(const uint8_t * bytes) {
  return static_cast<uint32_t>(bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24));
}

NSError * MakeBridgeError(WhisperBridgeErrorCode code, NSString * description) {
  return [NSError errorWithDomain:WhisperBridgeErrorDomain
                             code:code
                         userInfo:@{NSLocalizedDescriptionKey: description}];
}

bool LoadNormalizedPcmSamples(NSString * audioPath, std::vector<float> & samples, NSError ** error) {
  NSError * readError = nil;
  NSData * audioData = [NSData dataWithContentsOfFile:audioPath options:NSDataReadingMappedIfSafe error:&readError];
  if (audioData == nil) {
    if (error != nullptr) {
      *error = readError ?: MakeBridgeError(
        WhisperBridgeErrorCodeAudioReadFailed,
        @"Failed to read the normalized whisper audio file."
      );
    }
    return false;
  }

  if (audioData.length < 44) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeAudioReadFailed,
        @"Normalized audio file is too short to be a valid WAV file."
      );
    }
    return false;
  }

  const uint8_t * bytes = static_cast<const uint8_t *>(audioData.bytes);
  if (std::memcmp(bytes, "RIFF", 4) != 0 || std::memcmp(bytes + 8, "WAVE", 4) != 0) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeAudioReadFailed,
        @"Normalized audio must be a RIFF/WAVE file."
      );
    }
    return false;
  }

  uint16_t audioFormat = 0;
  uint16_t channelCount = 0;
  uint32_t sampleRate = 0;
  uint16_t bitsPerSample = 0;
  const uint8_t * sampleBytes = nullptr;
  uint32_t sampleByteCount = 0;

  size_t offset = 12;
  while (offset + 8 <= audioData.length) {
    const uint8_t * chunkHeader = bytes + offset;
    const uint32_t chunkSize = ReadUInt32LE(chunkHeader + 4);
    const size_t chunkDataOffset = offset + 8;
    const size_t paddedChunkSize = static_cast<size_t>(chunkSize) + (chunkSize % 2);

    if (chunkDataOffset + chunkSize > audioData.length) {
      if (error != nullptr) {
        *error = MakeBridgeError(
          WhisperBridgeErrorCodeAudioReadFailed,
          @"Normalized WAV file has a truncated chunk."
        );
      }
      return false;
    }

    if (std::memcmp(chunkHeader, "fmt ", 4) == 0) {
      if (chunkSize < 16) {
        if (error != nullptr) {
          *error = MakeBridgeError(
            WhisperBridgeErrorCodeAudioReadFailed,
            @"Normalized WAV format chunk is incomplete."
          );
        }
        return false;
      }

      const uint8_t * fmtBytes = bytes + chunkDataOffset;
      audioFormat = ReadUInt16LE(fmtBytes);
      channelCount = ReadUInt16LE(fmtBytes + 2);
      sampleRate = ReadUInt32LE(fmtBytes + 4);
      bitsPerSample = ReadUInt16LE(fmtBytes + 14);
    } else if (std::memcmp(chunkHeader, "data", 4) == 0) {
      sampleBytes = bytes + chunkDataOffset;
      sampleByteCount = chunkSize;
    }

    offset = chunkDataOffset + paddedChunkSize;
  }

  if (sampleBytes == nullptr || sampleByteCount == 0) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeAudioReadFailed,
        @"Normalized WAV file does not contain any PCM samples."
      );
    }
    return false;
  }

  if (audioFormat != 1 || channelCount != 1 || sampleRate != 16000 || bitsPerSample != 16) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeAudioReadFailed,
        @"Normalized WAV file must be 16-bit PCM, mono, and sampled at 16 kHz."
      );
    }
    return false;
  }

  if (sampleByteCount % 2 != 0) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeAudioReadFailed,
        @"Normalized PCM sample data is malformed."
      );
    }
    return false;
  }

  const size_t sampleCount = sampleByteCount / 2;
  samples.resize(sampleCount);

  for (size_t index = 0; index < sampleCount; ++index) {
    const size_t byteOffset = index * 2;
    const int16_t sample = static_cast<int16_t>(sampleBytes[byteOffset] | (sampleBytes[byteOffset + 1] << 8));
    samples[index] = static_cast<float>(sample) / 32768.0f;
  }

  return true;
}

bool ValidateNormalizedFloatSamples(NSData * sampleData, NSError ** error) {
  if (sampleData.length == 0) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeInvalidInput,
        @"Normalized audio did not contain any samples."
      );
    }
    return false;
  }

  if (sampleData.length % sizeof(float) != 0) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeInvalidInput,
        @"Normalized audio sample data is malformed."
      );
    }
    return false;
  }

  const NSUInteger sampleCount = sampleData.length / sizeof(float);
  if (sampleCount > static_cast<NSUInteger>(std::numeric_limits<int>::max())) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeInvalidInput,
        @"Normalized audio is too long for local transcription."
      );
    }
    return false;
  }

  const float * samples = static_cast<const float *>(sampleData.bytes);
  for (NSUInteger index = 0; index < sampleCount; ++index) {
    if (!std::isfinite(samples[index])) {
      if (error != nullptr) {
        *error = MakeBridgeError(
          WhisperBridgeErrorCodeInvalidInput,
          @"Normalized audio contains invalid sample values."
        );
      }
      return false;
    }
  }

  return true;
}

NSString * CollectTranscriptText(struct whisper_context * context) {
  NSMutableString * transcript = [NSMutableString string];
  const int segmentCount = whisper_full_n_segments(context);

  for (int index = 0; index < segmentCount; ++index) {
    const char * segmentText = whisper_full_get_segment_text(context, index);
    if (segmentText == nullptr) {
      continue;
    }

    NSString * segment = [NSString stringWithUTF8String:segmentText];
    if (segment.length > 0) {
      [transcript appendString:segment];
    }
  }

  return [transcript stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
}

NSString * TranscribeNormalizedSamples(
  const float * samples,
  int sampleCount,
  NSString * modelPath,
  NSError ** error
) {
  NSFileManager * fileManager = [NSFileManager defaultManager];
  if (modelPath.length == 0 || ![fileManager fileExistsAtPath:modelPath]) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeInvalidInput,
        @"Whisper model file is missing before transcription starts."
      );
    }
    return nil;
  }

  whisper_context_params contextParams = whisper_context_default_params();
  contextParams.use_gpu = false;
  contextParams.flash_attn = false;

  struct whisper_context * context = whisper_init_from_file_with_params(modelPath.UTF8String, contextParams);
  if (context == nullptr) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeModelLoadFailed,
        @"Failed to load the whisper model file on iOS."
      );
    }
    return nil;
  }

  struct WhisperContextGuard {
    struct whisper_context * context;

    ~WhisperContextGuard() {
      if (context != nullptr) {
        whisper_free(context);
      }
    }
  } contextGuard = {context};

  whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
  params.n_threads = static_cast<int>(std::max(1u, std::min(4u, std::thread::hardware_concurrency())));
  params.translate = false;
  params.no_context = true;
  params.no_timestamps = true;
  params.single_segment = false;
  params.print_special = false;
  params.print_progress = false;
  params.print_realtime = false;
  params.print_timestamps = false;
  params.token_timestamps = false;
  params.language = "auto";
  params.detect_language = false;

  const double durationSeconds = static_cast<double>(sampleCount) / 16000.0;
  double sumSquares = 0.0;
  float peak = 0.0f;
  for (int index = 0; index < sampleCount; ++index) {
    const float sample = samples[index];
    sumSquares += static_cast<double>(sample) * static_cast<double>(sample);
    peak = std::max(peak, std::fabs(sample));
  }
  const double rms = sampleCount > 0 ? std::sqrt(sumSquares / sampleCount) : 0.0;
  NSLog(
    @"%s: normalized audio: %.2f seconds, samples = %d, rms = %.6f, peak = %.6f",
    __func__,
    durationSeconds,
    sampleCount,
    rms,
    peak
  );

  if (whisper_full(context, params, samples, sampleCount) != 0) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeTranscriptionFailed,
        @"whisper.cpp failed while transcribing the normalized audio."
      );
    }
    return nil;
  }

  NSString * transcript = CollectTranscriptText(context);
  if (transcript.length == 0) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeTranscriptionFailed,
        rms < 0.0001
          ? @"whisper.cpp completed but found no speech. The saved recording appears to be silent; check the simulator or device microphone input and try again."
          : @"whisper.cpp completed but produced no transcript text for this recording."
      );
    }
    return nil;
  }

  return transcript;
}

}  // namespace

@implementation WhisperBridge

+ (NSString *)sdkVersion {
  return [NSString stringWithUTF8String:whisper_version()];
}

+ (nullable NSString *)transcribeSamples:(NSData *)sampleData
                               modelPath:(NSString *)modelPath
                                    error:(NSError * _Nullable * _Nullable)error {
  if (!ValidateNormalizedFloatSamples(sampleData, error)) {
    return nil;
  }

  const float * samples = static_cast<const float *>(sampleData.bytes);
  const int sampleCount = static_cast<int>(sampleData.length / sizeof(float));
  return TranscribeNormalizedSamples(samples, sampleCount, modelPath, error);
}

+ (nullable NSString *)transcribeFileAtPath:(NSString *)audioPath
                                  modelPath:(NSString *)modelPath
                                      error:(NSError * _Nullable * _Nullable)error {
  NSFileManager * fileManager = [NSFileManager defaultManager];
  if (audioPath.length == 0 || ![fileManager fileExistsAtPath:audioPath]) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeInvalidInput,
        @"Normalized audio file is missing before whisper transcription."
      );
    }
    return nil;
  }

  if (modelPath.length == 0 || ![fileManager fileExistsAtPath:modelPath]) {
    if (error != nullptr) {
      *error = MakeBridgeError(
        WhisperBridgeErrorCodeInvalidInput,
        @"Whisper model file is missing before transcription starts."
      );
    }
    return nil;
  }

  std::vector<float> samples;
  if (!LoadNormalizedPcmSamples(audioPath, samples, error)) {
    return nil;
  }

  return TranscribeNormalizedSamples(samples.data(), static_cast<int>(samples.size()), modelPath, error);
}

@end
