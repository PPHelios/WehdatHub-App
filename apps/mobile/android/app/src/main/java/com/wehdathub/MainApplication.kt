package com.wehdathub

import android.app.Application
import android.content.Context
import com.facebook.react.modules.i18nmanager.I18nUtil
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          add(ShareIntentPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // The app is Arabic first: on the very first launch the layout is right-to-left even on an English phone.
    // After that the app's own language setting decides (see src/direction.ts).
    val prefs = getSharedPreferences("wehdathub.layout", Context.MODE_PRIVATE)
    if (!prefs.getBoolean("rtl_default_set", false)) {
      I18nUtil.instance.allowRTL(this, true)
      I18nUtil.instance.forceRTL(this, true)
      prefs.edit().putBoolean("rtl_default_set", true).apply()
    }
    loadReactNative(this)
  }
}
