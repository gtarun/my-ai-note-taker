#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface WhisperBridge : NSObject
+ (NSString *)sdkVersion;
+ (nullable NSString *)transcribeSamples:(NSData *)sampleData
                               modelPath:(NSString *)modelPath
                                   error:(NSError * _Nullable * _Nullable)error
  NS_SWIFT_NAME(transcribeSamples(_:modelPath:));
+ (nullable NSString *)transcribeFileAtPath:(NSString *)audioPath
                                  modelPath:(NSString *)modelPath
                                      error:(NSError * _Nullable * _Nullable)error
  NS_SWIFT_NAME(transcribeFile(atPath:modelPath:));
@end

NS_ASSUME_NONNULL_END
