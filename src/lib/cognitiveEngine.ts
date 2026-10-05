/**
 * Cognitive & Executive Function Engine 2.0 (Cognify)
 * 
 * Evidence-Based Neuropsychological Training & Assistive Scaffolds:
 * 1. Executive Function Paradigms:
 *    - Go / No-Go (Inhibitory Control & Impulse Resistance for ADHD)
 *    - Spatial Memory Grid / Working Memory Span (Capacity expansion for Autism & ADHD)
 *    - Cognitive Set-Shifting / Wisconsin-style Rule Switching (Flexibility for Autism)
 *    - Stroop Flanker Selective Attention (Interference filtering)
 * 2. ADHD Neuro-Toolkit:
 *    - Executive Task Slicer (Decomposing task paralysis into 2-3 min micro-steps)
 *    - Web Audio Ambient Noise Synthesizer (Brown Noise, Pink Noise, White Noise)
 *    - Micro-Sprint Timer (5, 10, 15 min dopamine cycles)
 *    - Compassionate Streak & Grace Days (Rejection Sensitivity protection)
 * 3. Dyscalculia Concrete Modeler:
 *    - Ten-Frame & Subitizing Dot patterns
 *    - Cuisenaire-style Visual Rods
 *    - Interactive Number Line Step Decomposition
 * 4. Low-Arousal & Predictability Scaffolds:
 *    - Visual timeline and session predictability preview for autistic learners
 */

// ─── 1. EXECUTIVE FUNCTION: GO / NO-GO ENGINE ────────────────────────────────

export interface GoNoGoTrial {
  id: string;
  isGo: boolean; // true = Target (Click!), false = No-Go / Trap (Do NOT click!)
  symbol: string;
  labelEn: string;
  labelAr: string;
  durationMs: number;
}

export interface GoNoGoResult {
  totalTrials: number;
  goAccuracy: number; // 0 - 100%
  noGoAccuracy: number; // 0 - 100% (Inhibitory success rate)
  meanReactionTimeMs: number;
  commissionErrors: number; // Clicked on No-Go (Impulsivity indicator)
  omissionErrors: number; // Failed to click on Go (Inattention indicator)
  score: number;
  grade: 'excellent' | 'developing' | 'needs_practice';
  feedbackEn: string;
  feedbackAr: string;
}

const GO_SYMBOLS = [
  { symbol: '🍏', labelEn: 'Green Apple', labelAr: 'تفاحة خضراء' },
  { symbol: '🟢', labelEn: 'Green Circle', labelAr: 'دائرة خضراء' },
  { symbol: '⭐', labelEn: 'Golden Star', labelAr: 'نجمة ذهبية' },
  { symbol: '🚀', labelEn: 'Rocket', labelAr: 'صاروخ' },
  { symbol: '💎', labelEn: 'Gem', labelAr: 'جوهرة' },
];

const NOGO_SYMBOLS = [
  { symbol: '💣', labelEn: 'Bomb (Trap)', labelAr: 'قنبلة (فخ)' },
  { symbol: '🔴', labelEn: 'Red Stop', labelAr: 'دائرة حمراء (قف)' },
  { symbol: '⚠️', labelEn: 'Warning Hazard', labelAr: 'تحذير خطر' },
  { symbol: '🛑', labelEn: 'Stop Sign', labelAr: 'علامة قف' },
];

export function generateGoNoGoSession(
  trialCount: number = 15,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): GoNoGoTrial[] {
  const trials: GoNoGoTrial[] = [];
  const noGoRatio = difficulty === 'easy' ? 0.2 : difficulty === 'medium' ? 0.3 : 0.4;
  const durationMs = difficulty === 'easy' ? 1200 : difficulty === 'medium' ? 850 : 600;

  for (let i = 0; i < trialCount; i++) {
    const isNoGo = Math.random() < noGoRatio;
    if (isNoGo) {
      const sym = NOGO_SYMBOLS[Math.floor(Math.random() * NOGO_SYMBOLS.length)];
      trials.push({
        id: `gn_${i}_${Date.now()}`,
        isGo: false,
        symbol: sym.symbol,
        labelEn: sym.labelEn,
        labelAr: sym.labelAr,
        durationMs,
      });
    } else {
      const sym = GO_SYMBOLS[Math.floor(Math.random() * GO_SYMBOLS.length)];
      trials.push({
        id: `gn_${i}_${Date.now()}`,
        isGo: true,
        symbol: sym.symbol,
        labelEn: sym.labelEn,
        labelAr: sym.labelAr,
        durationMs,
      });
    }
  }
  return trials;
}

