#import "LlamaBridge.h"

#import <string>
#import <vector>

// llama.cpp headers. These resolve via HEADER_SEARCH_PATHS in the podspec
// once `modules/mu-fathom-local-ai/vendor/llama.cpp/` is populated.
#if __has_include(<llama.h>)
#  include <llama.h>
#  define MU_LLAMA_AVAILABLE 1
#else
#  define MU_LLAMA_AVAILABLE 0
#endif

static NSErrorDomain const kLlamaBridgeErrorDomain = @"MuFathomLocalAI.LlamaBridge";

typedef NS_ENUM(NSInteger, LlamaBridgeErrorCode) {
  LlamaBridgeErrorCodeUnavailable = -10,
  LlamaBridgeErrorCodeModelLoad = -11,
  LlamaBridgeErrorCodeContext = -12,
  LlamaBridgeErrorCodeTokenize = -13,
  LlamaBridgeErrorCodeDecode = -14,
};

@implementation LlamaBridge {
#if MU_LLAMA_AVAILABLE
  struct llama_model *_model;
  struct llama_context *_ctx;
  const struct llama_vocab *_vocab;
  std::string _loadedPath;
#endif
}

+ (void)initialize {
  if (self == [LlamaBridge class]) {
#if MU_LLAMA_AVAILABLE
    static dispatch_once_t once;
    dispatch_once(&once, ^{
      llama_backend_init();
    });
#endif
  }
}

+ (NSString *)sdkVersion {
#if MU_LLAMA_AVAILABLE
  return @"llama.cpp-vendor";
#else
  return @"llama.cpp-unavailable";
#endif
}

- (instancetype)init {
  if ((self = [super init])) {
#if MU_LLAMA_AVAILABLE
    _model = nullptr;
    _ctx = nullptr;
    _vocab = nullptr;
#endif
  }
  return self;
}

- (void)dealloc {
  [self unload];
}

- (void)unload {
#if MU_LLAMA_AVAILABLE
  if (_ctx) {
    llama_free(_ctx);
    _ctx = nullptr;
  }
  if (_model) {
    llama_model_free(_model);
    _model = nullptr;
  }
  _vocab = nullptr;
  _loadedPath.clear();
#endif
}

#if MU_LLAMA_AVAILABLE
- (BOOL)ensureModelLoaded:(NSString *)modelPath error:(NSError **)error {
  const std::string desired = std::string(modelPath.UTF8String ?: "");

  if (_model && _ctx && _loadedPath == desired) {
    return YES;
  }

  [self unload];

  llama_model_params modelParams = llama_model_default_params();
  // Metal GPU offload: -1 means "all layers on GPU" when Metal backend is built.
  modelParams.n_gpu_layers = 999;

  _model = llama_model_load_from_file(desired.c_str(), modelParams);
  if (!_model) {
    if (error) {
      *error = [NSError errorWithDomain:kLlamaBridgeErrorDomain
                                   code:LlamaBridgeErrorCodeModelLoad
                               userInfo:@{NSLocalizedDescriptionKey: @"Failed to load GGUF model."}];
    }
    return NO;
  }

  _vocab = llama_model_get_vocab(_model);

  llama_context_params ctxParams = llama_context_default_params();
  ctxParams.n_ctx = 4096;
  ctxParams.n_batch = 512;
  ctxParams.n_threads = 4;
  ctxParams.n_threads_batch = 4;

  _ctx = llama_init_from_model(_model, ctxParams);
  if (!_ctx) {
    llama_model_free(_model);
    _model = nullptr;
    _vocab = nullptr;
    if (error) {
      *error = [NSError errorWithDomain:kLlamaBridgeErrorDomain
                                   code:LlamaBridgeErrorCodeContext
                               userInfo:@{NSLocalizedDescriptionKey: @"Failed to create llama context."}];
    }
    return NO;
  }

  _loadedPath = desired;
  return YES;
}
#endif

- (nullable NSString *)generateFromPrompt:(NSString *)prompt
                                modelPath:(NSString *)modelPath
                                maxTokens:(int)maxTokens
                                    error:(NSError **)error {
#if !MU_LLAMA_AVAILABLE
  if (error) {
    *error = [NSError errorWithDomain:kLlamaBridgeErrorDomain
                                 code:LlamaBridgeErrorCodeUnavailable
                             userInfo:@{NSLocalizedDescriptionKey: @"llama.cpp sources not vendored in this build."}];
  }
  return nil;
#else
  if (![self ensureModelLoaded:modelPath error:error]) {
    return nil;
  }

  // Reset KV cache between generations so prompt tokens do not bleed across calls.
  llama_kv_self_clear(_ctx);

  const std::string promptStr = std::string(prompt.UTF8String ?: "");

  // Tokenize prompt. Prepend BOS when the model expects it.
  int requiredTokens = -llama_tokenize(_vocab, promptStr.c_str(), (int32_t)promptStr.size(),
                                       nullptr, 0, true, true);
  std::vector<llama_token> tokens(requiredTokens);
  int tokenized = llama_tokenize(_vocab, promptStr.c_str(), (int32_t)promptStr.size(),
                                 tokens.data(), (int32_t)tokens.size(), true, true);
  if (tokenized < 0) {
    if (error) {
      *error = [NSError errorWithDomain:kLlamaBridgeErrorDomain
                                   code:LlamaBridgeErrorCodeTokenize
                               userInfo:@{NSLocalizedDescriptionKey: @"Failed to tokenize prompt."}];
    }
    return nil;
  }
  tokens.resize(tokenized);

  // Sampler: simple greedy. Swap in top-p/temp if we need more variety later.
  llama_sampler *sampler = llama_sampler_chain_init(llama_sampler_chain_default_params());
  llama_sampler_chain_add(sampler, llama_sampler_init_greedy());

  llama_batch batch = llama_batch_get_one(tokens.data(), (int32_t)tokens.size());
  std::string output;
  output.reserve(maxTokens * 4);

  int produced = 0;
  while (produced < maxTokens) {
    if (llama_decode(_ctx, batch) != 0) {
      llama_sampler_free(sampler);
      if (error) {
        *error = [NSError errorWithDomain:kLlamaBridgeErrorDomain
                                     code:LlamaBridgeErrorCodeDecode
                                 userInfo:@{NSLocalizedDescriptionKey: @"llama_decode failed."}];
      }
      return nil;
    }

    llama_token next = llama_sampler_sample(sampler, _ctx, -1);
    if (llama_vocab_is_eog(_vocab, next)) {
      break;
    }

    char piece[256];
    int n = llama_token_to_piece(_vocab, next, piece, (int)sizeof(piece), 0, true);
    if (n > 0) {
      output.append(piece, piece + n);
    }

    batch = llama_batch_get_one(&next, 1);
    produced += 1;
  }

  llama_sampler_free(sampler);

  return [NSString stringWithUTF8String:output.c_str()];
#endif
}

@end
