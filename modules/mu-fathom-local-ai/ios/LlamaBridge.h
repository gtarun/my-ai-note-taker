#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Obj-C++ wrapper around llama.cpp. Holds a loaded model + context between
/// calls so repeat invocations on the same model path do not re-tokenize the
/// vocab / re-allocate the KV cache.
@interface LlamaBridge : NSObject

+ (NSString *)sdkVersion;

/// Generates up to `maxTokens` tokens from `prompt` using the GGUF model at
/// `modelPath`. The call is synchronous and CPU/GPU-bound; callers should
/// serialize through an actor/dispatch queue to avoid concurrent decode.
- (nullable NSString *)generateFromPrompt:(NSString *)prompt
                                 modelPath:(NSString *)modelPath
                                 maxTokens:(int)maxTokens
                                     error:(NSError * _Nullable * _Nullable)error
  NS_SWIFT_NAME(generate(prompt:modelPath:maxTokens:));

/// Unloads any cached model/context. Called on memory warnings or when the
/// active summary model id changes.
- (void)unload;

@end

NS_ASSUME_NONNULL_END
