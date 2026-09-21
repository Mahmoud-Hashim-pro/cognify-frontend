/**
 * Phase 2C - Milestone 12: Accessibility Intelligence Engine
 *
 * Core engine governing:
 * 1. Ethical Non-Diagnosis Invariant Guard (Strict prohibition of clinical/psychological diagnostic labels).
 * 2. Aggregation of non-intrusive functional interaction observations.
 * 3. Autonomous adaptation of communication modality, response length, and interaction speed.
 * 4. 100% Student Agency preservation via manual locks.
 * 5. Dynamic multilingual AI system prompt directive synthesis.
 */

import type {
  CommunicationPreferences,
  A11yInteractionObservation,
  A11yCommunicationProfile,
  NonDiagnosticValidationResult,
  ResponseLengthPreference,
  ModalityPreference,
} from '../types/accessibilityIntelligence.js';

// ============================================================================
// 1. ETHICAL NON-DIAGNOSIS INVARIANT GUARD
// ============================================================================

/**
 * Forbidden clinical, medical, deficit, or psychological diagnostic terms.
 * Cognify strictly adapts to observable functional interaction habits (dwell time,
 * prompt brevity, TTS audio consumption) and NEVER infers or stores medical labels.
 */
export const FORBIDDEN_CLINICAL_KEYWORDS: readonly string[] = Object.freeze([
  'adhd',
  'add',
  'dyslexia',
  'dyslexic',
  'autism',
  'autistic',
  'asperger',
  'aspergers',
  'handicap',
  'handicapped',
  'retarded',
  'retard',
  'mental_deficit',
  'mental deficit',
  'disabled_student',
  'disabled student',
  'impairment_category',
  'clinical_diagnosis',
  'down_syndrome',
  'down syndrome',
  'bipolar',
  'schizophrenia',
  'schizophrenic',
  'psychiatric_label',
  'pathology_tag',
  'subnormal',
  'brain_damaged',
  'moron',
  'idiot',
  'imbecile',
]);

/**
 * Normalizes input string for robust keyword matching (lowercase, strips punctuation).
 */
function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
}

/**
 * Recursively inspects any object, array, or primitive for forbidden clinical keywords.
 * Returns a validation result detailing any detected violations.
 */
