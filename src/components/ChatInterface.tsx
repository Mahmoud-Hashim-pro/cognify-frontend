import { localize, isArabicLocale, getTranslation } from '../lib/translations';
import React, { useState, useRef, useEffect } from "react";
import { Message, UserProfile, Task, PedagogyStyle } from "../types";
import { generateAdaptiveResponseStream, generateBenchmarkComparison, generateProactiveInsights, generateChatTitle } from "../services/gemini";
import { geminiService } from "../services/geminiService";
import { PEDAGOGY_STYLES } from "../lib/adaptiveLearning";
import { Send, Bot, User, Loader2, Sparkles, BrainCircuit, Paperclip, ImageIcon, FileText, X, Accessibility, Menu, Download, Mic, MicOff, RefreshCw, Volume2, ListTodo, Plus, Trash2, CheckCircle2, Circle, Scale, Lightbulb, ThumbsUp, ThumbsDown, Copy, Square, FolderGit2, Compass, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Layers, RotateCcw, Zap, Bookmark, Search, Eye } from "lucide-react";
import SmartFollowUpChips from "./chat/SmartFollowUpChips";
import ChatBookmarksDrawer, { BookmarkedInsight } from "./chat/ChatBookmarksDrawer";
import ChatErgonomicsBar, { FontScale } from "./chat/ChatErgonomicsBar";
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from "motion/react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { ref as firebaseStorageRef, uploadString, getDownloadURL } from "firebase/storage";
import { auth, db, storage, handleFirestoreError, OperationType, cleanDataForFirestore } from "../lib/firebase";
import { toast } from "./Toast";
import MarkdownMessage from "./MarkdownMessage";
import { speak as speakText, cancelSpeech } from "../lib/tts";
import { useStudentState } from "../lib/useStudentState";
import { eventBus } from "../lib/learningEvents";
import { detectConceptFromText } from "../lib/conceptGraph";
import { getSpatialObjects } from "../lib/spatialMemoryEngine";
import ChatWorkspacePanel, { StudySubject } from './chat/ChatWorkspacePanel';
import ChatContextPanel, { ContextSource } from './chat/ChatContextPanel';
import ChatQuickActions from './chat/ChatQuickActions';
import { detectConversationalStrain } from '../lib/conversationalStrain';
import RetentionWarmupBanner from './chat/RetentionWarmupBanner';
import ProactiveSuggestionCard from './ProactiveSuggestionCard';
import { detectProactiveOpportunities } from '../lib/proactiveAssistantEngine';
import { generateLearningInsights } from '../lib/learningInsightsEngine';
import { explainPedagogyChoice, type PedagogyStrategy } from '../lib/explainabilityEngine';
import { encryptThreadMessages, decryptThreadMessages } from '../lib/userCryptoEngine';

// Three.js is heavy — only load the sign avatar when a deaf-mode user opens it.
const SignAvatar3D = React.lazy(() => import("./SignAvatar3D"));
const FrenchTravelVoiceAssistant = React.lazy(() => import("./FrenchTravelVoiceAssistant"));

// Strip markdown/sign markers and split into words for the sign avatar.
const wordsForSigning = (text: string): string[] =>
  text.replace(/\[Signs:.*?\]/g, "").replace(/[*+#_`~\[\]()>-]/g, " ").split(/\s+/).filter(Boolean).slice(0, 60);

const cleanMessagesForFirestore = (newHistory: Message[]) => {
  // Cap the persisted history so one thread doc can't exceed Firestore's 1 MiB
  // limit (which would fail EVERY future save for that thread). The live UI keeps
  // the full in-memory history for the session; only very old turns drop on reload.
  return newHistory.slice(-300).map(m => {
    const item: any = {
      id: m.id,
      role: m.role,
      content: m.content || "",
      timestamp: m.timestamp
    };
    if (m.pedagogyStyle) item.pedagogyStyle = m.pedagogyStyle;
    if (m.adaptationReason) item.adaptationReason = m.adaptationReason;
    if (m.reaction !== undefined && m.reaction !== null) {
      item.reaction = m.reaction;
    }
    if (m.attachments !== undefined && m.attachments !== null) {
      item.attachments = m.attachments.map((a: any) => {
        const att: any = { name: a.name || "", type: a.type || "" };
        if (a.url) att.url = a.url;
        // CRITICAL: never persist large base64 — Firestore caps a document at
        // 1 MiB, so a big inline attachment would fail the WHOLE thread save.
        // Large files live in Storage (url); only keep tiny inline data as a
        // fallback when there's no url yet.
        if (a.data && !a.url && a.data.length <= 400000) att.data = a.data;
        return att;
      });
    }
    if (m.comparisons !== undefined && m.comparisons !== null) {
      item.comparisons = m.comparisons.map((c: any) => ({
        modelName: c.modelName || "",
        content: c.content || ""
      }));
    }
    return item;
  });
};

// Best source for an attachment: the Storage URL (persists across reloads),
// falling back to inline base64 (fresh, pre-upload). Empty if neither.
const attSrc = (f: { type?: string; data?: string; url?: string }) =>
  f.url || (f.data ? `data:${f.type};base64,${f.data}` : '');

// Read a File as a base64 data URL.
const readAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => resolve('');
    r.readAsDataURL(file);
  });

// Downscale + JPEG-compress an image in the browser so it's small enough to
// store inline in Firestore (no Cloud Storage / Blaze plan needed) and cheap to
// send to the AI. Falls back to the original if anything fails.
async function compressImage(file: File, maxDim = 1280, quality = 0.72): Promise<{ data: string; type: string }> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    URL.revokeObjectURL(url);
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas ctx');
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return { data: dataUrl.split(',')[1] || '', type: 'image/jpeg' };
  } catch {
    const dataUrl = await readAsDataURL(file);
    return { data: dataUrl.split(',')[1] || '', type: file.type };
  }
}

interface ChatInterfaceProps {
  profile: UserProfile;
  onQuestionEvaluated: (score: number, lastMessageSnippet: string) => void;
  onMenuClick?: () => void;
  syncMessages?: (messages: Message[]) => void;
  externalMessage?: string;
  onStreamingUpdate?: (text: string) => void;
  isEmbedded?: boolean;
  onSTTStateChange?: (active: boolean) => void;
  setProfile?: (profile: UserProfile) => void;
}

export interface ChatInterfaceRef {
  toggleSTT: () => void;
}