export function evaluateGoNoGoPerformance(
  trials: GoNoGoTrial[],
  responses: { trialId: string; userClicked: boolean; reactionTimeMs: number }[]
): GoNoGoResult {
  let goSuccess = 0;
  let goTotal = 0;
  let noGoSuccess = 0;
  let noGoTotal = 0;
  let commissionErrors = 0;
  let omissionErrors = 0;
  const validReactionTimes: number[] = [];

  const responseMap = new Map(responses.map(r => [r.trialId, r]));

  trials.forEach(trial => {
    const resp = responseMap.get(trial.id);
    const clicked = resp?.userClicked ?? false;

    if (trial.isGo) {
      goTotal++;
      if (clicked) {
        goSuccess++;
        if (resp && resp.reactionTimeMs > 0) {
          validReactionTimes.push(resp.reactionTimeMs);
        }
      } else {
        omissionErrors++;
      }
    } else {
      noGoTotal++;
      if (!clicked) {
        noGoSuccess++;
      } else {
        commissionErrors++;
      }
    }
  });

  const goAcc = goTotal > 0 ? Math.round((goSuccess / goTotal) * 100) : 100;
  const noGoAcc = noGoTotal > 0 ? Math.round((noGoSuccess / noGoTotal) * 100) : 100;
  const meanRt = validReactionTimes.length > 0
    ? Math.round(validReactionTimes.reduce((a, b) => a + b, 0) / validReactionTimes.length)
    : 0;

  // Composite Score weighted heavily towards inhibitory control (No-Go accuracy)
  const compositeScore = Math.round(noGoAcc * 0.6 + goAcc * 0.4);

  let grade: 'excellent' | 'developing' | 'needs_practice' = 'developing';
  if (noGoAcc >= 85 && goAcc >= 80) grade = 'excellent';
  else if (noGoAcc < 60) grade = 'needs_practice';

  return {
    totalTrials: trials.length,
    goAccuracy: goAcc,
    noGoAccuracy: noGoAcc,
    meanReactionTimeMs: meanRt,
    commissionErrors,
    omissionErrors,
    score: compositeScore,
    grade,
    feedbackEn: commissionErrors > 2
      ? 'Notice the impulse to tap on traps. Slowing down by just 200ms drastically improves control.'
      : 'Excellent inhibitory control! You stayed calm under pressure.',
    feedbackAr: commissionErrors > 2
      ? 'لاحظ الرغبة التلقائية في التسرع والضغط على الفخ. التمهل بمقدار ربع ثانية يعزز تحكمك الإرادي بشكل كبير.'
      : 'تحكم إرادي ممتاز في الاندفاع! حافظت على هدوء استجابتك وثباتك.',
  };
}

// ─── 2. EXECUTIVE FUNCTION: SPATIAL WORKING MEMORY GRID ──────────────────────

export interface MemoryGridRound {
  gridSize: 3 | 4; // 3x3 or 4x4
  sequence: number[]; // indices 0 to gridSize*gridSize - 1
  isReverse: boolean; // Forward vs Reverse recall
}

export function generateMemoryGridSequence(
  length: number,
  gridSize: 3 | 4 = 3,
  isReverse: boolean = false
): MemoryGridRound {
  const totalCells = gridSize * gridSize;
  const sequence: number[] = [];
  while (sequence.length < length) {
    const nextIdx = Math.floor(Math.random() * totalCells);
    // Avoid adjacent immediate duplicates for clarity
    if (sequence.length === 0 || sequence[sequence.length - 1] !== nextIdx) {
      sequence.push(nextIdx);
    }
  }
  return { gridSize, sequence, isReverse };
}

export function evaluateMemoryGridAnswer(
  round: MemoryGridRound,
  userSequence: number[]
): { isCorrect: boolean; matchedCount: number; maxSpan: number } {
  const target = round.isReverse ? [...round.sequence].reverse() : round.sequence;
  let matched = 0;
  for (let i = 0; i < target.length; i++) {
    if (userSequence[i] === target[i]) {
      matched++;
    } else {
      break;
    }
  }
  const isCorrect = userSequence.length === target.length && matched === target.length;
  return {
    isCorrect,
    matchedCount: matched,
    maxSpan: target.length,
  };
}