export function validateNonDiagnosticInvariant(
  profileOrPrefs: any,
  currentPath = ''
): NonDiagnosticValidationResult {
  const violations: string[] = [];

  if (profileOrPrefs === null || profileOrPrefs === undefined) {
    return { valid: true, violations: [] };
  }

  // Primitive strings
  if (typeof profileOrPrefs === 'string') {
    const normalized = normalizeForComparison(profileOrPrefs);
    for (const keyword of FORBIDDEN_CLINICAL_KEYWORDS) {
      const normKeyword = normalizeForComparison(keyword);
      const regex = new RegExp(`\\b${normKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (normalized === normKeyword || regex.test(normalized) || normalized.includes(normKeyword)) {
        violations.push(
          currentPath
            ? `Forbidden clinical diagnosis term "${keyword}" detected at "${currentPath}": "${profileOrPrefs}"`
            : `Forbidden clinical diagnosis term "${keyword}" detected: "${profileOrPrefs}"`
        );
      }
    }
    return { valid: violations.length === 0, violations };
  }

  // Arrays
  if (Array.isArray(profileOrPrefs)) {
    profileOrPrefs.forEach((item, index) => {
      const res = validateNonDiagnosticInvariant(item, `${currentPath}[${index}]`);
      if (!res.valid) {
        violations.push(...res.violations);
      }
    });
    return { valid: violations.length === 0, violations };
  }

  // Objects
  if (typeof profileOrPrefs === 'object') {
    for (const [key, value] of Object.entries(profileOrPrefs)) {
      const fieldPath = currentPath ? `${currentPath}.${key}` : key;
      const normalizedKey = normalizeForComparison(key);

      // Check key name
      for (const keyword of FORBIDDEN_CLINICAL_KEYWORDS) {
        const normKeyword = normalizeForComparison(keyword);
        if (normalizedKey === normKeyword || normalizedKey.includes(normKeyword)) {
          violations.push(`Forbidden clinical diagnosis term "${keyword}" detected in property key: "${fieldPath}"`);
        }
      }

      // Check nested value
      const res = validateNonDiagnosticInvariant(value, fieldPath);
      if (!res.valid) {
        violations.push(...res.violations);
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Enforces the non-diagnostic invariant by throwing an error or stripping violations.
 */
export function enforceNonDiagnosticInvariant<T>(data: T, action: 'throw' | 'strip' = 'throw'): T {
  const check = validateNonDiagnosticInvariant(data);
  if (check.valid) {
    return data;
  }

  if (action === 'throw') {
    throw new Error(
      `[Ethical Non-Diagnosis Invariant Violation]: Cognify strictly forbids medical or deficit labels. Violations detected: ${check.violations.join('; ')}`
    );
  }

  // Action is 'strip': return deep copy with offending keys stripped
  const sanitized = JSON.parse(JSON.stringify(data));
  const stripOffenders = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (let i = obj.length - 1; i >= 0; i--) {
        const itemRes = validateNonDiagnosticInvariant(obj[i]);
        if (!itemRes.valid) {
          obj.splice(i, 1);
        } else if (typeof obj[i] === 'object') {
          stripOffenders(obj[i]);
        }
      }
    } else {
      for (const [k, v] of Object.entries(obj)) {
        const keyNorm = normalizeForComparison(k);
        const hasBadKey = FORBIDDEN_CLINICAL_KEYWORDS.some((kw) => keyNorm.includes(normalizeForComparison(kw)));
        const valRes = validateNonDiagnosticInvariant(v);
        if (hasBadKey || !valRes.valid) {
          delete obj[k];
        } else if (typeof v === 'object') {
          stripOffenders(v);
        }
      }
    }
  };
  stripOffenders(sanitized);
  return sanitized;
}

// ============================================================================
// 2. PROFILE INITIALIZATION & DEFAULTS
// ============================================================================

/**
 * Creates default communication preferences with full student agency.
 */
export function createDefaultCommunicationPreferences(): CommunicationPreferences {
  return {
    preferredResponseLength: 'balanced',
    preferredModality: 'text',
    visualDensity: 'standard',
    interactionSpeed: 'standard',
    ttsAutoPlay: false,
    highContrastMode: false,
    manualLocks: {},
  };
}

/**
 * Initializes a new student Accessibility Communication Profile.
 * Defaults to balanced, standard, full agency settings with auto-adaptation enabled.
 */
export function createInitialA11yProfile(userId: string): A11yCommunicationProfile {
  return {
    userId,
    preferences: createDefaultCommunicationPreferences(),
    totalObservations: 0,
    lastAdapted: Date.now(),
    autoAdaptationEnabled: true,
    recentObservations: [],
  };
}

// ============================================================================
// 3. OBSERVATION RECORDING & AGGREGATION
// ============================================================================

const MAX_RECENT_OBSERVATIONS = 50;

/**
 * Records a new interaction observation (dwell time, prompt word length, TTS usage).
 * Enforces non-diagnostic invariant before updating the profile.
 */
export function recordA11yObservation(
  profile: A11yCommunicationProfile,
  observation: A11yInteractionObservation
): A11yCommunicationProfile {
  // Guard check
  enforceNonDiagnosticInvariant(observation);
  enforceNonDiagnosticInvariant(profile);

  const currentRecent = Array.isArray(profile.recentObservations)
    ? [...profile.recentObservations]
    : [];

  const updatedRecent = [...currentRecent, observation].slice(-MAX_RECENT_OBSERVATIONS);

  return {
    ...profile,
    totalObservations: (profile.totalObservations || 0) + 1,
    recentObservations: updatedRecent,
  };
}

// ============================================================================
// 4. ADAPTIVE DERIVATION ENGINE (WITH MANUAL LOCK PROTECTION)
// ============================================================================

/**
 * Derives adaptive communication preferences from aggregated observations.
 * Strict Invariants:
 * 1. If autoAdaptationEnabled is false => No changes.
 * 2. If manualLocks[key] is true => That key is NEVER overridden.
 * 3. Brief prompts (< 5 words) or fast dwell (< 3000ms) => 'concise' response length.
 * 4. TTS audio listened in >= 60% of turns => 'audio' or 'hybrid' modality.
 */
export function deriveAdaptiveCommunicationPreferences(
  profile: A11yCommunicationProfile
): CommunicationPreferences {
  enforceNonDiagnosticInvariant(profile);

  const currentPrefs = profile.preferences || createDefaultCommunicationPreferences();
  const locks = currentPrefs.manualLocks || {};

  // If student turned off auto-adaptation, preserve current preferences completely
  if (!profile.autoAdaptationEnabled) {
    return { ...currentPrefs, manualLocks: { ...locks } };
  }

  const observations = profile.recentObservations || [];
  if (observations.length === 0) {
    return { ...currentPrefs, manualLocks: { ...locks } };
  }

  const adapted: CommunicationPreferences = {
    ...currentPrefs,
    manualLocks: { ...locks },
  };

  // 1. Evaluate Response Length Adaptation
  if (!locks.preferredResponseLength) {
    const avgPromptLength =
      observations.reduce((acc, obs) => acc + (obs.promptLength || 0), 0) / observations.length;
    const avgDwellTime =
      observations.reduce((acc, obs) => acc + (obs.dwellTimeMs || 0), 0) / observations.length;

    // Fast dwell (< 3000ms) or consistently brief prompts (< 5 words)
    if (avgPromptLength < 5 || avgDwellTime < 3000) {
      adapted.preferredResponseLength = 'concise';
    } else if (avgPromptLength > 30 || avgDwellTime > 20000) {
      adapted.preferredResponseLength = 'detailed';
    } else {
      adapted.preferredResponseLength = 'balanced';
    }
  }

  // 2. Evaluate Modality Adaptation (TTS Listening & Voice)
  if (!locks.preferredModality) {
    const totalWithAudio = observations.filter((obs) => obs.listenedToAudio).length;
    const totalVoiceInput = observations.filter((obs) => obs.usedVoiceInput).length;
    const audioListenRatio = totalWithAudio / observations.length;
    const voiceInputRatio = totalVoiceInput / observations.length;

    if (audioListenRatio >= 0.6) {
      // If student listens to TTS >= 60% of turns, adapt to audio or hybrid
      adapted.preferredModality = voiceInputRatio >= 0.4 ? 'hybrid' : 'audio';
    } else if (voiceInputRatio >= 0.5) {
      adapted.preferredModality = 'hybrid';
    }
  }

  // 3. Evaluate Interaction Speed Adaptation
  if (!locks.interactionSpeed) {
    const avgDwellTime =
      observations.reduce((acc, obs) => acc + (obs.dwellTimeMs || 0), 0) / observations.length;

    if (avgDwellTime > 0 && avgDwellTime < 2500) {
      adapted.interactionSpeed = 'rapid';
    } else if (avgDwellTime > 12000) {
      adapted.interactionSpeed = 'deliberate';
    } else {
      adapted.interactionSpeed = 'standard';
    }
  }

  // Double check all manual locks: NEVER override any locked preference!
  for (const [key, isLocked] of Object.entries(locks)) {
    if (isLocked && key in currentPrefs) {
      (adapted as any)[key] = (currentPrefs as any)[key];
    }
  }

  return adapted;
}

// ============================================================================
// 5. USER MANUAL PREFERENCE & 100% AGENCY
// ============================================================================

/**
 * Explicitly sets a manual preference choice for the student, with optional manual locking.
 * This guarantees 100% student agency over their assistive AI experience.
 */
export function setUserManualPreference(
  profile: A11yCommunicationProfile,
  key: keyof CommunicationPreferences,
  value: any,
  lock = true
): A11yCommunicationProfile {
  // Validate against non-diagnostic invariant (e.g. user cannot set clinical labels)
  const validation = validateNonDiagnosticInvariant({ [key]: value });
  if (!validation.valid) {
    throw new Error(
      `[Ethical Non-Diagnosis Invariant Violation]: Cannot set preference with diagnostic label: ${validation.violations.join('; ')}`
    );
  }

  const currentPrefs = profile.preferences || createDefaultCommunicationPreferences();
  const currentLocks = { ...(currentPrefs.manualLocks || {}) };

  if (lock) {
    currentLocks[key as string] = true;
  } else {
    delete currentLocks[key as string];
  }

  const updatedPrefs: CommunicationPreferences = {
    ...currentPrefs,
    [key]: value,
    manualLocks: currentLocks,
  };

  return {
    ...profile,
    preferences: updatedPrefs,
    lastAdapted: Date.now(),
  };
}

// ============================================================================
// 6. MULTILINGUAL AI SYSTEM PROMPT DIRECTIVE SYNTHESIS
// ============================================================================

/**
 * Builds dynamic persona directives reflecting the user's active accessibility preferences.
 * Supports English ('en'), Arabic ('ar'), and French ('fr').
 */
export function buildA11ySystemDirectives(
  preferences: CommunicationPreferences,
  lang: 'en' | 'ar' | 'fr' = 'en'
): string {
  enforceNonDiagnosticInvariant(preferences);

  const directives: string[] = [];

  // 1. Response Length Directives
  if (preferences.preferredResponseLength === 'concise') {
    if (lang === 'ar') {
      directives.push('حافظ على إيجاز الردود للغاية، مع استخدام نقاط موجزة وتقليل النصوص الزائدة.');
    } else if (lang === 'fr') {
      directives.push('Gardez des réponses extrêmement concises, en utilisant de brèves puces et un minimum de texte superflu.');
    } else {
      directives.push('Keep responses extremely concise, using brief bullet points and minimal filler text.');
    }
  } else if (preferences.preferredResponseLength === 'detailed') {
    if (lang === 'ar') {
      directives.push('قدم تفسيرات شاملة ومبنية على تدريج معرفي عميق.');
    } else if (lang === 'fr') {
      directives.push('Fournissez des explications complètes et profondément étayées.');
    } else {
      directives.push('Provide comprehensive, deeply scaffolded explanations.');
    }
  } else {
    if (lang === 'ar') {
      directives.push('قدم شروحات متوازنة، واضحة، ومنظمة بدقة دون إطالة غير ضرورية.');
    } else if (lang === 'fr') {
      directives.push('Fournissez des explications équilibrées, claires et bien structurées sans longueur inutile.');
    } else {
      directives.push('Provide balanced, clear, and well-structured explanations without unnecessary length.');
    }
  }

  // 2. Modality Directives
  if (preferences.preferredModality === 'audio') {
    if (lang === 'ar') {
      directives.push('قم بتهيئة الصياغة للإلقاء الصوتي الطبيعي بجمل قصيرة وخالية من الرسوم النصية أو رموز ماركداون المشتتة.');
    } else if (lang === 'fr') {
      directives.push('Optimisez la formulation pour une narration orale naturelle avec des phrases courtes et sans symboles markdown superflus.');
    } else {
      directives.push('Optimize phrasing for natural speech and audio narration with short sentences and no ascii art or markdown clutter.');
    }
  } else if (preferences.preferredModality === 'visual') {
    if (lang === 'ar') {
      directives.push('نظّم المعلومات بصرياً باستخدام تخطيطات واضحة، ورسوم بيانية، وتدرج نقطي بارز.');
    } else if (lang === 'fr') {
      directives.push("Structurez visuellement les informations à l'aide de mises en page claires, de schémas et de listes à puces distinctes.");
    } else {
      directives.push('Structure information visually using clean layouts, diagrams, and distinct bullet hierarchies.');
    }
  } else if (preferences.preferredModality === 'hybrid') {
    if (lang === 'ar') {
      directives.push('اجمع بين العناصر البصرية الواضحة والصياغة الصوتية السلسة المناسبة للقراءة والاستماع في آن واحد.');
    } else if (lang === 'fr') {
      directives.push("Combinez des visuels lisibles avec une formulation fluide adaptée à la lecture et à l'écoute simultanées.");
    } else {
      directives.push('Combine concise readable visuals with natural speech-friendly phrasing suitable for simultaneous reading and listening.');
    }
  }

  // 3. Visual Density Directives
  if (preferences.visualDensity === 'compact') {
    if (lang === 'ar') {
      directives.push('اجعل العرض البصري مقتضباً مع تقليل الفراغات البيضاء.');
    } else if (lang === 'fr') {
      directives.push('Gardez une présentation visuelle compacte avec un espacement minimal.');
    } else {
      directives.push('Keep visual presentation compact with minimal whitespace.');
    }
  } else if (preferences.visualDensity === 'spacious') {
    if (lang === 'ar') {
      directives.push('استخدم مسافات مريحة، وفقرات مجزأة، وفواصل أسطر تعزز سهولة القراءة.');
    } else if (lang === 'fr') {
      directives.push('Utilisez un espacement généreux, des paragraphes aérés et des sauts de ligne favorisant la lisibilité.');
    } else {
      directives.push('Use generous spacing, chunked paragraphs, and high readability line breaks.');
    }
  }

  // 4. Interaction Speed / Pacing
  if (preferences.interactionSpeed === 'deliberate') {
    if (lang === 'ar') {
      directives.push('اعتمد وتيرة تعليمية هادئة وقدم المعلومات خطوة بخطوة مع فترات استيعاب مناسبة.');
    } else if (lang === 'fr') {
      directives.push('Adoptez un rythme posé et présentez les informations étape par étape avec un temps de réflexion suffisant.');
    } else {
      directives.push('Adopt a deliberate pedagogical pace and present information step-by-step with comfortable processing pauses.');
    }
  } else if (preferences.interactionSpeed === 'rapid') {
    if (lang === 'ar') {
      directives.push('قدم الإجابات بسرعة ومباشرة لتناسب وتيرة التفاعل السريعة للطالب.');
    } else if (lang === 'fr') {
      directives.push("Fournissez des réponses directes et rapides pour correspondre au rythme d'interaction fluide de l'étudiant.");
    } else {
      directives.push("Provide swift, direct answers tailored to the student's rapid interaction tempo.");
    }
  }

  // Header and block wrapping
  const header =
    lang === 'ar'
      ? '### توجيهات إمكانية الوصول والتواصل التكيفي (A11y Intelligence Directives):'
      : lang === 'fr'
      ? '### DIRECTIVES D’INTELLIGENCE D’ACCESSIBILITÉ ET DE COMMUNICATION ADAPTATIVE:'
      : '### ACCESSIBILITY INTELLIGENCE & ADAPTIVE COMMUNICATION DIRECTIVES:';

  return `${header}\n${directives.map((d) => `- ${d}`).join('\n')}`;
}
