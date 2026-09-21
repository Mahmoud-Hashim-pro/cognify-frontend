/**
 * Retention & Spaced Learning Product Engine
 * Milestone 9: Retention & Spaced Learning Product Engine
 *
 * Implements:
 * 1. Ebbinghaus exponential decay risk modeling
 * 2. Strict 4-category partitioning (Due Today, At Risk, Mastered, Upcoming) with zero overlap
 * 3. Multilingual high-yield conceptual Micro-Review generator (EN, AR, FR)
 * 4. Latency-aware SM-2 micro-review submission evaluator
 */

import {
  RetentionSchedule,
  calculateNextReview,
  isDueForReview,
} from './spacedRetention';
import { getConcept, CONCEPT_REGISTRY } from './conceptGraph';
import type {
  RetentionItem,
  RetentionDashboardData,
  MicroReviewQuestion,
  MicroReviewSubmission,
  MicroReviewResult,
  MicroReviewOption,
} from '../types/retention';

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolves a human-friendly concept title, preferring conceptGraph registry when available.
 */
export function resolveConceptTitle(
  conceptId: string,
  lang: 'en' | 'ar' | 'fr' = 'en'
): string {
  const node = getConcept(conceptId);
  if (node) {
    if (lang === 'ar' && node.nameAr) return node.nameAr;
    return node.nameEn;
  }

  // Formatting fallback for raw IDs (e.g., 'object_oriented' -> 'Object Oriented')
  return conceptId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Computes the memory decay risk according to the Ebbinghaus exponential forgetting curve:
 * R = e^(-elapsedDays / max(1, intervalDays * easeFactor))
 * Risk = clamp(1 - R, 0, 1)
 *
 * @param schedule The current spaced retention schedule
 * @param now Reference timestamp (defaults to Date.now())
 * @returns Risk score from 0.0 (fresh / perfectly retained) to 1.0 (critically decayed)
 */
export function computeRetentionDecayRisk(
  schedule: RetentionSchedule,
  now?: number
): number {
  if (!schedule) return 1.0;

  const currentTime = typeof now === 'number' ? now : Date.now();
  const lastReview = schedule.lastReviewDate || currentTime;
  const elapsedDays = Math.max(0, (currentTime - lastReview) / ONE_DAY_MS);

  const interval = schedule.intervalDays > 0 ? schedule.intervalDays : 1;
  const ease = schedule.easeFactor > 0 ? schedule.easeFactor : 2.5;
  const stability = Math.max(1, interval * ease);

  const retention = Math.exp(-elapsedDays / stability);
  const risk = Math.max(0, Math.min(1, 1 - retention));

  return Math.round(risk * 10000) / 10000;
}

/**
 * Categorizes student retention schedules into 4 strictly disjoint buckets (zero overlap):
 * - dueToday: schedules where now >= nextReviewDate AND now - nextReviewDate < 86400000 (1 day).
 * - atRisk: schedules overdue by >= 1 day OR retentionRiskScore >= 0.65.
 * - mastered: repetitions >= 3 AND status === 'retained' AND retentionRiskScore < 0.35.
 * - upcoming: everything else scheduled in future.
 *
 * @param schedules Map of concept ID to RetentionSchedule
 * @param studentState Optional full student state for context
 * @param now Reference timestamp (defaults to Date.now())
 */
export function categorizeRetentionState(
  schedules: Record<string, RetentionSchedule> = {},
  _studentState?: unknown,
  now?: number
): RetentionDashboardData {
  const currentTime = typeof now === 'number' ? now : Date.now();

  const dueToday: RetentionItem[] = [];
  const upcoming: RetentionItem[] = [];
  const mastered: RetentionItem[] = [];
  const atRisk: RetentionItem[] = [];

  for (const schedule of Object.values(schedules)) {
    if (!schedule || !schedule.conceptId) continue;

    const retentionRiskScore = computeRetentionDecayRisk(schedule, currentTime);
    const overdueMs = currentTime - schedule.nextReviewDate;
    const daysOverdue = overdueMs > 0 ? Math.round((overdueMs / ONE_DAY_MS) * 10) / 10 : 0;

    const item: RetentionItem = {
      conceptId: schedule.conceptId,
      conceptTitle: resolveConceptTitle(schedule.conceptId),
      repetitions: schedule.repetitions,
      intervalDays: schedule.intervalDays,
      easeFactor: schedule.easeFactor,
      lastReviewDate: schedule.lastReviewDate,
      nextReviewDate: schedule.nextReviewDate,
      status: schedule.status,
      retentionRiskScore,
      daysOverdue,
    };

    // 1. At Risk: Overdue by >= 24h OR high memory decay risk (>= 0.65)
    if (overdueMs >= ONE_DAY_MS || retentionRiskScore >= 0.65) {
      atRisk.push(item);
    }
    // 2. Due Today: Currently due (now >= nextReviewDate) and not yet overdue by 24h
    else if (currentTime >= schedule.nextReviewDate) {
      dueToday.push(item);
    }
    // 3. Mastered: Future scheduled, verified retention (>= 3 reps, retained status, low risk < 0.35)
    else if (schedule.repetitions >= 3 && schedule.status === 'retained' && retentionRiskScore < 0.35) {
      mastered.push(item);
    }
    // 4. Upcoming: Everything else scheduled in future
    else {
      upcoming.push(item);
    }
  }

  return {
    dueToday,
    upcoming,
    mastered,
    atRisk,
  };
}

/**
 * Core High-Yield Conceptual Question Bank for Micro-Reviews
 */
const CORE_MICRO_REVIEWS: Record<string, MicroReviewQuestion> = {
  pointers: {
    conceptId: 'pointers',
    conceptTitle: 'Pointers & Dereferencing',
    promptEn: 'What does the dereference operator `*ptr` evaluate to when `ptr` holds the memory address of an integer variable `x`?',
    promptAr: 'إلى ماذا يشير معامل فك الإشارة `*ptr` عندما يحتوي المؤشر `ptr` على عنوان متغير صحيح `x` في الذاكرة؟',
    promptFr: "À quoi correspond l'opérateur de déréférencement `*ptr` lorsque `ptr` contient l'adresse mémoire d'une variable entière `x` ?",
    questionType: 'multiple_choice',
    options: [
      {
        textEn: 'The value stored in the memory location of x',
        textAr: 'القيمة الفعلية المخزنة في عنوان الذاكرة الخاص بالمتغير x',
        textFr: 'La valeur stockée à l\'emplacement mémoire de x',
      },
      {
        textEn: 'The hexadecimal memory address of ptr itself',
        textAr: 'عنوان الذاكرة الست عشري للمؤشر ptr نفسه',
        textFr: 'L\'adresse mémoire hexadécimale de ptr lui-même',
      },
      {
        textEn: 'The size in bytes of the integer variable',
        textAr: 'حجم المتغير الصحيح بالبايت في الذاكرة',
        textFr: 'La taille en octets de la variable entière',
      },
      {
        textEn: 'A null pointer reference exception',
        textAr: 'استثناء مؤشر فارغ Null Pointer Exception',
        textFr: 'Une exception de référence de pointeur null',
      },
    ],
    correctIndex: 0,
    explanationEn: 'Dereferencing a pointer using `*ptr` directly reads or modifies the value stored at the memory address referenced by `ptr`.',
    explanationAr: 'فك إشارة المؤشر باستخدام `*ptr` يصل مباشرة للقيمة الفعلية المخزنة في العنوان الذي يشير إليه المؤشر.',
    explanationFr: 'Déréférencer un pointeur avec `*ptr` accède directement à la valeur stockée à l\'adresse pointée par `ptr`.',
  },

  recursion: {
    conceptId: 'recursion',
    conceptTitle: 'Recursion & Call Stack Depth',
    promptEn: 'What is the critical failure mode when a recursive function lacks an appropriate base case?',
    promptAr: 'ما هو الخطر الحتمي عند استدعاء دالة عودية (Recursive) تفتقر إلى حالة أساسية (Base Case) صحيحة؟',
    promptFr: 'Quel est le risque critique lorsqu\'une fonction récursive ne possède pas de cas de base approprié ?',
    questionType: 'multiple_choice',
    options: [
      {
        textEn: 'Infinite recursive calls exhausting stack frames leading to a Stack Overflow',
        textAr: 'استدعاءات لا نهائية تستنزف إطارات المكدس مما يؤدي إلى طفحان المكدس (Stack Overflow)',
        textFr: 'Appels récursifs infinis épuisant les trames de pile menant à un Stack Overflow',
      },
      {
        textEn: 'Compiler static type check rejection at build time',
        textAr: 'رفض المترجم للكود أثناء فحص الأنواع الثابت قبل التشغيل',
        textFr: 'Rejet lors de la vérification statique des types à la compilation',
      },
      {
        textEn: 'Immediate heap memory fragmentation without stack growth',
        textAr: 'تجزئة فورية لذاكرة الركام Heap دون التأثير على المكدس',
        textFr: 'Fragmentation immédiate du tas sans croissance de la pile',
      },
      {
        textEn: 'Silent conversion of local variables into global variables',
        textAr: 'تحويل صامت للمتغيرات المحلية إلى متغيرات عامة Global',
        textFr: 'Conversion silencieuse des variables locales en globales',
      },
    ],
    correctIndex: 0,
    explanationEn: 'A base case provides the termination invariant. Without it, each call allocates a new stack frame until the process call stack is exhausted.',
    explanationAr: 'توفر الحالة الأساسية شرط التوقف الحتمي. بدونها، يتم حجز إطار جديد في مكدس النداء مع كل تكرار حتى ينفد المكدس تماماً.',
    explanationFr: 'Le cas de base fournit la condition d\'arrêt. Sans lui, des trames de pile s\'accumulent jusqu\'à épuisement de la mémoire de pile.',
  },

  dynamic_memory: {
    conceptId: 'dynamic_memory',
    conceptTitle: 'Dynamic Memory Allocation',
    promptEn: 'Which condition triggers a memory leak in dynamic heap allocation?',
    promptAr: 'أي من الحالات التالية تتسبب في حدوث تسريب في الذاكرة (Memory Leak) في الركام Heap؟',
    promptFr: 'Quelle situation provoque une fuite de mémoire (memory leak) lors d\'une allocation dynamique sur le tas ?',
    questionType: 'multiple_choice',
    options: [
      {
        textEn: 'Allocating heap memory and losing all referencing pointers without deallocating (free/delete)',
        textAr: 'حجز مساحة في الركام Heap وفقدان جميع المؤشرات المؤدية إليها دون تحريرها (free/delete)',
        textFr: 'Allouer de la mémoire sur le tas et perdre tout pointeur sans libération préalable (free/delete)',
      },
      {
        textEn: 'Allocating local primitive variables inside a function scope on the stack',
        textAr: 'تعريف متغيرات أولية محلية داخل نطاق دالة في مكدس الذاكرة Stack',
        textFr: 'Allouer des variables primitives locales sur la pile dans une fonction',
      },
      {
        textEn: 'Casting a generic pointer into a concrete typed struct pointer safely',
        textAr: 'تحويل نوع مؤشر عام إلى مؤشر هيكل بيانات محدد بأمان',
        textFr: 'Caster un pointeur générique vers un pointeur de structure typée',
      },
      {
        textEn: 'Reading an array element within its valid boundary indices',
        textAr: 'قراءة عنصر من المصفوفة ضمن حدود الفهرسة الصحيحة',
        textFr: 'Lire un élément de tableau dans ses limites autorisées',
      },
    ],
    correctIndex: 0,
    explanationEn: 'A memory leak occurs when heap memory remains allocated but is no longer accessible because all references to it have been overwritten or lost.',
    explanationAr: 'يحدث تسريب الذاكرة عندما تظل المساحة محجوزة في Heap بينما يفقد البرنامج جميع الروابط والمؤشرات إليها، فلا يمكن الوصول إليها أو تحريرها.',
    explanationFr: 'Une fuite de mémoire survient lorsque de la mémoire tas reste allouée mais n\'est plus accessible car tous les pointeurs vers elle ont été perdus.',
  },

  variables_types: {
    conceptId: 'variables_types',
    conceptTitle: 'Variables & Data Types',
    promptEn: 'In statically typed systems, what is the primary role of declaring a variable data type?',
    promptAr: 'في الأنظمة البرمجية ثابتة التحديد (Statically Typed)، ما هو الدور الأساسي لتحديد نوع بيانات المتغير؟',
    promptFr: 'Dans les systèmes à typage statique, quel est le rôle fondamental de la déclaration du type de variable ?',
    questionType: 'multiple_choice',
    options: [
      {
        textEn: 'It defines the memory footprint (bytes allocated) and dictates how bit patterns are interpreted',
        textAr: 'يحدد حجم الذاكرة المطلوب (عدد البايتات) وكيفية تفسير الأنماط الثنائية كأرقام أو نصوص',
        textFr: 'Il définit l\'empreinte mémoire (octets alloués) et la manière dont les bits sont interprétés',
      },
      {
        textEn: 'It dictates the visual rendering color of the variable in the IDE editor',
        textAr: 'يحدد لون ظهور اسم المتغير في محرر النصوص البرمجية فقط',
        textFr: 'Il détermine la couleur de rendu dans l\'éditeur de code',
      },
      {
        textEn: 'It automatically writes the variable value to permanent disk storage',
        textAr: 'يقوم بالحفظ التلقائي لقيمة المتغير في القرص الصلب الدائم',
        textFr: 'Il sauvegarde automatiquement la valeur sur le disque permanent',
      },
      {
        textEn: 'It limits the variable name length to 8 alphanumeric characters',
        textAr: 'يقيد طول اسم المتغير بـ 8 أحرف وأرقام كحد أقصى',
        textFr: 'Il limite la longueur du nom de variable à 8 caractères',
      },
    ],
    correctIndex: 0,
    explanationEn: 'The data type dictates both the byte size reserved in RAM and the arithmetic operations and encoding applied to the underlying bits.',
    explanationAr: 'نوع البيانات يحدد عدد البايتات المحجوزة في الذاكرة والعمليات الرياضية والمنطقية المسموح بتطبيقها على تلك البتات.',
    explanationFr: 'Le type de données dicte la taille en octets allouée et la sémantique de traitement des bits sous-jacents.',
  },

  arrays_strings: {
    conceptId: 'arrays_strings',
    conceptTitle: 'Arrays & Strings',
    promptEn: 'Why does indexing an array element `arr[i]` execute in strictly O(1) constant time?',
    promptAr: 'لماذا يستغرق الوصول إلى عنصر في المصفوفة عبر الفهرس `arr[i]` زمناً ثابتاً O(1) بدقة؟',
    promptFr: 'Pourquoi l\'accès indexé à un tableau `arr[i]` s\'exécute-t-il strictement en temps constant O(1) ?',
    questionType: 'multiple_choice',
    options: [
      {
        textEn: 'Elements reside in contiguous memory, allowing immediate calculation: base_address + (i * element_size)',
        textAr: 'العناصر متجاورة في الذاكرة، مما يتيح حساب العنوان فوراً بمعادلة: العنوان الأساسي + (الفهرس * حجم العنصر)',
        textFr: 'Les éléments sont contigus, permettant le calcul direct : adresse_base + (i * taille_élément)',
      },
      {
        textEn: 'The computer executes a logarithmic binary tree traversal for each lookup',
        textAr: 'يقوم الحاسوب بالبحث في شجرة ثنائية لوغاريتمية مع كل عملية استعلام',
        textFr: 'L\'ordinateur effectue un parcours d\'arbre binaire logarithmique à chaque recherche',
      },
      {
        textEn: 'Array elements are always stored across network cache clusters',
        textAr: 'عناصر المصفوفة موزعة دائماً عبر خوادم شبكية سريعة',
        textFr: 'Les éléments de tableau sont distribués sur des clusters réseau',
      },
      {
        textEn: 'Array lookups use sequential linear iteration starting from index zero',
        textAr: 'عمليات الاستعلام تتطلب تكراراً خطياً يبدأ دائماً من العنصر الأول',
        textFr: 'La recherche utilise une itération linéaire séquentielle depuis l\'index 0',
      },
    ],
    correctIndex: 0,
    explanationEn: 'Contiguous memory layout enables direct address arithmetic in one multiplication and addition, giving O(1) random access.',
    explanationAr: 'التجاور في الذاكرة يسمح بحساب عنوان الخلية مباشرة بعملية ضرب وجمع واحدة دون الحاجة لأي مسح أو تكرار.',
    explanationFr: 'La contiguïté mémoire permet un calcul d\'adresse arithmétique direct en temps constant O(1).',
  },

  object_oriented: {
    conceptId: 'object_oriented',
    conceptTitle: 'Object-Oriented Programming',
    promptEn: 'Which core object-oriented principle encapsulates internal state and protects invariants by requiring access via controlled methods?',
    promptAr: 'أي مبدأ من المبادئ كائنية التوجه يركز على حماية البيانات وتغليف الحالة الداخلية وجعل الوصول عبر دوال محددة؟',
    promptFr: 'Quel principe fondamental de la POO encapsule l\'état interne et protège l\'intégrité via des méthodes contrôlées ?',
    questionType: 'multiple_choice',
    options: [
      {
        textEn: 'Encapsulation & Data Hiding',
        textAr: 'التغليف وإخفاء البيانات (Encapsulation)',
        textFr: 'Encapsulation et masquage des données',
      },
      {
        textEn: 'Arbitrary Multiple Inheritance',
        textAr: 'الوراثة المتعددة غير المقيدة',
        textFr: 'Héritage multiple arbitraire',
      },
      {
        textEn: 'Unchecked Pointer Arithmetic',
        textAr: 'العمليات الحسابية المباشرة على المؤشرات',
        textFr: 'Arithmétique des pointeurs non vérifiée',
      },
      {
        textEn: 'Static Global Variable Mutation',
        textAr: 'تعديل المتغيرات العامة الثابتة',
        textFr: 'Mutation des variables globales statiques',
      },
    ],
    correctIndex: 0,
    explanationEn: 'Encapsulation bundles data and behaviors while restricting external access to internal representations, maintaining component integrity.',
    explanationAr: 'التغليف يجمع البيانات والعمليات المرتبطة بها ويمنع التلاعب العشوائي بالحالة الداخلية من خارج الفئة.',
    explanationFr: 'L\'encapsulation regroupe état et comportement tout en restreignant l\'accès direct aux composants internes.',
  },
};

/**
 * Generates an adaptive conceptual Micro-Review question.
 * Supports core concepts ('pointers', 'recursion', 'dynamic_memory', 'variables_types', 'arrays_strings', 'object_oriented')
 * and includes a resilient pedagogical fallback for arbitrary concept IDs.
 */
export function generateMicroReview(
  conceptId: string,
  _lang?: 'en' | 'ar' | 'fr'
): MicroReviewQuestion {
  const normalizedId = (conceptId || '').toLowerCase().trim();

  // Direct match in high-yield core registry
  if (CORE_MICRO_REVIEWS[normalizedId]) {
    return CORE_MICRO_REVIEWS[normalizedId];
  }

  // Check for common alias keys
  for (const [key, q] of Object.entries(CORE_MICRO_REVIEWS)) {
    if (normalizedId.includes(key) || key.includes(normalizedId)) {
      return {
        ...q,
        conceptId,
        conceptTitle: resolveConceptTitle(conceptId),
      };
    }
  }

  // Resilient pedagogical fallback for arbitrary concepts
  const conceptTitle = resolveConceptTitle(conceptId, 'en');
  const conceptTitleAr = resolveConceptTitle(conceptId, 'ar');
  const conceptNode = getConcept(conceptId);

  return {
    conceptId,
    conceptTitle,
    promptEn: `What is the fundamental architectural principle governing ${conceptTitle}?`,
    promptAr: `ما هو المبدأ الهيكلي الأساسي الذي يحكم مفهوم ${conceptTitleAr}؟`,
    promptFr: `Quel est le principe architectural fondamental qui régit ${conceptTitle} ?`,
    questionType: 'multiple_choice',
    options: [
      {
        textEn: conceptNode?.descriptionEn || `Core foundational invariance and predictable execution rules of ${conceptTitle}`,
        textAr: conceptNode?.descriptionAr || `القواعد الأساسية وثبات التنفيذ لمفهوم ${conceptTitleAr}`,
        textFr: `Règles fondamentales d'invariance et d'exécution prévisible de ${conceptTitle}`,
      },
      {
        textEn: 'Uncontrolled random access bypassing memory bounds and safeguards',
        textAr: 'الوصول العشوائي غير المقيد وتجاوز حواجز الحماية في الذاكرة',
        textFr: 'Accès aléatoire non contrôlé contournant les limites de mémoire',
      },
      {
        textEn: 'Ignoring computational complexity limits and algorithm cost profiles',
        textAr: 'تجاهل قيود التعقيد الحسابي وتكاليف استهلاك الموارد للخوارزميات',
        textFr: 'Ignorer les contraintes de complexité computationnelle',
      },
      {
        textEn: 'Deprecating all deterministic structures in favor of arbitrary side-effects',
        textAr: 'إلغاء الهياكل المحددة واستبدالها بتأثيرات جانبية غير متوقعة',
        textFr: 'Abandonner les structures déterministes au profit d\'effets de bord',
      },
    ],
    correctIndex: 0,
    explanationEn: `Mastery of ${conceptTitle} requires understanding its theoretical invariants, correct resource usage, and predictable deterministic execution.`,
    explanationAr: `إتقان ${conceptTitleAr} يتطلب استيعاب مبادئه النظرية السليمة والاستخدام المنضبط لموارد النظام والتنفيذ الحتمي.`,
    explanationFr: `La maîtrise de ${conceptTitle} repose sur la compréhension de ses invariants fondamentaux et de son exécution déterministe.`,
  };
}

/**
 * Evaluates a MicroReview submission against latency-aware SM-2 scoring rules:
 * - Correct + responseTimeMs < 12000 => 5 (instant fluency)
 * - Correct + responseTimeMs < 25000 => 4 (steady correct recall)
 * - Correct + responseTimeMs >= 25000 => 3 (slow / labored correct recall)
 * - Incorrect + responseTimeMs < 30000 => 2 (incorrect with effort)
 * - Incorrect + responseTimeMs >= 30000 => 1 (blackout / timeout)
 *
 * Then invokes calculateNextReview to advance the longitudinal SM-2 interval.
 */
export function evaluateMicroReviewSubmission(
  submission: MicroReviewSubmission,
  currentSchedule: RetentionSchedule
): MicroReviewResult {
  const question = generateMicroReview(submission.conceptId);
  const isCorrect = submission.selectedIndex === question.correctIndex;
  const latency = Math.max(0, submission.responseTimeMs || 0);

  let qualityScore: number;
  if (isCorrect) {
    if (latency < 12000) {
      qualityScore = 5;
    } else if (latency < 25000) {
      qualityScore = 4;
    } else {
      qualityScore = 3;
    }
  } else {
    if (latency < 30000) {
      qualityScore = 2;
    } else {
      qualityScore = 1;
    }
  }

  // Fallback if currentSchedule is missing
  const safeSchedule: RetentionSchedule = currentSchedule || {
    conceptId: submission.conceptId,
    repetitions: 0,
    intervalDays: 1,
    easeFactor: 2.5,
    lastReviewDate: Date.now(),
    nextReviewDate: Date.now() + ONE_DAY_MS,
    status: 'new',
  };

  const updatedSchedule = calculateNextReview(safeSchedule, qualityScore);

  return {
    conceptId: submission.conceptId,
    isCorrect,
    qualityScore,
    previousIntervalDays: safeSchedule.intervalDays,
    newIntervalDays: updatedSchedule.intervalDays,
    nextReviewDate: updatedSchedule.nextReviewDate,
    updatedEaseFactor: updatedSchedule.easeFactor,
    status: updatedSchedule.status,
  };
}

/**
 * High-level helper summarizing aggregate dashboard metrics for UI presentation
 */
export function getRetentionDashboardMetrics(data: RetentionDashboardData) {
  const total = data.dueToday.length + data.upcoming.length + data.mastered.length + data.atRisk.length;
  const masteredCount = data.mastered.length;
  const masteryRate = total > 0 ? Math.round((masteredCount / total) * 100) : 0;

  return {
    totalTracked: total,
    dueTodayCount: data.dueToday.length,
    atRiskCount: data.atRisk.length,
    masteredCount,
    upcomingCount: data.upcoming.length,
    masteryRate,
  };
}
