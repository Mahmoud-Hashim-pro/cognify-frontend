import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Heart,
  Users,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageCircle,
  ArrowLeft,
  Settings,
  Activity,
  Eye,
  Mic,
  Brain,
  FileJson,
  Check,
  Flame,
  Smile,
  Frown,
  Meh,
  Clock,
  Sparkles,
  Lightbulb,
  TrendingUp,
  BarChart2,
  Printer
} from 'lucide-react';
import { UserProfile, SensoryEmotionLog } from '../types';
import { EmergencyContact } from '../lib/contacts';
import { loadContacts, restoreContactsFromCloud, sendWhatsAppMessage, isValidContactPhone } from '../lib/contacts';
import { triggerHapticAlert } from '../lib/hapticNavEngine';
import {
  listenPendingCaregiverRequests,
  approveCaregiverLinkRequest,
  rejectCaregiverLinkRequest,
  revokeSpecificCaregiverAccess,
  CaregiverLinkRequest,
} from '../lib/caregiverLinking';
import {
  getRecentSensoryLogs,
  loadVisualSchedule,
  analyzeSensoryPatterns,
  VisualScheduleItem,
  SensoryPatternAnalysis,
} from '../lib/neurodiversityEngine';
import { isArabicLocale } from '../lib/translations';
import { toast } from './Toast';

interface CaregiverHubProps {
  profile: UserProfile;
  onNavigateBack?: () => void;
  setProfile?: (profile: UserProfile) => void;
  onOpenPassport?: () => void;
}

