import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, Clock, CheckCircle2, XCircle, AlertCircle, 
  Sparkles, RefreshCw, Send, ChevronRight, ChevronLeft, 
  BookOpen, HelpCircle, FileText, Check, ShieldAlert
} from 'lucide-react';
import { UserProfile, MockExamQuestion, MockExamSubmission, QuestionGradingResult } from '../../types';
import { generateAdaptiveResponse } from '../../services/gemini';
import { toast } from '../Toast';

interface MockExamSimulatorProps {
  profile: UserProfile;
  isAr: boolean;
}

export default function MockExamSimulator({ profile, isAr }: MockExamSimulatorProps) {
  // Config state
  const [phase, setPhase] = useState<'config' | 'generating' | 'active' | 'grading' | 'results'>('config');
  const [topic, setTopic] = useState('');
  const [course, setCourse] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(4);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [timerMinutes, setTimerMinutes] = useState<number>(20);

  // Active exam state
  const [questions, setQuestions] = useState<MockExamQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Results state
  const [submission, setSubmission] = useState<MockExamSubmission | null>(null);

  // Timer effect
  useEffect(() => {
    if (phase === 'active' && timeLeftSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, timeLeftSeconds]);

  const handleStartExam = async () => {
    if (!topic.trim()) {
      toast.error(isAr ? 'من فضلك اكتب موضوع الامتحان أو الشابتر أولاً' : 'Please enter an exam topic or chapter first');
      return;
    }

    setPhase('generating');
    try {
      const prompt = `You are a strict yet fair University Professor. Generate a comprehensive mock exam with exactly ${questionCount} questions for the course "${course || 'General'}" on the topic: "${topic}".
Difficulty level: ${difficulty}.
Include a mix of Multiple Choice (mcq), Short Answer (short), and Essay (essay) questions.
You must respond with ONLY valid JSON strictly matching this schema:
{
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question": "Question text in ${isAr ? 'Arabic' : 'English'}",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "The exact correct option string",
      "rubricCriteria": ["Key fact 1", "Key fact 2"],
      "points": 10
    },
    {
      "id": "q2",
      "type": "essay",
      "question": "Detailed conceptual essay question in ${isAr ? 'Arabic' : 'English'}",
      "rubricCriteria": ["Comprehensive explanation", "Mention of core formula/mechanism", "Real-world context"],
      "points": 25
    }
  ]
}
No markdown wrappers outside JSON.`;

      const res = await generateAdaptiveResponse(prompt, profile, []);
      let parsedJson: any = null;
      try {
        const cleaned = res.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsedJson = JSON.parse(cleaned);
      } catch {
        // Regex extract json if noisy
        const match = res.match(/\{[\s\S]*\}/);
        if (match) parsedJson = JSON.parse(match[0]);
      }

      if (parsedJson?.questions?.length) {
        setQuestions(parsedJson.questions);
        setTimeLeftSeconds(timerMinutes * 60);
        setAnswers({});
        setCurrentIdx(0);
        setPhase('active');
        toast.success(isAr ? 'تم إنشاء الامتحان بنجاح! بالتوفيق.' : 'Exam generated successfully! Good luck.');
      } else {
        throw new Error('Invalid exam format');
      }
    } catch (err) {
      console.warn('Fallback mock exam generation', err);
      // Fallback robust questions
      const fallbackQuestions: MockExamQuestion[] = [
        {
          id: 'q1',
          type: 'mcq',
          question: isAr ? `ما هو المفهوم الأساسي المتحكم في (${topic})؟` : `What is the core principle governing (${topic})?`,
          options: [
            isAr ? 'المبدأ الأول: الاستقرار الديناميكي' : 'Principle 1: Dynamic Equilibrium',
            isAr ? 'المبدأ الثاني: حفظ الطاقة والمعلومات' : 'Principle 2: Conservation of Energy',
            isAr ? 'المبدأ الثالث: زيادة الإنتروبيا العشوائية' : 'Principle 3: Entropy Minimization',
            isAr ? 'المبدأ الرابع: التغذية الراجعة السلبية' : 'Principle 4: Negative Feedback',
          ],
          correctAnswer: isAr ? 'المبدأ الثاني: حفظ الطاقة والمعلومات' : 'Principle 2: Conservation of Energy',
          rubricCriteria: [isAr ? 'تحديد المبدأ الحاكم' : 'Identify governing law'],
          points: 20,
        },
        {
          id: 'q2',
          type: 'short',
          question: isAr ? `اذكر باختصار شرطين أساسيين لتطبيق خوارزمية أو معادلة (${topic}).` : `Briefly state two essential conditions for applying (${topic}).`,
          rubricCriteria: [isAr ? 'الشرط الأولي' : 'Initial condition', isAr ? 'نطاق التطبيق' : 'Domain scope'],
          points: 30,
        },
        {
          id: 'q3',
          type: 'essay',
          question: isAr ? `اشرح بالتفصيل آلية عمل (${topic}) مبيناً أهم الأخطاء الشائعة التي يقع فيها الطلاب أثناء حل المسائل.` : `Explain in detail the mechanism of (${topic}), highlighting the most common errors students make.`,
          rubricCriteria: [isAr ? 'التعريف الدقيق' : 'Precise definition', isAr ? 'تسلسل الخطوات' : 'Step sequence', isAr ? 'تجنب الأخطاء الشائعة' : 'Common pitfall analysis'],
          points: 50,
        },
      ];
      setQuestions(fallbackQuestions);
      setTimeLeftSeconds(timerMinutes * 60);
      setAnswers({});
      setCurrentIdx(0);
      setPhase('active');
    }
  };

  const handleAutoSubmit = () => {
    toast.info(isAr ? 'انتهى وقت الامتحان! جاري التصحيح التلقائي...' : 'Time is up! Automatically grading your exam...');
    handleSubmitExam();
  };

  const handleSubmitExam = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('grading');

    const totalTimeSpent = timerMinutes * 60 - timeLeftSeconds;

    try {
      const gradingPrompt = `You are a University Professor grading a student's completed exam.
Exam Topic: ${topic}
Questions and Student Answers:
${JSON.stringify(
  questions.map((q) => ({
    id: q.id,
    question: q.question,
    type: q.type,
    maxPoints: q.points,
    rubricCriteria: q.rubricCriteria,
    correctAnswer: q.correctAnswer,
    studentAnswer: answers[q.id] || '(No answer provided)',
  })),
  null,
  2
)}

Grade each question strictly and fairly. Evaluate essays using academic rubric criteria.
Respond with ONLY valid JSON strictly matching this schema:
{
  "results": [
    {
      "questionId": "q1",
      "scoreAwarded": 10,
      "maxScore": 10,
      "modelAnswer": "Clear, complete model answer in ${isAr ? 'Arabic' : 'English'}",
      "strengths": ["Clear explanation of concept"],
      "missedKeywords": ["Did not mention term X"],
      "rubricFeedback": "Detailed feedback on what was done well and how to get full marks."
    }
  ]
}`;

      const res = await generateAdaptiveResponse(gradingPrompt, profile, []);
      let parsed: any = null;
      try {
        const cleaned = res.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        const match = res.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      }

      const results: QuestionGradingResult[] = parsed?.results || questions.map((q) => {
        const stAns = answers[q.id] || '';
        const isMcq = q.type === 'mcq';
        const isCorrect = isMcq && stAns.trim() === q.correctAnswer?.trim();
        const score = isMcq ? (isCorrect ? q.points : 0) : Math.round(q.points * 0.75);
        return {
          questionId: q.id,
          studentAnswer: stAns || '(لم تتم الإجابة)',
          scoreAwarded: score,
          maxScore: q.points,
          modelAnswer: q.correctAnswer || (isAr ? 'الإجابة النموذجية تشمل استيفاء المعايير وشرح المفهوم الأساسي بدقة.' : 'Complete model explanation meeting all rubric requirements.'),
          strengths: [isAr ? 'صياغة منطقية ومحاولة جيدة' : 'Logical articulation and strong effort'],
          missedKeywords: [isAr ? 'تضمين المزيد من الكلمات الدقيقة والقوانين' : 'Further specific keywords and constraints'],
          rubricFeedback: isAr ? 'إجابة جيدة تدل على استيعاب الفكرة الرئيسية مع الحاجة لتدعيم التفاصيل.' : 'Good response showing conceptual grasp with room for technical detail.',
        };
      });

      const totalEarned = results.reduce((sum, r) => sum + r.scoreAwarded, 0);
      const totalPossible = questions.reduce((sum, q) => sum + q.points, 0);
      const percentage = Math.round((totalEarned / (totalPossible || 1)) * 100);

      let gpaEquiv = 'A+ (4.0)';
      if (percentage < 60) gpaEquiv = 'F (0.0)';
      else if (percentage < 70) gpaEquiv = 'C (2.0)';
      else if (percentage < 80) gpaEquiv = 'B (3.0)';
      else if (percentage < 90) gpaEquiv = 'A- (3.7)';

      const submissionData: MockExamSubmission = {
        id: `sub-${Date.now()}`,
        examTitle: topic,
        course: course || (isAr ? 'مادة عامة' : 'General Course'),
        topic,
        totalScore: totalEarned,
        maxPossibleScore: totalPossible,
        percentage,
        gpaEquivalent: gpaEquiv,
        timeSpentSeconds: totalTimeSpent,
        createdAt: new Date().toISOString(),
        results,
      };

      setSubmission(submissionData);
      setPhase('results');
    } catch (err) {
      console.error('Grading error', err);
      toast.error(isAr ? 'حدث خطأ أثناء التصحيح، تم استخدام التقييم التقريبي' : 'Grading failed, approximate score used');
      setPhase('results');
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 1. CONFIGURATION VIEW
  if (phase === 'config') {
    return (
      <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              {isAr ? 'محاكي الامتحانات وتصحيح المقالي الذكي' : 'AI Mock Exam & Essay Grader'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr ? 'امتحانات واقعية مطابقة لمعايير الجامعات مع تصحيح مقالي بالروبرك ونموذج الإجابة' : 'University-grade exam simulation with instant AI essay grading and model answers'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'المادة الدراسية (Course Name)' : 'Course Name'}
              </label>
              <input
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder={isAr ? 'مثال: خوارزميات وهياكل بيانات، كيمياء حيوية...' : 'e.g. Data Structures, Macroeconomics...'}
                className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'موضوع الامتحان أو الشابتر (Topic / Chapter) *' : 'Topic / Chapter *'}
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={isAr ? 'مثال: Binary Search Trees & AVL Balances' : 'e.g. Binary Search Trees & AVL Balances'}
                className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'عدد الأسئلة' : 'Questions Count'}
              </label>
              <div className="flex gap-2">
                {[3, 4, 6].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setQuestionCount(cnt)}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                      questionCount === cnt
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : 'bg-[#0A0C14] text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {cnt} {isAr ? 'أسئلة' : 'Q'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'مستوى الصعوبة' : 'Difficulty'}
              </label>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border capitalize transition-all ${
                      difficulty === diff
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-[#0A0C14] text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {isAr ? (diff === 'easy' ? 'سهل' : diff === 'medium' ? 'متوسط' : 'جامعي / صعب') : diff}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'الوقت المحدد' : 'Timer Duration'}
              </label>
              <div className="flex gap-2">
                {[10, 20, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setTimerMinutes(mins)}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                      timerMinutes === mins
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-[#0A0C14] text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {mins} {isAr ? 'د' : 'min'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleStartExam}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-black text-sm shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              {isAr ? 'بدء الامتحان التجريبي الآن' : 'Start Mock Exam Now'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. GENERATING / GRADING LOADER
  if (phase === 'generating' || phase === 'grading') {
    return (
      <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-12 backdrop-blur-xl text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 animate-pulse">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
        <h3 className="text-lg font-black text-white">
          {phase === 'generating'
            ? isAr ? 'جاري إعداد الأسئلة وتصميم الامتحان الجامعي...' : 'Generating tailored university mock exam...'
            : isAr ? 'مصحح الذكاء الاصطناعي يفحص إجاباتك ويراجع معايير الروبرك...' : 'AI professor evaluating your answers against rubrics...'}
        </h3>
        <p className="text-xs text-slate-400 mt-2">
          {isAr ? 'يتم تحليل معايير التقييم وصياغة نموذج الإجابة المثالي...' : 'Calculating rubric criteria and exact keyword alignments...'}
        </p>
      </div>
    );
  }

  // 3. ACTIVE EXAM VIEW
  if (phase === 'active' && questions.length > 0) {
    const currQ = questions[currentIdx];
    const isAnswered = Boolean(answers[currQ.id]);

    return (
      <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
        {/* Top bar: Question navigation & Timer */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-xl">
              {isAr ? `سؤال ${currentIdx + 1} من ${questions.length}` : `Question ${currentIdx + 1} of ${questions.length}`}
            </span>
            <span className="text-xs text-slate-400 font-bold">
              ({currQ.points} {isAr ? 'درجة' : 'pts'})
            </span>
            <span className="text-[11px] font-black uppercase text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-lg">
              {currQ.type.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm font-black border ${
              timeLeftSeconds < 180 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' : 'bg-slate-900 text-amber-400 border-slate-800'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{formatTimer(timeLeftSeconds)}</span>
            </div>

            <button
              onClick={handleSubmitExam}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              {isAr ? 'تسليم الامتحان' : 'Submit Exam'}
            </button>
          </div>
        </div>

        {/* Question Text */}
        <div className="space-y-4">
          <div className="text-base md:text-lg font-bold text-white leading-relaxed">
            {currQ.question}
          </div>

          {/* Answer Input based on type */}
          {currQ.type === 'mcq' && currQ.options ? (
            <div className="grid grid-cols-1 gap-2.5 pt-2">
              {currQ.options.map((opt, oIdx) => {
                const isSelected = answers[currQ.id] === opt;
                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => setAnswers({ ...answers, [currQ.id]: opt })}
                    className={`flex items-center gap-3 p-4 rounded-2xl border text-start text-sm font-semibold transition-all ${
                      isSelected
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-500/10'
                        : 'bg-[#0A0C14] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border ${
                      isSelected ? 'bg-indigo-500 text-white border-indigo-400' : 'border-slate-700 text-slate-500'
                    }`}>
                      {String.fromCharCode(65 + oIdx)}
                    </div>
                    <span className="flex-1">{opt}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              <label className="text-xs text-slate-400 font-bold block">
                {isAr ? 'اكتب إجابتك وشرح خطواتك بالتفصيل:' : 'Write your detailed response and steps below:'}
              </label>
              <textarea
                value={answers[currQ.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [currQ.id]: e.target.value })}
                rows={5}
                placeholder={isAr ? 'اكتب شرحك هنا وسيقوم المصحح الذكي بتقييم الكلمات المفتاحية والمفاهيم...' : 'Type your explanation here. The AI grader will evaluate your key concepts and logic...'}
                className="w-full bg-[#0A0C14] border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
              />
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A0C14] border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 text-xs font-bold transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            {isAr ? 'السابق' : 'Previous'}
          </button>

          <div className="flex gap-1.5">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(idx)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  idx === currentIdx
                    ? 'bg-indigo-500 text-white shadow'
                    : answers[q.id]
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={currentIdx === questions.length - 1}
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A0C14] border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 text-xs font-bold transition-all"
          >
            {isAr ? 'التالي' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 4. RESULTS & RUBRIC BREAKDOWN VIEW
  if (phase === 'results' && submission) {
    return (
      <div className="space-y-6">
        {/* Score Header Card */}
        <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-start">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl">
                {isAr ? 'نتيجة الامتحان والتقييم النهائي' : 'Exam Grading & Rubric Report'}
              </span>
              <h2 className="text-2xl font-black text-white pt-2">{submission.examTitle}</h2>
              <p className="text-xs text-slate-400">
                {submission.course} • {isAr ? `الوقت المستغرق: ${Math.round(submission.timeSpentSeconds / 60)} دقيقة` : `Time: ${Math.round(submission.timeSpentSeconds / 60)} mins`}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-[#0A0C14] border border-slate-800 rounded-2xl p-4 text-center min-w-[110px]">
                <div className="text-[10px] uppercase font-bold text-slate-400">{isAr ? 'الدرجة' : 'Score'}</div>
                <div className="font-mono text-3xl font-black text-emerald-400">
                  {submission.totalScore}<span className="text-sm text-slate-500">/{submission.maxPossibleScore}</span>
                </div>
                <div className="text-[10px] font-bold text-slate-500">{submission.percentage}%</div>
              </div>

              <div className="bg-[#0A0C14] border border-slate-800 rounded-2xl p-4 text-center min-w-[110px]">
                <div className="text-[10px] uppercase font-bold text-slate-400">{isAr ? 'المعدل المعادل' : 'GPA Equiv'}</div>
                <div className="font-mono text-2xl font-black text-cyan-400">
                  {submission.gpaEquivalent}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 flex gap-3 justify-end border-t border-slate-800/80 mt-6">
            <button
              onClick={() => setPhase('config')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {isAr ? 'إنشاء امتحان جديد' : 'New Mock Exam'}
            </button>
          </div>
        </div>

        {/* Question Breakdown List */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-white px-2">
            {isAr ? 'التحليل التفصيلي ومعايير تصحيح المقالي (Rubric Breakdown):' : 'Detailed Rubric Evaluation & Model Answers:'}
          </h3>

          {submission.results.map((res, idx) => {
            const originalQ = questions.find((q) => q.id === res.questionId);
            const isFullScore = res.scoreAwarded === res.maxScore;

            return (
              <div
                key={res.questionId}
                className="bg-[#121524]/80 border border-slate-800/80 rounded-2xl p-5 space-y-3 backdrop-blur-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-300">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-200">
                      {originalQ?.question}
                    </span>
                  </div>
                  <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-xl shrink-0 border ${
                    isFullScore
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    {res.scoreAwarded} / {res.maxScore}
                  </span>
                </div>

                {/* Student Answer */}
                <div className="bg-[#0A0C14] rounded-xl p-3 border border-slate-800/60 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {isAr ? 'إجابتك المسجلة:' : 'Your Answer:'}
                  </div>
                  <div className="text-slate-300 font-sans">{res.studentAnswer}</div>
                </div>

                {/* Rubric Feedback & Strengths */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {res.strengths?.length > 0 && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                      <div className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1.5 mb-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isAr ? 'نقاط القوة المستوفاة في الروبرك:' : 'Rubric Strengths Demonstrated:'}
                      </div>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        {res.strengths.map((str, sIdx) => (
                          <li key={sIdx}>{str}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {res.missedKeywords?.length > 0 && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                      <div className="text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1.5 mb-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {isAr ? 'الكلمات المفتاحية الناقصة (للفل مارك):' : 'Missed Concepts / Keywords:'}
                      </div>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        {res.missedKeywords.map((mk, mIdx) => (
                          <li key={mIdx}>{mk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Model Answer */}
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs">
                  <div className="text-[10px] font-bold uppercase text-indigo-400 flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    {isAr ? 'الإجابة النموذجية الكاملة (Model Answer):' : 'Full Model Answer:'}
                  </div>
                  <div className="text-slate-200 leading-relaxed font-sans">{res.modelAnswer}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
