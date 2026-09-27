/**
 * signConfusionMatrix.ts — Confusion Matrix & Model Evaluation Engine for ArSL
 * 
 * Provides:
 * - Full N x N Confusion Matrix calculation for sign language classification.
 * - Per-class clinical metrics: Accuracy, Precision, Recall, and F1-Score.
 * - Automatic detection of "Confused Sign Pairs" (visually or phonologically similar gestures).
 * - Actionable linguistic feedback for sign instructors and ML developers.
 */

import { ARSL_CORE_CLASSES } from './temporalSignRecognizer';

export interface ClassMetric {
  classId: string;
  classNameAr: string;
  classNameEn: string;
  support: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface ConfusedPair {
  actualId: string;
  actualAr: string;
  predictedId: string;
  predictedAr: string;
  errorCount: number;
  phonologicalCause: string;
}

export interface ConfusionMatrixReport {
  matrix: number[][]; // [trueIndex][predictedIndex]
  classes: typeof ARSL_CORE_CLASSES;
  globalAccuracy: number;
  classMetrics: ClassMetric[];
  topConfusedPairs: ConfusedPair[];
  evaluatedSamplesCount: number;
}

/**
 * Common phonological confusions in Arabic & Egyptian Sign Language.
 */
const KNOWN_PHONOLOGICAL_PAIRS: Record<string, string> = {
  's_father:s_mother': 'تشابه شكل اليد المفتوحة والحركة، مع اختلاف الموضع التشريحي (الجبهة مقابل الذقن).',
  's_mother:s_father': 'تشابه حركة النقر لليد المفتوحة مع اختلاف منطقة الوجه (الذقن مقابل الجبهة).',
  's_water:s_drink': 'كلاهما يتجه نحو الفم والذقن، ويختلفان في فتح الأصابع الثلاثة (W) مقابل شكل الكوب.',
  's_eat:s_drink': 'موضع الفم متطابق، مع اختلاف حركة الأصابع المضمومة كقرصة مقابل إمالة الكوب.',
  's_salam:s_shukran': 'كلاهما يخرج بحركة أمامية من الوجه، ويفترقان في نقطة البداية (الجبهة مقابل الذقن).',
  's_car:s_school': 'استخدام كلتا اليدين معاً، وتفترقان بحركة عجلة القيادة مقابل تصفيق الكفين.',
};

/**
 * Computes a detailed Confusion Matrix Report from True and Predicted label arrays.
 */
export function computeConfusionMatrix(
  trueLabels: number[], // class indices
  predictedLabels: number[],
  classes = ARSL_CORE_CLASSES
): ConfusionMatrixReport {
  const n = classes.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  const total = Math.min(trueLabels.length, predictedLabels.length);
  let correct = 0;

  for (let i = 0; i < total; i++) {
    const t = trueLabels[i];
    const p = predictedLabels[i];
    if (t >= 0 && t < n && p >= 0 && p < n) {
      matrix[t][p]++;
      if (t === p) correct++;
    }
  }

  const globalAccuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

  // Compute per-class Precision, Recall, and F1
  const classMetrics: ClassMetric[] = classes.map((cls, idx) => {
    const tp = matrix[idx][idx];
    
    // Row sum = TP + FN (actual count of this class)
    let actualCount = 0;
    for (let c = 0; c < n; c++) actualCount += matrix[idx][c];

    // Column sum = TP + FP (total times model predicted this class)
    let predictedCount = 0;
    for (let r = 0; r < n; r++) predictedCount += matrix[r][idx];

    const precision = predictedCount > 0 ? tp / predictedCount : 0;
    const recall = actualCount > 0 ? tp / actualCount : 0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      classId: cls.id,
      classNameAr: cls.ar,
      classNameEn: cls.en,
      support: actualCount,
      precision: Math.round(precision * 100) / 100,
      recall: Math.round(recall * 100) / 100,
      f1Score: Math.round(f1 * 100) / 100,
    };
  });

  // Extract top confused pairs (off-diagonal entries)
  const confusedPairsList: ConfusedPair[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (r !== c && matrix[r][c] > 0) {
        const key = `${classes[r].id}:${classes[c].id}`;
        const cause = KNOWN_PHONOLOGICAL_PAIRS[key] || 'تشابه في معالم اليد والسرعة الحركية للطرفين.';
        confusedPairsList.push({
          actualId: classes[r].id,
          actualAr: classes[r].ar,
          predictedId: classes[c].id,
          predictedAr: classes[c].en,
          errorCount: matrix[r][c],
          phonologicalCause: cause,
        });
      }
    }
  }

  // Sort descending by error count
  confusedPairsList.sort((a, b) => b.errorCount - a.errorCount);

  return {
    matrix,
    classes,
    globalAccuracy,
    classMetrics,
    topConfusedPairs: confusedPairsList.slice(0, 8),
    evaluatedSamplesCount: total,
  };
}
