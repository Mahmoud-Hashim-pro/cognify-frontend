/**
 * Active Spaced Micro-Retrieval Warm-Up Banner (Cognify 2.0 - Pillar 3)
 * 
 * Inspects the student's SuperMemo SM-2 retention schedules and detects
 * concepts at risk of memory decay (due for review). Surfaces a 30-second
 * contextual warm-up before new topics.
 */

import React, { useState, useMemo } from 'react';
import { Clock, RotateCcw, X, Brain, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { localize, isArabicLocale } from '../../lib/translations';
import { useStudentState } from '../../lib/useStudentState';
import { getConcept } from '../../lib/conceptGraph';
import { RetentionSchedule } from '../../lib/spacedRetention';
import type { PersonalLearningModel } from '../../types/studentState';

interface RetentionWarmupBannerProps {
  uid?: string;
  retentionSchedules?: Record<string, RetentionSchedule>;
  personalLearningModel?: PersonalLearningModel;
  language?: string;
  onStartRefresher: (conceptId: string, conceptName?: string) => void;
}

export default function RetentionWarmupBanner({
  uid,
  retentionSchedules,
  personalLearningModel,
  language = 'English',
  onStartRefresher,
}: RetentionWarmupBannerProps) {
  const isAr = isArabicLocale(language);
  const isFr = language === 'French' || (language as any) === 'fr';

  const [isDismissed, setIsDismissed] = useState(false);
  const { studentState } = useStudentState(uid);

  const dueConcepts = useMemo(() => {
    const schedules = retentionSchedules || studentState?.retentionSchedules || {};
    const plm = personalLearningModel || studentState?.personalLearningModel;
    const now = Date.now();
    const list: {
      conceptId: string;
      conceptName: string;
      intervalDays: number;
      dueDaysAgo: number;
      riskLevel: 'high' | 'medium';
    }[] = [];
    const seen = new Set<string>();

    // 1. Process SM-2 schedules
    for (const [cid, sched] of Object.entries(schedules)) {
      if (sched.nextReviewDate <= now) {
        seen.add(cid);
        const node = getConcept(cid);
        const name = node
          ? (isAr ? node.nameAr : isFr ? node.nameEn : node.nameEn)
          : cid.replace(/_/g, ' ');
        const dueDaysAgo = Math.max(0, Math.floor((now - sched.nextReviewDate) / 86400000));
        const prof = plm?.conceptProfiles?.[cid];
        list.push({
          conceptId: cid,
          conceptName: name,
          intervalDays: sched.intervalDays,
          dueDaysAgo,
          riskLevel: prof?.retentionRisk === 'medium' ? 'medium' : 'high',
        });
      }
    }

    // 2. Incorporate PLM high/medium retention risk concepts
    if (plm?.conceptProfiles) {
      for (const [cid, prof] of Object.entries(plm.conceptProfiles)) {
        if (!seen.has(cid) && (prof.retentionRisk === 'high' || prof.retentionRisk === 'medium')) {
          seen.add(cid);
          const node = getConcept(cid);
          const name = node
            ? (isAr ? node.nameAr : isFr ? node.nameEn : node.nameEn)
            : cid.replace(/_/g, ' ');
          list.push({
            conceptId: cid,
            conceptName: name,
            intervalDays: schedules[cid]?.intervalDays || 1,
            dueDaysAgo: 0,
            riskLevel: prof.retentionRisk,
          });
        }
      }
    }

    // Sort high risk first, then by days due
    return list.sort((a, b) => {
      if (a.riskLevel !== b.riskLevel) {
        return a.riskLevel === 'high' ? -1 : 1;
      }
      return b.dueDaysAgo - a.dueDaysAgo;
    });
  }, [retentionSchedules, personalLearningModel, studentState?.retentionSchedules, studentState?.personalLearningModel, isAr, isFr]);

  if (isDismissed || dueConcepts.length === 0) {
    return null;
  }

  const primeConcept = dueConcepts[0];

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="mx-4 my-2 p-3.5 rounded-2xl bg-gradient-to-r from-[#121528] via-[#161a35] to-[#121528] border border-cyan-500/40 shadow-xl flex items-center justify-between gap-3 text-slate-100 backdrop-blur-xl animate-fade-in relative z-20"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 text-cyan-300">
          <Clock className="w-4 h-4 animate-spin-slow" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
              {isAr ? 'إنعاش الذاكرة التباعدية (SM-2)' : isFr ? 'Rappel Espacé Actif (SM-2)' : 'Spaced Retention Due (SM-2)'}
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
              primeConcept.riskLevel === 'high'
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
            }`}>
              {primeConcept.riskLevel === 'high'
                ? (isAr ? 'خطر نسيان مرتفع' : isFr ? 'Risque élevé' : 'High decay risk')
                : (isAr ? 'مراجعة قريبة (٤٨ س)' : isFr ? 'À réviser sous 48h' : 'Due in 48h')}
            </span>
          </div>
          <p className="text-xs font-semibold text-white truncate mt-0.5">
            {isAr
              ? `حان وقت تثبيت مفهوم "${primeConcept.conceptName}" قبل تلاشيه من الذاكرة.`
              : isFr
              ? `Il est temps de consolider "${primeConcept.conceptName}" pour éviter l'oubli.`
              : `Time to reinforce "${primeConcept.conceptName}" before memory decay.`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onStartRefresher(primeConcept.conceptId, primeConcept.conceptName)}
          className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#0a0c14] font-black text-xs transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1 active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isAr ? 'تحدي الـ 30 ثانية' : isFr ? 'Défi 30s' : '30s Refresher'}</span>
          {isAr ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          title={isAr ? 'إغلاق' : isFr ? 'Fermer' : 'Dismiss'}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