const ChatInterface = React.forwardRef<ChatInterfaceRef, ChatInterfaceProps>(({ profile, onQuestionEvaluated, onMenuClick, syncMessages, externalMessage, onStreamingUpdate, isEmbedded, onSTTStateChange, setProfile }, ref) => {
  const activeThread = profile.chatThreads?.find(t => t.id === profile.activeThreadId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showTasks, setShowTasks] = useState(false);
  const [newTaskInput, setNewTaskInput] = useState("");
  const [showInsights, setShowInsights] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  // Streamlined, focused Chat Experience: side panels closed by default for maximum clarity
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [activeSubjectId, setActiveSubjectId] = useState('sub-1');
  const [studyMinutes, setStudyMinutes] = useState(0);

  // Compact Single-Rectangle Composer & Mouse-collapsible tools
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const [showPedagogyPopover, setShowPedagogyPopover] = useState(false);
  const [showQuickActionsPopover, setShowQuickActionsPopover] = useState(false);
  const [expandedExplainMessageId, setExpandedExplainMessageId] = useState<string | null>(null);

  // Live timer for study session metrics
  useEffect(() => {
    const timer = setInterval(() => {
      setStudyMinutes(prev => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Dictation Language for STT: One-click toggle between French (France), English (US), and Arabic (Egypt)
  const [dictationLang, setDictationLang] = useState<'fr-FR' | 'en-US' | 'ar-EG'>(() => {
    if (profile.language === 'French') return 'fr-FR';
    if (isArabicLocale(profile.language)) return 'ar-EG';
    return 'en-US';
  });
  const [showFrenchTravelAssistant, setShowFrenchTravelAssistant] = useState(false);

  // Dynamic visual ergonomics & accessibility states
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('cognify_chat_font_scale') as FontScale) || 'base';
    }
    return 'base';
  });

  const [isEyeComfort, setIsEyeComfort] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cognify_chat_eye_comfort') === 'true';
    }
    return false;
  });

  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [bookmarkedInsights, setBookmarkedInsights] = useState<BookmarkedInsight[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`cognify_chat_bookmarks_${profile.uid || 'guest'}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleChangeFontScale = (scale: FontScale) => {
    setFontScale(scale);
    try {
      localStorage.setItem('cognify_chat_font_scale', scale);
    } catch {}
  };

  const handleToggleEyeComfort = () => {
    setIsEyeComfort((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cognify_chat_eye_comfort', String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleBookmark = (msg: Message) => {
    setBookmarkedInsights((prev) => {
      const existing = prev.find((b) => b.messageId === msg.id);
      let updated: BookmarkedInsight[];
      if (existing) {
        updated = prev.filter((b) => b.messageId !== msg.id);
        toast.info(
          localize(profile.language, 'Removed from saved insights', 'تمت الإزالة من بنك الأفكار المحفوظة')
        );
      } else {
        const newInsight: BookmarkedInsight = {
          id: `bm-${Date.now()}`,
          messageId: msg.id,
          content: msg.content,
          timestamp: new Date().toISOString(),
          pedagogyStyle: msg.pedagogyStyle || activePedagogyStyle,
        };
        updated = [newInsight, ...prev];
        toast.success(
          localize(profile.language, 'Pinned to saved insights 📌', 'تم تثبيت الفكرة في بنك الأفكار 📌')
        );
      }
      try {
        localStorage.setItem(`cognify_chat_bookmarks_${profile.uid || 'guest'}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleRemoveBookmark = (bookmarkId: string) => {
    setBookmarkedInsights((prev) => {
      const updated = prev.filter((b) => b.id !== bookmarkId);
      try {
        localStorage.setItem(`cognify_chat_bookmarks_${profile.uid || 'guest'}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleJumpToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 2000);
    }
  };

  const handleSimplify = (msg: Message) => {
    const isAr = isArabicLocale(profile.language);
    const simplifyPrompt = isAr
      ? `من فضلك اشرح الرد السابق بأسلوب مبسط جداً وبخطوات واضحة بدون أي تعقيد (ELI5) مع تشبيه من الحياة اليومية.`
      : `Please simplify the previous explanation in very clear, straightforward steps (ELI5) with an intuitive real-world analogy.`;
    handleSubmit(undefined, simplifyPrompt);
  };

  const { studentState, recordAnswer, recordPedagogyFeedback } = useStudentState(profile?.uid, profile?.level);
  const [activePedagogyStyle, setActivePedagogyStyle] = useState<PedagogyStyle>(
    (studentState?.activePedagogy as any) || profile?.preferredPedagogyStyle || 'analogies'
  );
  const activePedagogyMeta = PEDAGOGY_STYLES.find(st => st.id === activePedagogyStyle) || PEDAGOGY_STYLES[0];
  const isArabic = isArabicLocale(profile.language);

  // Keep active pedagogy synchronized with real-time student state engine
  useEffect(() => {
    if (studentState?.activePedagogy) {
      setActivePedagogyStyle(studentState.activePedagogy as any);
    }
  }, [studentState?.activePedagogy]);

  // Proactive learning assistant opportunities & grounded insights
  const proactiveOpportunities = React.useMemo(() => {
    if (!studentState) return [];
    return detectProactiveOpportunities(studentState, Date.now(), { maxOpportunities: 2 });
  }, [studentState]);

  const learningInsights = React.useMemo(() => {
    if (!studentState) return [];
    return generateLearningInsights(studentState, Date.now());
  }, [studentState]);

  const activeProactiveOpportunity = proactiveOpportunities[0] || null;
  const activeGroundedInsight = !activeProactiveOpportunity && learningInsights.length > 0 ? learningInsights[0] : null;

  const handleSelectPedagogy = (style: PedagogyStyle) => {
    setActivePedagogyStyle(style);
    if (setProfile) {
      setProfile({ ...profile, preferredPedagogyStyle: style });
    }
    if (profile?.uid) {
      setDoc(doc(db, `users/${profile.uid}`), cleanDataForFirestore({
        preferredPedagogyStyle: style
      }), { merge: true }).catch(() => {});
    }
  };

  const currentThreadId = profile.activeThreadId || Date.now().toString();

  const ensureThreadExists = () => {
    if (!profile.activeThreadId) {
      const newThread = {
        id: currentThreadId,
        title: "New Chat",
        updatedAt: new Date().toISOString()
      };
      const updatedThreads = [...(profile.chatThreads || []), newThread];
      if (setProfile) {
        setProfile({
            ...profile,
            chatThreads: updatedThreads,
            activeThreadId: currentThreadId
        });
      } else {
        profile.chatThreads = updatedThreads;
        profile.activeThreadId = currentThreadId;
      }
      if (profile.uid) {
         setDoc(doc(db, `users/${profile.uid}`), cleanDataForFirestore({ 
           chatThreads: updatedThreads, 
           activeThreadId: currentThreadId 
         }), { merge: true });
      }
    }
  };

  const isMountedRef = useRef(true);

  const handleGenerateInsights = async () => {
    if (!profile.uid) return;
    ensureThreadExists();
    setIsGeneratingInsights(true);
    try {
      const result = await generateProactiveInsights(profile, messages);
      if (isMountedRef.current) {
        setInsights(result);
      }
    } finally {
      if (isMountedRef.current) {
        setIsGeneratingInsights(false);
      }
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.uid || !newTaskInput.trim()) return;
    ensureThreadExists();

    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      threadId: currentThreadId,
      content: newTaskInput.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };

    const updatedTasks = [...(profile.tasks || []), newTask];
    
    setDoc(doc(db, `users/${profile.uid}`), { tasks: updatedTasks }, { merge: true }).catch(err => {
      console.error("Error adding task", err);
    });
    
    setNewTaskInput("");
  };

  const handleToggleTask = (taskId: string) => {
    if (!profile.uid) return;
    const updatedTasks = (profile.tasks || []).map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    setDoc(doc(db, `users/${profile.uid}`), { tasks: updatedTasks }, { merge: true }).catch(err => {
      console.error("Error toggling task", err);
    });
  };

  const handleDeleteTask = (taskId: string) => {
    if (!profile.uid) return;
    const updatedTasks = (profile.tasks || []).filter(t => t.id !== taskId);
    setDoc(doc(db, `users/${profile.uid}`), { tasks: updatedTasks }, { merge: true }).catch(err => {
      console.error("Error deleting task", err);
    });
  };

  const currentThreadTasks = (profile.tasks || []).filter(t => t.threadId === currentThreadId);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Handle external message injection (e.g. from sign/voice transcription).
  // Deduped so the same injection can't double-send; the ref resets when the
  // parent clears externalMessage, so a repeated phrase still sends next time.
  const lastExternalRef = useRef("");
  useEffect(() => {
    if (!externalMessage) { lastExternalRef.current = ""; return; }
    // If a turn is still streaming, don't drop the message — bail WITHOUT
    // marking it handled. `isLoading` is a dep, so this effect re-runs the
    // moment streaming ends and the queued sentence is sent then.
    if (isLoading) return;
    if (externalMessage === lastExternalRef.current) return;
    lastExternalRef.current = externalMessage;
    if (profile?.accessibilityMode === 'Vocal-Deaf' || profile?.accessibilityMode === 'Sign-Only') {
      handleSubmit(undefined, externalMessage);
    } else {
      setInput(externalMessage);
    }
  }, [externalMessage, isLoading, profile?.accessibilityMode]);

  // Warm up Speech Synthesis voices list on mount
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const handleVoices = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoices);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', handleVoices);
    }
  }, []);

  const stopRef = useRef(false);
  // Aborts the in-flight AI request so pressing Stop actually cancels generation
  // (and stops burning quota) instead of only hiding the stream locally.
  const abortRef = useRef<AbortController | null>(null);
  // Guards against the live Firestore listener clobbering local state mid-turn:
  // while we're sending (and briefly after), a lagging server snapshot of an
  // EARLIER save could otherwise overwrite the freshly completed reply.
  const isSendingRef = useRef(false);
  const lastLocalWriteRef = useRef(0);
  // Tracks the committed message count of the active thread. A remote snapshot
  // that has FEWER messages than this is stale (within the same thread, history
  // only grows) — applying it would erase newer messages, so we skip it.
  const messagesLenRef = useRef(0);

  // iOS soft-keyboard fix: bind the chat shell height to the visual viewport so
  // the composer stays above the keyboard instead of being hidden behind it.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => document.documentElement.style.setProperty('--app-h', `${vv.height}px`);
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      document.documentElement.style.removeProperty('--app-h');
    };
  }, []);
  const [streamingText, setStreamingText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<{ name: string, type: string, data: string, url?: string, localId?: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string, type: string, data?: string, url?: string } | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  // Which assistant message is currently being shown on the sign-language avatar
  // (only one at a time to avoid many WebGL contexts).
  const [signingId, setSigningId] = useState<string | null>(null);
  const [isReadingDocument, setIsReadingDocument] = useState(false);

  // Turn OFF the active accessibility mode from the header badge. Modes are
  // sticky (saved to the profile), so a user who tried one while exploring —
  // even on a Normal account — would otherwise stay stuck with the avatar/mic
  // overlay and no obvious way out. Persists so it survives a reload.
  const handleDisableAccessibility = () => {
    if (!window.confirm(localize(profile.language,
      'Turn off accessibility mode? You can switch it back on any time from Accessibility settings.',
      'تقفل وضع الإتاحة؟ تقدر ترجّعه في أي وقت من إعدادات الإتاحة.'))) return;
    window.speechSynthesis?.cancel();
    if (setProfile) setProfile({ ...profile, accessibilityMode: 'None' });
    if (profile.uid) {
      setDoc(doc(db, `users/${profile.uid}`), { accessibilityMode: 'None' }, { merge: true })
        .catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`));
    }
  };

  const handleSpeak = (m: Message) => {
    if (speakingMessageId === m.id) {
      cancelSpeech();
      setSpeakingMessageId(null);
      return;
    }

    setSpeakingMessageId(m.id);
    const messageId = m.id;
    const isAr = isArabicLocale(profile.language);

    // Previously this reimplemented voice selection inline and had no
    // silent-fail handling — a blind/Visual-mode user who can't see the reply
    // got NO feedback at all when the browser silently dropped speak() (most
    // commonly the very first call outside a real user gesture, or no voice
    // installed for their language). Now routed through the shared helper
    // (lib/tts.ts), which detects that case, and we surface it as a toast +
    // clear the "speaking" indicator instead of leaving it stuck.
    speakText(m.content, profile.language, {
      onEnd: () => setSpeakingMessageId((prev) => (prev === messageId ? null : prev)),
      onError: (err) => {
        setSpeakingMessageId((prev) => (prev === messageId ? null : prev));
        if (err === 'silent-fail' || err === 'synth-error' || err === 'unsupported') {
          toast.warning(
            isAr
              ? 'معرفتش أشغّل الصوت. جرّب تاكد إن صوت اللغة دي متثبت على جهازك، أو استخدم قارئ الشاشة.'
              : "Couldn't play audio for this reply. Check that a voice for this language is installed, or use a screen reader.",
            isAr ? 'تعذّر النطق' : 'Speech unavailable',
          );
        }
      },
    });
  };

  const readDocument = async (file: {name: string, type: string, data?: string, url?: string}) => {
    if (isLoading || isReadingDocument) return;
    if (!file.data) return; // the AI needs the inline bytes; a URL-only file can't be re-read
    setIsReadingDocument(true);
    
    try {
      const prompt = `You are an accessibility auditor for the blind. 
      Task: Read and extract all important text and meaningful information from this document: "${file.name}".
      Style: Narrate it slowly and clearly as if reading it to a blind person. 
      Mirror the user's dialect (Standard Arabic, Egyptian Ammiya, or English).
      If it's an image, describe it in high detail. 
      If it's a PDF/Text, read the key chapters and paragraphs.
      Return the full narrated text.`;
      
      // Await the full turn so the "reading…" spinner stays up for the whole
      // narration instead of flashing off the instant the request is fired.
      await handleSubmit(undefined, prompt, [{ name: file.name, type: file.type, data: file.data }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsReadingDocument(false);
      setPreviewFile(null);
    }
  };

  // STT Logic
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  // Text typed before dictation started — we rebuild input = base + transcript,
  // which is idempotent and prevents the mobile "repeated words" duplication.
  const baseInputRef = useRef("");
  // Live mirror of `input` — onend/onresult are captured once inside the STT
  // effect and close over a stale `input`, so we read the current value here.
  const inputRef = useRef("");
  // True while the user wants to keep listening — lets us auto-restart if the
  // engine ends early (fixes desktop "mic closes immediately").
  const shouldListenRef = useRef(false);

  useEffect(() => {
    onSTTStateChange?.(isListening);
  }, [isListening, onSTTStateChange]);

  useEffect(() => { inputRef.current = input; }, [input]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      const langMap: Record<string, string> = {
        'Arabic': 'ar-SA',
        'Egyptian Ammiya': 'ar-EG',
        'English': 'en-US',
        'French': 'fr-FR',
        'Spanish': 'es-ES',
        'German': 'de-DE'
      };
      recognition.lang = dictationLang || langMap[profile.language || 'English'] || 'en-US';

      const isAr = isArabicLocale(profile.language);

      recognition.onstart = () => setIsListening(true);

      recognition.onend = () => {
        // The engine often stops on its own (silence/timeout). If the user still
        // wants to listen, restart it so dictation feels continuous. Restart on a
        // short delay rather than synchronously: calling start() inside onend can
        // throw InvalidState on some engines and, on repeated no-speech, spins a
        // tight restart loop that pins the CPU. The delay yields the main thread
        // and rechecks the intent flag in case the user toggled off meanwhile.
        if (shouldListenRef.current) {
          // Fold everything finalized so far into the base BEFORE restarting.
          // The next session's results index from 0, and onresult rebuilds
          // input = base + newFinals; without advancing base here, the restart
          // would erase all previously dictated text.
          baseInputRef.current = inputRef.current;
          setTimeout(() => {
            if (!shouldListenRef.current) return;
            try { recognition.start(); } catch { setIsListening(false); }
          }, 300);
          return;
        }
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        const err = event?.error;
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          shouldListenRef.current = false;
          setIsListening(false);
          toast.error(
            isAr ? 'مفيش إذن للمايك. اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح.'
                 : 'Microphone permission is blocked. Allow mic access in your browser settings.',
            isAr ? 'الميكروفون مقفول' : 'Mic blocked',
          );
        } else if (err !== 'no-speech' && err !== 'aborted') {
          // no-speech/aborted are normal; onend will auto-restart if needed.
          console.warn('Speech recognition error:', err);
        }
      };

      recognition.onresult = (event: any) => {
        // Rebuild the full transcript from ALL results every time (not append),
        // so engines that re-deliver finals can't duplicate words.
        let finalStr = '';
        let interimStr = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0].transcript;
          if (res.isFinal) finalStr += text + ' ';
          else interimStr += text;
        }
        const base = baseInputRef.current.trim();
        setInput(((base ? base + ' ' : '') + finalStr).trim());
        setInterimTranscript(interimStr.trim());
      };

      recognitionRef.current = recognition;
    }
    return () => {
      shouldListenRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    };
  }, [profile.language, dictationLang]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      const isAr = isArabicLocale(profile.language);
      toast.warning(
        isAr ? 'الإدخال الصوتي مش مدعوم في المتصفح ده. جرّب Chrome.' : 'Voice input isn’t supported in this browser. Try Chrome.',
        isAr ? 'غير مدعوم' : 'Unsupported',
      );
      return;
    }
    if (isListening) {
      shouldListenRef.current = false; // user-initiated stop — don't auto-restart
      const finalFullText = (input + (input && interimTranscript ? " " : "") + interimTranscript).trim();
      setInput(finalFullText);
      setInterimTranscript("");
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      if (finalFullText && profile.accessibilityMode === 'Visual') {
        const isArabic = isArabicLocale(profile.language);
        const confirmMsg = isArabic ? "تم الإرسال: " + finalFullText : "Sent: " + finalFullText;
        speakText(confirmMsg, profile.language);
      }
      if (finalFullText) {
        handleSubmit(undefined, finalFullText);
      }
    } else {
      // Remember what was already typed so dictation appends, not overwrites.
      baseInputRef.current = input;
      setInterimTranscript("");
      shouldListenRef.current = true;
      try {
        recognitionRef.current.start();
      } catch {
        // start() throws if it's already running — restart cleanly.
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
        setTimeout(() => { try { recognitionRef.current?.start(); } catch { /* ignore */ } }, 150);
      }
    }
  };

  React.useImperativeHandle(ref, () => ({
    toggleSTT: toggleListening
  }));

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopRef.current = true;
      abortRef.current?.abort();
      recognitionRef.current?.stop();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Sync with active thread by fetching from subcollection
  useEffect(() => {
    if (!profile.uid || !profile.activeThreadId) {
      const isArabic = isArabicLocale(profile.language);
      const welcomeMsg = isArabic 
        ? `كوجنيفي جاهز. كيف يمكنني مساعدتك في دراساتك في مجال ${profile.field} اليوم؟`
        : `Cognify Ready. How can I assist your ${profile.field} studies today?`;
        
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: welcomeMsg,
          timestamp: new Date().toISOString()
        }
      ]);
      return;
    }

    setMessagesLoading(true);
    setMessages([]); // clear the previous thread so it doesn't render under the new thread's title while the snapshot loads
    const path = `users/${profile.uid}/threads/${profile.activeThreadId}`;
    messagesLenRef.current = 0; // new thread — allow its first load through the length guard

    const unsubscribe = onSnapshot(doc(db, path), (snapshot) => {
      // Ignore our own un-acknowledged local writes (echoes) and any snapshot
      // that lands while we're sending or just sent — local state is the source
      // of truth during a turn, so a lagging server copy can't erase the reply.
      if (snapshot.metadata.hasPendingWrites) return;
      if (isSendingRef.current || Date.now() - lastLocalWriteRef.current < 2500) return;
      // Backstop: a snapshot with fewer messages than we already have is treated
      // as a stale echo — but ONLY within a few seconds of our own last write.
      // Beyond that window a genuinely shorter remote state (another device
      // deleting/regenerating) is allowed through, so cross-device edits sync.
      const incomingLen = snapshot.exists() ? (snapshot.data().messages?.length || 0) : 0;
      if (incomingLen < messagesLenRef.current && Date.now() - lastLocalWriteRef.current < 8000) return;

      if (snapshot.exists()) {
        const data = snapshot.data();
        decryptThreadMessages(data, profile.uid).then((incomingMessages) => {
          const incomingLen = incomingMessages.length;
          if (incomingLen < messagesLenRef.current && Date.now() - lastLocalWriteRef.current < 8000) {
            setMessagesLoading(false);
            return;
          }

          if (incomingMessages.length > 0) {
            setMessages(incomingMessages);
          } else {
            // If thread exists in metadata but no messages
            const isArabic = isArabicLocale(profile.language);
            const welcomeMsg = isArabic 
              ? `كوجنيفي جاهز. كيف يمكنني مساعدتك في دراساتك في مجال ${profile.field} اليوم؟`
              : `Cognify Ready. How can I assist your ${profile.field} studies today?`;
            setMessages([
              {
                id: 'welcome',
                role: 'assistant',
                content: welcomeMsg,
                timestamp: new Date().toISOString()
              }
            ]);
          }
          setMessagesLoading(false);
        }).catch((err) => {
          console.error('[ChatInterface] Failed to decrypt snapshot messages:', err);
          setMessagesLoading(false);
        });
      } else {
        // If thread document does not exist yet
        const isArabic = isArabicLocale(profile.language);
        const welcomeMsg = isArabic 
          ? `كوجنيفي جاهز. كيف يمكنني مساعدتك في دراساتك في مجال ${profile.field} اليوم؟`
          : `Cognify Ready. How can I assist your ${profile.field} studies today?`;
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: welcomeMsg,
            timestamp: new Date().toISOString()
          }
        ]);
        setMessagesLoading(false);
      }
    }, (err) => {
      console.error("Error fetching messages:", err);
      setMessagesLoading(false);
    });

    return () => unsubscribe();
  }, [profile.uid, profile.activeThreadId]);

  // Keep the length backstop in sync with whatever is currently rendered.
  useEffect(() => {
    messagesLenRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, streamingText, selectedFiles]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (!profile.uid) {
         alert("Please login first");
         return;
    }

    const isAr = isArabicLocale(profile.language);
    const newFiles: { name: string, type: string, data: string, url?: string, localId?: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Unique id so the async Storage-URL update targets THIS exact attachment,
      // even when the user adds two identical images (same bytes).
      const localId = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;

      // Word docs aren't readable by the AI — guide the user to PDF instead of
      // silently attaching a file the model will ignore.
      const isWord = /\.docx?$/i.test(file.name) ||
        file.type === 'application/msword' ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (isWord) {
        toast.warning(
          isAr
            ? `ملفات Word (.doc/.docx) مش مقروءة للذكاء الاصطناعي. من فضلك حوّل "${file.name}" لـ PDF وارفعه تاني.`
            : `Word files (.doc/.docx) can't be read by the AI. Please convert "${file.name}" to PDF and upload it again.`,
          isAr ? 'حوّله لـ PDF' : 'Convert to PDF',
        );
        continue;
      }

      // Limit file size to 10MB to accommodate multi-page PDFs and high-res study materials
      if (file.size > 10 * 1024 * 1024) {
        toast.warning(
          isAr ? `الملف "${file.name}" كبير جداً، الحد الأقصى 10 ميجا.` : `"${file.name}" is too large — the max is 10 MB.`,
          isAr ? 'ملف كبير' : 'File too large',
        );
        continue;
      }

      let mimeType = (file.type || '').trim().toLowerCase();
      const lowerName = file.name.toLowerCase();
      if (!mimeType || mimeType === 'application/octet-stream') {
        if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (/\.(jpe?g)$/.test(lowerName)) mimeType = 'image/jpeg';
        else if (lowerName.endsWith('.png')) mimeType = 'image/png';
        else if (lowerName.endsWith('.webp')) mimeType = 'image/webp';
        else if (lowerName.endsWith('.txt')) mimeType = 'text/plain';
      }

      // Images: compress so they persist inline in Firestore (no Storage needed).
      if (mimeType.startsWith('image/')) {
        const { data, type } = await compressImage(file);
        if (!data) {
          toast.warning(isAr ? `تعذّر قراءة "${file.name}".` : `Couldn't read "${file.name}".`, isAr ? 'خطأ' : 'Error');
          continue;
        }
        newFiles.push({ name: file.name, type: type || 'image/jpeg', data, url: '', localId });
        continue;
      }

      // PDFs and text documents
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      });
      const dataStr = base64.split(',')[1];
      if (!dataStr) {
        toast.warning(isAr ? `تعذّر قراءة الملف "${file.name}".` : `Couldn't read "${file.name}".`, isAr ? 'خطأ' : 'Error');
        continue;
      }

      newFiles.push({ name: file.name, type: mimeType || 'application/pdf', data: dataStr, url: "", localId });
    }

    // Show the files and make them available to the AI IMMEDIATELY — the base64
    // `data` is all Gemini needs. Cloud Storage must never block this.
    setSelectedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input to allow re-adding the same file

    // Best-effort: upload to Firebase Storage in the background for cross-device
    // persistence. If Storage is misconfigured/blocked, the attachment still works.
    newFiles.forEach(async (att) => {
      try {
        const storageRef = firebaseStorageRef(storage, `users/${profile.uid}/attachments/${Date.now()}_${att.name}`);
        await uploadString(storageRef, att.data, 'base64', { contentType: att.type });
        const url = await getDownloadURL(storageRef);
        if (isMountedRef.current) {
          setSelectedFiles(prev => prev.map(f => (f.localId === att.localId && !f.url ? { ...f, url } : f)));
        }
      } catch (err) {
        console.error("Storage upload error (non-blocking):", err);
      }
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const evaluateQuestionQuality = (text?: string): number => {
    const safeText = text || '';
    const length = safeText.length;
    let score = 3; 

    // Logic for Arabic and English complexity
    const isArabic = /[\u0600-\u06FF]/.test(safeText);
    const wordCount = safeText.split(/\s+/).length;

    if (length > 30) score += 1;
    if (length > 60) score += 2;
    if (wordCount > 5) score += 1;
    if (wordCount > 15) score += 2;

    const analyticalTerms = ['how', 'why', 'analyze', 'compare', 'evaluate', 'كيف', 'لماذا', 'حلل', 'قارن', 'قيم'];
    if (analyticalTerms.some(term => safeText.toLowerCase().includes(term))) {
      score += 3;
    }
    
    return Math.min(10, score);
  };

  const handleSubmit = async (e?: React.FormEvent, directInput?: string, overrideAttachments?: { name: string, type: string, data: string }[]) => {
    if (e) e.preventDefault();
    const finalInput = directInput || input;
    const finalAttachments = overrideAttachments || selectedFiles;
    if ((!finalInput.trim() && finalAttachments.length === 0) || isLoading) return;

    // Detect conversational strain & auto-pivot pedagogy if student shows confusion/hesitation
    const strain = detectConversationalStrain(finalInput, activePedagogyStyle);
    let effectivePedagogy = activePedagogyStyle;
    let adaptationReason: string | undefined = undefined;

    if (strain.isConfused) {
      effectivePedagogy = strain.recommendedPedagogy;
      setActivePedagogyStyle(effectivePedagogy);
      adaptationReason = strain.reason;
      if (recordPedagogyFeedback) {
        recordPedagogyFeedback(activePedagogyStyle, false, undefined, 'conversational_confusion');
      }
      const isAr = isArabicLocale(profile.language);
      const isFr = profile.language === 'French';
      const toastMsg = isAr
        ? `تم تكييف الشرح تلقائيًا إلى أسلوب (${PEDAGOGY_STYLES.find(s => s.id === effectivePedagogy)?.labelAr || effectivePedagogy}) لتبسيط المفهوم.`
        : isFr
        ? `Adaptation pédagogique automatique vers (${effectivePedagogy}) pour faciliter la compréhension.`
        : `Automatically adapted pedagogical style to (${PEDAGOGY_STYLES.find(s => s.id === effectivePedagogy)?.labelEn || effectivePedagogy}) to simplify understanding.`;
      toast.info(toastMsg, isAr ? 'تكييف بيداغوجي ذكي' : 'Adaptive Pivot');
    }

    const qualityScore = evaluateQuestionQuality(finalInput);
    
    let currentThreadId = profile.activeThreadId;
    let isCreatingNewThread = false;
    // When true, we'll upgrade the thread title to an AI-generated, content-based
    // name once the first reply is in (the slice below is just an instant placeholder).
    let shouldAutoTitle = false;

    // Auto-create thread if it doesn't exist
    if (!currentThreadId) {
      currentThreadId = Date.now().toString();
      isCreatingNewThread = true;
      shouldAutoTitle = true;
      const suggestedTitle = finalInput.slice(0, 30) + (finalInput.length > 30 ? '...' : '');
      const newThread = {
        id: currentThreadId,
        title: suggestedTitle,
        updatedAt: new Date().toISOString()
      };
      
      const updatedThreads = [...(profile.chatThreads || []), newThread];
      if (setProfile) {
        setProfile({
            ...profile,
            chatThreads: updatedThreads,
            activeThreadId: currentThreadId
        });
      } else {
        profile.chatThreads = updatedThreads;
        profile.activeThreadId = currentThreadId;
      }
      
      // Persist the new thread creation immediately to the user document
      if (profile.uid) {
         setDoc(doc(db, `users/${profile.uid}`), cleanDataForFirestore({ 
           chatThreads: updatedThreads, 
           activeThreadId: currentThreadId 
         }), { merge: true });
      }
    } else if (
      activeThread &&
      finalInput.trim() &&
      activeThread.title === 'New Chat' &&
      messages.filter(m => m.id !== 'welcome' && m.role === 'user').length === 0
    ) {
      shouldAutoTitle = true;
      const suggestedTitle = finalInput.slice(0, 30) + (finalInput.length > 30 ? '...' : '');
      const updatedThreads = (profile.chatThreads || []).map(t => 
        t.id === activeThread.id ? { ...t, title: suggestedTitle } : t
      );
      
      if (setProfile) {
        setProfile({ ...profile, chatThreads: updatedThreads });
      } else {
        profile.chatThreads = updatedThreads; // Immediate local update
      }
      
      if (profile.uid) {
         setDoc(doc(db, `users/${profile.uid}`), cleanDataForFirestore({ chatThreads: updatedThreads }), { merge: true });
      }
    }

    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: finalInput || "Analyzed attached media.",
      timestamp: new Date().toISOString(),
      attachments: finalAttachments
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    
    // Save locally to appropriate Firestore document with Client-Side AES-256-GCM encryption
    if (profile.uid && currentThreadId) {
      const threadPath = `users/${profile.uid}/threads/${currentThreadId}`;
      const historyToSave = cleanMessagesForFirestore(newHistory);
      encryptThreadMessages(historyToSave, profile.uid).then((encryptedDoc) => {
        setDoc(doc(db, threadPath), cleanDataForFirestore(encryptedDoc), { merge: true }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, threadPath);
        });
      }).catch((err) => {
        console.error('[ChatInterface] Security Alert: Encryption failed, refusing plaintext persistence (Fail-Closed):', err);
        toast.error('Encryption failed. Message kept in local session only and not saved to cloud.');
      });
    }
    
    // If the user only attached files with no text, give the model a clear instruction.
    const isArSubmit = isArabicLocale(profile.language);
    const strainKeywords = ['مش فاهم', 'مش فاهمه', 'اتلخبطت', 'مش واضحة', 'مش واضح', 'مش مستوعب', 'lost', 'confused', 'dont understand', "don't understand", 'explain simpler'];
    const hasStrain = strainKeywords.some(kw => (finalInput || '').toLowerCase().includes(kw));
    if (hasStrain) {
      toast.info(
        isArSubmit ? 'تم استشعار الحيرة: سأقوم بتبسيط الشرح واستخدام تشبيه ملموس 🌿' : 'Cognitive strain detected: simplifying with a tangible analogy 🌿',
        isArSubmit ? 'تكييف الشرح' : 'Adaptive Explanation'
      );
    }

    const submittedMessage = finalInput.trim()
      || (finalAttachments.length
        ? "Please analyze the attached file(s) and describe or extract their key content."
        : finalInput);
    setInput("");
    setIsLoading(true);
    stopRef.current = false;
    abortRef.current = new AbortController();
    isSendingRef.current = true;
    lastLocalWriteRef.current = Date.now();
    setStreamingText("");
    const attachmentsToSubmit = [...finalAttachments];
    if (!overrideAttachments) setSelectedFiles([]);

    // Hoisted so the catch block can still recover whatever streamed before an
    // error — never discard text the user already saw being written.
    let lastText = "";
    let streamedAttachments: any[] = [];
    let usedFallback = false;
    try {
      const localSpatial = profile.uid ? getSpatialObjects(profile.uid) : [];
      const studentName = (profile.name || auth.currentUser?.displayName || (profile.email ? profile.email.split('@')[0] : '') || 'Student').trim();
      const calibratedProfile: UserProfile = {
        ...profile,
        name: studentName,
        preferredPedagogyStyle: effectivePedagogy,
        spatialMemories: profile.spatialMemories?.length ? profile.spatialMemories : localSpatial,
      };
      const stream = generateAdaptiveResponseStream(
        submittedMessage,
        calibratedProfile,
        newHistory,
        attachmentsToSubmit,
        abortRef.current?.signal,
        studentState
      );

      for await (const chunk of stream) {
        if (!isMountedRef.current || stopRef.current) break; // user pressed Stop or left
        if ((chunk as any).usedFallback) usedFallback = true;
        if (chunk.text) {
          lastText = chunk.text;
          if (isMountedRef.current) setStreamingText(lastText);
        }
        if (chunk.attachments) {
          streamedAttachments = chunk.attachments;
        }
      }

      const isAr = isArabicLocale(profile.language);

      // If files were sent but the answer came from the text-only fallback
      // provider, it couldn't actually see them — say so plainly.
      if (usedFallback && attachmentsToSubmit.length > 0) {
        toast.warning(
          isAr
            ? 'الرد جه من مزوّد احتياطي نصّي مش بيشوف الصور/الملفات، فالمرفقات اتجاهلت. جرّب تاني بعد شوية عشان يتقري المرفق.'
            : "The answer came from a text-only fallback that can't see images/files, so your attachment was ignored. Try again shortly to have it read.",
          isAr ? 'المرفق اتجاهل' : 'Attachment skipped',
        );
      }
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        // If the stream produced nothing (e.g. all providers overloaded), show a
        // friendly note instead of a blank bubble — never wipe the conversation.
        content: lastText || (isAr
          ? '⚠️ الذكاء الاصطناعي مشغول دلوقتي. جرّب تاني بعد لحظات 🙏'
          : '⚠️ The AI is busy right now. Please try again in a moment 🙏'),
        timestamp: new Date().toISOString(),
        attachments: streamedAttachments,
        pedagogyStyle: effectivePedagogy,
        adaptationReason: adaptationReason
      };

      const updatedHistory = [...newHistory, assistantMessage];
      if (isMountedRef.current) {
        setMessages(updatedHistory);
        setStreamingText("");
      }

      // A blind / low-vision student can't see the reply arrive, so read it to
      // them automatically. (The overlay handles this when it's mounted — skip
      // then, or the answer would be spoken twice over itself.)
      if (profile.accessibilityMode === 'Visual' && lastText && !onStreamingUpdate) {
        handleSpeak(assistantMessage);
      }

      if (onStreamingUpdate) {
        // Trigger TTS directly with the finalized AI text
        onStreamingUpdate(""); // force reset
        setTimeout(() => onStreamingUpdate(lastText), 50);
      }

      // Final persistence with Client-Side AES-256-GCM encryption
      if (profile.uid && currentThreadId) {
        const threadPath = `users/${profile.uid}/threads/${currentThreadId}`;
        const historyToSave = cleanMessagesForFirestore(updatedHistory);
        encryptThreadMessages(historyToSave, profile.uid).then((encryptedDoc) => {
          setDoc(doc(db, threadPath), cleanDataForFirestore(encryptedDoc), { merge: true }).catch(err => {
            handleFirestoreError(err, OperationType.UPDATE, threadPath);
          });
        }).catch((err) => {
          console.error('[ChatInterface] Security Alert: Encryption failed, refusing plaintext persistence (Fail-Closed):', err);
          toast.error('Encryption failed. Final response kept in local session only and not saved to cloud.');
        });
      }

      onQuestionEvaluated(qualityScore, lastText.slice(0, 100));

      // Auto-name the chat from its content (ChatGPT-style) after the first
      // reply. Runs in the background; failures are silent (placeholder stays).
      if (shouldAutoTitle && lastText && profile.uid) {
        const threadId = currentThreadId;
        generateChatTitle(submittedMessage, lastText, profile.language)
          .then((title) => {
            if (!title) return;
            // Build from the LATEST threads (not the stale submit-time closure) so
            // this title write can't revert a lastMessageSnippet/updatedAt that
            // onQuestionEvaluated just saved for the same thread.
            const persist = (latest: typeof profile) => {
              const merged = (latest.chatThreads || []).map(t =>
                t.id === threadId ? { ...t, title } : t
              );
              setDoc(doc(db, `users/${latest.uid}`), cleanDataForFirestore({ chatThreads: merged }), { merge: true })
                .catch(() => { /* title is non-critical */ });
              return merged;
            };
            if (setProfile) {
              // App's setProfile is a React state setter — it accepts the
              // functional form at runtime (prop type is narrowed, so cast).
              (setProfile as (u: any) => void)((prev: any) => ({ ...prev, chatThreads: persist(prev) }));
            } else {
              profile.chatThreads = persist(profile);
            }
          })
          .catch(() => { /* keep placeholder title */ });
      }
    } catch (error: any) {
      // User pressed Stop (aborted the fetch) — not a real error. Keep whatever
      // streamed so far and finalize quietly, no error toast.
      if (error?.name === 'AbortError' || stopRef.current) {
        if (lastText) {
          const stopped: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: lastText,
            timestamp: new Date().toISOString(),
            attachments: streamedAttachments,
            pedagogyStyle: effectivePedagogy,
            adaptationReason: adaptationReason,
          };
          const kept = [...newHistory, stopped];
          setMessages(kept);
          if (syncMessages) syncMessages(kept);
        }
        return; // finally still runs (clears isLoading/streamingText)
      }
      console.error(error);
      const isArabic = isArabicLocale(profile.language);
      // Preserve the user's message. If the model already streamed some text,
      // KEEP it (just flag that it was cut off) instead of throwing it away.
      const errMsg: Message = {
        id: `assistant-err-${Date.now()}`,
        role: 'assistant',
        content: lastText
          ? lastText + (isArabic ? '\n\n⚠️ (الرد اتقطع قبل ما يكمل)' : '\n\n⚠️ (response was cut off)')
          : (isArabic
            ? '⚠️ حصلت مشكلة في الاتصال بالذكاء الاصطناعي. جرّب تاني 🙏'
            : '⚠️ Something went wrong connecting to the AI. Please try again 🙏'),
        timestamp: new Date().toISOString(),
        attachments: streamedAttachments,
        pedagogyStyle: effectivePedagogy,
        adaptationReason: adaptationReason,
      };
      const recovered = [...newHistory, errMsg];
      setMessages(recovered);
      if (syncMessages) syncMessages(recovered);

      toast.error(
        isArabic
          ? `عذراً، حدث خطأ أثناء الاتصال بالخادم: ${error.message || 'يرجى مراجعة حالة الاتصال وإعادة المحاولة'}`
          : `Sorry, an error occurred communicating with the server: ${error.message || 'Please verify connection and retry'}`,
        localize(profile.language, "AI Core Disconnection", "فشل الاتصال بالذكاء الاصطناعي"),
        8000,
        {
          label: localize(profile.language, "Retry Now", "إعادة المحاولة"),
          onClick: () => {
            handleSubmit(undefined, submittedMessage, attachmentsToSubmit);
          }
        }
      );
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setStreamingText("");
      }
      // Mark the end of the turn and start the post-write cooldown so a lagging
      // server snapshot can't overwrite the just-saved reply.
      lastLocalWriteRef.current = Date.now();
      isSendingRef.current = false;
    }
  };

  const [comparingId, setComparingId] = useState<string | null>(null);

  const handleCompareAI = async (message: Message) => {
    if (!profile.uid || !profile.activeThreadId) return;
    setComparingId(message.id);

    // Find the previous user message
    const messageIndex = messages.findIndex(m => m.id === message.id);
    let userPrompt = "Provide an optimal response.";
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userPrompt = messages[i].content;
        break;
      }
    }

    const comparisonText = await generateBenchmarkComparison(message.content, userPrompt, profile);
    
    const updatedMessages = messages.map(m => {
      if (m.id === message.id) {
        const existing = m.comparisons || [];
        return {
          ...m,
          // Label this truthfully. No OpenAI model is contacted anywhere in the
          // app — this review comes from the SAME provider chain that wrote the
          // answer (Gemini → Groq → xAI), so calling it a "ChatGPT Assessment"
          // attributed our own output to a competitor's product.
          comparisons: [...existing, { modelName: localize(profile.language, "Second Opinion", "رأي تانٍ"), content: comparisonText }]
        };
      }
      return m;
    });

    setMessages(updatedMessages);
    setComparingId(null);

    const threadPath = `users/${profile.uid}/threads/${profile.activeThreadId}`;
    const historyToSave = cleanMessagesForFirestore(updatedMessages);
    lastLocalWriteRef.current = Date.now();
    setDoc(doc(db, threadPath), { messages: historyToSave }, { merge: true }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, threadPath);
    });
  };

  const handleReactToMessage = async (messageId: string, reactionType: 'up' | 'down') => {
    if (!profile.uid || !profile.activeThreadId) return;

    let appliedReaction: 'up' | 'down' | undefined = undefined;
    const updatedMessages = messages.map(m => {
      if (m.id === messageId) {
        const newReaction = m.reaction === reactionType ? undefined : reactionType;
        appliedReaction = newReaction;
        return { ...m, reaction: newReaction };
      }
      return m;
    });

    setMessages(updatedMessages);

    const threadPath = `users/${profile.uid}/threads/${profile.activeThreadId}`;
    const historyToSave = cleanMessagesForFirestore(updatedMessages);
    lastLocalWriteRef.current = Date.now();
    setDoc(doc(db, threadPath), { messages: historyToSave }, { merge: true }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, threadPath);
    });

    // Closed-loop Intelligence: emit FEEDBACK_RECORDED and adjust student state pedagogy effectiveness
    if (appliedReaction) {
      const isHelpful = appliedReaction === 'up';
      const targetMsg = messages.find(m => m.id === messageId);
      const pedagogyUsedForMsg = targetMsg?.pedagogyStyle || activePedagogyStyle;

      eventBus.emit('FEEDBACK_RECORDED', profile.uid, {
        messageId,
        pedagogyUsed: pedagogyUsedForMsg,
        helpful: isHelpful,
        conceptId: activeSubjectId,
      });

      recordPedagogyFeedback(
        pedagogyUsedForMsg,
        isHelpful,
        activeSubjectId
      );

      if (!isHelpful) {
        toast.info(
          localize(
            profile.language,
            'Adapting explanation style for upcoming responses...',
            'جاري تكييف أسلوب الشرح للردود القادمة...'
          )
        );
      }
    }
  };

  const handleDownload = (file: {name: string, type: string, data?: string, url?: string}) => {
    const href = attSrc(file);
    if (!href) return;
    const link = document.createElement("a");
    link.href = href;
    if (file.url && !file.data) link.target = '_blank'; // remote file → open/download via URL
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSelectSubject = (subject: StudySubject) => {
    setActiveSubjectId(subject.id);
    const isArabic = isArabicLocale(profile.language);
    const switchPrompt = isArabic
      ? `دعنا نركز الآن على مادة: "${subject.name}". ما هي المفاهيم الأساسية التي سنبدأ بمراجعتها اليوم؟`
      : `Let's focus now on the subject: "${subject.name}". What core concepts should we review today?`;
    handleSubmit(undefined, switchPrompt);
  };

  const handleCiteSource = (source: ContextSource) => {
    const isArabic = isArabicLocale(profile.language);
    const citePrompt = isArabic
      ? `اشرح لي بالتفصيل أحدث الأبحاث والمعلومات المعتمدة من مصدر (${source.name}) حول موضوع دراستنا الحالي.`
      : `Explain in detail the latest verified findings and documentation from (${source.name}) related to our current study topic.`;
    handleSubmit(undefined, citePrompt);
  };

  return (
    <div className={`flex-1 flex flex-col bg-[#0A0C14] text-slate-100 overflow-hidden relative selection:bg-cyan-500/30 selection:text-white ${isEmbedded ? 'h-full' : 'h-[var(--app-h,100dvh)]'}`}>
      {/* Ambient background lighting orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px]" />
      </div>

      {/* File Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 sm:p-10"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreviewFile(null);
            }}
          >
            <div className="absolute top-6 right-6 sm:top-10 sm:right-10 flex gap-3">
              {previewFile.data && (
                <>
                  <button 
                    title="Narrate Document (Blind Accessibility)" 
                    onClick={() => readDocument(previewFile)} 
                    className="text-white hover:text-emerald-300 transition-all bg-[#121524]/90 hover:bg-[#1a1f36] p-2.5 rounded-2xl backdrop-blur-xl border border-slate-800 flex items-center gap-2 px-4 shadow-xl"
                  >
                    <Volume2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{localize(profile.language, 'Hear Content', 'استماع للمحتوى')}</span>
                  </button>
                  <button title="Download" onClick={() => handleDownload(previewFile)} className="text-white hover:text-cyan-400 transition-all bg-[#121524]/90 hover:bg-[#1a1f36] p-2.5 rounded-2xl backdrop-blur-xl border border-slate-800 shadow-xl">
                    <Download className="w-5 h-5" />
                  </button>
                </>
              )}
              <button title="Close" onClick={() => setPreviewFile(null)} className="text-white hover:text-rose-400 transition-all bg-[#121524]/90 hover:bg-[#1a1f36] p-2.5 rounded-2xl backdrop-blur-xl border border-slate-800 shadow-xl">
                <X className="w-5 h-5" />
              </button>
            </div>
            {previewFile.type.startsWith('image/') ? (
              <img
                src={attSrc(previewFile)}
                alt={previewFile.name}
                className="max-w-full max-h-full object-contain shadow-2xl rounded-2xl border border-slate-800"
              />
            ) : previewFile.type.startsWith('video/') ? (
              <video
                src={attSrc(previewFile)}
                controls
                autoPlay
                className="max-w-full max-h-full shadow-2xl rounded-2xl border border-slate-800"
              />
            ) : (previewFile.type === 'application/pdf' || previewFile.name.toLowerCase().endsWith('.pdf')) && previewFile.data ? (
              <div className="w-full max-w-5xl h-[86vh] flex flex-col bg-[#121524]/95 border border-slate-800 rounded-[28px] overflow-hidden shadow-2xl backdrop-blur-2xl">
                <div className="p-4 bg-[#0E111D] border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-black">PDF</span>
                    <span className="text-sm font-bold text-white truncate max-w-md">{previewFile.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={() => readDocument(previewFile)} 
                      disabled={isReadingDocument}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                    >
                      {isReadingDocument ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span>{localize(profile.language, 'Narrate PDF', 'قراءة الـ PDF')}</span>
                    </button>
                    <button 
                      onClick={() => handleDownload(previewFile)} 
                      className="p-1.5 bg-[#0A0C14] hover:bg-slate-800 text-slate-300 hover:text-cyan-400 rounded-xl border border-slate-800 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setPreviewFile(null)} 
                      className="p-1.5 bg-[#0A0C14] hover:bg-slate-800 text-slate-300 hover:text-rose-400 rounded-xl border border-slate-800 transition-colors"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <iframe
                  src={`data:application/pdf;base64,${previewFile.data}`}
                  title={previewFile.name}
                  className="w-full flex-1 border-0 bg-[#0A0C14]"
                />
              </div>
            ) : (
              <div className="bg-[#121524]/95 border border-slate-800 p-8 sm:p-12 rounded-[36px] max-w-2xl w-full text-center space-y-6 backdrop-blur-2xl shadow-2xl">
                <div className="relative inline-block">
                  <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/10">
                    <FileText className="w-10 h-10 text-cyan-400" />
                  </div>
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full"
                  />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">{previewFile.name}</h3>
                <p className="text-slate-400 font-medium text-xs sm:text-sm leading-relaxed">
                  {localize(
                    profile.language,
                    'Full AI document analysis active. Tap "Hear Content" to have the AI narrate this document.',
                    'التحليل الذكي للمستند قيد العمل. اضغط "استماع للمحتوى" لسماع قراءة صوتية ذكية للملف.'
                  )}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                   <button 
                    onClick={() => readDocument(previewFile)} 
                    disabled={isReadingDocument}
                    className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                   >
                     {isReadingDocument ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                     {localize(profile.language, 'Narrate Document', 'قراءة المستند')}
                   </button>
                   <button onClick={() => setPreviewFile(null)} className="px-6 py-3.5 bg-[#0A0C14] border border-slate-800 text-slate-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                     {localize(profile.language, 'Close Preview', 'إغلاق المعاينة')}
                   </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Info */}
      {!isEmbedded && (
        <div className="bg-[#0E111D]/85 border-b border-slate-800/80 backdrop-blur-2xl h-[64px] px-4 md:px-8 flex justify-between items-center z-10 shrink-0 shadow-lg shadow-black/30">
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={onMenuClick}
              className="p-2 -ms-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl active:scale-95 transition-all"
              aria-label="Toggle Sidebar Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <span className="font-black text-base tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Cognify</span>
              <span className="text-xs md:text-sm font-semibold text-slate-400 truncate max-w-[140px] md:max-w-xs flex items-center gap-1.5">
                <span className="text-slate-600">·</span> {activeThread?.title || localize(profile.language, 'AI Session', 'جلسة ذكية')}
              </span>
            </div>
            {profile.accessibilityMode !== 'None' && (
              <button
                onClick={handleDisableAccessibility}
                title={localize(profile.language, 'Accessibility mode is on — click to turn it off', 'وضع الإتاحة شغّال — اضغط لإيقافه')}
                aria-label={localize(profile.language, 'Turn off accessibility mode', 'إيقاف وضع الإتاحة')}
                className="hidden sm:flex items-center gap-1.5 ps-3 pe-2 py-1 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 rounded-full text-[10px] font-black uppercase tracking-wider transition-all group shadow-sm"
              >
                 <Accessibility className="w-3.5 h-3.5" /> {profile.accessibilityMode} {localize(profile.language, 'Mode', 'وضع')}
                 <X className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              </button>
            )}
            {(profile.accessibilityMode === 'Vocal-Deaf' || profile.accessibilityMode === 'Sign-Only') && (
              <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-purple-500/10 animate-pulse">
                 <Sparkles className="w-3.5 h-3.5 text-purple-400" /> {localize(profile.language, 'Sign Interpretation Active', 'ترجمة الإشارة نشطة')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Workspace Toggle Button */}
            <button 
              onClick={() => setShowWorkspace(!showWorkspace)}
              aria-label={localize(profile.language, 'Toggle Workspace Panel', 'تبديل لوحة مساحة العمل')}
              title={localize(profile.language, 'Study Workspace & Subjects', 'مساحة العمل والمواد الدراسية')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                showWorkspace 
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-500/20' 
                  : 'bg-[#121524] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <FolderGit2 className="w-4 h-4 text-cyan-400" />
              <span className="hidden md:inline">{localize(profile.language, 'Workspace', 'مساحة العمل')}</span>
            </button>

            {/* Ergonomics & Comfort Controls */}
            <ChatErgonomicsBar
              fontScale={fontScale}
              onChangeFontScale={handleChangeFontScale}
              isEyeComfort={isEyeComfort}
              onToggleEyeComfort={handleToggleEyeComfort}
              onOpenSearch={() => setIsSearchOpen(prev => !prev)}
              bookmarksCount={bookmarkedInsights.length}
              onOpenBookmarks={() => setIsBookmarksOpen(true)}
              language={profile.language}
            />

            {/* Context & Citations Toggle Button */}
            <button 
              onClick={() => setShowContext(!showContext)}
              aria-label={localize(profile.language, 'Toggle Citations & Context Panel', 'تبديل لوحة المصادر والمراجع')}
              title={localize(profile.language, 'Citations & Grounding Sources', 'المصادر والتوثيق الأكاديمي')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                showContext 
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-lg shadow-indigo-500/20' 
                  : 'bg-[#121524] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <Compass className="w-4 h-4 text-indigo-400" />
              <span className="hidden md:inline">{localize(profile.language, 'Context', 'المصادر')}</span>
            </button>

            <button 
              onClick={() => {
                setShowInsights(!showInsights);
                if (!insights && !showInsights) handleGenerateInsights();
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                showInsights 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-lg shadow-amber-500/20' 
                  : 'bg-[#121524] border-slate-800 text-amber-400/90 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-300'
              }`}
            >
              <Lightbulb className={`w-4 h-4 ${showInsights ? 'text-amber-300 animate-pulse' : 'text-amber-400'}`} />
              <span className="hidden sm:inline">{getTranslation(profile.language, 'insights')}</span>
            </button>
            
            <button 
              onClick={() => setShowTasks(!showTasks)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                showTasks 
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-500/20' 
                  : 'bg-[#121524] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <ListTodo className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">{getTranslation(profile.language, 'tasks')}</span>
              {currentThreadTasks.length > 0 && (
                <span className="bg-cyan-500/30 text-cyan-200 px-1.5 py-0.5 rounded-md text-[10px] font-mono">{currentThreadTasks.length}</span>
              )}
            </button>
            <span className="hidden sm:flex text-[10px] font-black uppercase py-1.5 px-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/30 items-center gap-2 shadow-lg shadow-emerald-500/10">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              AI Assistant v2.0
            </span>
          </div>
        </div>
      )}

      {/* 3-Column AI Study & Command Center Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left Column: Workspace & Study Intelligence */}
        <div className={`shrink-0 z-30 transition-all ${
          showWorkspace 
            ? 'fixed inset-y-0 start-0 xl:static flex h-full' 
            : 'hidden'
        }`}>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm xl:hidden -z-10" 
            onClick={() => setShowWorkspace(false)} 
          />
          <ChatWorkspacePanel
            profile={profile}
            studentState={studentState}
            isOpen={showWorkspace}
            onClose={() => setShowWorkspace(false)}
            activeSubjectId={activeSubjectId}
            onSelectSubject={handleSelectSubject}
            studyMinutes={studyMinutes}
            messageCount={messages.length}
          />
        </div>

        {/* Center Column: Interactive Chat & Input Composer */}
        <div className="flex flex-col flex-1 min-w-0 h-full relative overflow-hidden">
          {/* Side panels can be opened cleanly and easily via the top toolbar icons */}

          {/* Messages */}
          <div className={`flex flex-col flex-1 min-h-0 overflow-hidden relative transition-colors duration-300 ${
            isEyeComfort ? 'bg-[#0E111D] ring-1 ring-amber-500/10' : ''
          }`}>
            {/* In-Session Search Bar */}
            <AnimatePresence>
              {isSearchOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-2.5 bg-[#12162B] border-b border-slate-800 flex items-center justify-between gap-3 shadow-md z-20"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Search className="w-4 h-4 text-cyan-400 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={localize(profile.language, 'Search within this conversation...', 'بحث داخل هذه المحادثة...')}
                      className="bg-transparent text-white text-xs sm:text-sm w-full outline-none placeholder:text-slate-500 font-medium"
                      autoFocus
                    />
                  </div>
                  {searchQuery.trim() && (
                    <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-lg shrink-0">
                      {messages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase())).length}{' '}
                      {localize(profile.language, 'results', 'نتيجة')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
        {/* Screen-reader announcer for blind users: speaks the "thinking" status
            and the FINAL AI reply (not every streamed token, to avoid spam). */}
        <div className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
          {isLoading
            ? getTranslation(profile.language, 'analyzing')
            : ([...messages].reverse().find((m) => m.role !== 'user' && m.id !== 'welcome')?.content || '')}
        </div>
        <div ref={scrollRef} role="region" aria-label={getTranslation(profile.language, 'aiAssistant')} className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 flex flex-col items-center custom-scrollbar">
        {messagesLoading && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
             <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="w-full max-w-3xl space-y-10">
            {messages.filter((m) => m.role === 'user').length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8 sm:py-14 space-y-6 w-full animate-fadeIn">
                <div className="relative">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-cyan-500/20 via-blue-600/20 to-purple-600/20 border border-cyan-500/30 flex items-center justify-center shadow-2xl shadow-cyan-500/10">
                    <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400 animate-pulse" />
                  </div>
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-3xl blur-xl opacity-20 -z-10" />
                </div>

                <div className="space-y-2 max-w-lg">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {localize(profile.language, 'How can I help you today?', 'كيف يمكنني مساعدتك اليوم؟')}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-medium">
                    {localize(
                      profile.language,
                      'Your adaptive AI academic & learning copilot. Ask questions, analyze slides, or practice key concepts.',
                      'رفيقك الأكاديمي والتعليمي الذكي. اسأل أي سؤال، حلل ملفاتك وسلايداتك، أو تدرب على المفاهيم المعقدة.'
                    )}
                  </p>
                </div>

                {/* Starter Prompts Grid */}
                {(() => {
                  const ar = isArabicLocale(profile.language);
                  const f = profile.field || (ar ? 'مجالك' : 'your field');
                  const chips = ar
                    ? [
                        { text: `اشرح لي مفهوم مهم في ${f} ببساطة`, icon: '💡' },
                        { text: `اعمللي خطة مذاكرة لأسبوع`, icon: '📅' },
                        { text: `لخّص لي موضوع أو ملف PDF`, icon: '📄' },
                        { text: `اسألني أسئلة عشان أراجع`, icon: '🎯' },
                      ]
                    : [
                        { text: `Explain a key ${f} concept simply`, icon: '💡' },
                        { text: `Make me a 1-week study plan`, icon: '📅' },
                        { text: `Summarize an article or PDF`, icon: '📄' },
                        { text: `Quiz me to review`, icon: '🎯' },
                      ];
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 w-full max-w-2xl">
                      {chips.map((p) => (
                        <button
                          key={p.text}
                          type="button"
                          onClick={() => handleSubmit(undefined, p.text)}
                          className="text-start text-xs sm:text-sm p-4 rounded-2xl border border-slate-800/80 bg-[#121524]/60 hover:border-cyan-500/50 hover:bg-[#161a2e] text-slate-300 hover:text-white transition-all shadow-lg backdrop-blur-xl active:scale-[0.98] flex items-center gap-3 group cursor-pointer"
                        >
                          <span className="text-xl p-2 rounded-xl bg-[#0A0C14] border border-slate-800 group-hover:border-cyan-500/40 transition-colors shrink-0">{p.icon}</span>
                          <span className="font-semibold leading-snug">{p.text}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <>
                {/* Active Spaced Micro-Retrieval Warmup Banner */}
                <RetentionWarmupBanner
                  uid={profile.uid}
                  retentionSchedules={studentState?.retentionSchedules}
                  personalLearningModel={studentState?.personalLearningModel}
                  language={profile.language}
                  onStartRefresher={(conceptId) => {
                    const isAr = isArabicLocale(profile.language);
                    const isFr = profile.language === 'French';
                    const refresherPrompt = isAr
                      ? `أريد اختبار استرجاع سريع مدته 30 ثانية لتثبيت مفهوم (${conceptId}). اختبرني بسؤال مباشر.`
                      : isFr
                      ? `Je souhaite faire une réactivation rapide de 30 secondes pour consolider le concept (${conceptId}). Pose-moi une question.`
                      : `I'd like a 30-second quick retrieval refresher to consolidate the concept (${conceptId}). Give me a quick question.`;
                    handleSubmit(undefined, refresherPrompt);
                  }}
                />

                {/* Proactive Assistant Opportunity or Grounded Insight Card */}
                {activeProactiveOpportunity && (
                  <ProactiveSuggestionCard
                    opportunity={activeProactiveOpportunity}
                    language={profile.language}
                    onAccept={(prompt) => {
                      handleSubmit(undefined, prompt);
                    }}
                  />
                )}
                {!activeProactiveOpportunity && activeGroundedInsight && (
                  <ProactiveSuggestionCard
                    insight={activeGroundedInsight}
                    language={profile.language}
                    onAccept={(prompt) => {
                      handleSubmit(undefined, prompt);
                    }}
                  />
                )}
              </>
            )}
          <AnimatePresence mode="popLayout">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                id={`msg-${m.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={`flex flex-col w-full group transition-all ${
                  searchQuery.trim() && m.content?.toLowerCase().includes(searchQuery.toLowerCase()) ? 'ring-2 ring-cyan-500/50 rounded-3xl p-1 bg-cyan-500/5' : ''
                } ${
                  isArabicLocale(profile.language)
                    ? (m.role === 'user' ? 'items-start text-start' : 'items-end text-end')
                    : (m.role === 'user' ? 'items-end text-end' : 'items-start text-start')
                }`}
              >
                {m.role === 'user' ? (
                  <div className="space-y-3 max-w-[90%] md:max-w-[80%]">
                    <div className="bg-gradient-to-br from-cyan-950/40 via-blue-950/30 to-[#121524]/90 border border-cyan-500/40 text-white px-5 py-4 rounded-[26px] rounded-ee-md shadow-xl shadow-cyan-950/40 backdrop-blur-xl text-[15px] leading-relaxed font-normal flex flex-col gap-2">
                       {/* Legacy '[Signs: emoji]' lines are dropped */}
                       {(m.content || '').split('\n').filter((line) => !/^\[Signs:\s*.*\]$/i.test(line.trim())).map((line, i) => (
                         <span key={i}>{line}</span>
                       ))}
                    </div>
                    {m.attachments?.length ? m.attachments.map((file, idx) => (
                      <div key={`${m.id}-att-${idx}`} className="relative group max-w-sm">
                        <button 
                          onClick={() => file.data && setPreviewFile(file)}
                          className={`w-full flex items-center gap-3 p-3 bg-[#121524] border border-slate-800 rounded-2xl transition-all ${file.data ? 'hover:border-cyan-500/60 hover:shadow-lg cursor-pointer' : 'opacity-80 cursor-default'}`}
                        >
                           {!file.data ? (
                             <div className="w-10 h-10 shrink-0 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                               <FileText className="w-5 h-5 text-orange-400" />
                             </div>
                           ) : file.type.startsWith('image/') ? (
                             <div className="w-10 h-10 shrink-0 rounded-xl overflow-hidden bg-[#0A0C14] border border-slate-800">
                               <img src={`data:${file.type};base64,${file.data}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                             </div>
                           ) : file.type.startsWith('video/') ? (
                             <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800 overflow-hidden relative">
                               <video src={`data:${file.type};base64,${file.data}`} className="w-full h-full object-cover opacity-50" />
                               <div className="absolute inset-0 flex items-center justify-center">
                                 <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-white border-b-[4px] border-b-transparent ml-0.5"></div>
                                </div>
                             </div>
                           ) : (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) ? (
                              <div className="w-10 h-10 shrink-0 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                                <span className="text-[11px] font-black text-rose-400">PDF</span>
                              </div>
                            ) : (
                             <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                               <FileText className="w-5 h-5 text-cyan-400" />
                             </div>
                           )}
                           <div className="text-left flex-1 min-w-0">
                             <p className="text-xs font-bold text-white truncate w-full">{file.name}</p>
                             <p className={`text-[10px] font-black uppercase tracking-widest ${file.data ? 'text-slate-500' : 'text-orange-400'}`}>
                               {file.data ? 'Click to View' : 'Media Expired'}
                             </p>
                           </div>
                        </button>
                        {file.data && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                readDocument(file);
                              }}
                              className="bg-[#0A0C14] border border-slate-800 text-slate-300 hover:text-emerald-400 p-2 rounded-xl transition-all"
                              title={getTranslation(profile.language, 'hearContent')}
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(file);
                              }}
                              className="bg-[#0A0C14] border border-slate-800 text-slate-300 hover:text-cyan-400 p-2 rounded-xl transition-all"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )) : null}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-lg border shadow-sm ${
                        evaluateQuestionQuality(m.content) >= 8 ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' :
                        evaluateQuestionQuality(m.content) >= 5 ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                        'bg-slate-800/60 text-slate-400 border-slate-700'
                      }`}>
                        {evaluateQuestionQuality(m.content) >= 8 ? getTranslation(profile.language, 'excellentQuestion') :
                         evaluateQuestionQuality(m.content) >= 5 ? getTranslation(profile.language, 'goodQuestion') : getTranslation(profile.language, 'basicQuestion')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-[92%] md:max-w-[88%] w-full">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400 text-[11px] font-black uppercase tracking-wider">
                        <Bot className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{localize(profile.language, 'Cognify Guidance', 'إجابة كوجنيفي الذكية')}</span>
                      </div>

                      {/* Epistemic Pedagogy Badge & Explainability Trigger */}
                      {(() => {
                        const pStyle = m.pedagogyStyle || activePedagogyStyle;
                        const pMeta = PEDAGOGY_STYLES.find(st => st.id === pStyle);
                        if (!pMeta) return null;
                        const isAr = isArabicLocale(profile.language);
                        const isFr = profile.language === 'French';
                        const label = isAr ? pMeta.labelAr : isFr ? (pMeta.id === 'analogies' ? 'Analogies' : pMeta.id === 'technical' ? 'Technique' : pMeta.id === 'scaffolded' ? 'Pas à pas' : 'Socratique') : pMeta.labelEn;
                        const isExplainOpen = expandedExplainMessageId === m.id;

                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              title={localize(profile.language, pMeta.descriptionEn, pMeta.descriptionAr)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] font-bold"
                            >
                              <span>{pMeta.id === 'analogies' ? '💡' : pMeta.id === 'technical' ? '⚡' : pMeta.id === 'scaffolded' ? '🪜' : '❓'}</span>
                              <span>{label}</span>
                            </span>

                            {/* Interactive Explainability Badge */}
                            <button
                              type="button"
                              onClick={() => setExpandedExplainMessageId(isExplainOpen ? null : m.id)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                                isExplainOpen
                                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/20'
                                  : m.adaptationReason
                                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:border-amber-400 animate-pulse'
                                  : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:border-cyan-500/40 hover:text-cyan-200'
                              }`}
                              title={localize(profile.language, 'Why this explanation style?', 'لماذا تم اختيار هذا الأسلوب التعليمي؟')}
                            >
                              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                              <span>{isAr ? 'لماذا هذا الأسلوب؟' : isFr ? 'Pourquoi ce style ?' : 'Why this style?'}</span>
                            </button>
                          </div>
                        );
                      })()}

                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg border ${
                        profile.level === 'Advanced' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
                        profile.level === 'Intermediate' ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' :
                        'bg-orange-500/15 text-orange-300 border-orange-500/30'
                      }`}>
                        {getTranslation(profile.language, 'difficultyLevel')}: {profile.level} ({profile.role})
                      </span>
                      {('speechSynthesis' in window) && (
                        <button 
                          onClick={() => handleSpeak(m)}
                          className={`text-[10px] font-black uppercase transition-all px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
                            speakingMessageId === m.id
                              ? 'bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-500/30 animate-pulse'
                              : 'bg-[#0A0C14] text-slate-300 hover:text-white border-slate-800 hover:border-cyan-500/40'
                          }`}
                        >
                          {speakingMessageId === m.id ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                              {localize(profile.language, 'Stop', 'إيقاف')}
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                              {localize(profile.language, 'Speak', 'استماع')}
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="relative p-6 sm:p-7 rounded-[32px] bg-[#121524]/90 border border-slate-800/80 text-slate-100 leading-relaxed adaptive-response text-base space-y-4 shadow-2xl backdrop-blur-2xl hover:border-slate-700/80 transition-all w-full group/bubble">
                      {(profile.accessibilityMode === 'Vocal-Deaf' || profile.accessibilityMode === 'Sign-Only') && m.id !== 'welcome' && m.content?.trim() && (
                        <div className="mb-4">
                          <button
                            onClick={() => setSigningId(signingId === m.id ? null : m.id)}
                            aria-label={localize(profile.language, 'Show this reply in sign language', 'اعرض الرد بلغة الإشارة')}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 hover:border-purple-400 text-purple-300 hover:text-white text-xs font-bold transition-all shadow-lg shadow-purple-500/10 active:scale-95"
                          >
                            <Accessibility className="w-4 h-4 text-purple-400" />
                            {signingId === m.id
                              ? localize(profile.language, 'Hide sign avatar', 'إخفاء الأفاتار')
                              : localize(profile.language, 'Show in sign language', 'اعرض بلغة الإشارة')}
                          </button>
                          {signingId === m.id && (
                            <div className="mt-3 h-64 sm:h-72 rounded-2xl overflow-hidden bg-[#0A0C14] border border-slate-800 relative shadow-2xl">
                              <React.Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-bold uppercase tracking-widest">Loading avatar…</div>}>
                                <SignAvatar3D words={wordsForSigning(m.content)} playing={true} onDone={() => { /* stays on last pose */ }} />
                              </React.Suspense>
                            </div>
                          )}
                        </div>
                      )}
                      <MarkdownMessage 
                        content={m.content} 
                        fontScale={fontScale}
                        language={profile.language}
                        onPrerequisiteClick={(prereqId) => {
                          const isAr = isArabicLocale(profile.language);
                          const isFr = profile.language === 'French';
                          const text = isAr
                            ? `أريد مراجعة المفهوم الأساسي (${prereqId}) أولاً قبل المتابعة.`
                            : isFr
                            ? `Je souhaite revoir le concept prérequis (${prereqId}) avant de continuer.`
                            : `I'd like to review the prerequisite concept (${prereqId}) before moving on.`;
                          handleSubmit(undefined, text);
                        }}
                      />
                    </div>
                    
                    {/* Assistant Attachments (Generated Images/Videos) */}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-4 mt-4">
                        {m.attachments.map((file, idx) => (
                          <div key={`${m.id}-gen-att-${idx}`} className="relative group">
                            <button
                              onClick={() => attSrc(file) && setPreviewFile(file)}
                              className={`flex flex-col items-center gap-2 p-2 bg-[#121524] border border-slate-800 rounded-2xl transition-all overflow-hidden ${attSrc(file) ? 'hover:border-cyan-500/60 hover:shadow-lg cursor-pointer' : 'opacity-80 cursor-default'}`}
                            >
                               {!attSrc(file) ? (
                                 <div className="w-48 h-48 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 flex-col gap-2">
                                   <FileText className="w-10 h-10 text-orange-400" />
                                   <span className="text-[10px] font-black text-orange-400 uppercase">Media Expired</span>
                                 </div>
                               ) : file.type.startsWith('image/') ? (
                                 <div className="w-48 h-48 rounded-xl overflow-hidden bg-[#0A0C14] border border-slate-800">
                                   <img src={attSrc(file)} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                 </div>
                               ) : file.type.startsWith('video/') ? (
                                 <div className="w-48 h-48 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800 overflow-hidden relative">
                                   <video src={attSrc(file)} className="w-full h-full object-cover opacity-70" />
                                   <div className="absolute inset-0 flex items-center justify-center group-hover:scale-110 transition-transform">
                                     <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[15px] border-l-white border-b-[10px] border-b-transparent ml-1 drop-shadow-lg"></div>
                                   </div>
                                 </div>
                               ) : null}
                               <div className="text-center w-full px-2 py-1">
                                 <p className="text-[11px] font-bold text-slate-200 truncate w-full">{file.name}</p>
                                 <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${attSrc(file) ? 'text-slate-500' : 'text-orange-400'}`}>
                                   {attSrc(file) ? 'Click to Enlarge' : 'Media Removed (Size Limit)'}
                                 </p>
                               </div>
                            </button>
                            {attSrc(file) && (
                              <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    readDocument(file);
                                  }}
                                  className="bg-emerald-500/90 hover:bg-emerald-500 text-white p-2 rounded-xl backdrop-blur-sm transition-all shadow-md"
                                  title="Hear Content"
                                >
                                  <Volume2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(file);
                                  }}
                                  className="bg-black/80 hover:bg-black p-2 rounded-xl text-white backdrop-blur-sm transition-all shadow-md"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Benchmark comparisons */}
                    {m.comparisons && m.comparisons.map((comp, idx) => (
                      <div key={idx} className="mt-4 p-6 bg-[#0E111D] text-slate-200 rounded-3xl border border-slate-800 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-3">
                          <Scale className="w-5 h-5 text-cyan-400" />
                          <h4 className="font-black text-white tracking-widest uppercase text-xs">{comp.modelName}</h4>
                        </div>
                        <div className="space-y-3 text-xs opacity-90 font-mono leading-relaxed text-slate-300">
                          {(comp.content || '').split('\n').map((line, lidx) => (
                            <p key={lidx}>{line}</p>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className={`mt-3 flex gap-2 items-center justify-end transition-opacity ${m.reaction ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <div className="flex items-center gap-1.5 mr-auto">
                        <button
                          onClick={() => handleReactToMessage(m.id, 'up')}
                          className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                            m.reaction === 'up'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20'
                              : 'text-slate-400 bg-[#0A0C14] border-slate-800 hover:text-white hover:border-slate-700'
                          }`}
                          title="Thumbs Up / Helpful"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>{localize(profile.language, 'Helpful', 'مفيد')}</span>
                        </button>
                        <button
                          onClick={() => handleReactToMessage(m.id, 'down')}
                          className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                            m.reaction === 'down'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm shadow-rose-500/20'
                              : 'text-slate-400 bg-[#0A0C14] border-slate-800 hover:text-white hover:border-slate-700'
                          }`}
                          title="Thumbs Down / Unhelpful"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>{localize(profile.language, 'Unhelpful', 'غير مفيد')}</span>
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(m.content).then(
                              () => toast.success(
                                localize(profile.language, 'Copied', 'تم النسخ'),
                              ),
                              () => {},
                            );
                          }}
                          className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 text-slate-400 bg-[#0A0C14] border-slate-800 hover:text-cyan-400 hover:border-cyan-500/30"
                          title={localize(profile.language, "Copy answer", "نسخ الإجابة")}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{localize(profile.language, 'Copy', 'نسخ')}</span>
                        </button>

                        {/* 1-Click Transform: Simplify (ELI5) */}
                        <button
                          type="button"
                          onClick={() => handleSimplify(m)}
                          className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 text-slate-400 bg-[#0A0C14] border-slate-800 hover:text-purple-300 hover:border-purple-500/30 active:scale-95 cursor-pointer"
                          title={localize(profile.language, 'Explain this in simpler terms (ELI5)', 'شرح مبسط بدون أي تعقيد')}
                        >
                          <Zap className="w-3.5 h-3.5 text-purple-400" />
                          <span>{localize(profile.language, 'Simplify', 'بسّط')}</span>
                        </button>

                        {/* 1-Click Bookmark / Save key insight */}
                        <button
                          type="button"
                          onClick={() => handleToggleBookmark(m)}
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                            bookmarkedInsights.some((b) => b.messageId === m.id)
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20'
                              : 'text-slate-400 bg-[#0A0C14] border-slate-800 hover:text-amber-300 hover:border-amber-500/30'
                          }`}
                          title={localize(profile.language, 'Pin to saved insights', 'تثبيت في بنك الأفكار')}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${bookmarkedInsights.some((b) => b.messageId === m.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                          <span>{localize(profile.language, 'Pin', 'تثبيت')}</span>
                        </button>
                      </div>

                      <button 
                        onClick={() => handleCompareAI(m)}
                        disabled={comparingId === m.id}
                        className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 bg-[#0A0C14] px-3 py-1.5 rounded-xl border border-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {comparingId === m.id ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> {localize(profile.language, 'Reviewing…', 'جاري المراجعة…')}</>
                        ) : (
                          <><Scale className="w-3.5 h-3.5 text-cyan-400" /> {localize(profile.language, 'Second opinion', 'رأي تانٍ')}</>
                        )}
                      </button>
                    </div>

                    {/* Subtle, elegant obsidian "Why this approach? / لماذا هذا الأسلوب؟" collapsible panel below tutor responses */}
                  {(() => {
                    const pStyle = (m.pedagogyStyle || activePedagogyStyle) as PedagogyStrategy;
                    const isAr = isArabicLocale(profile.language);
                    const isExplainOpen = expandedExplainMessageId === m.id;
                    const detectedConcept = detectConceptFromText(m.content)?.id;
                    const rationale = explainPedagogyChoice(pStyle, studentState, detectedConcept);
                    const pMeta = PEDAGOGY_STYLES.find((st) => st.id === pStyle);

                    return (
                      <div className="space-y-2 pt-1">
                        {/* Toggle Bar */}
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setExpandedExplainMessageId(isExplainOpen ? null : m.id)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                              isExplainOpen
                                ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200 shadow-md shadow-cyan-500/10'
                                : m.adaptationReason
                                ? 'bg-[#121524] border-amber-500/40 text-amber-300 hover:border-amber-400'
                                : 'bg-[#121524]/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                            title={localize(profile.language, 'Why Cognify used this pedagogical approach', 'التعليل التربوي لاختيار هذا الأسلوب التعليمي')}
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{localize(profile.language, 'Why this approach?', 'لماذا هذا الأسلوب؟')}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExplainOpen ? 'rotate-180 text-cyan-300' : 'text-slate-400'}`} />
                          </button>

                          {isExplainOpen && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              rationale.confidenceLevel === 'high'
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                : rationale.confidenceLevel === 'calibrating'
                                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}>
                              {rationale.confidenceLevel === 'high'
                                ? localize(profile.language, 'Empirically Validated (N >= 3)', 'معايرة إحصائية مثبتة')
                                : rationale.confidenceLevel === 'calibrating'
                                ? localize(profile.language, 'Calibrating Modality', 'جاري معايرة النمط')
                                : localize(profile.language, 'Provisional Heuristic', 'توجيه تكيفي أولي')}
                            </span>
                          )}
                        </div>

                        {/* Collapsible Panel */}
                        <AnimatePresence>
                          {isExplainOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, height: 0 }}
                              animate={{ opacity: 1, y: 0, height: 'auto' }}
                              exit={{ opacity: 0, y: -6, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-5 rounded-2xl bg-gradient-to-br from-[#101426] via-[#12162a] to-[#0d1020] border border-cyan-500/30 text-xs text-slate-200 shadow-2xl backdrop-blur-xl space-y-3.5">
                                {/* Header */}
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                                      <Sparkles className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div>
                                      <div className="font-bold text-white text-xs">
                                        {localize(profile.language, 'Adaptive Pedagogy Rationale', 'التعليل التربوي للاستراتيجية المتبعة')}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {isAr ? pMeta?.labelAr || pStyle : pMeta?.labelEn || pStyle}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedExplainMessageId(null)}
                                    className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                                    title="Close"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {/* Diagnostic Trigger */}
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                                    {localize(profile.language, 'Diagnostic Trigger', 'المحفز التشخيصي')}
                                  </div>
                                  <div className="text-xs text-slate-200 font-medium">
                                    {rationale.trigger}
                                  </div>
                                </div>

                                {/* Pedagogical Rationale */}
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                                    {localize(profile.language, 'Why This Strategy Was Selected', 'لماذا تم اختيار هذا الأسلوب؟')}
                                  </div>
                                  <p className="text-xs leading-relaxed text-slate-300">
                                    {m.adaptationReason
                                      ? m.adaptationReason
                                      : isAr
                                      ? rationale.rationaleAr
                                      : rationale.rationaleEn}
                                  </p>
                                </div>

                                {/* Empirical Evidence */}
                                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                    {localize(profile.language, 'Empirical Evidence', 'الأدلة التفاعلية')}
                                  </div>
                                  <p className="text-[11px] text-slate-300 font-mono">
                                    {rationale.evidence}
                                  </p>
                                </div>

                                {/* Pedagogical Goal */}
                                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
                                  <span className="font-semibold text-slate-300">
                                    {localize(profile.language, 'Goal:', 'الهدف التعليمي:')}
                                  </span>
                                  <span>
                                    {isAr ? rationale.pedagogicalGoalAr : rationale.pedagogicalGoalEn}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}
                </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Smart Follow-Up Action Chips under the latest assistant response */}
          {!isLoading && (() => {
            const lastAssistantMsg = [...messages].reverse().find(m => m.role !== 'user' && m.id !== 'welcome');
            if (!lastAssistantMsg) return null;
            return (
              <SmartFollowUpChips
                lastMessageContent={lastAssistantMsg.content}
                language={profile.language}
                onSelectChip={(prompt) => handleSubmit(undefined, prompt)}
                isLoading={isLoading}
              />
            );
          })()}



          {isLoading && (
            <motion.div
              key="streaming-block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3 w-full"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg border bg-cyan-500/15 text-cyan-300 border-cyan-500/30">
                  Level: {profile.level} ({profile.role})
                </span>
              </div>
              
              {streamingText ? (
                <div className="p-6 sm:p-7 rounded-[32px] bg-[#121524]/90 border border-slate-800/80 text-slate-100 leading-relaxed adaptive-response text-base space-y-4 shadow-2xl backdrop-blur-2xl">
                  <MarkdownMessage content={streamingText} />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-6 bg-[#121524]/70 rounded-2xl border border-cyan-500/30 italic text-cyan-300 shadow-xl backdrop-blur-xl">
                  <span className="flex items-center gap-1.5" aria-label="Assistant is typing">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
                  </span>
                  <span className="font-bold tracking-wide">{getTranslation(profile.language, 'analyzing')}</span>
                </div>
              )}
            </motion.div>
          )}
          </div>
        )}
        </div>

        {/* Task Panel */}
        <AnimatePresence>
          {showTasks && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: isEmbedded ? '100%' : (window.innerWidth < 768 ? '100%' : 320), opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              style={{ right: 0, top: 0, bottom: 0, zIndex: 40 }}
              className={`bg-[#0E111D]/95 border-s border-slate-800/90 backdrop-blur-2xl overflow-y-auto flex flex-col shadow-2xl shrink-0 ${isEmbedded ? 'absolute' : 'absolute md:relative'}`}
            >
              <div className="p-4 border-b border-slate-800/80 bg-[#121524]/90 flex justify-between items-center shrink-0 backdrop-blur-md">
                <h3 className="font-black text-white flex items-center gap-2.5 text-sm tracking-wide">
                  <ListTodo className="w-5 h-5 text-cyan-400" /> Thread Tasks
                </h3>
                <button 
                  onClick={() => setShowTasks(false)} 
                  className="p-1.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
                  aria-label="Close tasks panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                <form onSubmit={handleAddTask} className="flex gap-2">
                  <input
                    type="text"
                    id="new-task"
                    name="new-task"
                    aria-label="New task"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    placeholder="New task..."
                    className="flex-1 bg-[#0A0C14] border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 shadow-inner"
                  />
                  <button 
                    type="submit" 
                    disabled={!newTaskInput.trim()} 
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white p-2.5 rounded-xl disabled:opacity-40 transition-all shadow-md shadow-cyan-500/20 active:scale-95"
                    aria-label="Add task"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>
                <div className="space-y-2">
                  {currentThreadTasks.length === 0 ? (
                     <div className="text-center p-6 text-slate-500 italic text-sm border border-dashed border-slate-800 rounded-2xl bg-[#0A0C14]/40">
                       No tasks for this thread yet.
                     </div>
                  ) : (
                    currentThreadTasks.map(task => (
                      <div 
                        key={task.id} 
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                          task.completed 
                            ? 'bg-[#0A0C14]/60 border-slate-800/50 opacity-60 text-slate-400' 
                            : 'bg-[#121524] border-slate-800/90 text-white shadow-lg shadow-black/20 hover:border-slate-700'
                        }`}
                      >
                        <button 
                          onClick={() => handleToggleTask(task.id)} 
                          className={`mt-0.5 shrink-0 transition-colors ${task.completed ? 'text-emerald-400' : 'text-slate-500 hover:text-cyan-400'}`}
                          aria-label={task.completed ? "Mark task as incomplete" : "Mark task as complete"}
                        >
                          {task.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        </button>
                        <p className={`flex-1 text-sm ${task.completed ? 'line-through text-slate-500' : 'text-slate-200 font-medium'}`}>
                          {task.content}
                        </p>
                        <button 
                          onClick={() => handleDeleteTask(task.id)} 
                          className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-xl transition-colors shrink-0"
                          aria-label="Delete task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Insights Panel */}
        <AnimatePresence>
          {showInsights && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: isEmbedded ? '100%' : (window.innerWidth < 768 ? '100%' : 340), opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              style={{ right: 0, top: 0, bottom: 0, zIndex: 40 }}
              className={`bg-[#0E111D]/95 border-s border-amber-500/30 backdrop-blur-2xl overflow-y-auto flex flex-col shadow-2xl shrink-0 ${isEmbedded ? 'absolute' : 'absolute md:relative'}`}
            >
              <div className="p-4 border-b border-amber-500/20 bg-[#17140e]/90 flex justify-between items-center shrink-0 backdrop-blur-md">
                <h3 className="font-black text-amber-300 flex items-center gap-2 text-sm tracking-wide">
                  <Lightbulb className="w-5 h-5 text-amber-400 animate-pulse" /> {getTranslation(profile.language, 'proactiveInsights')}
                </h3>
                <button 
                  onClick={() => setShowInsights(false)} 
                  className="p-1.5 hover:bg-amber-500/10 rounded-xl text-amber-400/80 hover:text-amber-300 transition-colors"
                  aria-label="Close insights panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                {isGeneratingInsights ? (
                  <div className="flex flex-col items-center justify-center p-8 text-amber-300 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                    <span className="text-sm font-medium text-amber-300/80">Analyzing thread & profile...</span>
                  </div>
                ) : (
                  <>
                    <div 
                      className="p-6 rounded-3xl shadow-2xl text-slate-200 border border-amber-500/30 bg-[#121524]/90 backdrop-blur-xl leading-relaxed" 
                      style={{ boxShadow: '0 10px 30px -5px rgba(251, 191, 36, 0.15)' }}
                    >
                      {insights ? (
                        <div className="markdown-body font-medium text-slate-200">
                          <Markdown>{insights}</Markdown>
                        </div>
                      ) : (
                        <span className="text-slate-300 font-bold tracking-tight">Click refresh to generate new insights.</span>
                      )}
                    </div>
                    
                    <button 
                      onClick={handleGenerateInsights}
                      className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-98"
                    >
                      <RefreshCw className="w-4 h-4" /> {getTranslation(profile.language, 'regenerateInsights')}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area — compact and pinned */}
      <div className="shrink-0 py-1.5 px-2 sm:px-4 border-t border-slate-800/80 bg-[#0E111D]/95 backdrop-blur-2xl relative shadow-[0_-10px_20px_-8px_rgba(0,0,0,0.5)] z-20">
        <div className="max-w-2xl mx-auto space-y-1">

          {/* Mouse Minimize / Expand Handle */}
          <div className="flex items-center justify-center -mt-1 pb-0.5">
            <button
              type="button"
              onClick={() => {
                setIsToolsExpanded(!isToolsExpanded);
                setShowPedagogyPopover(false);
                setShowQuickActionsPopover(false);
              }}
              className="group flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 hover:text-cyan-300 hover:bg-slate-800/70 transition-all cursor-pointer select-none"
              title={isToolsExpanded ? (localize(profile.language, "Minimize composer height", "تصغير الارتفاع للوضع المدمج")) : (localize(profile.language, "Expand full toolbars", "توسيع شريط الأدوات بالكامل"))}
              aria-label={isToolsExpanded ? "Minimize composer height" : "Expand composer toolbars"}
            >
              <span className="w-5 sm:w-8 h-0.5 rounded-full bg-slate-700 group-hover:bg-cyan-400 transition-colors" />
              {isToolsExpanded ? (
                <>
                  <ChevronDown className="w-3 h-3 text-cyan-400 group-hover:translate-y-0.5 transition-transform" />
                  <span>{localize(profile.language, 'Minimize', 'تصغير')}</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3 h-3 text-slate-400 group-hover:text-cyan-400 group-hover:-translate-y-0.5 transition-transform" />
                  <span className="text-slate-400 group-hover:text-cyan-300 transition-colors">{localize(profile.language, 'Tools & Styles', 'الأدوات والأنماط')}</span>
                </>
              )}
              <span className="w-5 sm:w-8 h-0.5 rounded-full bg-slate-700 group-hover:bg-cyan-400 transition-colors" />
            </button>
          </div>

          {/* Expanded Full Toolbars (when isToolsExpanded is true) */}
          <AnimatePresence>
            {isToolsExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-1.5 pb-1"
              >
                {/* Quick-Action Study Command Toolbar */}
                <ChatQuickActions
                  profile={profile}
                  onUploadDocument={() => fileInputRef.current?.click()}
                  onQuickPrompt={(promptText) => handleSubmit(undefined, promptText)}
                  disabled={isLoading}
                />

                {/* Top Bar: Adaptive Pedagogy Style Bar + France Travel Voice & Mic Language */}
                <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar scrollbar-none py-0.5 px-1 bg-[#121524]/60 border border-slate-800/60 rounded-2xl">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider shrink-0">
                      {localize(profile.language, 'Pedagogy:', 'أسلوب الشرح:')}
                    </span>
                    {PEDAGOGY_STYLES.map((st) => {
                      const isSelected = activePedagogyStyle === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSelectPedagogy(st.id)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                            isSelected
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400/40 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/30'
                              : 'bg-[#121524] text-slate-400 border-slate-800/90 hover:bg-[#181d33] hover:text-white'
                          }`}
                          title={localize(profile.language, st.descriptionEn, st.descriptionAr)}
                        >
                          <span>{localize(profile.language, st.labelEn, st.labelAr)}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* France Travel Assistant & Mic Language Switcher */}
                  <div className="flex items-center gap-2 shrink-0 ms-auto">
                    <button
                      type="button"
                      onClick={() => setShowFrenchTravelAssistant(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-300 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/25 active:scale-95 transition-all shadow-sm shrink-0"
                      title={localize(profile.language, 'Open France Travel & Voice Assistant', 'فتح دليل ومترجم فرنسا الصوتي')}
                    >
                      <span>🇫🇷</span>
                      <span className="hidden sm:inline">{localize(profile.language, 'France Guide', 'دليل فرنسا')}</span>
                    </button>

                    <div className="flex items-center bg-[#121524] border border-slate-800/90 rounded-xl p-0.5 shadow-inner" title="Speech Recognition Language">
                      {[
                        { code: 'fr-FR' as const, label: '🇫🇷 FR' },
                        { code: 'en-US' as const, label: '🇬🇧 EN' },
                        { code: 'ar-EG' as const, label: '🇪🇬 AR' },
                      ].map(({ code, label }) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            setDictationLang(code);
                            if (isListening && recognitionRef.current) {
                              try { recognitionRef.current.lang = code; } catch {}
                            }
                          }}
                          className={`text-[10px] font-black px-2 py-0.5 rounded-lg transition-all ${
                            dictationLang === code
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selected Files Preview Chips */}
          <AnimatePresence>
            {selectedFiles.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-wrap gap-2 mb-1"
              >
                {selectedFiles.map((file, i) => {
                  const isImg = file.type.startsWith('image/');
                  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                  return (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1 bg-[#121524] rounded-xl border border-slate-700/80 group shadow-md backdrop-blur-md">
                      {isImg && file.data ? (
                        <img 
                          src={`data:${file.type};base64,${file.data}`} 
                          alt="" 
                          className="w-5 h-5 rounded-md object-cover border border-slate-700 shrink-0" 
                        />
                      ) : isPdf ? (
                        <div className="w-5 h-5 rounded-md bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-black text-rose-400">PDF</span>
                        </div>
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-slate-200 truncate max-w-[120px]">{file.name}</span>
                      <button 
                        onClick={() => removeFile(i)} 
                        className="text-slate-400 hover:text-rose-400 p-0.5 rounded hover:bg-rose-500/10 transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Click-away backdrop for Popovers */}
          {(showPedagogyPopover || showQuickActionsPopover) && (
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => {
                setShowPedagogyPopover(false);
                setShowQuickActionsPopover(false);
              }} 
            />
          )}

          {/* Single Compact Chat Rectangle Form (Matching Image 2) */}
          <form onSubmit={handleSubmit} className="relative group">
            <input
              type="file"
              id="chat-file-upload"
              name="chat-file-upload"
              aria-label="Attach images or PDF files"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
              accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.webp,.txt"
            />
            
            <div className={`relative w-full rounded-2xl bg-[#121524]/90 border border-slate-800/90 shadow-xl backdrop-blur-2xl focus-within:border-cyan-500/60 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all p-1 sm:p-1.5 flex flex-col justify-between ${isListening ? 'border-cyan-400 ring-4 ring-cyan-500/20' : ''}`}>
              
              {/* Upper Section: Textarea Input */}
              <div className="relative w-full flex items-center">
                <textarea
                  id="chat-composer"
                  name="chat-composer"
                  aria-label={getTranslation(profile.language, 'typeMessage')}
                  rows={1}
                  value={input + (interimTranscript ? (input ? " " : "") + interimTranscript : "")}
                  onChange={(e) => setInput(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={(e) => {
                    // Enter sends, Shift+Enter inserts a newline
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isLoading && (input.trim() || selectedFiles.length > 0)) handleSubmit();
                    }
                  }}
                  disabled={isLoading}
                  placeholder={isListening ? (localize(profile.language, "Listening...", 'جاري الاستماع...')) : (localize(profile.language, "Ask Cognify or type a message...", "اسأل كوجنيفاي أو اكتب رسالتك..."))}
                  className="w-full bg-transparent text-white border-0 px-2.5 pt-1 pb-0.5 outline-none placeholder:text-slate-500 disabled:opacity-50 relative z-0 resize-none min-h-[30px] max-h-28 leading-snug text-xs sm:text-sm font-normal custom-scrollbar"
                />

                {interimTranscript && (
                  <div className="absolute end-3 top-2 pointer-events-none z-10">
                    <span className="flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
                    </span>
                  </div>
                )}
              </div>

              {/* Lower Section: Action Bar inside the Single Rectangle */}
              <div className="flex items-center justify-between gap-1 pt-0.5 px-0.5 border-t border-slate-800/40 mt-0.5">
                
                {/* Left Side: + File Attach, Pedagogy Pill, Tools Pill */}
                <div className="flex items-center gap-1">
                  {/* + Attach File Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach images or PDF files"
                    title={localize(profile.language, 'Attach images or PDF documents', 'إرفاق صور أو مستندات PDF')}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:bg-slate-800/80 transition-all border border-transparent hover:border-slate-700/60"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* Active Pedagogy Dropdown Pill */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPedagogyPopover(!showPedagogyPopover);
                        setShowQuickActionsPopover(false);
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-cyan-300 border border-slate-700/60 text-[10px] font-bold transition-all shadow-sm active:scale-95"
                      title={localize(profile.language, "Change teaching style", "تغيير أسلوب الشرح")}
                    >
                      <span className="truncate max-w-[85px] sm:max-w-[115px]">
                        ⚡ {localize(profile.language, activePedagogyMeta.labelEn, activePedagogyMeta.labelAr)}
                      </span>
                      <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform ${showPedagogyPopover ? 'rotate-180 text-cyan-300' : ''}`} />
                    </button>

                    {/* Floating Pedagogy Popover Menu */}
                    <AnimatePresence>
                      {showPedagogyPopover && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-full mb-2 start-0 w-64 bg-[#121524] border border-slate-700/90 rounded-2xl p-2 shadow-2xl backdrop-blur-2xl z-40 space-y-1"
                        >
                          <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 mb-1">
                            {localize(profile.language, 'Pedagogy Style', 'أسلوب الشرح')}
                          </div>
                          {PEDAGOGY_STYLES.map((st) => {
                            const isSelected = activePedagogyStyle === st.id;
                            return (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  handleSelectPedagogy(st.id);
                                  setShowPedagogyPopover(false);
                                }}
                                className={`w-full text-start px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex flex-col gap-0.5 ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/40'
                                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{localize(profile.language, st.labelEn, st.labelAr)}</span>
                                  {isSelected && <span className="text-cyan-400 text-xs">✓</span>}
                                </div>
                                <span className="text-[10px] text-slate-400 font-normal leading-tight">
                                  {localize(profile.language, st.descriptionEn, st.descriptionAr)}
                                </span>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* AI Quick Tools Popover Pill */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickActionsPopover(!showQuickActionsPopover);
                        setShowPedagogyPopover(false);
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 text-[10px] font-bold transition-all shadow-sm active:scale-95"
                      title={localize(profile.language, "Quick study tools", "أدوات دراسية سريعة")}
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                      <span className="hidden xs:inline sm:inline">{localize(profile.language, 'Tools', 'الأدوات')}</span>
                      <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform ${showQuickActionsPopover ? 'rotate-180 text-amber-300' : ''}`} />
                    </button>

                    {/* Floating Quick Tools Popover Menu */}
                    <AnimatePresence>
                      {showQuickActionsPopover && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-full mb-2 start-0 w-64 bg-[#121524] border border-slate-700/90 rounded-2xl p-2 shadow-2xl backdrop-blur-2xl z-40 space-y-1"
                        >
                          <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 mb-1">
                            {localize(profile.language, 'Quick AI Tools', 'أدوات الذكاء الاصطناعي')}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              fileInputRef.current?.click();
                              setShowQuickActionsPopover(false);
                            }}
                            className="w-full text-start px-2.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-all"
                          >
                            <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span>{localize(profile.language, 'Analyze Document / PDF', 'تحليل مستند / PDF')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSubmit(undefined, isArabic ? 'أنشئ بطاقات استذكار تفاعلية (Flashcards) مع أسئلة وإجابات مركزة تلخص أهم المفاهيم التي شرحتها لي الآن.' : 'Generate active recall flashcards with clear questions and answers summarizing the key concepts we just discussed.');
                              setShowQuickActionsPopover(false);
                            }}
                            className="w-full text-start px-2.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-all"
                          >
                            <Layers className="w-4 h-4 text-purple-400 shrink-0" />
                            <span>{localize(profile.language, 'Generate Flashcards', 'إنشاء بطاقات استذكار')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSubmit(undefined, isArabic ? 'أعطني 3 مسائل تدريبية متدرجة الصعوبة لاختبار فهمي لما تعلمته للتو، مع تلميحات توجيهية لحل كل مسألة.' : 'Give me 3 progressive practice exercises/problems based on this topic, with guided hints for solving each one.');
                              setShowQuickActionsPopover(false);
                            }}
                            className="w-full text-start px-2.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-all"
                          >
                            <BrainCircuit className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{localize(profile.language, 'Practice Problems', 'مسائل تدريبية')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSubmit(undefined, isArabic ? 'أعد شرح الفكرة الأخيرة بأسلوب مبسط جداً ومن زاوية مختلفة، واستخدم تشبيهاً واقعياً من الحياة اليومية.' : 'Please re-explain the last concept using a fresh perspective and an intuitive, real-world analogy.');
                              setShowQuickActionsPopover(false);
                            }}
                            className="w-full text-start px-2.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-all"
                          >
                            <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>{localize(profile.language, 'Re-explain', 'إعادة الشرح بأسلوب آخر')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSubmit(undefined, isArabic ? 'لخص لي هذا الموضوع في 3 نقاط جوهرية مركزة وواضحة جداً (Key Takeaways).' : 'Summarize the core takeaways of this topic into 3 crisp, essential bullet points.');
                              setShowQuickActionsPopover(false);
                            }}
                            className="w-full text-start px-2.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-all"
                          >
                            <Lightbulb className="w-4 h-4 text-cyan-300 shrink-0" />
                            <span>{localize(profile.language, 'Key Takeaways', 'الخلاصة وأهم النقاط')}</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Right Side: France Guide, Language Cycle, Mic, Send / Stop */}
                <div className="flex items-center gap-1">
                  {/* France Guide Button */}
                  <button
                    type="button"
                    onClick={() => setShowFrenchTravelAssistant(true)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-300 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/25 active:scale-95 transition-all shadow-sm shrink-0"
                    title={localize(profile.language, 'Open France Travel Assistant', 'دليل ومترجم فرنسا')}
                  >
                    <span>🇫🇷</span>
                    <span className="hidden md:inline text-[9px]">{localize(profile.language, 'Guide', 'دليل')}</span>
                  </button>

                  {/* Dictation Language Cycle Pill */}
                  <button
                    type="button"
                    onClick={() => {
                      const langs: Array<'fr-FR' | 'en-US' | 'ar-EG'> = ['fr-FR', 'en-US', 'ar-EG'];
                      const nextIdx = (langs.indexOf(dictationLang) + 1) % langs.length;
                      const next = langs[nextIdx];
                      setDictationLang(next);
                      if (isListening && recognitionRef.current) {
                        try { recognitionRef.current.lang = next; } catch {}
                      }
                    }}
                    className="text-[9px] font-black px-1.5 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-all shrink-0"
                    title={localize(profile.language, 'Click to switch speech language (FR/EN/AR)', 'اضغط لتبديل لغة الاستماع (فرنسي/إنجليزي/عربي)')}
                  >
                    {dictationLang === 'fr-FR' ? '🇫🇷 FR' : dictationLang === 'ar-EG' ? '🇪🇬 AR' : '🇬🇧 EN'}
                  </button>

                  {/* Speech Dictation Mic Button */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    aria-label={isListening ? localize(profile.language, "Stop voice input", "إيقاف الإدخال الصوتي") : localize(profile.language, "Start voice input", "بدء الإدخال الصوتي")}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                      isListening ? 'text-rose-400 bg-rose-500/20 border border-rose-500/40 animate-pulse shadow-md shadow-rose-500/20' : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800/80'
                    }`}
                    title={isListening ? "Listening... (Tap to stop)" : "Tap to Speak (Voice Input)"}
                  >
                    {isListening ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Send or Stop Generation Button */}
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={() => { stopRef.current = true; abortRef.current?.abort(); }}
                      title={localize(profile.language, "Stop generating", "إيقاف التوليد")}
                      aria-label={localize(profile.language, "Stop generating", "إيقاف التوليد")}
                      className="w-7 h-7 sm:w-7.5 sm:h-7.5 bg-slate-900 border border-slate-700 text-white rounded-lg flex items-center justify-center hover:bg-slate-800 transition-all shadow-sm active:scale-95 shrink-0"
                    >
                      <Square className="w-3 h-3 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim() && selectedFiles.length === 0}
                      aria-label={localize(profile.language, "Send message", "إرسال")}
                      className="w-7 h-7 sm:w-7.5 sm:h-7.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg flex items-center justify-center hover:from-cyan-400 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:border disabled:border-slate-800 disabled:shadow-none transition-all shadow-sm shadow-cyan-500/20 active:scale-95 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

              </div>
            </div>
          </form>

          <p className="text-center text-[10px] text-slate-500 mt-0.5 px-2 tracking-wide font-medium">
            {localize(profile.language, 'Cognify can make mistakes. Check important information.', 'كوجنيفاي ممكن يخطئ. راجِع المعلومات المهمة.')}
          </p>
        </div>
      </div>
      {/* End Center Column */}
      </div>

      {/* Right Column: Context & Citations */}
      <div className={`shrink-0 z-30 transition-all ${
        showContext 
          ? 'fixed inset-y-0 end-0 xl:static flex h-full' 
          : 'hidden'
      }`}>
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm xl:hidden -z-10" 
          onClick={() => setShowContext(false)} 
        />
        <ChatContextPanel
          profile={profile}
          studentState={studentState}
          isOpen={showContext}
          onClose={() => setShowContext(false)}
          onCiteSource={handleCiteSource}
          messageCount={messages.length}
        />
      </div>
    </div>
    {/* End 3-Column AI Study Center Layout */}

      {/* Bookmarks & Saved Insights Drawer */}
      <ChatBookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        bookmarks={bookmarkedInsights}
        onRemoveBookmark={handleRemoveBookmark}
        onJumpToMessage={handleJumpToMessage}
        language={profile.language}
      />

      {/* French Travel & Voice Assistant Modal */}
      {showFrenchTravelAssistant && (
        <div className="fixed inset-0 z-50 bg-[#07090F]/85 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn">
          <div className="bg-[#0E111D] rounded-3xl border border-slate-800/90 shadow-[0_20px_70px_rgba(0,0,0,0.8)] w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden relative">
            <React.Suspense fallback={<div className="p-8 text-center text-slate-400">Chargement...</div>}>
              <FrenchTravelVoiceAssistant
                profile={profile}
                onNavigateBack={() => setShowFrenchTravelAssistant(false)}
              />
            </React.Suspense>
          </div>
        </div>
      )}
    </div>
  );
});

export default ChatInterface;
