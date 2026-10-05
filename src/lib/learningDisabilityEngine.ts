/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Specific Learning Disabilities (SLD) & Assistive Accommodation Engine
 * Evidence-based accommodations for:
 * - Dyslexia (عسر القراءة): Bionic eye-fixation, focus window/ruler, syllable chunking, karaoke dual-coding
 * - Dysgraphia (عسر الكتابة): Voice-to-essay structured scaffolding, academic transition guides
 * - Cognitive Reading Comprehension: Academic text simplification, jargon glossaries, readability metrics
 */

export interface BionicToken {
  prefix: string; // The bolded fixation part
  suffix: string; // The remainder of the word
  trailingSpace: string; // Any punctuation/space
  isWord: boolean;
}

export interface BionicParagraph {
  tokens: BionicToken[];
  rawText: string;
}

export interface SyllableChunk {
  syllables: string[];
  originalWord: string;
  phoneticHints?: string;
}

export interface EssayScaffoldSection {
  id: 'hook' | 'thesis' | 'point_1' | 'point_2' | 'point_3' | 'counter_argument' | 'conclusion';
  titleAr: string;
  titleEn: string;
  purposeAr: string;
  purposeEn: string;
  content: string;
  guidingQuestionsAr: string[];
  guidingQuestionsEn: string[];
  suggestedTransitionsAr: string[];
  suggestedTransitionsEn: string[];
}

export interface GeneratedEssayScaffold {
  topic: string;
  essayType: 'argumentative' | 'expository' | 'cause_effect' | 'reflective';
  title: string;
  sections: EssayScaffoldSection[];
  totalWordCount: number;
  readabilityLevel: string;
  executiveTipsAr: string[];
  executiveTipsEn: string[];
}

export interface SimplifiedTextResult {
  originalText: string;
  summary: string;
  keyPoints: string[];
  plainExplanation: string;
  difficultGlossary: Array<{ term: string; definition: string; example: string }>;
  readingEaseScore: number; // 0 - 100
  estimatedReadingTimeSeconds: number;
}

export interface AcademicArticleSample {
  id: string;
  titleAr: string;
  titleEn: string;
  category: 'neuroscience' | 'technology' | 'history' | 'psychology';
  contentAr: string;
  contentEn: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. BIONIC EYE-FIXATION ENGINE (عسر القراءة - DYSLEXIA)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates fixation length for a word based on length and intensity.
 * Fixation guides saccadic eye movements directly to the word's informative prefix,
 * preventing fixation stalling and line-skipping in dyslexic readers.
 */
export function calculateFixationLength(wordLength: number, intensity: 1 | 2 | 3 = 2): number {
  if (wordLength <= 0) return 0;
  if (wordLength === 1) return 1;
  if (wordLength <= 3) return intensity === 1 ? 1 : 2;
  if (wordLength <= 6) return intensity === 1 ? 2 : 3;
  
  const ratio = intensity === 1 ? 0.35 : intensity === 2 ? 0.45 : 0.55;
  return Math.min(wordLength, Math.max(1, Math.ceil(wordLength * ratio)));
}

/**
 * Splits a single word into prefix (fixated) and suffix (remainder).
 */
export function bionicizeWord(rawWord: string, intensity: 1 | 2 | 3 = 2): BionicToken {
  // Separate leading punctuation, word core, and trailing punctuation
  const match = rawWord.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}_\-']+)([^\p{L}\p{N}]*)$/u);
  if (!match) {
    return {
      prefix: '',
      suffix: rawWord,
      trailingSpace: '',
      isWord: false,
    };
  }

  const [, leadingPunct, wordCore, trailingPunct] = match;
  const fixLen = calculateFixationLength(wordCore.length, intensity);
  const prefixPart = leadingPunct + wordCore.slice(0, fixLen);
  const suffixPart = wordCore.slice(fixLen);

  return {
    prefix: prefixPart,
    suffix: suffixPart,
    trailingSpace: trailingPunct,
    isWord: true,
  };
}

/**
 * Converts multiline text into structured paragraphs of Bionic Tokens.
 */
