import { localize } from '../lib/translations';
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, AccessibilityMode, Message, LanguagePreference } from '../types';
import { 
  Settings, Eye, Accessibility, Menu, Sparkles, User, Ear, Mic, Brain, 
  ArrowLeft, ArrowRight, MessageSquare, Activity, Globe, Check, 
  LayoutGrid, Building2, Zap, Radio, Shield, ListFilter, Layers, 
  SlidersHorizontal, CheckCircle2, ChevronRight, Grid, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db, cleanDataForFirestore } from '../lib/firebase';
import { toast } from './Toast';
import MotorEuphoniaView from './MotorEuphoniaView';
import VisionCompanionView from './VisionCompanionView';
import ChatInterface, { ChatInterfaceRef } from './ChatInterface';
import OrgDashboard from './OrgDashboard';
import NeurodiversityHub from './NeurodiversityHub';
import CaregiverHub from './CaregiverHub';
import AccessibilityPassportModal from './AccessibilityPassportModal';
import DeafEcosystemView from './DeafEcosystemView';
import { isAccessibilityUser } from '../lib/access';
import { getTranslation } from '../lib/translations';

export type DisabilityTab =
  | 'hub'
  | 'chat'
  | 'settings'
  | 'video'
  | 'bridge'
  | 'org'
  | 'motor'
  | 'vision'
  | 'radar'
  | 'neurodiversity'
  | 'caregiver'
  | 'deaf';

export type ModuleCategory = 'all' | 'vision' | 'hearing' | 'motor' | 'neuro' | 'caregiver';

interface DisabilityModeViewProps {
  profile: UserProfile;
  onMenuClick: () => void;
  onNavigate?: (view: 'chat' | 'profile' | 'settings' | 'video' | 'disability') => void;
  onQuestionEvaluated?: (score: number, lastMessageSnippet?: string) => void;
  syncMessages?: (updatedHistory: Message[]) => void;
  externalMessage?: string;
  onStreamingUpdate?: (text: string) => void;
  onSTTStateChange?: (active: boolean) => void;
  onTabChange?: (tab: DisabilityTab) => void;
  setProfile?: (profile: UserProfile) => void;
}