// ─── 3. EXECUTIVE FUNCTION: COGNITIVE SET-SHIFTING (WISCONSIN STYLE) ─────────

export type CardColor = 'red' | 'blue' | 'green' | 'yellow';
export type CardShape = 'circle' | 'square' | 'triangle' | 'star';
export type CardCount = 1 | 2 | 3 | 4;
export type SortRule = 'color' | 'shape' | 'count';

export interface SetShiftingCard {
  id: string;
  color: CardColor;
  shape: CardShape;
  count: CardCount;
}

export const TARGET_REFERENCE_CARDS: SetShiftingCard[] = [
  { id: 'ref_1', color: 'red', shape: 'circle', count: 1 },
  { id: 'ref_2', color: 'blue', shape: 'square', count: 2 },
  { id: 'ref_3', color: 'green', shape: 'triangle', count: 3 },
  { id: 'ref_4', color: 'yellow', shape: 'star', count: 4 },
];

export function generateRandomTestCard(id: string = 'card_test'): SetShiftingCard {
  const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];
  const shapes: CardShape[] = ['circle', 'square', 'triangle', 'star'];
  const counts: CardCount[] = [1, 2, 3, 4];

  return {
    id,
    color: colors[Math.floor(Math.random() * colors.length)],
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    count: counts[Math.floor(Math.random() * counts.length)],
  };
}

export function checkSetShiftingMatch(
  card: SetShiftingCard,
  referenceCard: SetShiftingCard,
  activeRule: SortRule
): boolean {
  if (activeRule === 'color') return card.color === referenceCard.color;
  if (activeRule === 'shape') return card.shape === referenceCard.shape;
  if (activeRule === 'count') return card.count === referenceCard.count;
  return false;
}

