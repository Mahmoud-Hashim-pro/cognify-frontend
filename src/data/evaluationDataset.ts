/**
 * Comprehensive Benchmark Evaluation Dataset for Cognify 2.0 (Phase B - Requirements 11 & 12)
 *
 * Implements:
 * 1. Benchmark items across 4 academic domains:
 *    - Computer Science / Algorithms
 *    - Web Development
 *    - Mathematics / Calculus
 *    - Accessibility & Inclusive Tech
 * 2. Multi-language parity (Arabic, English, French).
 * 3. Full Bloom taxonomy scaffolding: remember, understand, apply, analyze, evaluate, create.
 * 4. Error diagnoses for common distractors.
 * 5. Automatic concept graph registration for cross-domain prerequisite tracking.
 * 6. Helper functions:
 *    - getDatasetByDomain(domain)
 *    - getDatasetByConcept(conceptId)
 *    - getQuestionsForLanguage(lang)
 *    - getPrerequisiteChain(conceptId)
 */

import { CONCEPT_REGISTRY, ConceptNode } from '../lib/conceptGraph.js';

export type EvaluationDomain =
  | 'computer_science'
  | 'web_development'
  | 'mathematics'
  | 'accessibility';

export type EvaluationDifficulty = 'foundational' | 'intermediate' | 'advanced';

export type BloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';

export interface DistractorDiagnosis {
  choiceIndex: number;
  misconception: string;
  errorDiagnosis: string;
}

export interface LanguageQuestionContent {
  question: string;
  choices: string[];
}

export interface EvaluationItem {
  id: string;
  domain: EvaluationDomain;
  conceptId: string;
  prerequisiteConceptId?: string;
  difficulty: EvaluationDifficulty;
  bloomLevel: BloomLevel;
  languages: {
    ar: LanguageQuestionContent;
    en: LanguageQuestionContent;
    fr: LanguageQuestionContent;
  };
  correctAnswerIndex: number;
  explanation: string;
  explanations?: {
    ar: string;
    en: string;
    fr: string;
  };
  commonDistractors: DistractorDiagnosis[];
}

export interface LocalizedEvaluationQuestion {
  id: string;
  domain: EvaluationDomain;
  conceptId: string;
  prerequisiteConceptId?: string;
  difficulty: EvaluationDifficulty;
  bloomLevel: BloomLevel;
  language: 'ar' | 'en' | 'fr';
  question: string;
  choices: string[];
  correctAnswerIndex: number;
  explanation: string;
  commonDistractors: DistractorDiagnosis[];
}

/**
 * Register web development and accessibility concepts into CONCEPT_REGISTRY
 * so that diagnosePrerequisiteGap and concept graph queries seamlessly work across all 4 domains.
 */
const ADDITIONAL_CONCEPTS: Record<string, ConceptNode> = {
  // Web Development
  html_basics: {
    id: 'html_basics',
    nameEn: 'HTML5 & Document Structure',
    nameAr: 'أساسيات HTML5 وهيكلة المستند',
    domain: 'general',
    difficultyTier: 1,
    prerequisites: [],
    descriptionEn: 'Core tags, elements, DOM tree hierarchy, and semantic scaffolding.',
    descriptionAr: 'العناصر الأساسية لهيكلة صفحات الويب وشجرة المستند.',
  },
  css_box_model: {
    id: 'css_box_model',
    nameEn: 'CSS Box Model & Layout',
    nameAr: 'نموذج الصندوق في CSS والتخطيط',
    domain: 'general',
    difficultyTier: 2,
    prerequisites: ['html_basics'],
    descriptionEn: 'Content, padding, border, margin, and box-sizing computations.',
    descriptionAr: 'المحتوى، الحشو، الحدود، والهوامش وحسابات أبعاد الصناديق.',
  },
  dom_manipulation: {
    id: 'dom_manipulation',
    nameEn: 'DOM Manipulation & Events',
    nameAr: 'التعامل مع شجرة العناصر والأحداث',
    domain: 'general',
    difficultyTier: 2,
    prerequisites: ['html_basics'],
    descriptionEn: 'Element selection, mutation, event bubbling, and delegation.',
    descriptionAr: 'تعديل عناصر الصفحة برمجياً وإدارة أحداث المستخدم.',
  },
  javascript_async: {
    id: 'javascript_async',
    nameEn: 'Asynchronous JavaScript & Promises',
    nameAr: 'الجافاسكريبت غير المتزامن والوعود',
    domain: 'general',
    difficultyTier: 3,
    prerequisites: ['dom_manipulation'],
    descriptionEn: 'Event loop, call stack, microtasks, promises, and async/await.',
    descriptionAr: 'حلقة الأحداث، الوعود، والعمليات غير المتزامنة في المتصفح.',
  },
  rest_apis: {
    id: 'rest_apis',
    nameEn: 'REST APIs & Fetch/HTTP',
    nameAr: 'واجهات برمجة التطبيقات والتعامل مع الشبكة',
    domain: 'general',
    difficultyTier: 4,
    prerequisites: ['javascript_async'],
    descriptionEn: 'HTTP verbs, status codes, request headers, payload serialization, and caching.',
    descriptionAr: 'بروتوكول HTTP واستدعاء الخدمات الخارجية ومعالجة البيانات.',
  },

  // Accessibility & Inclusive Tech
  a11y_fundamentals: {
    id: 'a11y_fundamentals',
    nameEn: 'Accessibility Fundamentals & WCAG',
    nameAr: 'مبادئ إمكانية الوصول ومعايير WCAG',
    domain: 'general',
    difficultyTier: 1,
    prerequisites: [],
    descriptionEn: 'POUR principles, disability models, and inclusive design foundations.',
    descriptionAr: 'المبادئ الأساسية لشمول ذوي الإعاقة ومعايير الوصول الرقمي.',
  },
  semantic_html: {
    id: 'semantic_html',
    nameEn: 'Semantic HTML & Landmark Roles',
    nameAr: 'عناصر HTML الدلالية والأدوار الهيكلية',
    domain: 'general',
    difficultyTier: 2,
    prerequisites: ['a11y_fundamentals'],
    descriptionEn: 'Native buttons, form inputs, headings, lists, and landmark regions.',
    descriptionAr: 'استخدام الوسوم الدلالية الصحيحة لتمكين التقنيات المساعدة.',
  },
  aria_standards: {
    id: 'aria_standards',
    nameEn: 'WAI-ARIA Roles, States & Properties',
    nameAr: 'معايير WAI-ARIA والحالات والخصائص',
    domain: 'general',
    difficultyTier: 3,
    prerequisites: ['semantic_html'],
    descriptionEn: 'ARIA attributes, aria-expanded, aria-hidden, live regions, and when not to use ARIA.',
    descriptionAr: 'خصائص ARIA لتوفير سياق إضافي لأجهزة قراءة الشاشة.',
  },
  screen_readers: {
    id: 'screen_readers',
    nameEn: 'Screen Reader Tree & Focus Management',
    nameAr: 'شجرة قارئ الشاشة وإدارة التركيز',
    domain: 'general',
    difficultyTier: 3,
    prerequisites: ['aria_standards'],
    descriptionEn: 'Accessibility tree, virtual cursor navigation, focus traps, and announcements.',
    descriptionAr: 'طريقة تنقل قارئات الشاشة وإدارة تركيز لوحة المفاتيح في النوافذ المنبثقة.',
  },
  wcag_compliance: {
    id: 'wcag_compliance',
    nameEn: 'WCAG 2.2 AA Auditing & Contrast',
    nameAr: 'تدقيق معايير WCAG 2.2 AA والتباين',
    domain: 'general',
    difficultyTier: 4,
    prerequisites: ['aria_standards'],
    descriptionEn: 'Color contrast ratios, target sizes, motion sensitivities, and automated audit tools.',
    descriptionAr: 'نسب التباين اللوني، أحجام الأزرار للمس، ومعايير الامتثال المتقدمة.',
  },
};

// Register in concept graph
if (typeof CONCEPT_REGISTRY !== 'undefined') {
  for (const [key, node] of Object.entries(ADDITIONAL_CONCEPTS)) {
    if (!CONCEPT_REGISTRY[key]) {
      CONCEPT_REGISTRY[key] = node;
    }
  }
}

/**
 * Authoritative Evaluation Dataset covering 4 Academic Domains
 */