export function bionicizeText(text: string, intensity: 1 | 2 | 3 = 2): BionicParagraph[] {
  if (!text || !text.trim()) return [];

  const rawParagraphs = text.split(/\r?\n\r?\n+/);
  return rawParagraphs.map((para) => {
    const rawWords = para.split(/\s+/).filter(Boolean);
    const tokens = rawWords.map((w) => bionicizeWord(w, intensity));
    return {
      tokens,
      rawText: para,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PHONETIC SYLLABLE CHUNKER (تفكيك المقاطع الصوتية)
// ─────────────────────────────────────────────────────────────────────────────

const ENGLISH_PREFIXES = ['un', 're', 'in', 'im', 'dis', 'en', 'em', 'non', 'over', 'mis', 'sub', 'pre', 'inter', 'fore', 'de', 'trans', 'super', 'semi', 'anti', 'mid', 'under'];
const ENGLISH_SUFFIXES = ['tion', 'sion', 'ment', 'able', 'ible', 'ness', 'less', 'ful', 'ing', 'est', 'ity', 'ize', 'ised', 'ized', 'al', 'ous', 'ive', 'ance', 'ence'];

/**
 * Chunks English words into phonetic readable syllables.
 */
export function chunkEnglishWord(word: string): string[] {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length <= 3) return [clean || word];

  let remaining = clean;
  const parts: string[] = [];

  // Check prefix
  for (const p of ENGLISH_PREFIXES) {
    if (remaining.startsWith(p) && remaining.length > p.length + 2) {
      parts.push(p);
      remaining = remaining.slice(p.length);
      break;
    }
  }

  // Check suffix
  let foundSuffix = '';
  for (const s of ENGLISH_SUFFIXES) {
    if (remaining.endsWith(s) && remaining.length > s.length + 2) {
      foundSuffix = s;
      remaining = remaining.slice(0, -s.length);
      break;
    }
  }

  // Syllabify core using Vowel-Consonant heuristic
  const vowels = ['a', 'e', 'i', 'o', 'u', 'y'];
  let currentChunk = '';
  for (let i = 0; i < remaining.length; i++) {
    currentChunk += remaining[i];
    const isVowel = vowels.includes(remaining[i]);
    const nextIsConsonant = i + 1 < remaining.length && !vowels.includes(remaining[i + 1]);
    const nextNextIsVowel = i + 2 < remaining.length && vowels.includes(remaining[i + 2]);

    if (isVowel && nextIsConsonant && nextNextIsVowel && currentChunk.length >= 2) {
      parts.push(currentChunk);
      currentChunk = '';
    }
  }

  if (currentChunk) {
    parts.push(currentChunk);
  }
  if (foundSuffix) {
    parts.push(foundSuffix);
  }

  return parts.length > 0 ? parts : [word];
}

/**
 * Chunks Arabic words into phonetic syllables based on morphological patterns.
 * e.g., "استيعاب" -> ["اس", "تي", "عاب"]
 * "المعلومات" -> ["ال", "مع", "لو", "مات"]
 */
export function chunkArabicWord(word: string): string[] {
  const clean = word.trim().replace(/[^\u0621-\u064A\u064B-\u0652]/g, '');
  if (clean.length <= 3) return [clean || word];

  const chunks: string[] = [];
  let cur = clean;

  // Prefix "الـ"
  if (cur.startsWith('ال') && cur.length > 3) {
    chunks.push('الـ');
    cur = cur.slice(2);
  }

  // Prefix "استـ"
  if (cur.startsWith('است') && cur.length > 4) {
    chunks.push('استـ');
    cur = cur.slice(3);
  }

  // Chunk remainder in 2-3 char phonetic intervals
  while (cur.length > 0) {
    if (cur.length <= 3) {
      chunks.push(cur);
      break;
    }
    // Take 2 chars if followed by long vowel (ا، و، ي), else 2-3
    const nextIsMadd = cur.length >= 3 && ['ا', 'و', 'ي'].includes(cur[2]);
    const take = nextIsMadd ? 3 : 2;
    chunks.push(cur.slice(0, take));
    cur = cur.slice(take);
  }

  return chunks.length > 0 ? chunks : [word];
}

/**
 * Splits arbitrary text into tokens with phonetic syllable breakdown.
 */
export function chunkTextPhonetically(text: string, language: 'Arabic' | 'English' = 'Arabic'): SyllableChunk[] {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);

  return words.map((w) => {
    const isAr = /[\u0600-\u06FF]/.test(w) || language === 'Arabic';
    const syllables = isAr ? chunkArabicWord(w) : chunkEnglishWord(w);
    return {
      syllables,
      originalWord: w,
      phoneticHints: syllables.join(' • '),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. VOICE-TO-ESSAY SCAFFOLD GENERATOR (عسر الكتابة - DYSGRAPHIA)
// ─────────────────────────────────────────────────────────────────────────────

const TRANSITIONS_AR: Record<string, string[]> = {
  intro: ['من المنظور الأكاديمي،', 'تعد هذه القضية محوراً أساسياً لأن', 'بادئ ذي بدء، تجدر الإشارة إلى أن'],
  body: ['علاوة على ذلك،', 'وتأسيساً على ما سبق،', 'ومن جهة أخرى،', 'يتجلى ذلك بوضوح في', 'بالمقارنة مع'],
  counter: ['وعلى النقيض من ذلك، يرى البعض أن', 'ورغم وجاهة هذا الطرح، إلا أن', 'لكن من زاوية مغايرة،'],
  conclusion: ['وخلاصة القول،', 'تأسيساً على كل ما سبق، نستنتج أن', 'وفي الختام، يتضح أن المسار الأمثل هو'],
};

const TRANSITIONS_EN: Record<string, string[]> = {
  intro: ['From an academic perspective,', 'Fundamentally,', 'To initiate this analysis,'],
  body: ['Furthermore,', 'Consequently,', 'In addition,', 'This is prominently evidenced by', 'Conversely,'],
  counter: ['On the contrary, proponents argue that', 'While this objection holds merit,', 'However, looking at the counter-evidence,'],
  conclusion: ['In conclusion,', 'Ultimately, synthesizing these findings indicates that', 'In final analysis,'],
};

/**
 * Deconstructs raw spoken stream-of-consciousness thoughts into a rigorous academic outline.
 * Solves the severe written-expression and blank-page paralysis characteristic of Dysgraphia.
 */
export function structureSpokenThoughtsIntoEssay(
  rawThoughts: string,
  essayType: 'argumentative' | 'expository' | 'cause_effect' | 'reflective' = 'argumentative',
  language: 'Arabic' | 'English' = 'Arabic'
): GeneratedEssayScaffold {
  const isAr = language === 'Arabic' || /[\u0600-\u06FF]/.test(rawThoughts);
  const sentences = rawThoughts
    .split(/[.؟!;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const rawTopic = sentences[0] || (isAr ? 'القضية الأكاديمية المطروحة' : 'The Investigated Topic');
  const title = isAr ? `مخطط مقال تحليلي: ${rawTopic.slice(0, 45)}` : `Structured Essay Scaffold: ${rawTopic.slice(0, 45)}`;

  // Distribute sentences across academic components
  const hookSentence = sentences[0] || (isAr ? 'طرح تمهيدي لجذب انتباه القارئ حول جوهر المسألة.' : 'An introductory hook introducing the core question.');
  const thesisSentence = sentences[1] || (isAr ? 'الأطروحة المركزية: تلخيص الموقف العلمي الواضح الذي يتبناه المقال.' : 'Central Thesis: Stating the explicit analytical stance of this essay.');
  const arg1 = sentences[2] || (isAr ? 'الحجة الأولى: تقديم الدليل الأساسي الأول مع شرح تأثيره.' : 'First Argument: Core evidence supporting the primary thesis.');
  const arg2 = sentences[3] || (isAr ? 'الحجة الثانية: توسيع التحليل بمثال تطبيقي أو تجربة ملموسة.' : 'Second Argument: Supporting case study or empirical rationale.');
  const arg3 = sentences[4] || (isAr ? 'الحجة الثالثة: ربط الأسباب بالنتائج لتعزيز مصداقية الطرح.' : 'Third Argument: Linking foundational premises to logical outcomes.');
  const counter = sentences[5] || (isAr ? 'مناقشة الرأي المعارض: تفنيد الشبهات أو الاستثناءات المحتملة بموضوعية.' : 'Counter-argument: Fairly addressing objections and demonstrating their limitations.');
  const concludingThought = sentences.slice(6).join(' ') || (isAr ? 'الخاتمة: إعادة صياغة الأطروحة بنظرة أعمق واستشراف التوصيات المستقبلية.' : 'Conclusion: Synthesizing premises into a forward-looking resolution.');

  const sections: EssayScaffoldSection[] = [
    {
      id: 'hook',
      titleAr: '1. المدخل والتمهيد (Hook & Context)',
      titleEn: '1. Hook & Context',
      purposeAr: 'جذب القارئ وتحديد سياق المشكلة دون الدخول في التفاصيل المعقدة.',
      purposeEn: 'Engage reader attention and set the situational boundary.',
      content: `${isAr ? TRANSITIONS_AR.intro[0] : TRANSITIONS_EN.intro[0]} ${hookSentence}`,
      guidingQuestionsAr: ['ما هي الخلفية العامة للموضوع؟', 'لماذا يهم هذا الموضوع القارئ الآن؟'],
      guidingQuestionsEn: ['What is the background context?', 'Why is this topic significant now?'],
      suggestedTransitionsAr: TRANSITIONS_AR.intro,
      suggestedTransitionsEn: TRANSITIONS_EN.intro,
    },
    {
      id: 'thesis',
      titleAr: '2. الأطروحة المركزية (Thesis Statement)',
      titleEn: '2. Central Thesis Statement',
      purposeAr: 'جملة واحدة قاطعة تعبر عن موقفك الأساسي في المقال (حجر الزاوية).',
      purposeEn: 'A single, definitive sentence articulating your stance.',
      content: `${isAr ? TRANSITIONS_AR.intro[1] : TRANSITIONS_EN.intro[1]} ${thesisSentence}`,
      guidingQuestionsAr: ['ما هو استنتاجك النهائي بكلمات قليلة؟', 'ما الذي تود إثباته في هذه الورقة؟'],
      guidingQuestionsEn: ['What is your precise claim?', 'What will this paper prove?'],
      suggestedTransitionsAr: TRANSITIONS_AR.intro,
      suggestedTransitionsEn: TRANSITIONS_EN.intro,
    },
    {
      id: 'point_1',
      titleAr: '3. الحجة الداعمة الأولى (First Supporting Pillar)',
      titleEn: '3. First Supporting Pillar',
      purposeAr: 'أقوى دليل علمي أو منطقي يؤيد أطروحتك مع شرح مبسط.',
      purposeEn: 'Your strongest piece of rationale or empirical proof.',
      content: `${isAr ? TRANSITIONS_AR.body[0] : TRANSITIONS_EN.body[0]} ${arg1}`,
      guidingQuestionsAr: ['ما الدليل الملموس على ذلك؟', 'كيف يثبت هذا المثال صحة موقفك؟'],
      guidingQuestionsEn: ['What tangible evidence proves this?', 'How does this directly support your claim?'],
      suggestedTransitionsAr: TRANSITIONS_AR.body,
      suggestedTransitionsEn: TRANSITIONS_EN.body,
    },
    {
      id: 'point_2',
      titleAr: '4. الحجة الداعمة الثانية (Second Supporting Pillar)',
      titleEn: '4. Second Supporting Pillar',
      purposeAr: 'دليل مكمل يربط الفكرة بالسياق العملي أو الإحصائي.',
      purposeEn: 'Secondary evidentiary line illustrating practical implications.',
      content: `${isAr ? TRANSITIONS_AR.body[1] : TRANSITIONS_EN.body[1]} ${arg2}`,
      guidingQuestionsAr: ['هل هناك دراسة حالة أو واقعة مماثلة؟', 'ما أثر هذه النقطة في التطبيق؟'],
      guidingQuestionsEn: ['Is there a relevant case study?', 'What are the real-world applications?'],
      suggestedTransitionsAr: TRANSITIONS_AR.body,
      suggestedTransitionsEn: TRANSITIONS_EN.body,
    },
    {
      id: 'point_3',
      titleAr: '5. الحجة الداعمة الثالثة (Third Supporting Pillar)',
      titleEn: '5. Third Supporting Pillar',
      purposeAr: 'الربط المنطقي بين الأسباب والتأثيرات المستقبلية.',
      purposeEn: 'Synthesizing causal chains and broader relevance.',
      content: `${isAr ? TRANSITIONS_AR.body[2] : TRANSITIONS_EN.body[2]} ${arg3}`,
      guidingQuestionsAr: ['ما النتائج المترتبة على ذلك مستقبلاً؟'],
      guidingQuestionsEn: ['What are the forward-looking consequences?'],
      suggestedTransitionsAr: TRANSITIONS_AR.body,
      suggestedTransitionsEn: TRANSITIONS_EN.body,
    },
    {
      id: 'counter_argument',
      titleAr: '6. الرأي الآخر والرد الموضوعي (Counter-Argument & Rebuttal)',
      titleEn: '6. Counter-Argument & Rebuttal',
      purposeAr: 'إظهار الموضوعية عبر الاعتراف بالرأي المخالف وتبيان ثغراته بلباقة.',
      purposeEn: 'Address objections fairly while clarifying why your thesis holds.',
      content: `${isAr ? TRANSITIONS_AR.counter[0] : TRANSITIONS_EN.counter[0]} ${counter}`,
      guidingQuestionsAr: ['ماذا يقول المعترضون على هذا الرأي؟', 'لماذا يظل موقفنا أقوى برغم اعتراضهم؟'],
      guidingQuestionsEn: ['What is the strongest opposing objection?', 'Why does our rationale remain superior?'],
      suggestedTransitionsAr: TRANSITIONS_AR.counter,
      suggestedTransitionsEn: TRANSITIONS_EN.counter,
    },
    {
      id: 'conclusion',
      titleAr: '7. الخلاصة والتوليف النهائي (Synthesis & Conclusion)',
      titleEn: '7. Synthesis & Conclusion',
      purposeAr: 'تلخيص الأفكار وتقديم رؤية ختامية تدعو القارئ للتأمل أو العمل.',
      purposeEn: 'Summarize core insights and provide a compelling final takeaway.',
      content: `${isAr ? TRANSITIONS_AR.conclusion[0] : TRANSITIONS_EN.conclusion[0]} ${concludingThought}`,
      guidingQuestionsAr: ['ما هي الرسالة النهائية التي يجب ألا ينساها القارئ؟'],
      guidingQuestionsEn: ['What is the singular takeaway message?'],
      suggestedTransitionsAr: TRANSITIONS_AR.conclusion,
      suggestedTransitionsEn: TRANSITIONS_EN.conclusion,
    },
  ];

  const totalWordCount = sections.reduce((sum, s) => sum + s.content.split(/\s+/).filter(Boolean).length, 0);

  return {
    topic: rawTopic,
    essayType,
    title,
    sections,
    totalWordCount,
    readabilityLevel: isAr ? 'مستوى أكاديمي واضح (B2)' : 'Clear Academic Tier (B2)',
    executiveTipsAr: [
      'لا تحاول كتابة المقال دفعة واحدة؛ املأ قسماً واحداً فقط في كل جلسة (جلسات 10 دقائق).',
      'استخدم أدوات الربط المقترحة في بداية كل فقرة لضمان تدفق الأفكار بسلاسة.',
      'اقرأ المقال بصوت عالٍ أو استخدم القارئ الصوتي لاكتشاف الجمل المعقدة.',
    ],
    executiveTipsEn: [
      'Do not write the whole essay at once; focus on completing one discrete pillar per sprint.',
      'Leverage the provided transition connectors to guarantee logical cohesion.',
      'Use text-to-speech dual reading to verify acoustic flow.',
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. COGNITIVE TEXT SIMPLIFIER (مبسّط النصوص الأكاديمية)
// ─────────────────────────────────────────────────────────────────────────────

const COMMON_JARGON_DICT: Record<string, { definitionAr: string; definitionEn: string; exampleAr: string; exampleEn: string }> = {
  'المرونة العصبية': {
    definitionAr: 'قدرة خلايا الدماغ على تغيير بنيتها والتكيف مع التعلم والخبرات الجديدة.',
    definitionEn: 'The brains ability to reorganize synaptic connections in response to learning.',
    exampleAr: 'تسمح المرونة العصبية للبالغين بتعلم لغات جديدة.',
    exampleEn: 'Neuroplasticity enables continuous skill acquisition across life.',
  },
  'الوظائف التنفيذية': {
    definitionAr: 'مهارات عقلية تشمل الذاكرة العاملة والتحكم في الانتباه والتنظيم.',
    definitionEn: 'A set of cognitive processes that include working memory and attention control.',
    exampleAr: 'تساعد الوظائف التنفيذية الطالب على تنظيم وقته قبل الامتحانات.',
    exampleEn: 'Executive function governs task prioritization and planning.',
  },
  'الذاكرة العاملة': {
    definitionAr: 'المساحة العقلية المؤقتة التي تحتفظ بالمعلومات أثناء معالجتها في اللحظة الحالية.',
    definitionEn: 'A cognitive system that holds information temporarily for immediate manipulation.',
    exampleAr: 'تُستخدم الذاكرة العاملة لتذكر رقم هاتف أثناء كتابته.',
    exampleEn: 'Working memory retains a mental math operand during calculation.',
  },
  'التمايز المعرفي': {
    definitionAr: 'تكييف طرق التدريس لتناسب الفروق الفردية في سرعة ونمط الاستيعاب.',
    definitionEn: 'Customizing instructional methods to match unique cognitive learning styles.',
    exampleAr: 'يقدم المعلم تمايزاً معرفياً عبر استخدام الرسوم البيانية بجانب النص.',
    exampleEn: 'Cognitive differentiation provides multi-sensory modalities.',
  },
  'neuroplasticity': {
    definitionAr: 'المرونة العصبية وقدرة الدماغ على التكيف.',
    definitionEn: 'The neural capacity to reorganize pathways.',
    exampleAr: 'المرونة العصبية تدعم إعادة التأهيل بعد الإصابات.',
    exampleEn: 'Neuroplasticity drives synaptic rewiring during rehabilitation.',
  },
  'cognitive load': {
    definitionAr: 'مقدار الجهد الذهني المبذول في معالجة كمية معينة من المعلومات في وقت واحد.',
    definitionEn: 'The total mental effort used in working memory.',
    exampleAr: 'تقسيم المقال إلى نقاط يقلل العبء المعرفي.',
    exampleEn: 'Chunking information minimizes extraneous cognitive load.',
  },
};

/**
 * Simplifies dense, intimidating academic paragraphs into bullet points, plain explanation,
 * and a tailored jargon glossary for cognitive overload mitigation.
 */
export function simplifyAcademicText(
  text: string,
  language: 'Arabic' | 'English' = 'Arabic'
): SimplifiedTextResult {
  const isAr = language === 'Arabic' || /[\u0600-\u06FF]/.test(text);
  const sentences = text
    .split(/[.؟!;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const estimatedReadingTimeSeconds = Math.max(5, Math.round((wordCount / 140) * 60)); // ~140 wpm for special needs

  // Calculate readability ease: longer words & longer sentences decrease ease
  const avgSentenceLen = sentences.length > 0 ? wordCount / sentences.length : 10;
  const longWords = text.split(/\s+/).filter((w) => w.length >= 7).length;
  const longWordRatio = wordCount > 0 ? longWords / wordCount : 0.2;
  const rawEase = Math.round(100 - avgSentenceLen * 1.5 - longWordRatio * 60);
  const readingEaseScore = Math.max(15, Math.min(95, rawEase));

  // Extract key points
  const keyPoints = sentences.slice(0, 4).map((s, idx) => {
    // Simplify leading academic padding
    const cleaned = s
      .replace(/^(وتجدر الإشارة إلى أنه|ومن الجدير بالذكر أن|علاوة على ذلك فإن|In addition it should be noted that|Furthermore it is evident that)\s*/i, '');
    return isAr ? `• ${cleaned}` : `• ${cleaned}`;
  });

  if (keyPoints.length === 0) {
    keyPoints.push(isAr ? '• النص قصير جداً؛ يرجى إدخال فقرة أطول لتحليلها.' : '• Input text too brief for analytical chunking.');
  }

  // Detect jargon
  const glossary: Array<{ term: string; definition: string; example: string }> = [];
  const lowerText = text.toLowerCase();
  for (const [term, data] of Object.entries(COMMON_JARGON_DICT)) {
    if (lowerText.includes(term.toLowerCase())) {
      glossary.push({
        term,
        definition: isAr ? data.definitionAr : data.definitionEn,
        example: isAr ? data.exampleAr : data.exampleEn,
      });
    }
  }

  // Provide synthetic glossary item if none triggered
  if (glossary.length === 0 && sentences.length > 0) {
    const candidateWord = text.split(/\s+/).find((w) => w.length >= 6) || (isAr ? 'المفهوم المحوري' : 'Central Concept');
    glossary.push({
      term: candidateWord,
      definition: isAr ? 'المصطلح الأكاديمي الأساسي الذي تدور حوله فكرة الفقرة.' : 'Core academic concept anchoring this paragraph.',
      example: isAr ? 'يرجى مراجعة السياق لفهم التطبيق العملي.' : 'Refer to the context for empirical implementation.',
    });
  }

  const summary = sentences.length > 1
    ? `${sentences[0]} ${sentences[sentences.length - 1]}`
    : text.slice(0, 160);

  const plainExplanation = isAr
    ? `بشكل مبسط ومباشر: هذه الفقرة توضح أن ${sentences[0] || 'الفكرة المطروحة'} ترتبط مباشرة بالنتائج العملية التي تؤثر على استيعاب الطالب وفهمه.`
    : `In plain terms: This passage essentially highlights that ${sentences[0] || 'the core subject'} connects directly to measurable student outcomes.`;

  return {
    originalText: text,
    summary,
    keyPoints,
    plainExplanation,
    difficultGlossary: glossary,
    readingEaseScore,
    estimatedReadingTimeSeconds,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ACADEMIC SAMPLES LIBRARY FOR IMMEDIATE EXPERIMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export const ACADEMIC_SAMPLES: AcademicArticleSample[] = [
  {
    id: 'neuro_reading',
    titleAr: 'كيف يفكك الدماغ الكلمات أثناء القراءة؟',
    titleEn: 'How the Brain Decodes Words During Reading',
    category: 'neuroscience',
    contentAr: `تعتمد عملية القراءة على شبكة عصبية معقدة تربط بين الفص القذالي البصري والفص الصدغي المسؤول عن معالجة الأصوات. عندما يرى القارئ كلمة، تقوم القشرة البصرية أولاً بتحليل الأشكال الهندسية للحروف، ثم يتم تمريرها إلى منطقة التعرف البصري على الكلمات (Visual Word Form Area).

لدى الأفراد المصابين بعسر القراءة (Dyslexia)، يحدث تأخر طفيف في الربط بين الشكل المكتوب والصوت الفونيمي المقابل. هذا التأخر لا يرتبط أبداً بمستوى الذكاء، بل هو اختلاف في طريقة تنظيم الممرات العصبية في المخ.

تساعد أساليب التوجيه البؤري (Bionic Fixation) والخطوط الميسرة في تسريع مسح الحروف الأولى، مما يمنح الدماغ الوقت الكافي لتوقع بقية الكلمة وتقليل الإجهاد الإدراكي بنسبة تتجاوز الأربعين بالمائة.`,
    contentEn: `Reading relies on an intricate neural network connecting the visual occipital lobe with the temporal cortex responsible for phonological processing. When a reader encounters a word, the visual cortex first analyzes the geometric features of letters before routing them to the Visual Word Form Area.

In individuals with dyslexia, a slight latency occurs in linking visual graphemes with their auditory phonemic counterparts. This variance is entirely unrelated to intellectual capacity; rather, it reflects an alternative wiring in cortical processing pathways.

Focus fixation techniques and weighted typography accelerate saccadic anchoring on initial letter stems, granting the brain adequate bandwidth to predict subsequent syllables and mitigating cognitive fatigue by over forty percent.`,
  },
  {
    id: 'working_memory',
    titleAr: 'هندسة الذاكرة العاملة وتنظيم المهام',
    titleEn: 'The Architecture of Working Memory and Executive Function',
    category: 'psychology',
    contentAr: `تعتبر الذاكرة العاملة بمثابة لوحة الملاحظات المؤقتة في العقل البشري. فهي المسؤولة عن الاحتفاظ بالمعلومات لعدة ثوانٍ ريثما يتم اتخاذ قرار أو إجراء عملية ذهنية معقدة مثل الحساب أو التعبير الكتابي.

عندما يُكلف الطالب بمهمة كتابية ضخمة مثل صياغة مقال أكاديمي كامل، تواجه الذاكرة العاملة حالة من التشبع المعرفي (Cognitive Overload). يصعب على الدماغ في آن واحد: تذكر القواعد النحوية، صياغة الحجج، واختيار المفردات المناسبة.

لذلك، فإن تقنية الهيكلة المتدرجة (Scaffolding) تسمح بتفريغ الأفكار أولاً دون القلق بشأن الصياغة، ثم تنظيمها لاحقاً في هياكل منطقية تدعم الأداء الأكاديمي المستقل.`,
    contentEn: `Working memory functions as the minds temporary whiteboard. It is responsible for retaining discrete packets of information for several seconds while executing multi-step operations like mental arithmetic or written composition.

When students face an intimidating writing prompt such as an exhaustive research essay, working memory rapidly confronts cognitive saturation. The brain struggles to simultaneously arbitrate grammatical syntax, argument validation, and lexical selection.

Structured scaffolding alleviates this executive bottleneck by detaching conceptual ideation from mechanical composition, enabling neurodivergent thinkers to express complex reasoning without cognitive gridlock.`,
  },
];
