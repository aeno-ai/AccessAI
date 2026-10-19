package com.margelo.nitro.signlandmarks

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.camera.HybridCameraOutputSpec

@DoNotStrip
@Keep
class HybridSignLandmarkerFactory : HybridSignLandmarkerFactorySpec() {
  @DoNotStrip
  @Keep
  override fun createSignLandmarkerOutput(options: SignLandmarkerOutputOptions): HybridCameraOutputSpec =
    HybridSignLandmarkerOutput(options)
}