export function pickNextShiftingRule(currentRule: SortRule): SortRule {
  const rules: SortRule[] = ['color', 'shape', 'count'];
  const filtered = rules.filter(r => r !== currentRule);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// ─── 4. EXECUTIVE FUNCTION: STROOP & FLANKER ATTENTION ────────────────────────

export interface StroopTrial {
  id: string;
  wordText: string;
  inkColorHex: string;
  colorName: 'red' | 'blue' | 'green' | 'yellow';
  isCongruent: boolean;
}

export function generateStroopTrial(): StroopTrial {
  const colors: { name: 'red' | 'blue' | 'green' | 'yellow'; hex: string; textAr: string }[] = [
    { name: 'red', hex: '#ef4444', textAr: 'أحمر' },
    { name: 'blue', hex: '#3b82f6', textAr: 'أزرق' },
    { name: 'green', hex: '#10b981', textAr: 'أخضر' },
    { name: 'yellow', hex: '#f59e0b', textAr: 'أصفر' },
  ];

  const wordItem = colors[Math.floor(Math.random() * colors.length)];
  const isCongruent = Math.random() < 0.5;

  let inkItem = wordItem;
  if (!isCongruent) {
    const others = colors.filter(c => c.name !== wordItem.name);
    inkItem = others[Math.floor(Math.random() * others.length)];
  }

  return {
    id: `stroop_${Date.now()}_${Math.random()}`,
    wordText: wordItem.textAr,
    inkColorHex: inkItem.hex,
    colorName: inkItem.name,
    isCongruent,
  };
}

// ─── 5. ADHD NEURO-TOOLKIT: TASK SLICER (EXECUTIVE UNBLOCKER) ─────────────────

export interface MicroTaskStep {
  id: string;
  titleEn: string;
  titleAr: string;
  estMinutes: number;
  completed: boolean;
  dopamineBonus: number;
}

export interface TaskSlicerDecomposition {
  originalTask: string;
  totalEstMinutes: number;
  steps: MicroTaskStep[];
}

/**
 * Intelligent rule-based task slicer that decomposes intimidating academic
 * and daily goals into bite-sized, dopamine-friendly micro-steps (< 3 mins each).
 */
export function sliceTaskIntoMicroSteps(taskInput: string): TaskSlicerDecomposition {
  const trimmed = taskInput.trim();
  const lower = trimmed.toLowerCase();

  // Pattern detection for common study tasks
  if (lower.includes('بحث') || lower.includes('مقالة') || lower.includes('essay') || lower.includes('write')) {
    return {
      originalTask: trimmed,
      totalEstMinutes: 8,
      steps: [
        { id: 's1', titleEn: 'Open a blank document and write only the title', titleAr: 'افتح ملف فارغ واكتب فقط عنوان البحث في المنتصف', estMinutes: 1, completed: false, dopamineBonus: 10 },
        { id: 's2', titleEn: 'Bullet 3 main ideas you want to talk about (no full sentences)', titleAr: 'اكتب 3 أفكار رئيسية كنقاط فقط (بدون جمل كاملة)', estMinutes: 2, completed: false, dopamineBonus: 15 },
        { id: 's3', titleEn: 'Write just 2 sentences under the first bullet', titleAr: 'اكتب جملتين فقط تحت الفكرة الأولى لشرحها', estMinutes: 3, completed: false, dopamineBonus: 20 },
        { id: 's4', titleEn: 'Take a 60-second breathing pause & sip water', titleAr: 'استراحة تنفس لمدة 60 ثانية واشرب جرعة ماء', estMinutes: 2, completed: false, dopamineBonus: 10 },
      ],
    };
  }

  if (lower.includes('فيزيا') || lower.includes('مسألة') || lower.includes('شيت') || lower.includes('math') || lower.includes('مسائل')) {
    return {
      originalTask: trimmed,
      totalEstMinutes: 7,
      steps: [
        { id: 's1', titleEn: 'Open the worksheet and circle Question #1 only', titleAr: 'افتح الشيت وضع دائرة حول المسألة رقم 1 فقط وتجاهل الباقي', estMinutes: 1, completed: false, dopamineBonus: 10 },
        { id: 's2', titleEn: 'Extract and write down the Given data (Given = ?)', titleAr: 'استخرج المعطيات واكتبها في مسودة على جنب (المعطيات = ؟)', estMinutes: 2, completed: false, dopamineBonus: 15 },
        { id: 's3', titleEn: 'Write down the single formula that links these givens', titleAr: 'اكتب القانون الأساسي الوحيد الذي يربط هذه المعطيات', estMinutes: 2, completed: false, dopamineBonus: 20 },
        { id: 's4', titleEn: 'Substitute numbers into the formula and calculate', titleAr: 'عوّض بالأرقام في القانون واستخرج الناتج بالآلة', estMinutes: 2, completed: false, dopamineBonus: 25 },
      ],
    };
  }

  if (lower.includes('قراءة') || lower.includes('كتاب') || lower.includes('شابتر') || lower.includes('read') || lower.includes('chapter')) {
    return {
      originalTask: trimmed,
      totalEstMinutes: 6,
      steps: [
        { id: 's1', titleEn: 'Read only the bold headings & glance at diagram photos', titleAr: 'تصفح فقط العناوين العريضة وأشكال الرسوم التوضيحية', estMinutes: 1, completed: false, dopamineBonus: 10 },
        { id: 's2', titleEn: 'Read the first paragraph of the chapter slowly', titleAr: 'اقرأ أول فقرة فقط في بداية الفصل بهدوء تام', estMinutes: 2, completed: false, dopamineBonus: 15 },
        { id: 's3', titleEn: 'Highlight 3 key vocabulary terms with your favorite color', titleAr: 'ظلل 3 مصطلحات هامة بلونك المفضل', estMinutes: 2, completed: false, dopamineBonus: 20 },
        { id: 's4', titleEn: 'Close your eyes and summarize the 3 terms in your own words', titleAr: 'غمض عينك ولخص المصطلحات الثلاثة بلغتك الخاصة في ثوانٍ', estMinutes: 1, completed: false, dopamineBonus: 15 },
      ],
    };
  }

  // Universal Default 3-Step Slicer
  return {
    originalTask: trimmed || 'المهمة الدراسية الحالية',
    totalEstMinutes: 6,
    steps: [
      { id: 's1', titleEn: 'Step 1: Set up your physical space (Open book/screen, remove clutter)', titleAr: 'الخطوة 1: جهز بيئة المذاكرة (افتح الشاشة أو الكتاب وأبعد أي ملهيات)', estMinutes: 1, completed: false, dopamineBonus: 10 },
      { id: 's2', titleEn: 'Step 2: Do the easiest 20% of the task to build momentum', titleAr: 'الخطوة 2: أنجز أسهل 20% في المهمة لتحريك عجلة الدوبامين والبدء', estMinutes: 2, completed: false, dopamineBonus: 20 },
      { id: 's3', titleEn: 'Step 3: Work continuously for 3 uninterrupted minutes', titleAr: 'الخطوة 3: استمر في العمل لـ 3 دقائق متواصلة فقط بدون توقف', estMinutes: 3, completed: false, dopamineBonus: 25 },
    ],
  };
}

// ─── 6. ADHD NEURO-TOOLKIT: WEB AUDIO NOISE SYNTHESIZER ───────────────────────

export type NoiseType = 'brown' | 'pink' | 'white';

export class AmbientNoiseSynthesizer {
  private ctx: AudioContext | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private activeType: NoiseType | null = null;
  private isPlaying: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public play(type: NoiseType = 'brown', volume: number = 0.3) {
    const ctx = this.getContext();
    if (!ctx) return;

    this.stop();

    const bufferSize = ctx.sampleRate * 4; // 4-second loop
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;

      if (type === 'brown') {
        // Brown noise: integrate white noise (6 dB/octave falloff)
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Gain compensation
      } else if (type === 'pink') {
        // Pink noise: Paul Kellet's filter method (3 dB/octave falloff)
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11;
        b6 = white * 0.115926;
      } else {
        // White noise
        data[i] = white * 0.25;
      }
    }

    this.noiseNode = ctx.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(Math.min(1.0, Math.max(0.01, volume)), ctx.currentTime);

    this.noiseNode.connect(this.gainNode);
    this.gainNode.connect(ctx.destination);

    this.noiseNode.start(0);
    this.isPlaying = true;
    this.activeType = type;
  }

  public setVolume(volume: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(Math.min(1.0, Math.max(0.0, volume)), this.ctx.currentTime);
    }
  }

  public stop() {
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {}
      this.noiseNode = null;
    }
    this.isPlaying = false;
    this.activeType = null;
  }

  public getState(): { isPlaying: boolean; activeType: NoiseType | null } {
    return { isPlaying: this.isPlaying, activeType: this.activeType };
  }
}

