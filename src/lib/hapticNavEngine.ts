/**
 * Haptic Navigation Engine
 * Provides tactical vibration alerts and indoor obstacle feedback
 * for blind and visually impaired users.
 */

export type HapticAlertPattern = 'clear' | 'warning' | 'danger' | 'turn-left' | 'turn-right' | 'arrival' | 'single-pulse';

export interface NavGuidanceResult {
  hazardLevel: 'safe' | 'caution' | 'danger';
  spokenInstruction: string;
  hapticPattern: HapticAlertPattern;
  obstaclesDetected: string[];
}

/**
 * Triggers distinct tactile vibration patterns on mobile/supported devices.
 */
export function triggerHapticAlert(pattern: HapticAlertPattern): boolean {
  if (typeof window === 'undefined' || !navigator.vibrate) {
    return false;
  }

  try {
    switch (pattern) {
      case 'clear':
      case 'single-pulse':
        return navigator.vibrate([60]);
      case 'warning':
        return navigator.vibrate([150, 80, 150]);
      case 'danger':
        return navigator.vibrate([400, 100, 400, 100, 400]);
      case 'turn-left':
        return navigator.vibrate([100, 100, 300]);
      case 'turn-right':
        return navigator.vibrate([300, 100, 100]);
      case 'arrival':
        return navigator.vibrate([80, 50, 80, 50, 200]);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Parses vision analysis text into structured navigation guidance
 */
export function parseNavGuidance(
  description: string,
  lang: 'ar' | 'en' | 'fr' = 'ar'
): NavGuidanceResult {
  const isAr = lang === 'ar';

  const dangerKeywords = isAr
    ? ['خطر', 'سلم', 'درج', 'حفرة', 'سقوط', 'احذر', 'عتبة عالية', 'عربية', 'شارع']
    : ['danger', 'hazard', 'stairs', 'drop', 'step down', 'hole', 'careful', 'watch out', 'car'];

  const cautionKeywords = isAr
    ? ['كرسي', 'ترابيزة', 'شنطة', 'سلك', 'باب', 'عائق', 'حيطة', 'شخص', 'قدامك']
    : ['chair', 'table', 'bag', 'wire', 'cord', 'door', 'wall', 'obstacle', 'person', 'path'];

  const hasDanger = dangerKeywords.some((kw) => description.includes(kw));
  const hasCaution = cautionKeywords.some((kw) => description.includes(kw));

  if (hasDanger) {
    return {
      hazardLevel: 'danger',
      spokenInstruction: description,
      hapticPattern: 'danger',
      obstaclesDetected: [isAr ? 'عائق أو انحدار خطير' : 'Hazardous obstacle or drop'],
    };
  }

  if (hasCaution) {
    return {
      hazardLevel: 'caution',
      spokenInstruction: description,
      hapticPattern: 'warning',
      obstaclesDetected: [isAr ? 'عائق محيطي' : 'Nearby object'],
    };
  }

  return {
    hazardLevel: 'safe',
    spokenInstruction: description,
    hapticPattern: 'clear',
    obstaclesDetected: [],
  };
}
