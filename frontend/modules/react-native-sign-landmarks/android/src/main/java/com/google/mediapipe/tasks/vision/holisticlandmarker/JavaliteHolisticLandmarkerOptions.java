package com.google.mediapipe.tasks.vision.holisticlandmarker;

import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.core.ErrorListener;
import com.google.mediapipe.tasks.core.OutputHandler.ResultListener;
import com.google.mediapipe.tasks.core.proto.BaseOptionsProto;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.facedetector.proto.FaceDetectorGraphOptionsProto;
import com.google.mediapipe.tasks.vision.facelandmarker.proto.FaceLandmarksDetectorGraphOptionsProto;
import com.google.mediapipe.tasks.vision.handlandmarker.proto.HandLandmarksDetectorGraphOptionsProto;
import com.google.mediapipe.tasks.vision.holisticlandmarker.proto.HolisticLandmarkerGraphOptionsProto;
import com.google.mediapipe.tasks.vision.posedetector.proto.PoseDetectorGraphOptionsProto;
import com.google.mediapipe.tasks.vision.poselandmarker.proto.PoseLandmarksDetectorGraphOptionsProto;
import com.google.protobuf.Any;
import java.util.Optional;

/**
 * Works around a MediaPipe 0.10.26–0.10.35 bug (HANDOFF.md §49; 0.10.21 and
 * 1.1.1 are fine, and this class is harmless there): its
 * HolisticLandmarkerOptions.convertToAnyProto() was compiled against the full
 * protobuf-java and calls Any.Builder.build() returning Any, which
 * protobuf-javalite (the protobuf MediaPipe ships with) doesn't have, so every
 * frame failed with NoSuchMethodError. This wraps the real options and rebuilds
 * the same proto, compiled against protobuf-javalite. It lives in MediaPipe's
 * package because the option getters are package-private.
 */
public final class JavaliteHolisticLandmarkerOptions extends HolisticLandmarker.HolisticLandmarkerOptions {
  private static final String TYPE_URL =
      "type.googleapis.com/mediapipe.tasks.vision.holistic_landmarker.proto.HolisticLandmarkerGraphOptions";

  private final HolisticLandmarker.HolisticLandmarkerOptions options;

  public JavaliteHolisticLandmarkerOptions(HolisticLandmarker.HolisticLandmarkerOptions options) {
    this.options = options;
  }

  @Override
  BaseOptions baseOptions() {
    return options.baseOptions();
  }

  @Override
  RunningMode runningMode() {
    return options.runningMode();
  }

  @Override
  Optional<Float> minFaceDetectionConfidence() {
    return options.minFaceDetectionConfidence();
  }

  @Override
  Optional<Float> minFaceSuppressionThreshold() {
    return options.minFaceSuppressionThreshold();
  }

  @Override
  Optional<Float> minFacePresenceConfidence() {
    return options.minFacePresenceConfidence();
  }

  @Override
  Optional<Float> minPoseDetectionConfidence() {
    return options.minPoseDetectionConfidence();
  }

  @Override
  Optional<Float> minPoseSuppressionThreshold() {
    return options.minPoseSuppressionThreshold();
  }

  @Override
  Optional<Float> minPosePresenceConfidence() {
    return options.minPosePresenceConfidence();
  }

  @Override
  Optional<Float> minHandLandmarksConfidence() {
    return options.minHandLandmarksConfidence();
  }

  @Override
  boolean outputFaceBlendshapes() {
    return options.outputFaceBlendshapes();
  }

  @Override
  boolean outputPoseSegmentationMasks() {
    return options.outputPoseSegmentationMasks();
  }

  @Override
  Optional<ResultListener<HolisticLandmarkerResult, MPImage>> resultListener() {
    return options.resultListener();
  }

  @Override
  Optional<ErrorListener> errorListener() {
    return options.errorListener();
  }

  // Same steps as MediaPipe's own convertToAnyProto() (read from its bytecode).
  @Override
  public Any convertToAnyProto() {
    BaseOptionsProto.BaseOptions base =
        BaseOptionsProto.BaseOptions.newBuilder()
            .setUseStreamMode(runningMode() != RunningMode.IMAGE)
            .mergeFrom(convertBaseOptionsToProto(baseOptions()))
            .build();

    HandLandmarksDetectorGraphOptionsProto.HandLandmarksDetectorGraphOptions.Builder hand =
        HandLandmarksDetectorGraphOptionsProto.HandLandmarksDetectorGraphOptions.newBuilder();
    FaceDetectorGraphOptionsProto.FaceDetectorGraphOptions.Builder faceDetector =
        FaceDetectorGraphOptionsProto.FaceDetectorGraphOptions.newBuilder();
    FaceLandmarksDetectorGraphOptionsProto.FaceLandmarksDetectorGraphOptions.Builder faceLandmarks =
        FaceLandmarksDetectorGraphOptionsProto.FaceLandmarksDetectorGraphOptions.newBuilder();
    PoseDetectorGraphOptionsProto.PoseDetectorGraphOptions.Builder poseDetector =
        PoseDetectorGraphOptionsProto.PoseDetectorGraphOptions.newBuilder();
    PoseLandmarksDetectorGraphOptionsProto.PoseLandmarksDetectorGraphOptions.Builder poseLandmarks =
        PoseLandmarksDetectorGraphOptionsProto.PoseLandmarksDetectorGraphOptions.newBuilder();

    minHandLandmarksConfidence().ifPresent(hand::setMinDetectionConfidence);
    minPoseDetectionConfidence().ifPresent(poseDetector::setMinDetectionConfidence);
    minPoseSuppressionThreshold().ifPresent(poseDetector::setMinSuppressionThreshold);
    minPosePresenceConfidence().ifPresent(poseLandmarks::setMinDetectionConfidence);
    minFaceDetectionConfidence().ifPresent(faceDetector::setMinDetectionConfidence);
    minFaceSuppressionThreshold().ifPresent(faceDetector::setMinSuppressionThreshold);
    minFacePresenceConfidence().ifPresent(faceLandmarks::setMinDetectionConfidence);

    HolisticLandmarkerGraphOptionsProto.HolisticLandmarkerGraphOptions graph =
        HolisticLandmarkerGraphOptionsProto.HolisticLandmarkerGraphOptions.newBuilder()
            .setBaseOptions(base)
            .setHandLandmarksDetectorGraphOptions(hand.build())
            .setFaceDetectorGraphOptions(faceDetector.build())
            .setFaceLandmarksDetectorGraphOptions(faceLandmarks.build())
            .setPoseDetectorGraphOptions(poseDetector.build())
            .setPoseLandmarksDetectorGraphOptions(poseLandmarks.build())
            .build();

    return Any.newBuilder().setTypeUrl(TYPE_URL).setValue(graph.toByteString()).build();
  }
}
