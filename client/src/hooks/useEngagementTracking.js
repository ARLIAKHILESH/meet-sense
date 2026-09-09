import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

/**
 * Runs a lightweight, fully client-side engagement heuristic against a
 * <video> element showing the LOCAL participant's own camera feed.
 *
 * IMPORTANT / HONEST LIMITATION (keep this in your report):
 * This does not measure "attention" as a cognitive state. It measures
 * three visible proxy signals and combines them with simple rules:
 *   1. face presence  - is a face detected at all
 *   2. head yaw       - is the face roughly pointed at the camera
 *   3. eye openness   - are the eyes open vs. closed
 * Someone can be fully engaged while glancing at notes, or "scored high"
 * while zoned out and staring blankly at the screen. Treat the resulting
 * score as a rough, explainable proxy - not ground truth.
 *
 * Landmark indices reference the standard MediaPipe Face Mesh topology.
 */

const LANDMARKS = {
  noseTip: 1,
  cheekRight: 234, // subject's right cheek (image-left when not mirrored)
  cheekLeft: 454, // subject's left cheek
  foreheadTop: 10,
  chin: 152,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeTop: 386,
  rightEyeBottom: 374,
};

let sharedLandmarkerPromise = null;
function getLandmarker() {
  if (!sharedLandmarkerPromise) {
    sharedLandmarkerPromise = (async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
      );
      return FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    })();
  }
  return sharedLandmarkerPromise;
}

function scoreFromLandmarks(landmarks) {
  const get = (idx) => landmarks[idx];

  const nose = get(LANDMARKS.noseTip);
  const cheekR = get(LANDMARKS.cheekRight);
  const cheekL = get(LANDMARKS.cheekLeft);
  const forehead = get(LANDMARKS.foreheadTop);
  const chin = get(LANDMARKS.chin);

  const faceWidth = Math.abs(cheekL.x - cheekR.x) || 0.0001;
  const faceHeight = Math.abs(chin.y - forehead.y) || 0.0001;

  // Yaw proxy: how far the nose sits from the horizontal midpoint of the
  // cheeks, normalized by face width. ~0 = facing camera, ~0.5 = profile.
  const midX = (cheekL.x + cheekR.x) / 2;
  const yawRatio = Math.abs(nose.x - midX) / faceWidth;

  // Eye openness proxy, normalized by face height so it's scale-invariant.
  const leftOpen =
    Math.abs(get(LANDMARKS.leftEyeTop).y - get(LANDMARKS.leftEyeBottom).y) /
    faceHeight;
  const rightOpen =
    Math.abs(get(LANDMARKS.rightEyeTop).y - get(LANDMARKS.rightEyeBottom).y) /
    faceHeight;
  const avgEyeOpen = (leftOpen + rightOpen) / 2;

  // Combine into a 0-100 score. Thresholds picked empirically for typical
  // webcam framing - tune per your test hardware in a real deployment.
  let score = 100;
  score -= Math.min(60, yawRatio * 260); // penalize looking away
  score -= avgEyeOpen < 0.035 ? 35 : 0; // penalize eyes closed
  score = Math.max(0, Math.min(100, Math.round(score)));

  let label = "attentive";
  if (score < 40) label = "distracted";
  else if (score < 70) label = "partial";

  return { score, label };
}

export function useEngagementTracking({ videoRef, enabled, onScore, intervalMs = 1500 }) {
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState({ score: null, label: "no-face" });
  const rafRef = useRef(null);
  const landmarkerRef = useRef(null);
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    getLandmarker().then((lm) => {
      if (cancelled) return;
      landmarkerRef.current = lm;
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready) return;

    function loop(ts) {
      rafRef.current = requestAnimationFrame(loop);
      if (ts - lastRunRef.current < intervalMs) return;
      lastRunRef.current = ts;

      const video = videoRef.current;
      const lm = landmarkerRef.current;
      if (!video || !lm || video.readyState < 2) return;

      const result = lm.detectForVideo(video, performance.now());

      let next;
      if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
        next = { score: 15, label: "away" };
      } else {
        next = scoreFromLandmarks(result.faceLandmarks[0]);
      }

      setCurrent(next);
      onScore?.(next);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, ready, intervalMs, videoRef, onScore]);

  return { ready, current };
}
