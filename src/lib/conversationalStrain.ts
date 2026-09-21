/**
 * Conversational Strain & Pedagogical Adaptation Engine (Cognify 2.0 - Pillar 1)
 * 
 * Detects implicit signals of student confusion, misunderstanding, or hesitation
 * in real-time chat messages across Arabic, English, and French.
 * Dynamically re-steers active pedagogy to optimize comprehension.
 */

import { PedagogyStyle } from '../types';

export interface ConversationalStrainResult {
  isConfused: boolean;
  severity: 'mild' | 'severe';
  detectedSignals: string[];
  recommendedPedagogy: PedagogyStyle;
  reasonEn: string;
  reasonAr: string;
  reasonFr: string;
  reason?: string;
}

const CONFUSION_PATTERNS = {
  ar: [
    // Direct confusion
    /(?:^|[^\p{L}\p{N}])(مش فاهم|مش فاهمة|مش فاهم حاجة|مش مستوعب|مش واضحة|مش مفهومة|مش راكبة معايا)(?:[^\p{L}\p{N}]|$)/iu,
    /(?:^|[^\p{L}\p{N}])(ليه كده|طب ليه|ازاي يعني|إزاي ده حصل|فهمني تاني|عيد تاني|اشرح تاني)(?:[^\p{L}\p{N}]|$)/iu,
    /(?:^|[^\p{L}\p{N}])(صعبة اوي|صعبة جدا|معقدة|تلخبطت|لخبطتني|حاسس اني تايه|تهت منك)(?:[^\p{L}\p{N}]|$)/iu,
    /(?:^|[^\p{L}\p{N}])(ممكن تبسط|بسطهالي|على مهلك|واحدة واحدة|بالتفصيل بالراحة|خطوة بخطوة)(?:[^\p{L}\p{N}]|$)/iu,
  ],
  en: [
    /(?:^|[^\p{L}\p{N}])(i don'?t (?:get|understand|follow)|still don'?t understand|doesn'?t make sense)(?:[^\p{L}\p{N}]|$)/iu,
    /(?:^|[^\p{L}\p{N}])(this is (?:so )?(?:confusing|hard|difficult|complicated)|i'?m (?:totally )?(?:lost|confused))(?:[^\p{L}\p{N}]|$)/iu,
    /(?:^|[^\p{L}\p{N}])(can you (?:explain|simplify|break down)|explain (?:it )?simpler|make it simpler)(?:[^\p{L}\p{N}]|$)/iu,
    /(?:^|[^\p{L}\p{N}])(wait,? why|why did that happen|what do you mean|how come)(?:[^\p{L}\p{N}]|$)/iu,
    /(?:^|[^\p{L}\p{N}])(one step at a time|step by step please|can you repeat)(?:[^\p{L}\p{N}]|$)/iu,
  ],
  fr: [
    /(?:^|[^\p{L}\p{N}])(je ne comprends pas|j'?ai pas compris|ce n'?est pas clair|c'?est pas clair)(?:[^\p{L}\p{N}]|$)/iu,
    /(?:^|[^\p{L}\p{N}])(c'?est (?:trop )?(?:difficile|compliqué)|je suis (?:un peu )?perdu)(?:[^\p{L}\p{N}]|$)/iu,
    /(?:^|[^\p{L}\p{N}])(peux-tu (?:m'?expliquer|simplifier)|explique plus simplement|pas à pas)(?:[^\p{L}\p{N}]|$)/iu,
    /(?:^|[^\p{L}\p{N}])(pourquoi donc|comment ça|qu'?est-ce que tu veux dire)(?:[^\p{L}\p{N}]|$)/iu,
  ],
};

/**
 * Detects if a student chat message indicates confusion, struggle, or a request for simplification.
 */
export function detectConversationalStrain(
  text: string,
  currentPedagogy: PedagogyStyle = 'scaffolded'
): ConversationalStrainResult {
  if (!text || typeof text !== 'string') {
    return {
      isConfused: false,
      severity: 'mild',
      detectedSignals: [],
      recommendedPedagogy: currentPedagogy,
      reasonEn: '',
      reasonAr: '',
      reasonFr: '',
    };
  }

  const clean = text.trim();
  const detectedSignals: string[] = [];
  let matchCount = 0;

  // Test Arabic patterns
  for (const pattern of CONFUSION_PATTERNS.ar) {
    if (pattern.test(clean)) {
      matchCount++;
      detectedSignals.push(`ar_pattern:${pattern.source.slice(0, 20)}`);
    }
  }

  // Test English patterns
  for (const pattern of CONFUSION_PATTERNS.en) {
    if (pattern.test(clean)) {
      matchCount++;
      detectedSignals.push(`en_pattern:${pattern.source.slice(0, 20)}`);
    }
  }

  // Test French patterns
  for (const pattern of CONFUSION_PATTERNS.fr) {
    if (pattern.test(clean)) {
      matchCount++;
      detectedSignals.push(`fr_pattern:${pattern.source.slice(0, 20)}`);
    }
  }

  const isConfused = matchCount > 0;
  const severity: 'mild' | 'severe' = matchCount >= 2 ? 'severe' : 'mild';

  if (!isConfused) {
    return {
      isConfused: false,
      severity: 'mild',
      detectedSignals: [],
      recommendedPedagogy: currentPedagogy,
      reasonEn: '',
      reasonAr: '',
      reasonFr: '',
    };
  }

  // Determine optimal pedagogy pivot when student struggles
  let recommendedPedagogy: PedagogyStyle = 'analogies';
  let reasonEn = 'Auto-adapted to Visual Analogies to anchor difficult concepts in real-world models.';
  let reasonAr = 'تم التكيف تلقائياً لضرب الأمثلة الواقعية لتقريب المفهوم وتثبيته.';
  let reasonFr = 'Adaptation automatique vers des analogies concrètes pour faciliter la compréhension.';

  if (currentPedagogy === 'socratic' || currentPedagogy === 'technical') {
    // Socratic / Deep Technical are too taxing during high strain -> switch to Analogies or Step-by-Step
    if (severity === 'severe') {
      recommendedPedagogy = 'scaffolded';
      reasonEn = 'High cognitive strain detected. Auto-switched from rigorous inquiry to Step-by-Step Scaffolding.';
      reasonAr = 'رصد مؤشر حيرة مرتفع. تم التحول من الحوار الاستنتاجي إلى التفكيك التدريجي خطوة بخطوة.';
      reasonFr = 'Forte charge cognitive détectée. Passage du dialogue socratique au guidage étape par étape.';
    } else {
      recommendedPedagogy = 'analogies';
      reasonEn = 'Cognitive hesitation detected. Auto-pivoted to Visual Analogies for intuitive grounding.';
      reasonAr = 'رصد حيرة في الاستيعاب. تم التحول إلى الأمثلة التوضيحية لتبسيط الفكرة الأساسية.';
      reasonFr = 'Hésitation détectée. Passage aux analogies visuelles pour un ancrage intuitif.';
    }
  } else if (currentPedagogy === 'analogies') {
    // If already using analogies and still struggling -> switch to scaffolded step-by-step
    recommendedPedagogy = 'scaffolded';
    reasonEn = 'Persistent struggle detected. Pivoted to structured Step-by-Step Scaffolding.';
    reasonAr = 'استمرار صعوبة الفهم. تم التحول إلى التفكيك التدريجي خطوة بخطوة.';
    reasonFr = 'Difficulté persistante. Passage au guidage structuré étape par étape.';
  } else {
    // Default fallback to scaffolded
    recommendedPedagogy = 'scaffolded';
    reasonEn = 'Deconstructed into sequential micro-steps to remove learning hurdles.';
    reasonAr = 'تم تفكيك المسألة إلى خطوات متتالية لإزالة عقبات الفهم.';
    reasonFr = 'Décomposition en micro-étapes séquentielles pour lever les blocages.';
  }

  return {
    isConfused: true,
    severity,
    detectedSignals,
    recommendedPedagogy,
    reasonEn,
    reasonAr,
    reasonFr,
    reason: reasonEn,
  };
}
