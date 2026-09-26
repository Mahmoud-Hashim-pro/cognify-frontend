import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from './Toast';
import { UserProfile } from '../types';
import { localize, isArabicLocale } from '../lib/translations';
import { speak, cancelSpeech } from '../lib/tts';
import { triggerHapticAlert } from '../lib/hapticNavEngine';
import { generateAdaptiveResponse } from '../services/gemini';
import { 
  Volume2, 
  Mic, 
  Square, 
  Play, 
  MessageSquare, 
  UserCheck, 
  Stethoscope, 
  GraduationCap, 
  Store, 
  AlertOctagon, 
  Copy, 
  Download, 
  Trash2, 
  Hand, 
  Sparkles, 
  Check, 
  Clock, 
  RefreshCw,
  Send,
  Brain,
  HelpCircle,
  Activity,
  Sliders,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Layers,
  X
} from 'lucide-react';

const SignAvatar3D = React.lazy(() => import('./SignAvatar3D'));

interface HumanCommunicationBridgeProps {
  profile: UserProfile;
}

interface DialogueMessage {
  id: string;
  sender: 'user' | 'partner' | 'ai';
  text: string;
  timestamp: string;
}

type AACCategory = 'medical' | 'academic' | 'daily' | 'emergency';
type ActiveMode = 'bridge' | 'ai-tutor';

