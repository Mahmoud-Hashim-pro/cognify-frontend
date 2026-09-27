import { localize } from '../lib/translations';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RadioGroup as AriaRadioGroup, Radio as AriaRadio } from 'react-aria-components';
import { AriaButton } from './ui/AriaButton';
import { UserProfile, AccessibilityMode, Message, LanguagePreference } from '../types';
import { 
  Settings, Eye, Accessibility, Menu, Sparkles, User, Ear, Mic, Brain, 
  ArrowLeft, ArrowRight, MessageSquare, Activity, Globe, Check, 
  LayoutGrid, Building2, Zap, Radio, Shield, ListFilter, Layers, 
  SlidersHorizontal, CheckCircle2, ChevronRight, Grid, List, BookOpen, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db, cleanDataForFirestore } from '../lib/firebase';
import { toast } from './Toast';
import type { ChatInterfaceRef } from './ChatInterface';
const MotorEuphoniaView = React.lazy(() => import('./MotorEuphoniaView'));
const VisionCompanionView = React.lazy(() => import('./VisionCompanionView'));
const ChatInterface = React.lazy(() => import('./ChatInterface'));
const OrgDashboard = React.lazy(() => import('./OrgDashboard'));
const NeurodiversityHub = React.lazy(() => import('./NeurodiversityHub'));
const CaregiverHub = React.lazy(() => import('./CaregiverHub'));
const AccessibilityPassportModal = React.lazy(() => import('./AccessibilityPassportModal'));
const VisualComfortModal = React.lazy(() => import('./VisualComfortModal'));
const DeafEcosystemView = React.lazy(() => import('./DeafEcosystemView'));
const CrossDisabilityOrchestrator = React.lazy(() => import('./CrossDisabilityOrchestrator'));
const LearningHub = React.lazy(() => import('./learning/LearningHub'));
import { isAccessibilityUser } from '../lib/access';
import { getTranslation } from '../lib/translations';

import BurgundyConstellationHero from './BurgundyConstellationHero';

export type DisabilityTab =
  | 'hub'
  | 'chat'
  | 'settings'
  | 'video'
  | 'studio'
  | 'bridge'
  | 'org'
  | 'motor'
  | 'vision'
  | 'radar'
  | 'neurodiversity'
  | 'learning'
  | 'caregiver'
  | 'deaf'
  | 'orchestrator';

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
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

/**
 * Auto-detects which suite an accessibility user should land in directly,
 * based on their chosen accessibilityMode (primary) or free-text
 * disabilityType (fallback for older profiles / non-standard entries).
 * Returns 'hub' (the card overview) when nothing maps cleanly — never guess
 * a suite the user didn't actually indicate.
 */
function detectDirectDisabilityTab(profile: UserProfile): DisabilityTab {
  // 1. If user explicitly clicked and chose a tab before, honor that manual choice!
  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('cognify_default_disability_tab') : null;
    if (saved === 'motor' || saved === 'neurodiversity' || saved === 'deaf' || saved === 'vision') {
      return saved as DisabilityTab;
    }
  } catch {}

  const mode = String(profile?.accessibilityMode || '').toLowerCase().trim();
  if (mode.includes('motor') || mode === 'speech') return 'motor';
  if (mode.includes('neuro') || mode.includes('cognitiv') || mode.includes('autis')) return 'neurodiversity';
  if (mode.includes('deaf') || mode.includes('sign') || mode.includes('hearing') || mode.includes('vocal')) return 'deaf';
  if (mode.includes('visu') || mode.includes('blind')) return 'vision';

  const freeText = String(profile?.disabilityType || '').toLowerCase().trim();
  if (/motor|euphonia|paraly|quadr|speech|als/.test(freeText)) return 'motor';
  if (/adhd|autis|dyslex|cognitiv|neurodiv|learning/.test(freeText)) return 'neurodiversity';
  if (/deaf|hearing|vocal|sign/.test(freeText)) return 'deaf';
  if (/visual|blind|vision|sight/.test(freeText)) return 'vision';

  return 'vision';
}