export const EVALUATION_DATASET: EvaluationItem[] = [
  // ==========================================================================
  // DOMAIN 1: COMPUTER SCIENCE / ALGORITHMS
  // ==========================================================================
  {
    id: 'cs_var_01',
    domain: 'computer_science',
    conceptId: 'variables_types',
    difficulty: 'foundational',
    bloomLevel: 'remember',
    languages: {
      en: {
        question: 'What is the primary role of a data type specification in statically typed programming languages?',
        choices: [
          'It dictates how much memory to allocate and how the CPU interprets binary bits.',
          'It forces the program to execute strictly in single-threaded mode.',
          'It encrypts the variable value directly inside the physical RAM.',
          'It determines whether the computer hardware can run the application.',
        ],
      },
      ar: {
        question: 'ما هو الدور الأساسي لتحديد نوع البيانات في لغات البرمجة ثابتة التنميط (Statically Typed)؟',
        choices: [
          'تحديد مقدار الذاكرة المحجوزة وكيفية تفسير وحدة المعالجة المركزية للبتات الثنائية.',
          'إجبار البرنامج على التنفيذ في مسار أحادي الخيط فقط.',
          'تشفير قيمة المتغير تلقائياً داخل ذاكرة الوصول العشوائي RAM.',
          'تحديد ما إذا كان عتاد الجهاز قادراً على تشغيل التطبيق.',
        ],
      },
      fr: {
        question: 'Quel est le rôle principal de la spécification du type de données dans les langages à typage statique ?',
        choices: [
          'Déterminer la quantité de mémoire à allouer et la façon dont le processeur interprète les bits.',
          'Forcer le programme à s’exécuter uniquement en mode monothread.',
          'Chiffrer directement la valeur de la variable dans la mémoire vive physique.',
          'Déterminer si le matériel de l’ordinateur peut exécuter l’application.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'A data type defines the size of memory allocation and specifies how the bit pattern is interpreted (e.g. integer vs IEEE 754 float).',
    explanations: {
      en: 'A data type defines the size of memory allocation and specifies how the bit pattern is interpreted (e.g. integer vs IEEE 754 float).',
      ar: 'يحدد نوع البيانات حجم الذاكرة المطلوب حجزها وكيفية تفسير البتات الثنائية (مثل عدد صحيح مقابل فاصلة عائمة).',
      fr: 'Un type de données définit la taille de mémoire à allouer et la façon d’interpréter les bits (entier vs virgule flottante IEEE 754).',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Conflating data typing with execution threading model.', errorDiagnosis: 'Data types govern memory representation, not thread concurrency.' },
      { choiceIndex: 2, misconception: 'Confusing memory formatting with cryptographic encryption.', errorDiagnosis: 'Variables are stored in plaintext binary unless explicitly encrypted.' },
      { choiceIndex: 3, misconception: 'Overestimating compiler typing as a hardware compatibility gate.', errorDiagnosis: 'Data types operate at the compiler/runtime software level.' },
    ],
  },

  {
    id: 'cs_ctrl_01',
    domain: 'computer_science',
    conceptId: 'control_flow',
    prerequisiteConceptId: 'variables_types',
    difficulty: 'foundational',
    bloomLevel: 'understand',
    languages: {
      en: {
        question: 'What is the fundamental operational difference between a standard while loop and a do-while loop?',
        choices: [
          'A while loop may execute zero times, whereas a do-while loop always executes its body at least once.',
          'A while loop runs asynchronously in the background, while do-while is blocking.',
          'A do-while loop cannot use relational comparison operators.',
          'A while loop consumes heap memory, while a do-while loop operates solely in the CPU cache.',
        ],
      },
      ar: {
        question: 'ما هو الفارق التشغيلي الجوهري بين حلقة while وحلقة do-while؟',
        choices: [
          'حلقة while قد لا تُنفذ إطلاقاً إذا كان الشرط غير محقق، بينما do-while تنفذ جسم الحلقة مرة واحدة على الأقل.',
          'حلقة while تعمل في الخلفية بشكل غير متزامن، بينما do-while تمنع تنفيذ الكود.',
          'حلقة do-while لا يمكنها استخدام معاملات المقارنة المنطقية.',
          'حلقة while تستهلك ذاكرة الركام Heap بينما do-while تقتصر على ذاكرة التخزين المؤقت للـ CPU.',
        ],
      },
      fr: {
        question: 'Quelle est la différence fondamentale de fonctionnement entre une boucle while et une boucle do-while ?',
        choices: [
          'Une boucle while peut s’exécuter zéro fois, tandis qu’une boucle do-while s’exécute toujours au moins une fois.',
          'Une boucle while s’exécute de manière asynchrone, tandis que do-while est bloquante.',
          'Une boucle do-while ne peut pas utiliser d’opérateurs de comparaison relationnels.',
          'Une boucle while consomme de la mémoire du tas (heap), tandis que do-while s’exécute dans le cache CPU.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'A while loop evaluates the predicate condition before entering the body (pre-test), whereas do-while tests the condition at the end (post-test).',
    explanations: {
      en: 'A while loop evaluates the predicate condition before entering the body (pre-test), whereas do-while tests the condition at the end (post-test).',
      ar: 'حلقة while تفحص الشرط قبل دخول جسم الحلقة (فحص مسبق)، بينما do-while تفحص الشرط في النهاية بعد أول دورة (فحص لاحق).',
      fr: 'Une boucle while vérifie sa condition avant d’entrer dans le corps (pré-test), alors que do-while la vérifie à la fin (post-test).',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Assuming looping keywords control asynchronous process threading.', errorDiagnosis: 'Both loops execute synchronously on the current thread.' },
      { choiceIndex: 2, misconception: 'Believing do-while has limited relational syntax.', errorDiagnosis: 'Both constructs share identical boolean evaluation capabilities.' },
      { choiceIndex: 3, misconception: 'Confusing loop syntax with physical CPU memory hierarchies.', errorDiagnosis: 'Loop constructs do not dictate hardware memory tier placement.' },
    ],
  },

  {
    id: 'cs_mem_01',
    domain: 'computer_science',
    conceptId: 'memory_addresses',
    prerequisiteConceptId: 'variables_types',
    difficulty: 'intermediate',
    bloomLevel: 'apply',
    languages: {
      en: {
        question: 'Given an integer variable `int count = 42;` residing at memory location `0x7ffee4`, what does the expression `&count` evaluate to?',
        choices: [
          'The hexadecimal memory address `0x7ffee4`.',
          'The numerical integer value 42.',
          'The byte size of the integer, which is 4.',
          'A null pointer `nullptr`.',
        ],
      },
      ar: {
        question: 'إذا كان المتغير العددي `int count = 42;` مخزناً في العنوان الذاكري `0x7ffee4`، ما هي القيمة الناتجة عن التعبير `&count`؟',
        choices: [
          'العنوان الذاكري الست عشري `0x7ffee4`.',
          'القيمة العددية المخزنة 42.',
          'حجم المتغير بالبايت وهو 4.',
          'مؤشر فارغ `nullptr`.',
        ],
      },
      fr: {
        question: 'Étant donné une variable entière `int count = 42;` située à l’adresse mémoire `0x7ffee4`, que vaut l’expression `&count` ?',
        choices: [
          'L’adresse mémoire hexadécimale `0x7ffee4`.',
          'La valeur numérique entière 42.',
          'La taille en octets de l’entier, soit 4.',
          'Un pointeur nul `nullptr`.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'The address-of operator (&) returns the pointer/memory address where the operand variable resides in memory.',
    explanations: {
      en: 'The address-of operator (&) returns the pointer/memory address where the operand variable resides in memory.',
      ar: 'عامل العنوان (&) يعيد العنوان الذاكري للمتغير بدلاً من القيمة المخزنة بداخله.',
      fr: 'L’opérateur d’adresse (&) renvoie l’adresse mémoire où réside la variable opérande.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Confusing the address-of operator (&) with variable value dereferencing.', errorDiagnosis: 'Evaluating `count` yields 42; evaluating `&count` retrieves the storage location.' },
      { choiceIndex: 2, misconception: 'Confusing address extraction with the `sizeof` operator.', errorDiagnosis: '`sizeof(count)` returns byte length, whereas `&count` returns its location.' },
      { choiceIndex: 3, misconception: 'Assuming referencing unassigned pointers always defaults to null.', errorDiagnosis: '`count` is a declared stack variable, so its address is guaranteed valid.' },
    ],
  },

  {
    id: 'cs_ptr_01',
    domain: 'computer_science',
    conceptId: 'pointers',
    prerequisiteConceptId: 'memory_addresses',
    difficulty: 'intermediate',
    bloomLevel: 'analyze',
    languages: {
      en: {
        question: 'Consider the code: `int x = 10; int* p = &x; *p = 99;`. What will `x` evaluate to immediately after, and why?',
        choices: [
          '99, because dereferencing `*p` directly mutates the value in the memory cell occupied by `x`.',
          '10, because `*p` only modifies a local copy of the pointer variable.',
          'The address `&x`, because assigning through a pointer overwrites the address.',
          'Undefined behavior, because pointers cannot modify stack variables.',
        ],
      },
      ar: {
        question: 'تأمل الكود التالي: `int x = 10; int* p = &x; *p = 99;`. ما هي قيمة `x` مباشرة بعد التنفيذ، ولماذا؟',
        choices: [
          '99، لأن فك الإشارة `*p` يكتب القيمة مباشرة في الخلية الذاكرية التي يشغلها `x`.',
          '10، لأن `*p` يُعدل فقط نسخة محلية داخل المتغير المؤشر.',
          'العنوان الذاكري `&x`، لأن الإسناد للمؤشر يمسح عنوانه الأصلي.',
          'سلوك غير معرف (Undefined Behavior)، لأن المؤشرات لا يمكنها تعديل متغيرات المكدس.',
        ],
      },
      fr: {
        question: 'Considérez le code : `int x = 10; int* p = &x; *p = 99;`. Que vaudra `x` immédiatement après, et pourquoi ?',
        choices: [
          '99, car déréférencer `*p` modifie directement la valeur dans la cellule mémoire occupée par `x`.',
          '10, car `*p` ne modifie qu’une copie locale de la variable pointeur.',
          'L’adresse `&x`, car l’affectation via un pointeur écrase son adresse.',
          'Un comportement indéfini, car les pointeurs ne peuvent pas modifier les variables de pile.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'Dereferencing the pointer via `*p` accesses the target memory address directly. Writing 99 to `*p` overwrites the storage location of `x`.',
    explanations: {
      en: 'Dereferencing the pointer via `*p` accesses the target memory address directly. Writing 99 to `*p` overwrites the storage location of `x`.',
      ar: 'عامل فك الإشارة `*p` يصل مباشرة إلى محتوى العنوان المخزن، وبالتالي فإن كتابة 99 فيه تغير قيمة `x` الأصلية.',
      fr: 'Le déréférencement via `*p` accède directement à l’adresse mémoire cible. Écrire 99 dans `*p` écrase `x`.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Believing pointer dereferencing creates pass-by-value copies.', errorDiagnosis: 'Pointers bypass copy semantics and enable direct mutable memory access.' },
      { choiceIndex: 2, misconception: 'Confusing pointer value mutation with pointer address re-binding.', errorDiagnosis: 'Assigning to `*p` mutates the target value, whereas assigning to `p` changes the address.' },
      { choiceIndex: 3, misconception: 'Believing pointers can only mutate dynamically allocated heap memory.', errorDiagnosis: 'Pointers can reference and mutate valid stack addresses seamlessly.' },
    ],
  },

  {
    id: 'cs_dyn_01',
    domain: 'computer_science',
    conceptId: 'dynamic_memory',
    prerequisiteConceptId: 'pointers',
    difficulty: 'advanced',
    bloomLevel: 'evaluate',
    languages: {
      en: {
        question: 'What critical bug occurs when `char* buffer = (char*)malloc(1024); buffer = NULL;` is executed without calling `free`?',
        choices: [
          'A memory leak, because the heap block remains allocated with no reachable pointer to free it.',
          'A segmentation fault immediately upon setting `buffer = NULL`.',
          'A stack overflow, because the 1024 bytes collapse into the CPU call stack.',
          'A double free error reported by the C runtime library.',
        ],
      },
      ar: {
        question: 'ما هو الخطأ الجسيم الذي يحدث عند تنفيذ `char* buffer = (char*)malloc(1024); buffer = NULL;` دون استدعاء `free` أولاً؟',
        choices: [
          'تسريب ذاكرة (Memory Leak)، لأن الكتلة المحجوزة في الركام تظل محجوزة دون وجود أي مؤشر للوصول إليها وتحريرها.',
          'خطأ تجزئة (Segmentation Fault) فور تعيين `buffer = NULL`.',
          'امتلاء مكدس النداء (Stack Overflow)، لأن 1024 بايت تنتقل تلقائياً للمكدس.',
          'خطأ تحرير مزدوج (Double Free) بواسطة مكتبة التشغيل.',
        ],
      },
      fr: {
        question: 'Quelle anomalie critique se produit lorsque `char* buffer = (char*)malloc(1024); buffer = NULL;` est exécuté sans appeler `free` ?',
        choices: [
          'Une fuite de mémoire (memory leak), car le bloc reste alloué sur le tas sans aucun pointeur accessible pour le libérer.',
          'Une erreur de segmentation immédiate lors de l’affectation `buffer = NULL`.',
          'Un dépassement de pile (stack overflow), car les 1024 octets sont transférés dans la pile.',
          'Une erreur de double libération (double free) signalée par la bibliothèque d’exécution C.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'Overwriting the pointer without releasing the heap allocation leaves the block orphaned in heap memory, causing a memory leak.',
    explanations: {
      en: 'Overwriting the pointer without releasing the heap allocation leaves the block orphaned in heap memory, causing a memory leak.',
      ar: 'تعديل المؤشر دون تحرير الذاكرة أولاً يؤدي لفقدان عنوان الكتلة المحجوزة في الـ Heap، مما يسبب تسريباً دائماً للذاكرة.',
      fr: 'Écraser le pointeur sans libérer la mémoire laisse le bloc orphelin sur le tas, provoquant une fuite de mémoire.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Assuming reassigning a pointer variable to NULL triggers a segfault.', errorDiagnosis: 'Assigning NULL to a pointer is valid; dereferencing NULL is what causes a segfault.' },
      { choiceIndex: 2, misconception: 'Believing orphaned heap memory migrates into stack frames.', errorDiagnosis: 'Heap and stack allocations are strictly physically distinct memory regions.' },
      { choiceIndex: 3, misconception: 'Confusing failing to free memory with freeing memory twice.', errorDiagnosis: 'Double free occurs when calling `free()` twice on the identical pointer.' },
    ],
  },

  {
    id: 'cs_dyn_02',
    domain: 'computer_science',
    conceptId: 'dynamic_memory',
    prerequisiteConceptId: 'pointers',
    difficulty: 'advanced',
    bloomLevel: 'create',
    languages: {
      en: {
        question: 'When designing a robust C++ class that manages dynamic heap memory, which architectural idiom best eliminates leaks and dangling pointers?',
        choices: [
          'RAII (Resource Acquisition Is Initialization), binding allocation to constructor and deallocation to destructor.',
          'Using raw global pointers and calling `free` at program exit in `main()`.',
          'Periodically scanning the heap memory with a polling timer thread.',
          'Replacing all dynamic pointers with recursive function calls.',
        ],
      },
      ar: {
        question: 'عند تصميم فئة (Class) بلغة C++ تدير الذاكرة الديناميكية، ما هو النمط المعماري الأفضل لمنع تسريب الذاكرة والمؤشرات العالقة؟',
        choices: [
          'نمط RAII (ربط حيازة الموارد بالتهيئة)، حيث يتم الحجز في الباني (Constructor) والتحرير التلقائي في الهادم (Destructor).',
          'استخدام مؤشرات عامة (Global) واستدعاء `free` فقط عند إنهاء الدالة `main`.',
          'فحص الذاكرة بشكل دوري عبر خيط مؤقت لمسح الكتل غير المستخدمة.',
          'استبدال جميع المؤشرات الديناميكية بالاستدعاء الذاتي المتكرر (Recursion).',
        ],
      },
      fr: {
        question: 'Lors de la conception d’une classe C++ gérant de la mémoire dynamique, quel idiome architectural élimine le mieux les fuites et les pointeurs flottants ?',
        choices: [
          'RAII (Resource Acquisition Is Initialization), liant l’allocation au constructeur et la libération au destructeur.',
          'Utiliser des pointeurs globaux bruts et appeler `free` à la fin de la fonction `main()`.',
          'Analyser périodiquement la mémoire du tas avec un thread minuteur d’interrogation.',
          'Remplacer tous les pointeurs dynamiques par des appels de fonctions récursives.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'RAII guarantees deterministic resource management: when the wrapping object leaves scope, its destructor automatically frees the heap memory.',
    explanations: {
      en: 'RAII guarantees deterministic resource management: when the wrapping object leaves scope, its destructor automatically frees the heap memory.',
      ar: 'يضمن نمط RAII تحريراً حتمياً للموارد بمجرد خروج الكائن من نطاق الصلاحية (Scope) دون الحاجة لتدخل يدوي.',
      fr: 'RAII garantit une gestion déterministe des ressources : à la sortie de portée de l’objet, son destructeur libère la mémoire.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Relying on manual cleanup in application exit routines.', errorDiagnosis: 'Exceptions or early returns bypass manual exit cleanups.' },
      { choiceIndex: 2, misconception: 'Simulating garbage collection through polling timers.', errorDiagnosis: 'C++ provides deterministic destructors without GC runtime overhead.' },
      { choiceIndex: 3, misconception: 'Assuming recursion solves heap resource lifecycle problems.', errorDiagnosis: 'Recursion adds call stack depth and does not manage dynamic memory.' },
    ],
  },

  {
    id: 'cs_asymp_01',
    domain: 'computer_science',
    conceptId: 'asymptotic_complexity',
    prerequisiteConceptId: 'control_flow',
    difficulty: 'intermediate',
    bloomLevel: 'analyze',
    languages: {
      en: {
        question: 'Comparing linear search in an unsorted array versus binary search in a sorted array of size N, what are their respective worst-case time complexities?',
        choices: [
          'O(N) for linear search, and O(log N) for binary search.',
          'O(1) for linear search, and O(N) for binary search.',
          'O(N^2) for linear search, and O(N log N) for binary search.',
          'O(log N) for linear search, and O(N) for binary search.',
        ],
      },
      ar: {
        question: 'عند مقارنة البحث الخطي في مصفوفة غير مرتبة بالبحث الثنائي في مصفوفة مرتبة بحجم N، ما هو التعقيد الزمني لأسوأ حالة لكل منهما؟',
        choices: [
          'O(N) للبحث الخطي، و O(log N) للبحث الثنائي.',
          'O(1) للبحث الخطي، و O(N) للبحث الثنائي.',
          'O(N^2) للبحث الخطي، و O(N log N) للبحث الثنائي.',
          'O(log N) للبحث الخطي، و O(N) للبحث الثنائي.',
        ],
      },
      fr: {
        question: 'En comparant la recherche linéaire dans un tableau non trié et la recherche binaire dans un tableau trié de taille N, quelles sont leurs complexités temporelles dans le pire des cas ?',
        choices: [
          'O(N) pour la recherche linéaire, et O(log N) pour la recherche binaire.',
          'O(1) pour la recherche linéaire, et O(N) pour la recherche binaire.',
          'O(N^2) pour la recherche linéaire, et O(N log N) pour la recherche binaire.',
          'O(log N) pour la recherche linéaire, et O(N) pour la recherche binaire.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'Linear search scans each element sequentially in O(N) time. Binary search halves the search range at each step in O(log N) time.',
    explanations: {
      en: 'Linear search scans each element sequentially in O(N) time. Binary search halves the search range at each step in O(log N) time.',
      ar: 'البحث الخطي يفحص العناصر واحداً تلو الآخر بتعقيد O(N)، بينما البحث الثنائي يقسم مجال البحث إلى النصف في كل خطوة بتعقيد O(log N).',
      fr: 'La recherche linéaire parcourt chaque élément en O(N). La recherche binaire divise l’espace par deux à chaque étape en O(log N).',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Assuming linear search possesses constant time access like direct array indexing.', errorDiagnosis: 'Searching requires scanning unless the index is already known.' },
      { choiceIndex: 2, misconception: 'Confusing elementary searching with quadratic sorting algorithms.', errorDiagnosis: 'Single dimensional search never requires nested quadratic iteration.' },
      { choiceIndex: 3, misconception: 'Inverting logarithmic and linear growth rates.', errorDiagnosis: 'Binary search is strictly asymptotically faster than linear search.' },
    ],
  },

  // ==========================================================================
  // DOMAIN 2: WEB DEVELOPMENT
  // ==========================================================================
  {
    id: 'web_html_01',
    domain: 'web_development',
    conceptId: 'html_basics',
    difficulty: 'foundational',
    bloomLevel: 'remember',
    languages: {
      en: {
        question: 'What is the primary technical function of the `<!DOCTYPE html>` declaration at the very top of an HTML document?',
        choices: [
          'It signals the web browser to render the document in modern standards-compliant mode rather than quirks mode.',
          'It downloads the latest version of HTML from the W3C servers.',
          'It compiles the client-side JavaScript into native machine code.',
          'It configures TLS encryption for web socket connections.',
        ],
      },
      ar: {
        question: 'ما هي الوظيفة التقنية الأساسية لتعليمة `<!DOCTYPE html>` في أعلى مستند HTML؟',
        choices: [
          'توجيه المتصفح لعرض الصفحة وفقاً للمعايير القياسية الحديثة وتجنب وضع التوافق القديم (Quirks Mode).',
          'تحميل أحدث إصدار من لغة HTML تلقائياً من خوادم منظمة W3C.',
          'ترجمة أكواد الجافاسكريبت إلى لغة الآلة المباشرة.',
          'تفعيل التشفير والأمان لاتصالات الويب المقفلة.',
        ],
      },
      fr: {
        question: 'Quelle est la fonction technique principale de la déclaration `<!DOCTYPE html>` au tout début d’un document HTML ?',
        choices: [
          'Indiquer au navigateur de restituer le document en mode standard moderne plutôt qu’en mode rétrocompatible (quirks mode).',
          'Télécharger automatiquement la dernière version de HTML depuis les serveurs du W3C.',
          'Compiler le JavaScript côté client en code machine natif.',
          'Configurer le chiffrement TLS pour les connexions WebSockets.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'The `<!DOCTYPE html>` doctype triggers standards mode in HTML5 web rendering engines.',
    explanations: {
      en: 'The `<!DOCTYPE html>` doctype triggers standards mode in HTML5 web rendering engines.',
      ar: 'تعليمة `<!DOCTYPE html>` تحث محرك عرض المتصفح على تفعيل وضع المعايير القياسية الحديثة وتمنع تراجع المتصفح لنمط Quirks mode.',
      fr: 'Le doctype `<!DOCTYPE html>` active le mode de rendu standardisé dans les moteurs de navigation modernes.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Believing doctype triggers dynamic external specification downloads.', errorDiagnosis: 'HTML doctype is a local parser switch, not a remote download trigger.' },
      { choiceIndex: 2, misconception: 'Conflating HTML declarations with JavaScript JIT compilers.', errorDiagnosis: 'Doctype affects HTML/CSS layout parsing, not script compilation.' },
      { choiceIndex: 3, misconception: 'Assuming doctype configures network encryption layers.', errorDiagnosis: 'Security protocols are managed by HTTPS/TLS, independent of doctype.' },
    ],
  },

  {
    id: 'web_css_01',
    domain: 'web_development',
    conceptId: 'css_box_model',
    prerequisiteConceptId: 'html_basics',
    difficulty: 'foundational',
    bloomLevel: 'understand',
    languages: {
      en: {
        question: 'Under standard CSS `box-sizing: content-box`, what components sum up to determine an element’s total rendered width on screen?',
        choices: [
          'Declared width + horizontal padding + horizontal border.',
          'Declared width only, with padding and border deducted internally.',
          'Declared width + horizontal margin only.',
          'Horizontal padding + horizontal margin only, ignoring border.',
        ],
      },
      ar: {
        question: 'في نموذج الصندوق القياسي `box-sizing: content-box`، ما هي المكونات التي يتم جمعها لتحديد العرض الفعلي الكلي للعنصر على الشاشة؟',
        choices: [
          'العرض المحدد + الحشو الأفقي الداخلي (Padding) + سمك الحدود الأفقية (Border).',
          'العرض المحدد فقط، حيث يتم خصم الحشو والحدود من المساحة الداخلية.',
          'العرض المحدد + الهامش الخارجي الأفقي (Margin) فقط.',
          'الحشو الأفقي + الهامش الأفقي فقط مع تجاهل الحدود.',
        ],
      },
      fr: {
        question: 'Avec la propriété CSS standard `box-sizing: content-box`, quels éléments s’additionnent pour déterminer la largeur totale d’un élément à l’écran ?',
        choices: [
          'Largeur déclarée + espacement horizontal interne (padding) + bordure horizontale.',
          'Largeur déclarée uniquement, le padding et la bordure étant déduits de l’intérieur.',
          'Largeur déclarée + marge horizontale uniquement.',
          'Padding horizontal + marge horizontale uniquement, sans tenir compte de la bordure.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'In content-box, the declared width applies only to content. Total width = width + padding-left + padding-right + border-left + border-right.',
    explanations: {
      en: 'In content-box, the declared width applies only to content. Total width = width + padding-left + padding-right + border-left + border-right.',
      ar: 'في نمط content-box، العرض يحدد مساحة المحتوى فقط، ويضاف إليه الحشو والحدود لتحديد العرض الكلي المشغول على الشاشة.',
      fr: 'En mode content-box, la largeur ne s’applique qu’au contenu. La largeur totale = largeur + padding gauche/droite + bordure gauche/droite.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Confusing default content-box behavior with `border-box`.', errorDiagnosis: 'In `border-box`, padding and border are absorbed inside the declared width.' },
      { choiceIndex: 2, misconception: 'Assuming margins alter the element box dimensions rather than external spacing.', errorDiagnosis: 'Margins provide spacing outside the element boundary.' },
      { choiceIndex: 3, misconception: 'Thinking borders are excluded from dimensional calculations.', errorDiagnosis: 'Borders are integral parts of the CSS box dimensional footprint.' },
    ],
  },

  {
    id: 'web_dom_01',
    domain: 'web_development',
    conceptId: 'dom_manipulation',
    prerequisiteConceptId: 'html_basics',
    difficulty: 'intermediate',
    bloomLevel: 'apply',
    languages: {
      en: {
        question: 'When rendering a dynamic list with 500 items, which pattern provides the highest memory efficiency and performance for handling button clicks?',
        choices: [
          'Attaching a single event listener to the parent `<ul>` using event delegation and inspecting `e.target`.',
          'Attaching 500 individual `addEventListener` handlers to every item button.',
          'Using inline `onclick` strings inside every button element.',
          'Polling the DOM with a 10ms `setInterval` loop to detect clicked elements.',
        ],
      },
      ar: {
        question: 'عند عرض قائمة ديناميكية تحتوي على 500 عنصر، ما هو النمط الأكثر كفاءة في استهلاك الذاكرة وسرعة الاستجابة لمعالجة نقرات الأزرار؟',
        choices: [
          'إسناد مستمع أحداث واحد للعنصر الأب `<ul>` باستخدام تفويض الأحداث (Event Delegation) وفحص `e.target`.',
          'ربط 500 مستمع حدث منفصل `addEventListener` بكل زر على حدة.',
          'كتابة نصوص `onclick` المباشرة داخل كل عنصر زر.',
          'مراقبة شجرة العناصر عبر حلقة `setInterval` كل 10 ملي ثانية لاكتشاف النقر.',
        ],
      },
      fr: {
        question: 'Lors du rendu d’une liste dynamique de 500 éléments, quel modèle offre la meilleure efficacité mémoire et performance pour gérer les clics ?',
        choices: [
          'Attacher un seul écouteur d’événement au parent `<ul>` via la délégation d’événements en inspectant `e.target`.',
          'Attacher 500 écouteurs individuels `addEventListener` sur chaque bouton.',
          'Utiliser des attributs `onclick` en chaîne directe dans chaque bouton.',
          'Sonder le DOM avec une boucle `setInterval` toutes les 10 ms pour détecter les clics.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'Event delegation leverages event bubbling to handle clicks from many child elements using a single parent listener, saving substantial memory.',
    explanations: {
      en: 'Event delegation leverages event bubbling to handle clicks from many child elements using a single parent listener, saving substantial memory.',
      ar: 'تفويض الأحداث يستفيد من صعود الأحداث (Event Bubbling) لمعالجة تفاعل مئات الأبناء عبر مستمع واحد، مما يوفر الذاكرة بشكل كبير.',
      fr: 'La délégation d’événements tire parti du bouillonnement (bubbling) pour gérer de nombreux enfants avec un seul écouteur parent.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Believing modern browsers experience zero memory overhead from thousands of event listener closures.', errorDiagnosis: 'Each handler retains closure scope and consumes heap memory.' },
      { choiceIndex: 2, misconception: 'Assuming inline HTML strings are optimized into event delegation.', errorDiagnosis: 'Inline handlers create separate function instances and violate separation of concerns.' },
      { choiceIndex: 3, misconception: 'Replacing event-driven architecture with polling timers.', errorDiagnosis: 'Polling consumes continuous CPU cycles without guarantee of instant responsiveness.' },
    ],
  },

  {
    id: 'web_async_01',
    domain: 'web_development',
    conceptId: 'javascript_async',
    prerequisiteConceptId: 'dom_manipulation',
    difficulty: 'intermediate',
    bloomLevel: 'analyze',
    languages: {
      en: {
        question: 'In the JavaScript event loop, when are microtasks (e.g. `Promise.then` callbacks) processed relative to macrotasks (e.g. `setTimeout`)?',
        choices: [
          'Immediately after the currently executing script completes, before any subsequent macrotask is dequeued.',
          'Only after all pending `setTimeout` and `setInterval` timers have completely finished.',
          'Concurrently in a secondary worker thread in parallel with synchronous code.',
          'Exclusively during the browser rendering paint phase.',
        ],
      },
      ar: {
        question: 'في حلقة أحداث الجافاسكريبت (Event Loop)، متى يتم تنفيذ المهام الدقيقة (Microtasks مثل `Promise.then`) مقارنة بالمهام الكبيرة (Macrotasks مثل `setTimeout`)؟',
        choices: [
          'مباشرة بعد انتهاء تنفيذ الكود المتزامن الحالي، وقبل سحب أو معالجة أي مهمة Macrotask تالية.',
          'فقط بعد انتهاء جميع مؤقتات `setTimeout` و `setInterval` المعلقة تماماً.',
          'في نفس اللحظة عبر مسار عمل ثانوي بالتوازي مع الكود المتزامن.',
          'حصرياً أثناء مرحلة إعادة رسم واجهة المتصفح (Repaint Phase).',
        ],
      },
      fr: {
        question: 'Dans la boucle d’événements JavaScript, quand les microtâches (ex. `Promise.then`) sont-elles exécutées par rapport aux macrotâches (ex. `setTimeout`) ?',
        choices: [
          'Immédiatement après la fin du script synchrone en cours, avant qu’une nouvelle macrotâche ne soit dépilée.',
          'Uniquement après que toutes les minuteries `setTimeout` et `setInterval` en attente soient terminées.',
          'Simultanément dans un thread de travail secondaire en parallèle du code synchrone.',
          'Exclusivement pendant la phase de rafraîchissement graphique du navigateur.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'The microtask queue is drained completely at the end of each task execution turn before the event loop yields to the next macrotask or renders.',
    explanations: {
      en: 'The microtask queue is drained completely at the end of each task execution turn before the event loop yields to the next macrotask or renders.',
      ar: 'يتم إفراغ طابور المهام الدقيقة (Microtask Queue) بالكامل فور انتهاء الكود المتزامن وقبل الانتقال للمهمة الكبيرة التالية في حلقة الأحداث.',
      fr: 'La file des microtâches est vidée intégralement dès la fin du script synchrone avant de passer à la prochaine macrotâche.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Assuming promises have lower priority than timer callbacks.', errorDiagnosis: 'Microtasks have strict priority over timer callbacks in the HTML spec.' },
      { choiceIndex: 2, misconception: 'Confusing single-threaded asynchronous execution with multithreaded parallelism.', errorDiagnosis: 'JavaScript execution runs on a single main thread unless Web Workers are explicitly spawned.' },
      { choiceIndex: 3, misconception: 'Conflating microtask execution with UI repaint cycles.', errorDiagnosis: 'Microtasks run before layout rendering and painting occur.' },
    ],
  },

  {
    id: 'web_async_02',
    domain: 'web_development',
    conceptId: 'javascript_async',
    prerequisiteConceptId: 'dom_manipulation',
    difficulty: 'advanced',
    bloomLevel: 'evaluate',
    languages: {
      en: {
        question: 'What is the primary risk of using `Promise.all` when initiating multiple independent network requests where one may fail?',
        choices: [
          '`Promise.all` short-circuits and rejects immediately upon the first rejected promise, discarding all other successful results.',
          '`Promise.all` converts all HTTP responses into plaintext strings.',
          '`Promise.all` forces all requests to run strictly sequentially rather than concurrently.',
          '`Promise.all` automatically retries failed requests indefinitely, locking the browser UI.',
        ],
      },
      ar: {
        question: 'ما هي المخاطرة الأساسية عند استخدام `Promise.all` لإرسال عدة طلبات شبكة مستقلة عند احتمال فشل أحدها؟',
        choices: [
          'يقوم `Promise.all` بالرفض الفوري (Short-circuit) عند فشل أول وعد، مما يؤدي لضياع بيانات جميع الوعود الأخرى الناجحة.',
          'يقوم `Promise.all` بتحويل كافة استجابات HTTP إلى نصوص مجردة.',
          'يجبر الطلبات على التنفيذ بشكل متتابع بطيء بدلاً من التنفيذ المتزامن.',
          'يقوم بإعادة محاولة إرسال الطلبات الفاشلة إلى ما لا نهاية مما يجمد واجهة المستخدم.',
        ],
      },
      fr: {
        question: 'Quel est le risque principal d’utiliser `Promise.all` lors du lancement de requêtes réseau indépendantes si l’une d’elles échoue ?',
        choices: [
          '`Promise.all` court-circuite et rejette immédiatement au premier échec, ignorant les autres résultats réussis.',
          '`Promise.all` convertit toutes les réponses HTTP en chaînes de texte brut.',
          '`Promise.all` force les requêtes à s’exécuter séquentiellement plutôt qu’en parallèle.',
          '`Promise.all` réessaie automatiquement les requêtes indéfiniment, bloquant l’interface.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: '`Promise.all` fails fast. For resilient multi-request fetching where partial successes should be retained, `Promise.allSettled` is preferred.',
    explanations: {
      en: '`Promise.all` fails fast. For resilient multi-request fetching where partial successes should be retained, `Promise.allSettled` is preferred.',
      ar: 'طريقة `Promise.all` تتميز بالفشل السريع (Fail-Fast)، وإذا أردنا الاحتفاظ بنتائج الطلبات الناجحة يجب استخدام `Promise.allSettled`.',
      fr: '`Promise.all` échoue dès la première erreur. Pour conserver les résultats partiels réussis, `Promise.allSettled` est recommandé.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Assuming promise combinators alter response payload formatting.', errorDiagnosis: '`Promise.all` preserves the exact resolution value of each promise.' },
      { choiceIndex: 2, misconception: 'Believing Promise.all serializes requests.', errorDiagnosis: 'Promises passed to `Promise.all` execute concurrently in parallel.' },
      { choiceIndex: 3, misconception: 'Assuming promise combinators include built-in infinite retry loops.', errorDiagnosis: 'Retry logic must be implemented explicitly; promises do not auto-retry.' },
    ],
  },

  {
    id: 'web_api_01',
    domain: 'web_development',
    conceptId: 'rest_apis',
    prerequisiteConceptId: 'javascript_async',
    difficulty: 'advanced',
    bloomLevel: 'create',
    languages: {
      en: {
        question: 'When designing an idempotent REST endpoint to completely replace an existing resource record, which HTTP verb and semantics should be implemented?',
        choices: [
          '`PUT`, because sending the identical complete payload multiple times produces the identical server state.',
          '`POST`, because it automatically detects duplicate submissions and deletes them.',
          '`PATCH`, because it enforces complete object replacement by specification.',
          '`DELETE`, because it clears the database table before re-inserting.',
        ],
      },
      ar: {
        question: 'عند تصميم واجهة REST برمجية غير متغيرة الحالة (Idempotent) لاستبدال سجل مورد بالكامل، ما هو الفعل والبروتوكول الواجب اعتماده؟',
        choices: [
          'استخدام `PUT`، لأن إرسال نفس البيانات الكاملة عدة مرات يترك الخادم في نفس الحالة تماماً دون تكرار.',
          'استخدام `POST`، لأنه يكتشف تلقائياً التكرار ويحذف السجلات الزائدة.',
          'استخدام `PATCH`، لأنه مخصص للاستبدال الكامل للمورد وفق المعايير القياسية.',
          'استخدام `DELETE`، لمسح الجدول بالكامل قبل إعادة الإدراج.',
        ],
      },
      fr: {
        question: 'Lors de la conception d’un point de terminaison REST idempotent pour remplacer complètement une ressource, quel verbe HTTP doit être utilisé ?',
        choices: [
          '`PUT`, car envoyer la même charge utile plusieurs fois produit exactement le même état sur le serveur.',
          '`POST`, car il détecte automatiquement les doublons et les supprime.',
          '`PATCH`, car il impose le remplacement complet de l’objet selon les spécifications.',
          '`DELETE`, car il vide la table de base de données avant la réinsertion.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'HTTP `PUT` is idempotent and designates complete resource replacement. Calling PUT N times yields identical server state as calling it once.',
    explanations: {
      en: 'HTTP `PUT` is idempotent and designates complete resource replacement. Calling PUT N times yields identical server state as calling it once.',
      ar: 'طلب `PUT` يتميز بكونه متطابق القوى (Idempotent) ومخصصاً للاستبدال الكامل للمورد، وتكرار إرساله يعطي نفس النتيجة تماماً.',
      fr: 'HTTP `PUT` est idempotent et conçu pour le remplacement complet d’une ressource. L’exécuter plusieurs fois produit le même état.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Believing POST is idempotent by default.', errorDiagnosis: 'POST is non-idempotent and creates new duplicate subordinate records on subsequent calls.' },
      { choiceIndex: 2, misconception: 'Confusing PATCH with PUT.', errorDiagnosis: 'PATCH specifies partial mutation, whereas PUT specifies complete replacement.' },
      { choiceIndex: 3, misconception: 'Conflating resource replacement with destructive database table deletion.', errorDiagnosis: 'DELETE removes the targeted URI resource rather than replacing its payload.' },
    ],
  },

  // ==========================================================================
  // DOMAIN 3: MATHEMATICS / CALCULUS
  // ==========================================================================
  {
    id: 'math_alg_01',
    domain: 'mathematics',
    conceptId: 'basic_algebra',
    difficulty: 'foundational',
    bloomLevel: 'remember',
    languages: {
      en: {
        question: 'What is the algebraic solution for x in the linear equation: 4x - 12 = 0?',
        choices: [
          'x = 3',
          'x = -3',
          'x = 48',
          'x = 0',
        ],
      },
      ar: {
        question: 'ما هو الحل الجبري لقيمة x في المعادلة الخطية: 4x - 12 = 0؟',
        choices: [
          'x = 3',
          'x = -3',
          'x = 48',
          'x = 0',
        ],
      },
      fr: {
        question: 'Quelle est la solution algébrique pour x dans l’équation linéaire : 4x - 12 = 0 ?',
        choices: [
          'x = 3',
          'x = -3',
          'x = 48',
          'x = 0',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'Add 12 to both sides: 4x = 12. Divide both sides by 4: x = 3.',
    explanations: {
      en: 'Add 12 to both sides: 4x = 12. Divide both sides by 4: x = 3.',
      ar: 'بإضافة 12 إلى الطرفين نحصل على 4x = 12، ثم بالقسمة على 4 ينتج x = 3.',
      fr: 'En ajoutant 12 des deux côtés : 4x = 12. En divisant par 4 : x = 3.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Sign error during transposition across equals sign.', errorDiagnosis: 'Moving -12 to the right side yields positive +12, not -12.' },
      { choiceIndex: 2, misconception: 'Multiplying coefficients instead of dividing.', errorDiagnosis: 'Isolating x requires division by its coefficient (12 / 4 = 3).' },
      { choiceIndex: 3, misconception: 'Assuming 0 right-hand side implies root is 0.', errorDiagnosis: 'x = 0 produces -12 != 0.' },
    ],
  },

  {
    id: 'math_func_01',
    domain: 'mathematics',
    conceptId: 'functions_graphs',
    prerequisiteConceptId: 'basic_algebra',
    difficulty: 'foundational',
    bloomLevel: 'understand',
    languages: {
      en: {
        question: 'What is the maximal real domain of the function f(x) = 1 / (x - 5)?',
        choices: [
          'All real numbers except x = 5 (R \\ {5}).',
          'All positive real numbers strictly greater than 5.',
          'All real numbers without restriction (R).',
          'Only the integer x = 5.',
        ],
      },
      ar: {
        question: 'ما هو مجال الدالة الحقيقية f(x) = 1 / (x - 5)؟',
        choices: [
          'جميع الأعداد الحقيقية ما عدا العدد 5 (R \\ {5}).',
          'جميع الأعداد الحقيقية الموجبة الأكبر تماماً من 5.',
          'مجموعة الأعداد الحقيقية بأكملها (R) دون أي استثناء.',
          'العدد 5 فقط.',
        ],
      },
      fr: {
        question: 'Quel est le domaine de définition réel maximal de la fonction f(x) = 1 / (x - 5) ?',
        choices: [
          'Tous les nombres réels sauf x = 5 (R \\ {5}).',
          'Tous les nombres réels strictement supérieurs à 5.',
          'Tous les nombres réels sans restriction (R).',
          'Uniquement le nombre x = 5.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'Division by zero is undefined in real numbers. Setting denominator x - 5 = 0 gives x = 5 as the single excluded point.',
    explanations: {
      en: 'Division by zero is undefined in real numbers. Setting denominator x - 5 = 0 gives x = 5 as the single excluded point.',
      ar: 'القسمة على الصفر غير معرفة في الأعداد الحقيقية، وبالتالي يُستثنى صفر المقام وهو x = 5.',
      fr: 'La division par zéro n’est pas définie. Le dénominateur s’annule en x = 5, qui est donc exclu.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Confusing rational function domain with square root radical constraints.', errorDiagnosis: 'Rational denominators require only non-zero values, not strict positivity.' },
      { choiceIndex: 2, misconception: 'Ignoring division by zero singularity.', errorDiagnosis: 'f(5) = 1/0 is undefined in standard real analysis.' },
      { choiceIndex: 3, misconception: 'Confusing the excluded singularity with the valid domain.', errorDiagnosis: 'x = 5 is the point where the function fails to exist.' },
    ],
  },

  {
    id: 'math_lim_01',
    domain: 'mathematics',
    conceptId: 'limits_continuity',
    prerequisiteConceptId: 'functions_graphs',
    difficulty: 'intermediate',
    bloomLevel: 'apply',
    languages: {
      en: {
        question: 'Evaluate the limit: lim (x -> 3) [ (x^2 - 9) / (x - 3) ].',
        choices: [
          '6',
          '0',
          'Undefined / Infinity',
          '3',
        ],
      },
      ar: {
        question: 'احسب قيمة النهاية التالية: lim (x -> 3) [ (x^2 - 9) / (x - 3) ].',
        choices: [
          '6',
          '0',
          'غير معرفة / ما لا نهاية',
          '3',
        ],
      },
      fr: {
        question: 'Calculez la limite suivante : lim (x -> 3) [ (x^2 - 9) / (x - 3) ].',
        choices: [
          '6',
          '0',
          'Indéfinie / Infini',
          '3',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'Factor the numerator: (x - 3)(x + 3) / (x - 3) = x + 3 for x != 3. Evaluating as x -> 3 gives 3 + 3 = 6.',
    explanations: {
      en: 'Factor the numerator: (x - 3)(x + 3) / (x - 3) = x + 3 for x != 3. Evaluating as x -> 3 gives 3 + 3 = 6.',
      ar: 'بتحليل فرق المربعين في البسط نحصل على: (x - 3)(x + 3) / (x - 3) = x + 3، وبالتعويض عند اقتراب x من 3 ينتج 3 + 3 = 6.',
      fr: 'En factorisant le numérateur : (x - 3)(x + 3) / (x - 3) = x + 3 pour x != 3. En tendant vers 3, on obtient 3 + 3 = 6.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Prematurely concluding 0/0 indeterminate form equals 0.', errorDiagnosis: '0/0 requires algebraic cancellation or L’Hôpital’s rule.' },
      { choiceIndex: 2, misconception: 'Assuming 0 in the denominator always forces divergence to infinity.', errorDiagnosis: 'Removable discontinuities have finite, well-defined limits.' },
      { choiceIndex: 3, misconception: 'Substituting directly into one term while ignoring the factored remainder.', errorDiagnosis: 'The remaining term after factoring is x + 3, not x.' },
    ],
  },

  {
    id: 'math_der_01',
    domain: 'mathematics',
    conceptId: 'derivatives',
    prerequisiteConceptId: 'limits_continuity',
    difficulty: 'intermediate',
    bloomLevel: 'analyze',
    languages: {
      en: {
        question: 'What is the derivative of f(x) = 3x^3 - 5x + 4 evaluated at x = 2?',
        choices: [
          '31',
          '26',
          '18',
          '36',
        ],
      },
      ar: {
        question: 'ما هي قيمة مشتقة الدالة f(x) = 3x^3 - 5x + 4 عند النقطة x = 2؟',
        choices: [
          '31',
          '26',
          '18',
          '36',
        ],
      },
      fr: {
        question: 'Quelle est la valeur de la dérivée de f(x) = 3x^3 - 5x + 4 évaluée en x = 2 ?',
        choices: [
          '31',
          '26',
          '18',
          '36',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'By power rule: f’(x) = 9x^2 - 5. Evaluating at x = 2: f’(2) = 9(2^2) - 5 = 9(4) - 5 = 36 - 5 = 31.',
    explanations: {
      en: 'By power rule: f’(x) = 9x^2 - 5. Evaluating at x = 2: f’(2) = 9(2^2) - 5 = 9(4) - 5 = 36 - 5 = 31.',
      ar: 'بتطبيق قاعدة القوى في التفاضل: f’(x) = 9x^2 - 5. وبالتعويض عند x = 2: 9(4) - 5 = 36 - 5 = 31.',
      fr: 'En appliquant la règle des puissances : f’(x) = 9x^2 - 5. En x = 2 : 9(4) - 5 = 36 - 5 = 31.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Evaluating the original function f(2) instead of the derivative f’(2).', errorDiagnosis: 'f(2) = 3(8) - 10 + 4 = 18; questions asking for the derivative require f’(x).' },
      { choiceIndex: 2, misconception: 'Arithmetic subtraction slip during evaluation.', errorDiagnosis: '9 * 4 = 36; 36 - 5 = 31, not 26.' },
      { choiceIndex: 3, misconception: 'Forgetting the linear term derivative (-5x -> -5).', errorDiagnosis: 'Derivative of -5x is -5; dropping it leaves 9(4) = 36 incorrectly.' },
    ],
  },

  {
    id: 'math_int_01',
    domain: 'mathematics',
    conceptId: 'integrals',
    prerequisiteConceptId: 'derivatives',
    difficulty: 'advanced',
    bloomLevel: 'evaluate',
    languages: {
      en: {
        question: 'By the Fundamental Theorem of Calculus, evaluate the definite integral: ∫ from 0 to 2 of (3x^2 + 2x) dx.',
        choices: [
          '12',
          '8',
          '16',
          '6',
        ],
      },
      ar: {
        question: 'بالاستناد إلى النظرية الأساسية للتفاضل والتكامل، احسب قيمة التكامل المحدد: ∫ من 0 إلى 2 للدالة (3x^2 + 2x) dx.',
        choices: [
          '12',
          '8',
          '16',
          '6',
        ],
      },
      fr: {
        question: 'D’après le théorème fondamental de l’analyse, calculez l’intégrale définie : ∫ de 0 à 2 de (3x^2 + 2x) dx.',
        choices: [
          '12',
          '8',
          '16',
          '6',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'Antiderivative F(x) = x^3 + x^2. Evaluate from 0 to 2: F(2) - F(0) = (2^3 + 2^2) - 0 = 8 + 4 = 12.',
    explanations: {
      en: 'Antiderivative F(x) = x^3 + x^2. Evaluate from 0 to 2: F(2) - F(0) = (2^3 + 2^2) - 0 = 8 + 4 = 12.',
      ar: 'الدالة الأصلية F(x) = x^3 + x^2. وبالتعويض بحدود التكامل: F(2) - F(0) = (8 + 4) - 0 = 12.',
      fr: 'La primitive est F(x) = x^3 + x^2. En évaluant de 0 à 2 : F(2) - F(0) = (8 + 4) - 0 = 12.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Evaluating only the leading cubic term (2^3 = 8) and dropping the quadratic term.', errorDiagnosis: 'Integration is linear; both 3x^2 and 2x must be integrated.' },
      { choiceIndex: 2, misconception: 'Differentiating the integrand instead of integrating.', errorDiagnosis: 'Differentiating 3x^2 + 2x yields 6x + 2, evaluated at 2 gives 14.' },
      { choiceIndex: 3, misconception: 'Dividing coefficients incorrectly during antiderivative computation.', errorDiagnosis: '∫ 3x^2 dx = x^3 and ∫ 2x dx = x^2.' },
    ],
  },

  {
    id: 'math_int_02',
    domain: 'mathematics',
    conceptId: 'integrals',
    prerequisiteConceptId: 'derivatives',
    difficulty: 'advanced',
    bloomLevel: 'create',
    languages: {
      en: {
        question: 'Which definite integral formulation correctly calculates the volume of revolution formed by rotating y = sqrt(x) from x = 0 to x = 4 about the x-axis?',
        choices: [
          'π ∫ (0 to 4) x dx = 8π',
          '∫ (0 to 4) sqrt(x) dx = 16/3',
          '2π ∫ (0 to 4) x^2 dx = 128π / 3',
          'π^2 ∫ (0 to 4) x^2 dx = 64π^2 / 3',
        ],
      },
      ar: {
        question: 'ما هي صيغة التكامل المحدد الصحيحة لحساب حجم المجسم الدوراني الناتج عن تدوير y = sqrt(x) من x = 0 إلى x = 4 حول محور السينات (x-axis)؟',
        choices: [
          'π ∫ (من 0 إلى 4) x dx = 8π',
          '∫ (من 0 إلى 4) sqrt(x) dx = 16/3',
          '2π ∫ (من 0 إلى 4) x^2 dx = 128π / 3',
          'π^2 ∫ (من 0 إلى 4) x^2 dx = 64π^2 / 3',
        ],
      },
      fr: {
        question: 'Quelle formulation d’intégrale définie calcule correctement le volume de révolution généré par la rotation de y = sqrt(x) de x = 0 à x = 4 autour de l’axe des x ?',
        choices: [
          'π ∫ (de 0 à 4) x dx = 8π',
          '∫ (de 0 à 4) sqrt(x) dx = 16/3',
          '2π ∫ (de 0 à 4) x^2 dx = 128π / 3',
          'π^2 ∫ (de 0 à 4) x^2 dx = 64π^2 / 3',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'Using the disk method: V = π ∫ [f(x)]^2 dx. Since f(x) = sqrt(x), [f(x)]^2 = x. Integrating π ∫_0^4 x dx = π [x^2/2]_0^4 = 8π.',
    explanations: {
      en: 'Using the disk method: V = π ∫ [f(x)]^2 dx. Since f(x) = sqrt(x), [f(x)]^2 = x. Integrating π ∫_0^4 x dx = π [x^2/2]_0^4 = 8π.',
      ar: 'باستخدام طريقة الأقراص الدائرية: الحجم V = π ∫ [f(x)]^2 dx. وبتربيع الجذر نحصل على x، والتكامل يعطي π [x^2 / 2] من 0 إلى 4 أي 8π.',
      fr: 'Par la méthode des disques : V = π ∫ [f(x)]^2 dx. Comme f(x) = sqrt(x), [f(x)]^2 = x. L’intégrale donne π [x^2/2]_0^4 = 8π.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Calculating 2D cross-sectional area under the curve rather than 3D solid volume.', errorDiagnosis: 'Volume requires integrating cross-sectional circular disks π [f(x)]^2.' },
      { choiceIndex: 2, misconception: 'Confusing the disk method with the cylindrical shells method.', errorDiagnosis: 'Rotating around x-axis with disks uses radius y, not 2π x.' },
      { choiceIndex: 3, misconception: 'Squaring the scalar π constant arbitrarily.', errorDiagnosis: 'Circular area is π r^2, not (π r)^2.' },
    ],
  },

  // ==========================================================================
  // DOMAIN 4: ACCESSIBILITY & INCLUSIVE TECH
  // ==========================================================================
  {
    id: 'a11y_fund_01',
    domain: 'accessibility',
    conceptId: 'a11y_fundamentals',
    difficulty: 'foundational',
    bloomLevel: 'remember',
    languages: {
      en: {
        question: 'What are the four foundational principles underpinning the Web Content Accessibility Guidelines (WCAG - POUR)?',
        choices: [
          'Perceivable, Operable, Understandable, Robust.',
          'Protected, Optimized, Usable, Responsive.',
          'Precise, Open, Universal, Reliable.',
          'Performant, Organized, Unified, Resilient.',
        ],
      },
      ar: {
        question: 'ما هي المبادئ الأربعة التأسيسية التي ترتكز عليها إرشادات إتاحة محتوى الويب (معايير WCAG - POUR)؟',
        choices: [
          'قابل للإدراك (Perceivable)، قابل للتشغيل (Operable)، قابل للفهم (Understandable)، متين (Robust).',
          'محمي (Protected)، محسن (Optimized)، قابل للاستخدام (Usable)، متجاوب (Responsive).',
          'دقيق (Precise)، مفتوح (Open)، شامل (Universal)، موثوق (Reliable).',
          'سريع الأداء (Performant)، منظم (Organized)، موحد (Unified)، مرن (Resilient).',
        ],
      },
      fr: {
        question: 'Quels sont les quatre principes fondamentaux des Règles pour l’accessibilité des contenus Web (WCAG - POUR) ?',
        choices: [
          'Perceptible, Utilisable, Compréhensible, Robuste.',
          'Protégé, Optimisé, Utilisable, Réactif.',
          'Précis, Ouvert, Universel, Fiable.',
          'Performant, Organisé, Unifié, Résilient.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'The WCAG 2.x standard is structured hierarchically under 4 core principles: Perceivable, Operable, Understandable, and Robust (POUR).',
    explanations: {
      en: 'The WCAG 2.x standard is structured hierarchically under 4 core principles: Perceivable, Operable, Understandable, and Robust (POUR).',
      ar: 'تنظم معايير WCAG 2.x إمكانية الوصول الرقمي ضمن 4 مبادئ رئيسية تُعرف باختصار POUR.',
      fr: 'Les recommandations WCAG 2.x reposent sur 4 principes fondamentaux : Perceptible, Utilisable, Compréhensible et Robuste (POUR).',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Conflating accessibility principles with general mobile app UX buzzwords.', errorDiagnosis: 'POUR is the official W3C normative framework.' },
      { choiceIndex: 2, misconception: 'Confusing accessibility with open-source software principles.', errorDiagnosis: 'Accessibility focuses on disability accommodation and assistive technology interop.' },
      { choiceIndex: 3, misconception: 'Conflating cloud microservice resilience principles with web accessibility.', errorDiagnosis: 'POUR specifically governs user sensory and assistive perception.' },
    ],
  },

  {
    id: 'a11y_sem_01',
    domain: 'accessibility',
    conceptId: 'semantic_html',
    prerequisiteConceptId: 'a11y_fundamentals',
    difficulty: 'foundational',
    bloomLevel: 'understand',
    languages: {
      en: {
        question: 'Why is using a native `<button>` element strongly preferred over an interactive `<div onclick="...">` in inclusive web development?',
        choices: [
          'Native `<button>` inherently supports keyboard focus (Tab), Enter/Space activation, and communicates its role to assistive tech without custom code.',
          'Native `<button>` elements render faster because they bypass the browser DOM tree.',
          '`<div>` elements are restricted from receiving any CSS styling in modern browsers.',
          'Screen readers completely ignore any HTML element with an `onclick` attribute.',
        ],
      },
      ar: {
        question: 'لماذا يُفضل استخدام عنصر `<button>` الأصلي بقوة على استخدام `<div onclick="...">` في تطوير الويب الشامل للجميع؟',
        choices: [
          'لأن `<button>` يدعم تلقائياً التنقل بلوحة المفاتيح (Tab) والتفعيل بـ Enter/Space ويعلن عن دوره لقارئات الشاشة بدون كود إضافي.',
          'لأن عناصر `<button>` ترسم أسرع لتخطيها شجرة الـ DOM.',
          'لأن عناصر `<div>` ممنوعة من استقبال تنسيقات CSS في المتصفحات الحديثة.',
          'لأن قارئات الشاشة تتجاهل تلقائياً أي عنصر يحتوي على خاصية `onclick`.',
        ],
      },
      fr: {
        question: 'Pourquoi l’utilisation d’un élément natif `<button>` est-elle fortement préférée à un `<div onclick="...">` en développement web accessible ?',
        choices: [
          'L’élément natif `<button>` prend en charge le focus clavier (Tab), l’activation par Entrée/Espace et communique son rôle aux technologies d’assistance.',
          'Les éléments `<button>` natifs s’affichent plus vite car ils contournent l’arbre DOM.',
          'Les éléments `<div>` ne peuvent pas recevoir de styles CSS dans les navigateurs modernes.',
          'Les lecteurs d’écran ignorent complètement tout élément HTML doté d’un attribut `onclick`.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'Native buttons provide out-of-the-box keyboard operability, focusability, accessibility tree exposure, and state handling without ARIA shims.',
    explanations: {
      en: 'Native buttons provide out-of-the-box keyboard operability, focusability, accessibility tree exposure, and state handling without ARIA shims.',
      ar: 'عنصر الزر الأصلي يوفر وصولية تلقائية بلوحة المفاتيح، والتركيز، والربط بشجرة قارئ الشاشة دون الحاجة لإعادة برمجتها يدوياً.',
      fr: 'Les boutons natifs fournissent nativement la navigabilité au clavier, la focalisation et la transmission du rôle à l’arbre d’accessibilité.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Assuming native HTML tags bypass DOM construction.', errorDiagnosis: 'All HTML tags are instantiated as nodes within the standard DOM tree.' },
      { choiceIndex: 2, misconception: 'Believing div elements lack CSS support.', errorDiagnosis: 'Divs are styled identically; the difference lies in semantic accessibility behavior.' },
      { choiceIndex: 3, misconception: 'Assuming assistive technology strips elements containing script attributes.', errorDiagnosis: 'Screen readers read the element, but without role="button", users cannot know it is clickable.' },
    ],
  },

  {
    id: 'a11y_aria_01',
    domain: 'accessibility',
    conceptId: 'aria_standards',
    prerequisiteConceptId: 'semantic_html',
    difficulty: 'intermediate',
    bloomLevel: 'apply',
    languages: {
      en: {
        question: 'What is the First Rule of ARIA Use according to the W3C Web Accessibility Initiative (WAI)?',
        choices: [
          'If you can use a native HTML element or attribute with the semantics and behavior you require, do so instead of re-purposing an element with ARIA.',
          'Always append `role="presentation"` to every container element on the page.',
          'Replace all native form inputs with custom `<div>` controls powered by `aria-label`.',
          'Every interactive element must define at least three separate ARIA attributes.',
        ],
      },
      ar: {
        question: 'ما هي "القاعدة الأولى لاستخدام ARIA" وفقاً لمنظمة W3C ومبادرة إتاحة الويب (WAI)؟',
        choices: [
          'إذا كان بإمكانك استخدام عنصر أو خاصية HTML أصلية توفر الدلالات والسلوك المطلوب، فاستخدمها بدلاً من إعادة ابتكارها بـ ARIA.',
          'إضافة `role="presentation"` دائماً لكل حاوية في الصفحة.',
          'استبدال كافة حقول الإدخال الأصلية بحاويات `<div>` مخصصة باستخدام `aria-label`.',
          'يجب على كل عنصر تفاعلي تعريف 3 سمات ARIA على الأقل.',
        ],
      },
      fr: {
        question: 'Quelle est la première règle d’utilisation d’ARIA selon l’initiative WAI du W3C ?',
        choices: [
          'Si vous pouvez utiliser un élément ou un attribut HTML natif ayant la sémantique et le comportement requis, faites-le plutôt que de réécrire avec ARIA.',
          'Toujours ajouter `role="presentation"` sur chaque conteneur de la page.',
          'Remplacer tous les champs de saisie natifs par des `<div>` personnalisés avec `aria-label`.',
          'Chaque élément interactif doit obligatoirement définir au moins trois attributs ARIA distincts.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'The 1st Rule of ARIA dictates: "If you can use a native HTML element or attribute with the semantics and behavior already built in, then do so."',
    explanations: {
      en: 'The 1st Rule of ARIA dictates: "If you can use a native HTML element or attribute with the semantics and behavior already built in, then do so."',
      ar: 'تنص القاعدة الأولى لـ ARIA على: إذا كان هناك عنصر HTML أصلي يؤدي الغرض، استخدمه وتجنب إضافة سمات ARIA غير الضرورية.',
      fr: 'La première règle d’ARIA stipule que si un élément HTML natif possède déjà la sémantique requise, il faut l’utiliser en priorité.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Over-applying `role="presentation"` which strips valid semantic landmarks.', errorDiagnosis: 'Presentation role strips semantic meaning from elements.' },
      { choiceIndex: 2, misconception: 'Assuming custom ARIA implementations are superior to native HTML controls.', errorDiagnosis: 'Custom ARIA frequently introduces subtle keyboard and touch accessibility bugs.' },
      { choiceIndex: 3, misconception: 'Believing ARIA compliance requires arbitrary attribute counts.', errorDiagnosis: 'No ARIA attribute should be added unless strictly necessary to bridge semantic gaps.' },
    ],
  },

  {
    id: 'a11y_sr_01',
    domain: 'accessibility',
    conceptId: 'screen_readers',
    prerequisiteConceptId: 'aria_standards',
    difficulty: 'intermediate',
    bloomLevel: 'analyze',
    languages: {
      en: {
        question: 'How does an `aria-live="polite"` region behave when its textual content is updated while a screen reader is actively reciting another sentence?',
        choices: [
          'The screen reader waits until the current announcement or user action finishes before gently reading the update.',
          'The screen reader immediately interrupts the ongoing speech to blurt out the update.',
          'The update is permanently ignored and never announced to the student.',
          'The screen reader forces a complete page reload.',
        ],
      },
      ar: {
        question: 'كيف يتصرف قارئ الشاشة مع منطقة محددة بـ `aria-live="polite"` عندما يتغير نصها أثناء قيامه بقراءة جملة أخرى للمستخدم؟',
        choices: [
          'ينتظر قارئ الشاشة حتى يكمل الجملة الحالية أو يصبح المستخدم في وضع السكون قبل قراءة التحديث بهدوء.',
          'يقاطع كلامه الحالي فوراً بصورة مفاجئة لقراءة التحديث الجديد.',
          'يتجاهل التحديث تماماً ولا يقرؤه أبداً للمستخدم.',
          'يجبر المتصفح على إعادة تحميل كامل الصفحة.',
        ],
      },
      fr: {
        question: 'Comment se comporte une région `aria-live="polite"` lorsque son contenu change alors que le lecteur d’écran est en train de lire une phrase ?',
        choices: [
          'Le lecteur d’écran attend que l’annonce en cours soit terminée pour vocaliser la mise à jour.',
          'Le lecteur d’écran interrompt immédiatement son élocution en cours pour énoncer la mise à jour.',
          'La mise à jour est ignorée définitivement et jamais lue à l’utilisateur.',
          'Le lecteur d’écran force un rechargement complet de la page.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: '`polite` live regions queue announcements until speech finishes. In contrast, `assertive` live regions interrupt immediate speech.',
    explanations: {
      en: '`polite` live regions queue announcements until speech finishes. In contrast, `assertive` live regions interrupt immediate speech.',
      ar: 'المناطق الهادئة `polite` تؤجل الإعلان حتى ينتهي قارئ الشاشة من حديثه الحالي، بينما المناطق الحازمة `assertive` تقاطع الحديث فوراً.',
      fr: 'Les régions `polite` mettent en attente l’annonce jusqu’à ce que le lecteur soit inactif, contrairement aux régions `assertive`.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Confusing `polite` with `aria-live="assertive"`.', errorDiagnosis: '`assertive` interrupts immediately; `polite` queues politely.' },
      { choiceIndex: 2, misconception: 'Assuming polite live regions are silent.', errorDiagnosis: 'Polite live regions are always read; they simply wait for an appropriate pause.' },
      { choiceIndex: 3, misconception: 'Thinking live region updates trigger navigation reloads.', errorDiagnosis: 'Live regions provide non-intrusive DOM announcement without page navigation.' },
    ],
  },

  {
    id: 'a11y_wcag_01',
    domain: 'accessibility',
    conceptId: 'wcag_compliance',
    prerequisiteConceptId: 'aria_standards',
    difficulty: 'advanced',
    bloomLevel: 'evaluate',
    languages: {
      en: {
        question: 'According to WCAG 2.2 Level AA guidelines, what is the minimum required color contrast ratio for normal body text against its background?',
        choices: [
          '4.5:1',
          '3.0:1',
          '7.0:1',
          '1.5:1',
        ],
      },
      ar: {
        question: 'وفقاً لمعايير WCAG 2.2 المستوى AA، ما هي أدنى نسبة تباين لوني مقبولة للنصوص العادية مقابل خلفيتها؟',
        choices: [
          '4.5:1',
          '3.0:1',
          '7.0:1',
          '1.5:1',
        ],
      },
      fr: {
        question: 'Selon les règles WCAG 2.2 de niveau AA, quel est le ratio minimal de contraste de couleur requis pour du texte ordinaire sur son arrière-plan ?',
        choices: [
          '4.5:1',
          '3.0:1',
          '7.0:1',
          '1.5:1',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'WCAG 2.2 AA requires a 4.5:1 contrast ratio for normal text and 3:1 for large text (>= 18pt or 14pt bold). Level AAA requires 7:1.',
    explanations: {
      en: 'WCAG 2.2 AA requires a 4.5:1 contrast ratio for normal text and 3:1 for large text (>= 18pt or 14pt bold). Level AAA requires 7:1.',
      ar: 'يشترط معيار WCAG 2.2 AA نسبة تباين 4.5:1 للنصوص العادية و 3:1 للعناوين الكبيرة، بينما يشترط المستوى AAA نسبة 7:1.',
      fr: 'Le niveau AA des WCAG 2.2 exige un ratio de contraste de 4.5:1 pour le texte normal et de 3:1 pour le grand texte.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Confusing normal text requirement with large text requirement.', errorDiagnosis: '3.0:1 is permissible only for large text (>= 18pt regular or >= 14pt bold).' },
      { choiceIndex: 2, misconception: 'Confusing Level AA requirement with Level AAA requirement.', errorDiagnosis: '7.0:1 is the strict enhanced Level AAA threshold.' },
      { choiceIndex: 3, misconception: 'Accepting low-contrast light grey text on white backgrounds.', errorDiagnosis: '1.5:1 fails accessibility audits and renders text illegible for low-vision users.' },
    ],
  },

  {
    id: 'a11y_wcag_02',
    domain: 'accessibility',
    conceptId: 'wcag_compliance',
    prerequisiteConceptId: 'aria_standards',
    difficulty: 'advanced',
    bloomLevel: 'create',
    languages: {
      en: {
        question: 'When engineering an inclusive modal dialog component from scratch, which combination of keyboard and focus management rules must be implemented to avoid accessibility failures?',
        choices: [
          'Trap Tab navigation within the modal, close on Escape, move initial focus inside the dialog upon opening, and restore focus to the trigger button upon closing.',
          'Allow Tab focus to freely cycle into the obscured background page while the modal is open.',
          'Prevent the Escape key from closing the dialog so the student cannot accidentally lose state.',
          'Discard user focus completely to the top `<body>` element when the modal is dismissed.',
        ],
      },
      ar: {
        question: 'عند بناء نافذة منبثقة (Modal Dialog) متوافقة مع معايير الوصول، ما هي حزمة قواعد إدارة التركيز ولوحة المفاتيح الواجب تطبيقها برمجياً؟',
        choices: [
          'حصر التنقل بالـ Tab داخل النافذة، الإغلاق بزر Escape، نقل التركيز لداخل النافذة عند الفتح، وإعادة التركيز للزر المشغل عند الإغلاق.',
          'السماح للـ Tab بالخروج إلى الصفحة الخلفية المحجوبة أثناء فتح النافذة.',
          'تعطيل زر Escape تماماً لمنع إغلاق النافذة بالخطأ.',
          'نقل التركيز إلى أعلى عنصر في الصفحة `<body>` عند إغلاق النافذة.',
        ],
      },
      fr: {
        question: 'Lors de la conception d’une boîte de dialogue modale accessible, quel ensemble de règles de gestion du focus et du clavier doit être implémenté ?',
        choices: [
          'Piéger le focus Tab à l’intérieur, fermer avec Échap, placer le focus dans la modale à l’ouverture et le restituer au déclencheur à la fermeture.',
          'Laisser le focus Tab circuler librement vers la page d’arrière-plan lorsque la modale est active.',
          'Désactiver la touche Échap pour éviter toute fermeture accidentelle.',
          'Renvoyer le focus en haut du document (`<body>`) lors de la fermeture.',
        ],
      },
    },
    correctAnswerIndex: 0,
    explanation: 'Accessible modals require a focus trap (to prevent losing focus into the inert background), Escape key dismissal, and restoring focus to the originating trigger.',
    explanations: {
      en: 'Accessible modals require a focus trap (to prevent losing focus into the inert background), Escape key dismissal, and restoring focus to the originating trigger.',
      ar: 'النوافذ المنبثقة سهلة الوصول تشترط حصر التركيز بالداخل (Focus Trap)، إتاحة الإغلاق بمفتاح Escape، واستعادة مكان التركيز السابق عند الإغلاق.',
      fr: 'Les modales accessibles exigent un piège à focus (focus trap), la fermeture via Échap et la restitution du focus au bouton déclencheur.',
    },
    commonDistractors: [
      { choiceIndex: 1, misconception: 'Allowing keyboard focus to bleed into inert obscured background elements.', errorDiagnosis: 'Focus leaking into obscured background violates WCAG 2.4.3 Focus Order.' },
      { choiceIndex: 2, misconception: 'Disabling standard escape mechanisms.', errorDiagnosis: 'WCAG 2.1.2 No Keyboard Trap mandates keyboard users can escape dialogs easily.' },
      { choiceIndex: 3, misconception: 'Failing to preserve prior focus context upon modal dismissal.', errorDiagnosis: 'Dumping focus to body forces screen reader users to navigate the entire page again.' },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS (Requirement 11)
// ============================================================================

/**
 * Filters the benchmark evaluation dataset by academic domain.
 * Supports exact domain keys and natural language aliases (case-insensitive).
 */
export function getDatasetByDomain(domain: string): EvaluationItem[] {
  if (!domain || typeof domain !== 'string') return [];
  const norm = domain.toLowerCase().trim().replace(/[\s&/_-]+/g, '');

  if (norm === 'computerscience' || norm === 'cs' || norm.startsWith('algo') || norm.includes('computer')) {
    return EVALUATION_DATASET.filter((item) => item.domain === 'computer_science');
  }
  if (norm === 'webdevelopment' || norm === 'web' || norm === 'webdev' || norm.startsWith('front')) {
    return EVALUATION_DATASET.filter((item) => item.domain === 'web_development');
  }
  if (norm === 'mathematics' || norm === 'math' || norm.startsWith('calc') || norm.startsWith('algeb')) {
    return EVALUATION_DATASET.filter((item) => item.domain === 'mathematics');
  }
  if (norm === 'accessibility' || norm === 'a11y' || norm.startsWith('inclus') || norm.includes('access')) {
    return EVALUATION_DATASET.filter((item) => item.domain === 'accessibility');
  }

  return EVALUATION_DATASET.filter((item) => {
    const itemDom = item.domain.toLowerCase().replace(/[\s&/_-]+/g, '');
    return itemDom === norm || item.domain === domain;
  });
}

/**
 * Filters the benchmark evaluation dataset by concept identifier.
 */
export function getDatasetByConcept(conceptId: string): EvaluationItem[] {
  if (!conceptId || typeof conceptId !== 'string') return [];
  const clean = conceptId.toLowerCase().trim().replace(/[\s-]+/g, '_');
  return EVALUATION_DATASET.filter((item) => item.conceptId === clean);
}

/**
 * Returns localized questions for a specific language ('ar' | 'en' | 'fr').
 */
export function getQuestionsForLanguage(lang: 'ar' | 'en' | 'fr' | string): LocalizedEvaluationQuestion[] {
  const norm = (lang || 'en').toLowerCase().trim();
  const selectedLang: 'ar' | 'en' | 'fr' =
    norm.startsWith('ar') ? 'ar' :
    norm.startsWith('fr') ? 'fr' : 'en';

  return EVALUATION_DATASET.map((item) => ({
    id: item.id,
    domain: item.domain,
    conceptId: item.conceptId,
    prerequisiteConceptId: item.prerequisiteConceptId,
    difficulty: item.difficulty,
    bloomLevel: item.bloomLevel,
    language: selectedLang,
    question: item.languages[selectedLang].question,
    choices: item.languages[selectedLang].choices,
    correctAnswerIndex: item.correctAnswerIndex,
    explanation: item.explanations ? item.explanations[selectedLang] : item.explanation,
    commonDistractors: item.commonDistractors,
  }));
}

/**
 * Recursively resolves the prerequisite dependency chain for a given concept.
 * Returns an ordered array of prerequisite concept IDs from immediate prerequisite
 * to the deepest root foundational concept.
 */
export function getPrerequisiteChain(conceptId: string): string[] {
  if (!conceptId || typeof conceptId !== 'string') return [];
  const clean = conceptId.toLowerCase().trim().replace(/[\s-]+/g, '_');
  const chain: string[] = [];
  const visited = new Set<string>();

  function traverse(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    // 1. Check direct dataset prerequisiteConceptId links
    const directDatasetPrereqs = EVALUATION_DATASET
      .filter((it) => it.conceptId === currentId && it.prerequisiteConceptId)
      .map((it) => it.prerequisiteConceptId!);

    // 2. Check concept graph registry prerequisites
    const registryNode = CONCEPT_REGISTRY[currentId];
    const registryPrereqs = registryNode?.prerequisites || [];

    const combinedPrereqs = Array.from(new Set([...directDatasetPrereqs, ...registryPrereqs]));

    for (const p of combinedPrereqs) {
      if (!chain.includes(p)) {
        chain.push(p);
      }
      traverse(p);
    }
  }

  traverse(clean);
  return chain;
}