export const ambientNoise = new AmbientNoiseSynthesizer();

// ─── 7. DYSCALCULIA CONCRETE MODELER ──────────────────────────────────────────

export interface TenFrameModel {
  value: number; // 0 to 20
  firstFrame: boolean[]; // 10 cells
  secondFrame: boolean[]; // 10 cells
}

export function buildTenFrame(value: number): TenFrameModel {
  const bounded = Math.max(0, Math.min(20, Math.round(value)));
  const first = Array.from({ length: 10 }, (_, i) => i < Math.min(10, bounded));
  const second = Array.from({ length: 10 }, (_, i) => i < Math.max(0, bounded - 10));
  return {
    value: bounded,
    firstFrame: first,
    secondFrame: second,
  };
}

export interface CuisenaireRod {
  value: number;
  colorHex: string;
  nameEn: string;
  nameAr: string;
  widthPercent: number; // For responsive CSS visualization
}

export const CUISENAIRE_RODS: Record<number, CuisenaireRod> = {
  1: { value: 1, colorHex: '#f8fafc', nameEn: 'White (1)', nameAr: 'أبيض (1)', widthPercent: 10 },
  2: { value: 2, colorHex: '#ef4444', nameEn: 'Red (2)', nameAr: 'أحمر (2)', widthPercent: 20 },
  3: { value: 3, colorHex: '#10b981', nameEn: 'Light Green (3)', nameAr: 'أخضر فاتح (3)', widthPercent: 30 },
  4: { value: 4, colorHex: '#a855f7', nameEn: 'Purple (4)', nameAr: 'بنفسجي (4)', widthPercent: 40 },
  5: { value: 5, colorHex: '#eab308', nameEn: 'Yellow (5)', nameAr: 'أصفر (5)', widthPercent: 50 },
  6: { value: 6, colorHex: '#059669', nameEn: 'Dark Green (6)', nameAr: 'أخضر غامق (6)', widthPercent: 60 },
  7: { value: 7, colorHex: '#0f172a', nameEn: 'Black (7)', nameAr: 'أسود (7)', widthPercent: 70 },
  8: { value: 8, colorHex: '#92400e', nameEn: 'Brown (8)', nameAr: 'بني (8)', widthPercent: 80 },
  9: { value: 9, colorHex: '#3b82f6', nameEn: 'Blue (9)', nameAr: 'أزرق (9)', widthPercent: 90 },
  10: { value: 10, colorHex: '#ea580c', nameEn: 'Orange (10)', nameAr: 'برتقالي (10)', widthPercent: 100 },
};

