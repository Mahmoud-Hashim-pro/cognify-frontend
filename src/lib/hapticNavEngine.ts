/**
 * Haptic Navigation Engine
 * Provides tactical vibration alerts and indoor obstacle feedback
 * for blind and visually impaired users.
 */

export type HapticAlertPattern =
  | 'clear'
  | 'warning'
  | 'danger'
  | 'turn-left'
  | 'turn-right'
  | 'arrival'
  | 'single-pulse'
  | 'double-pulse'
  | 'sos';

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
      case 'double-pulse':
        return navigator.vibrate([80, 60, 80]);
      case 'sos':
        return navigator.vibrate([100, 50, 100, 50, 100, 150, 300, 50, 300, 50, 300, 150, 100, 50, 100, 50, 100]);
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

function normalizeArabicText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, ''); // strip Arabic diacritics
}

const DANGER_KEYWORDS: Record<'ar' | 'en' | 'fr', string[]> = {
  ar: [
    'خطر', 'احذر', 'احذري', 'احترس', 'احترسي', 'انتبه', 'انتبهي', 'تحذير', 'توقف',
    'سلم', 'سلالم', 'درج', 'حفرة', 'سقوط', 'وقوع', 'انحدار', 'حافة', 'هاوية',
    'عتبة عالية', 'عتبة', 'عربية', 'سيارة', 'شارع', 'طريق سيارات', 'موتوسيكل', 'زجاج مكسور'
  ],
  fr: [
    'danger', 'dangereux', 'dangereuse', 'attention', 'alerte', 'arret', 'arrête', 'stoppez', 'stop',
    'escalier', 'escaliers', 'marche', 'marches', 'trou', 'chute', 'tomber', 'précipice', 'ravin',
    'fosse', 'voiture', 'véhicule', 'rue', 'glissant', 'travaux', 'barrière', 'pente raide'
  ],
  en: [
    'danger', 'dangerous', 'hazard', 'hazardous', 'watch out', 'look out', 'careful', 'beware', 'stop',
    'stairs', 'staircase', 'stairway', 'step down', 'drop', 'drop-off', 'hole', 'cliff', 'edge', 'fall',
    'pit', 'car', 'cars', 'vehicle', 'vehicles', 'traffic', 'truck', 'street', 'slippery', 'live wire'
  ],
};

const CAUTION_KEYWORDS: Record<'ar' | 'en' | 'fr', string[]> = {
  ar: [
    'كرسي', 'ترابيزة', 'طاولة', 'كنبة', 'سرير', 'مكتب', 'شنطة', 'حقيبة', 'سلك', 'كابل',
    'سجادة', 'باب', 'عائق', 'حيطة', 'جدار', 'عمود', 'شخص', 'أشخاص', 'ناس'
  ],
  fr: [
    'prudence', 'ralentir', 'ralentissez', 'chaussée', 'trottoir', 'pente', 'virage serré',
    'passage encombré', 'passage étroit', 'encombré', 'porte', 'chaise', 'table', 'sac', 'fil',
    'câble', 'mur', 'personne', 'obstacle'
  ],
  en: [
    'caution', 'slow down', 'chair', 'table', 'desk', 'bag', 'backpack', 'wire', 'cord', 'cable',
    'door', 'wall', 'pole', 'obstacle', 'person', 'people', 'curb', 'narrow passage', 'blocked'
  ],
};

function matchesKeywords(
  description: string,
  keywords: string[],
  lang: 'ar' | 'en' | 'fr'
): boolean {
  if (!description) return false;
  const rawLower = description.toLowerCase();

  if (lang === 'ar') {
    const normDesc = normalizeArabicText(rawLower);
    return keywords.some((kw) => {
      const kwLower = kw.toLowerCase();
      const normKw = normalizeArabicText(kwLower);
      return rawLower.includes(kwLower) || normDesc.includes(normKw);
    });
  }

  const normLatinDesc = rawLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return keywords.some((kw) => {
    const kwLower = kw.toLowerCase();
    const normKw = kwLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return rawLower.includes(kwLower) || normLatinDesc.includes(normKw);
  });
}

function getDangerLabel(lang: 'ar' | 'en' | 'fr'): string {
  switch (lang) {
    case 'ar':
      return 'عائق أو انحدار خطير';
    case 'fr':
      return 'Obstacle dangereux ou dénivelé';
    case 'en':
    default:
      return 'Hazardous obstacle or drop';
  }
}

function getCautionLabel(lang: 'ar' | 'en' | 'fr'): string {
  switch (lang) {
    case 'ar':
      return 'عائق محيطي';
    case 'fr':
      return 'Obstacle à proximité';
    case 'en':
    default:
      return 'Nearby object';
  }
}

/**
 * Parses vision analysis text into structured navigation guidance
 */
export function parseNavGuidance(
  description: string,
  lang: 'ar' | 'en' | 'fr' = 'ar'
): NavGuidanceResult {
  const activeLang = lang === 'ar' || lang === 'fr' || lang === 'en' ? lang : 'en';

  const hasDanger = matchesKeywords(description, DANGER_KEYWORDS[activeLang], activeLang);
  const hasCaution = matchesKeywords(description, CAUTION_KEYWORDS[activeLang], activeLang);

  if (hasDanger) {
    return {
      hazardLevel: 'danger',
      spokenInstruction: description,
      hapticPattern: 'danger',
      obstaclesDetected: [getDangerLabel(activeLang)],
    };
  }

  if (hasCaution) {
    return {
      hazardLevel: 'caution',
      spokenInstruction: description,
      hapticPattern: 'warning',
      obstaclesDetected: [getCautionLabel(activeLang)],
    };
  }

  return {
    hazardLevel: 'safe',
    spokenInstruction: description,
    hapticPattern: 'clear',
    obstaclesDetected: [],
  };
}
