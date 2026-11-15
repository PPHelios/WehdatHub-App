package com.wehdathub

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.ReactPackage

class ShareIntentModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = "ShareIntent"

  @ReactMethod
  fun getPending(promise: Promise) {
    val text = ShareStore.text
    val files = ShareStore.files
    if (text == null && files.isEmpty()) {
      promise.resolve(null)
      return
    }
    val map = Arguments.createMap()
    map.putString("text", text)
    val list = Arguments.createArray()
    files.forEach {
      val f = Arguments.createMap()
      f.putString("uri", it.uri)
      f.putString("mimeType", it.mimeType)
      f.putString("name", it.name)
      list.pushMap(f)
    }
    map.putArray("files", list)
    promise.resolve(map)
  }

  @ReactMethod
  fun clear(promise: Promise) {
    ShareStore.clear()
    promise.resolve(null)
  }
}

class ShareIntentPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(ShareIntentModule(reactContext))
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
