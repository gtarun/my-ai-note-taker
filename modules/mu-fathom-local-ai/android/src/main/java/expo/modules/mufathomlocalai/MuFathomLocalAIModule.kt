package expo.modules.mufathomlocalai

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MuFathomLocalAIModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MuFathomLocalAI")

    AsyncFunction("getDeviceSupport") {
      mapOf(
        "platform" to "android",
        "localProcessingAvailable" to true,
        "supportsSummary" to false,
        "supportsTranscription" to false,
        "requiresCustomBuild" to true,
        "reason" to "Android local runtime boundary is installed, but inference engines are not wired yet."
      )
    }

    AsyncFunction("transcribe") { params: LocalTranscribeParams ->
      val audioUri = params.audioUri.trim()
      val modelId = params.modelId.trim()

      if (audioUri.isEmpty()) {
        throw IllegalArgumentException("Missing local audio URI.")
      }
      if (modelId.isEmpty()) {
        throw IllegalArgumentException("Missing local transcription model ID.")
      }

      throw UnsupportedOperationException(
        "Android local runtime boundary is installed, but the transcription engine is not wired yet."
      )
    }

    AsyncFunction("summarize") { params: LocalSummarizeParams ->
      val prompt = params.prompt.trim()
      val modelId = params.modelId.trim()

      if (prompt.isEmpty()) {
        throw IllegalArgumentException("Missing local summary prompt.")
      }
      if (modelId.isEmpty()) {
        throw IllegalArgumentException("Missing local summary model ID.")
      }

      throw UnsupportedOperationException(
        "Android local runtime boundary is installed, but the summary engine is not wired yet."
      )
    }
  }
}

class LocalTranscribeParams : Record {
  @Field
  val audioUri: String = ""

  @Field
  val modelId: String = ""
}

class LocalSummarizeParams : Record {
  @Field
  val prompt: String = ""

  @Field
  val modelId: String = ""
}
