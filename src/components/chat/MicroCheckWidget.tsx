/**
 * Interactive Formative Micro-Check Widget (Cognify 2.0 - Pillar 2)
 * 
 * Embedded directly in chat when the AI explains a substantive concept.
 * Allows 1-click comprehension verification, calculates latency, updates
 * student state, and triggers prerequisite diagnosis upon incorrect answers.
 */

import React, { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, ArrowLeft, Sparkles, Brain } from 'lucide-react';
import { localize, isArabicLocale } from '../../lib/translations';
import { diagnosePrerequisiteGap, getConcept } from '../../lib/conceptGraph';
import { useStudentState } from '../../lib/useStudentState';
import { eventBus } from '../../lib/learningEvents';

export interface MicroCheckData {
  question: string;
  conceptId: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface MicroCheckWidgetProps {
  data: MicroCheckData;
  language?: string;
  uid?: string;
  onPrerequisiteClick?: (conceptId: string, conceptName: string) => void;
}

export default function MicroCheckWidget({
  data,
  language = 'English',
  uid,
  onPrerequisiteClick,
}: MicroCheckWidgetProps) {
  const isAr = isArabicLocale(language);
  const isFr = language === 'French' || (language as any) === 'fr';

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [startTime] = useState<number>(() => Date.now());

  const { studentState, recordAnswer } = useStudentState(uid);

  const isCorrect = selectedIndex === data.correctIndex;

  // If student misses, check concept graph for missing prerequisite
  const prerequisiteGap = useMemo(() => {
    if (!submitted || isCorrect || !data.conceptId) return null;
    const diagnosis = diagnosePrerequisiteGap(data.conceptId, studentState?.conceptMastery || {});
    if (diagnosis.hasPrerequisiteGap && diagnosis.rootGapConcept) {
      return diagnosis.rootGapConcept;
    }
    // Fall back to first declared prerequisite if known
    const node = getConcept(data.conceptId);
    if (node && node.prerequisites.length > 0) {
      return getConcept(node.prerequisites[0]);
    }
    return null;
  }, [submitted, isCorrect, data.conceptId, studentState]);

  const handleSelect = (idx: number) => {
    if (submitted) return;
    const latency = Math.max(500, Date.now() - startTime);
    setSelectedIndex(idx);
    setSubmitted(true);

    const correct = idx === data.correctIndex;

    // Record answer in Student State Engine
    if (data.conceptId) {
      recordAnswer(data.conceptId, correct, latency, correct ? undefined : 'concept_misunderstanding');
      
      // Dispatch learning event
      eventBus.emit('EXERCISE_ANSWERED', uid || 'guest', {
        subject: 'General',
        topic: data.conceptId,
        conceptId: data.conceptId,
        isCorrect: correct,
        responseTimeMs: latency,
        difficulty: 'medium',
      });
    }
  };

  const currentConcept = data.conceptId ? getConcept(data.conceptId) : null;
  const conceptDisplayName = currentConcept
    ? (isAr ? currentConcept.nameAr : isFr ? currentConcept.nameEn : currentConcept.nameEn)
    : data.conceptId.replace(/_/g, ' ');

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="my-5 p-5 rounded-3xl bg-[#0e1222]/95 border border-cyan-500/30 shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all text-slate-100"
    >
      {/* Decorative ambient gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none -z-0" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3 border-b border-slate-800/80 pb-3 relative z-10">
        <div className="flex items-center gap-2 text-cyan-400">
          <Brain className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-wider">
            {isAr ? 'فحص سريع للفهم (1-Click Check)' : isFr ? 'Vérification Rapide (1-Clic)' : 'Quick Comprehension Check (1-Click)'}
          </span>
        </div>
        {conceptDisplayName && (
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
            {conceptDisplayName}
          </span>
        )}
      </div>

      {/* Question */}
      <p className="text-sm font-bold text-white mb-4 leading-relaxed relative z-10">
        {data.question}
      </p>

      {/* Interactive Options */}
      <div className="space-y-2 relative z-10">
        {data.options.map((opt, idx) => {
          const isThisSelected = selectedIndex === idx;
          const isThisCorrect = idx === data.correctIndex;

          let btnStyles = 'bg-[#15192e] border-slate-800 text-slate-200 hover:border-cyan-500/50 hover:bg-[#1a203a]';
          if (submitted) {
            if (isThisCorrect) {
              btnStyles = 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold shadow-lg shadow-emerald-500/10';
            } else if (isThisSelected) {
              btnStyles = 'bg-rose-500/20 border-rose-500/60 text-rose-300 font-bold';
            } else {
              btnStyles = 'bg-[#15192e]/40 border-slate-800/50 text-slate-500 opacity-60';
            }
          }

          return (
            <button
              key={idx}
              disabled={submitted}
              onClick={() => handleSelect(idx)}
              className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm font-medium transition-all text-start flex items-center justify-between gap-3 ${btnStyles}`}
            >
              <span>{opt}</span>
              {submitted && isThisCorrect && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              {submitted && isThisSelected && !isThisCorrect && (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Post-submission Feedback & Prerequisite Gap */}
      {submitted && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3 text-xs leading-relaxed relative z-10 animate-fade-in">
          <div className="flex items-start gap-2">
            {isCorrect ? (
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <p className={isCorrect ? 'text-emerald-300' : 'text-slate-300'}>
              {data.explanation}
            </p>
          </div>

          {/* Prerequisite Interleaving Button if missed */}
          {!isCorrect && prerequisiteGap && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="text-[11px] leading-snug">
                <strong className="block text-amber-300 font-bold mb-0.5">
                  {isAr ? 'فجوة في المتطلب السابق الموصى به:' : isFr ? 'Prérequis Recommandé Manquant :' : 'Prerequisite Gap Detected:'}
                </strong>
                <span>
                  {isAr
                    ? `صعوبتك هنا قد ترجع لعدم تثبيت متطلب "${prerequisiteGap.nameAr}".`
                    : isFr
                    ? `Votre difficulté peut provenir du prérequis "${prerequisiteGap.nameEn}".`
                    : `Your difficulty here may stem from the prerequisite "${prerequisiteGap.nameEn}".`}
                </span>
              </div>
              {onPrerequisiteClick && (
                <button
                  onClick={() =>
                    onPrerequisiteClick(
                      prerequisiteGap.id,
                      isAr ? prerequisiteGap.nameAr : prerequisiteGap.nameEn
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold shrink-0 flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <span>{isAr ? 'مراجعة المتطلب أولاً' : isFr ? 'Réviser d’abord' : 'Review Prerequisite First'}</span>
                  {isAr ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
