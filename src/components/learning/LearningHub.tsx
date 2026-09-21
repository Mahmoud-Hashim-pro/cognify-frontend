import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { SubjectType, LearningProfile, createDefaultLearningProfile, CurriculumLevel, ExerciseResult } from '../../types/learning';
import { subscribeLearningProfile, finishLearningSession, resolveMistakeReview, updateLearningSettings } from '../../lib/learningProfile';
import { learningAudio } from '../../lib/learningAudio';
import SubjectCard from './SubjectCard';
import MathModule from './modules/MathModule';
import ReadingModule from './modules/ReadingModule';
import WritingModule from './modules/WritingModule';
import MemoryModule from './modules/MemoryModule';
import ComprehensionModule from './modules/ComprehensionModule';
import ScienceModule from './modules/ScienceModule';
import EnglishModule from './modules/EnglishModule';
import ParentDashboard from './ParentDashboard';
import {
  GraduationCap, Star, Flame, Trophy, ShieldCheck, ArrowLeft, Menu, Sparkles, HeartHandshake,
  Volume2, VolumeX, Type, CheckCircle2, RotateCcw, Target, AlertCircle, X, Check, Layers,
} from 'lucide-react';
import { isArabicLocale } from '../../lib/translations';

interface LearningHubProps {
  profile: UserProfile | null;
  onMenuClick?: () => void;
  onNavigateBack?: () => void;
}

const ALL_SUBJECTS: SubjectType[] = [
  'math',
  'reading',
  'writing',
  'memory',
  'comprehension',
  'science',
  'english',
];

const CURRICULUM_LEVELS: { id: CurriculumLevel; labelEn: string; labelAr: string }[] = [
  { id: 'foundations', labelEn: 'Foundations (Kindergarten)', labelAr: 'التمهيدي والتأسيس' },
  { id: 'elementary', labelEn: 'Elementary (Primary)', labelAr: 'المرحلة الابتدائية' },
  { id: 'intermediate', labelEn: 'Intermediate (Preparatory)', labelAr: 'المرحلة الإعدادية' },
  { id: 'advanced', labelEn: 'Advanced (Secondary)', labelAr: 'المرحلة المتقدمة' },
];

