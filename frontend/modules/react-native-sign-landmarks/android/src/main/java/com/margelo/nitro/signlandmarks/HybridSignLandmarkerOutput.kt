package com.margelo.nitro.signlandmarks

import android.graphics.Bitmap
import android.graphics.Matrix
import android.util.Size
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.holisticlandmarker.HolisticLandmarker
import com.google.mediapipe.tasks.vision.holisticlandmarker.HolisticLandmarkerResult
import com.google.mediapipe.tasks.vision.holisticlandmarker.JavaliteHolisticLandmarkerOptions
import com.margelo.nitro.NitroModules
import com.margelo.nitro.camera.CameraOrientation
import com.margelo.nitro.camera.HybridCameraOutputSpec
import com.margelo.nitro.camera.MediaType
import com.margelo.nitro.camera.MirrorMode
import com.margelo.nitro.camera.extensions.converters.toSize
import com.margelo.nitro.camera.extensions.surfaceRotation
import com.margelo.nitro.camera.public.NativeCameraOutput
import java.util.concurrent.Executors

/**
 * A VisionCamera output that runs MediaPipe Holistic (Tasks) on every frame,
 * on the phone, and hands JavaScript the 69 points our sign models read
 * (HANDOFF.md §49). Same layout as ai/app/sign/features.py `pack()`:
 *
 *   left hand 21 | right hand 21 | pose 7 (POSE_IDX) | face 20 (FACE_IDX)
 *   each (x, y, present), x and y 0–1 of the upright, unmirrored frame.
 *
 * Unmirrored like the training videos and the tester's webcam: CameraX hands
 * the analyzer the sensor's image, never the mirrored preview. Frames are
 * read and dropped — never stored or sent.
 */