export interface VisualArithmeticProblem {
  a: number;
  b: number;
  operator: '+' | '-';
  result: number;
  friendlyDecompositionAr: string;
  friendlyDecompositionEn: string;
}

export function generateConcreteMathProblem(): VisualArithmeticProblem {
  const isAdd = Math.random() < 0.6;
  if (isAdd) {
    const a = Math.floor(Math.random() * 8) + 3; // 3 to 10
    const b = Math.floor(Math.random() * 8) + 2; // 2 to 9
    const sum = a + b;
    // Friendly ten-decomposition
    const neededForTen = 10 - a;
    let explanationAr = `${a} + ${b} = ${sum}`;
    let explanationEn = `${a} + ${b} = ${sum}`;

    if (a < 10 && sum > 10 && neededForTen > 0 && b > neededForTen) {
      const remainder = b - neededForTen;
      explanationAr = `نكمّل الـ ${a} لتصبح 10 (بأخذ ${neededForTen} من ${b})، يتبقى ${remainder}، إذن: 10 + ${remainder} = ${sum}.`;
      explanationEn = `Complete ${a} to 10 (take ${neededForTen} from ${b}), leaves ${remainder}, so: 10 + ${remainder} = ${sum}.`;
    }

    return {
      a,
      b,
      operator: '+',
      result: sum,
      friendlyDecompositionAr: explanationAr,
      friendlyDecompositionEn: explanationEn,
    };
  } else {
    const a = Math.floor(Math.random() * 10) + 6; // 6 to 15
    const b = Math.floor(Math.random() * (a - 2)) + 1; // 1 to a-1
    return {
      a,
      b,
      operator: '-',
      result: a - b,
      friendlyDecompositionAr: `نبدأ من ${a} ونرجع ${b} خطوات إلى الخلف على خط الأعداد فنصل إلى ${a - b}.`,
      friendlyDecompositionEn: `Start at ${a} and jump ${b} steps backward on the number line to reach ${a - b}.`,
    };
  }
}

// ─── 8. COMPASSIONATE STREAKS & GRACE DAYS ────────────────────────────────────

export interface StreakEvaluation {
  currentStreak: number;
  shieldActive: boolean;
  graceDayApplied: boolean;
  messageEn: string;
  messageAr: string;
}

export function evaluateCompassionateStreak(
  lastActiveIsoDate: string | undefined,
  currentStreak: number = 0,
  todayIsoDate: string = new Date().toISOString().split('T')[0]
): StreakEvaluation {
  if (!lastActiveIsoDate) {
    return {
      currentStreak: 1,
      shieldActive: false,
      graceDayApplied: false,
      messageEn: 'Welcome! First session recorded today.',
      messageAr: 'أهلاً بك! تم تسجيل جلستك الأولى اليوم.',
    };
  }

  if (lastActiveIsoDate === todayIsoDate) {
    return {
      currentStreak,
      shieldActive: false,
      graceDayApplied: false,
      messageEn: 'Daily workout already accomplished today!',
      messageAr: 'أحسنت! لقد أتممت نشاطك اليومي بالفعل.',
    };
  }

  const lastDate = new Date(lastActiveIsoDate);
  const today = new Date(todayIsoDate);
  const diffDays = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

  if (diffDays === 1) {
    // Perfect sequential day
    return {
      currentStreak: currentStreak + 1,
      shieldActive: false,
      graceDayApplied: false,
      messageEn: `Streak extended to ${currentStreak + 1} days! 🔥`,
      messageAr: `تم تمديد تتابعك إلى ${currentStreak + 1} أيام متتالية! 🔥`,
    };
  } else if (diffDays === 2) {
    // 1-day missed: Compassionate Grace Day applied!
    return {
      currentStreak: currentStreak, // Shield preserved, not wiped to zero!
      shieldActive: true,
      graceDayApplied: true,
      messageEn: `Grace Day Shield activated! We protected your ${currentStreak}-day streak. Keep going! 🛡️`,
      messageAr: `تم تفعيل درع التتابع الرحيم! حافظنا على تتابعك البالغ ${currentStreak} أيام. مرحباً بعودتك! 🛡️`,
    };
  } else {
    // Extended break: gentle restart without shame
    return {
      currentStreak: 1,
      shieldActive: false,
      graceDayApplied: false,
      messageEn: 'Fresh restart! Every day is a clean beginning.',
      messageAr: 'بداية جديدة ومباركة! كل يوم هو فرصة انطلاق متجددة.',
    };
  }
}
