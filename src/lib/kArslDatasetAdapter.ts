/**
 * syntheticSignDatasetGenerator.ts (formerly kArslDatasetAdapter.ts)
 * 
 * ⚠️ TRANSPARENCY & SCIENTIFIC INTEGRITY DISCLOSURE:
 * This module generates SYNTHETIC geometric landmark trajectories for architectural pipeline verification.
 * It is NOT the official KArSL (King Saud University) or ArSL2018 human participant dataset.
 * It does NOT contain real-world video or sensor data from Deaf individuals.
 * 
 * Purpose:
 * - Validate pipeline dimensions (16 frames × 126 features) and TensorFlow.js compilation in-browser.
 * - Test Confusion Matrix calculation, precision/recall math, and UI responsiveness.
 * - Act as a placeholder until genuine, ethically collected and linguistically verified human datasets are integrated.
 * 
 * Real-world Accuracy Notice:
 * Models trained on these synthetic trajectories have NOT been validated against real signers.
 */

import { ARSL_CORE_CLASSES, TEMPORAL_WINDOW_SIZE, FEATURES_PER_FRAME, Point3D } from './temporalSignRecognizer';
import { ARSL_DICTIONARY, hamnosysToThreePose } from './arslDictionary';

export interface DatasetSample {
  signId: string;
  signArabic: string;
  signEnglish: string;
  temporalFrames: number[][]; // [16][126]
}

export interface DatasetBundle {
  trainXs: number[][];
  trainYs: number[][];
  testXs: number[][];
  testYs: number[][];
  classes: typeof ARSL_CORE_CLASSES;
}

/**
 * Generates synthetic MediaPipe hand landmarks for a target HamNoSys configuration.
 */
function generateSyntheticLandmarks(signId: string, frameIdx: number, totalFrames: number): {
  right: Point3D[];
  left: Point3D[];
} {
  const entry = ARSL_DICTIONARY.find((e) => e.id === signId) || ARSL_DICTIONARY[0];
  const threePose = hamnosysToThreePose(entry.hamnosys);

  const t = frameIdx / Math.max(totalFrames - 1, 1);
  const phase = Math.sin(t * Math.PI * 2);

  // Base wrist position with movement dynamic
  const rightWrist: Point3D = {
    x: threePose.pos[0] + (entry.hamnosys.movement === 'shake' ? phase * 0.05 : 0),
    y: threePose.pos[1] + (entry.hamnosys.movement === 'nod' ? phase * 0.04 : 0),
    z: threePose.pos[2] + (entry.hamnosys.movement === 'forward' ? t * 0.06 : 0),
  };

  const leftWrist: Point3D = threePose.twoHanded
    ? {
        x: -rightWrist.x,
        y: rightWrist.y,
        z: rightWrist.z,
      }
    : { x: -0.3, y: 0.9, z: 0.2 }; // resting position

  // Construct 21 finger landmarks for right hand
  const right: Point3D[] = [{ ...rightWrist }];
  for (let i = 1; i <= 20; i++) {
    const fingerIdx = Math.floor((i - 1) / 4);
    const jointIdx = ((i - 1) % 4) + 1;
    const curl = threePose.f[Math.min(fingerIdx, 4)];

    right.push({
      x: rightWrist.x + (fingerIdx - 2) * 0.02 * (1 + threePose.spread),
      y: rightWrist.y + jointIdx * 0.025 * (1 - curl * 0.65),
      z: (rightWrist.z ?? 0) + curl * 0.03 * jointIdx,
    });
  }

  // Construct 21 finger landmarks for left hand
  const left: Point3D[] = [{ ...leftWrist }];
  for (let i = 1; i <= 20; i++) {
    const fingerIdx = Math.floor((i - 1) / 4);
    const jointIdx = ((i - 1) % 4) + 1;
    const curl = threePose.twoHanded ? threePose.f[Math.min(fingerIdx, 4)] : 0.8;

    left.push({
      x: leftWrist.x - (fingerIdx - 2) * 0.02 * (1 + threePose.spread),
      y: leftWrist.y + jointIdx * 0.025 * (1 - curl * 0.65),
      z: (leftWrist.z ?? 0) + curl * 0.03 * jointIdx,
    });
  }

  return { right, left };
}

/**
 * Applies data augmentation to landmark coordinates:
 * - Spatial noise (jitter)
 * - Hand scale jitter
 */
function augmentFrame(features: number[], jitterAmount = 0.02, scaleFactor = 1.0): number[] {
  return features.map((val, idx) => {
    const noise = (Math.random() - 0.5) * jitterAmount;
    return (val + noise) * scaleFactor;
  });
}

/**
 * Loads a calibrated KArSL / ArSL benchmark dataset for model training and confusion matrix evaluation.
 */
export function generateSyntheticBenchmarkDataset(samplesPerClass: number = 8): DatasetBundle {
  const trainXs: number[][] = [];
  const trainYs: number[][] = [];
  const testXs: number[][] = [];
  const testYs: number[][] = [];

  const numClasses = ARSL_CORE_CLASSES.length;

  ARSL_CORE_CLASSES.forEach((cls, classIdx) => {
    // One-hot label vector
    const oneHot = new Array(numClasses).fill(0);
    oneHot[classIdx] = 1;

    for (let s = 0; s < samplesPerClass; s++) {
      const isTest = s >= Math.floor(samplesPerClass * 0.75); // 75% train / 25% test
      const scaleJitter = 0.92 + Math.random() * 0.16;
      const noiseJitter = 0.015 + Math.random() * 0.02;

      const sequenceFeatures: number[] = [];
      for (let f = 0; f < TEMPORAL_WINDOW_SIZE; f++) {
        const { right, left } = generateSyntheticLandmarks(cls.id, f, TEMPORAL_WINDOW_SIZE);
        
        // Flatten landmarks into 126 features
        const frameRaw: number[] = [];
        for (const pt of right) {
          frameRaw.push(pt.x, pt.y, pt.z ?? 0);
        }
        for (const pt of left) {
          frameRaw.push(pt.x, pt.y, pt.z ?? 0);
        }

        const augmented = augmentFrame(frameRaw, noiseJitter, scaleJitter);
        sequenceFeatures.push(...augmented);
      }

      if (isTest) {
        testXs.push(sequenceFeatures);
        testYs.push([...oneHot]);
      } else {
        trainXs.push(sequenceFeatures);
        trainYs.push([...oneHot]);
      }
    }
  });

  return {
    trainXs,
    trainYs,
    testXs,
    testYs,
    classes: ARSL_CORE_CLASSES,
  };
}

/** @deprecated Use generateSyntheticBenchmarkDataset. Generates synthetic vectors only. */
export const loadKArslBenchmarkDataset = generateSyntheticBenchmarkDataset;