class HybridSignLandmarkerOutput(
  private val options: SignLandmarkerOutputOptions,
) : HybridCameraOutputSpec(),
  ImageAnalysis.Analyzer,
  NativeCameraOutput {
  override val mediaType: MediaType = MediaType.VIDEO
  override var outputOrientation: CameraOrientation = CameraOrientation.UP
    get() = field
    set(value) {
      field = value
      imageAnalysis?.targetRotation = value.surfaceRotation
    }
  override val currentResolution: com.margelo.nitro.camera.Size?
    get() = imageAnalysis?.resolutionInfo?.resolution?.toSize()
  override val mirrorMode: MirrorMode = MirrorMode.OFF

  private var imageAnalysis: ImageAnalysis? = null
  private val executor = Executors.newSingleThreadExecutor()
  private var landmarker: HolisticLandmarker? = null
  private var lastTimestampMs = -1L

  // 720p: MediaPipe crops each hand from the full frame, so more pixels mean
  // clearer fingers (the old 480p video pieces lost them).
  private val targetSize = Size(1280, 720)

  override fun createUseCase(
    mirrorMode: MirrorMode,
    config: NativeCameraOutput.Config,
  ): NativeCameraOutput.PreparedUseCase {
    val resolutionSelector =
      ResolutionSelector
        .Builder()
        .setResolutionStrategy(ResolutionStrategy(targetSize, ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER))
        .build()
    val analysis =
      ImageAnalysis
        .Builder()
        .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
        .setOutputImageRotationEnabled(false)
        .setResolutionSelector(resolutionSelector)
        // While MediaPipe reads one frame, newer ones replace older ones.
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .build()
    return NativeCameraOutput.PreparedUseCase(analysis) {
      this.imageAnalysis = analysis
      analysis.setAnalyzer(executor, this)
    }
  }

  override fun dispose() {
    super.dispose()
    imageAnalysis?.clearAnalyzer()
    executor.execute {
      landmarker?.close()
      landmarker = null
    }
    executor.shutdown()
  }

  private fun landmarker(): HolisticLandmarker {
    landmarker?.let { return it }
    val context = NitroModules.applicationContext ?: throw Error("No Android context for MediaPipe")
    val base =
      BaseOptions
        .builder()
        .setModelAssetPath(MODEL_ASSET)
        .setDelegate(Delegate.CPU)
        .build()
    val holisticOptions =
      HolisticLandmarker.HolisticLandmarkerOptions
        .builder()
        .setBaseOptions(base)
        .setRunningMode(RunningMode.VIDEO)
        .build()
    // MediaPipe's own options crash with protobuf-javalite (see the class).
    val created = HolisticLandmarker.createFromOptions(context, JavaliteHolisticLandmarkerOptions(holisticOptions))
    landmarker = created
    return created
  }

  override fun analyze(imageProxy: ImageProxy) {
    try {
      // MediaPipe needs strictly increasing times.
      val timestampMs = imageProxy.imageInfo.timestamp / 1_000_000L
      if (timestampMs <= lastTimestampMs) return
      lastTimestampMs = timestampMs

      val upright = uprightBitmap(imageProxy)
      val brightness = brightnessOf(upright)
      val result = landmarker().detectForVideo(BitmapImageBuilder(upright).build(), timestampMs)
      options.onLandmarks(
        SignLandmarksFrame(
          points = pack(result),
          width = upright.width.toDouble(),
          height = upright.height.toDouble(),
          brightness = brightness,
          timestamp = timestampMs.toDouble(),
        ),
      )
      upright.recycle()
    } catch (error: Throwable) {
      options.onError(error)
    } finally {
      imageProxy.close()
    }
  }

  /** The frame as RGBA, turned upright (the camera sensor is usually sideways). */
  private fun uprightBitmap(imageProxy: ImageProxy): Bitmap {
    val bitmap = imageProxy.toBitmap()
    val degrees = imageProxy.imageInfo.rotationDegrees
    if (degrees == 0) return bitmap
    val matrix = Matrix().apply { postRotate(degrees.toFloat()) }
    val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    if (rotated !== bitmap) bitmap.recycle()
    return rotated
  }

  /** Average brightness 0–255 from a sparse grid of pixels (cheap). */
  private fun brightnessOf(bitmap: Bitmap): Double {
    val step = 24
    var sum = 0.0
    var count = 0
    var y = 0
    while (y < bitmap.height) {
      var x = 0
      while (x < bitmap.width) {
        val c = bitmap.getPixel(x, y)
        sum += 0.299 * ((c shr 16) and 0xFF) + 0.587 * ((c shr 8) and 0xFF) + 0.114 * (c and 0xFF)
        count += 1
        x += step
      }
      y += step
    }
    return if (count > 0) sum / count else 0.0
  }

  private fun pack(result: HolisticLandmarkerResult): DoubleArray {
    val out = DoubleArray(N_POINTS * 3)
    fun put(
      offset: Int,
      points: List<NormalizedLandmark>,
      indices: IntArray?,
      count: Int,
    ) {
      if (points.isEmpty()) return
      for (i in 0 until count) {
        val p = points[indices?.get(i) ?: i]
        out[(offset + i) * 3] = p.x().toDouble()
        out[(offset + i) * 3 + 1] = p.y().toDouble()
        out[(offset + i) * 3 + 2] = 1.0
      }
    }
    put(OFF_LHAND, result.leftHandLandmarks(), null, N_HAND)
    put(OFF_RHAND, result.rightHandLandmarks(), null, N_HAND)
    put(OFF_POSE, result.poseLandmarks(), POSE_IDX, POSE_IDX.size)
    put(OFF_FACE, result.faceLandmarks(), FACE_IDX, FACE_IDX.size)
    return out
  }

  companion object {
    private const val MODEL_ASSET = "holistic_landmarker.task"

    // ai/app/sign/features.py — keep these exactly the same.
    private val POSE_IDX = intArrayOf(0, 11, 12, 13, 14, 15, 16)
    private val FACE_IDX = intArrayOf(61, 291, 0, 17, 13, 14, 78, 308, 82, 312, 87, 317, 70, 105, 107, 336, 334, 300, 33, 263)
    private const val N_HAND = 21
    private const val OFF_LHAND = 0
    private const val OFF_RHAND = N_HAND
    private const val OFF_POSE = N_HAND * 2
    private val OFF_FACE = OFF_POSE + POSE_IDX.size
    private val N_POINTS = N_HAND * 2 + POSE_IDX.size + FACE_IDX.size
  }
}
