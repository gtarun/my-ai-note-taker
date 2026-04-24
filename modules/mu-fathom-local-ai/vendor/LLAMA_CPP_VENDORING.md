# Vendoring llama.cpp for iOS

The iOS module expects llama.cpp sources under
`modules/mu-fathom-local-ai/vendor/llama.cpp/`, mirroring the existing
`vendor/whisper.cpp/` layout. Sources are **not** committed because the tree is
large; run the steps below once per fresh checkout before `eas build` or
`pod install`.

## One-time setup

```bash
cd modules/mu-fathom-local-ai/vendor
git clone --depth 1 --branch b4404 https://github.com/ggerganov/llama.cpp.git
# Pin the commit if desired:
# cd llama.cpp && git checkout <sha> && cd ..
```

## What the podspec expects

`HEADER_SEARCH_PATHS` in `ios/MuFathomLocalAI.podspec` points at:

- `vendor/llama.cpp/include`
- `vendor/llama.cpp/src`
- `vendor/llama.cpp/common`

The `s.source_files = '**/*.{h,m,mm,c,cpp,swift}'` glob sits in `ios/` and
does **not** recurse into `vendor/`. To compile llama.cpp into the pod, add
explicit wrapper files under `ios/vendor-sources/` (same pattern as
`whisper-wrapper.cpp`, `ggml-wrapper.c`, etc.) that `#include` the llama.cpp
translation units you need, e.g.:

- `llama-wrapper.cpp` → `#include "../../vendor/llama.cpp/src/llama.cpp"`
- Additional files for `llama-vocab.cpp`, `llama-model.cpp`,
  `llama-context.cpp`, `llama-batch.cpp`, `llama-grammar.cpp`,
  `llama-sampling.cpp`, `unicode.cpp`, `unicode-data.cpp`, etc.

The ggml backend is already built via the existing `vendor/whisper.cpp/ggml`
wrappers, so llama.cpp should link against the same ggml rather than pulling
in a second copy.

## Metal backend

`GGML_USE_METAL=1` is set in the podspec preprocessor definitions, and the
`Metal`, `MetalKit`, `MetalPerformanceShaders`, and `Accelerate` frameworks
are linked. Ensure the Metal shaders file (`ggml-metal.metal`) is included in
the app bundle — Xcode auto-picks `.metal` files in source dirs, but you may
need to verify after `npx expo prebuild`.

## Fallback behavior

`LlamaBridge.mm` guards every llama.cpp call behind `#if __has_include(<llama.h>)`
so the module still compiles before the vendor sources are added — calls to
`summarize` will throw `E_LOCAL_SUMMARY_UNAVAILABLE` at runtime until
vendoring + wrapper files are in place.