export default function HumanCommunicationBridge({ profile }: HumanCommunicationBridgeProps) {
  // Dialect / Language preference
  const [voiceDialect, setVoiceDialect] = useState<string>(profile.language || 'Egyptian Ammiya');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [activeAacCategory, setActiveAacCategory] = useState<AACCategory>('medical');
  const [activeMode, setActiveMode] = useState<ActiveMode>('bridge');
  const [showAacDrawer, setShowAacDrawer] = useState<boolean>(false);
  const [showFullTimeline, setShowFullTimeline] = useState<boolean>(false);

  // Multi-language booleans
  const isArabic = isArabicLocale(voiceDialect);
  const isEgyptian = voiceDialect === 'Egyptian Ammiya';
  const isFrench = voiceDialect === 'French';
  const isEnglish = voiceDialect === 'English';

  // Locale code for Web Speech Recognition
  const speechRecognitionLocale = useMemo(() => {
    if (isEgyptian) return 'ar-EG';
    if (isArabic) return 'ar-SA';
    if (isFrench) return 'fr-FR';
    return 'en-US';
  }, [isEgyptian, isArabic, isFrench]);

  // ── LOCALIZED UI LABELS ──
  const t = {
    title: isEgyptian
      ? 'منظومة لغة الإشارة والتواصل الذكية'
      : isArabic
      ? 'منظومة لغة الإشارة والتواصل الذكية'
      : isFrench
      ? 'Hub Intelligent de Langue des Signes & Communication'
      : 'Smart 3D Sign & Human Communication Hub',
    subtitle: isEgyptian
      ? 'ترجمة فورية ثنائية: كلام المتحدث يتحول لأفاتار 3D، وإشاراتك وكتابتك تُنطق بصوت طبيعي.'
      : isArabic
      ? 'ترجمة فورية ثنائية: كلام المتحدث يتحول لأفاتار 3D، وإشاراتك وكتابتك تُنطق بصوت طبيعي.'
      : isFrench
      ? 'Traduction bidirectionnelle : la parole devient un avatar 3D, vos signes et textes sont parlés à voix haute.'
      : 'Real-time two-way bridge: Partner speech becomes 3D sign avatar, your signs/text speak out loud naturally.',
    modeBridge: isArabic ? '💬 محادثة مباشرة مع متحدث' : isFrench ? '💬 Pont Direct avec Interlocuteur' : '💬 Two-Way Live Bridge',
    modeAiTutor: isArabic ? '🤖 معلم الذكاء الاصطناعي والإشارة' : isFrench ? '🤖 Tuteur IA & Langue des Signes' : '🤖 AI Sign Tutor & Explainer',
    sideAHeader: isArabic ? 'أنا أتحدث (صوتي للغرفة)' : isFrench ? 'Ma Voix (Je m\'exprime)' : 'My Voice (Speaking to Room)',
    sideBHeader: isArabic ? 'الطرف الآخر يتحدث (استماع وإشارة)' : isFrench ? 'Interlocuteur (Parole ➔ Signes)' : 'Partner Speaking (Voice ➔ 3D Sign)',
    gestureTitle: isArabic ? 'إيماءات إشارية فورية بنطق صوتي:' : isFrench ? 'Gestes rapides avec voix naturelle :' : 'Instant Sign-to-Voice Gestures:',
    typePlaceholder: isEgyptian
      ? 'اكتب ما تريد قوله واضغط Enter للنطق للغرفة...'
      : isArabic
      ? 'اكتب ما تريد قوله واضغط Enter للنطق للغرفة...'
      : isFrench
      ? 'Tapez votre message et appuyez sur Entrée pour parler...'
      : 'Type what you want to say and press Enter to speak aloud...',
    speakBtn: isArabic ? 'انطق للغرفة (Enter)' : isFrench ? 'Parler dans la pièce (Entrée)' : 'Speak to Room (Enter)',
    signBtn: isArabic ? 'محاكاة الإشارة 3D' : isFrench ? 'Signer sur Avatar' : 'Sign on Avatar',
    askAiPlaceholder: isEgyptian
      ? 'اسأل الذكاء الاصطناعي أي سؤال دراسي أو عام ليشرحه بلغة الإشارة والصوت...'
      : isArabic
      ? 'اسأل الذكاء الاصطناعي أي سؤال علمي أو استفسار ليشرحه بالإشارة والصوت...'
      : isFrench
      ? 'Posez une question à l\'IA pour une explication en langue des signes et audio...'
      : 'Ask AI any question for a 3D sign language and vocal explanation...',
    askAiBtn: isArabic ? 'اسأل واعرض بالإشارة والصوت' : isFrench ? 'Demander & Signer' : 'Ask & Sign Explanation',
    aiThinking: isArabic ? 'جاري استحضار الإجابة وترجمتها للإشارة...' : isFrench ? 'L\'IA réfléchit et prépare la langue des signes...' : 'AI thinking & preparing sign translation...',
    listenBtnStart: isArabic ? 'بدء الاستماع للمتحدث (تحويل لإشارة)' : isFrench ? 'Écouter l\'interlocuteur (➔ Signes)' : 'Start Listening to Partner (➔ Sign)',
    listenBtnStop: isArabic ? 'إيقاف الاستماع للمتحدث' : isFrench ? 'Arrêter l\'écoute' : 'Stop Listening',
    listeningActive: isArabic ? 'المايك يستمع للمتحدث الآن...' : isFrench ? 'Microphone à l\'écoute de l\'interlocuteur...' : 'Microphone listening to partner...',
    partnerPlaceholder: isArabic ? 'اضغط على الزر أدناه لبدء الاستماع للمتحدث' : isFrench ? 'Cliquez ci-dessous pour écouter votre interlocuteur' : 'Click below to listen to your partner',
    timelineTitle: isArabic ? 'سجل المحادثة الحية المزدوجة' : isFrench ? 'Historique du Dialogue en Direct' : 'Two-Way Live Dialogue Timeline',
    copy: isArabic ? 'نسخ' : isFrench ? 'Copier' : 'Copy',
    saveTxt: isArabic ? 'حفظ TXT' : isFrench ? 'Télécharger TXT' : 'Save TXT',
    clear: isArabic ? 'مسح' : isFrench ? 'Effacer' : 'Clear',
    meTag: isArabic ? 'أنا (إشارة/نص)' : isFrench ? 'Moi (Signes/Texte)' : 'Me (Sign/Text)',
    partnerTag: isArabic ? 'المتحدث (صوت)' : isFrench ? 'Interlocuteur (Voix)' : 'Partner (Voice)',
    aiTag: isArabic ? 'المعلم الذكي (AI)' : isFrench ? 'Tuteur IA' : 'AI Tutor',
    speed: isArabic ? 'السرعة:' : isFrench ? 'Vitesse :' : 'Speed:',
  };

  // ── MULTILINGUAL QUICK SIGN GESTURES ──
  const QUICK_GESTURES = useMemo(() => [
    {
      icon: '👍',
      label: isArabic ? 'نعم / تمام' : isFrench ? 'Oui / D\'accord' : 'Yes / OK',
      text: isEgyptian ? 'تمام وموافق جداً' : isArabic ? 'نعم، أوافق على ذلك' : isFrench ? 'Oui, je suis d\'accord avec cela.' : 'Yes, I completely agree.',
    },
    {
      icon: '👎',
      label: isArabic ? 'لا / معترض' : isFrench ? 'Non / Refus' : 'No / Disagree',
      text: isEgyptian ? 'لأ، مش موافق خالص' : isArabic ? 'لا، لست موافقاً على هذا' : isFrench ? 'Non, je ne suis pas d\'accord.' : 'No, I disagree with this.',
    },
    {
      icon: '🙏',
      label: isArabic ? 'شكراً جزيلاً' : isFrench ? 'Merci beaucoup' : 'Thank You',
      text: isEgyptian ? 'شكراً جزيلاً يا باشا' : isArabic ? 'شكراً جزيلاً لك على مساعدتك' : isFrench ? 'Merci beaucoup pour votre aide !' : 'Thank you very much for your help!',
    },
    {
      icon: '🤟',
      label: isArabic ? 'أنا أصم' : isFrench ? 'Je suis sourd' : 'I am Deaf',
      text: isEgyptian ? 'أنا أصم وأتحدث بلغة الإشارة' : isArabic ? 'أنا شخص أصم وأتواصل بلغة الإشارة' : isFrench ? 'Je suis sourd et je communique en langue des signes.' : 'I am deaf and communicate using sign language.',
    },
    {
      icon: '⏳',
      label: isArabic ? 'لحظة واحدة' : isFrench ? 'Un instant' : 'One Moment',
      text: isEgyptian ? 'لحظة واحدة من فضلك' : isArabic ? 'لحظة واحدة لو سمحت' : isFrench ? 'Un instant s\'il vous plaît.' : 'One moment please.',
    },
    {
      icon: '❓',
      label: isArabic ? 'أين المكان؟' : isFrench ? 'Où est-ce ?' : 'Where is it?',
      text: isEgyptian ? 'فين المكان ده لو سمحت؟' : isArabic ? 'أين يقع هذا المكان لو سمحت؟' : isFrench ? 'Où se trouve cet endroit s\'il vous plaît ?' : 'Excuse me, where is this located?',
    },
  ], [isEgyptian, isArabic, isFrench]);

  // ── MULTILINGUAL SCENARIO AAC PACKS ──
  const AAC_CATEGORIES: Record<AACCategory, {
    label: string;
    icon: any;
    color: string;
    phrases: { text: string; icon: string }[];
  }> = useMemo(() => ({
    medical: {
      label: isArabic ? 'كشف طبي وأعراض 🩺' : isFrench ? 'Consultation Médicale 🩺' : 'Medical & Clinic 🩺',
      icon: Stethoscope,
      color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
      phrases: isEgyptian ? [
        { text: 'عندي ألم شديد في الجزء ده', icon: '🤕' },
        { text: 'عندي حساسية من أدوية معينة', icon: '⚠️' },
        { text: 'محتاج قياس الضغط والسكر لو سمحت', icon: '🩺' },
        { text: 'ممكن تكتب لي الروشتة بخط واضح؟', icon: '📝' },
        { text: 'أنا لا أسمع، أرجو التحدث بهدوء أو الكتابة', icon: '🤟' },
        { text: 'كم مرة في اليوم أتناول العلاج ده؟', icon: '💊' },
        { text: 'هل في أي آثار جانبية للدواء؟', icon: 'ℹ️' },
        { text: 'شكراً يا دكتور، طمنتني جداً', icon: '🙏' },
      ] : isArabic ? [
        { text: 'أشعر بألم في هذا الموضع', icon: '🤕' },
        { text: 'أعاني من حساسية تجاه بعض الأدوية', icon: '⚠️' },
        { text: 'أحتاج فحص ضغط الدم ونسبة السكر', icon: '🩺' },
        { text: 'لو سمحت اكتب الوصفة الطبية بخط واضح', icon: '📝' },
        { text: 'أنا أصم، أرجو الكتابة على الورق أو الشاشة', icon: '🤟' },
        { text: 'كم جرعة أتناولها يومياً من هذا الدواء؟', icon: '💊' },
        { text: 'هل توجد أي أعراض جانبية متوقعة؟', icon: 'ℹ️' },
        { text: 'شكراً جزيلاً لك يا دكتور', icon: '🙏' },
      ] : isFrench ? [
        { text: 'J\'ai une forte douleur à cet endroit', icon: '🤕' },
        { text: 'Je suis allergique à certains médicaments', icon: '⚠️' },
        { text: 'Pouvez-vous mesurer ma tension et glycémie svp ?', icon: '🩺' },
        { text: 'Veuillez écrire l\'ordonnance clairement svp', icon: '📝' },
        { text: 'Je suis sourd, veuillez écrire sur l\'écran', icon: '🤟' },
        { text: 'Combien de fois par jour dois-je prendre ce traitement ?', icon: '💊' },
        { text: 'Y a-t-il des effets secondaires prévus ?', icon: 'ℹ️' },
        { text: 'Merci docteur, c\'est très rassurant', icon: '🙏' },
      ] : [
        { text: 'I feel severe pain in this area', icon: '🤕' },
        { text: 'I have allergies to certain medications', icon: '⚠️' },
        { text: 'Please check my blood pressure and glucose', icon: '🩺' },
        { text: 'Could you write down the prescription clearly?', icon: '📝' },
        { text: 'I am deaf, please type or write on screen', icon: '🤟' },
        { text: 'How many times a day should I take this medicine?', icon: '💊' },
        { text: 'Are there any expected side effects?', icon: 'ℹ️' },
        { text: 'Thank you doctor, that is very helpful', icon: '🙏' },
      ],
    },
    academic: {
      label: isArabic ? 'جامعة ومحاضرات 🎓' : isFrench ? 'Université & Cours 🎓' : 'University & Lectures 🎓',
      icon: GraduationCap,
      color: 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10',
      phrases: isEgyptian ? [
        { text: 'عندي سؤال بخصوص نقطة البحث يا دكتور', icon: '🙋‍♂️' },
        { text: 'ممكن إعادة النقطة الأخيرة بطريقة أبسط؟', icon: '🔄' },
        { text: 'هل الجزئية دي داخلة في امتحان الميدتيرم؟', icon: '❓' },
        { text: 'محتاج ورقة الأسئلة مطبوعة أو مكتوبة', icon: '📄' },
        { text: 'ممكن تسجيل المحاضرة أو تفريغها نصياً؟', icon: '🎙️' },
        { text: 'تمام جداً، فهمت الفكرة تماماً!', icon: '✅' },
      ] : isArabic ? [
        { text: 'عندي استفسار عن نقطة في المحاضرة', icon: '🙋‍♂️' },
        { text: 'ممكن إعادة الشرح بطريقة أكثر بساطة؟', icon: '🔄' },
        { text: 'هل هذا الفصل متضمن في الامتحان النهائي؟', icon: '❓' },
        { text: 'أحتاج ورقة الأسئلة مكتوبة من فضلك', icon: '📄' },
        { text: 'شكراً جزيلاً لك، اتضحت الفكرة', icon: '✅' },
      ] : isFrench ? [
        { text: 'J\'ai une question sur ce point de recherche', icon: '🙋‍♂️' },
        { text: 'Pouvez-vous réexpliquer cela plus simplement ?', icon: '🔄' },
        { text: 'Ce chapitre fait-il partie de l\'examen ?', icon: '❓' },
        { text: 'J\'ai besoin de la feuille d\'examen par écrit svp', icon: '📄' },
        { text: 'Est-il possible d\'avoir la transcription écrite ?', icon: '🎙️' },
        { text: 'Très bien compris, merci beaucoup professeur !', icon: '✅' },
      ] : [
        { text: 'I have a question regarding this research topic', icon: '🙋‍♂️' },
        { text: 'Could you explain this part in simpler terms please?', icon: '🔄' },
        { text: 'Is this section included in the upcoming exam?', icon: '❓' },
        { text: 'I need the exam questions sheet in written format', icon: '📄' },
        { text: 'Could you provide lecture notes or transcripts?', icon: '🎙️' },
        { text: 'Understood completely, thank you professor!', icon: '✅' },
      ],
    },
    daily: {
      label: isArabic ? 'مصالح وتعاملات يومية 🏪' : isFrench ? 'Vie Quotidienne & Services 🏪' : 'Daily Life & Services 🏪',
      icon: Store,
      color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
      phrases: isEgyptian ? [
        { text: 'أين أقرب محطة مترو أو صيدلية؟', icon: '🚇' },
        { text: 'بكم سعر الحاجة دي لو سمحت؟', icon: '💵' },
        { text: 'عايز أشتري ده، الدفع كاش ولا فيزا؟', icon: '💳' },
        { text: 'لو سمحت اكتب لي التفاصيل على الموبايل', icon: '📱' },
        { text: 'أنا بستخدم لغة الإشارة للتواصل', icon: '🤟' },
        { text: 'شكراً جزيلاً، يومك جميل وسعيد!', icon: '✨' },
      ] : isArabic ? [
        { text: 'أين أجد أقرب محطة قطار أو صيدلية؟', icon: '🚇' },
        { text: 'كم سعر هذا المنتج من فضلك؟', icon: '💵' },
        { text: 'أود شراء هذا، هل تقبلون البطاقة؟', icon: '💳' },
        { text: 'أرجو كتابة العنوان والتفاصيل هنا', icon: '📱' },
        { text: 'أنا أستخدم لغة الإشارة للتواصل', icon: '🤟' },
        { text: 'شكراً جزيلاً، طاب يومك!', icon: '✨' },
      ] : isFrench ? [
        { text: 'Où se trouve la station de métro ou pharmacie la plus proche ?', icon: '🚇' },
        { text: 'Combien coûte cet article s\'il vous plaît ?', icon: '💵' },
        { text: 'Je voudrais acheter ceci, acceptez-vous la carte ?', icon: '💳' },
        { text: 'Veuillez écrire les détails sur mon téléphone svp', icon: '📱' },
        { text: 'J\'utilise la langue des signes pour communiquer', icon: '🤟' },
        { text: 'Merci beaucoup, passez une très bonne journée !', icon: '✨' },
      ] : [
        { text: 'Where is the nearest metro station or pharmacy?', icon: '🚇' },
        { text: 'How much does this item cost please?', icon: '💵' },
        { text: 'I would like to buy this, do you accept cards?', icon: '💳' },
        { text: 'Please write the details on my phone screen', icon: '📱' },
        { text: 'I use sign language to communicate', icon: '🤟' },
        { text: 'Thank you very much, have a wonderful day!', icon: '✨' },
      ],
    },
    emergency: {
      label: isArabic ? 'طوارئ واستغاثة 🚨' : isFrench ? 'Urgences & Secours 🚨' : 'Urgent & Emergency 🚨',
      icon: AlertOctagon,
      color: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
      phrases: isEgyptian ? [
        { text: 'أنا محتاج مساعدة عاجلة فوراً!', icon: '🚨' },
        { text: 'اتصل بالإسعاف أو النجدة لو سمحت!', icon: '🚑' },
        { text: 'فقدت المحفظة والموبايل بتاعي', icon: '🔍' },
        { text: 'أنا أصم ولا أسمع، رجاءً قف بجانبي', icon: '🤝' },
        { text: 'أحتاج طبيب أو مترجم لغة إشارة', icon: '👨‍⚕️' },
      ] : isArabic ? [
        { text: 'أحتاج مساعدة عاجلة من فضلك!', icon: '🚨' },
        { text: 'اتصل بالإسعاف فوراً لو سمحت!', icon: '🚑' },
        { text: 'فقدت متعلقاتي الشخصية', icon: '🔍' },
        { text: 'أنا شخص أصم، أرجو مساعدتي فوراً', icon: '🤝' },
      ] : isFrench ? [
        { text: 'J\'ai besoin d\'une aide urgente immédiatement !', icon: '🚨' },
        { text: 'Appelez les secours ou une ambulance svp !', icon: '🚑' },
        { text: 'J\'ai perdu mes affaires personnelles et téléphone', icon: '🔍' },
        { text: 'Je suis sourd et je n\'entends pas, restez avec moi svp', icon: '🤝' },
        { text: 'J\'ai besoin d\'un médecin ou interprète en langue des signes', icon: '👨‍⚕️' },
      ] : [
        { text: 'I need urgent assistance immediately!', icon: '🚨' },
        { text: 'Please call an ambulance or police!', icon: '🚑' },
        { text: 'I lost my phone and personal belongings', icon: '🔍' },
        { text: 'I am deaf and cannot hear, please stay with me to help', icon: '🤝' },
        { text: 'I urgently need a doctor or sign language interpreter', icon: '👨‍⚕️' },
      ],
    },
  }), [isEgyptian, isArabic, isFrench]);

  // States
  const [inputText, setInputText] = useState('');
  const [isSpeakingOut, setIsSpeakingOut] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [sequence, setSequence] = useState<string[]>(['أهلا', 'بك']);
  const [isListeningPartner, setIsListeningPartner] = useState(false);
  const [partnerTranscript, setPartnerTranscript] = useState('');
  const [partnerSignSequence, setPartnerSignSequence] = useState<string[]>([]);
  const [isPartnerSigning, setIsPartnerSigning] = useState(false);

  // AI Tutor state
  const [aiQuestion, setAiQuestion] = useState('');
  const [isAiAnswering, setIsAiAnswering] = useState(false);
  const [aiAnswerText, setAiAnswerText] = useState('');

  const [dialogueLog, setDialogueLog] = useState<DialogueMessage[]>([
    {
      id: 'msg-init-1',
      sender: 'user',
      text: isArabic
        ? 'مرحباً، أنا أستخدم جسر التواصل الذكي للتحدث معك.'
        : isFrench
        ? 'Bonjour, j\'utilise le pont de communication pour vous parler.'
        : 'Hello, I am using the smart communication bridge to speak with you.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const recognitionRef = useRef<any>(null);
  const dialogueEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogueEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogueLog]);

  // 1. Speak aloud user's text to the hearing partner
  const handleSpeakToRoom = (overrideText?: string) => {
    const textToSpeak = (overrideText || inputText).trim();
    if (!textToSpeak) return;

    setIsSpeakingOut(true);
    triggerHapticAlert('single-pulse');

    const newMsg: DialogueMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: textToSpeak,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setDialogueLog((prev) => [...prev, newMsg]);

    speak(textToSpeak, voiceDialect, {
      rate: speechRate,
      onStart: () => setIsSpeakingOut(true),
      onEnd: () => setIsSpeakingOut(false),
      onError: (reason) => {
        setIsSpeakingOut(false);
        toast.error(isArabic ? '⚠️ تعذر النطق الصوتي' : isFrench ? '⚠️ Erreur de synthèse vocale' : '⚠️ Speech output error');
      },
    });

    if (!overrideText) {
      setInputText('');
    }
  };

  // 2. Animate 3D Sign Language avatar for given text
  const handleSignText = (overrideText?: string) => {
    const text = (overrideText || inputText).trim();
    if (!text) return;
    const words = text.split(/\s+/).filter(Boolean);
    setSequence(words);
    setIsSigning(true);
    triggerHapticAlert('single-pulse');
  };

  // 3. Ask AI Tutor (Sign & Explain)
  const handleAskAiTutor = async () => {
    const q = aiQuestion.trim();
    if (!q || isAiAnswering) return;

    setIsAiAnswering(true);
    triggerHapticAlert('single-pulse');

    const prompt = `You are Cognify's specialized Deaf & Hard of Hearing Adaptive Tutor.
Answer this student question clearly, visually, and concisely in the requested language: "${voiceDialect}".
Explain the core concept in 2-3 clear sentences so it can be easily signed by a 3D Sign Language Avatar:
Question: "${q}"`;

    try {
      const response = await generateAdaptiveResponse(
        prompt,
        {
          ...profile,
          language: voiceDialect as any,
        },
        []
      );

      setAiAnswerText(response);
      const words = response.replace(/[^\w\u0600-\u06FF\s]/g, ' ').split(/\s+/).filter(Boolean);
      setSequence(words);
      setIsSigning(true);

      // Append to dialogue timeline
      const aiMsg: DialogueMessage = {
        id: 'ai-' + Date.now(),
        sender: 'ai',
        text: `[Q: ${q}] → ${response}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setDialogueLog((prev) => [...prev, aiMsg]);

      // Speak aloud explanation as well
      speak(response, voiceDialect, { rate: speechRate });
      toast.success(isArabic ? 'تمت الإجابة والترجمة للغة الإشارة' : isFrench ? 'Réponse générée et signée' : 'Answer generated & signed');
    } catch (e) {
      toast.error(isArabic ? 'تعذر الحصول على إجابة' : 'Failed to generate answer');
    } finally {
      setIsAiAnswering(false);
      setAiQuestion('');
    }
  };

  // 4. Partner speaking into mic -> Live Speech to Sign translation
  const togglePartnerListening = () => {
    if (isListeningPartner) {
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      setIsListeningPartner(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error(isArabic ? "المتصفح لا يدعم ميزة تحويل الصوت إلى نص" : isFrench ? "Reconnaissance vocale non supportée" : "Browser does not support Speech Recognition");
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = speechRecognitionLocale;

      rec.onresult = (event: any) => {
        let transcript = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          transcript += chunk;
          if (event.results[i].isFinal) finalText += chunk;
        }
        setPartnerTranscript(transcript);

        const words = finalText.trim().split(/\s+/).filter(Boolean);
        if (words.length > 0) {
          setPartnerSignSequence(words);
          setIsPartnerSigning(true);
          triggerHapticAlert('double-pulse');

          const partnerMsg: DialogueMessage = {
            id: 'partner-' + Date.now(),
            sender: 'partner',
            text: finalText.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setDialogueLog((prev) => [...prev, partnerMsg]);
        }
      };

      rec.onerror = () => setIsListeningPartner(false);
      rec.onend = () => setIsListeningPartner(false);
      rec.start();
      recognitionRef.current = rec;
      setIsListeningPartner(true);
      triggerHapticAlert('single-pulse');
    } catch (e) {
      console.error("Partner speech recognition error", e);
      setIsListeningPartner(false);
    }
  };

  // Export full transcript as text file
  const handleExportTranscript = () => {
    const lines = dialogueLog.map((m) => `[${m.timestamp}] ${
      m.sender === 'user' ? t.meTag : m.sender === 'partner' ? t.partnerTag : t.aiTag
    }: ${m.text}`);
    const content = lines.join('\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cognify_Deaf_Bridge_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isArabic ? 'تم حفظ سجل المحادثة بنجاح' : isFrench ? 'Historique téléchargé' : 'Transcript saved');
  };

  // Copy transcript to clipboard
  const handleCopyTranscript = () => {
    const lines = dialogueLog.map((m) => `[${m.timestamp}] ${m.sender}: ${m.text}`);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
    toast.success(isArabic ? 'تم نسخ المحادثة' : isFrench ? 'Copié dans le presse-papiers' : 'Copied to clipboard');
  };

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      cancelSpeech();
    };
  }, []);

  return (
    <div 
      dir={isArabic ? 'rtl' : 'ltr'}
      className="flex-1 flex flex-col bg-[#0b0f19] text-slate-100 relative overflow-hidden h-full p-2.5 sm:p-3 select-none"
    >
      {/* ── TOP UNIFIED SLIM BAR WITH MODE TABS & DIALECT CONTROLS ── */}
      <div className="shrink-0 mb-2 flex flex-wrap items-center justify-between gap-2 bg-[#13182b] p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-800 shadow-md">
        {/* Left: Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center text-white shadow-sm shrink-0">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveMode('bridge')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMode === 'bridge'
                  ? 'bg-indigo-600 text-white shadow-sm font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t.modeBridge}</span>
            </button>
            <button
              onClick={() => setActiveMode('ai-tutor')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMode === 'ai-tutor'
                  ? 'bg-purple-600 text-white shadow-sm font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>{t.modeAiTutor}</span>
            </button>
          </div>
        </div>

        {/* Right: Dialect & Speed */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 px-1">🗣️</span>
            {[
              { id: 'Egyptian Ammiya', label: '🇪🇬 مصري' },
              { id: 'Arabic', label: '🇸🇦 فصحى' },
              { id: 'English', label: '🇺🇸 EN' },
              { id: 'French', label: '🇫🇷 FR' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setVoiceDialect(id)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                  voiceDialect === id
                    ? 'bg-indigo-600 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-[10px] text-slate-400 font-bold">{t.speed}</span>
            {[0.8, 1.0, 1.25].map((rate) => (
              <button
                key={rate}
                onClick={() => setSpeechRate(rate)}
                className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  speechRate === rate ? 'bg-purple-600 text-white font-black' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TWO-COLUMN INTERACTIVE WORKSPACE (ZERO SCROLL) ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-2.5 min-h-0 overflow-hidden">
        
        {/* ── COLUMN A: DEAF CONSOLE / AI TUTOR ── */}
        <div className="bg-[#13182b] rounded-2xl border border-slate-800 p-2.5 sm:p-3 shadow-xl flex flex-col justify-between min-h-0 overflow-hidden relative">
          
          {activeMode === 'bridge' ? (
            <div className="flex flex-col h-full justify-between min-h-0">
              <div className="flex items-center justify-between shrink-0 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <UserCheck className="w-3.5 h-3.5" />
                  </span>
                  <h3 className="text-xs sm:text-sm font-black text-white">{t.sideAHeader}</h3>
                </div>
                
                {/* AAC Drawer Trigger */}
                <button
                  onClick={() => setShowAacDrawer((prev) => !prev)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 ${
                    showAacDrawer
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <Layers className="w-3 h-3 text-cyan-400" />
                  <span>{isArabic ? 'عبارات AAC' : isFrench ? 'Phrases AAC' : 'AAC Phrases'}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showAacDrawer ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Quick Gestures Ribbon (Compact single row of 6) */}
              <div className="grid grid-cols-6 gap-1 shrink-0 mb-2">
                {QUICK_GESTURES.map((g, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      handleSpeakToRoom(g.text);
                      handleSignText(g.text);
                    }}
                    title={g.text}
                    className="py-1 px-0.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/40 text-center transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5"
                  >
                    <span className="text-xs">{g.icon}</span>
                    <span className="text-[9px] font-bold text-slate-300 truncate w-full">{g.label}</span>
                  </button>
                ))}
              </div>

              {/* Overlay AAC Drawer (Floating overlay that never pushes layout) */}
              <AnimatePresence>
                {showAacDrawer && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    className="absolute inset-x-2.5 top-11 z-30 bg-[#0e1324]/95 backdrop-blur-md border border-slate-700 rounded-xl p-2.5 shadow-2xl flex flex-col max-h-[220px]"
                  >
                    <div className="flex items-center justify-between mb-1.5 shrink-0">
                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                        {(Object.keys(AAC_CATEGORIES) as AACCategory[]).map((catKey) => {
                          const cat = AAC_CATEGORIES[catKey];
                          const isActive = activeAacCategory === catKey;
                          return (
                            <button
                              key={catKey}
                              onClick={() => setActiveAacCategory(catKey)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all shrink-0 border ${
                                isActive
                                  ? `${cat.color} font-black`
                                  : 'bg-slate-900 border-slate-800 text-slate-400'
                              }`}
                            >
                              {cat.label}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setShowAacDrawer(false)}
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1 overflow-y-auto flex-1 p-0.5">
                      {AAC_CATEGORIES[activeAacCategory].phrases.map((phrase, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setInputText(phrase.text);
                            handleSpeakToRoom(phrase.text);
                            handleSignText(phrase.text);
                            setShowAacDrawer(false);
                          }}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-indigo-900/40 border border-slate-800/80 text-start text-[11px] font-bold text-slate-200 transition-all active:scale-95 flex items-center gap-1.5 truncate"
                        >
                          <span className="text-xs shrink-0">{phrase.icon}</span>
                          <span className="truncate">{phrase.text}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Text Input Area */}
              <div className="flex-1 flex flex-col min-h-0 mb-2">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSpeakToRoom();
                      handleSignText();
                    }
                  }}
                  placeholder={t.typePlaceholder}
                  className="w-full flex-1 p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-slate-100 font-medium text-xs sm:text-sm leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 shrink-0">
                <button
                  onClick={() => handleSpeakToRoom()}
                  disabled={!inputText.trim()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-40 text-slate-950 font-black rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
                >
                  {isSpeakingOut ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{t.speakBtn}</span>
                </button>

                <button
                  onClick={() => handleSignText()}
                  disabled={!inputText.trim()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t.signBtn}</span>
                </button>
              </div>
            </div>
          ) : (
            /* AI TUTOR MODE */
            <div className="flex flex-col h-full justify-between min-h-0">
              <div className="flex items-center gap-2 mb-1.5 shrink-0">
                <span className="p-1 rounded-lg bg-purple-500/20 text-purple-400">
                  <Brain className="w-3.5 h-3.5" />
                </span>
                <h3 className="text-xs sm:text-sm font-black text-white">{t.modeAiTutor}</h3>
              </div>

              {aiAnswerText ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 bg-purple-950/20 border border-purple-500/30 rounded-xl mb-2">
                  <span className="text-[10px] text-purple-400 font-bold block mb-1">{t.aiTag}:</span>
                  <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed">{aiAnswerText}</p>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex items-center justify-center text-center p-3 text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-slate-800/80 mb-2">
                  {isArabic
                    ? 'اكتب سؤالك وسيقوم المعلم الذكي بشرحه فوراً بالنطق الصوتي وترجمته بلغة الإشارة 3D.'
                    : isFrench
                    ? 'Posez votre question et l\'IA l\'expliquera en 3D et voix.'
                    : 'Ask a question and AI will explain it via voice & 3D sign.'}
                </div>
              )}

              <div className="shrink-0">
                <textarea
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskAiTutor();
                    }
                  }}
                  placeholder={t.askAiPlaceholder}
                  className="w-full h-[58px] p-2 bg-slate-900 border border-slate-800 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-slate-100 font-medium text-xs mb-1.5"
                />

                <button
                  onClick={handleAskAiTutor}
                  disabled={!aiQuestion.trim() || isAiAnswering}
                  className="w-full py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:brightness-110 disabled:opacity-40 text-white font-black rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAiAnswering ? t.aiThinking : t.askAiBtn}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ── COLUMN B: UNIFIED 3D SIGN AVATAR STAGE & PARTNER MIC ── */}
        <div className="bg-[#13182b] rounded-2xl border border-slate-800 p-2.5 sm:p-3 shadow-xl flex flex-col justify-between min-h-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="p-1 rounded-lg bg-rose-500/20 text-rose-400">
                <Mic className="w-3.5 h-3.5" />
              </span>
              <h3 className="text-xs sm:text-sm font-black text-white">{t.sideBHeader}</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300">
              Partner ➔ 3D Sign
            </span>
          </div>

          {/* Master 3D Sign Avatar Viewport */}
          <div className="flex-1 min-h-[140px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 mb-2 flex items-center justify-center relative">
            <React.Suspense fallback={
              <div className="text-center p-3">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-1.5" />
                <span className="text-xs text-slate-400">Loading 3D Sign Avatar...</span>
              </div>
            }>
              <SignAvatar3D
                words={partnerSignSequence.length > 0 ? partnerSignSequence : sequence}
                playing={isPartnerSigning || isSigning}
                onDone={() => {
                  setIsPartnerSigning(false);
                  setIsSigning(false);
                }}
              />
            </React.Suspense>

            {isListeningPartner && (
              <div className="absolute top-2 left-2 bg-rose-500/90 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-md z-10">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <span>{t.listeningActive}</span>
              </div>
            )}
          </div>

          {/* Live Partner Captions */}
          <div className="shrink-0 bg-slate-900/90 border border-slate-800 p-2 rounded-xl mb-2 min-h-[42px] max-h-[50px] overflow-hidden flex flex-col justify-center">
            <span className="text-[9px] text-slate-400 font-bold block leading-none mb-0.5">{t.partnerTag}:</span>
            <p className="text-xs font-bold text-emerald-400 truncate leading-snug">
              {partnerTranscript || (isListeningPartner ? t.listeningActive : t.partnerPlaceholder)}
            </p>
          </div>

          {/* Partner Listen Toggle Button */}
          <button
            onClick={togglePartnerListening}
            className={`shrink-0 w-full py-2.5 rounded-xl font-black transition-all shadow-md text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-98 ${
              isListeningPartner
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white'
            }`}
          >
            {isListeningPartner ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isListeningPartner ? t.listenBtnStop : t.listenBtnStart}</span>
          </button>
        </div>

      </div>

      {/* ── LIVE TWO-WAY DIALOGUE SLIM TICKER ── */}
      <div className="shrink-0 bg-[#13182b] border border-slate-800 rounded-xl px-3 py-1.5 mt-2 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <button
            onClick={() => setShowFullTimeline(true)}
            className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 shrink-0"
          >
            <span>{t.timelineTitle}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
              {dialogueLog.length}
            </span>
          </button>
          
          {dialogueLog.length > 0 && (
            <span className="text-[11px] text-slate-400 truncate hidden md:inline border-s border-slate-800 ps-2">
              <strong className="text-slate-300">
                {dialogueLog[dialogueLog.length - 1].sender === 'user' ? t.meTag : dialogueLog[dialogueLog.length - 1].sender === 'ai' ? t.aiTag : t.partnerTag}:
              </strong>{' '}
              {dialogueLog[dialogueLog.length - 1].text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowFullTimeline(true)}
            className="p-1 px-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-900/50 text-[11px] font-bold flex items-center gap-1 transition-all"
          >
            <span>{isArabic ? 'عرض المحادثة' : isFrench ? 'Afficher' : 'View Log'}</span>
          </button>
          <button
            onClick={handleCopyTranscript}
            className="p-1 px-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all"
          >
            {copiedTranscript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden sm:inline">{t.copy}</span>
          </button>
          <button
            onClick={handleExportTranscript}
            className="p-1 px-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">{t.saveTxt}</span>
          </button>
          <button
            onClick={() => setDialogueLog([])}
            className="p-1 px-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-500 text-[11px] transition-all"
            title={t.clear}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── FULL DIALOGUE TIMELINE MODAL ── */}
      <AnimatePresence>
        {showFullTimeline && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#13182b] border border-slate-700 rounded-2xl w-full max-w-lg p-4 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-black text-white">{t.timelineTitle}</h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                    {dialogueLog.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowFullTimeline(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
                {dialogueLog.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    {isArabic ? 'لا توجد رسائل بعد في هذه الجلسة' : 'No messages in this session yet'}
                  </p>
                ) : (
                  dialogueLog.map((msg) => {
                    const isMe = msg.sender === 'user';
                    const isAi = msg.sender === 'ai';
                    return (
                      <div
                        key={msg.id}
                        className={`p-2 rounded-xl text-xs flex items-start justify-between gap-3 border ${
                          isMe
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100'
                            : isAi
                            ? 'bg-purple-950/20 border-purple-500/30 text-purple-100'
                            : 'bg-indigo-950/20 border-indigo-500/30 text-indigo-100'
                        }`}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                              isMe
                                ? 'bg-emerald-500/30 text-emerald-300'
                                : isAi
                                ? 'bg-purple-500/30 text-purple-300'
                                : 'bg-indigo-500/30 text-indigo-300'
                            }`}
                          >
                            {isMe ? t.meTag : isAi ? t.aiTag : t.partnerTag}
                          </span>
                          <span className="break-words leading-relaxed">{msg.text}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">{msg.timestamp}</span>
                      </div>
                    );
                  })
                )}
                <div ref={dialogueEndRef} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyTranscript}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    {copiedTranscript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{t.copy}</span>
                  </button>
                  <button
                    onClick={handleExportTranscript}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.saveTxt}</span>
                  </button>
                </div>
                <button
                  onClick={() => setShowFullTimeline(false)}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all"
                >
                  {isArabic ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
