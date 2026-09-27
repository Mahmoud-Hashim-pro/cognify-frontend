/**
 * videoPoseExtractor.ts — Video Reference Pose Extractor for ArSL Standardization
 * 
 * Extracts 3D hand and facial joint landmarks from video keyframes to assist developers in future empirical data collection.
 */

import { Point3D, normalizeHandLandmarks } from './temporalSignRecognizer';
import { HamNoSysPose } from './arslDictionary';

export interface ExtractedVideoKeyframe {
  timestampMs: number;
  frameIndex: number;
  rightHandLandmarks: Point3D[];
  leftHandLandmarks: Point3D[];
  handDistance: number;
  normalizedVector: number[];
}

export interface ExtractedPoseProfile {
  signName: string;
  sourceVideoUrl: string;
  lectureId: number;
  extractedAt: string;
  keyframes: ExtractedVideoKeyframe[];
  inferredHamNoSys: Partial<HamNoSysPose>;
  linguistReviewStatus: 'draft' | 'verified' | 'needs_adjustment';
  notes: string;
}

/**
 * Calculates Euclidean distance between two 3D landmarks.
 */
function distance3D(p1: Point3D, p2: Point3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z ?? 0) - (p2.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Extracts normalized pose features from a processed video frame.
 */
export function extractKeyframeFromLandmarks(
  frameIndex: number,
  timestampMs: number,
  rightHand: Point3D[] = [],
  leftHand: Point3D[] = []
): ExtractedVideoKeyframe {
  const rightNorm = normalizeHandLandmarks(rightHand);
  const leftNorm = normalizeHandLandmarks(leftHand);

  let handDist = 0;
  if (rightHand.length > 0 && leftHand.length > 0) {
    handDist = distance3D(rightHand[0], leftHand[0]);
  }

  return {
    frameIndex,
    timestampMs,
    rightHandLandmarks: rightHand,
    leftHandLandmarks: leftHand,
    handDistance: Math.round(handDist * 1000) / 1000,
    normalizedVector: [...rightNorm, ...leftNorm],
  };
}

/**
 * Infers HamNoSys properties from a sequence of keyframes.
 */
export function inferHamNoSysFromKeyframes(keyframes: ExtractedVideoKeyframe[]): Partial<HamNoSysPose> {
  if (keyframes.length === 0) {
    return { handshape: 'flat_open', twoHanded: false, movement: 'static' };
  }

  // Check if both hands are active
  const hasLeftHandActivity = keyframes.some((k) => k.leftHandLandmarks.length >= 21);

  // Check movement variance in dominant hand wrist
  const firstFrame = keyframes[0];
  const lastFrame = keyframes[keyframes.length - 1];

  let movement: HamNoSysPose['movement'] = 'static';
  if (firstFrame.rightHandLandmarks.length > 0 && lastFrame.rightHandLandmarks.length > 0) {
    const dy = lastFrame.rightHandLandmarks[0].y - firstFrame.rightHandLandmarks[0].y;
    const dx = lastFrame.rightHandLandmarks[0].x - firstFrame.rightHandLandmarks[0].x;

    if (Math.abs(dy) > 0.08) {
      movement = dy < 0 ? 'up' : 'down';
    } else if (Math.abs(dx) > 0.08) {
      movement = 'forward';
    } else {
      movement = 'tap';
    }
  }

  return {
    twoHanded: hasLeftHandActivity,
    movement,
    orientation: 'out',
    location: 'neutral_space',
  };
}
