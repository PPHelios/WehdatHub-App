import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // The app is Arabic first: on the very first launch the layout is right-to-left even on an English phone.
    // After that the app's own language setting decides (see src/direction.ts).
    let defaults = UserDefaults.standard
    if !defaults.bool(forKey: "wehdathub.rtl_default_set") {
      defaults.set(true, forKey: "RCTI18nUtil_allowRTL")
      defaults.set(true, forKey: "RCTI18nUtil_forceRTL")
      defaults.set(true, forKey: "wehdathub.rtl_default_set")
    }
    return true
  }
}
