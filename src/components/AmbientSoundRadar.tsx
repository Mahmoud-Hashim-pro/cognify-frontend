import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  Siren,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Activity,
  Radio,
  Flame,
  Car,
  Baby,
  History,
  Trash2,
  Settings,
  ArrowLeft,
  Sparkles,
  Zap
} from 'lucide-react';
import { UserProfile } from '../types';
import { triggerHapticAlert } from '../lib/hapticNavEngine';
import { isArabicLocale } from '../lib/translations';

interface AmbientSoundRadarProps {
  profile: UserProfile;
  onNavigateBack?: () => void;
}

export type SoundHazardType =
  | 'siren'
  | 'smoke_alarm'
  | 'car_horn'
  | 'doorbell'
  | 'baby_crying'
  | 'loud_knock'
  | 'dog_bark'
  | 'speech'
  | 'ambient';

export interface SoundEvent {
  id: string;
  type: SoundHazardType;
  titleAr: string;
  titleEn: string;
  titleFr: string;
  descAr: string;
  descEn: string;
  descFr: string;
  db: number;
  severity: 'danger' | 'warning' | 'info';
  timestamp: string;
  angle: number; // visual radar position (0-360 deg)
  distance: number; // visual radar radius (20-90%)
}

export default function AmbientSoundRadar({ profile, onNavigateBack }: AmbientSoundRadarProps) {
  const lang = profile.language || 'Arabic';
  const isAr = isArabicLocale(lang);
  const isFr = lang === 'French';

  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [decibels, setDecibels] = useState(0);
  const [activeHazard, setActiveHazard] = useState<SoundEvent | null>(null);
  const [soundHistory, setSoundHistory] = useState<SoundEvent[]>([]);
  const [sensitivity, setSensitivity] = useState<'high' | 'normal' | 'low'>('normal');
  const [flashScreen, setFlashScreen] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastEventTimeRef = useRef<number>(0);
  const consecutiveHighPitchFrames = useRef<number>(0);

  const t = (en: string, ar: string, fr?: string) => {
    if (isAr) return ar;
    if (isFr && fr) return fr;
    return en;
  };

  const stopListening = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((tr) => tr.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsListening(false);
    setDecibels(0);
    setActiveHazard(null);
  }, []);

  const handleDetectedSound = useCallback((event: Omit<SoundEvent, 'id' | 'timestamp'>) => {
    const now = Date.now();
    // Debounce detections: at least 2.5s between prominent events
    if (now - lastEventTimeRef.current < 2500) return;
    lastEventTimeRef.current = now;

    const fullEvent: SoundEvent = {
      ...event,
      id: 'snd_' + now,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setActiveHazard(fullEvent);
    setSoundHistory((prev) => [fullEvent, ...prev.slice(0, 30)]);

    // Screen flash & tactile vibration alert
    if (event.severity === 'danger') {
      setFlashScreen(true);
      triggerHapticAlert('danger');
      setTimeout(() => setFlashScreen(false), 900);
    } else if (event.severity === 'warning') {
      setFlashScreen(true);
      triggerHapticAlert('warning');
      setTimeout(() => setFlashScreen(false), 500);
    } else {
      triggerHapticAlert('arrival');
    }

    // Auto dismiss hazard notification after 5s
    setTimeout(() => {
      setActiveHazard((current) => (current?.id === fullEvent.id ? null : current));
    }, 5000);
  }, []);

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDomainArray = new Uint8Array(bufferLength);

    analyserRef.current.getByteFrequencyData(dataArray);
    analyserRef.current.getByteTimeDomainData(timeDomainArray);

    // 1. Calculate RMS / Decibels
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const val = (timeDomainArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / bufferLength);
    const rawDb = rms > 0.0001 ? Math.round(20 * Math.log10(rms) + 95) : 30;
    const clampedDb = Math.max(30, Math.min(125, rawDb));
    setDecibels(clampedDb);

    // 2. Frequency Band Analysis
    const binSize = (audioCtxRef.current?.sampleRate || 44100) / (bufferLength * 2);

    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;

    for (let i = 0; i < bufferLength; i++) {
      const freq = i * binSize;
      const mag = dataArray[i];
      if (freq >= 50 && freq < 400) lowEnergy += mag;
      else if (freq >= 400 && freq < 2000) midEnergy += mag;
      else if (freq >= 2000 && freq < 5000) highEnergy += mag;
    }

    const midAvg = midEnergy / Math.max(1, Math.round(1600 / binSize));
    const highAvg = highEnergy / Math.max(1, Math.round(3000 / binSize));
    const lowAvg = lowEnergy / Math.max(1, Math.round(350 / binSize));

    const threshOffset = sensitivity === 'high' ? -8 : sensitivity === 'low' ? 8 : 0;
    const dangerDbThreshold = 78 + threshOffset;
    const warningDbThreshold = 68 + threshOffset;

    // Siren / Smoke Alarm: Continuous high pitch
    if (highAvg > 85 && clampedDb > dangerDbThreshold) {
      consecutiveHighPitchFrames.current++;
      if (consecutiveHighPitchFrames.current > 12) {
        handleDetectedSound({
          type: 'smoke_alarm',
          titleAr: 'إنذار حريق / صفارة طوارئ!',
          titleEn: 'Fire Alarm / Siren Detected!',
          titleFr: 'Alarme incendie / Sirène détectée !',
          descAr: 'تم رصد صوت حاد ومستمر يشبه إنذار الحريق أو سرينة الطوارئ.',
          descEn: 'Sharp continuous high-pitch alarm detected in immediate area.',
          descFr: 'Alarme sonore aiguë et continue détectée dans votre environnement.',
          db: clampedDb,
          severity: 'danger',
          angle: Math.floor(Math.random() * 360),
          distance: 35,
        });
        consecutiveHighPitchFrames.current = 0;
      }
    } else {
      consecutiveHighPitchFrames.current = Math.max(0, consecutiveHighPitchFrames.current - 1);
    }

    // Car Horn: Loud mid-pitch burst
    if (midAvg > 115 && clampedDb > dangerDbThreshold + 4 && highAvg < 70) {
      handleDetectedSound({
        type: 'car_horn',
        titleAr: 'كلاكس سيارة قريب!',
        titleEn: 'Loud Vehicle Horn!',
        titleFr: 'Klaxon de voiture proche !',
        descAr: 'تنبيه قوي من سيارة أو كلاكس في محيطك، توخّ الحذر.',
        descEn: 'Loud car horn sound blast detected nearby.',
        descFr: 'Coup de klaxon puissant détecté à proximité.',
        db: clampedDb,
        severity: 'danger',
        angle: Math.floor(Math.random() * 360),
        distance: 45,
      });
    }

    // Doorbell / Knock: Sudden transient spike
    if (midAvg > 90 && clampedDb > warningDbThreshold && lowAvg > 75) {
      handleDetectedSound({
        type: 'doorbell',
        titleAr: 'جرس الباب أو طرق قوي',
        titleEn: 'Doorbell or Loud Knock',
        titleFr: 'Sonnette ou frappe à la porte',
        descAr: 'تم رصد نقر أو رنين يشبه جرس الباب أو طارقاً بالخارج.',
        descEn: 'A chime or knock pattern was detected.',
        descFr: 'Sonnette ou bruit de porte détecté.',
        db: clampedDb,
        severity: 'warning',
        angle: Math.floor(Math.random() * 360),
        distance: 60,
      });
    }

    // Baby Crying: Oscillating vocal frequencies
    if (midAvg > 75 && highAvg > 65 && clampedDb > warningDbThreshold - 3) {
      handleDetectedSound({
        type: 'baby_crying',
        titleAr: 'بكاء طفل أو نداء استغاثة',
        titleEn: 'Baby Crying / Distress Call',
        titleFr: 'Pleurs de bébé ou appel',
        descAr: 'تم رصد ترددات صوتية تشبه بكاء طفل رضيع أو صراخاً.',
        descEn: 'Acoustic pattern matching crying or vocal distress.',
        descFr: 'Pleurs de bébé ou cri détecté dans la pièce.',
        db: clampedDb,
        severity: 'warning',
        angle: Math.floor(Math.random() * 360),
        distance: 50,
      });
    }

    animFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [handleDetectedSound, sensitivity]);

  const startListening = async () => {
    setMicError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      animFrameRef.current = requestAnimationFrame(analyzeAudio);
    } catch (err: any) {
      console.error('Audio radar mic error:', err);
      setMicError(
        t(
          'Microphone permission is required to detect ambient sounds.',
          'يلزم السماح باستخدام الميكروفون لرصد الأصوات المحيطة.',
          'Autorisation du micro requise pour écouter l\'environnement.'
        )
      );
      setIsListening(false);
    }
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const getHazardIcon = (type: SoundHazardType) => {
    switch (type) {
      case 'smoke_alarm':
      case 'siren':
        return <Siren className="w-7 h-7 text-red-400 animate-bounce" />;
      case 'car_horn':
        return <Car className="w-7 h-7 text-amber-400 animate-pulse" />;
      case 'doorbell':
      case 'loud_knock':
        return <Bell className="w-7 h-7 text-blue-400 animate-pulse" />;
      case 'baby_crying':
        return <Baby className="w-7 h-7 text-pink-400 animate-pulse" />;
      default:
        return <AlertTriangle className="w-7 h-7 text-emerald-400" />;
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full bg-slate-950 text-white overflow-hidden select-none relative ${
        flashScreen ? 'ring-8 ring-inset ring-red-600 animate-pulse' : ''
      }`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Visual Strobe Overlay for Deaf Hazard Alert */}
      <AnimatePresence>
        {flashScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-600 z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <header className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-2.5">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              aria-label={t('Back', 'رجوع', 'Retour')}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
            >
              <ArrowLeft className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base leading-tight flex items-center gap-2">
                <span>{t('Ambient Sound Radar', 'رادار الأصوات والمخاطر', 'Radar Sonore Intelligent')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-normal">
                  {t('For the Deaf', 'للصم وضعاف السمع', 'Pour les sourds')}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                {t('Real-time acoustic AI hazard detection & visual haptic alerts', 'كشف صوتي فوري لأجراس الأبواب، إنذارات الحريق والسيارات مع اهتزاز لمسي', 'Détection visuelle et haptique des alarmes')}
              </p>
            </div>
          </div>
        </div>

        {/* Sensitivity & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <select
            value={sensitivity}
            onChange={(e) => setSensitivity(e.target.value as any)}
            aria-label={t('Sensitivity', 'الحساسية', 'Sensibilité')}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2 py-1.5 outline-none font-semibold"
          >
            <option value="high">{t('High Sensitivity', 'حساسية عالية', 'Haute')}</option>
            <option value="normal">{t('Normal Sensitivity', 'حساسية معتدلة', 'Normale')}</option>
            <option value="low">{t('Low Sensitivity', 'حساسية منخفضة', 'Basse')}</option>
          </select>

          <button
            onClick={isListening ? stopListening : startListening}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all ${
              isListening
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/60'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/60'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isListening ? t('Stop Radar', 'إيقاف الرادار', 'Arrêter') : t('Start Radar', 'تشغيل الرادار', 'Activer')}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Radar & Decibel Gauge (Left 7 cols) */}
        <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col items-center justify-center relative border-b lg:border-b-0 lg:border-e border-slate-800">
          {micError && (
            <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs sm:text-sm text-center mb-4 max-w-md">
              <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-400" />
              {micError}
            </div>
          )}

          {/* Active Hazard Card Banner */}
          <AnimatePresence>
            {activeHazard && (
              <motion.div
                initial={{ y: -20, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -20, opacity: 0, scale: 0.95 }}
                className={`w-full max-w-md p-4 rounded-3xl mb-4 border shadow-2xl flex items-center gap-3.5 backdrop-blur-xl ${
                  activeHazard.severity === 'danger'
                    ? 'bg-red-950/90 border-red-500 text-red-100 shadow-red-950/70'
                    : 'bg-amber-950/90 border-amber-500 text-amber-100 shadow-amber-950/70'
                }`}
              >
                <div className="p-3 rounded-2xl bg-black/40 shrink-0">
                  {getHazardIcon(activeHazard.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black text-sm sm:text-base leading-tight truncate">
                      {isAr ? activeHazard.titleAr : isFr ? activeHazard.titleFr : activeHazard.titleEn}
                    </h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/50 font-bold shrink-0">
                      {activeHazard.db} dB
                    </span>
                  </div>
                  <p className="text-xs opacity-90 mt-0.5 line-clamp-2">
                    {isAr ? activeHazard.descAr : isFr ? activeHazard.descFr : activeHazard.descEn}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Circular Radar Display */}
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full border-2 border-cyan-500/30 bg-slate-900/90 flex items-center justify-center shadow-2xl shadow-cyan-950/50 overflow-hidden">
            {/* Concentric Range Rings */}
            <div className="absolute w-3/4 h-3/4 rounded-full border border-cyan-500/20" />
            <div className="absolute w-1/2 h-1/2 rounded-full border border-cyan-500/20" />
            <div className="absolute w-1/4 h-1/4 rounded-full border border-cyan-500/20" />

            {/* Radar Crosshairs */}
            <div className="absolute w-full h-[1px] bg-cyan-500/20" />
            <div className="absolute h-full w-[1px] bg-cyan-500/20" />

            {/* Rotating Radar Sweep Line */}
            {isListening && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 origin-center pointer-events-none"
              >
                <div className="w-1/2 h-1/2 bg-gradient-to-tr from-cyan-500/40 via-cyan-500/10 to-transparent rounded-tl-full origin-bottom-right" />
              </motion.div>
            )}

            {/* Center Decibel Hub */}
            <div className="relative z-10 text-center p-3 rounded-2xl bg-slate-950/90 border border-cyan-500/40 shadow-xl backdrop-blur-md">
              <div className="font-mono font-black text-2xl sm:text-3xl text-cyan-300">
                {decibels}
                <span className="text-xs text-slate-400 ms-1">dB</span>
              </div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">
                {decibels < 50
                  ? t('Quiet', 'هادئ', 'Calme')
                  : decibels < 70
                  ? t('Normal', 'معتدل', 'Normal')
                  : decibels < 85
                  ? t('Loud', 'مرتفع', 'Bruyant')
                  : t('Hazardous', 'خطر شديد', 'Dangereux')}
              </div>
            </div>

            {/* Sound Blips on Radar */}
            {soundHistory.slice(0, 5).map((evt, idx) => {
              const rad = (evt.angle * Math.PI) / 180;
              const radiusPercent = evt.distance;
              const x = Math.cos(rad) * radiusPercent;
              const y = Math.sin(rad) * radiusPercent;

              return (
                <motion.div
                  key={evt.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 - idx * 0.18 }}
                  exit={{ scale: 0, opacity: 0 }}
                  style={{
                    position: 'absolute',
                    left: `${50 + x * 0.45}%`,
                    top: `${50 + y * 0.45}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={`w-5 h-5 rounded-full flex items-center justify-center shadow-lg pointer-events-none ${
                    evt.severity === 'danger'
                      ? 'bg-red-500 text-white animate-ping'
                      : 'bg-amber-500 text-black'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                </motion.div>
              );
            })}
          </div>

          {/* Decibel Level Bar */}
          <div className="w-full max-w-md mt-6 space-y-2">
            <div className="flex justify-between text-xs text-slate-400 font-semibold">
              <span>{t('Sound Level Gauge', 'مؤشر شدة الصوت', 'Niveau Sonore')}</span>
              <span className="font-mono text-cyan-300 font-bold">{decibels} / 120 dB</span>
            </div>
            <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                style={{ width: `${Math.min(100, Math.max(0, ((decibels - 30) / 90) * 100))}%` }}
                className={`h-full rounded-full transition-all duration-150 ${
                  decibels > 85
                    ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-lg shadow-red-500/50'
                    : decibels > 70
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                    : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Detected Sound History Log (Right 5 cols) */}
        <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col h-full bg-slate-900/40 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <h2 className="font-bold text-sm text-slate-200">
                {t('Detected Sounds Log', 'سجل الأصوات المرصودة', 'Historique des Sons')}
              </h2>
            </div>
            {soundHistory.length > 0 && (
              <button
                onClick={() => setSoundHistory([])}
                aria-label={t('Clear log', 'مسح السجل', 'Effacer')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-all"
                title={t('Clear history', 'مسح السجل', 'Effacer historique')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {soundHistory.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs sm:text-sm">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
                <p>
                  {isListening
                    ? t('Listening for alarms, horns, and knocks...', 'الرادار شغال ويستمع لأي إنذارات أو أصوات غير معتادة...', "En attente d'alarmes ou bruits...")
                    : t('Press "Start Radar" to begin monitoring.', 'اضغط على "تشغيل الرادار" لبدء الرصد الصوتي.', 'Cliquez sur Activer pour démarrer.')}
                </p>
              </div>
            ) : (
              soundHistory.map((evt) => (
                <div
                  key={evt.id}
                  className={`p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                    evt.severity === 'danger'
                      ? 'bg-red-950/40 border-red-500/40 hover:bg-red-950/60'
                      : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-black/40 shrink-0 mt-0.5">
                    {getHazardIcon(evt.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                        {isAr ? evt.titleAr : isFr ? evt.titleFr : evt.titleEn}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{evt.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                      {isAr ? evt.descAr : isFr ? evt.descFr : evt.descEn}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-cyan-300">
                        {evt.db} dB
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          evt.severity === 'danger'
                            ? 'bg-red-900/60 text-red-300'
                            : 'bg-amber-900/60 text-amber-300'
                        }`}
                      >
                        {evt.severity === 'danger'
                          ? t('Critical Danger', 'خطر فوري', 'Danger')
                          : t('Warning', 'تنبيه', 'Avertissement')}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
