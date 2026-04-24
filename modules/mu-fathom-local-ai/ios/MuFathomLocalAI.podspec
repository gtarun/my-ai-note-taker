Pod::Spec.new do |s|
  s.name           = 'MuFathomLocalAI'
  s.version        = '1.0.0'
  s.summary        = 'Local runtime boundary for on-device transcription and summary'
  s.description    = 'Expo local module used by mu-fathom to expose local AI runtime capabilities (whisper.cpp transcription + llama.cpp summary on iOS).'
  s.author         = ''
  s.homepage       = 'https://github.com/gtarun/mu-fathom'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'MediaPipeTasksGenAI'
  s.dependency 'MediaPipeTasksGenAIC'
  s.libraries = 'c++'
  s.frameworks = ['Foundation', 'Metal', 'MetalKit', 'MetalPerformanceShaders', 'Accelerate']

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'CLANG_CXX_LIBRARY' => 'libc++',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) WHISPER_VERSION=\"vendor-scaffold\" GGML_VERSION=\"vendor-scaffold\" GGML_COMMIT=\"95ea8f9bfb03a15db08a8989966fd1ae3361e20d\" GGML_USE_CPU GGML_CPU_GENERIC GGML_USE_METAL=1',
    'HEADER_SEARCH_PATHS' => '$(inherited) "$(PODS_TARGET_SRCROOT)/../vendor/whisper.cpp/include" "$(PODS_TARGET_SRCROOT)/../vendor/whisper.cpp/ggml/include" "$(PODS_TARGET_SRCROOT)/../vendor/whisper.cpp/ggml/src" "$(PODS_TARGET_SRCROOT)/../vendor/whisper.cpp/ggml/src/ggml-cpu" "$(PODS_TARGET_SRCROOT)/../vendor/llama.cpp/include" "$(PODS_TARGET_SRCROOT)/../vendor/llama.cpp/src" "$(PODS_TARGET_SRCROOT)/../vendor/llama.cpp/common"',
  }
  s.compiler_flags = '-Wno-shorten-64-to-32'

  s.source_files = '**/*.{h,m,mm,c,cpp,swift}'
end