export default function CaregiverHub({ profile, onNavigateBack, setProfile, onOpenPassport }: CaregiverHubProps) {
  const lang = profile.language || 'Arabic';
  const isAr = isArabicLocale(lang);
  const isFr = lang === 'French';

  const [contacts, setContacts] = useState<EmergencyContact[]>(loadContacts);
  const [sensoryLogs, setSensoryLogs] = useState<SensoryEmotionLog[]>([]);
  const [schedule, setSchedule] = useState<VisualScheduleItem[]>([]);

  useEffect(() => {
    if (!profile.uid) return;
    restoreContactsFromCloud(profile.uid).then(setContacts);
    getRecentSensoryLogs(profile.uid, 50).then(setSensoryLogs);
    loadVisualSchedule(profile.uid).then(setSchedule);
  }, [profile.uid]);

  // Compute Clinical ABA & OT Sensory Pattern Analytics
  const patternAnalysis: SensoryPatternAnalysis = useMemo(
    () => analyzeSensoryPatterns(sensoryLogs, schedule),
    [sensoryLogs, schedule]
  );

  // Pending "someone wants to link as your parent/caregiver" requests
  const [pendingLinkRequests, setPendingLinkRequests] = useState<CaregiverLinkRequest[]>([]);
  useEffect(() => {
    if (!profile.uid) return;
    const unsubscribe = listenPendingCaregiverRequests(profile.uid, setPendingLinkRequests);
    return unsubscribe;
  }, [profile.uid]);

  const linkedCaregivers = profile.linkedCaregivers || [];

  const handleApproveLink = async (req: CaregiverLinkRequest) => {
    if (!profile.uid) return;
    try {
      await approveCaregiverLinkRequest(profile.uid, req.parentUid, req.parentName, req.parentEmail);
      if (setProfile) {
        const already = linkedCaregivers.some((c) => c.uid === req.parentUid);
        setProfile({
          ...profile,
          linkedParentUid: profile.linkedParentUid || req.parentUid,
          authorizedParentUids: [...(profile.authorizedParentUids || []), req.parentUid],
          linkedCaregivers: already
            ? linkedCaregivers
            : [...linkedCaregivers, { uid: req.parentUid, name: req.parentName, email: req.parentEmail, linkedAt: Date.now() }],
        });
      }
      toast.success(isAr ? 'تم قبول الطلب' : isFr ? 'Demande approuvée' : 'Request approved');
    } catch {
      toast.error(isAr ? 'حصل خطأ، حاول تاني' : isFr ? 'Une erreur est survenue' : 'Something went wrong');
    }
  };

  const handleRejectLink = async (parentUid: string) => {
    if (!profile.uid) return;
    try {
      await rejectCaregiverLinkRequest(profile.uid, parentUid);
    } catch {
      toast.error(isAr ? 'حصل خطأ، حاول تاني' : isFr ? 'Une erreur est survenue' : 'Something went wrong');
    }
  };

  const handleRevokeCaregiver = async (caregiverUid: string) => {
    if (!profile.uid) return;
    try {
      await revokeSpecificCaregiverAccess(profile.uid, caregiverUid, linkedCaregivers);
      if (setProfile) {
        const remaining = linkedCaregivers.filter((c) => c.uid !== caregiverUid);
        setProfile({
          ...profile,
          linkedParentUid: profile.linkedParentUid === caregiverUid ? (remaining[0]?.uid || '') : profile.linkedParentUid,
          authorizedParentUids: (profile.authorizedParentUids || []).filter((u) => u !== caregiverUid),
          linkedCaregivers: remaining,
        });
      }
      toast.success(isAr ? 'تم إلغاء الربط' : isFr ? 'Accès révoqué' : 'Access revoked');
    } catch {
      toast.error(isAr ? 'حصل خطأ، حاول تاني' : isFr ? 'Une erreur est survenue' : 'Something went wrong');
    }
  };
  const [testSent, setTestSent] = useState(false);

  const t = (en: string, ar: string, fr?: string) => {
    if (isAr) return ar;
    if (isFr && fr) return fr;
    return en;
  };

  // Export Accessibility Profile JSON
  const handleExportConfig = () => {
    const backup = {
      uid: profile.uid,
      name: profile.name,
      language: profile.language,
      accessibilityMode: profile.accessibilityMode,
      accessibilityPassport: profile.accessibilityPassport,
      visionMemories: profile.visionMemories,
      headTrackingConfig: profile.headTrackingConfig,
      vocalTriggers: profile.vocalTriggers,
      contacts: loadContacts(),
      sensoryLogs: sensoryLogs,
      exportedAt: new Date().toISOString(),
      version: 'Cognify-Access-2.0',
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognify-access-profile-${profile.name || 'user'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('Profile exported successfully', 'تم تصدير ملف الإعدادات بنجاح'));
  };

  // Test Emergency SOS Dispatch
  const handleTestSOS = () => {
    triggerHapticAlert('warning');
    const primary = contacts.find((c) => c.isPrimaryEmergency) || contacts[0];
    if (primary && isValidContactPhone(primary.phone)) {
      const testMsg = isAr
        ? '🔔 تجربة نظام الطوارئ من Cognify: نداء الاستغاثة يعمل بنجاح!'
        : '🔔 Cognify Emergency SOS Test: Alert system is functioning correctly!';
      sendWhatsAppMessage(primary.phone, testMsg);
      setTestSent(true);
      toast.success(t('Test message opened for primary contact', 'تم تجهيز رسالة التجربة للمرافق'));
      setTimeout(() => setTestSent(false), 3000);
    } else {
      toast.info(t('Please add an emergency contact first', 'سجل رقم المرافق أولاً لإجراء التجربة'));
    }
  };

  // Print / Export Weekly Clinical Summary for ABA & Speech Therapists
  const handlePrintWeeklyClinicalReport = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      toast.error(t('Please allow popups to open the clinical report', 'يرجى السماح بالنوافذ المنبثقة لفتح التقرير السريري'));
      return;
    }

    const reportDate = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const studentName = profile.name || (isAr ? 'الطالب' : 'Student');
    const totalEpisodes = patternAnalysis.totalMeltdowns;
    const topTriggerText = patternAnalysis.topTriggers.length > 0
      ? patternAnalysis.topTriggers.map((tr) => `${tr.trigger} (${tr.count}x - ${tr.percentage}%)`).join(', ')
      : (isAr ? 'لا توجد مثيرات متكررة مسجلة' : 'No recurring triggers logged');

    const recommendation = isAr
      ? patternAnalysis.scheduleCorrelation?.clinicalRecommendation || 'الاستمرار في مراقبة الروتين اليومي وتقديم فترات استراحة منتظمة.'
      : patternAnalysis.scheduleCorrelation?.clinicalRecommendationEn || 'Maintain daily predictability routine and proactive sensory breaks.';

    const tableRows = sensoryLogs.slice(0, 20).map((l) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 12px; font-family: monospace;">${new Date(l.timestamp).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</td>
        <td style="padding: 8px 12px; font-weight: bold; color: ${l.intensity >= 4 ? '#e11d48' : '#0284c7'};">${l.intensity}/5 (${l.level})</td>
        <td style="padding: 8px 12px;">${l.sensoryTrigger || (isAr ? 'غير محدد' : 'Not specified')}</td>
        <td style="padding: 8px 12px;">${l.comfortActivityUsed || (isAr ? 'لم يُطلب' : 'None')}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
      <head>
        <meta charset="utf-8" />
        <title>Cognify Clinical ABA & Sensory Report - ${studentName}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 24px;
            font-size: 13px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #6366f1;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .badge {
            background: #eef2ff;
            color: #4338ca;
            border: 1px solid #c7d2fe;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: bold;
          }
          .metric-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 16px;
          }
          .stat-box {
            background: #f1f5f9;
            border-radius: 8px;
            padding: 10px;
            text-align: center;
          }
          .stat-box .num {
            font-size: 20px;
            font-weight: 800;
            color: #312e81;
          }
          .stat-box .lbl {
            font-size: 11px;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 12px;
          }
          th {
            background: #f1f5f9;
            padding: 8px 12px;
            text-align: ${isAr ? 'right' : 'left'};
            border-bottom: 2px solid #cbd5e1;
            font-weight: bold;
          }
          .recommendation-box {
            background: #fffbeb;
            border-${isAr ? 'right' : 'left'}: 4px solid #f59e0b;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
          }
          .footer-sign {
            margin-top: 36px;
            padding-top: 16px;
            border-top: 1px dashed #cbd5e1;
            display: flex;
            justify-content: space-between;
          }
          .sign-field {
            border-bottom: 1px solid #64748b;
            height: 40px;
            margin-top: 8px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 style="margin: 0; font-size: 20px; color: #1e1b4b;">Cognify Assistive Platform • Clinical ABA & Sensory Progress Report</h1>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">
              ${isAr ? 'تقرير تحليلي سريري لجلسات التكامل الحسي والتواصل البديل والمعزز (AAC)' : 'Clinical ABA, SLP & Occupational Therapy Progress Summary'}
            </p>
          </div>
          <div style="text-align: ${isAr ? 'left' : 'right'};">
            <span class="badge">Cognify Protocol v2.4</span>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${reportDate}</div>
          </div>
        </div>

        <div class="metric-card">
          <table style="margin: 0;">
            <tr>
              <td><strong>${isAr ? 'اسم الطالب:' : 'Student Name:'}</strong> ${studentName}</td>
              <td><strong>${isAr ? 'معرف الملف:' : 'Profile UID:'}</strong> ${profile.uid ? profile.uid.substring(0, 12) + '...' : 'Local'}</td>
              <td><strong>${isAr ? 'إجمالي السجلات:' : 'Total Logs:'}</strong> ${sensoryLogs.length}</td>
            </tr>
          </table>
        </div>

        <div class="grid">
          <div class="stat-box">
            <div class="num">${totalEpisodes}</div>
            <div class="lbl">${isAr ? 'نوبات الضغط الشديد / Meltdowns' : 'High Overload / Meltdowns'}</div>
          </div>
          <div class="stat-box">
            <div class="num">${patternAnalysis.timeOfDayDistribution.morning}</div>
            <div class="lbl">${isAr ? 'فترة الصباح (06:00 - 12:00)' : 'Morning Window'}</div>
          </div>
          <div class="stat-box">
            <div class="num">${patternAnalysis.timeOfDayDistribution.afternoon}</div>
            <div class="lbl">${isAr ? 'بعد الظهر (12:00 - 17:00)' : 'Afternoon Window'}</div>
          </div>
          <div class="stat-box">
            <div class="num">${patternAnalysis.timeOfDayDistribution.evening + patternAnalysis.timeOfDayDistribution.night}</div>
            <div class="lbl">${isAr ? 'المساء والليل' : 'Evening & Night'}</div>
          </div>
        </div>

        <div class="recommendation-box">
          <h4 style="margin: 0 0 6px 0; color: #92400e; font-size: 13px;">
            ${isAr ? 'توصيات التحليل السلوكي التطبيقي (ABA) والتكامل الحسي (OT):' : 'ABA & Sensory Diet Clinical Recommendations:'}
          </h4>
          <p style="margin: 0; color: #78350f; font-size: 12px; line-height: 1.6;">
            ${recommendation}
          </p>
          <p style="margin: 6px 0 0 0; font-size: 11px; color: #b45309;">
            <strong>${isAr ? 'أبرز المثيرات المسجلة:' : 'Top Recurring Triggers:'}</strong> ${topTriggerText}
          </p>
        </div>

        <h4 style="margin: 16px 0 8px 0; font-size: 13px; color: #1e293b;">
          ${isAr ? 'سجل الرصد الحسي الحديث (آخر 20 رصد):' : 'Recent Sensory Baseline Records (Last 20 Logs):'}
        </h4>
        <table>
          <thead>
            <tr>
              <th>${isAr ? 'التاريخ والوقت' : 'Date / Time'}</th>
              <th>${isAr ? 'المستوى والشدة' : 'Level & Intensity'}</th>
              <th>${isAr ? 'المثير الحسي المرصود' : 'Observed Sensory Trigger'}</th>
              <th>${isAr ? 'تدخل التهدئة المستخدم' : 'Intervention Applied'}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || `<tr><td colspan="4" style="text-align: center; padding: 12px; color: #94a3b8;">${isAr ? 'لا توجد سجلات مسجلة' : 'No records logged'}</td></tr>`}
          </tbody>
        </table>

        <div class="footer-sign">
          <div style="width: 48%;">
            <div style="font-size: 11px; color: #64748b;">${isAr ? 'اعتماد أخصائي التخاطب / التحليل السلوكي (SLP / BCBA):' : 'Therapist / BCBA Sign-off:'}</div>
            <div class="sign-field"></div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">${isAr ? 'التوقيع والتاريخ' : 'Signature & Date'}</div>
          </div>
          <div style="width: 48%;">
            <div style="font-size: 11px; color: #64748b;">${isAr ? 'ملاحظات الجلسة القادمة:' : 'Notes for Next Session:'}</div>
            <div class="sign-field"></div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">${isAr ? 'ملاحظات إضافية' : 'Additional Observations'}</div>
          </div>
        </div>

        <div class="no-print" style="margin-top: 24px; text-align: center;">
          <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 10px 24px; font-size: 13px; font-weight: bold; border-radius: 8px; cursor: pointer;">
            ${isAr ? '🖨️ طباعة التقرير أو حفظ كملف PDF' : '🖨️ Print Report or Save as PDF'}
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 450);
  };

  const latestSensory = sensoryLogs[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-white overflow-y-auto p-4 sm:p-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="pb-4 border-b border-slate-800 flex items-center justify-between gap-3 mb-6 flex-wrap">
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
            <div className="w-9 h-9 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/50">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base leading-tight">
                {t('Caregiver & Specialist Command Hub', 'لوحة تحكم المرافق والمختص الطبي', 'Centre Accompagnant & Spécialiste')}
              </h1>
              <p className="text-[11px] text-slate-400">
                {t('Telemetry, safety controls, sensory pattern analytics and clinical insights', 'متابعة المؤشرات الحيوية، التحليل السريري للأنماط الحسية، تجربة الطوارئ وجواز الوصول')}
              </p>
            </div>
          </div>
        </div>

        {onOpenPassport && (
          <button
            onClick={onOpenPassport}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <span>🛂</span>
            <span>{t('Accessibility Passport', 'جواز السفر الميسر', 'Passeport Accessibilité')}</span>
          </button>
        )}
      </header>

      {/* Main Grid Content */}
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Pending Caregiver Link Requests */}
        {pendingLinkRequests.length > 0 && (
          <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 shadow-lg space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Shield className="w-5 h-5" />
              <span>
                {t('Caregiver access requests', 'طلبات ربط مرافق/ولي أمر', "Demandes de liaison d'accompagnant")}
              </span>
            </div>
            {pendingLinkRequests.map((req) => (
              <div
                key={req.parentUid}
                className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate">{req.parentName}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {t(
                      'wants to view your progress and accessibility settings',
                      'عايز يشوف تقدمك وإعدادات الوصول الميسر بتاعتك',
                      'souhaite voir vos progrès et vos réglages d\'accessibilité'
                    )}
                    {req.parentEmail ? ` · ${req.parentEmail}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRejectLink(req.parentUid)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 text-xs font-bold transition-colors"
                  >
                    {t('Decline', 'رفض', 'Refuser')}
                  </button>
                  <button
                    onClick={() => handleApproveLink(req)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                  >
                    {t('Approve', 'موافقة', 'Approuver')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Linked Caregivers */}
        {linkedCaregivers.length > 0 && (
          <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-lg space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>
                  {t('Linked caregivers & specialists', 'المرافقين والمختصين المرتبطين', 'Accompagnants et spécialistes liés')}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {linkedCaregivers.length}
              </span>
            </div>
            {linkedCaregivers.map((c) => (
              <div
                key={c.uid}
                className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate">{c.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {c.email}
                    {c.uid === profile.linkedParentUid ? ` · ${t('Primary', 'أساسي', 'Principal')}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeCaregiver(c.uid)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 text-xs font-bold transition-colors shrink-0"
                >
                  {t('Remove access', 'إلغاء الوصول', 'Retirer')}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Status Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Vision Telemetry */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-lg">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase">{t('Visual Memories', 'ذاكرة الأشخاص والأشياء')}</div>
              <div className="text-xl font-black text-white">{profile.visionMemories?.length || 0} {t('Items', 'عنصر')}</div>
            </div>
          </div>

          {/* Euphonia Telemetry */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-lg">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Mic className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase">{t('Vocal Triggers', 'محفزات النطق (إيفونيا)')}</div>
              <div className="text-xl font-black text-white">{profile.vocalTriggers?.length || 3} {t('Tuned', 'مضبوط')}</div>
            </div>
          </div>

          {/* Sensory Regulation Telemetry */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-lg">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase">{t('Sensory State', 'الحالة والضغط الحسي')}</div>
              <div className="text-base font-black text-white flex items-center gap-1.5">
                <span>{latestSensory ? `${latestSensory.intensity}/5` : 'هادئ'}</span>
                <span className="text-[10px] text-purple-300 font-normal truncate">
                  ({latestSensory ? latestSensory.level : 'Calm'})
                </span>
              </div>
            </div>
          </div>

          {/* Contacts Telemetry */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-lg">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase">{t('Emergency Contacts', 'أرقام الطوارئ')}</div>
              <div className="text-xl font-black text-white">{contacts.length} {t('Saved', 'مسجل')}</div>
            </div>
          </div>
        </div>

        {/* ── CLINICAL ABA & OT SENSORY PATTERN ANALYTICS ── */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-white flex items-center gap-2">
                  <span>{t('Clinical Sensory & Meltdown Analytics (ABA / OT)', 'التحليل السريري للأنماط ونوبات الضغط الحسي (ABA / OT)')}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/40 text-purple-300 font-normal">
                    {patternAnalysis.totalMeltdowns} {t('Episodes Tracked', 'نوبة مرصودة')}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  {t('Pattern detection to guide speech-language & behavioral therapy adaptations', 'اكتشاف الأنماط المتكررة لمساعدة أخصائي السلوك والتخاطب في ضبط خطة التدخل')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-slate-400 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>{t('Peak Overload Window:', 'ذروة نوبات الضغط:')} <strong className="text-amber-300 font-bold">{isAr ? patternAnalysis.peakTimeWindow : patternAnalysis.peakTimeWindowEn}</strong></span>
              </div>
              <button
                onClick={handlePrintWeeklyClinicalReport}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                title={t('Print Clinical Summary for SLP / ABA Therapist', 'طباعة التقرير السريري لأخصائي التخاطب والسلوك')}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t('Print Clinical Report', 'طباعة تقرير الجلسة (ABA / SLP)')}</span>
              </button>
            </div>
          </div>

          {/* ABA Routine Correlation Alert Banner */}
          {patternAnalysis.scheduleCorrelation && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-indigo-500/15 border border-amber-500/40 space-y-1.5 shadow-lg">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>{t('Actionable Clinical Insight & Routine Correlation:', 'اكتشاف ارتباط سريري بالروتين اليومي (ABA Insight):')}</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {isAr ? patternAnalysis.scheduleCorrelation.clinicalRecommendation : patternAnalysis.scheduleCorrelation.clinicalRecommendationEn}
              </p>
            </div>
          )}

          {/* Distribution & Triggers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Time of Day Distribution */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-xs text-slate-300 flex items-center justify-between">
                <span>{t('Meltdown Time-of-Day Distribution:', 'توزيع النوبات خلال ساعات اليوم:')}</span>
                <span className="text-[10px] text-slate-400 font-normal">{patternAnalysis.totalMeltdowns} {t('Total', 'إجمالي')}</span>
              </h4>

              <div className="space-y-2 text-xs">
                {[
                  { label: t('Morning (06:00 - 12:00)', 'الصباح (06:00 - 12:00)'), count: patternAnalysis.timeOfDayDistribution.morning, color: 'bg-amber-400' },
                  { label: t('Afternoon (12:00 - 17:00)', 'بعد الظهر (12:00 - 17:00)'), count: patternAnalysis.timeOfDayDistribution.afternoon, color: 'bg-rose-400' },
                  { label: t('Evening (17:00 - 22:00)', 'المساء (17:00 - 22:00)'), count: patternAnalysis.timeOfDayDistribution.evening, color: 'bg-purple-400' },
                  { label: t('Night (22:00 - 06:00)', 'الليل (22:00 - 06:00)'), count: patternAnalysis.timeOfDayDistribution.night, color: 'bg-blue-400' },
                ].map((item, idx) => {
                  const pct = patternAnalysis.totalMeltdowns > 0 ? Math.round((item.count / patternAnalysis.totalMeltdowns) * 100) : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>{item.label}</span>
                        <span className="font-mono font-bold text-slate-200">{item.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Triggers */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-xs text-slate-300 flex items-center justify-between">
                <span>{t('Most Frequent Sensory Triggers:', 'أبرز المثيرات الحسية المتكررة:')}</span>
                <span className="text-[10px] text-slate-400 font-normal">{patternAnalysis.topTriggers.length} {t('Identified', 'محددة')}</span>
              </h4>

              {patternAnalysis.topTriggers.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  {t('No high-intensity sensory triggers recorded yet.', 'لا توجد مثيرات حسية مرتفعة مسجلة حتى الآن.')}
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {patternAnalysis.topTriggers.map((tr, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-300">
                        <span className="truncate">{tr.trigger}</span>
                        <span className="font-mono font-bold text-rose-300 shrink-0">{tr.count}x ({tr.percentage}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${tr.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Safety & SOS Testing Section */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-black text-base flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400" />
                <span>{t('Safety & Emergency SOS Verification', 'فحص واختبار أمان نداء الاستغاثة والطوارئ')}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('Test the emergency dispatch pipeline to ensure caregiver notification works reliably.', 'تأكد من وصول رسائل الطوارئ لجهات الاتصال المسجلة بدون مشاكل.')}
              </p>
            </div>

            <button
              onClick={handleTestSOS}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all ${
                testSent ? 'bg-emerald-600 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
              }`}
            >
              {testSent ? <Check className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              <span>{testSent ? t('Test Sent!', 'تم الإرسال!') : t('Send Test SOS', 'إرسال نداء تجريبي')}</span>
            </button>
          </div>

          {/* Registered Emergency Contacts List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
            {contacts.map((c) => (
              <div key={c.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-white flex items-center gap-1.5">
                    <span>{isAr ? (c.nameAr || c.nameEn) : c.nameEn}</span>
                    {c.isPrimaryEmergency && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-900 text-rose-300 font-bold">{t('Primary', 'أساسي')}</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{c.phone || t('No number', 'بدون رقم')}</div>
                </div>
                {c.phone && (
                  <button
                    onClick={() => sendWhatsAppMessage(c.phone, t('Test message from Cognify Caregiver Hub', 'رسالة تجربة من لوحة مرافق Cognify'))}
                    className="p-2 rounded-xl bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 transition-all"
                    title="WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Configuration Backup & Migration */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div>
            <h3 className="font-black text-base flex items-center gap-2">
              <FileJson className="w-5 h-5 text-indigo-400" />
              <span>{t('Configuration Backup & Clinical Export', 'النسخ الاحتياطي وتصدير التقرير للمختص')}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('Save all user tunings, eye calibrations, and phrase banks as a portable JSON file.', 'احفظ كل الإعدادات ومعايرة تتبع العين والكلمات كملف يمكن نقله أو استرجاعه في أي وقت.')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleExportConfig}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{t('Download JSON Backup', 'تحميل نسخة احتياطية (JSON)')}</span>
            </button>
            <button
              onClick={handlePrintWeeklyClinicalReport}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>{t('Print Weekly Clinical Report (ABA/SLP)', 'طباعة التقرير السريري الأسبوعي (ABA/SLP)')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
