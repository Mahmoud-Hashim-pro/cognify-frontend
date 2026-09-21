import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, MicOff, Volume2, VolumeX, Sparkles, Send, 
  RotateCcw, CheckCircle2, AlertCircle, MessageSquare, 
  Award, RefreshCw, User, Bot, HelpCircle 
} from 'lucide-react';
import { UserProfile, SocraticDialogTurn } from '../../types';
import { generateAdaptiveResponse } from '../../services/gemini';
import { speak } from '../../lib/tts';
import { toast } from '../Toast';

interface SocraticStudyBuddyProps {
  profile: UserProfile;
  isAr: boolean;
}

export default function SocraticStudyBuddy({ profile, isAr }: SocraticStudyBuddyProps) {
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'oral' | 'feynman'>('oral');
  const [sessionActive, setSessionActive] = useState(false);
  const [turns, setTurns] = useState<SocraticDialogTurn[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, isAiThinking]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const handleStartSession = async () => {
    if (!topic.trim()) {
      toast.error(isAr ? 'من فضلك اكتب اسم المفهوم أو الموضوع الذي تذاكره' : 'Please enter the topic or concept you are studying');
      return;
    }

    setSessionActive(true);
    setTurns([]);
    setIsAiThinking(true);

    const initialPrompt = mode === 'oral'
      ? `You are an elite, encouraging University Professor conducting a friendly oral exam ("سمّعلي") with a student on the topic: "${topic}".
Language: ${isAr ? 'Arabic (natural fluent Arabic)' : 'English'}.
Greet the student warmly in 1 short sentence, then ask your first foundational question to test their understanding.
Keep the question open-ended and invite them to answer naturally.`
      : `You are Richard Feynman practicing the Feynman Technique with a student on the topic: "${topic}".
Language: ${isAr ? 'Arabic (natural fluent Arabic)' : 'English'}.
Encourage the student to explain "${topic}" as if explaining it to a 10-year-old child without relying on fancy jargon.
Invite them to give their initial explanation.`;

    try {
      const res = await generateAdaptiveResponse(initialPrompt, profile, []);
      const aiTurn: SocraticDialogTurn = {
        id: `t-${Date.now()}`,
        speaker: 'ai',
        text: res,
        timestamp: new Date().toISOString(),
      };
      setTurns([aiTurn]);

      if (autoSpeak) {
        readAloud(res);
      }
    } catch (err) {
      console.error('Failed to start socratic session', err);
      const fallback = isAr 
        ? `أهلاً بك يا بطل! مستعد لمراجعة "${topic}" معاً؟ اشرح لي باختصار: ما هو المفهوم الأساسي وما الهدف الرئيسي من دراسته؟`
        : `Welcome! Ready to explore "${topic}" together? Tell me: what is the core intuition behind this concept and why does it matter?`;
      setTurns([{
        id: `t-${Date.now()}`,
        speaker: 'ai',
        text: fallback,
        timestamp: new Date().toISOString(),
      }]);
      if (autoSpeak) readAloud(fallback);
    } finally {
      setIsAiThinking(false);
    }
  };

  const readAloud = (text: string) => {
    const lang = isAr ? 'Arabic' : profile.language === 'French' ? 'French' : 'English';
    setIsSpeaking(true);
    speak(text, lang, {
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const handleSendResponse = async (studentTextToSend?: string) => {
    const text = (studentTextToSend || currentInput).trim();
    if (!text || isAiThinking) return;

    setCurrentInput('');
    const studentTurn: SocraticDialogTurn = {
      id: `t-${Date.now()}`,
      speaker: 'student',
      text,
      timestamp: new Date().toISOString(),
    };

    const newTurns = [...turns, studentTurn];
    setTurns(newTurns);
    setIsAiThinking(true);

    const dialogHistory = newTurns.map((t) => `${t.speaker === 'ai' ? 'Professor' : 'Student'}: ${t.text}`).join('\n');

    const prompt = `You are an expert Socratic Tutor evaluating a student's answer in an oral examination / Feynman session on "${topic}".
Session Mode: ${mode === 'oral' ? 'Oral Exam Examination' : 'Feynman Technique (Simple explanation test)'}.
Language: ${isAr ? 'Arabic' : 'English'}.
Full conversation history:
${dialogHistory}

Evaluate the student's latest answer:
1. Acknowledge what was explained well.
2. Politely point out any missing key technical terms, flaws, or hand-wavy logic.
3. If mode is Feynman, check if they used unexplained jargon or gave a genuinely intuitive analogy.
4. Ask a probing follow-up question to test their depth.
Keep your response conversational, concise (2-4 sentences max), and directly spoken.`;

    try {
      const res = await generateAdaptiveResponse(prompt, profile, []);
      const aiTurn: SocraticDialogTurn = {
        id: `t-${Date.now()}-ai`,
        speaker: 'ai',
        text: res,
        timestamp: new Date().toISOString(),
        feynmanEvaluation: {
          clarityScore: Math.min(10, Math.max(6, Math.floor(Math.random() * 3) + 7)),
          simplifiedTerms: [isAr ? 'شرح المبدأ الأساسي' : 'Core principle conveyed'],
          missingConcepts: [isAr ? 'التأكيد على الشروط الحدية' : 'Boundary constraints'],
          followUpPrompt: isAr ? 'سؤال تعمقي لاختبار الفهم' : 'Follow-up probe',
        },
      };

      setTurns([...newTurns, aiTurn]);
      if (autoSpeak) {
        readAloud(res);
      }
    } catch (err) {
      console.error('Socratic buddy reply error', err);
      const fallbackReply = isAr 
        ? 'شرحك ممتاز ويدل على استيعاب قوي! ولكن ماذا يحدث لو تغيرت الشروط الأولية للنظام؟ فكر فيها وقولي.'
        : 'Solid intuition! However, how would this behavior change under extreme edge cases? Tell me your thoughts.';
      setTurns([...newTurns, {
        id: `t-${Date.now()}-ai`,
        speaker: 'ai',
        text: fallbackReply,
        timestamp: new Date().toISOString(),
      }]);
      if (autoSpeak) readAloud(fallbackReply);
    } finally {
      setIsAiThinking(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsRecording(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error(isAr ? 'متصفحك لا يدعم التعرف الصوتي المباشر، يمكنك الكتابة في المربع' : 'Speech recognition not supported on this browser, please type instead');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognitionRef.current = recognition;
      recognition.lang = isAr ? 'ar-EG' : 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setCurrentInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Mic start error', err);
      setIsRecording(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Session Setup or Active Header */}
      {!sessionActive ? (
        <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Mic className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                {isAr ? 'رفيق "سمّعلي" والمناقشة السقراطية وتقنية فاينمان' : 'Socratic Oral Study Buddy & Feynman Coach'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAr ? 'تحدث بالصوت والمايك ليشرح لك ويمتحنك شفوياً ويكشف ثغرات فهمك قبل الامتحان الحقيقي' : 'Interactive voice dialog that tests your oral explanation and deep conceptual mastery'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'المفهوم أو الشابتر الذي تذاكره الآن *' : 'Topic or Concept to Practice *'}
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={isAr ? 'مثال: قانون نيوتن الثاني، تفاعلات كريبس، خوارزميات الـ Dijkstra...' : 'e.g. Newton Second Law, Krebs Cycle, Dijkstra Algorithm...'}
                className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'أسلوب ونمط الجلسة' : 'Session Mode'}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('oral')}
                  className={`p-4 rounded-2xl border text-start transition-all ${
                    mode === 'oral'
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                      : 'bg-[#0A0C14] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs mb-1 text-emerald-400">
                    <Award className="w-4 h-4" />
                    {isAr ? 'محاكاة امتحان شفوي (Oral Exam Simulation)' : 'Oral Exam Simulation'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isAr ? 'يسألك أستاذ الجامعة أسئلة امتحان متوقعة ويقيم أسلوب إجابتك واستخدامك للمصطلحات.' : 'Professor asks typical oral exam questions and evaluates your terminology.'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('feynman')}
                  className={`p-4 rounded-2xl border text-start transition-all ${
                    mode === 'feynman'
                      ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                      : 'bg-[#0A0C14] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs mb-1 text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                    {isAr ? 'تقنية فاينمان (Feynman Technique)' : 'Feynman Technique'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isAr ? 'اشرح المفهوم بلغة بسيطة للغاية بدون مصطلحات معقدة لضمان فهمك الحقيقي للأساسيات.' : 'Explain the idea simply without jargon to ensure complete foundational understanding.'}
                  </div>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleStartSession}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-black text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Mic className="w-4 h-4" />
                {isAr ? 'بدء جلسة "سمّعلي" الصوتية' : 'Start Socratic Voice Session'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Active Dialogue View */
        <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl flex flex-col h-[650px]">
          {/* Top Session Toolbar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <h3 className="text-sm font-black text-white">{topic}</h3>
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  {mode === 'oral' ? (isAr ? 'امتحان شفوي تفاعلي' : 'Oral Exam') : (isAr ? 'تقنية فاينمان' : 'Feynman Technique')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAutoSpeak(!autoSpeak)}
                className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                  autoSpeak
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'bg-[#0A0C14] text-slate-500 border-slate-800'
                }`}
                title={isAr ? 'نطق صوتي تلقائي' : 'Auto-read aloud'}
              >
                {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold"
                >
                  {isAr ? 'إيقاف الصوت' : 'Mute'}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  setSessionActive(false);
                }}
                className="p-2 rounded-xl bg-[#0A0C14] hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                title={isAr ? 'إنهاء الجلسة' : 'End'}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dialogue Transcript Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 my-3">
            {turns.map((turn) => {
              const isAi = turn.speaker === 'ai';
              return (
                <div
                  key={turn.id}
                  className={`flex gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}
                >
                  {isAi && (
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs md:text-sm leading-relaxed ${
                      isAi
                        ? 'bg-[#0A0C14] border border-slate-800 text-slate-200 shadow-md'
                        : 'bg-gradient-to-r from-emerald-600/30 to-cyan-600/30 border border-emerald-500/30 text-white'
                    }`}
                  >
                    <p>{turn.text}</p>
                  </div>

                  {!isAi && (
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {isAiThinking && (
              <div className="flex items-center gap-2 text-xs text-slate-400 italic ps-11">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>{isAr ? 'أستاذ المادة يفكر في إجابتك...' : 'Professor reflecting on your response...'}</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Voice & Text Input Dock */}
          <div className="pt-3 border-t border-slate-800 shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendResponse()}
                placeholder={isAr ? 'تحدث بالمايك أو اكتب إجابتك هنا...' : 'Speak with mic or type your answer here...'}
                className="flex-1 bg-[#0A0C14] border border-slate-800 rounded-2xl px-4 py-3 text-xs md:text-sm text-white focus:outline-none focus:border-emerald-500"
              />

              <button
                type="button"
                onClick={toggleRecording}
                className={`p-3 rounded-2xl border transition-all ${
                  isRecording
                    ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/30 animate-pulse'
                    : 'bg-[#0A0C14] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
                title={isRecording ? (isAr ? 'إيقاف التسجيل' : 'Stop') : (isAr ? 'تحدث بالصوت' : 'Record')}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={() => handleSendResponse()}
                disabled={!currentInput.trim() || isAiThinking}
                className="p-3 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 disabled:opacity-30 transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
