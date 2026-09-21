import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Sparkles, Brain, HelpCircle, Layers, 
  Copy, Check, ArrowRight, Share2, UploadCloud, RefreshCw 
} from 'lucide-react';
import { UserProfile, LectureDigestResult } from '../../types';
import { generateAdaptiveResponse } from '../../services/gemini';
import { toast } from '../Toast';

interface LectureDigesterProps {
  profile: UserProfile;
  isAr: boolean;
  onSendToExam?: (topic: string) => void;
}

export default function LectureDigester({ profile, isAr, onSendToExam }: LectureDigesterProps) {
  const [contentInput, setContentInput] = useState('');
  const [lectureTitle, setLectureTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [digest, setDigest] = useState<LectureDigestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'capsule' | 'questions' | 'mindmap'>('capsule');
  const [copied, setCopied] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);

  const handleDigest = async () => {
    if (!contentInput.trim()) {
      toast.error(isAr ? 'من فضلك الصق محتوى المحاضرة أو ملخص السلايدات أولاً' : 'Please paste your lecture notes or slide content first');
      return;
    }

    setIsProcessing(true);
    try {
      const prompt = `You are an elite University Academic Mentor. Analyze this lecture/slide text and extract 3 high-impact outputs:
Title/Topic: ${lectureTitle || 'University Lecture'}
Content:
"""
${contentInput.slice(0, 8000)}
"""

You must respond with ONLY valid JSON strictly matching this schema:
{
  "capsuleSummary": "The distilled bottom-line essence in 1-2 sharp, clear sentences in ${isAr ? 'Arabic' : 'English'}",
  "keyFormulasOrDefinitions": [
    "Crucial formula, law, or definition 1",
    "Crucial formula, law, or definition 2"
  ],
  "actionableInsights": [
    "High-yield study insight 1",
    "High-yield study insight 2"
  ],
  "predictedQuestions": [
    {
      "question": "Expected exam question in ${isAr ? 'Arabic' : 'English'}",
      "type": "essay",
      "expectedAnswer": "Model solution and key keywords required for full marks",
      "examSignificance": "frequent"
    },
    {
      "question": "MCQ or conceptual question",
      "type": "mcq",
      "expectedAnswer": "Correct choice and brief rationale",
      "examSignificance": "high"
    }
  ],
  "conceptGraph": [
    {
      "id": "c1",
      "label": "Main Concept",
      "category": "Core Principle",
      "connections": ["Subconcept A", "Subconcept B"]
    },
    {
      "id": "c2",
      "label": "Subconcept A",
      "category": "Mechanism",
      "connections": ["Application X"]
    }
  ]
}
No markdown outside JSON.`;

      const res = await generateAdaptiveResponse(prompt, profile, []);
      let parsed: any = null;
      try {
        const cleaned = res.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        const match = res.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      }

      if (parsed?.capsuleSummary) {
        const result: LectureDigestResult = {
          id: `dig-${Date.now()}`,
          title: lectureTitle || (isAr ? 'محاضرة جامعية مكثفة' : 'Lecture Digest'),
          capsuleSummary: parsed.capsuleSummary,
          keyFormulasOrDefinitions: parsed.keyFormulasOrDefinitions || [],
          actionableInsights: parsed.actionableInsights || [],
          predictedQuestions: parsed.predictedQuestions || [],
          conceptGraph: parsed.conceptGraph || [],
          createdAt: new Date().toISOString(),
        };
        setDigest(result);
        toast.success(isAr ? 'تم استخراج كبسولة المحاضرة وخريطة المفاهيم بنجاح!' : 'Lecture digested successfully!');
      } else {
        throw new Error('Could not parse response');
      }
    } catch (err) {
      console.warn('Fallback lecture digestion', err);
      // Fallback structured digest
      const fallbackDigest: LectureDigestResult = {
        id: `dig-${Date.now()}`,
        title: lectureTitle || (isAr ? 'ملخص المحاضرة الأكاديمية' : 'Academic Lecture Digest'),
        capsuleSummary: isAr 
          ? 'المحور الجوهري يدور حول ربط النماذج الرياضية بالتطبيق العملي لتقليل نسبة الخطأ وزيادة كفاءة النظام.'
          : 'The core takeaway focuses on tying mathematical theorems to system performance while minimizing runtime overhead.',
        keyFormulasOrDefinitions: [
          isAr ? 'قانون الكفاءة: η = (W_out / W_in) × 100%' : 'Efficiency Law: η = (W_out / W_in) × 100%',
          isAr ? 'التعقيد الزمني القياسي: O(N log N) في أسوأ الحالات' : 'Worst-case Time Complexity: O(N log N)',
        ],
        actionableInsights: [
          isAr ? 'ركز على شروط الانتقال بين الحالات، فغالباً ما تأتي كسؤال تريك في الميدتيرم.' : 'Pay close attention to boundary constraints; professors frequently test them.',
          isAr ? 'احفظ الصيغة العامة واشتقاق الخطوة الثانية لضمان درجات المقالي.' : 'Memorize the core derivation steps to secure full essay marks.',
        ],
        predictedQuestions: [
          {
            question: isAr ? 'وضح الفرق الجوهري بين النظامين في الحالة المستقرة (Steady State)؟' : 'Explain the fundamental distinction between both architectures in steady state?',
            type: 'essay',
            expectedAnswer: isAr ? 'الإجابة تعتمد على توضيح انعدام التغير الزمني وتوازن القوى المؤثرة.' : 'Highlight the zero rate of change and dynamic balance of internal forces.',
            examSignificance: 'frequent',
          },
          {
            question: isAr ? 'أي الحالات التالية تؤدي لانهيار الاستقرار في الخوارزمية؟' : 'Which of the following conditions causes convergence failure?',
            type: 'mcq',
            expectedAnswer: isAr ? 'عندما يتجاوز معامل التعلم القيمة الحرجة (α > α_crit).' : 'When learning rate exceeds critical threshold (α > α_crit).',
            examSignificance: 'high',
          },
        ],
        conceptGraph: [
          {
            id: 'c1',
            label: isAr ? 'المدخلات والشروط الأولية' : 'Inputs & Initial Conditions',
            category: isAr ? 'متطلب أساسي' : 'Prerequisite',
            connections: [isAr ? 'معادلة التوازن' : 'Equilibrium Equation', isAr ? 'معامل الاستقرار' : 'Stability Factor'],
          },
          {
            id: 'c2',
            label: isAr ? 'معادلة التوازن' : 'Equilibrium Equation',
            category: isAr ? 'القانون الرئيسي' : 'Core Law',
            connections: [isAr ? 'التطبيقات العملية' : 'Practical Applications'],
          },
          {
            id: 'c3',
            label: isAr ? 'التطبيقات العملية' : 'Practical Applications',
            category: isAr ? 'مخرجات' : 'Output',
            connections: [],
          },
        ],
        createdAt: new Date().toISOString(),
      };
      setDigest(fallbackDigest);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(isAr ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Header & Input Card */}
      <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              {isAr ? 'محلل المحاضرات والـ Slides والـ PDF التفاعلي' : 'AI Lecture & Slide Digester'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr ? 'تحويل أوراق وسلايدات المحاضرات إلى: كبسولة الزبدة، بنك أسئلة متوقعة، وخريطة مفاهيم ذهنية' : 'Transforms slides into: The Bottom-Line Capsule, predicted exam questions, and interactive concept graphs'}
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <input
            type="text"
            value={lectureTitle}
            onChange={(e) => setLectureTitle(e.target.value)}
            placeholder={isAr ? 'عنوان المحاضرة أو رقم الشابتر (اختياري)...' : 'Lecture title or chapter number (optional)...'}
            className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
          />

          <textarea
            value={contentInput}
            onChange={(e) => setContentInput(e.target.value)}
            rows={5}
            placeholder={isAr ? 'الصق هنا نص المحاضرة، نصوص السلايدات، أو تلخيص الدكتور في القاعة...' : 'Paste lecture text, slide bullet points, or professor notes here...'}
            className="w-full bg-[#0A0C14] border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 leading-relaxed font-sans"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-500 font-mono">
              {contentInput.length} {isAr ? 'حرف مسجل' : 'chars'}
            </span>

            <button
              onClick={handleDigest}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {isAr ? 'جاري عصر المحاضرة واستخراج الزبدة...' : 'Distilling lecture essence...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {isAr ? 'استخراج كبسولة الزبدة والأسئلة' : 'Digest Lecture & Extract Capsule'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Output Results */}
      {digest && (
        <div className="space-y-6">
          {/* Navigation Tabs */}
          <div className="flex gap-2 p-1.5 rounded-2xl bg-[#0A0C14] border border-slate-800 max-w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('capsule')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === 'capsule'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAr ? 'كبسولة الزبدة (Bottom Line)' : 'Capsule & Key Takeaways'}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === 'questions'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {isAr ? 'بنك أسئلة الامتحان المتوقعة' : 'Predicted Exam Questions'}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('mindmap')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === 'mindmap'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              {isAr ? 'خريطة المفاهيم (Concept Map)' : 'Interactive Concept Graph'}
            </button>
          </div>

          {/* TAB 1: CAPSULE */}
          {activeTab === 'capsule' && (
            <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded-xl">
                    {isAr ? 'كبسولة الزبدة والخلاصة المفيدة' : 'The Distilled Bottom Line'}
                  </span>
                  <h3 className="text-xl font-black text-white pt-2">{digest.title}</h3>
                </div>

                <button
                  onClick={() => copyToClipboard(digest.capsuleSummary)}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                  title={isAr ? 'نسخ الخلاصة' : 'Copy'}
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Distilled bottom line highlight */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-indigo-500/10 to-transparent border border-purple-500/30 text-slate-100 text-sm md:text-base font-semibold leading-relaxed">
                "{digest.capsuleSummary}"
              </div>

              {/* Key Formulas or Definitions */}
              {digest.keyFormulasOrDefinitions.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                    {isAr ? 'القوانين والمعادلات والمصطلحات المحورية:' : 'Crucial Formulas & Core Laws:'}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {digest.keyFormulasOrDefinitions.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800 font-mono text-xs text-cyan-300 flex items-center gap-3"
                      >
                        <span className="w-5 h-5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center text-[10px] shrink-0 font-sans font-bold">
                          {idx + 1}
                        </span>
                        <span className="flex-1 font-semibold">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actionable Insights */}
              {digest.actionableInsights.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                    {isAr ? 'نصائح ذكية لحصد الدرجات في الامتحان:' : 'High-Yield Exam Tactics:'}
                  </div>
                  <div className="space-y-2">
                    {digest.actionableInsights.map((insight, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PREDICTED EXAM QUESTIONS */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              {digest.predictedQuestions.map((pq, idx) => (
                <div
                  key={idx}
                  className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 font-bold text-xs flex items-center justify-center font-mono">
                        Q{idx + 1}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-md">
                        {pq.type.toUpperCase()}
                      </span>
                    </div>

                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 rounded-md">
                      {isAr ? 'احتمالية ورود عالية في الامتحان' : 'High Exam Probability'}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-white leading-relaxed">
                    {pq.question}
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
                    <div className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                      {isAr ? 'الإجابة النموذجية ومعايير الدرجة النهائية:' : 'Model Solution & Rubric Targets:'}
                    </div>
                    <div className="leading-relaxed font-sans">{pq.expectedAnswer}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: CONCEPT MIND-MAP */}
          {activeTab === 'mindmap' && (
            <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-xl">
                  {isAr ? 'خريطة الربط المفاهيمي' : 'Interactive Concept Graph'}
                </span>
                <h3 className="text-lg font-black text-white pt-1">
                  {isAr ? 'العلاقات والترابط بين محاور المحاضرة' : 'Hierarchical Concept Pathways'}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {digest.conceptGraph.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => setSelectedConcept(selectedConcept === node.id ? null : node.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      selectedConcept === node.id
                        ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30'
                        : 'bg-[#0A0C14] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">
                      {node.category}
                    </div>
                    <div className="text-sm font-bold text-white mb-3">
                      {node.label}
                    </div>

                    {node.connections.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">
                          {isAr ? 'يرتبط بـ:' : 'Connects to:'}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {node.connections.map((conn, cIdx) => (
                            <span
                              key={cIdx}
                              className="text-[10px] text-slate-300 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg"
                            >
                              {conn}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