const DisabilityModeView = React.forwardRef<ChatInterfaceRef, DisabilityModeViewProps>(function DisabilityModeView({
  profile,
  onMenuClick,
  onNavigate,
  onQuestionEvaluated,
  syncMessages,
  externalMessage,
  onStreamingUpdate,
  onSTTStateChange,
  onTabChange,
  setProfile
}, ref) {
  const [activeTab, setActiveTab] = useState<DisabilityTab>('hub');
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ModuleCategory>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const isOrgStaff = !!profile?.isOrgManager && !!(profile?.organization || '').trim();

  // Tell parent which tab is active
  useEffect(() => { 
    onTabChange?.(activeTab); 
  }, [activeTab, onTabChange]);

  useEffect(() => () => { 
    onTabChange?.('chat'); 
  }, [onTabChange]);

  const SUPPORTED_LANGUAGES: { id: LanguagePreference; label: string; flag: string; nativeName: string }[] = [
    { id: 'French', label: 'French', flag: '🇫🇷', nativeName: 'Français' },
    { id: 'English', label: 'English', flag: '🇬🇧', nativeName: 'English' },
    { id: 'Arabic', label: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
    { id: 'Egyptian Ammiya', label: 'Egyptian Ammiya', flag: '🇪🇬', nativeName: 'مصري' },
    { id: 'Spanish', label: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
    { id: 'German', label: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
    { id: 'Italian', label: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
    { id: 'Portuguese', label: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
    { id: 'Russian', label: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
    { id: 'Chinese', label: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
    { id: 'Japanese', label: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
  ];

  const updateLanguage = async (newLang: LanguagePreference) => {
    if (!profile?.uid) return;
    const previousLang = profile.language;
    if (setProfile) setProfile({ ...profile, language: newLang });
    const path = `users/${profile.uid}`;
    try {
      await setDoc(doc(db, path), cleanDataForFirestore({ language: newLang }), { merge: true });
      toast.success(
        localize(newLang, `Language set to: ${newLang}`, `تم تغيير اللغة إلى: ${newLang}`),
        localize(newLang, 'Language Updated', 'تم تحديث اللغة')
      );
    } catch (err) {
      console.error('Failed to update language:', err);
      if (setProfile) setProfile({ ...profile, language: previousLang });
      toast.error(
        localize(profile.language, 'Failed to update language.', 'فشل تحديث اللغة.'),
        localize(profile.language, 'Update Error', 'خطأ في التحديث')
      );
    }
  };

  const updateMode = async (mode: AccessibilityMode) => {
    if (!profile?.uid) return;
    const previousMode = profile.accessibilityMode;
    if (setProfile) setProfile({ ...profile, accessibilityMode: mode });
    const path = `users/${profile.uid}`;
    try {
      await setDoc(doc(db, path), { accessibilityMode: mode }, { merge: true });
      toast.success(
        localize(profile?.language, `Mode set to: ${mode}`, `تم تفعيل نمط: ${mode}`),
        localize(profile?.language, 'Accessibility Mode', 'نمط الوصول')
      );
    } catch (err) {
      console.error('Failed to update accessibility mode:', err);
      if (setProfile) setProfile({ ...profile, accessibilityMode: previousMode });
      toast.error(
        localize(profile?.language, 'Failed to update accessibility mode.', 'فشل تحديث وضع إمكانية الوصول.'),
        localize(profile?.language, 'Update Error', 'خطأ في التحديث')
      );
    }
  };

  // Grouped Categories Definition
  const CATEGORIES = [
    {
      id: 'all' as const,
      titleEn: 'All Suites',
      titleAr: 'جميع الأدوات',
      emoji: '🌟',
      icon: Sparkles,
      color: 'text-cyan-400',
      activeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
      descAr: 'عرض شامل لجميع أدوات ومنظومات إمكانية الوصول والتكيف',
      descEn: 'Full view of all assistive and adaptation suites',
    },
    {
      id: 'vision' as const,
      titleEn: 'Visual & Blind',
      titleAr: 'المكفوفين وضعاف البصر',
      emoji: '👁️',
      icon: Eye,
      color: 'text-emerald-400',
      activeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
      descAr: 'الرفيق البصري الذكي، قارئ العملات والملابس، حفظ الوجوه، والملاحة بالاهتزاز اللمسي',
      descEn: 'Conversational audio eyes, currency reader, face recall, clothes matching & haptic cane',
    },
    {
      id: 'hearing' as const,
      titleEn: 'Deaf & Hard of Hearing',
      titleAr: 'الصم وضعاف السمع',
      emoji: '👂',
      icon: Ear,
      color: 'text-indigo-400',
      activeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
      descAr: 'استوديو الإشارة ثلاثي الأبعاد، رادار الأصوات والمخاطر، وجسر التخاطب المباشر',
      descEn: '3D sign language avatar, ambient sound & hazard radar, and live human communication bridge',
    },
    {
      id: 'motor' as const,
      titleEn: 'Motor, ALS & Mobility',
      titleAr: 'الحركة والشلل والتصلب',
      emoji: '🦾',
      icon: Activity,
      color: 'text-amber-400',
      activeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
      descAr: 'حركة الرأس، لوحة العين والرمش، عبارات AAC السريعة، واستغاثة الطوارئ SOS بالعين 4 ثوانٍ',
      descEn: 'Head pointer, eye-gaze virtual keyboard, contextual AAC, and 4-second eye-closure SOS',
    },
    {
      id: 'neuro' as const,
      titleEn: 'Neurodiversity & Autism',
      titleAr: 'التوحد وصعوبات التعلم',
      emoji: '🧩',
      icon: Brain,
      color: 'text-purple-400',
      activeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
      descAr: 'بطاقات PECS المصورة المنطوقة، الجدول اليومي، فقاعة التنفس المهدئة، ومسطرة القراءة',
      descEn: 'Interactive PECS cards, visual routine, calming breathing bubble, and dyslexia reading tools',
    },
    {
      id: 'caregiver' as const,
      titleEn: 'Caregiver & Universal',
      titleAr: 'المرافق والتيسيرات',
      emoji: '🛡️',
      icon: Shield,
      color: 'text-rose-400',
      activeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
      descAr: 'لوحة المرافق والمختص، اختبار نداء الاستغاثة، وجواز السفر الميسر الموحد',
      descEn: 'Family & clinical dashboard, live SOS test dispatch, and universal accommodation passport',
    },
  ];

  // Modules metadata definition with Category grouping
  const MODULES = [
    // 1. VISUAL
    {
      id: 'vision' as const,
      category: 'vision' as const,
      titleEn: 'Visual Companion (AI Eyes)',
      titleAr: 'الرفيق البصري الذكي',
      shortEn: 'Visual Eyes',
      shortAr: 'الرفيق البصري',
      badgeEn: 'Blind & Low Vision',
      badgeAr: 'المكفوفين وضعاف البصر',
      descEn: 'Friendly conversational audio companion. Reads Egyptian pounds & currencies, matches clothes colors, recognizes people, and guides with tactile haptic vibration.',
      descAr: 'وصف صوتي بشري فوري، قارئ العملات الورقية (الجنيه المصري والعملات)، تنسيق الملابس، التعرف على الأشخاص والوجوه، والملاحة اللمسية بالاهتزاز.',
      quickFeaturesAr: ['قارئ العملات الفوري', 'التعرف على الأشخاص والوجوه', 'تنسيق ألوان الملابس', 'ملاحة واهتزازات لمسية', 'الذاكرة المكانية للأشياء'],
      quickFeaturesEn: ['Currency Reader', 'Face & Person Memory', 'Color Matching', 'Haptic White Cane', 'Spatial Memory'],
      Icon: Eye,
      accentColor: 'text-emerald-400',
      borderGlow: 'hover:border-emerald-500/60 border-slate-800',
      bgGlow: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      buttonCls: 'bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 shadow-teal-500/20',
      matchingMode: 'Visual',
    },
    // 2. HEARING (Deaf Ecosystem - All-in-One Suite)
    {
      id: 'deaf' as const,
      category: 'hearing' as const,
      titleEn: 'Deaf & Hard of Hearing Suite (All-in-One)',
      titleAr: 'منظومة الصم وضعاف السمع الشاملة (الكل في واحد)',
      shortEn: 'Deaf Suite',
      shortAr: 'منظومة الصم',
      badgeEn: 'Deaf & Hard of Hearing',
      badgeAr: 'الصم وضعاف السمع',
      descEn: 'All-in-one unified deaf ecosystem: 3D Sign Language Studio, Ambient Sound & Hazard Radar, and Two-Way Live Human Bridge with instant toggles.',
      descAr: 'منظومة متكاملة تجمع كل أدوات التيسير السمعي في شاشة واحدة مع التبديل الفوري: استوديو الإشارة 3D، رادار الأصوات والمخاطر، وجسر التخاطب المباشر.',
      quickFeaturesAr: ['🤟 استوديو إشارة 3D', '📡 رادار مخاطر وأصوات', '💬 جسر تواصل مباشر', '⚡ تبديل فوري بنفس الشاشة', '🚨 وميض واهتزاز لمسي'],
      quickFeaturesEn: ['🤟 3D Sign Studio', '📡 Sound & Hazard Radar', '💬 2-Way Human Bridge', '⚡ 1-Screen Instant Toggles', '🚨 Strobe & Haptics'],
      subPills: [
        { tab: 'video' as const, labelEn: '3D Sign', labelAr: 'لغة الإشارة', icon: Accessibility },
        { tab: 'radar' as const, labelEn: 'Sound Radar', labelAr: 'رادار الأصوات', icon: Radio },
        { tab: 'bridge' as const, labelEn: 'Live Bridge', labelAr: 'جسر التواصل', icon: Ear },
      ],
      Icon: Accessibility,
      accentColor: 'text-indigo-400',
      borderGlow: 'hover:border-indigo-500/80 border-indigo-500/40 ring-1 ring-indigo-500/20',
      bgGlow: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40',
      buttonCls: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 text-white shadow-indigo-500/25',
      matchingMode: 'Sign-Only',
    },
    // 3. MOTOR & ALS
    {
      id: 'motor' as const,
      category: 'motor' as const,
      titleEn: 'Motor & Euphonia Control',
      titleAr: 'التحكم الحركي وإيفونيا',
      shortEn: 'Motor Control',
      shortAr: 'التحكم الحركي',
      badgeEn: 'Quadriplegia & ALS',
      badgeAr: 'الشلل والتصلب الجانبي',
      descEn: 'Full hands-free interaction. Head-pointer cursor, eye-blink virtual keyboard, contextual predictive AAC quick bar, and 4-second continuous eye-closure SOS dispatch.',
      descAr: 'تحكم متكامل بدون لمس عبر حركة الرأس، لوحة العين والرمش، شريط العبارات السريعة التنبؤية، ونداء استغاثة الطوارئ SOS بالعين 4 ثوانٍ مع GPS.',
      quickFeaturesAr: ['قيادة المؤشر بحركة الرأس', 'لوحة افتراضية بالعين والرمش', 'شريط عبارات تنبؤية حسب الوقت', 'استغاثة SOS بالعين 4 ثوانٍ و GPS', 'تأكيدات همهمات إيفونيا'],
      quickFeaturesEn: ['Head-Tracking Pointer', 'Eye-Gaze Keyboard', 'Predictive AAC Quick Bar', '4-sec Eye Closure GPS SOS', 'Euphonia Vocal Triggers'],
      Icon: Activity,
      accentColor: 'text-amber-400',
      borderGlow: 'hover:border-amber-500/60 border-slate-800',
      bgGlow: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      buttonCls: 'bg-gradient-to-r from-amber-400 via-amber-500 to-rose-400 text-slate-950 shadow-amber-500/20',
      matchingMode: 'Motor-Euphonia',
    },
    // 4. NEURODIVERSITY & AUTISM
    {
      id: 'neurodiversity' as const,
      category: 'neuro' as const,
      titleEn: 'Neurodiversity & Autism Hub',
      titleAr: 'واحة التوحد وصعوبات التعلم',
      shortEn: 'Autism & Dyslexia',
      shortAr: 'التوحد والتعلم',
      badgeEn: 'Autism, ADHD & Dyslexia',
      badgeAr: 'التوحد وعسر القراءة',
      descEn: 'Visual PECS communication cards with speech output, daily visual routine schedules, emotion & sensory regulation meter with 4-7-8 breathing bubble, and dyslexia reading tools.',
      descAr: 'بطاقات بيكس (PECS) للتواصل البصري المنطوق، جدول الروتين اليومي المنظم، مقياس المشاعر وفقاعة التنفس المهدئة، ومسطرة القراءة لعسر القراءة.',
      quickFeaturesAr: ['بطاقات PECS ناطقة بنقرة واحدة', 'جدول روتين يومي بصري', 'مقياس المشاعر وفقاعة التنفس 4-7-8', 'مسطرة القراءة لعسر القراءة'],
      quickFeaturesEn: ['1-Tap Spoken PECS Cards', 'Daily Visual Routine', '4-7-8 Calming Breathing Bubble', 'Dyslexia Reading Ruler'],
      Icon: Brain,
      accentColor: 'text-purple-400',
      borderGlow: 'hover:border-purple-500/60 border-slate-800',
      bgGlow: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      buttonCls: 'bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 text-white shadow-purple-500/20',
      matchingMode: 'Neurodiversity',
    },
    // 5. CAREGIVER & UNIVERSAL
    {
      id: 'caregiver' as const,
      category: 'caregiver' as const,
      titleEn: 'Caregiver & Specialist Hub',
      titleAr: 'لوحة المرافق والمختص الطبي',
      shortEn: 'Caregiver Hub',
      shortAr: 'لوحة المرافق',
      badgeEn: 'Clinical & Family Oversight',
      badgeAr: 'إشراف الأسرة والمختصين',
      descEn: 'Unified monitoring dashboard for parents and clinical specialists, live emergency SOS test dispatch, telemetry metrics, and one-click JSON backup.',
      descAr: 'لوحة تحكم للأهل والمختصين لمتابعة الأنشطة، اختبار نداء الاستغاثة التجريبي، إحصائيات الذاكرة البصرية والنطق، والنسخ الاحتياطي السحابي.',
      quickFeaturesAr: ['مؤشرات قياس عن بُعد', 'اختبار نداء استغاثة مباشر', 'سجل الذاكرة البصرية والنطق', 'تصدير نسخة احتياطية مشفرة'],
      quickFeaturesEn: ['Live Telemetry Metrics', 'SOS Test Dispatch', 'Vision & Vocal History', 'Encrypted JSON Backup'],
      Icon: Shield,
      accentColor: 'text-rose-400',
      borderGlow: 'hover:border-rose-500/60 border-slate-800',
      bgGlow: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      buttonCls: 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-rose-500/20',
      matchingMode: 'Multiple',
    },
    {
      id: 'chat' as const,
      category: 'caregiver' as const,
      titleEn: 'Adaptive Cognitive Tutor',
      titleAr: 'المساعد التعليمي الذكي المهيأ',
      shortEn: 'Adaptive Tutor',
      shortAr: 'المساعد المهيأ',
      badgeEn: 'All Learners',
      badgeAr: 'دعم إدراكي متكيف',
      descEn: 'Pedagogical tutoring assistant tailored to individual cognitive speed, worked examples, and screen-reader accessible plain text.',
      descAr: 'مساعد تعليمي ذكي يتكيف مع وتيرتك واستيعابك، يقدم شرحاً خطوة بخطوة ومتوافق مع قارئات الشاشة والأجهزة المساعدة.',
      quickFeaturesAr: ['تكيف مع سرعة الاستيعاب', 'شرح خطوة بخطوة', 'دعم قارئات الشاشة بالكامل'],
      quickFeaturesEn: ['Adaptive Pace', 'Step-by-Step Guidance', 'Full Screen Reader Support'],
      Icon: MessageSquare,
      accentColor: 'text-cyan-400',
      borderGlow: 'hover:border-cyan-500/60 border-slate-800',
      bgGlow: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      buttonCls: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-500/20',
      matchingMode: 'None',
    },
    {
      id: 'settings' as const,
      category: 'caregiver' as const,
      titleEn: 'Preferences & Dialects',
      titleAr: 'التفضيلات واللغات',
      shortEn: 'Settings',
      shortAr: 'الإعدادات',
      badgeEn: '11 Dialects & Options',
      badgeAr: 'اللغات وأنماط الوصول',
      descEn: 'Customize system languages (including Egyptian Ammiya), choose active accessibility profiles, and adjust display settings.',
      descAr: 'اختيار لغة النظام واللهجة المصرية المحكية، تفعيل ملفات إمكانية الوصول الخاصة، وضبط التباين العالي بما يلائم احتياجاتك.',
      quickFeaturesAr: ['11 لغة ولهجة محكية', 'تفعيل الأنماط المخصصة', 'التحكم في التباين'],
      quickFeaturesEn: ['11 Languages & Dialects', 'Custom Profile Activation', 'Contrast Options'],
      Icon: Settings,
      accentColor: 'text-slate-300',
      borderGlow: 'hover:border-slate-600 border-slate-800',
      bgGlow: 'bg-slate-800/80 text-slate-300 border-slate-700',
      buttonCls: 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700',
      matchingMode: '',
    },
    ...(isOrgStaff ? [{
      id: 'org' as const,
      category: 'caregiver' as const,
      titleEn: 'My Organization Hub',
      titleAr: 'لوحة تحكم الجمعية / المؤسسة',
      shortEn: 'Org Hub',
      shortAr: 'المؤسسة',
      badgeEn: 'Charity & NGO Staff Portal',
      badgeAr: 'خاص بمشرفي الجمعيات والمؤسسات',
      descEn: 'Cohort analytics, enrolled special-needs learners, cognitive distributions, and accessibility adoption reports for your registered organization.',
      descAr: 'متابعة وإدارة طلاب الجمعية المسجلين، إحصائيات مستويات الاستيعاب المعرفي، ومعدلات تفعيل تقنيات إمكانية الوصول.',
      quickFeaturesAr: ['إحصائيات طلاب المؤسسة', 'تقارير تبني أدوات الوصول'],
      quickFeaturesEn: ['Cohort Analytics', 'Adoption Reports'],
      Icon: Building2,
      accentColor: 'text-teal-400',
      borderGlow: 'hover:border-teal-500/60 border-slate-800',
      bgGlow: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
      buttonCls: 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-teal-500/20',
      matchingMode: '',
    }] : []),
  ];

  // Filter modules based on selectedCategory
  const filteredModules = useMemo(() => {
    if (selectedCategory === 'all') return MODULES;
    return MODULES.filter((m) => m.category === selectedCategory);
  }, [selectedCategory, MODULES]);

  // Current active module metadata for sibling bar
  const currentModule = MODULES.find((m) => m.id === activeTab);
  const siblingModules = useMemo(() => {
    if (!currentModule || currentModule.category === 'caregiver') return [];
    return MODULES.filter((m) => m.category === currentModule.category);
  }, [currentModule, MODULES]);

  const isAr = profile.language === 'Arabic' || profile.language === 'Egyptian Ammiya';
  const isDeafActive = activeTab === 'deaf' || activeTab === 'video' || activeTab === 'radar' || activeTab === 'bridge';

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex-1 flex flex-col h-full bg-[#0d101d] text-slate-100 overflow-hidden relative select-none">
      
      {/* ── TOP NAVIGATION BAR ── */}
      {!isDeafActive && (
        <header className="relative z-[9995] px-4 py-2.5 sm:px-6 sm:py-3 shrink-0 flex items-center justify-between border-b border-slate-800 bg-[#121524]/95 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* Main App Menu Drawer Button */}
            <button
              onClick={() => {
                if (isAccessibilityUser(profile) || !onNavigate) onMenuClick();
                else onNavigate('chat');
              }}
              aria-label={isAccessibilityUser(profile)
                ? localize(profile.language, 'Open menu', 'افتح القائمة')
                : getTranslation(profile.language, 'back')}
              className="p-2 text-slate-400 bg-slate-900 border border-slate-800 hover:text-white hover:bg-slate-800 rounded-xl active:scale-95 transition-all flex items-center gap-1.5"
            >
              {isAccessibilityUser(profile)
                ? <Menu className="w-4 h-4" />
                : <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />}
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">
                {isAccessibilityUser(profile)
                  ? localize(profile.language, 'Menu', 'القائمة')
                  : getTranslation(profile.language, 'back')}
              </span>
            </button>

            {/* If inside an active module, show clear "Back to Hub" button */}
            {activeTab !== 'hub' ? (
              <button
                onClick={() => setActiveTab('hub')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{localize(profile.language, 'Back to Hub', 'العودة للمركز')}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-white">
                <div className="p-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                  <Accessibility className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="font-black text-sm sm:text-base tracking-tight">
                  {localize(profile.language, 'Special Needs & Accessibility OS', 'مركز منظومات ذوي الهمم والتيسير')}
                </span>
              </div>
            )}
          </div>

          {/* Right Header Status / Sibling Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sibling module pills when inside a suite */}
            {activeTab !== 'hub' && siblingModules.length > 1 ? (
              <div className="flex items-center bg-slate-900/90 border border-slate-800 p-1 rounded-xl max-w-[280px] sm:max-w-md overflow-x-auto custom-scrollbar">
                {siblingModules.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveTab(m.id)}
                    title={localize(profile.language, m.titleEn, m.titleAr)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      activeTab === m.id
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <m.Icon className="w-3 h-3" />
                    <span>{localize(profile.language, m.shortEn, m.shortAr)}</span>
                  </button>
                ))}
              </div>
            ) : (
              /* On Hub: show passport button & settings */
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPassportModal(true)}
                  title={localize(profile.language, 'Universal Accessibility Passport', 'جواز السفر الميسر الشامل')}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border border-indigo-500/40 text-indigo-200 hover:text-white hover:bg-indigo-600/50 transition-all text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <span>🛂</span>
                  <span>{localize(profile.language, 'Accommodation Passport', 'جواز السفر الميسر')}</span>
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  title={localize(profile.language, 'Settings & Languages', 'الإعدادات واللغات')}
                  className="p-2.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        <AnimatePresence mode="wait">

          {/* ═════════════════════════════════════════════════════════════════════
              VIEW: DISABILITY MODULES HUB & LAUNCHER
             ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'hub' && (
            <motion.div
              key="hub-launcher"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8 lg:p-10"
            >
              <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-16">
                
                {/* 1. Quick Launch Personalized Card (if user has active mode) */}
                {profile.accessibilityMode && profile.accessibilityMode !== 'None' && (() => {
                  const matched = MODULES.find(m => m.matchingMode === profile.accessibilityMode);
                  if (!matched) return null;
                  return (
                    <section className="bg-gradient-to-r from-cyan-500/15 via-indigo-500/10 to-transparent border border-cyan-500/40 rounded-[28px] p-6 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4 text-start">
                        <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                          <matched.Icon className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 mb-1">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                            <span>{localize(profile.language, 'Your Configured Active Environment', 'بيئتك المفعلة المباشرة')}</span>
                          </div>
                          <h3 className="text-xl font-black text-white">
                            {localize(profile.language, matched.titleEn, matched.titleAr)}
                          </h3>
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveTab(matched.id)}
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all shrink-0"
                      >
                        <Zap className="w-5 h-5" />
                        <span>{localize(profile.language, 'Launch Direct Access', 'دخول مباشر بلمسة واحدة')}</span>
                        <ArrowRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                      </button>
                    </section>
                  );
                })()}

                {/* 2. Accessible Category Pills Filter (Grouped by Needs) */}
                <section className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-start">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <ListFilter className="w-4 h-4 text-cyan-400" />
                        <span>{localize(profile.language, 'Filter by Assistive Need', 'تصفية حسب نوع الاحتياج والتيسير')}</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {localize(profile.language, 'All tools are grouped by category for quick, effortless navigation.', 'تم جمع الأدوات المترابطة معاً لسهولة الوصول وعدم التشتت.')}
                      </p>
                    </div>

                    {/* View Mode Switcher (Grid vs Large Accessible List) */}
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          viewMode === 'grid'
                            ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title={localize(profile.language, 'Grid Cards View', 'عرض البطاقات')}
                      >
                        <Grid className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{localize(profile.language, 'Cards', 'بطاقات')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          viewMode === 'list'
                            ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title={localize(profile.language, 'High-Accessibility List (Large Touch Targets)', 'قائمة عريضة سهلة النقر')}
                      >
                        <List className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{localize(profile.language, 'Accessible List', 'قائمة ميسرة')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Category Selector Bar with Large Tap Targets */}
                  <div className="flex items-center gap-2.5 overflow-x-auto custom-scrollbar pb-2 pt-1 -mx-2 px-2">
                    {CATEGORIES.map((cat) => {
                      const isSelected = selectedCategory === cat.id;
                      const count = cat.id === 'all' ? MODULES.length : MODULES.filter((m) => m.category === cat.id).length;
                      if (count === 0 && cat.id !== 'all') return null;

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`min-h-[48px] px-4 py-2.5 rounded-2xl border text-xs font-black whitespace-nowrap flex items-center gap-2.5 transition-all shadow-sm active:scale-95 ${
                            isSelected
                              ? `${cat.activeBg} shadow-md`
                              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <span className="text-base leading-none">{cat.emoji}</span>
                          <span>{localize(profile.language, cat.titleEn, cat.titleAr)}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 3. Category Banner info if specific category is selected */}
                {selectedCategory !== 'all' && (() => {
                  const cat = CATEGORIES.find((c) => c.id === selectedCategory);
                  if (!cat) return null;
                  return (
                    <div className="p-4 rounded-2xl bg-[#121524]/80 border border-slate-800 text-start flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{cat.emoji}</span>
                        <div>
                          <h4 className="text-sm font-black text-white">
                            {localize(profile.language, cat.titleEn, cat.titleAr)}
                          </h4>
                          <p className="text-xs text-slate-400">
                            {localize(profile.language, cat.descEn, cat.descAr)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className="text-xs font-bold text-cyan-400 hover:underline shrink-0"
                      >
                        {localize(profile.language, 'Show All', 'عرض الكل')}
                      </button>
                    </div>
                  );
                })()}

                {/* 4. MODULES DISPLAY: GRID MODE VS HIGH-ACCESSIBILITY LIST MODE */}
                {viewMode === 'grid' ? (
                  <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredModules.map((m) => {
                      const isMyCurrentMode =
                        (m.matchingMode === profile.accessibilityMode && profile.accessibilityMode !== 'None') ||
                        (m.id === 'deaf' && (profile.accessibilityMode === 'Sign-Only' || profile.accessibilityMode === 'Vocal-Deaf')) ||
                        (m.id === 'chat' && profile.accessibilityMode === 'Speech');

                      return (
                        <div
                          key={m.id}
                          className={`bg-[#181C2E]/90 border rounded-[26px] p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between transition-all duration-300 relative group overflow-hidden ${
                            isMyCurrentMode
                              ? 'border-cyan-500/60 shadow-cyan-500/10 ring-2 ring-cyan-500/20'
                              : m.borderGlow
                          }`}
                        >
                          {/* Current Active Mode Ribbon */}
                          {isMyCurrentMode && (
                            <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                              <span>{localize(profile.language, 'Active Mode', 'وضعك المفعل')}</span>
                            </div>
                          )}

                          <div className="space-y-4 text-start">
                            {/* Icon and Category Badge */}
                            <div className="flex items-center gap-3">
                              <div className={`p-3 rounded-2xl border ${m.bgGlow}`}>
                                <m.Icon className="w-6 h-6" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                {localize(profile.language, m.badgeEn, m.badgeAr)}
                              </span>
                            </div>

                            {/* Titles */}
                            <div className="space-y-1">
                              <h3 className="text-lg font-black text-white group-hover:text-cyan-400 transition-colors tracking-tight">
                                {localize(profile.language, m.titleEn, m.titleAr)}
                              </h3>
                              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                {localize(profile.language, m.descEn, m.descAr)}
                              </p>
                            </div>

                            {/* Quick Feature Pills */}
                            {m.quickFeaturesAr && m.quickFeaturesAr.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {(isAr ? m.quickFeaturesAr : m.quickFeaturesEn).map((feat, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className="text-[10px] font-bold text-slate-300 bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded-lg"
                                  >
                                    {feat}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Sub-tools Quick Toggle Pills (e.g. for Deaf Suite) */}
                            {'subPills' in m && (m as any).subPills && (
                              <div className="pt-2">
                                <div className="text-[10px] font-black uppercase text-indigo-300 mb-1.5 flex items-center gap-1">
                                  <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
                                  <span>{localize(profile.language, 'Quick Toggles in 1 Screen:', 'تبديل فوري بنفس الشاشة:')}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {(m as any).subPills.map((sp: any) => {
                                    const SpIcon = sp.icon;
                                    return (
                                      <button
                                        key={sp.tab}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveTab(sp.tab);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-200 hover:text-white border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                                      >
                                        <SpIcon className="w-3 h-3 text-indigo-400" />
                                        <span>{localize(profile.language, sp.labelEn, sp.labelAr)}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Action Launch Button */}
                          <div className="pt-5 mt-3 border-t border-slate-800/80">
                            <button
                              onClick={() => setActiveTab(m.id)}
                              className={`w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${m.buttonCls}`}
                            >
                              <span>{localize(profile.language, 'Open Suite', 'فتح الوحدة')}</span>
                              <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </section>
                ) : (
                  /* HIGH-ACCESSIBILITY LIST MODE (LARGE TOUCH TARGETS - MIN 64px) */
                  <section className="space-y-3">
                    {filteredModules.map((m) => {
                      const isMyCurrentMode =
                        (m.matchingMode === profile.accessibilityMode && profile.accessibilityMode !== 'None') ||
                        (m.id === 'deaf' && (profile.accessibilityMode === 'Sign-Only' || profile.accessibilityMode === 'Vocal-Deaf')) ||
                        (m.id === 'chat' && profile.accessibilityMode === 'Speech');

                      return (
                        <div
                          key={m.id}
                          className={`p-4 sm:p-5 rounded-2xl border bg-[#181C2E]/90 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-700 ${
                            isMyCurrentMode ? 'border-cyan-500/60 ring-1 ring-cyan-500/30' : 'border-slate-800'
                          }`}
                        >
                          <div className="flex items-start sm:items-center gap-4 text-start flex-1 min-w-0">
                            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${m.bgGlow}`}>
                              <m.Icon className="w-7 h-7" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="text-base font-black text-white truncate">
                                  {localize(profile.language, m.titleEn, m.titleAr)}
                                </h4>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                  {localize(profile.language, m.badgeEn, m.badgeAr)}
                                </span>
                                {isMyCurrentMode && (
                                  <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                                    {localize(profile.language, 'Active', 'مفعل')}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 truncate font-medium">
                                {localize(profile.language, m.descEn, m.descAr)}
                              </p>
                              {'subPills' in m && (m as any).subPills && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                  {(m as any).subPills.map((sp: any) => {
                                    const SpIcon = sp.icon;
                                    return (
                                      <button
                                        key={sp.tab}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveTab(sp.tab);
                                        }}
                                        className="px-2 py-0.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-200 hover:text-white border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95"
                                      >
                                        <SpIcon className="w-2.5 h-2.5 text-indigo-400" />
                                        <span>{localize(profile.language, sp.labelEn, sp.labelAr)}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => setActiveTab(m.id)}
                            className={`min-h-[52px] px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shrink-0 active:scale-95 transition-all ${m.buttonCls}`}
                          >
                            <span>{localize(profile.language, 'Launch Tool', 'تشغيل الأداة')}</span>
                            <ArrowRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      );
                    })}
                  </section>
                )}
              </div>
            </motion.div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              ACTIVE MODULE VIEWS (CLEAN & DEDICATED)
             ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'motor' && (
            <motion.div
              key="motor-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full min-h-0"
            >
              <MotorEuphoniaView profile={profile} />
            </motion.div>
          )}

          {activeTab === 'vision' && (
            <motion.div
              key="vision-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full min-h-0"
            >
              <VisionCompanionView profile={profile} setProfile={setProfile} />
            </motion.div>
          )}

          {isDeafActive && (
            <motion.div
              key="deaf-unified-ecosystem"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full min-h-0"
            >
              <DeafEcosystemView
                profile={profile}
                initialTab={activeTab === 'deaf' ? 'video' : (activeTab as any)}
                onNavigateBack={() => setActiveTab('hub')}
                onMenuClick={onMenuClick}
                onTabChange={(tool) => {
                  setActiveTab(tool);
                  onTabChange?.(tool);
                }}
              />
            </motion.div>
          )}

          {activeTab === 'neurodiversity' && (
            <motion.div
              key="neurodiversity-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full min-h-0"
            >
              <NeurodiversityHub profile={profile} onNavigateBack={() => setActiveTab('hub')} />
            </motion.div>
          )}

          {activeTab === 'caregiver' && (
            <motion.div
              key="caregiver-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full min-h-0"
            >
              <CaregiverHub
                profile={profile}
                onNavigateBack={() => setActiveTab('hub')}
                setProfile={setProfile}
                onOpenPassport={() => setShowPassportModal(true)}
              />
            </motion.div>
          )}

          {activeTab === 'org' && (
            <motion.div
              key="org-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full min-h-0"
            >
              <OrgDashboard profile={profile} />
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full min-h-0 flex flex-col p-3 sm:p-4 md:p-6 lg:p-8 pb-0"
            >
              <div className="flex-1 min-h-0 bg-[#121524] rounded-t-3xl shadow-2xl border border-slate-800 overflow-hidden relative flex flex-col">
                <ChatInterface
                  ref={ref}
                  profile={profile}
                  onQuestionEvaluated={onQuestionEvaluated || (() => {})}
                  syncMessages={syncMessages || (() => {})}
                  onMenuClick={onMenuClick}
                  externalMessage={externalMessage}
                  onStreamingUpdate={onStreamingUpdate}
                  onSTTStateChange={onSTTStateChange}
                  isEmbedded={true}
                  setProfile={setProfile}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-10"
            >
              <div className="max-w-4xl mx-auto space-y-8 pb-20">
                {/* Language Selection Card */}
                <div className="bg-[#181C2E]/90 border border-slate-800 p-6 sm:p-8 rounded-[28px] shadow-2xl backdrop-blur-xl">
                  <div className="mb-6 text-start">
                    <div className="flex items-center gap-2 text-cyan-400 mb-1">
                      <Globe className="w-5 h-5" />
                      <h2 className="text-xl font-black text-white tracking-tight">
                        {localize(profile.language, 'Language Selection', 'اختيار اللغة')}
                      </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400">
                      {localize(
                        profile.language,
                        'Choose your preferred system & AI communication language',
                        'اختر لغة النظام والتواصل مع المساعد الذكي'
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {SUPPORTED_LANGUAGES.map((lang) => {
                      const isSelected = profile.language === lang.id;
                      return (
                        <button
                          key={lang.id}
                          onClick={() => updateLanguage(lang.id)}
                          className={`p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between transition-all active:scale-95 ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-500/15 shadow-sm text-cyan-300 font-bold'
                              : 'border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg shrink-0">{lang.flag}</span>
                            <div className="text-start truncate">
                              <p className="text-xs font-bold leading-none">{lang.nativeName}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{lang.label}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Accessibility Mode Selector */}
                <div className="bg-[#181C2E]/90 border border-slate-800 p-6 sm:p-8 rounded-[28px] shadow-2xl backdrop-blur-xl">
                  <div className="mb-6 text-start">
                    <div className="flex items-center gap-2 text-cyan-400 mb-1">
                      <Accessibility className="w-5 h-5" />
                      <h2 className="text-xl font-black text-white tracking-tight">
                        {localize(profile.language, 'Accessibility Accommodations', 'تسهيلات إمكانية الوصول')}
                      </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400">
                      {localize(
                        profile.language,
                        'Select the accessibility profile that best fits your interaction needs.',
                        'اختر ملف التسهيلات الذي يناسب احتياجاتك التفاعلية على النحو الأمثل.'
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { mode: 'None' as const, labelEn: 'Standard', labelAr: 'الوضع القياسي', icon: User },
                      { mode: 'Speech' as const, labelEn: 'Speech & Audio', labelAr: 'الصوت والنسخ الصوتي', icon: Mic },
                      { mode: 'Visual' as const, labelEn: 'Visual & Screen Adaptation', labelAr: 'التكيف البصري وضعاف البصر', icon: Eye },
                      { mode: 'Vocal-Deaf' as const, labelEn: 'Vocal-Deaf Bridge', labelAr: 'الصم المتحدثين وجسر السمع', icon: Ear },
                      { mode: 'Sign-Only' as const, labelEn: 'Sign Language', labelAr: 'لغة الإشارة التفاعلية', icon: Accessibility },
                      { mode: 'Motor-Euphonia' as const, labelEn: 'Motor & Hands-Free', labelAr: 'التحكم الحركي وبدون لمس', icon: Activity },
                      { mode: 'Neurodiversity' as const, labelEn: 'Neurodiversity & Autism', labelAr: 'التنوع العصبي والتوحد', icon: Brain },
                    ].map(({ mode, labelEn, labelAr, icon: ModeIcon }) => {
                      const isSelected = profile.accessibilityMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => updateMode(mode)}
                          className={`p-4 rounded-2xl border text-start flex items-start gap-3 transition-all active:scale-95 ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-500/15 shadow-sm ring-1 ring-cyan-400'
                              : 'border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                            <ModeIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm text-white">{localize(profile.language, labelEn, labelAr)}</span>
                              {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {mode === 'None' && localize(profile.language, 'Standard cognitive experience without overlays.', 'واجهة قياسية طبيعية.')}
                              {mode === 'Speech' && localize(profile.language, 'Voice synthesis, continuous STT, and spoken narration.', 'نطق صوتي، وتفريغ صوتي مستمر.')}
                              {mode === 'Visual' && localize(profile.language, 'Spoken scene description, currency reader, and haptic white cane.', 'وصف بصري فوري، قارئ عملات، ونبضات لمسية.')}
                              {mode === 'Vocal-Deaf' && localize(profile.language, 'High-contrast text captions and direct two-way bridge.', 'نصوص متباينة وتواصل مباشر.')}
                              {mode === 'Sign-Only' && localize(profile.language, '3D sign avatar, reverse sign-to-speech, and sign lexicons.', 'أفاتار إشارة ونطق الإشارة لصوت.')}
                              {mode === 'Motor-Euphonia' && localize(profile.language, 'Hands-free head tracking, eye-blink keyboard, and 4s eye SOS.', 'حركة الرأس، لوحة العين، واستغاثة 4 ثوانٍ.')}
                              {mode === 'Neurodiversity' && localize(profile.language, 'PECS visual cards, visual daily schedule, and calming bubble.', 'بطاقات PECS، جدول بصري، وفقاعة تنفس.')}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Universal Accessibility Passport Modal */}
      <AccessibilityPassportModal
        isOpen={showPassportModal}
        onClose={() => setShowPassportModal(false)}
        profile={profile}
        setProfile={setProfile}
      />
    </div>
  );
});

export default DisabilityModeView;
