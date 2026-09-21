// ==========================================
// Adaptive Learning AI Engine
// Generates exercises, analyzes answers, adapts difficulty
// ==========================================

import {
  SubjectType, DifficultyLevel, TeachingMethod, Exercise, ExerciseConfig,
  ExerciseResult, AIAnalysis, SubjectProfile, LearningProfile, VisualAidData,
} from '../types/learning';
import { getGeminiKeys, getGroqKeys, getXaiKeys, getNvidiaKeys, getAuthHeaders } from './gemini';
import { getApiUrl } from '../config/api';

// ── AI Call Helper ─────────────────────────
async function callAI(prompt: string): Promise<string> {
  // Try backend proxy first
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/gemini/generateContent'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        parts: [{ text: prompt }],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.result) return data.result;
      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
    }
  } catch { /* fall through */ }

  // Direct Gemini API fallback
  const keys = getGeminiKeys();
  if (keys.length > 0) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keys[0]}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    } catch { /* fall through */ }
  }

  // OpenAI-compatible fallback (Groq/NVIDIA/xAI)
  const fallbackKeys = [...getNvidiaKeys(), ...getGroqKeys(), ...getXaiKeys()];
  if (fallbackKeys.length > 0) {
    const key = fallbackKeys[0];
    const isNvidia = key.startsWith('nvapi-');
    const isGroq = key.startsWith('gsk_');
    const url = isNvidia
      ? 'https://integrate.api.nvidia.com/v1/chat/completions'
      : isGroq
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.x.ai/v1/chat/completions';
    const model = isNvidia ? 'deepseek-ai/deepseek-r1' : isGroq ? 'llama-3.3-70b-versatile' : 'grok-2-latest';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data?.choices?.[0]?.message?.content || '';
      }
    } catch { /* fall through */ }
  }

  return '';
}

