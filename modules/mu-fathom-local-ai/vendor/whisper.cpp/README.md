# whisper.cpp vendor scaffold

This directory vendors the minimal upstream `whisper.cpp` source subset needed for
the iOS Expo module scaffold to compile under CocoaPods.

- Upstream repository: `https://github.com/ggml-org/whisper.cpp`
- Upstream commit: `95ea8f9bfb03a15db08a8989966fd1ae3361e20d`
- Included in this scaffold step:
  - `include/whisper.h`
  - `src/whisper.cpp`
  - `src/whisper-arch.h`
  - `ggml/include/*` public headers used by the vendored runtime boundary
  - `ggml/src/*` base ggml implementation files needed to link `whisper.cpp`
  - `ggml/src/ggml-cpu/*` generic CPU backend sources, plus the minimal `amx`
    header retained because upstream `ggml-cpu.cpp` includes it directly

Local adjustments in this vendored subset:

- `src/whisper.cpp` patches the fallback logging path to use `va_copy` safely
  before formatting into a second buffer.
- The podspec supplies scaffold version metadata via
  `WHISPER_VERSION`, `GGML_VERSION`, and `GGML_COMMIT` preprocessor definitions.
- The iOS scaffold builds ggml with `GGML_USE_CPU` and `GGML_CPU_GENERIC` so the
  vendor tree stays architecture-neutral while remaining linkable for later
  runtime work.

This intentionally stops short of the full runtime integration. The bridge returns
scaffold metadata for now, and later tasks can expand this vendor subset once the
native transcription entrypoints are wired for real inference.