// Maps a suite tab to its category filter chip, so "Back to Hub" can re-open the
// hub pre-filtered to the single suite the user just left, instead of always
// dumping them into "All Suites" (7 cards) when they only ever use one.
function categoryForTab(tab: DisabilityTab): ModuleCategory {
  switch (tab) {
    case 'vision': return 'vision';
    case 'deaf': return 'hearing';
    case 'motor': return 'motor';
    case 'neurodiversity':
    case 'learning': return 'neuro';
    case 'caregiver': return 'caregiver';
    default: return 'all';
  }
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
  setProfile,
  isDarkMode,
  toggleTheme,
}, ref) {
  const [activeTab, setActiveTab] = useState<DisabilityTab>(() => detectDirectDisabilityTab(profile));
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [showVisualComfortModal, setShowVisualComfortModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ModuleCategory>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const isOrgStaff = !!profile?.isOrgManager && !!(profile?.organization || '').trim();

  // Tell parent which tab is active
  useEffect(() => { 
    onTabChange?.(activeTab); 
  }, [activeTab, onTabChange]);

  const lastProfileModeRef = useRef<string>(profile?.accessibilityMode || '');
  // Keep activeTab in sync with external profile accessibility mode updates ONLY
  useEffect(() => {
    const currentMode = profile?.accessibilityMode || '';
    if (currentMode && currentMode !== lastProfileModeRef.current) {
      lastProfileModeRef.current = currentMode;
      const directTab = detectDirectDisabilityTab(profile);
      setActiveTab(directTab);
    }
  }, [profile?.accessibilityMode, profile?.disabilityType]);

  // Set default suite persistently when user chooses a suite
  const handleSelectTab = React.useCallback((tab: DisabilityTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
    if (tab === 'vision' || tab === 'deaf' || tab === 'motor' || tab === 'neurodiversity') {
      try {
        localStorage.setItem('cognify_default_disability_tab', tab);
      } catch {}
      let newMode: AccessibilityMode | null = null;
      let newType: string | null = null;
      if (tab === 'vision') { newMode = 'Visual'; newType = 'Visual Impairment'; }
      else if (tab === 'deaf') { newMode = 'Vocal-Deaf'; newType = 'Hearing Impairment'; }
      else if (tab === 'motor') { newMode = 'Motor-Euphonia'; newType = 'Motor Impairment'; }
      else if (tab === 'neurodiversity') { newMode = 'Neurodiversity'; newType = 'Cognitive/Learning Disability'; }

      if (newMode) {
        lastProfileModeRef.current = newMode;
        if (profile?.uid && setProfile) {
          setProfile({ ...profile, accessibilityMode: newMode, disabilityType: newType || profile.disabilityType });
          setDoc(doc(db, `users/${profile.uid}`), cleanDataForFirestore({ accessibilityMode: newMode, disabilityType: newType }), { merge: true }).catch(() => {});
        }
      }
    }
  }, [profile, setProfile, onTabChange]);

  const handleNavigateBack = React.useCallback(() => {
    if (onNavigate) {
      onNavigate('chat');
    } else {
      onMenuClick();
    }
  }, [onNavigate, onMenuClick]);

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
    // 3. CROSS-DISABILITY SENSORY BRIDGE (UNIVERSAL MESH)
    {
      id: 'orchestrator' as const,
      category: 'hearing' as const,
      titleEn: 'Cross-Disability Sensory Bridge (Universal Mesh)',
      titleAr: 'جسر التواصل التبادلي بين الإعاقات (شبكة الحواس الشاملة)',
      shortEn: 'Sensory Bridge',
      shortAr: 'جسر الإعاقات',
      badgeEn: 'Blind ⇄ Deaf ⇄ Motor ⇄ Deaf-Blind',
      badgeAr: 'كفيف ⇄ أصم ⇄ شلل ⇄ كفيف-أصم',
      descEn: 'Direct bilateral peer-to-peer relay connecting blind & deaf students without human interpreters, tactile Morse haptic matrix for deaf-blind, and single-switch autonomic scanner for ALS.',
      descAr: 'جسر ثنائي مباشر للتواصل بين الكفيف والأصم بدون مترجم بشري، مصفوفة مورس بالاهتزاز اللمسي للصم-المكفوفين، والمسح الذكي بالمفتاح الفردي لمرضى التصلب والشلل ALS.',
      quickFeaturesAr: ['جسر كفيف ⇄ أصم فوري', 'مصفوفة مورس اللمسية بالاهتزاز', 'مسح المفتاح الفردي لشلل ALS', 'استغاثة SOS شاملة متعددة الحواس'],
      quickFeaturesEn: ['Blind ⇄ Deaf Bilateral Relay', 'Tactile Morse Haptics', 'Single-Switch ALS Scanner', 'Omni-Sensory SOS Beacon'],
      Icon: Sparkles,
      accentColor: 'text-cyan-400',
      borderGlow: 'hover:border-cyan-500/80 border-cyan-500/40 ring-1 ring-cyan-500/30',
      bgGlow: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40',
      buttonCls: 'bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 text-white shadow-cyan-500/25',
      matchingMode: 'Multiple',
    },
    // 4. MOTOR & ALS
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
      titleAr: 'واحة التوحد والاضطرابات النمائية',
      shortEn: 'Autism & Sensory',
      shortAr: 'التوحد والضبط الحسي',
      badgeEn: 'Autism Spectrum & Sensory Regulation',
      badgeAr: 'طيف التوحد والضبط الحسي',
      descEn: 'Visual PECS communication cards with speech synthesis, predictable daily routine schedules, and sensory regulation meter with automated server-side meltdown alerts.',
      descAr: 'بطاقات بيكس (PECS) للتواصل البصري المنطوق، جدول الروتين اليومي المنظم لتقليل القلق، ومقياس الضغط الحسي مع إشعار المرافق التلقائي عبر الخادم.',
      quickFeaturesAr: ['بطاقات PECS ناطقة ومخصصة', 'جدول الروتين اليومي المنظم', 'مقياس المشاعر وفقاعة التنفس 4-4-4', 'إشعار مبكر للأزمات لمقدم الرعاية'],
      quickFeaturesEn: ['Custom Spoken PECS Cards', 'Daily Predictability Routine', '4-4-4 Calming Breathing Bubble', 'Server Meltdown Caregiver Alert'],
      Icon: Brain,
      accentColor: 'text-purple-400',
      borderGlow: 'hover:border-purple-500/60 border-slate-800',
      bgGlow: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      buttonCls: 'bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 text-white shadow-purple-500/20',
      matchingMode: 'Neurodiversity',
    },
    // 5. ADAPTIVE LEARNING HUB & CURRICULUM
    {
      id: 'learning' as const,
      category: 'neuro' as const,
      titleEn: 'Adaptive Learning Hub (Curriculum)',
      titleAr: 'مركز المناهج والتعلّم التكيّفي',
      shortEn: 'Learning Hub',
      shortAr: 'المناهج الميسرة',
      badgeEn: 'Dyslexia & Learning Support',
      badgeAr: 'صعوبات التعلّم وعسر القراءة',
      descEn: 'Interactive multi-sensory curriculum for math, reading, writing, memory, and science with OpenDyslexic font support and parent dashboard.',
      descAr: 'مناهج تفاعلية متكيفة ومتعددة الحواس: رياضيات، قراءة، كتابة، ذاكرة، وعلوم، مع دعم خط عسر القراءة المخصص وتشجيع صوتي ولوحة متابعة للأهل.',
      quickFeaturesAr: ['7 مواد تفاعلية مهيأة', 'دعم خط عسر القراءة', 'تكييف الصعوبة الذكي', 'لوحة متابعة تقدم الأهل'],
      quickFeaturesEn: ['7 Adaptive Subjects', 'OpenDyslexic Font', 'Dynamic Level Adaptation', 'Parent Progress Tracker'],
      Icon: Sparkles,
      accentColor: 'text-amber-400',
      borderGlow: 'hover:border-amber-500/60 border-slate-800',
      bgGlow: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      buttonCls: 'bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 text-slate-950 shadow-yellow-500/20',
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

  // Whether a module card is the one the user's accessibilityMode actually lands them
  // in — kept in sync with detectDirectDisabilityTab's mapping (Speech -> motor,
  // Vocal-Deaf/Sign-Only -> deaf) so the "Active Mode" badge and quick-launch card
  // never point at a different suite than the one Speech/Deaf users are auto-routed to.
  const isModuleActiveForProfile = (m: (typeof MODULES)[number]) => {
    if (!profile.accessibilityMode || profile.accessibilityMode === 'None') return false;
    if (m.matchingMode === profile.accessibilityMode) return true;
    if (m.id === 'deaf' && (profile.accessibilityMode === 'Sign-Only' || profile.accessibilityMode === 'Vocal-Deaf')) return true;
    if (m.id === 'motor' && profile.accessibilityMode === 'Speech') return true;
    return false;
  };

  // Filter modules based on selectedCategory
  const filteredModules = useMemo(() => {
    if (selectedCategory === 'all') return MODULES;
    return MODULES.filter((m) => m.category === selectedCategory || (m.id === 'orchestrator' && (selectedCategory === 'vision' || selectedCategory === 'hearing' || selectedCategory === 'motor')));
  }, [selectedCategory, MODULES]);

  // Current active module metadata for sibling bar
  const currentModule = MODULES.find((m) => m.id === activeTab);
  const siblingModules = useMemo(() => {
    if (!currentModule || currentModule.category === 'caregiver') return [];
    return MODULES.filter((m) => m.category === currentModule.category);
  }, [currentModule, MODULES]);

  const isAr = profile.language === 'Arabic' || profile.language === 'Egyptian Ammiya';
  const isDeafActive = activeTab === 'deaf' || activeTab === 'radar' || activeTab === 'bridge';

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex-1 flex flex-col h-full bg-[#0d101d] text-slate-100 overflow-hidden relative select-none">
      
      {/* ── TOP NAVIGATION BAR ── */}
      {!isDeafActive && (
        <header className="relative z-[9995] px-4 py-2.5 sm:px-6 sm:py-3 shrink-0 flex items-center justify-between border-b border-slate-800 bg-[#121524]/95 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* Main App Menu Drawer Button */}
            <AriaButton
              onPress={() => {
                if (isAccessibilityUser(profile) || !onNavigate) onMenuClick();
                else onNavigate('chat');
              }}
              aria-label={isAccessibilityUser(profile)
                ? localize(profile.language, 'Open menu', 'افتح القائمة')
                : getTranslation(profile.language, 'back')}
              className="p-2 text-slate-400 bg-slate-900 border border-slate-800 hover:text-white hover:bg-slate-800 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer"
            >
              {isAccessibilityUser(profile)
                ? <Menu className="w-4 h-4" />
                : <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />}
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">
                {isAccessibilityUser(profile)
                  ? localize(profile.language, 'Menu', 'القائمة')
                  : getTranslation(profile.language, 'back')}
              </span>
            </AriaButton>

            {/* Primary Disability Mode Switcher: Instant, Uncluttered, Accessible */}
            <AriaRadioGroup
              value={((activeTab as string) === 'bridge' || (activeTab as string) === 'radar') ? 'deaf' : (activeTab as string)}
              onChange={(suiteId) => handleSelectTab(suiteId as DisabilityTab)}
              aria-label={localize(profile.language, 'Primary Accessibility Suites', 'منظومات الإتاحة الرئيسية')}
              orientation="horizontal"
              className="flex items-center bg-[#171E2E] border border-slate-800 p-1 rounded-2xl shadow-inner gap-1 outline-none"
            >
              {[
                { id: 'vision' as const, labelAr: 'بصرية', labelEn: 'Visual', Icon: Eye },
                { id: 'deaf' as const, labelAr: 'سمعية', labelEn: 'Hearing', Icon: Ear },
                { id: 'motor' as const, labelAr: 'حركية', labelEn: 'Motor', Icon: Activity },
                { id: 'neurodiversity' as const, labelAr: 'ذهنية', labelEn: 'Cognitive', Icon: Brain },
              ].map((suite) => (
                <AriaRadio
                  key={suite.id}
                  value={suite.id}
                  className={({ isSelected, isFocusVisible }) =>
                    `px-2.5 sm:px-3 min-h-[40px] py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer outline-none ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    } ${isFocusVisible ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900' : ''}`
                  }
                >
                  <suite.Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{localize(profile.language, suite.labelEn, suite.labelAr)}</span>
                </AriaRadio>
              ))}
            </AriaRadioGroup>
          </div>

          {/* Right Header Status / Sibling Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sibling module pills when inside a suite */}
            {activeTab !== 'hub' && siblingModules.length > 1 ? (
              <AriaRadioGroup
                value={activeTab as string}
                onChange={(mId) => setActiveTab(mId as DisabilityTab)}
                aria-label={localize(profile.language, 'Suite Sub-modules', 'أقسام المنظومة')}
                orientation="horizontal"
                className="flex items-center bg-[#171E2E] border border-slate-800 p-1 rounded-xl max-w-[280px] sm:max-w-md overflow-x-auto custom-scrollbar gap-1 outline-none"
              >
                {siblingModules.map((m) => (
                  <AriaRadio
                    key={m.id}
                    value={m.id}
                    className={({ isSelected, isFocusVisible }) =>
                      `px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer outline-none ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                          : 'text-slate-300 hover:text-white'
                      } ${isFocusVisible ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900' : ''}`
                    }
                  >
                    <span
                      title={localize(profile.language, m.titleEn, m.titleAr)}
                      className="flex items-center gap-1.5"
                    >
                      <m.Icon className="w-3.5 h-3.5" />
                      <span>{localize(profile.language, m.shortEn, m.shortAr)}</span>
                    </span>
                  </AriaRadio>
                ))}
              </AriaRadioGroup>
            ) : (
              /* On Hub: show visual comfort button, passport button & settings */
              <div className="flex items-center gap-2">
                <AriaButton
                  onPress={() => setShowVisualComfortModal(true)}
                  aria-label={localize(profile.language, 'Visual Comfort & Dyslexia Tools', 'أدوات الراحة البصرية وتيسير القراءة')}
                  className="px-3.5 min-h-[44px] py-2 rounded-xl bg-[#171E2E] border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 transition-all text-xs font-bold flex items-center gap-2 shadow-md active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>{localize(profile.language, 'Visual Comfort', 'الراحة البصرية')}</span>
                </AriaButton>
                <AriaButton
                  onPress={() => setShowPassportModal(true)}
                  aria-label={localize(profile.language, 'Universal Accessibility Passport', 'جواز السفر الميسر الشامل')}
                  className="px-3.5 min-h-[44px] py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-indigo-500/20 border border-amber-500/40 text-amber-200 hover:text-white hover:bg-amber-500/30 transition-all text-xs font-bold flex items-center gap-2 shadow-md active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  <span>{localize(profile.language, 'Accommodation Passport', 'جواز السفر الميسر')}</span>
                </AriaButton>
                <AriaButton
                  onPress={() => setActiveTab('settings')}
                  aria-label={localize(profile.language, 'Settings & Languages', 'الإعدادات واللغات')}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300 hover:text-white bg-[#171E2E] border border-slate-800 rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                </AriaButton>
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
          {/* ═════════════════════════════════════════════════════════════════════
              VIEW: CLEAN DIRECT ACCESSIBILITY SUITE SELECTOR (NO CARD CLUTTER)
             ═════════════════════════════════════════════════════════════════════ */}
          {/* ═════════════════════════════════════════════════════════════════════
              VIEW: ROYAL BURGUNDY CONSTELLATION HERO & ASSISTIVE SUITES HUB
             ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'hub' && (
            <motion.div
              key="hub-burgundy-showcase"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col items-center overflow-y-auto p-4 sm:p-6 select-none custom-scrollbar"
            >
              <div className="max-w-4xl w-full space-y-6">
                {/* 1. Royal Burgundy & Gold Constellation Hero Showcase */}
                <BurgundyConstellationHero
                  profile={profile}
                  onLaunchPrimary={() => {
                    const target = detectDirectDisabilityTab(profile);
                    handleSelectTab(target);
                  }}
                  onExploreModes={() => {
                    const el = document.getElementById('suites-grid');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  onSelectSuite={(suiteId) => handleSelectTab(suiteId)}
                  isDarkMode={isDarkMode}
                  toggleTheme={toggleTheme}
                />

                {/* 2. Direct Assistive Suites Grid */}
                <div id="suites-grid" className="pt-2">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{localize(profile.language, 'Dedicated Assistive Suites', 'منظومات التيسير المتخصصة')}</span>
                    </h3>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {localize(profile.language, 'Select to launch immediately', 'اختر منظومة للتشغيل الفوري')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-start">
                    {[
                      { id: 'vision' as const, labelAr: 'المرافق البصري الذكي', labelEn: 'Visual Companion', Icon: Eye, descAr: 'قراءة النصوص، العملات، الملابس، وسكانر المحاضرات', descEn: 'AI Eyes, currency, colors & lecture scan', glow: 'hover:border-rose-500/60 hover:shadow-rose-950/40', iconColor: 'text-rose-400', iconBg: 'bg-rose-500/15 border-rose-500/30' },
                      { id: 'deaf' as const, labelAr: 'منظومة الصم المتكاملة', labelEn: 'Deaf Ecosystem', Icon: Ear, descAr: 'استوديو الإشارة 3D، رادار الأصوات، وجسر التواصل', descEn: '3D Sign Avatar, Sound Sentinel & Live Bridge', glow: 'hover:border-amber-500/60 hover:shadow-amber-950/40', iconColor: 'text-amber-400', iconBg: 'bg-amber-500/15 border-amber-500/30' },
                      { id: 'motor' as const, labelAr: 'التحكم الحركي وإيفونيا', labelEn: 'Motor & Euphonia', Icon: Activity, descAr: 'تتبع الرأس والعين، لوحة الرمش، و SOS الطوارئ', descEn: 'Head pointer, eye-blink AAC & 4s GPS SOS', glow: 'hover:border-amber-500/60 hover:shadow-amber-950/40', iconColor: 'text-amber-300', iconBg: 'bg-amber-500/15 border-amber-500/30' },
                      { id: 'neurodiversity' as const, labelAr: 'التنوع العصبي والتوحد', labelEn: 'Neurodiversity Hub', Icon: Brain, descAr: 'بطاقات PECS الناطقة، الروتين، ومسطرة القراءة', descEn: 'Spoken PECS cards, routines & calm bubble', glow: 'hover:border-purple-500/60 hover:shadow-purple-950/40', iconColor: 'text-purple-400', iconBg: 'bg-purple-500/15 border-purple-500/30' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleSelectTab(s.id)}
                        className={`p-4 min-h-[140px] rounded-2xl bg-[#171E2E] border border-slate-700/80 ${s.glow} hover:bg-slate-800/80 transition-all active:scale-[0.98] shadow-md group flex flex-col justify-between cursor-pointer`}
                      >
                        <div>
                          <div className={`w-9 h-9 rounded-xl ${s.iconBg} border flex items-center justify-center ${s.iconColor} mb-2.5 group-hover:scale-105 transition-transform`}>
                            <s.Icon className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-black text-white group-hover:text-amber-300 block transition-colors">{localize(profile.language, s.labelEn, s.labelAr)}</span>
                          <span className="text-[11px] text-slate-300 block mt-1 leading-relaxed font-normal">{localize(profile.language, s.descEn, s.descAr)}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-amber-400 opacity-90 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                          <span>{localize(profile.language, 'Launch Suite', 'دخول المنظومة')}</span>
                          <ChevronRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
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
              <React.Suspense fallback={
                <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <MotorEuphoniaView profile={profile} />
              </React.Suspense>
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
              <React.Suspense fallback={
                <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <VisionCompanionView profile={profile} setProfile={setProfile} />
              </React.Suspense>
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
              <React.Suspense fallback={
                <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <DeafEcosystemView
                  profile={profile}
                  initialTab={activeTab === 'deaf' ? 'bridge' : (activeTab as any)}
                  onNavigateBack={handleNavigateBack}
                  onMenuClick={onMenuClick}
                  onTabChange={(tool) => {
                    setActiveTab(tool);
                    onTabChange?.(tool);
                  }}
                />
              </React.Suspense>
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
              <React.Suspense fallback={
                <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <NeurodiversityHub
                  profile={profile}
                  onNavigateBack={handleNavigateBack}
                  onOpenLearningHub={() => handleSelectTab('learning')}
                />
              </React.Suspense>
            </motion.div>
          )}

          {activeTab === 'learning' && (
            <motion.div
              key="learning-hub-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full min-h-0 overflow-y-auto custom-scrollbar"
            >
              <React.Suspense fallback={
                <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <LearningHub
                  profile={profile}
                  onNavigateBack={handleNavigateBack}
                  onMenuClick={onMenuClick}
                />
              </React.Suspense>
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
              <React.Suspense fallback={
                <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
                  <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <CaregiverHub
                  profile={profile}
                  onNavigateBack={handleNavigateBack}
                  setProfile={setProfile}
                  onOpenPassport={() => setShowPassportModal(true)}
                />
              </React.Suspense>
            </motion.div>
          )}

          {activeTab === 'orchestrator' && (
            <motion.div
              key="orchestrator-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full min-h-0"
            >
              <React.Suspense fallback={
                <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <CrossDisabilityOrchestrator
                  profile={profile}
                  onNavigateBack={handleNavigateBack}
                  onMenuClick={onMenuClick}
                />
              </React.Suspense>
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
              <React.Suspense fallback={
                <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <OrgDashboard profile={profile} />
              </React.Suspense>
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
                <React.Suspense fallback={
                  <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
                    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                }>
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
                </React.Suspense>
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

      {/* Universal Visual Comfort & Dyslexia Modal */}
      <VisualComfortModal
        isOpen={showVisualComfortModal}
        onClose={() => setShowVisualComfortModal(false)}
        language={profile.language}
      />
    </div>
  );
});

export default DisabilityModeView;
