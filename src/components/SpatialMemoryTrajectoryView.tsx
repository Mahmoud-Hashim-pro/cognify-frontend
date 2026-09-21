import React, { useState } from 'react';
import {
  Compass,
  MapPin,
  Clock,
  CheckCircle,
  HelpCircle,
  Edit3,
  History,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type {
  SpatialObjectIdentity,
  SpatialLocationObservation,
  SpatialDisambiguationResult,
} from '../types/spatialMemory2';
import { applySpatialCorrection } from '../lib/spatialMemoryEngine';

interface SpatialMemoryTrajectoryViewProps {
  uid: string;
  disambiguation?: SpatialDisambiguationResult;
  selectedObject?: SpatialObjectIdentity;
  onSelectCandidate?: (object: SpatialObjectIdentity) => void;
  onCorrectionApplied?: (updated: SpatialObjectIdentity) => void;
  lang?: 'en' | 'ar' | 'fr';
}

export const SpatialMemoryTrajectoryView: React.FC<SpatialMemoryTrajectoryViewProps> = ({
  uid,
  disambiguation,
  selectedObject,
  onSelectCandidate,
  onCorrectionApplied,
  lang = 'ar',
}) => {
  const isAr = lang === 'ar';
  const [currentObj, setCurrentObj] = useState<SpatialObjectIdentity | undefined>(
    selectedObject || disambiguation?.primaryMatch || disambiguation?.candidateMatches?.[0]
  );
  const [isEditing, setIsEditing] = useState(false);
  const [correctedRoom, setCorrectedRoom] = useState('');
  const [correctedSurface, setCorrectedSurface] = useState('');

  const handleSelect = (cand: SpatialObjectIdentity) => {
    setCurrentObj(cand);
    setIsEditing(false);
    if (onSelectCandidate) onSelectCandidate(cand);
  };

  const handleSaveCorrection = () => {
    if (!currentObj || !correctedRoom.trim() || !correctedSurface.trim()) return;

    const updated = applySpatialCorrection(uid, {
      userId: uid,
      targetObjectId: currentObj.id,
      category: currentObj.category,
      correctedRoomEn: correctedRoom.trim(),
      correctedRoomAr: correctedRoom.trim(),
      correctedSurfaceEn: correctedSurface.trim(),
      correctedSurfaceAr: correctedSurface.trim(),
    });

    setCurrentObj(updated);
    setIsEditing(false);
    setCorrectedRoom('');
    setCorrectedSurface('');
    if (onCorrectionApplied) onCorrectionApplied(updated);
  };

  return (
    <div className="w-full rounded-3xl bg-[#0d101d]/90 border border-slate-800/80 p-6 backdrop-blur-xl shadow-2xl text-slate-100 font-sans space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Compass className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-white">
              {isAr ? 'الذاكرة المكانية الذكية 2.0 (Spatial Memory)' : 'Spatial Memory 2.0 & Object Trajectory'}
            </h3>
            <p className="text-xs text-slate-400">
              {isAr
                ? 'تتبع الكائنات الفيزيائية متعددة الهويات مع مسار الحركة الزمني وحلقة تصحيح المستخدم.'
                : 'Multi-instance physical object tracking with movement timeline and user correction loop.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
          <ShieldCheck className="w-3 h-3" />
          <span>{isAr ? 'عزل تام للمستخدم' : 'Isolated User State'}</span>
        </div>
      </div>

      {/* Disambiguation Section if ambiguous */}
      {disambiguation?.isAmbiguous && disambiguation.candidateMatches.length > 1 && (
        <div className="p-4 rounded-2xl bg-[#14182b] border border-cyan-500/30 space-y-3">
          <div className="flex items-start gap-2 text-cyan-300">
            <HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-400" />
            <p className="text-xs font-semibold leading-relaxed">
              {isAr ? disambiguation.clarificationPromptAr : disambiguation.clarificationPromptEn}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            {disambiguation.candidateMatches.map((cand) => {
              const isChosen = currentObj?.id === cand.id;
              return (
                <button
                  key={cand.id}
                  onClick={() => handleSelect(cand)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                    isChosen
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-950/40'
                      : 'bg-[#181d36] text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  <span>{isAr ? cand.labelAr : cand.labelEn}</span>
                  <span className="text-[10px] opacity-75">
                    ({isAr ? cand.roomAr : cand.roomEn})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Object Details Card */}
      {currentObj ? (
        <div className="p-5 rounded-2xl bg-[#121526]/80 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">
                  {isAr ? currentObj.labelAr : currentObj.labelEn}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {Math.round(currentObj.confidence * 100)}% {isAr ? 'دقة' : 'confidence'}
                </span>
                {currentObj.correctionsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {isAr ? `مصحح ${currentObj.correctionsCount}x` : `Corrected ${currentObj.correctionsCount}x`}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isAr ? 'الموقع الحالي:' : 'Current Location:'}{' '}
                <span className="text-cyan-300 font-semibold">
                  {isAr ? currentObj.surfaceAr : currentObj.surfaceEn}
                </span>{' '}
                {isAr ? 'في' : 'in'}{' '}
                <span className="text-emerald-300 font-semibold">
                  {isAr ? currentObj.roomAr : currentObj.roomEn}
                </span>
              </p>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all border border-slate-700"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isAr ? 'تصحيح يدوي' : 'Correct Location'}</span>
            </button>
          </div>

          {/* Correction Input Form */}
          {isEditing && (
            <div className="p-4 rounded-xl bg-[#161a30] border border-slate-700 space-y-3 animate-in fade-in">
              <div className="text-xs font-bold text-slate-200">
                {isAr ? 'أين يوجد هذا الشيء بالضبط؟' : 'Where is this item actually located?'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder={isAr ? 'الغرفة (مثال: غرفة المعيشة)' : 'Room (e.g. Living Room)'}
                  value={correctedRoom}
                  onChange={(e) => setCorrectedRoom(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#0d101d] border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <input
                  type="text"
                  placeholder={isAr ? 'السطح (مثال: ترابيزة القهوة)' : 'Surface (e.g. Coffee Table)'}
                  value={correctedSurface}
                  onChange={(e) => setCorrectedSurface(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#0d101d] border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={handleSaveCorrection}
                  disabled={!correctedRoom.trim() || !correctedSurface.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-all"
                >
                  {isAr ? 'حفظ التصحيح' : 'Save Correction'}
                </button>
              </div>
            </div>
          )}

          {/* Movement Trajectory Timeline */}
          {currentObj.movementHistory && currentObj.movementHistory.length > 0 && (
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-300">
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isAr ? 'سجل مسار الحركة الزمني (Movement History)' : 'Chronological Movement Timeline'}</span>
              </div>

              <div className="relative pl-5 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {currentObj.movementHistory.map((obs, idx) => {
                  const isLatest = idx === currentObj.movementHistory.length - 1;
                  return (
                    <div key={idx} className="relative text-xs">
                      <span
                        className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 ${
                          isLatest
                            ? 'bg-cyan-400 border-cyan-300 shadow-sm shadow-cyan-400/50'
                            : 'bg-slate-700 border-slate-900'
                        }`}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">
                          {isAr ? obs.surfaceAr : obs.surfaceEn}
                        </span>
                        <span className="text-slate-400">
                          {isAr ? `في ${obs.roomAr}` : `in ${obs.roomEn}`}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(obs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-slate-500">
          {isAr ? 'لا توجد كائنات مكانية مسجلة حالياً.' : 'No spatial objects recorded yet.'}
        </div>
      )}
    </div>
  );
};