export const LearningHub: React.FC<LearningHubProps> = ({ profile, onMenuClick, onNavigateBack }) => {
  const isArabic = isArabicLocale(profile?.language);
  const userId = profile?.uid || profile?.email || 'guest_child';
  const childName = profile?.name || (isArabic ? 'البطل' : 'Champion');

  const [learningProfile, setLearningProfile] = useState<LearningProfile>(createDefaultLearningProfile());
  const [activeSubject, setActiveSubject] = useState<SubjectType | null>(null);
  const [isParentDashboardOpen, setIsParentDashboardOpen] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [isMuted, setIsMuted] = useState(learningAudio.getMuted());
  const [isReviewingMistakes, setIsReviewingMistakes] = useState(false);
  const [reviewMistakeIndex, setReviewMistakeIndex] = useState(0);

  // Subscribe to realtime learning profile from Firestore / LocalStorage
  useEffect(() => {
    const unsub = subscribeLearningProfile(userId, (updated) => {
      setLearningProfile(updated);
    });
    return () => unsub();
  }, [userId]);

  const handleSelectSubject = (subj: SubjectType) => {
    learningAudio.playClick();
    setActiveSubject(subj);
    setIsReviewingMistakes(false);
    setSessionStartTime(Date.now());
  };

  const handleBackToHub = async () => {
    learningAudio.playClick();
    if (activeSubject) {
      const durationMin = (Date.now() - sessionStartTime) / 60000;
      await finishLearningSession(userId, activeSubject, durationMin, learningProfile);
    }
    setActiveSubject(null);
    setIsReviewingMistakes(false);
  };

  const handleUpdateProfile = (updated: LearningProfile) => {
    setLearningProfile(updated);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    learningAudio.setMuted(next);
    setIsMuted(next);
    if (!next) learningAudio.playCorrect();
  };

  const handleToggleDyslexiaFont = async () => {
    learningAudio.playClick();
    const next = !learningProfile.dyslexiaFont;
    const updated = await updateLearningSettings(userId, { dyslexiaFont: next }, learningProfile);
    setLearningProfile(updated);
  };

  const handleSelectCurriculumLevel = async (level: CurriculumLevel) => {
    learningAudio.playClick();
    const updated = await updateLearningSettings(userId, { curriculumLevel: level }, learningProfile);
    setLearningProfile(updated);
  };

  const handleResolveMistakeItem = async (exerciseId: string) => {
    learningAudio.playCelebration();
    const updated = await resolveMistakeReview(userId, exerciseId, learningProfile);
    setLearningProfile(updated);
    if (updated.mistakeQueue && updated.mistakeQueue.length > 0) {
      setReviewMistakeIndex((prev) => Math.min(prev, updated.mistakeQueue!.length - 1));
    } else {
      setIsReviewingMistakes(false);
    }
  };

  const currentMistake = learningProfile.mistakeQueue?.[reviewMistakeIndex];
  const [reviewSelectedOption, setReviewSelectedOption] = useState<string | null>(null);
  const [reviewIsSubmitted, setReviewIsSubmitted] = useState(false);
  const [reviewIsCorrect, setReviewIsCorrect] = useState<boolean | null>(null);
  const [reviewShowExplanation, setReviewShowExplanation] = useState(false);

  const resetReviewState = () => {
    setReviewSelectedOption(null);
    setReviewIsSubmitted(false);
    setReviewIsCorrect(null);
    setReviewShowExplanation(false);
  };

  const handleReviewAnswer = (option: string) => {
    if (reviewIsSubmitted || !currentMistake) return;
    setReviewSelectedOption(option);
    const isCorrect = option.trim().toLowerCase() === currentMistake.correctAnswer.trim().toLowerCase();
    setReviewIsSubmitted(true);
    setReviewIsCorrect(isCorrect);
    if (isCorrect) {
      learningAudio.playCorrect();
    } else {
      learningAudio.playIncorrect();
      setReviewShowExplanation(true);
    }
  };

  const handleClaimMastery = async () => {
    if (!currentMistake) return;
    resetReviewState();
    await handleResolveMistakeItem(currentMistake.id);
  };

  const handleNextMistake = () => {
    resetReviewState();
    if (learningProfile.mistakeQueue && reviewMistakeIndex < learningProfile.mistakeQueue.length - 1) {
      setReviewMistakeIndex(reviewMistakeIndex + 1);
    }
  };

  const handlePrevMistake = () => {
    resetReviewState();
    if (reviewMistakeIndex > 0) {
      setReviewMistakeIndex(reviewMistakeIndex - 1);
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-full bg-[#0A0C14] text-slate-100 overflow-y-auto relative p-3 sm:p-5 lg:p-8 select-none custom-scrollbar ${
      learningProfile.dyslexiaFont ? 'font-mono tracking-wide' : 'font-sans'
    }`}>
      {/* Ambient Lighting Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Top Banner & Header */}
      <header className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80 flex-wrap">
        <div className="flex items-center gap-3">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="p-2.5 rounded-2xl bg-[#121524] hover:bg-[#181C2E] border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 font-bold text-xs transition-all shadow-md active:scale-95 shrink-0"
              title={isArabic ? 'العودة للمساعد' : 'Back to Assistant'}
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span className="hidden sm:inline">{isArabic ? 'العودة للمساعد' : 'Back to Assistant'}</span>
            </button>
          )}

          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="p-2.5 rounded-2xl bg-[#121524] hover:bg-[#181C2E] border border-slate-800/80 text-slate-400 hover:text-white shrink-0 active:scale-95"
              aria-label={isArabic ? 'القائمة' : 'Menu'}
              title={isArabic ? 'فتح القائمة' : 'Open Menu'}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {activeSubject || isReviewingMistakes ? (
            <button
              onClick={handleBackToHub}
              className="p-2.5 rounded-2xl bg-[#121524] hover:bg-[#181C2E] border border-slate-800/80 text-slate-300 hover:text-white flex items-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isArabic ? 'العودة للمركز' : 'Back to Hub'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>{isArabic ? 'مركز التعلّم الذكي' : 'Adaptive Learning Hub'}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-extrabold border border-indigo-500/30">
                    AI Tutor
                  </span>
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  {isArabic ? `مرحباً بك يا ${childName}! رحلتك التعليمية الممتعة` : `Welcome back, ${childName}! Your personalized adventure`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Pills & Accessibility Toolbar */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Sound Mute/Unmute Toggle */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`p-2.5 rounded-2xl border transition-all shadow-md active:scale-95 ${
              isMuted
                ? 'bg-slate-900 border-slate-800 text-slate-500'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}
            title={isArabic ? (isMuted ? 'تشغيل المؤثرات الصوتية' : 'كتم الصوت') : (isMuted ? 'Unmute audio' : 'Mute audio')}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Dyslexia Font Toggle */}
          <button
            type="button"
            onClick={handleToggleDyslexiaFont}
            className={`px-3 py-1.5 rounded-2xl border text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
              learningProfile.dyslexiaFont
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 ring-2 ring-purple-500/20'
                : 'bg-[#121524] border-slate-800 text-slate-400 hover:text-white'
            }`}
            title={isArabic ? 'تبديل خط عسر القراءة (Dyslexia-friendly)' : 'Toggle Dyslexia-friendly font'}
          >
            <Type className="w-4 h-4" />
            <span className="hidden sm:inline">{isArabic ? 'خط القراءة' : 'Dyslexia'}</span>
          </button>

          {/* Curriculum Stage Selector */}
          <div className="flex items-center gap-1 bg-[#121524] border border-slate-800 rounded-2xl p-1">
            <Layers className="w-3.5 h-3.5 text-indigo-400 mx-1" />
            <select
              value={learningProfile.curriculumLevel || 'elementary'}
              onChange={(e) => handleSelectCurriculumLevel(e.target.value as CurriculumLevel)}
              className="bg-transparent text-xs font-bold text-slate-200 outline-none pr-2 py-0.5 cursor-pointer"
            >
              {CURRICULUM_LEVELS.map((lvl) => (
                <option key={lvl.id} value={lvl.id} className="bg-[#121524] text-white">
                  {isArabic ? lvl.labelAr : lvl.labelEn}
                </option>
              ))}
            </select>
          </div>

          {/* Total Stars Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black text-xs shadow-md shadow-amber-500/5">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>{learningProfile.totalStarsEarned} {isArabic ? 'نجمة' : 'Stars'}</span>
          </div>

          {/* Daily Streak Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 font-black text-xs shadow-md shadow-orange-500/5">
            <Flame className="w-3.5 h-3.5 fill-orange-400" />
            <span>{learningProfile.streakDays} {isArabic ? 'أيام متتالية' : 'Day Streak'}</span>
          </div>

          {/* Parent Portal Button */}
          <button
            onClick={() => setIsParentDashboardOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[#121524] hover:bg-[#181C2E] border border-slate-700/80 text-slate-300 hover:text-white font-black text-xs transition-all shadow-md active:scale-95"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">{isArabic ? 'لوحة الأهل' : 'Parent'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {!activeSubject && !isReviewingMistakes ? (
        /* Subject Selection Grid */
        <div className="flex-1 flex flex-col">
          {/* Welcome Banner */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-950/50 via-purple-950/40 to-[#121524]/90 border border-indigo-500/30 shadow-2xl backdrop-blur-xl mb-6 flex items-center justify-between gap-6 flex-wrap">
            <div className="max-w-xl">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-black text-xs border border-indigo-500/30 mb-3 inline-block">
                ✨ {isArabic ? 'معلم الذكاء الاصطناعي الخاص بك' : 'Your Personal AI Tutor'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">
                {isArabic
                  ? 'اختر مادتك المفضلة وانطلق في مغامرة التعلّم!'
                  : 'Choose a Subject & Begin Your Learning Adventure!'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                {isArabic
                  ? 'يقوم المعلم الذكي بتحليل أدائك وتعديل مستوى الصعوبة والشرح البصري والصوتي ليناسب قدراتك تماماً.'
                  : 'The AI tutor continuously adapts difficulty, visual explanations, and audio aids tailored to your exact learning style.'}
              </p>
            </div>

            <div className="flex items-center gap-3 bg-[#0A0C14]/80 p-4 rounded-2xl border border-slate-800 shadow-inner">
              <HeartHandshake className="w-8 h-8 text-pink-400" />
              <div>
                <p className="text-xs font-bold text-slate-400">{isArabic ? 'النمط التعليمي' : 'Learning Style'}</p>
                <p className="text-sm font-black text-purple-300 capitalize">{learningProfile.preferredLearningStyle}</p>
              </div>
            </div>
          </div>

          {/* Smart Mistake Review Banner (Spaced Repetition Deck) */}
          {learningProfile.mistakeQueue && learningProfile.mistakeQueue.length > 0 && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-[#121524] border-2 border-amber-500/40 shadow-xl mb-6 flex items-center justify-between gap-4 flex-wrap animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>{isArabic ? 'صندوق مراجعة الأخطاء الذكي' : 'Smart Mistake Review Deck'}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30">
                      {learningProfile.mistakeQueue.length} {isArabic ? 'تحديات جاهزة' : 'to Master'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">
                    {isArabic
                      ? 'تمارين واجهت فيها صعوبة سابقاً. راجعها الآن لترسيخ المفاهيم ونيل شارة الإتقان!'
                      : 'Exercises you previously found challenging. Review them now to solidify mastery!'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  learningAudio.playClick();
                  setIsReviewingMistakes(true);
                  setReviewMistakeIndex(0);
                }}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2"
              >
                <span>{isArabic ? 'ابدأ المراجعة الآن 🎯' : 'Start Review 🎯'}</span>
              </button>
            </div>
          )}

          {/* 7 Subjects Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-8">
            {ALL_SUBJECTS.map((subj) => (
              <SubjectCard
                key={subj}
                subject={subj}
                profile={learningProfile.subjects[subj]}
                onSelect={handleSelectSubject}
                isArabic={isArabic}
              />
            ))}
          </div>
        </div>
      ) : isReviewingMistakes ? (
        /* Mistake Review Arena */
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full py-4 animate-in fade-in">
          {/* Deck Status Bar */}
          <div className="flex items-center justify-between gap-4 mb-6 bg-[#121524] p-4 rounded-2xl border border-amber-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  {isArabic ? 'مراجعة الأخطاء السابقة' : 'Mastery Review Deck'}
                </h3>
                <p className="text-xs text-amber-400 font-bold">
                  {learningProfile.mistakeQueue && learningProfile.mistakeQueue.length > 0
                    ? isArabic
                      ? `التحدي ${reviewMistakeIndex + 1} من ${learningProfile.mistakeQueue.length}`
                      : `Challenge ${reviewMistakeIndex + 1} of ${learningProfile.mistakeQueue.length}`
                    : isArabic
                    ? 'لا توجد أخطاء متبقية!'
                    : 'No mistakes remaining!'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                learningAudio.playClick();
                setIsReviewingMistakes(false);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all"
            >
              {isArabic ? 'إنهاء المراجعة' : 'Exit Review'}
            </button>
          </div>

          {!currentMistake || !learningProfile.mistakeQueue || learningProfile.mistakeQueue.length === 0 ? (
            /* Empty / Victory State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#121524]/60 border border-emerald-500/30 rounded-3xl">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
                <Sparkles className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">
                {isArabic ? 'رائع جداً! لقد أتقنت كل التحديات! 🌟' : 'Outstanding! All Challenges Mastered! 🌟'}
              </h2>
              <p className="text-slate-400 max-w-md text-sm mb-6">
                {isArabic
                  ? 'صندوق مراجعة الأخطاء خالٍ تماماً الآن. واصل رحلتك التعليمية الممتعة!'
                  : 'Your mistake review queue is completely clear. Continue your amazing learning adventure!'}
              </p>
              <button
                onClick={() => setIsReviewingMistakes(false)}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                {isArabic ? 'العودة للمركز الرئيسي' : 'Return to Hub'}
              </button>
            </div>
          ) : (
            /* Active Mistake Challenge Card */
            <div className="flex-1 flex flex-col bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
              {/* Challenge Header Tags */}
              <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-extrabold text-xs uppercase tracking-wider">
                    {currentMistake.subject}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs">
                    {isArabic ? `مستوى الصعوبة ${currentMistake.difficulty}` : `Level ${currentMistake.difficulty}`}
                  </span>
                </div>

                {currentMistake.userAnswer && (
                  <span className="text-xs text-rose-400 font-bold flex items-center gap-1 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{isArabic ? `إجابتك السابقة: ${currentMistake.userAnswer}` : `Previous answer: ${currentMistake.userAnswer}`}</span>
                  </span>
                )}
              </div>

              {/* Question Text */}
              <div className="mb-8">
                <h4 className="text-xl sm:text-2xl font-black text-white leading-relaxed">
                  {currentMistake.question}
                </h4>
              </div>

              {/* Options or Answer Input */}
              {currentMistake.options && currentMistake.options.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {currentMistake.options.map((option, idx) => {
                    const isSelected = reviewSelectedOption === option;
                    const isCorrectAnswer = option.trim().toLowerCase() === currentMistake.correctAnswer.trim().toLowerCase();

                    let optionStyle = 'bg-[#0A0C14] border-slate-800 text-slate-200 hover:border-indigo-500/50 hover:bg-[#15192c]';
                    if (reviewIsSubmitted) {
                      if (isCorrectAnswer) {
                        optionStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/30';
                      } else if (isSelected) {
                        optionStyle = 'bg-rose-500/20 border-rose-500 text-rose-200 ring-2 ring-rose-500/30';
                      } else {
                        optionStyle = 'bg-[#0A0C14]/60 border-slate-800 text-slate-500 opacity-60';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={reviewIsSubmitted}
                        onClick={() => handleReviewAnswer(option)}
                        className={`p-4 rounded-2xl border-2 font-bold text-sm sm:text-base text-left rtl:text-right transition-all flex items-center justify-between gap-3 ${optionStyle}`}
                      >
                        <span>{option}</span>
                        {reviewIsSubmitted && isCorrectAnswer && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        {reviewIsSubmitted && isSelected && !isCorrectAnswer && (
                          <X className="w-5 h-5 text-rose-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800 mb-6">
                  <p className="text-xs text-slate-400 mb-2">{isArabic ? 'الإجابة النموذجية:' : 'Correct Solution:'}</p>
                  <p className="text-lg font-black text-emerald-400">{currentMistake.correctAnswer}</p>
                </div>
              )}

              {/* Feedback and Explanation */}
              {reviewIsSubmitted && (
                <div className={`p-4 rounded-2xl border mb-6 animate-in fade-in ${
                  reviewIsCorrect
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="flex items-center gap-2 font-black text-sm mb-1">
                    {reviewIsCorrect ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>{isArabic ? 'إجابة صحيحة! أحسنت صنعاً 👏' : 'Correct! Great job mastering this! 👏'}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                        <span>{isArabic ? 'ليست الإجابة الصحيحة، لا بأس فالخطأ خطوة للتعلم! ❤️' : 'Not quite, but mistakes help us grow! ❤️'}</span>
                      </>
                    )}
                  </div>
                  {currentMistake.explanation && (
                    <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                      💡 {currentMistake.explanation}
                    </p>
                  )}
                </div>
              )}

              {/* Footer Controls: Previous, Next, Mastery Claim */}
              <div className="mt-auto pt-4 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevMistake}
                    disabled={reviewMistakeIndex === 0}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 font-bold text-xs transition-all"
                  >
                    {isArabic ? 'السابق' : 'Previous'}
                  </button>
                  <button
                    onClick={handleNextMistake}
                    disabled={!learningProfile.mistakeQueue || reviewMistakeIndex >= learningProfile.mistakeQueue.length - 1}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 font-bold text-xs transition-all"
                  >
                    {isArabic ? 'التالي' : 'Next'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {(!currentMistake.options || currentMistake.options.length === 0 || reviewIsCorrect) && (
                    <button
                      onClick={handleClaimMastery}
                      className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isArabic ? 'تم الإتقان! حذف من قائمة الأخطاء ✨' : 'Mastered! Clear from Deck ✨'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Active Subject Module Execution */
        <div className="flex-1 flex flex-col">
          {activeSubject === 'math' && (
            <MathModule
              userId={userId}
              learningProfile={learningProfile}
              onUpdateProfile={handleUpdateProfile}
              onBack={handleBackToHub}
              isArabic={isArabic}
            />
          )}

          {activeSubject === 'reading' && (
            <ReadingModule
              userId={userId}
              learningProfile={learningProfile}
              onUpdateProfile={handleUpdateProfile}
              onBack={handleBackToHub}
              isArabic={isArabic}
            />
          )}

          {activeSubject === 'writing' && (
            <WritingModule
              userId={userId}
              learningProfile={learningProfile}
              onUpdateProfile={handleUpdateProfile}
              onBack={handleBackToHub}
              isArabic={isArabic}
            />
          )}

          {activeSubject === 'memory' && (
            <MemoryModule
              userId={userId}
              learningProfile={learningProfile}
              onUpdateProfile={handleUpdateProfile}
              onBack={handleBackToHub}
              isArabic={isArabic}
            />
          )}

          {activeSubject === 'comprehension' && (
            <ComprehensionModule
              userId={userId}
              learningProfile={learningProfile}
              onUpdateProfile={handleUpdateProfile}
              onBack={handleBackToHub}
              isArabic={isArabic}
            />
          )}

          {activeSubject === 'science' && (
            <ScienceModule
              userId={userId}
              learningProfile={learningProfile}
              onUpdateProfile={handleUpdateProfile}
              onBack={handleBackToHub}
              isArabic={isArabic}
            />
          )}

          {activeSubject === 'english' && (
            <EnglishModule
              userId={userId}
              learningProfile={learningProfile}
              onUpdateProfile={handleUpdateProfile}
              onBack={handleBackToHub}
              isArabic={isArabic}
            />
          )}
        </div>
      )}

      {/* Parent / Teacher Dashboard Modal */}
      {isParentDashboardOpen && (
        <ParentDashboard
          userId={userId}
          learningProfile={learningProfile}
          childName={childName}
          onClose={() => setIsParentDashboardOpen(false)}
          isArabic={isArabic}
        />
      )}
    </div>
  );
};

export default LearningHub;