// ── Parse JSON from AI response ────────────
function parseJSON<T>(raw: string): T | null {
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleaned = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ── Generate Adaptive Exercise ─────────────
export async function generateAdaptiveExercise(
  config: ExerciseConfig,
  profile?: SubjectProfile
): Promise<Exercise> {
  const { subject, difficulty, teachingMethod, language } = config;
  const lang = language === 'ar' ? 'Arabic' : 'English';
  const weakTopics = profile?.weakTopics || [];
  const strongTopics = profile?.strongTopics || [];
  const weakStr = weakTopics.length > 0 ? `Focus on weak areas: ${weakTopics.join(', ')}.` : '';
  const avoidStr = strongTopics.length > 0 ? `The child is strong in: ${strongTopics.join(', ')}, so focus elsewhere.` : '';

  const subjectPrompts: Record<SubjectType, string> = {
    math: `Generate a math question for a child. Difficulty ${difficulty}/5. Types: counting, addition, subtraction, multiplication, comparison, word problems. For low difficulty (1-2), use single-digit numbers. For medium (3), use double-digit. For high (4-5), use multi-step problems.${difficulty <= 2 ? ' Include a visual aid with counting objects (emoji like 🍎 or ⭐).' : ''}`,
    reading: `Generate a reading exercise. Difficulty ${difficulty}/5. Level 1: single letters/syllables. Level 2: simple words. Level 3: short sentences. Level 4: paragraphs. Level 5: complex passages. Include pronunciation hints.`,
    writing: `Generate a writing exercise. Difficulty ${difficulty}/5. Level 1: complete missing letters in a word. Level 2: arrange letters to form a word. Level 3: complete a sentence with missing words. Level 4: write a sentence from a prompt. Level 5: write a short paragraph.`,
    memory: `Generate a memory/sequence exercise. Difficulty ${difficulty}/5. Level 1: remember 3 items. Level 2: 4 items. Level 3: 5 items. Level 4: 6 items. Level 5: 7+ items. Use emojis, colors, or numbers as items.`,
    comprehension: `Generate a reading comprehension exercise. Difficulty ${difficulty}/5. Provide a short passage (${difficulty * 20} words) and 1 question about it. For low difficulty, use simple factual questions. For high difficulty, use inferential questions.`,
    science: `Generate a science question for a child. Difficulty ${difficulty}/5. Topics: water cycle, plants, animals, human body, weather, simple machines. Break concepts into simple steps with emojis. Ask a question to test understanding.`,
    english: `Generate an English vocabulary/grammar exercise. Difficulty ${difficulty}/5. Level 1: match word to image/emoji. Level 2: complete the word. Level 3: arrange words into a sentence. Level 4: fill in the blank in a sentence. Level 5: translate or write a sentence.`,
  };

  const curriculumStr = config.curriculumLevel
    ? `Curriculum educational stage: ${config.curriculumLevel}. Tailor concept depth, complexity, and vocabulary accordingly.`
    : '';

  const prompt = `You are an AI tutor for learners. ${subjectPrompts[subject]}

${weakStr} ${avoidStr}
${curriculumStr}

Teaching method preference: ${teachingMethod}.
Language: ${lang}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "question": "the question text in ${lang}",
  ${language === 'ar' ? '"questionArabic": "same question in Arabic",' : '"questionArabic": "Arabic translation of question",'}
  "type": "multiple_choice",
  "options": ["option1", "option2", "option3", "option4"],
  "optionsArabic": ["خيار1", "خيار2", "خيار3", "خيار4"],
  "correctAnswer": "the correct option text",
  "hint": "a helpful hint in ${lang}",
  "hintArabic": "Arabic hint",
  "explanation": "why this answer is correct in ${lang}",
  "explanationArabic": "Arabic explanation",
  "topic": "specific topic name",
  "visualAid": null
}

${teachingMethod === 'visual' || difficulty <= 2 ? `For visualAid, use: {"type": "counting_objects", "emoji": "🍎", "count": 5, "secondCount": 3}` : 'Set visualAid to null.'}`;

  const raw = await callAI(prompt);
  if (!raw) return generateLocalExercise(subject, difficulty, language);

  const parsed = parseJSON<any>(raw);
  if (!parsed || !parsed.question || !parsed.correctAnswer) {
    return generateLocalExercise(subject, difficulty, language);
  }

  return {
    id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    subject,
    difficulty,
    question: parsed.question,
    questionArabic: parsed.questionArabic,
    type: parsed.type || 'multiple_choice',
    options: parsed.options,
    optionsArabic: parsed.optionsArabic,
    correctAnswer: parsed.correctAnswer,
    hint: parsed.hint,
    hintArabic: parsed.hintArabic,
    visualAid: parsed.visualAid,
    explanation: parsed.explanation,
    explanationArabic: parsed.explanationArabic,
    topic: parsed.topic || subject,
  };
}

// ── Analyze Child's Answer ─────────────────
export async function analyzeAnswer(
  exercise: Exercise,
  childAnswer: string,
  profile: SubjectProfile,
): Promise<AIAnalysis> {
  const prompt = `You are an AI tutor analyzing a child's answer to an exercise.

Exercise: "${exercise.question}"
Correct answer: "${exercise.correctAnswer}"
Child's answer: "${childAnswer}"
Subject: ${exercise.subject}
Current difficulty: ${exercise.difficulty}/5
Child's accuracy rate: ${(profile.accuracyRate * 100).toFixed(0)}%
Consecutive correct: ${profile.consecutiveCorrect}
Consecutive incorrect: ${profile.consecutiveIncorrect}

Analyze the answer and return ONLY valid JSON:
{
  "isCorrect": true/false,
  "mistakeType": "concept" | "calculation" | "understanding" | "careless" | "spelling" | "grammar" | "vocabulary" | null,
  "explanation": "brief explanation of why wrong (or praise if correct)",
  "explanationArabic": "Arabic version",
  "suggestedDifficulty": ${exercise.difficulty},
  "suggestedMethod": "text" | "visual" | "audio" | "repetition",
  "encouragement": "a warm, encouraging message for the child",
  "encouragementArabic": "Arabic encouragement",
  "visualAidNeeded": false,
  "topicStrength": "weak" | "developing" | "strong"
}

Rules for suggestedDifficulty:
- If correct and consecutive correct >= 3: increase by 1 (max 5)
- If incorrect and consecutive incorrect >= 2: decrease by 1 (min 1)
- Otherwise: keep same

Rules for suggestedMethod:
- If incorrect and current method is "text": suggest "visual"
- If incorrect twice with "visual": suggest "repetition"
- If correct: keep current method`;

  const raw = await callAI(prompt);
  const parsed = parseJSON<AIAnalysis>(raw);

  if (parsed) return parsed;

  // Fallback: basic analysis without AI
  const isCorrect = childAnswer.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();
  let suggestedDifficulty = exercise.difficulty;
  if (isCorrect && profile.consecutiveCorrect >= 2) {
    suggestedDifficulty = Math.min(5, exercise.difficulty + 1) as DifficultyLevel;
  } else if (!isCorrect && profile.consecutiveIncorrect >= 1) {
    suggestedDifficulty = Math.max(1, exercise.difficulty - 1) as DifficultyLevel;
  }

  return {
    isCorrect,
    mistakeType: isCorrect ? undefined : 'understanding',
    explanation: isCorrect ? 'Great job!' : `The correct answer is: ${exercise.correctAnswer}`,
    explanationArabic: isCorrect ? 'أحسنت!' : `الإجابة الصحيحة هي: ${exercise.correctAnswer}`,
    suggestedDifficulty,
    suggestedMethod: isCorrect ? profile.preferredMethod : 'visual',
    encouragement: isCorrect ? 'You\'re doing amazing! Keep going! 🌟' : 'Don\'t worry, you\'re learning! Let\'s try again! 💪',
    encouragementArabic: isCorrect ? 'رائع! استمر! 🌟' : 'لا تقلق، أنت تتعلم! حاول مرة أخرى! 💪',
    visualAidNeeded: !isCorrect && exercise.difficulty <= 3,
    topicStrength: isCorrect ? 'developing' : 'weak',
  };
}

// ── Adapt Difficulty (Pure Function) ───────
export function adaptDifficulty(
  profileOrDifficulty: SubjectProfile | DifficultyLevel | number,
  lastResultOrConsecutiveCorrect?: ExerciseResult | number,
  consecutiveIncorrectParam?: number
): DifficultyLevel {
  if (typeof profileOrDifficulty === 'number') {
    const currentDifficulty = profileOrDifficulty;
    const consecutiveCorrect = typeof lastResultOrConsecutiveCorrect === 'number' ? lastResultOrConsecutiveCorrect : 0;
    const consecutiveIncorrect = typeof consecutiveIncorrectParam === 'number' ? consecutiveIncorrectParam : 0;
    if (consecutiveCorrect >= 3) {
      return Math.min(5, currentDifficulty + 1) as DifficultyLevel;
    }
    if (consecutiveIncorrect >= 2) {
      return Math.max(1, currentDifficulty - 1) as DifficultyLevel;
    }
    return currentDifficulty as DifficultyLevel;
  }

  const profile = profileOrDifficulty;
  const lastResult = lastResultOrConsecutiveCorrect as ExerciseResult;
  const { consecutiveCorrect, consecutiveIncorrect, currentDifficulty } = profile;

  if (lastResult.isCorrect) {
    const newConsecutive = consecutiveCorrect + 1;
    if (newConsecutive >= 3 && lastResult.responseTimeMs < (profile.avgResponseTimeMs || 10000) * 1.2) {
      return Math.min(5, currentDifficulty + 1) as DifficultyLevel;
    }
  } else {
    const newConsecutive = consecutiveIncorrect + 1;
    if (newConsecutive >= 2) {
      return Math.max(1, currentDifficulty - 1) as DifficultyLevel;
    }
  }

  return currentDifficulty;
}

// ── Detect Learning Style ──────────────────
export function detectLearningStyle(
  resultsOrProfile: ExerciseResult[] | LearningProfile
): 'visual' | 'auditory' | 'kinesthetic' | 'repetition' {
  if (!Array.isArray(resultsOrProfile)) {
    const p = resultsOrProfile;
    const getAcc = (subj: SubjectProfile | undefined) => {
      if (!subj) return 0;
      const explicitAcc = (subj as any).accuracy;
      if (typeof explicitAcc === 'number') return explicitAcc > 1 ? explicitAcc : explicitAcc * 100;
      if (typeof subj.accuracyRate === 'number') return subj.accuracyRate > 1 ? subj.accuracyRate : subj.accuracyRate * 100;
      return 0;
    };

    const mathAcc = getAcc(p.subjects.math);
    const writingAcc = getAcc(p.subjects.writing);
    const memoryAcc = getAcc(p.subjects.memory);
    const readingAcc = getAcc(p.subjects.reading);
    const englishAcc = getAcc(p.subjects.english);

    const kinestheticScore = mathAcc + writingAcc + memoryAcc;
    const auditoryScore = readingAcc * 1.2 + englishAcc * 1.2;

    if (kinestheticScore > auditoryScore && kinestheticScore >= 180) {
      return 'kinesthetic';
    }
    if (auditoryScore > kinestheticScore && auditoryScore >= 150) {
      return 'auditory';
    }
    return 'visual';
  }

  const results = resultsOrProfile;
  if (results.length < 5) return 'visual'; // Default for new learners

  const methodToStyleMap: Record<TeachingMethod, 'visual' | 'auditory' | 'kinesthetic' | 'repetition'> = {
    visual: 'visual',
    audio: 'auditory',
    interactive: 'kinesthetic',
    repetition: 'repetition',
    text: 'visual',
  };

  const styleAccuracy: Record<'visual' | 'auditory' | 'kinesthetic' | 'repetition', { correct: number; total: number }> = {
    visual: { correct: 0, total: 0 },
    auditory: { correct: 0, total: 0 },
    kinesthetic: { correct: 0, total: 0 },
    repetition: { correct: 0, total: 0 },
  };

  for (const r of results.slice(-20)) {
    const style = methodToStyleMap[r.teachingMethodUsed] || 'visual';
    styleAccuracy[style].total++;
    if (r.isCorrect) styleAccuracy[style].correct++;
  }

  let bestStyle: 'visual' | 'auditory' | 'kinesthetic' | 'repetition' = 'visual';
  let bestRate = -1;
  for (const [style, stats] of Object.entries(styleAccuracy) as ['visual' | 'auditory' | 'kinesthetic' | 'repetition', { correct: number; total: number }][]) {
    if (stats.total > 0) {
      const rate = stats.correct / stats.total;
      if (rate > bestRate) {
        bestRate = rate;
        bestStyle = style;
      }
    }
  }

  return bestStyle;
}

// ── Generate Fallback Exercise (No AI needed - Rich Curriculum Bank) ──
export function generateLocalExercise(subject: SubjectType, difficulty: DifficultyLevel, language: 'en' | 'ar'): Exercise {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  switch (subject) {
    case 'math':
      return generateLocalMathExercise(id, difficulty, language);
    case 'reading':
      return generateLocalReadingExercise(id, difficulty, language);
    case 'writing':
      return generateLocalWritingExercise(id, difficulty, language);
    case 'memory':
      return generateLocalMemoryExercise(id, difficulty, language);
    case 'comprehension':
      return generateLocalComprehensionExercise(id, difficulty, language);
    case 'science':
      return generateLocalScienceExercise(id, difficulty, language);
    case 'english':
      return generateLocalEnglishExercise(id, difficulty, language);
    default:
      return generateLocalMathExercise(id, difficulty, language);
  }
}

// ── 1. Reading Curriculum Bank ───────────────────────
function generateLocalReadingExercise(id: string, difficulty: DifficultyLevel, language: 'en' | 'ar'): Exercise {
  const isAr = language === 'ar';
  type Item = {
    qAr: string; qEn: string;
    optsAr: string[]; optsEn: string[];
    ansAr: string; ansEn: string;
    hintAr: string; hintEn: string;
    expAr: string; expEn: string;
    topic: string;
    syllables?: string[];
    visualEmoji?: string;
  };

  const pool: Record<DifficultyLevel, Item[]> = {
    1: [
      {
        qAr: 'أي كلمة تبدأ بحرف الباء (ب)؟',
        qEn: 'Which word starts with the letter "B"?',
        optsAr: ['بَطَّة 🦆', 'تُفَّاح 🍎', 'قَلَم ✏️', 'أَسَد 🦁'],
        optsEn: ['Ball ⚽', 'Apple 🍎', 'Sun ☀️', 'Dog 🐶'],
        ansAr: 'بَطَّة 🦆', ansEn: 'Ball ⚽',
        hintAr: 'صوت الحرف هو (بـَ)', hintEn: 'Listen to the "B" sound!',
        expAr: 'كلمة بَطَّة تبدأ بحرف الباء المفتوحة.', expEn: 'Ball starts with the letter B.',
        topic: 'phonics_letters', visualEmoji: '🦆',
        syllables: isAr ? ['بَـ', 'طَـ', 'ـة'] : ['B', 'all']
      },
      {
        qAr: 'ما هو الحرف الأول في كلمة (شَمْس)؟',
        qEn: 'What is the first letter of the word "Sun"?',
        optsAr: ['ش', 'س', 'ص', 'ر'],
        optsEn: ['S', 'C', 'M', 'T'],
        ansAr: 'ش', ansEn: 'S',
        hintAr: 'انطق الكلمة ببطء: شَـ..مْس', hintEn: 'Say it slowly: S-u-n',
        expAr: 'تبدأ كلمة شَمْس بحرف الشين.', expEn: 'The word Sun starts with S.',
        topic: 'initial_letter', visualEmoji: '☀️'
      }
    ],
    2: [
      {
        qAr: 'اختر الكلمة التي تطابق الصورة: (كِتَاب 📖)',
        qEn: 'Choose the word that matches the image: (Book 📖)',
        optsAr: ['كِتَاب', 'بَاب', 'قَلَم', 'دَفْتَر'],
        optsEn: ['Book', 'Door', 'Pen', 'Bag'],
        ansAr: 'كِتَاب', ansEn: 'Book',
        hintAr: 'كِـ - تَا - بُ', hintEn: 'B - oo - k',
        expAr: 'الصورة لكتاب مفيد للقراءة.', expEn: 'The image depicts a book.',
        topic: 'word_picture_match', visualEmoji: '📖',
        syllables: isAr ? ['كِـ', 'ـتَا', 'بُ'] : ['Book']
      },
      {
        qAr: 'أي من الكلمات التالية تحتوي على مد بالألف (ـا)؟',
        qEn: 'Which word contains the long "A" sound?',
        optsAr: ['بَاب', 'بِنْت', 'بُرْج', 'بَلَد'],
        optsEn: ['Cake', 'Cat', 'Cup', 'Bed'],
        ansAr: 'بَاب', ansEn: 'Cake',
        hintAr: 'استمع لصوت المد الطويل (آ)', hintEn: 'Listen for the long "ay" sound!',
        expAr: 'كلمة بَاب تحتوي على مد بالألف مسبوق بحرف مفتوح.', expEn: 'Cake has a long vowel sound.',
        topic: 'long_vowels'
      }
    ],
    3: [
      {
        qAr: 'أي كلمة لها نفس قافية ونغمة كلمة (سَمَاء)؟',
        qEn: 'Which word rhymes with "Star"?',
        optsAr: ['هَوَاء', 'بَحْر', 'قَمَر', 'شَجَر'],
        optsEn: ['Car', 'Moon', 'Tree', 'Sun'],
        ansAr: 'هَوَاء', ansEn: 'Car',
        hintAr: 'تنتهي بنفس الحروف والصوت (ـاء)', hintEn: 'They end with the same "-ar" sound!',
        expAr: 'سَمَاء وهَوَاء لهما نفس القافية والوزن الصوتي.', expEn: 'Star and Car rhyme with the same sound.',
        topic: 'rhyme_fluency'
      }
    ],
    4: [
      {
        qAr: 'أكمل الجملة بالكلمة الصحيحة: "يَقْرَأُ الطَّالِبُ الـ ____ بَانْتِبَاهٍ."',
        qEn: 'Complete the sentence: "The student reads the ____ carefully."',
        optsAr: ['قِصَّةَ', 'سَيَّارَةَ', 'حَدِيقَةَ', 'طَعَامَ'],
        optsEn: ['story', 'car', 'garden', 'food'],
        ansAr: 'قِصَّةَ', ansEn: 'story',
        hintAr: 'ما الذي نقرأه؟', hintEn: 'What do we usually read?',
        expAr: 'الطالب يقرأ القصة أو الكتاب.', expEn: 'A student reads a story or book.',
        topic: 'sight_sentence_reading'
      }
    ],
    5: [
      {
        qAr: 'ما هو مضاد (عكس) كلمة "مُبْتَسِم" في المعنى؟',
        qEn: 'What is the opposite of the word "Cheerful"?',
        optsAr: ['عَابِس', 'فَرِح', 'مَسْرُور', 'سَعِيد'],
        optsEn: ['Gloomy', 'Happy', 'Joyful', 'Bright'],
        ansAr: 'عَابِس', ansEn: 'Gloomy',
        hintAr: 'الشخص الذي لا يبتسم وحزين', hintEn: 'Someone who is sad or downcast',
        expAr: 'عكس الابتسام هو العبوس والحزن.', expEn: 'The opposite of cheerful is gloomy.',
        topic: 'vocabulary_antonyms'
      }
    ]
  };

  const items = pool[difficulty] || pool[1];
  const item = items[Math.floor(Math.random() * items.length)];

  return {
    id,
    subject: 'reading',
    difficulty,
    question: isAr ? item.qAr : item.qEn,
    questionArabic: item.qAr,
    type: 'multiple_choice',
    options: (isAr ? item.optsAr : item.optsEn).sort(() => Math.random() - 0.5),
    optionsArabic: item.optsAr,
    correctAnswer: isAr ? item.ansAr : item.ansEn,
    hint: isAr ? item.hintAr : item.hintEn,
    hintArabic: item.hintAr,
    explanation: isAr ? item.expAr : item.expEn,
    explanationArabic: item.expAr,
    topic: item.topic,
    syllables: item.syllables || (isAr ? (item.ansAr || '').replace(/[^\u0621-\u064A]/g, '').split('') : (item.ansEn || '').replace(/[^a-zA-Z]/g, '').split('')),
    visualAid: item.visualEmoji ? { type: 'image_word', emoji: item.visualEmoji } : undefined,
  };
}

// ── 2. Writing Curriculum Bank ───────────────────────
function generateLocalWritingExercise(id: string, difficulty: DifficultyLevel, language: 'en' | 'ar'): Exercise {
  const isAr = language === 'ar';
  type Item = {
    qAr: string; qEn: string;
    optsAr: string[]; optsEn: string[];
    ansAr: string; ansEn: string;
    hintAr: string; hintEn: string;
    expAr: string; expEn: string;
    topic: string;
    tiles?: string[];
  };

  const pool: Record<DifficultyLevel, Item[]> = {
    1: [
      {
        qAr: 'ما الحرف الناقص لإكمال الكلمة: (أَ _ َ د) 🦁؟',
        qEn: 'What is the missing letter in: (c _ t) 🐱?',
        optsAr: ['س', 'ب', 'ر', 'م'],
        optsEn: ['a', 'o', 'u', 'i'],
        ansAr: 'س', ansEn: 'a',
        hintAr: 'الكلمة هي: أَسَد', hintEn: 'The word is: cat',
        expAr: 'الحرف الناقص هو السين (س) لتصبح الكلمة: أَسَد.', expEn: 'The missing letter is "a" to form "cat".',
        topic: 'missing_letter',
        tiles: isAr ? ['أ', 'س', 'د'] : ['c', 'a', 't']
      },
      {
        qAr: 'ما الحرف الناقص في كلمة: (قَـ _ ـم) ✏️؟',
        qEn: 'What is the missing letter in: (p _ n) ✏️?',
        optsAr: ['ل', 'ف', 'ص', 'ك'],
        optsEn: ['e', 'u', 'a', 'o'],
        ansAr: 'ل', ansEn: 'e',
        hintAr: 'أداة الكتابة: قَلَم', hintEn: 'Writing tool: pen',
        expAr: 'الحرف الناقص هو اللام في وسط الكلمة.', expEn: 'The missing letter is "e" to form "pen".',
        topic: 'missing_letter',
        tiles: isAr ? ['ق', 'ل', 'م'] : ['p', 'e', 'n']
      }
    ],
    2: [
      {
        qAr: 'رتّب الحروف لتكوين الكلمة الصحيحة: [ر - ح - ب]',
        qEn: 'Arrange the letters to form the correct word: [O - B - O - K]',
        optsAr: ['بَحْر 🌊', 'حَرْب ⚔️', 'رِبْح 💰', 'بَرّ 🏜️'],
        optsEn: ['BOOK 📚', 'KOOB', 'BOLL', 'LOOK'],
        ansAr: 'بَحْر 🌊', ansEn: 'BOOK 📚',
        hintAr: 'مكان واسع فيه ماء وأمواج', hintEn: 'Something you read!',
        expAr: 'الحروف (ب-ح-ر) تكوّن كلمة بَحْر.', expEn: 'B-O-O-K spells Book.',
        topic: 'letter_scramble',
        tiles: isAr ? ['ب', 'ح', 'ر'] : ['B', 'O', 'O', 'K']
      }
    ],
    3: [
      {
        qAr: 'رتّب الكلمات لتكوين جملة مفيدة: (إِلَى - الطَّالِبُ - ذَهَبَ - المَدْرَسَةِ)',
        qEn: 'Arrange the words to form a sentence: (school - to - goes - The student)',
        optsAr: ['ذَهَبَ الطَّالِبُ إِلَى المَدْرَسَةِ', 'إِلَى ذَهَبَ المَدْرَسَةِ الطَّالِبُ', 'المَدْرَسَةِ ذَهَبَ إِلَى الطَّالِبُ', 'الطَّالِبُ إِلَى ذَهَبَ المَدْرَسَةِ'],
        optsEn: ['The student goes to school', 'School goes to the student', 'To school goes student the', 'Student the goes to school'],
        ansAr: 'ذَهَبَ الطَّالِبُ إِلَى المَدْرَسَةِ', ansEn: 'The student goes to school',
        hintAr: 'ابدأ بالفعل: ذَهَبَ...', hintEn: 'Start with: The student...',
        expAr: 'الترتيب السليم يبدأ بالفعل ثم الفاعل ثم حرف الجر والمجرور.', expEn: 'Standard subject-verb-object syntax.',
        topic: 'sentence_builder',
        tiles: isAr ? ['ذَهَبَ', 'الطَّالِبُ', 'إِلَى', 'المَدْرَسَةِ'] : ['The', 'student', 'goes', 'to', 'school']
      }
    ],
    4: [
      {
        qAr: 'أي من الكلمات التالية مكتوبة إملائياً بشكل صحيح بالتاء المربوطة؟',
        qEn: 'Which word has the correct spelling?',
        optsAr: ['شَجَرَة', 'شَجَرَه', 'شَجَرَت', 'شجرهـ'],
        optsEn: ['Beautiful', 'Beautifull', 'Beutiful', 'Beatiful'],
        ansAr: 'شَجَرَة', ansEn: 'Beautiful',
        hintAr: 'تُنطق هاء عند الوقف وتاء عند الوصل (شجرةُ التفاح)', hintEn: 'B-e-a-u-t-i-f-u-l',
        expAr: 'كلمة شَجَرَة تنتهي بتاء مربوطة منقوطة.', expEn: 'Beautiful has one l and starts with b-e-a-u.',
        topic: 'spelling_rules'
      }
    ],
    5: [
      {
        qAr: 'اختر علامة الترقيم الصحيحة: "مَا أَجْمَلَ هَذَا البُسْتَانَ__"',
        qEn: 'Choose the correct punctuation: "What a magnificent garden this is__"',
        optsAr: ['!', '؟', '،', '.'],
        optsEn: ['!', '?', ',', '.'],
        ansAr: '!', ansEn: '!',
        hintAr: 'هذا أسلوب تعجب!', hintEn: 'This expresses exclamation and wonder!',
        expAr: 'أسلوب التعجب ينتهي دائماً بعلامة التعجب (!).', expEn: 'Exclamatory sentences end with an exclamation mark (!).',
        topic: 'punctuation_style'
      }
    ]
  };

  const items = pool[difficulty] || pool[1];
  const item = items[Math.floor(Math.random() * items.length)];

  return {
    id,
    subject: 'writing',
    difficulty,
    question: isAr ? item.qAr : item.qEn,
    questionArabic: item.qAr,
    type: 'multiple_choice',
    options: (isAr ? item.optsAr : item.optsEn).sort(() => Math.random() - 0.5),
    optionsArabic: item.optsAr,
    correctAnswer: isAr ? item.ansAr : item.ansEn,
    hint: isAr ? item.hintAr : item.hintEn,
    hintArabic: item.hintAr,
    explanation: isAr ? item.expAr : item.expEn,
    explanationArabic: item.expAr,
    topic: item.topic,
    letterTiles: item.tiles,
  };
}

// ── 3. Comprehension Curriculum Bank ─────────────────
function generateLocalComprehensionExercise(id: string, difficulty: DifficultyLevel, language: 'en' | 'ar'): Exercise {
  const isAr = language === 'ar';
  type StoryItem = {
    passageAr: string; passageEn: string;
    qAr: string; qEn: string;
    optsAr: string[]; optsEn: string[];
    ansAr: string; ansEn: string;
    hintAr: string; hintEn: string;
    expAr: string; expEn: string;
    topic: string;
    steps?: string[];
  };

  const pool: Record<DifficultyLevel, StoryItem[]> = {
    1: [
      {
        passageAr: 'نَامَتِ القِطَّةُ الصَّغِيرَةُ تَحْتَ الشَّجَرَةِ الخَضْرَاءِ فِي الحَدِيقَةِ.',
        passageEn: 'The little kitten slept under the green tree in the garden.',
        qAr: 'أَيْنَ نَامَتِ القِطَّةُ الصَّغِيرَةُ؟',
        qEn: 'Where did the little kitten sleep?',
        optsAr: ['تَحْتَ الشَّجَرَةِ', 'فَوْقَ السَّطْحِ', 'دَاخِلَ البَيْتِ', 'فِي المَطْبَخِ'],
        optsEn: ['Under the tree', 'On the roof', 'Inside the car', 'In the kitchen'],
        ansAr: 'تَحْتَ الشَّجَرَةِ', ansEn: 'Under the tree',
        hintAr: 'اقرأ بداية الجملة: "تَحْتَ..."', hintEn: 'Look at the word "under..." in the passage.',
        expAr: 'ذكرت القصة صراحة: نامت القطة الصغيرة تحت الشجرة.', expEn: 'The passage clearly states: slept under the green tree.',
        topic: 'literal_recall',
        steps: ['القطة في الحديقة 🏡', 'وجدت شجرة خضراء 🌳', 'نامت تحتها بهدوء 💤']
      }
    ],
    2: [
      {
        passageAr: 'زَرَعَ طَارِقٌ بَذْرَةَ طَمَاطِمَ، وَسَقَاهَا كُلَّ صَبَاحٍ بِالمَاءِ حَتَّى نَمَتْ وَأَثْمَرَتْ.',
        passageEn: 'Tariq planted a tomato seed and watered it every morning until it grew and bore fruit.',
        qAr: 'مَاذَا كَانَ طَارِقٌ يَفْعَلُ كُلَّ صَبَاحٍ؟',
        qEn: 'What did Tariq do every morning?',
        optsAr: ['يَسْقِي البَذْرَةَ بِالمَاءِ', 'يَقْطِفُ الثِّمَارَ', 'يَلْعَبُ بِالكُرَةِ', 'يَشْتَرِي طَمَاطِمَ'],
        optsEn: ['Watered the seed', 'Ate the fruit', 'Played football', 'Bought tomatoes'],
        ansAr: 'يَسْقِي البَذْرَةَ بِالمَاءِ', ansEn: 'Watered the seed',
        hintAr: 'بماذا اعتنى بالنبتة؟', hintEn: 'How did he care for the seed each day?',
        expAr: 'كان طارق يسقي البذرة بالماء كل صباح لتنمو.', expEn: 'Tariq gave the seed water every morning.',
        topic: 'cause_and_effect'
      }
    ],
    3: [
      {
        passageAr: 'رَأَى العُصْفُورُ نَمْلَةً صَغِيرَةً كَادَتْ تَغْرَقُ فِي الجَدْوَلِ، فَأَلْقَى لَهَا وَرَقَةَ شَجَرٍ طَفَتْ عَلَيْهَا وَنَجَتْ.',
        passageEn: 'A bird saw a tiny ant about to drown in a stream, so he dropped a green leaf for her to float to safety.',
        qAr: 'كَيْفَ أَنْقَذَ العُصْفُورُ النَّمْلَةَ؟',
        qEn: 'How did the bird save the ant?',
        optsAr: ['أَلْقَى لَهَا وَرَقَةَ شَجَرٍ', 'شَرِبَ مَاءَ الجَدْوَلِ', 'نَادَى الحَيَوَانَاتِ', 'حَمَلَهَا بِمِنْقَارِهِ'],
        optsEn: ['Dropped a leaf for her', 'Drank all the water', 'Called other animals', 'Swam in the water'],
        ansAr: 'أَلْقَى لَهَا وَرَقَةَ شَجَرٍ', ansEn: 'Dropped a leaf for her',
        hintAr: 'بماذا طفت النملة على سطح الماء؟', hintEn: 'What floated on top of the water?',
        expAr: 'ألقى العصفور ورقة شجر طفت عليها النملة ووصلت لليابسة.', expEn: 'The bird dropped a leaf so the ant could float.',
        topic: 'story_comprehension'
      }
    ],
    4: [
      {
        passageAr: 'يَصْنَعُ النَّحْلُ العَسَلَ الشَّهِيدَ مِنْ رَحِيقِ الأَزْهَارِ، وَيَعِيشُ فِي خَلِيَّةٍ مُحْكَمَةِ البِنَاءِ يَتَعَاوَنُ فِيهَا الجَمِيعُ.',
        passageEn: 'Honeybees produce sweet honey from floral nectar, living in structured hives where all members collaborate.',
        qAr: 'مِمَّا يَصْنَعُ النَّحْلُ العَسَلَ؟',
        qEn: 'What do bees make honey from?',
        optsAr: ['رَحِيقِ الأَزْهَارِ', 'أَوْرَاقِ الأَشْجَارِ', 'مِيَاهِ الأَنْهَارِ', 'حُبُوبِ التُّرَابِ'],
        optsEn: ['Floral nectar', 'Tree leaves', 'River water', 'Dry soil'],
        ansAr: 'رَحِيقِ الأَزْهَارِ', ansEn: 'Floral nectar',
        hintAr: 'ماذا يجمع النحل من الأزهار الملونة؟', hintEn: 'What sweet liquid do bees collect from flowers?',
        expAr: 'يصنع النحل العسل من رحيق الأزهار.', expEn: 'Bees collect nectar from flowers to make honey.',
        topic: 'informational_text'
      }
    ],
    5: [
      {
        passageAr: 'عِنْدَمَا شَاهَدَ سَالِمٌ صَدِيقَهُ وَاقِفاً فِي المَطَرِ بِلا مِظَلَّةٍ، أَسْرَعَ إِلَيْهِ وَشَارَكَهُ مِظَلَّتَهُ حَتَّى وَصَلا إِلَى الحَافِلَةِ.',
        passageEn: 'When Salem saw his friend standing in the rain without an umbrella, he rushed over and shared his umbrella until they reached the bus.',
        qAr: 'مَا هِيَ الصِّفَةُ الأَبْرَزُ الَّتِي ظَهَرَتْ فِي تَصَرُّفِ سَالِمٍ؟',
        qEn: 'What primary trait is demonstrated by Salem?',
        optsAr: ['الإِيثَارُ وَحُبُّ المُسَاعَدَةِ', 'الحَذَرُ الشَّدِيدُ', 'السُّرْعَةُ فِي الجَرْيِ', 'الفُضُولُ'],
        optsEn: ['Empathy and helpfulness', 'Extreme fear', 'Fast running speed', 'Curiosity'],
        ansAr: 'الإِيثَارُ وَحُبُّ المُسَاعَدَةِ', ansEn: 'Empathy and helpfulness',
        hintAr: 'مساعدة الصديق في وقت الشدة', hintEn: 'Helping a friend in need',
        expAr: 'مشاركة المظلة مع صديق دلالة على المروءة والإيثار والتعاون.', expEn: 'Sharing an umbrella demonstrates empathy and generosity.',
        topic: 'inference_morals'
      }
    ]
  };

  const items = pool[difficulty] || pool[1];
  const item = items[Math.floor(Math.random() * items.length)];
  const fullQ = isAr
    ? `📖 اقرأ النَّصَّ ثُمَّ أَجِبْ:\n"${item.passageAr}"\n\n❓ ${item.qAr}`
    : `📖 Read the passage then answer:\n"${item.passageEn}"\n\n❓ ${item.qEn}`;

  return {
    id,
    subject: 'comprehension',
    difficulty,
    question: fullQ,
    questionArabic: `📖 اقرأ النَّصَّ ثُمَّ أَجِبْ:\n"${item.passageAr}"\n\n❓ ${item.qAr}`,
    type: 'multiple_choice',
    options: (isAr ? item.optsAr : item.optsEn).sort(() => Math.random() - 0.5),
    optionsArabic: item.optsAr,
    correctAnswer: isAr ? item.ansAr : item.ansEn,
    hint: isAr ? item.hintAr : item.hintEn,
    hintArabic: item.hintAr,
    explanation: isAr ? item.expAr : item.expEn,
    explanationArabic: item.expAr,
    topic: item.topic,
    visualAid: item.steps ? { type: 'step_diagram', steps: item.steps } : undefined,
  };
}

// ── 4. Science Curriculum Bank ───────────────────────
function generateLocalScienceExercise(id: string, difficulty: DifficultyLevel, language: 'en' | 'ar'): Exercise {
  const isAr = language === 'ar';
  type Item = {
    qAr: string; qEn: string;
    optsAr: string[]; optsEn: string[];
    ansAr: string; ansEn: string;
    hintAr: string; hintEn: string;
    expAr: string; expEn: string;
    topic: string;
    steps?: string[];
  };

  const pool: Record<DifficultyLevel, Item[]> = {
    1: [
      {
        qAr: 'أَيُّ حَاسَّةٍ نَسْتَخْدِمُهَا لِرُؤْيَةِ الأَلْوَانِ وَالأَشْكَالِ مِنْ حَوْلِنَا؟ 👁️',
        qEn: 'Which sense do we use to see colors and shapes around us? 👁️',
        optsAr: ['حَاسَّةُ البَصَرِ (العَيْن)', 'حَاسَّةُ السَّمْعِ (الأُذُن)', 'حَاسَّةُ الشَّمِّ (الأَنْف)', 'حَاسَّةُ التَّذَوُّقِ (اللِّسَان)'],
        optsEn: ['Sight (Eyes) 👁️', 'Hearing (Ears) 👂', 'Smell (Nose) 👃', 'Taste (Tongue) 👅'],
        ansAr: 'حَاسَّةُ البَصَرِ (العَيْن)', ansEn: 'Sight (Eyes) 👁️',
        hintAr: 'العضو الموجود في الوجه وننظر به', hintEn: 'The facial organ used for looking',
        expAr: 'العينان هما عضوا حاسة البصر التي نرى بها كل ما حولنا.', expEn: 'We use our eyes for vision and observing the world.',
        topic: 'five_senses'
      }
    ],
    2: [
      {
        qAr: 'مَاذَا تَحْتَاجُ النَّبَاتَاتُ الخَضْرَاءُ لِتَصْنَعَ غِذَاءَهَا وَتَنْمُوَ؟ 🌱',
        qEn: 'What do green plants need to make their food and grow? 🌱',
        optsAr: ['المَاءُ وَضَوْءُ الشَّمْسِ وَالهَوَاءُ', 'الحَلْوَى وَالمَشْرُوبَاتُ الغَازِيَّةُ', 'الظَّلامُ الدَّامِسُ فَقَطْ', 'البُرُودَةُ الشَّدِيدَةُ فَقَطْ'],
        optsEn: ['Water, Sunlight, and Air', 'Soda and Candy', 'Total Darkness only', 'Freezing Ice only'],
        ansAr: 'المَاءُ وَضَوْءُ الشَّمْسِ وَالهَوَاءُ', ansEn: 'Water, Sunlight, and Air',
        hintAr: 'ضوء الشمس الساطع والري بالماء النقي', hintEn: 'Sunlight shining down and fresh water',
        expAr: 'النباتات تحتاج لضوء الشمس والماء وثاني أكسيد الكربون لعملية البناء الضوئي.', expEn: 'Plants produce food via photosynthesis using water, sunlight, and air.',
        topic: 'plant_biology',
        steps: ['امتصاص الماء بالجذور 💧', 'التقاط الضوء بالأوراق ☀️', 'صنع الغذاء والنمو 🌿']
      }
    ],
    3: [
      {
        qAr: 'عِنْدَمَا يَتَحَوَّلُ المَاءُ السَّائِلُ إِلَى جَلِيدٍ، فِي أَيِّ حَالَةٍ يَكُونُ؟ 🧊',
        qEn: 'When liquid water freezes into solid ice, what state of matter is it? 🧊',
        optsAr: ['الحَالَةُ الصَّلْبَةُ', 'الحَالَةُ السَّائِلَةُ', 'الحَالَةُ الغَازِيَّةُ', 'حَالَةُ البُخَارِ'],
        optsEn: ['Solid state', 'Liquid state', 'Gas state', 'Plasma state'],
        ansAr: 'الحَالَةُ الصَّلْبَةُ', ansEn: 'Solid state',
        hintAr: 'له شكل ثابت وملمس جامد متماسك', hintEn: 'Has a fixed shape and firm feel',
        expAr: 'الجليد هو الحالة الصلبة للماء عندما تنخفض درجة حرارته لتحت الصفر المئوي.', expEn: 'Ice is the solid state of H2O below 0°C.',
        topic: 'states_of_matter'
      }
    ],
    4: [
      {
        qAr: 'مَا هُوَ الكَوْكَبُ الَّذِي نَعِيشُ عَلَيْهِ وَيَدُورُ حَوْلَ الشَّمْسِ؟ 🌍',
        qEn: 'Which planet do we live on that orbits the Sun? 🌍',
        optsAr: ['كَوْكَبُ الأَرْضِ', 'كَوْكَبُ المِرِّيخِ', 'كَوْكَبُ المُشْتَرِي', 'القَمَرُ'],
        optsEn: ['Planet Earth', 'Mars', 'Jupiter', 'The Moon'],
        ansAr: 'كَوْكَبُ الأَرْضِ', ansEn: 'Planet Earth',
        hintAr: 'الكوكب الأزرق الغني بالماء والحياة', hintEn: 'The blue planet rich with water and life',
        expAr: 'الأرض هي الكوكب الثالث من الشمس وهو الكوكب الوحيد المعروف بوجود حياة عليه.', expEn: 'Earth is our home planet orbiting the Sun in the solar system.',
        topic: 'solar_system'
      }
    ],
    5: [
      {
        qAr: 'مَا هِيَ القُوَّةُ الَّتِي تَسْحَبُ الأَشْيَاءَ نَحْوَ مَرْكَزِ الأَرْضِ وَتَمْنَعُنَا مِنَ الطَّيَرَانِ فِي الفَضَاءِ؟ 🍎',
        qEn: 'What force pulls objects toward the center of the Earth? 🍎',
        optsAr: ['قُوَّةُ الجَاذِبِيَّةِ', 'قُوَّةُ المَغْنَاطِيسِ', 'قُوَّةُ الاحْتِكَاكِ', 'قُوَّةُ الرِّيَاحِ'],
        optsEn: ['Gravity', 'Magnetism', 'Friction', 'Wind force'],
        ansAr: 'قُوَّةُ الجَاذِبِيَّةِ', ansEn: 'Gravity',
        hintAr: 'القوة التي اكتشفها نيوتن عند سقوط التفاحة', hintEn: 'The force Newton explored when the apple dropped',
        expAr: 'الجاذبية الأرضية تسحب جميع الكتل نحو مركز كوكب الأرض.', expEn: 'Gravity pulls all objects toward Earth\'s center.',
        topic: 'forces_and_gravity'
      }
    ]
  };

  const items = pool[difficulty] || pool[1];
  const item = items[Math.floor(Math.random() * items.length)];

  return {
    id,
    subject: 'science',
    difficulty,
    question: isAr ? item.qAr : item.qEn,
    questionArabic: item.qAr,
    type: 'multiple_choice',
    options: (isAr ? item.optsAr : item.optsEn).sort(() => Math.random() - 0.5),
    optionsArabic: item.optsAr,
    correctAnswer: isAr ? item.ansAr : item.ansEn,
    hint: isAr ? item.hintAr : item.hintEn,
    hintArabic: item.hintAr,
    explanation: isAr ? item.expAr : item.expEn,
    explanationArabic: item.expAr,
    topic: item.topic,
    visualAid: item.steps ? { type: 'step_diagram', steps: item.steps } : undefined,
  };
}

// ── 5. English Curriculum Bank ───────────────────────
function generateLocalEnglishExercise(id: string, difficulty: DifficultyLevel, _language: 'en' | 'ar'): Exercise {
  type Item = {
    q: string; qAr: string;
    opts: string[]; optsAr: string[];
    ans: string; ansAr: string;
    hint: string; hintAr: string;
    exp: string; expAr: string;
    topic: string;
    visualEmoji?: string;
  };

  const pool: Record<DifficultyLevel, Item[]> = {
    1: [
      {
        q: 'What is the English word for this fruit: 🍎?',
        qAr: 'ما هي الكلمة الإنجليزية لهذه الفاكهة: 🍎؟',
        opts: ['Apple', 'Banana', 'Orange', 'Grape'],
        optsAr: ['Apple (تفاحة)', 'Banana (موزة)', 'Orange (برتقالة)', 'Grape (عنب)'],
        ans: 'Apple', ansAr: 'Apple (تفاحة)',
        hint: 'Starts with "A"', hintAr: 'تبدأ بحرف A',
        exp: 'Apple is the English word for تفاحة.', expAr: 'Apple تعني تفاحة باللغة الإنجليزية.',
        topic: 'basic_vocabulary', visualEmoji: '🍎'
      },
      {
        q: 'Which animal is this: 🐱?',
        qAr: 'ما هو هذا الحيوان: 🐱؟',
        opts: ['Cat', 'Dog', 'Lion', 'Elephant'],
        optsAr: ['Cat (قطة)', 'Dog (كلب)', 'Lion (أسد)', 'Elephant (فيل)'],
        ans: 'Cat', ansAr: 'Cat (قطة)',
        hint: 'Says "Meow!"', hintAr: 'يصدر صوت "مواء!"',
        exp: 'Cat means قطة in English.', expAr: 'Cat تعني قطة بالإنجليزية.',
        topic: 'basic_vocabulary', visualEmoji: '🐱'
      }
    ],
    2: [
      {
        q: 'What is the opposite of the word "Hot" (🔥)?',
        qAr: 'ما هو عكس كلمة "Hot" (حار 🔥)؟',
        opts: ['Cold ❄️', 'Big 🐘', 'Fast ⚡', 'Bright 💡'],
        optsAr: ['Cold (بارد ❄️)', 'Big (كبير)', 'Fast (سريع)', 'Bright (مضيء)'],
        ans: 'Cold ❄️', ansAr: 'Cold (بارد ❄️)',
        hint: 'Think of winter and ice!', hintAr: 'فكر في الشتاء والثلج!',
        exp: 'The opposite of Hot is Cold.', expAr: 'عكس كلمة Hot (حار) هو Cold (بارد).',
        topic: 'opposites'
      }
    ],
    3: [
      {
        q: 'Complete the sentence: "The birds are ____ in the blue sky." 🕊️',
        qAr: 'أكمل الجملة: "الطيور ____ في السماء الزرقاء."',
        opts: ['flying', 'swimming', 'crying', 'cooking'],
        optsAr: ['flying (تطير)', 'swimming (تسبح)', 'crying (تبكي)', 'cooking (تطبخ)'],
        ans: 'flying', ansAr: 'flying (تطير)',
        hint: 'Birds have wings to...', hintAr: 'الطيور تملك أجنحة لكي...',
        exp: 'Birds fly in the sky using their wings.', expAr: 'تستخدم الطيور أجنحتها للطيران (flying).',
        topic: 'action_verbs'
      }
    ],
    4: [
      {
        q: 'Choose the correct preposition: "The pencil is ____ the desk." ✏️',
        qAr: 'اختر حرف الجر الصحيح: "القلم ____ المكتب."',
        opts: ['on', 'between', 'underneath', 'into'],
        optsAr: ['on (على)', 'between (بين)', 'underneath (تحت بعيداً)', 'into (داخل إلى)'],
        ans: 'on', ansAr: 'on (على)',
        hint: 'Resting upon the surface', hintAr: 'مستقر فوق السطح',
        exp: '"On" is used when an object rests upon a surface.', expAr: 'نستخدم on للدلالة على الوجود فوق السطح.',
        topic: 'prepositions'
      }
    ],
    5: [
      {
        q: 'Which sentence is written correctly in the past tense? ⏰',
        qAr: 'أي جملة مكتوبة في زمن الماضي بشكل صحيح؟',
        opts: ['Yesterday, I visited my grandparents.', 'Yesterday, I visit my grandparents.', 'Yesterday, I will visit my grandparents.', 'Yesterday, I visiting my grandparents.'],
        optsAr: ['Yesterday, I visited my grandparents.', 'Yesterday, I visit my grandparents.', 'Yesterday, I will visit my grandparents.', 'Yesterday, I visiting my grandparents.'],
        ans: 'Yesterday, I visited my grandparents.', ansAr: 'Yesterday, I visited my grandparents.',
        hint: '"Yesterday" refers to the past (-ed).', hintAr: 'كلمة yesterday تدل على الماضي فنضيف ed للفعل المنتظم.',
        exp: 'Regular verbs take "-ed" in the simple past tense.', expAr: 'الأفعال المنتظمة تأخذ -ed في زمن الماضي البسيط.',
        topic: 'past_tense'
      }
    ]
  };

  const items = pool[difficulty] || pool[1];
  const item = items[Math.floor(Math.random() * items.length)];

  return {
    id,
    subject: 'english',
    difficulty,
    question: item.q,
    questionArabic: item.qAr,
    type: 'multiple_choice',
    options: item.opts.sort(() => Math.random() - 0.5),
    optionsArabic: item.optsAr,
    correctAnswer: item.ans,
    hint: item.hint,
    hintArabic: item.hintAr,
    explanation: item.exp,
    explanationArabic: item.expAr,
    topic: item.topic,
    visualAid: item.visualEmoji ? { type: 'image_word', emoji: item.visualEmoji } : undefined,
  };
}

function generateLocalMathExercise(id: string, difficulty: DifficultyLevel, language: 'en' | 'ar'): Exercise {
  const maxNum = [10, 20, 50, 100, 200][difficulty - 1];
  const a = Math.floor(Math.random() * maxNum) + 1;
  const b = Math.floor(Math.random() * Math.min(a, maxNum / 2)) + 1;
  const ops = difficulty <= 2 ? ['+'] : difficulty <= 3 ? ['+', '-'] : ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];

  let answer: number;
  let questionText: string;

  switch (op) {
    case '-':
      answer = a - b;
      questionText = `${a} - ${b} = ?`;
      break;
    case '×':
      const m1 = Math.floor(Math.random() * 12) + 1;
      const m2 = Math.floor(Math.random() * 12) + 1;
      answer = m1 * m2;
      questionText = `${m1} × ${m2} = ?`;
      break;
    default:
      answer = a + b;
      questionText = `${a} + ${b} = ?`;
  }

  const wrongAnswers = new Set<number>();
  while (wrongAnswers.size < 3) {
    const offset = Math.floor(Math.random() * 5) + 1;
    const wrong = Math.random() > 0.5 ? answer + offset : Math.max(0, answer - offset);
    if (wrong !== answer) wrongAnswers.add(wrong);
  }

  const options = [answer.toString(), ...Array.from(wrongAnswers).map(String)].sort(() => Math.random() - 0.5);

  const visualAid: VisualAidData | undefined = difficulty <= 2 && op === '+'
    ? { type: 'counting_objects', emoji: '🍎', count: Math.min(a, 10), secondCount: Math.min(b, 10) }
    : undefined;

  return {
    id,
    subject: 'math',
    difficulty,
    question: language === 'ar' ? `ما ناتج ${questionText.replace('?', '؟')}` : `What is ${questionText}`,
    questionArabic: `ما ناتج ${questionText.replace('?', '؟')}`,
    type: 'multiple_choice',
    options,
    correctAnswer: answer.toString(),
    hint: language === 'ar' ? 'حاول العد على أصابعك!' : 'Try counting on your fingers!',
    hintArabic: 'حاول العد على أصابعك!',
    visualAid,
    explanation: language === 'ar' ? `الإجابة الصحيحة هي ${answer}` : `The correct answer is ${answer}`,
    explanationArabic: `الإجابة الصحيحة هي ${answer}`,
    topic: op === '+' ? 'addition' : op === '-' ? 'subtraction' : 'multiplication',
  };
}

