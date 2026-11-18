#import <React/RCTBridgeModule.h>

/// Reads what the Share extension saved in the App Group folder (photos, a voice note, text) and hands it to the app.
@interface ShareIntent : NSObject <RCTBridgeModule>
@end

@implementation ShareIntent

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return NO; }

static NSURL *SharedDir(void) {
  NSURL *base = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.com.wehdathub"];
  return base ? [base URLByAppendingPathComponent:@"shared" isDirectory:YES] : nil;
}

RCT_EXPORT_METHOD(getPending:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSURL *dir = SharedDir();
  NSData *data = dir ? [NSData dataWithContentsOfURL:[dir URLByAppendingPathComponent:@"pending.json"]] : nil;
  if (!data) { resolve([NSNull null]); return; }
  NSDictionary *raw = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![raw isKindOfClass:[NSDictionary class]]) { resolve([NSNull null]); return; }
  NSMutableArray *files = [NSMutableArray array];
  for (NSDictionary *f in raw[@"files"] ?: @[]) {
    NSString *path = f[@"path"];
    if (!path) continue;
    [files addObject:@{ @"uri": [[NSURL fileURLWithPath:path] absoluteString], @"mimeType": f[@"mimeType"] ?: @"", @"name": f[@"name"] ?: @"" }];
  }
  resolve(@{ @"text": raw[@"text"] ?: [NSNull null], @"files": files });
}

RCT_EXPORT_METHOD(clear:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSURL *dir = SharedDir();
  if (dir) [[NSFileManager defaultManager] removeItemAtURL:[dir URLByAppendingPathComponent:@"pending.json"] error:nil];
  resolve([NSNull null]);
}

@end
