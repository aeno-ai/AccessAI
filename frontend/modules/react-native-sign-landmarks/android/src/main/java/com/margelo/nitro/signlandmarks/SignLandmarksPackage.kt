package com.margelo.nitro.signlandmarks

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

// Loads the native part when the app starts; the HybridObject itself is
// registered by nitrogen's autolinking (nitro.json).
class SignLandmarksPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider { HashMap() }

  companion object {
    init {
      SignLandmarksOnLoad.initializeNative()
    }
  }
}
