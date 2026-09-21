import React, { useState, useEffect } from 'react';
import { Exercise, ExerciseResult, AIAnalysis, LearningProfile } from '../../../types/learning';
import { generateAdaptiveExercise, analyzeAnswer, generateLocalExercise } from '../../../services/learningAI';
import { recordExerciseResult } from '../../../lib/learningProfile';
import ProgressBar from '../shared/ProgressBar';
import ExerciseFeedback from '../shared/ExerciseFeedback';
import { Volume2, BookOpen, Mic, MicOff, Sparkles, VolumeX, Repeat, CheckCircle2 } from 'lucide-react';
import { learningAudio } from '../../../lib/learningAudio';

interface ReadingModuleProps {
  userId: string;
  learningProfile: LearningProfile;
  onUpdateProfile: (profile: LearningProfile) => void;
  onBack: () => void;
  isArabic?: boolean;
}

export const ReadingModule: React.FC<ReadingModuleProps> = ({
  userId,
  learningProfile,
  onUpdateProfile,
  onBack,
  isArabic = false,
}) => {
  const subjectProfile = learningProfile.subjects.reading;
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [sessionQuestionCount, setSessionQuestionCount] = useState(1);
  const [sessionStars, setSessionStars] = useState(0);
  const [streak, setStreak] = useState(subjectProfile.consecutiveCorrect);
  const [speechRate, setSpeechRate] = useState<number>(0.8);
  const [isListening, setIsListening] = useState(false);
  const [speechFeedback, setSpeechFeedback] = useState<string | null>(null);

  const fetchNextExercise = async () => {
    setIsLoading(true);
    setSelectedOption(null);
    setIsAnswered(false);
    setAnalysis(null);
    setSpeechFeedback(null);
    setIsListening(false);

    try {
      const exercise = await generateAdaptiveExercise(
        {
          subject: 'reading',
          difficulty: subjectProfile.currentDifficulty,
          teachingMethod: subjectProfile.preferredMethod,
          language: isArabic ? 'ar' : 'en',
          curriculumLevel: learningProfile.curriculumLevel,
        },
        subjectProfile
      );

      if (exercise) {
        setCurrentExercise(exercise);
      } else {
        setCurrentExercise(generateLocalExercise('reading', subjectProfile.currentDifficulty, isArabic ? 'ar' : 'en'));
      }
    } catch {
      setCurrentExercise(generateLocalExercise('reading', subjectProfile.currentDifficulty, isArabic ? 'ar' : 'en'));
    } finally {
      setIsLoading(false);
      setStartTime(Date.now());
    }
  };

  useEffect(() => {
    fetchNextExercise();
  }, []);

  const speakText = (text: string, slow: boolean = false) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isArabic ? 'ar-SA' : 'en-US';
    utterance.rate = slow ? 0.6 : speechRate;
    window.speechSynthesis.speak(utterance);
  };

  const handleSpeechPronounce = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(isArabic ? 'متصفحك لا يدعم التعرف على الصوت مباشرة.' : 'Speech Recognition is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = isArabic ? 'ar-SA' : 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListening(true);
      setSpeechFeedback(isArabic ? 'جاري الاستماع... انطق الكلمة الآن 🎙️' : 'Listening... speak the word now! 🎙️');

      recognition.onresult = (event: any) => {
        setIsListening(false);
        const spoken = event.results[0][0].transcript.trim().toLowerCase();
        const target = (currentExercise?.correctAnswer || '').toLowerCase().replace(/[^\w\s\u0621-\u064A]/g, '').trim();
        const cleanSpoken = spoken.replace(/[^\w\s\u0621-\u064A]/g, '');

        if (cleanSpoken.includes(target) || target.includes(cleanSpoken)) {
          learningAudio.playCorrect();
          setSpeechFeedback(isArabic ? `🌟 ممتاز جداً! نطقت: "${spoken}" بدقة رائعة!` : `🌟 Fantastic! You said: "${spoken}" correctly!`);
          handleSelectOption(currentExercise!.correctAnswer);
        } else {
          learningAudio.playIncorrect();
          setSpeechFeedback(isArabic ? `سمعنا: "${spoken}". حاول نطق: "${currentExercise?.correctAnswer}" مرة أخرى!` : `We heard: "${spoken}". Let's try saying "${currentExercise?.correctAnswer}"!`);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setSpeechFeedback(isArabic ? 'لم نتمكن من التقاط الصوت، حاول مجدداً.' : 'Could not hear clearly, try again!');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechFeedback(isArabic ? 'تعذر تشغيل الميكروفون.' : 'Microphone unavailable.');
    }
  };

  const handleSelectOption = async (option: string) => {
    if (isAnswered || !currentExercise) return;

    learningAudio.playClick();
    setSelectedOption(option);
    setIsAnswered(true);
    const responseTime = Date.now() - startTime;

    const resultAnalysis = await analyzeAnswer(currentExercise, option, subjectProfile);
    setAnalysis(resultAnalysis);

    const isCorrect = resultAnalysis.isCorrect;
    if (isCorrect) {
      learningAudio.playCorrect();
      setSessionStars((prev) => prev + currentExercise.difficulty * 2);
      setStreak((prev) => prev + 1);
    } else {
      learningAudio.playIncorrect();
      setStreak(0);
    }

    const result: ExerciseResult = {
      exerciseId: currentExercise.id,
      subject: 'reading',
      difficulty: currentExercise.difficulty,
      isCorrect,
      childAnswer: option,
      correctAnswer: currentExercise.correctAnswer,
      responseTimeMs: responseTime,
      mistakeType: resultAnalysis.mistakeType,
      attemptNumber: 1,
      teachingMethodUsed: 'audio',
      topic: currentExercise.topic,
      timestamp: Date.now(),
    };

    const updatedProfile = await recordExerciseResult(userId, result, learningProfile);
    onUpdateProfile(updatedProfile);
  };

  const handleNext = () => {
    setSessionQuestionCount((prev) => prev + 1);
    fetchNextExercise();
  };

  return (
    <div className="max-w-3xl mx-auto w-full p-4 sm:p-6 text-white animate-in fade-in duration-300">
      <ProgressBar
        currentQuestion={sessionQuestionCount}
        totalQuestions={10}
        starsEarned={sessionStars}
        streakCount={streak}
        difficulty={subjectProfile.currentDifficulty}
        isArabic={isArabic}
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-slate-900/60 rounded-3xl border border-slate-800">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-400 font-bold text-sm">
            {isArabic ? 'جاري تجهيز نص القراءة الممتع...' : 'Preparing a fun reading lesson for you...'}
          </p>
        </div>
      ) : currentExercise ? (
        <div className="flex flex-col gap-5">
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border-2 border-green-500/30 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 font-black text-xs flex items-center gap-1.5 border border-green-500/30">
                <BookOpen className="w-3.5 h-3.5" />
                {isArabic ? 'مهارة القراءة' : 'Reading Lab'} • Level {currentExercise.difficulty}
              </span>

              {/* Audio controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => speakText(currentExercise.question, true)}
                  className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs text-amber-300 flex items-center gap-1 border border-slate-700 transition-all font-bold"
                  title={isArabic ? 'نطق بطيء' : 'Slow audio'}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'نطق بطيء' : 'Slow'}</span>
                </button>
                <button
                  onClick={() => speakText(currentExercise.question, false)}
                  className="p-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/40 transition-all shadow-md"
                  title={isArabic ? 'استمع للنص' : 'Listen'}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Reading Text Banner */}
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 my-4 text-center">
              <p className="text-2xl sm:text-3xl font-black text-green-300 tracking-wide leading-relaxed">
                {isArabic
                  ? currentExercise.questionArabic || currentExercise.question
                  : currentExercise.question}
              </p>

              {/* Syllable Breakdown Pills if available */}
              {currentExercise.syllables && currentExercise.syllables.length > 0 && (
                <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                  <span className="text-xs text-slate-400 font-bold">{isArabic ? 'المقاطع الصوتية:' : 'Phonics / Syllables:'}</span>
                  {currentExercise.syllables.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => speakText(s, true)}
                      className="px-3.5 py-1.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-300 font-black text-sm transition-all active:scale-95 shadow-sm"
                      title={isArabic ? 'استمع للمقطع' : 'Listen to syllable'}
                    >
                      {s} 🔊
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Read Aloud Microphone Practice Tool */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 mb-2 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Mic className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-xs font-black text-emerald-300">
                    {isArabic ? 'تحدي نطق الكلمة بصوتك' : 'Voice Reading Challenge'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {isArabic ? 'اضغط الميكروفون واقرأ الكلمة لتقييم نطقك' : 'Tap the microphone and say the answer aloud'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSpeechPronounce}
                disabled={isAnswered || isListening}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md active:scale-95 ${
                  isListening
                    ? 'bg-rose-600 animate-pulse text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>{isArabic ? 'جاري الاستماع...' : 'Listening...'}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>{isArabic ? 'اقرأ بصوتك 🎙️' : 'Read Aloud 🎙️'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Live Speech Feedback Alert */}
            {speechFeedback && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/40 text-xs text-emerald-300 font-bold mb-3 flex items-center gap-2 animate-in fade-in">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{speechFeedback}</span>
              </div>
            )}

            {/* Multiple Choice Options Grid */}
            <p className="text-xs font-bold text-slate-400 mb-3">
              {isArabic ? 'اختر الكلمة أو النطق الصحيح:' : 'Choose the correct match or word:'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {(isArabic && currentExercise.optionsArabic ? currentExercise.optionsArabic : currentExercise.options || []).map(
                (opt, idx) => {
                  const originalOpt = currentExercise.options?.[idx] || opt;
                  const isSelected = selectedOption === originalOpt;
                  const isCorrect = originalOpt === currentExercise.correctAnswer;

                  let buttonStyle = 'bg-slate-950/80 hover:bg-slate-800/90 border-slate-800 text-slate-200 hover:border-green-500/50';

                  if (isAnswered) {
                    if (isCorrect) {
                      buttonStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-[1.02]';
                    } else if (isSelected) {
                      buttonStyle = 'bg-rose-500/20 border-rose-500 text-rose-300';
                    } else {
                      buttonStyle = 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-60';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(originalOpt)}
                      disabled={isAnswered}
                      className={`p-4 rounded-2xl border-2 text-left font-black text-base sm:text-lg transition-all flex items-center justify-between shadow-md active:scale-95 ${buttonStyle}`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{opt}</span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            speakText(opt);
                          }}
                          className="p-1 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div className="w-6 h-6 rounded-full border border-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {isAnswered && (
            <ExerciseFeedback
              analysis={analysis}
              isCorrect={analysis?.isCorrect ?? false}
              correctAnswer={currentExercise.correctAnswer}
              onNext={handleNext}
              isArabic={isArabic}
            />
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ReadingModule;