function generateLocalMemoryExercise(id: string, difficulty: DifficultyLevel, language: 'en' | 'ar'): Exercise {
  const emojis = ['🍎', '🌟', '🎈', '🐱', '🌈', '🎵', '🦋', '🌻', '🍕', '🚀'];
  const count = Math.min(difficulty + 2, 8);
  const shuffled = [...emojis].sort(() => Math.random() - 0.5);
  const sequence = shuffled.slice(0, count);
  const correctAnswer = sequence.join(' ');

  // Create wrong sequences by swapping elements
  const options = [correctAnswer];
  for (let i = 0; i < 3; i++) {
    const wrong = [...sequence];
    const idx1 = Math.floor(Math.random() * wrong.length);
    const idx2 = (idx1 + 1 + Math.floor(Math.random() * (wrong.length - 1))) % wrong.length;
    [wrong[idx1], wrong[idx2]] = [wrong[idx2], wrong[idx1]];
    options.push(wrong.join(' '));
  }

  return {
    id,
    subject: 'memory',
    difficulty,
    question: language === 'ar'
      ? `تذكر هذا الترتيب: ${sequence.join(' ')} — ثم اختر الترتيب الصحيح`
      : `Remember this sequence: ${sequence.join(' ')} — then choose the correct order`,
    questionArabic: `تذكر هذا الترتيب: ${sequence.join(' ')} — ثم اختر الترتيب الصحيح`,
    type: 'multiple_choice',
    options: options.sort(() => Math.random() - 0.5),
    correctAnswer,
    hint: language === 'ar' ? 'ركز في أول عنصر وآخر عنصر في السلسلة' : 'Focus on the first and last item in the sequence',
    hintArabic: 'ركز في أول عنصر وآخر عنصر في السلسلة',
    explanation: language === 'ar' ? `الترتيب الأصلي الصحيح هو: ${correctAnswer}` : `The correct original sequence was: ${correctAnswer}`,
    explanationArabic: `الترتيب الأصلي الصحيح هو: ${correctAnswer}`,
    topic: 'sequence_recall',
  };
}

// ── Generate Progress Summary ──────────────
export async function generateProgressSummary(profile: LearningProfile): Promise<string> {
  const subjects = Object.entries(profile.subjects)
    .map(([s, p]) => `${s}: accuracy=${(p.accuracyRate * 100).toFixed(0)}%, difficulty=${p.currentDifficulty}/5, sessions=${p.sessionsCompleted}`)
    .join('\n');

  const prompt = `Summarize this child's learning progress in 3-4 sentences. Be encouraging and specific.

${subjects}

Overall: ${profile.totalSessionsCompleted} sessions, ${profile.totalTimeSpentMinutes} minutes, ${profile.streakDays} day streak.
Learning style preference: ${profile.preferredLearningStyle}.

Write in both English and Arabic. Format:
English summary here.
---
Arabic summary here.`;

  const raw = await callAI(prompt);
  return raw || 'Keep up the great work! 🌟\n---\nاستمر في العمل الرائع! 🌟';
}
