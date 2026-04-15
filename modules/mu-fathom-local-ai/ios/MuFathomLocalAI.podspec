Pod::Spec.new do |s|
  whisper_vendor_root = '../vendor/whisper.cpp'

  s.name           = 'MuFathomLocalAI'
  s.version        = '1.0.0'
  s.summary        = 'Local runtime boundary for on-device transcription and summary'
  s.description    = 'Android-first Expo local module used by mu-fathom to expose local AI runtime capabilities.'
  s.author         = ''
  s.homepage       = 'https://github.com/gtarun/mu-fathom'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.libraries = 'c++'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'CLANG_CXX_LIBRARY' => 'libc++',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) WHISPER_VERSION=\"vendor-scaffold\" GGML_VERSION=\"vendor-scaffold\" GGML_COMMIT=\"95ea8f9bfb03a15db08a8989966fd1ae3361e20d\" GGML_USE_CPU GGML_CPU_GENERIC',
    'HEADER_SEARCH_PATHS' => '$(inherited) "$(PODS_TARGET_SRCROOT)/../vendor/whisper.cpp/include" "$(PODS_TARGET_SRCROOT)/../vendor/whisper.cpp/ggml/include" "$(PODS_TARGET_SRCROOT)/../vendor/whisper.cpp/ggml/src" "$(PODS_TARGET_SRCROOT)/../vendor/whisper.cpp/ggml/src/ggml-cpu"',
  }
  s.compiler_flags = '-Wno-shorten-64-to-32'

  s.source_files = '**/*.{h,m,mm,c,cpp,swift}'
end
