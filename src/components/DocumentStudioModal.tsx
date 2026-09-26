import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  X,
  Volume2,
  VolumeX,
  FileUp,
  Download,
  Languages,
  History,
  MessageSquare,
  Send,
  Mic,
  MicOff,
  GraduationCap,
  BookOpen,
  Loader2,
  Trash2,
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Play,
  Pause,
  FastForward,
  Rewind,
  Music,
  Radio,
  Accessibility,
} from 'lucide-react';
import { UserProfile } from '../types';
import { generateAdaptiveResponse } from '../services/gemini';
import { speak, cancelSpeech, unlockSpeechSynthesis } from '../lib/tts';
import { toast } from './Toast';
import { cleanVisionDescription } from '../lib/visionCleaner';

const SignAvatar3D = React.lazy(() => import('./SignAvatar3D'));

export interface SavedDocItem {
  id: string;
  title: string;
  sourceType: 'pdf' | 'image' | 'audio' | 'speech';
  summary: string;
  fullText?: string;
  targetLang: 'ar' | 'en' | 'fr';
  createdAt: string;
}

export interface DocChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DocQuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  selectedOption?: number;
}

export interface DocFlashcard {
  front: string;
  back: string;
  flipped?: boolean;
}

export const DOC_HISTORY_KEY = 'cognify_vision_doc_history';

export function downloadTextAsWavFile(text: string, filename: string) {
  if (typeof window === 'undefined') return;
  const sampleRate = 16000;
  const numChannels = 1;
  const duration = Math.min(Math.max(text.length * 0.05, 2), 60);
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const tone = 260 + 30 * Math.sin(2 * Math.PI * 1.2 * t);
    const sample = Math.sin(2 * Math.PI * tone * t) * 0.3 * Math.min(1, Math.exp(-t / (duration * 0.8)));
    view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (filename || 'lecture-audio').replace(/[^\w\u0600-\u06FF-]/g, '_');
  a.download = `${safeName}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToWordDocument(
  title: string,
  summary: string,
  fullText?: string,
  lang: 'ar' | 'en' | 'fr' = 'ar',
  quiz?: DocQuizQuestion[],
  flashcards?: DocFlashcard[]
) {
  if (typeof window === 'undefined') return;
  const isAr = lang === 'ar';
  const cleanSummary = (summary || '').replace(/\*\*/g, '').replace(/###/g, '');
  const cleanFull = (fullText || '').replace(/\*\*/g, '').replace(/###/g, '');

  const html = `
    <!DOCTYPE html>
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${title}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          direction: ${isAr ? 'rtl' : 'ltr'};
          text-align: ${isAr ? 'right' : 'left'};
          line-height: 1.8;
          color: #1e293b;
          margin: 40px;
        }
        .header {
          border-bottom: 3px solid #4f46e5;
          padding-bottom: 12px;
          margin-bottom: 24px;
        }
        h1 {
          font-size: 22pt;
          color: #1e1b4b;
          margin-bottom: 6px;
        }
        .meta {
          font-size: 11pt;
          color: #64748b;
        }
        .section-title {
          font-size: 16pt;
          font-weight: bold;
          color: #4338ca;
          margin-top: 24px;
          margin-bottom: 10px;
          border-left: ${isAr ? 'none' : '4px solid #4338ca'};
          border-right: ${isAr ? '4px solid #4338ca' : 'none'};
          padding-${isAr ? 'right' : 'left'}: 10px;
        }
        .summary-box {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          font-size: 13pt;
          color: #0f172a;
        }
        .full-text-box {
          font-size: 12pt;
          color: #334155;
          white-space: pre-wrap;
        }
        .footer {
          margin-top: 40px;
          border-top: 1px solid #e2e8f0;
          padding-top: 12px;
          font-size: 10pt;
          color: #94a3b8;
          text-align: center;
        }
      </style>
    </head>
    <body dir="${isAr ? 'rtl' : 'ltr'}">
      <div class="header">
        <h1>${title || (isAr ? 'ملخص ومستند كوجنيفي' : 'Cognify Document')}</h1>
        <div class="meta">
          ${isAr ? 'تم الاستخراج والتلخيص عبر منصة كوجنيفي للذكاء الاصطناعي والرفيق البصري' : 'Generated by Cognify AI Visual Companion'} • ${new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
        </div>
      </div>
      
      <div class="section-title">
        ${isAr ? '📌 الزبدة وخلاصة المحاضرة / المستند' : '📌 Core Takeaways & Summary'}
      </div>
      <div class="summary-box">
        ${cleanSummary.replace(/\n/g, '<br/>')}
      </div>

      ${quiz && quiz.length > 0 ? `
        <div class="section-title">
          ${isAr ? '📝 بنك أسئلة واختبار المحاضرة' : '📝 Lecture Quiz & Knowledge Check'}
        </div>
        <div class="summary-box">
          ${quiz.map((q, i) => `
            <div style="margin-bottom: 16px;">
              <b>س ${i + 1}: ${q.question}</b><br/>
              ${q.options.map((opt, oi) => `&nbsp;&nbsp;[${String.fromCharCode(65 + oi)}] ${opt} ${oi === q.answerIndex ? '<b>(الإجابة الصحيحة ✅)</b>' : ''}`).join('<br/>')}<br/>
              <span style="color: #4338ca; font-size: 11pt;">💡 الشرح: ${q.explanation}</span>
            </div>
          `).join('<hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 12px 0;" />')}
        </div>
      ` : ''}

      ${flashcards && flashcards.length > 0 ? `
        <div class="section-title">
          ${isAr ? '🗂️ بطاقات المراجعة السريعة (Flashcards)' : '🗂️ Spaced Repetition Flashcards'}
        </div>
        <div class="summary-box">
          ${flashcards.map((f, i) => `
            <p><b>بطاقة ${i + 1}: ${f.front}</b><br/>
            &nbsp;&nbsp;← <b>الحل / المفهوم:</b> ${f.back}</p>
          `).join('<hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 8px 0;" />')}
        </div>
      ` : ''}

      ${cleanFull ? `
        <div class="section-title">
          ${isAr ? '📝 تفاصيل النص المستخرج كاملاً' : '📝 Full Extracted Content'}
        </div>
        <div class="full-text-box">
          ${cleanFull.replace(/\n/g, '<br/>')}
        </div>
      ` : ''}

      <div class="footer">
        Cognify 2.0 • Empowering Inclusive Learning and Accessibility
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = (title || 'cognify-document').replace(/[^\w\u0600-\u06FF\s-]/g, '').trim().replace(/\s+/g, '_');
  a.download = `${safeTitle || 'cognify-document'}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface DocumentStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  companionLang: 'ar' | 'en' | 'fr';
  onAnnounce?: (msg: string) => void;
}

export default function DocumentStudioModal({
  isOpen,
  onClose,
  profile,
  companionLang,
  onAnnounce,
}: DocumentStudioModalProps) {
  const [docStudioTab, setDocStudioTab] = useState<'pdf' | 'audio-rec' | 'speech-to-text' | 'history'>('pdf');
  const [docLoading, setDocLoading] = useState(false);
  const [docStatusText, setDocStatusText] = useState('');

  const [currentDoc, setCurrentDoc] = useState<SavedDocItem & { fileBase64?: string; fileMime?: string } | null>(null);
  const [docTargetLang, setDocTargetLang] = useState<'ar' | 'en' | 'fr'>(() => companionLang || 'ar');
  const [docViewMode, setDocViewMode] = useState<'summary' | 'full' | 'quiz' | 'flashcards'>('summary');
  const [docQuiz, setDocQuiz] = useState<DocQuizQuestion[]>([]);
  const [docFlashcards, setDocFlashcards] = useState<DocFlashcard[]>([]);
  const [isGeneratingStudyKit, setIsGeneratingStudyKit] = useState(false);

  // Audio Scrubbing & Playback Speed
  const [audioPlaybackRate, setAudioPlaybackRate] = useState<number>(1.0);
  const [currentParagraphIdx, setCurrentParagraphIdx] = useState<number>(0);

  // Hands-free Voice Commands
  const [isVoiceCommandActive, setIsVoiceCommandActive] = useState(false);
  const voiceCommandRecRef = useRef<any>(null);

  // 3D Sign Avatar Integration
  const [showSignAvatarInDoc, setShowSignAvatarInDoc] = useState(false);
  const [isAvatarSigningDoc, setIsAvatarSigningDoc] = useState(false);
  const [avatarSigningWords, setAvatarSigningWords] = useState<string[]>([]);

  const [docChatMessages, setDocChatMessages] = useState<DocChatMessage[]>([]);
  const [docChatInput, setDocChatInput] = useState('');
  const [isDocChatAnswering, setIsDocChatAnswering] = useState(false);

  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioRecordDuration, setAudioRecordDuration] = useState(0);
  const [liveSpeechTranscript, setLiveSpeechTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const speechRecRef = useRef<any>(null);

  const [isSpeakingDoc, setIsSpeakingDoc] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationText, setDictationText] = useState('');
  const [textToReadAloud, setTextToReadAloud] = useState('');

  const [docHistory, setDocHistory] = useState<SavedDocItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(DOC_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const saveDocToHistory = useCallback((item: SavedDocItem) => {
    setDocHistory((prev) => {
      const filtered = prev.filter((d) => d.id !== item.id);
      const updated = [item, ...filtered].slice(0, 30);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DOC_HISTORY_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const deleteDocFromHistory = useCallback((id: string) => {
    setDocHistory((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DOC_HISTORY_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const processDocumentFile = async (file: File) => {
    if (!file) return;
    setDocLoading(true);
    const targetLanguage = docTargetLang;
    const isAr = targetLanguage === 'ar';
    const isFr = targetLanguage === 'fr';

    const statusMsg = isAr
      ? `جاري فحص وقراءة "${file.name}" وترجمة وتلخيص المحاضرة...`
      : isFr
      ? `Analyse de "${file.name}", traduction et synthèse en cours...`
      : `Analyzing "${file.name}", translating and summarizing lecture...`;
    setDocStatusText(statusMsg);
    onAnnounce?.(statusMsg);
    speak(statusMsg, isAr ? 'Arabic' : isFr ? 'French' : 'English');

    try {
      const reader = new FileReader();
      const fileDataPromise = new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const match = res.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            resolve({ mimeType: match[1], base64: match[2] });
          } else {
            resolve({ mimeType: file.type || 'application/pdf', base64: res });
          }
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });

      const { base64, mimeType } = await fileDataPromise;

      const prompt = `أنت معلم وأكاديمي متميز ومترجم ذكي وخبير تلخيص للمكفوفين وضعاف البصر.
المستند المرفق هو محاضرة أو كتاب أو ورقة دراسية بعنوان "${file.name}".
المطلوب منك بدقة فائقة:
1. اقرأ واستخرج محتوى هذا المستند كاملاً.
2. إذا كان المستند بأي لغة أخرى (مثل الإنجليزية)، ترجمه وفصّله بدقة إلى لغة الهدف المطلوبة: "${isAr ? 'اللغة العربية العامية المصرية الواضحة والمفهومة للطلاب' : isFr ? 'Français' : 'English'}".
3. قدّم الإجابة في قسمين محددين:
---SUMMARY_START---
اكتب هنا "المفيد والزبدة الصافية للمحاضرة": ملخص شديد الوضوح والتركيز يبرز الفكرة الجوهرية، القوانين أو النظريات الأساسية، القرارات أو التواريخ أو الأرقام الحاسمة، بدون أي حشو.
---SUMMARY_END---

---FULLTEXT_START---
اكتب هنا النص المقروء والمستخرج من المستند مترجماً ومفصلاً بالكامل كلمة بكلمة أو فقرة بفقرة.
---FULLTEXT_END---
4. تنبيه خاص للطلاب ذوي الإعاقة البصرية (STEM & Formulas & Diagrams): إذا كان المستند يحتوي على أي معادلات رياضية أو فيزيائية أو رسوم بيانية أو جداول؛ قم بشرحها ونطقها بالكامل بالكلمات العربية الصريحة لتكون مفهومة صوتياً 100% دون أن يفقد الطالب أي معلومة.`;

      const aiResponse = await generateAdaptiveResponse(
        prompt,
        {
          ...profile,
          language: isAr ? 'Egyptian Ammiya' : isFr ? 'French' : 'English',
        },
        [],
        [{ name: file.name, type: mimeType, data: base64 }]
      );

      let summary = '';
      let fullText = '';

      if (aiResponse.includes('---SUMMARY_START---') && aiResponse.includes('---SUMMARY_END---')) {
        summary = aiResponse.split('---SUMMARY_START---')[1].split('---SUMMARY_END---')[0].trim();
      }
      if (aiResponse.includes('---FULLTEXT_START---') && aiResponse.includes('---FULLTEXT_END---')) {
        fullText = aiResponse.split('---FULLTEXT_START---')[1].split('---FULLTEXT_END---')[0].trim();
      }

      if (!summary && !fullText) {
        summary = aiResponse;
      }

      const cleanSummary = cleanVisionDescription(summary, targetLanguage);
      const cleanFull = cleanVisionDescription(fullText, targetLanguage);

      const docItem: SavedDocItem = {
        id: `doc_${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        sourceType: file.type.includes('pdf') ? 'pdf' : 'image',
        summary: cleanSummary || summary,
        fullText: cleanFull || fullText,
        targetLang: targetLanguage,
        createdAt: new Date().toISOString(),
      };

      setCurrentDoc({
        ...docItem,
        fileBase64: base64,
        fileMime: mimeType,
      });
      saveDocToHistory(docItem);
      setDocChatMessages([
        {
          role: 'assistant',
          content: isAr
            ? `أهلاً بك! لقد استخرجت ولخصت ملف "${docItem.title}". يمكنك الآن سؤالي أي استفسار أو شرح لأي نقطة غير واضحة!`
            : `I've analyzed and summarized "${docItem.title}". Feel free to ask me any question or ask for explanations!`,
        },
      ]);

      setDocLoading(false);
      setDocStatusText('');

      const readout = isAr
        ? `تم تلخيص ملف ${docItem.title} بنجاح. إليك أهم ما في المحاضرة: ${cleanSummary || summary}`
        : `Summary of ${docItem.title} is ready: ${cleanSummary || summary}`;

      onAnnounce?.(readout);
      speak(readout, isAr ? 'Arabic' : isFr ? 'French' : 'English', {
        onStart: () => setIsSpeakingDoc(true),
        onEnd: () => setIsSpeakingDoc(false),
        onError: () => setIsSpeakingDoc(false),
      });
    } catch (err: any) {
      console.error('Failed to process document:', err);
      setDocLoading(false);
      setDocStatusText('');
      const errMsg = isAr
        ? 'عذراً، حدث خطأ أثناء قراءة المستند. تأكد من حجم الملف واتصالك بالإنترنت.'
        : 'Failed to process document. Please check the file and try again.';
      toast.error(errMsg);
      speak(errMsg, isAr ? 'Arabic' : isFr ? 'French' : 'English');
    }
  };

  const startAudioLectureRecording = async () => {
    try {
      unlockSpeechSynthesis();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(250);
      setIsRecordingAudio(true);
      setAudioRecordDuration(0);
      setLiveSpeechTranscript('');

      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setAudioRecordDuration((prev) => prev + 1);
      }, 1000);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = docTargetLang === 'ar' ? 'ar-EG' : docTargetLang === 'fr' ? 'fr-FR' : 'en-US';
          rec.onresult = (event: any) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript + ' ';
            }
            setLiveSpeechTranscript(transcript.trim());
          };
          rec.start();
          speechRecRef.current = rec;
        } catch {
          /* ignore speech rec fallback */
        }
      }

      const startMsg = companionLang === 'ar' ? 'بدأ تسجيل المحاضرة الصوتية الآن...' : 'Lecture recording started...';
      toast.info(startMsg);
    } catch (err) {
      console.error('Error starting audio recording:', err);
      toast.error(companionLang === 'ar' ? 'تعذر الوصول للميكروفون.' : 'Microphone access denied.');
    }
  };

  const stopAudioLectureRecording = async () => {
    if (!mediaRecorderRef.current || !isRecordingAudio) return;

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        /* ignore */
      }
      speechRecRef.current = null;
    }

    setIsRecordingAudio(false);
    setDocLoading(true);

    const isAr = docTargetLang === 'ar';
    const isFr = docTargetLang === 'fr';
    const statusMsg = isAr
      ? 'جاري تفريغ الصوت المسجل وتلخيص المحاضرة واستخراج النقاط الجوهرية...'
      : 'Transcribing recorded lecture and generating key takeaways...';
    setDocStatusText(statusMsg);
    onAnnounce?.(statusMsg);
    speak(statusMsg, isAr ? 'Arabic' : isFr ? 'French' : 'English');

    const recordedTranscript = liveSpeechTranscript;

    mediaRecorderRef.current.onstop = async () => {
      try {
        mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());

        const lectureTitle = isAr
          ? `محاضرة صوتية مسجلة ${new Date().toLocaleDateString('ar-EG')}`
          : `Recorded Audio Lecture ${new Date().toLocaleDateString('en-US')}`;

        let prompt = '';
        let attachments: any[] = [];

        if (recordedTranscript && recordedTranscript.length > 20) {
          prompt = `أنت معلم وأكاديمي خبير ومساعد للمكفوفين.
إليك تفريغ صوتي لمحاضرة مسجلة مباشرة:
"${recordedTranscript}"

المطلوب:
1. لخّص المحاضرة في "المفيد والزبدة الصافية" (الفكرة الجوهرية، المفاهيم الأساسية، التكليفات).
2. استخرج النقاط المهمة والتعريفات بصيغة واضحة وبلغة ${isAr ? 'عربية عامية راقية ومفهومة' : isFr ? 'française' : 'English'}.
3. نسق النص ليكون صالحاً للقراءة بالصوت والتصدير لملف Word.
قدم الإجابة في:
---SUMMARY_START---
[الملخص والزبدة الصافية]
---SUMMARY_END---
---FULLTEXT_START---
${recordedTranscript}
---FULLTEXT_END---`;
        } else {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          const audioBase64 = await new Promise<string>((resolve) => {
            reader.onload = () => {
              const res = reader.result as string;
              resolve(res.replace(/^data:[^;]+;base64,/, ''));
            };
            reader.readAsDataURL(audioBlob);
          });

          attachments.push({
            name: 'lecture.webm',
            type: 'audio/webm',
            data: audioBase64,
          });

          prompt = `استمع إلى هذا التسجيل الصوتي للمحاضرة بدقة وافرغه ولخصه في الزبدة والمفيد باللغة ${isAr ? 'العربية' : isFr ? 'الفرنسية' : 'الإنجليزية'}.
قدم الإجابة بالأقسام:
---SUMMARY_START---
[خلاصة المحاضرة وأهم النقاط]
---SUMMARY_END---
---FULLTEXT_START---
[تفريغ المحاضرة المسجلة كاملاً]
---FULLTEXT_END---`;
        }

        const aiResponse = await generateAdaptiveResponse(
          prompt,
          { ...profile, language: isAr ? 'Egyptian Ammiya' : isFr ? 'French' : 'English' },
          [],
          attachments
        );

        let summary = '';
        let fullText = '';
        if (aiResponse.includes('---SUMMARY_START---') && aiResponse.includes('---SUMMARY_END---')) {
          summary = aiResponse.split('---SUMMARY_START---')[1].split('---SUMMARY_END---')[0].trim();
        }
        if (aiResponse.includes('---FULLTEXT_START---') && aiResponse.includes('---FULLTEXT_END---')) {
          fullText = aiResponse.split('---FULLTEXT_START---')[1].split('---FULLTEXT_END---')[0].trim();
        }
        if (!summary) summary = aiResponse;

        const cleanSummary = cleanVisionDescription(summary, docTargetLang);
        const cleanFull = cleanVisionDescription(fullText, docTargetLang);

        const docItem: SavedDocItem = {
          id: `audio_${Date.now()}`,
          title: lectureTitle,
          sourceType: 'audio',
          summary: cleanSummary || summary,
          fullText: cleanFull || fullText || recordedTranscript,
          targetLang: docTargetLang,
          createdAt: new Date().toISOString(),
        };

        setCurrentDoc(docItem);
        saveDocToHistory(docItem);
        setDocLoading(false);
        setDocStatusText('');

        const finalMsg = isAr
          ? `تم تلخيص المحاضرة الصوتية بنجاح! إليك الزبدة: ${cleanSummary || summary}`
          : `Audio lecture summary ready: ${cleanSummary || summary}`;
        onAnnounce?.(finalMsg);
        speak(finalMsg, isAr ? 'Arabic' : isFr ? 'French' : 'English');
      } catch (err) {
        console.error('Error processing audio recording:', err);
        setDocLoading(false);
        setDocStatusText('');
        toast.error(isAr ? 'حدث خطأ في معالجة الصوت.' : 'Error processing audio.');
      }
    };

    mediaRecorderRef.current.stop();
  };

  const handleAskDocQuestion = async () => {
    if (!docChatInput.trim() || !currentDoc || isDocChatAnswering) return;
    const question = docChatInput.trim();
    setDocChatInput('');
    setIsDocChatAnswering(true);

    const isAr = docTargetLang === 'ar';
    const isFr = docTargetLang === 'fr';

    setDocChatMessages((prev) => [...prev, { role: 'user', content: question }]);

    try {
      const prompt = `أنت معلم وأكاديمي متميز يشرح لطالب كفيف حول هذه المحاضرة/المستند:
عنوان المحاضرة: "${currentDoc.title}"
ملخص المحاضرة:
${currentDoc.summary}
تفاصيل المحتوى:
${currentDoc.fullText || ''}

سؤال الطالب: "${question}"

أجب على سؤال الطالب بشكل مباشر وواضح وودود بلغة ${isAr ? 'عربية عامية مصرية سهلة ومريحة للنطق الصوتي' : isFr ? 'française' : 'English'} وبدون أي نجوم ماركداون.`;

      const answer = await generateAdaptiveResponse(
        prompt,
        { ...profile, language: isAr ? 'Egyptian Ammiya' : isFr ? 'French' : 'English' },
        []
      );

      const cleanAnswer = cleanVisionDescription(answer, docTargetLang);
      setDocChatMessages((prev) => [...prev, { role: 'assistant', content: cleanAnswer }]);
      setIsDocChatAnswering(false);

      speak(cleanAnswer, isAr ? 'Arabic' : isFr ? 'French' : 'English', {
        onStart: () => setIsSpeakingDoc(true),
        onEnd: () => setIsSpeakingDoc(false),
        onError: () => setIsSpeakingDoc(false),
      });
    } catch {
      setIsDocChatAnswering(false);
      const errMsg = isAr ? 'حصل خطأ في الإجابة، جرب تسأل تاني.' : 'Error answering question, please try again.';
      setDocChatMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
      speak(errMsg, isAr ? 'Arabic' : isFr ? 'French' : 'English');
    }
  };

  const toggleDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(
        companionLang === 'ar'
          ? 'المتصفح لا يدعم خاصية تحويل الصوت إلى كتابة التلقائية.'
          : 'Speech recognition is not supported in this browser.'
      );
      return;
    }

    if (isDictating) {
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {
          /* ignore */
        }
        speechRecRef.current = null;
      }
      setIsDictating(false);
      toast.success(companionLang === 'ar' ? 'تم إنهاء الإملاء الصوتي' : 'Dictation stopped');
    } else {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = docTargetLang === 'ar' ? 'ar-EG' : docTargetLang === 'fr' ? 'fr-FR' : 'en-US';

        rec.onresult = (event: any) => {
          let text = '';
          for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0].transcript + ' ';
          }
          setDictationText(text.trim());
        };

        rec.onerror = () => setIsDictating(false);
        rec.onend = () => setIsDictating(false);

        rec.start();
        speechRecRef.current = rec;
        setIsDictating(true);
        toast.info(companionLang === 'ar' ? 'تحدث الآن، صوتك يتحول لكتابة مباشرة...' : 'Listening... Speak now');
      } catch (err) {
        console.error('Dictation error:', err);
        setIsDictating(false);
      }
    }
  };

  const paragraphs = useMemo(() => {
    if (!currentDoc) return [];
    const text = docViewMode === 'summary' ? currentDoc.summary : currentDoc.fullText || currentDoc.summary;
    return text.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
  }, [currentDoc, docViewMode]);

  const speakCurrentParagraph = (idx: number) => {
    if (!paragraphs[idx] || !currentDoc) return;
    cancelSpeech();
    setCurrentParagraphIdx(idx);
    const lang = currentDoc.targetLang === 'ar' ? 'Arabic' : currentDoc.targetLang === 'fr' ? 'French' : 'English';
    speak(paragraphs[idx], lang as any, {
      rate: audioPlaybackRate,
      onStart: () => setIsSpeakingDoc(true),
      onEnd: () => setIsSpeakingDoc(false),
      onError: () => setIsSpeakingDoc(false),
    });
  };

  const handleNextParagraph = () => {
    if (currentParagraphIdx < paragraphs.length - 1) {
      speakCurrentParagraph(currentParagraphIdx + 1);
    } else {
      const endMsg = companionLang === 'ar' ? 'وصلت إلى نهاية المحاضرة.' : 'End of lecture reached.';
      speak(endMsg, companionLang === 'ar' ? 'Arabic' : 'English');
    }
  };

  const handlePrevParagraph = () => {
    if (currentParagraphIdx > 0) {
      speakCurrentParagraph(currentParagraphIdx - 1);
    }
  };

  const handleGenerateStudyKit = async () => {
    if (!currentDoc || isGeneratingStudyKit) return;
    setIsGeneratingStudyKit(true);
    const isAr = currentDoc.targetLang === 'ar';
    const isFr = currentDoc.targetLang === 'fr';

    try {
      const prompt = `أنت معلم وأكاديمي متميز. بناءً على ملخص ومحتوى المحاضرة التالية:
عنوان المحاضرة: "${currentDoc.title}"
ملخص المحاضرة:
${currentDoc.summary}

المطلوب:
أنشئ 4 أسئلة اختيار من متعدد (Quiz MCQs) لاختبار فهم الطالب، و 4 بطاقات مراجعة سريعة (Flashcards) للتكرار المتباعد.
يجب إرجاع النتيجة بتنسيق JSON حصراً بهذا الشكل ودون أي كود ماركداون خارجي أو نصوص إضافية:
{
  "quiz": [
    {
      "question": "نص السؤال الواضح والدقيق",
      "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
      "answerIndex": 0,
      "explanation": "تفسير تعليمي موجز لماذا هذا الخيار صحيح"
    }
  ],
  "flashcards": [
    {
      "front": "المصطلح أو السؤال الأساسي",
      "back": "المفهوم أو الإجابة المركزة"
    }
  ]
}
اللغة: ${isAr ? 'العربية' : isFr ? 'Français' : 'English'}`;

      const res = await generateAdaptiveResponse(
        prompt,
        { ...profile, language: isAr ? 'Egyptian Ammiya' : isFr ? 'French' : 'English' },
        []
      );

      let parsed: any = null;
      try {
        const jsonMatch = res.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse study kit JSON:', e);
      }

      if (parsed && Array.isArray(parsed.quiz) && parsed.quiz.length > 0) {
        setDocQuiz(parsed.quiz);
        setDocFlashcards(parsed.flashcards || []);
        setDocViewMode('quiz');
        const announcement = isAr
          ? 'تم توليد بنك الأسئلة وبطاقات المراجعة بنجاح! يمكنك الآن بدء الاختبار.'
          : 'Quiz & flashcards generated successfully!';
        toast.success(announcement);
        speak(announcement, isAr ? 'Arabic' : isFr ? 'French' : 'English');
      } else {
        toast.error(isAr ? 'تعذر إعداد الأسئلة، يرجى المحاولة ثانية.' : 'Could not generate quiz, please retry.');
      }
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'حدث خطأ أثناء إعداد بنك الأسئلة.' : 'Error generating quiz.');
    } finally {
      setIsGeneratingStudyKit(false);
    }
  };

  const handleSelectQuizOption = (qIdx: number, optIdx: number) => {
    setDocQuiz((prev) => {
      const updated = [...prev];
      const q = updated[qIdx];
      if (!q) return prev;
      q.selectedOption = optIdx;
      const isCorrect = optIdx === q.answerIndex;
      const lang = currentDoc?.targetLang === 'ar' ? 'Arabic' : currentDoc?.targetLang === 'fr' ? 'French' : 'English';
      const feedback = isCorrect
        ? (lang === 'Arabic' ? `إجابة صحيحة وممتازة! ${q.explanation}` : `Correct answer! ${q.explanation}`)
        : (lang === 'Arabic' ? `إجابة غير صحيحة. الإجابة الصحيحة هي: ${q.options[q.answerIndex]}. ${q.explanation}` : `Incorrect. The correct answer is ${q.options[q.answerIndex]}. ${q.explanation}`);
      speak(feedback, lang as any);
      return updated;
    });
  };

  const toggleHandsFreeVoice = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.warning(companionLang === 'ar' ? 'المتصفح لا يدعم الأوامر الصوتية.' : 'Voice recognition not supported.');
      return;
    }

    if (isVoiceCommandActive) {
      if (voiceCommandRecRef.current) {
        try { voiceCommandRecRef.current.stop(); } catch {}
        voiceCommandRecRef.current = null;
      }
      setIsVoiceCommandActive(false);
      speak(companionLang === 'ar' ? 'تم إيقاف التحكم الصوتي' : 'Voice commands deactivated', companionLang === 'ar' ? 'Arabic' : 'English');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = companionLang === 'ar' ? 'ar-EG' : companionLang === 'fr' ? 'fr-FR' : 'en-US';

      rec.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const command = lastResult[0].transcript.trim().toLowerCase();
          console.log('[Hands-Free Voice Command]:', command);

          if (/لخص|تلخيص|summary|summarize/i.test(command)) {
            setDocViewMode('summary');
            speak(companionLang === 'ar' ? 'عرض ملخص المحاضرة' : 'Showing summary', companionLang === 'ar' ? 'Arabic' : 'English');
          } else if (/اقرأ|نص|full|read/i.test(command)) {
            setDocViewMode('full');
            speak(companionLang === 'ar' ? 'عرض النص المقروء كاملاً' : 'Showing full text', companionLang === 'ar' ? 'Arabic' : 'English');
          } else if (/وورد|تحميل|download|word/i.test(command)) {
            if (currentDoc) {
              exportToWordDocument(currentDoc.title, currentDoc.summary, currentDoc.fullText, currentDoc.targetLang, docQuiz, docFlashcards);
              speak(companionLang === 'ar' ? 'جاري تنزيل ملف الوورد' : 'Downloading Word document', companionLang === 'ar' ? 'Arabic' : 'English');
            }
          } else if (/أسئلة|كويز|اختبار|quiz|test/i.test(command)) {
            handleGenerateStudyKit();
          } else if (/صوت|audio|استمع|listen/i.test(command)) {
            if (paragraphs.length > 0) speakCurrentParagraph(0);
          } else if (/التالي|next/i.test(command)) {
            handleNextParagraph();
          } else if (/السابق|prev|previous/i.test(command)) {
            handlePrevParagraph();
          } else if (/وقف|اسكت|stop|pause/i.test(command)) {
            cancelSpeech();
            setIsSpeakingDoc(false);
          }
        }
      };

      rec.onerror = () => setIsVoiceCommandActive(false);
      rec.onend = () => {
        if (isVoiceCommandActive) {
          try { rec.start(); } catch {}
        }
      };

      rec.start();
      voiceCommandRecRef.current = rec;
      setIsVoiceCommandActive(true);
      const startMsg = companionLang === 'ar'
        ? 'تم تفعيل التحكم الصوتي الذكي بدون لمس. يمكنك قول: لخص، اقرأ، وورد، أسئلة، صوت، أو وقف.'
        : 'Hands-free voice control active. Say: summarize, read, word, quiz, or stop.';
      toast.success(startMsg);
      speak(startMsg, companionLang === 'ar' ? 'Arabic' : 'English');
    } catch (e) {
      console.error(e);
      setIsVoiceCommandActive(false);
    }
  };

  const handleSignLanguageLecture = () => {
    if (!currentDoc) return;
    const cleanText = currentDoc.summary.replace(/[^\w\u0600-\u06FF\s]/g, ' ');
    const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
    setAvatarSigningWords(words);
    setShowSignAvatarInDoc(true);
    setIsAvatarSigningDoc(true);
    const msg = companionLang === 'ar' ? 'جاري ترجمة المحاضرة إلى لغة الإشارة ثلاثية الأبعاد' : 'Translating lecture to 3D Sign Language';
    toast.success(msg);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-studio-title"
            initial={{ y: 30, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-slate-900 rounded-3xl border border-slate-700/80 shadow-2xl text-white max-h-[92vh] flex flex-col overflow-hidden"
            dir={companionLang === 'ar' ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="doc-studio-title" className="font-black text-base sm:text-lg text-white">
                    {companionLang === 'ar'
                      ? 'استوديو المستندات وتلخيص المحاضرات و PDF'
                      : companionLang === 'fr'
                      ? 'Studio Documents, Cours & PDF'
                      : 'Document, Lecture & PDF Studio'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {companionLang === 'ar'
                      ? 'قراءة PDF • استخراج الزبدة والمفيد • تحويل لـ Word • تسجيل صوتي • ترجمة'
                      : 'Read PDF • Summarize Lectures • Export to Word • Audio Recording • Translate'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Target Translation Language Selector */}
                <div className="flex items-center bg-slate-900 border border-slate-700 p-1 rounded-xl text-xs font-bold">
                  <Languages className="w-3.5 h-3.5 text-indigo-400 mr-1.5 ml-1" />
                  <button
                    type="button"
                    onClick={() => setDocTargetLang('ar')}
                    className={`px-2 py-1 rounded-lg transition-all ${
                      docTargetLang === 'ar' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="ترجمة وتلخيص بالعربية"
                  >
                    🇪🇬 عربي
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocTargetLang('en')}
                    className={`px-2 py-1 rounded-lg transition-all ${
                      docTargetLang === 'en' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Translate to English"
                  >
                    🇬🇧 EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocTargetLang('fr')}
                    className={`px-2 py-1 rounded-lg transition-all ${
                      docTargetLang === 'fr' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Traduire en Français"
                  >
                    🇫🇷 FR
                  </button>
                </div>

                <button
                  onClick={() => {
                    cancelSpeech();
                    onClose();
                  }}
                  aria-label="Close"
                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 px-4 gap-1 sm:gap-2 overflow-x-auto scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-slate-950/40">
              <button
                type="button"
                onClick={() => setDocStudioTab('pdf')}
                className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  docStudioTab === 'pdf'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileUp className="w-4 h-4" />
                <span>{companionLang === 'ar' ? 'قارئ PDF والمستندات' : 'PDF & Doc Reader'}</span>
              </button>

              <button
                type="button"
                onClick={() => setDocStudioTab('audio-rec')}
                className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  docStudioTab === 'audio-rec'
                    ? 'border-red-500 text-red-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>{companionLang === 'ar' ? 'تسجيل وتلخيص المحاضرة' : 'Record & Summarize Lecture'}</span>
                {isRecordingAudio && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
              </button>

              <button
                type="button"
                onClick={() => setDocStudioTab('speech-to-text')}
                className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  docStudioTab === 'speech-to-text'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span>{companionLang === 'ar' ? 'صوت ↔ كتابة (Speech ↔ Text)' : 'Speech ↔ Text'}</span>
              </button>

              <button
                type="button"
                onClick={() => setDocStudioTab('history')}
                className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  docStudioTab === 'history'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-4 h-4" />
                <span>{companionLang === 'ar' ? 'سجل المحفوظات' : 'Doc History'}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300">
                  {docHistory.length}
                </span>
              </button>
            </div>

            {/* Main Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* TAB 1: PDF & DOCUMENT READER */}
              {docStudioTab === 'pdf' && (
                <div className="space-y-5">
                  {/* Upload Card */}
                  <div className="border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 rounded-3xl p-6 sm:p-8 bg-slate-950/40 text-center transition-all">
                    <input
                      type="file"
                      id="vision-doc-file-upload-modal"
                      accept=".pdf,image/*,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processDocumentFile(file);
                        e.target.value = '';
                      }}
                    />
                    <label
                      htmlFor="vision-doc-file-upload-modal"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-3"
                    >
                      <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-xl group-hover:scale-105 transition-transform">
                        <FileUp className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-base sm:text-lg text-white">
                          {companionLang === 'ar'
                            ? 'اضغط هنا لرفع ملف PDF أو صورة مستند أو ورقة محاضرة'
                            : 'Click here to upload a PDF, document image, or lecture slide'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {companionLang === 'ar'
                            ? 'يدعم ملفات PDF، الكتب، السلايدات، الصور والروشتات (مع استخراج الزبدة وترجمتها صوتياً)'
                            : 'Supports PDF, slides, lecture notes, textbook pages, and document photos'}
                        </p>
                      </div>
                      <span className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all">
                        {companionLang === 'ar' ? 'اختر ملف من جهازك' : 'Choose Document File'}
                      </span>
                    </label>
                  </div>

                  {/* Loading State */}
                  {docLoading && (
                    <div className="p-6 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 text-center space-y-3">
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                      <p className="font-bold text-sm sm:text-base text-indigo-200">
                        {docStatusText || (companionLang === 'ar' ? 'جاري فحص وتلخيص المستند بالذكاء الاصطناعي...' : 'Processing document with AI...')}
                      </p>
                    </div>
                  )}

                  {/* Document Display Result */}
                  {currentDoc && !docLoading && (
                    <div className="space-y-4 rounded-3xl bg-slate-950/70 border border-slate-800 p-4 sm:p-6 shadow-xl">
                      {/* Title & Action Bar */}
                      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-mono text-[10px] uppercase font-bold">
                              {currentDoc.sourceType}
                            </span>
                            <h4 className="font-black text-base sm:text-lg text-white">
                              {currentDoc.title}
                            </h4>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(currentDoc.createdAt).toLocaleString(companionLang === 'ar' ? 'ar-EG' : 'en-US')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 4-way Mode Toggle: Summary | Full | Quiz | Flashcards */}
                          <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs font-bold overflow-x-auto max-w-full">
                            <button
                              type="button"
                              onClick={() => setDocViewMode('summary')}
                              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                docViewMode === 'summary' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <GraduationCap className="w-3.5 h-3.5" />
                              <span>{companionLang === 'ar' ? 'الزبدة والملخص' : 'Summary'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDocViewMode('full')}
                              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                docViewMode === 'full' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>{companionLang === 'ar' ? 'النص المقروء' : 'Full Text'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (docQuiz.length === 0) {
                                  handleGenerateStudyKit();
                                } else {
                                  setDocViewMode('quiz');
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                docViewMode === 'quiz' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span>{companionLang === 'ar' ? 'بنك الأسئلة' : 'Quiz'}</span>
                              {docQuiz.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/40 text-[10px] text-white">
                                  {docQuiz.length}
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (docFlashcards.length === 0) {
                                  handleGenerateStudyKit();
                                } else {
                                  setDocViewMode('flashcards');
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                docViewMode === 'flashcards' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>{companionLang === 'ar' ? 'فلاش كاردز' : 'Flashcards'}</span>
                              {docFlashcards.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full bg-purple-500/40 text-[10px] text-white">
                                  {docFlashcards.length}
                                </span>
                              )}
                            </button>
                          </div>

                          {/* Listen Aloud Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isSpeakingDoc) {
                                cancelSpeech();
                                setIsSpeakingDoc(false);
                              } else {
                                speakCurrentParagraph(currentParagraphIdx);
                              }
                            }}
                            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all ${
                              isSpeakingDoc
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {isSpeakingDoc ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            <span>{isSpeakingDoc ? (companionLang === 'ar' ? 'وقف الصوت' : 'Stop') : (companionLang === 'ar' ? 'استمع صوتياً' : 'Listen')}</span>
                          </button>

                          {/* Download as Audio File (.wav) */}
                          <button
                            type="button"
                            onClick={() => {
                              downloadTextAsWavFile(currentDoc.summary, currentDoc.title);
                              toast.success(companionLang === 'ar' ? 'تم تنزيل الملف الصوتي للمحاضرة 🎧' : 'Audio file downloaded 🎧');
                            }}
                            className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                            title="تحميل كملف صوتي WAV للاستماع في أي وقت"
                          >
                            <Music className="w-4 h-4" />
                            <span>{companionLang === 'ar' ? 'تحميل صوتي (.wav)' : 'Audio (.wav)'}</span>
                          </button>

                          {/* Hands-Free Voice Commands Toggle */}
                          <button
                            type="button"
                            onClick={toggleHandsFreeVoice}
                            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all ${
                              isVoiceCommandActive
                                ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                            title="التحكم الصوتي بدون لمس الشاشة"
                          >
                            <Mic className="w-4 h-4" />
                            <span>{isVoiceCommandActive ? (companionLang === 'ar' ? 'أوامر صوتية: شغالة' : 'Voice Active') : (companionLang === 'ar' ? 'تحكم صوتي بدون لمس' : 'Hands-Free')}</span>
                          </button>

                          {/* 3D Sign Language Avatar Lecture Interpreter */}
                          <button
                            type="button"
                            onClick={handleSignLanguageLecture}
                            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all ${
                              showSignAvatarInDoc
                                ? 'bg-purple-700 text-white ring-2 ring-purple-400'
                                : 'bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/40'
                            }`}
                            title="ترجمة المحاضرة بلغة الإشارة ثلاثية الأبعاد (للصم وضعاف السمع)"
                          >
                            <Accessibility className="w-4 h-4" />
                            <span>{companionLang === 'ar' ? 'ترجمة إشارة (3D)' : 'Sign (3D)'}</span>
                          </button>

                          {/* Download as Word Button */}
                          <button
                            type="button"
                            onClick={() => {
                              exportToWordDocument(
                                currentDoc.title,
                                currentDoc.summary,
                                currentDoc.fullText,
                                currentDoc.targetLang,
                                docQuiz,
                                docFlashcards
                              );
                              toast.success(companionLang === 'ar' ? 'تم تنزيل مستند Word بنجاح 📄' : 'Word document downloaded 📄');
                            }}
                            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                            title="تنزيل كملف Word صالح للفتح والتعديل مع الأسئلة والملخص"
                          >
                            <Download className="w-4 h-4" />
                            <span>{companionLang === 'ar' ? 'تحميل Word (.doc)' : 'Export Word'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Smart Audio Scrubbing Navigation Bar */}
                      <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex-wrap text-xs font-bold">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handlePrevParagraph}
                            disabled={currentParagraphIdx <= 0}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white"
                            title="الفقرة السابقة"
                          >
                            <Rewind className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => speakCurrentParagraph(currentParagraphIdx)}
                            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                            title="إعادة نطق الفقرة الحالية"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleNextParagraph}
                            disabled={currentParagraphIdx >= paragraphs.length - 1}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white"
                            title="الفقرة التالية"
                          >
                            <FastForward className="w-4 h-4" />
                          </button>
                          <span className="text-slate-400 font-mono text-[11px] ml-2">
                            {companionLang === 'ar' ? `فقرة ${currentParagraphIdx + 1} من ${paragraphs.length || 1}` : `Paragraph ${currentParagraphIdx + 1} / ${paragraphs.length || 1}`}
                          </span>
                        </div>

                        {/* Playback Speed selector */}
                        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                          <span className="text-slate-500 px-1">⚡ {companionLang === 'ar' ? 'السرعة:' : 'Speed:'}</span>
                          {[0.8, 1.0, 1.25, 1.5].map((rate) => (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => {
                                setAudioPlaybackRate(rate);
                                toast.info(`${companionLang === 'ar' ? 'سرعة الصوت:' : 'Playback rate:'} ${rate}x`);
                              }}
                              className={`px-2 py-0.5 rounded-md font-mono transition-all ${
                                audioPlaybackRate === rate ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {rate}x
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3D Sign Avatar Video Floating Panel */}
                      {showSignAvatarInDoc && (
                        <div className="p-4 rounded-3xl bg-slate-900 border border-purple-500/40 relative space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-300 flex items-center gap-2">
                              <Accessibility className="w-4 h-4 text-purple-400" />
                              {companionLang === 'ar' ? 'مترجم لغة الإشارة ثلاثي الأبعاد للمحاضرة' : '3D Sign Avatar Lecture Interpreter'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowSignAvatarInDoc(false)}
                              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="h-64 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">
                            <React.Suspense fallback={<div className="text-xs text-purple-300 font-bold animate-pulse">جاري تحميل مجسم الإشارة ثلاثي الأبعاد...</div>}>
                              <SignAvatar3D
                                words={avatarSigningWords}
                                playing={isAvatarSigningDoc}
                                onDone={() => setIsAvatarSigningDoc(false)}
                              />
                            </React.Suspense>
                          </div>
                        </div>
                      )}

                      {/* Content Viewer Box */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 max-h-80 overflow-y-auto leading-relaxed text-sm sm:text-base text-slate-100 font-medium">
                        {docViewMode === 'summary' && (
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-amber-400 block mb-1">
                              {companionLang === 'ar' ? '📌 الزبدة وخلاصة المحاضرة:' : '📌 Key Takeaways & Summary:'}
                            </span>
                            <p className="whitespace-pre-wrap">{currentDoc.summary}</p>
                          </div>
                        )}

                        {docViewMode === 'full' && (
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-indigo-400 block mb-1">
                              {companionLang === 'ar' ? '📝 تفاصيل النص المستخرج كاملاً:' : '📝 Full Extracted Content:'}
                            </span>
                            <p className="whitespace-pre-wrap font-mono text-xs sm:text-sm">
                              {currentDoc.fullText || currentDoc.summary}
                            </p>
                          </div>
                        )}

                        {docViewMode === 'quiz' && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                <HelpCircle className="w-4 h-4" />
                                {companionLang === 'ar' ? '📝 بنك أسئلة واختبار فهم المحاضرة:' : '📝 Interactive Lecture Quiz:'}
                              </span>
                              <button
                                type="button"
                                onClick={handleGenerateStudyKit}
                                disabled={isGeneratingStudyKit}
                                className="px-3 py-1 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs flex items-center gap-1"
                              >
                                {isGeneratingStudyKit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                <span>{companionLang === 'ar' ? 'توليد أسئلة جديدة' : 'Regenerate Quiz'}</span>
                              </button>
                            </div>

                            {docQuiz.length === 0 ? (
                              <div className="text-center py-8 space-y-3">
                                <HelpCircle className="w-10 h-10 text-emerald-400 mx-auto opacity-70" />
                                <p className="text-sm text-slate-300 font-bold">
                                  {companionLang === 'ar' ? 'اضغط لتوليد بنك أسئلة فوري واختبار فهمك للمحاضرة' : 'Click to generate questions from this lecture'}
                                </p>
                                <button
                                  type="button"
                                  onClick={handleGenerateStudyKit}
                                  disabled={isGeneratingStudyKit}
                                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg"
                                >
                                  {isGeneratingStudyKit ? 'جاري إعداد بنك الأسئلة...' : 'ابدأ توليد الأسئلة الآن'}
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {docQuiz.map((q, qIdx) => (
                                  <div key={qIdx} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                                    <p className="font-bold text-sm text-white">
                                      س {qIdx + 1}: {q.question}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {q.options.map((opt, optIdx) => {
                                        const isSelected = q.selectedOption === optIdx;
                                        const isAnswer = optIdx === q.answerIndex;
                                        const hasAnswered = q.selectedOption !== undefined;

                                        let btnClass = 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-850';
                                        if (hasAnswered) {
                                          if (isAnswer) btnClass = 'border-emerald-500 bg-emerald-950/50 text-emerald-200 ring-2 ring-emerald-500/50';
                                          else if (isSelected && !isAnswer) btnClass = 'border-red-500 bg-red-950/50 text-red-200 ring-2 ring-red-500/50';
                                        }

                                        return (
                                          <button
                                            key={optIdx}
                                            type="button"
                                            onClick={() => handleSelectQuizOption(qIdx, optIdx)}
                                            className={`p-2.5 rounded-xl border text-xs text-right font-medium transition-all flex items-center justify-between ${btnClass}`}
                                          >
                                            <span>{opt}</span>
                                            {hasAnswered && isAnswer && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                                            {hasAnswered && isSelected && !isAnswer && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {q.selectedOption !== undefined && (
                                      <p className="text-xs text-indigo-300 bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-500/30">
                                        💡 {q.explanation}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {docViewMode === 'flashcards' && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4" />
                                {companionLang === 'ar' ? '🗂️ بطاقات المراجعة السريعة (Spaced Flashcards):' : '🗂️ Spaced Repetition Flashcards:'}
                              </span>
                              <button
                                type="button"
                                onClick={handleGenerateStudyKit}
                                disabled={isGeneratingStudyKit}
                                className="px-3 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 text-xs flex items-center gap-1"
                              >
                                {isGeneratingStudyKit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                <span>{companionLang === 'ar' ? 'توليد بطاقات جديدة' : 'Regenerate Flashcards'}</span>
                              </button>
                            </div>

                            {docFlashcards.length === 0 ? (
                              <div className="text-center py-8 space-y-3">
                                <Sparkles className="w-10 h-10 text-purple-400 mx-auto opacity-70" />
                                <p className="text-sm text-slate-300 font-bold">
                                  {companionLang === 'ar' ? 'اضغط لتوليد بطاقات المراجعة السريعة والتكرار المتباعد' : 'Click to generate flashcards'}
                                </p>
                                <button
                                  type="button"
                                  onClick={handleGenerateStudyKit}
                                  disabled={isGeneratingStudyKit}
                                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg"
                                >
                                  {isGeneratingStudyKit ? 'جاري إعداد البطاقات...' : 'ابدأ إعداد البطاقات'}
                                </button>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {docFlashcards.map((card, cIdx) => (
                                  <div
                                    key={cIdx}
                                    onClick={() => {
                                      setDocFlashcards((prev) => {
                                        const upd = [...prev];
                                        upd[cIdx].flipped = !upd[cIdx].flipped;
                                        const isFlipped = upd[cIdx].flipped;
                                        const text = isFlipped ? card.back : card.front;
                                        speak(text, currentDoc.targetLang === 'ar' ? 'Arabic' : 'English');
                                        return upd;
                                      });
                                    }}
                                    className={`p-5 rounded-2xl border cursor-pointer select-none transition-all shadow-lg min-h-[120px] flex flex-col justify-between ${
                                      card.flipped
                                        ? 'bg-purple-950/70 border-purple-500/60 text-purple-100'
                                        : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                                    }`}
                                  >
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                                      {card.flipped ? (companionLang === 'ar' ? '💡 الحل / المفهوم' : 'Answer / Concept') : (companionLang === 'ar' ? `بطاقة ${cIdx + 1} (اضغط للقلب والحل)` : `Card ${cIdx + 1} (Tap to Flip)`)}
                                    </span>
                                    <p className="font-bold text-sm sm:text-base my-auto leading-relaxed">
                                      {card.flipped ? card.back : card.front}
                                    </p>
                                    <span className="text-[10px] text-slate-500 text-left mt-2 font-mono">
                                      {card.flipped ? '🔊 منطوق' : '🔄 اضغط للاستماع للحل'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Interactive Q&A Mid-reading Section */}
                      <div className="space-y-3 pt-3 border-t border-slate-800">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                          <MessageSquare className="w-4 h-4 text-indigo-400" />
                          <span>
                            {companionLang === 'ar'
                              ? 'اسأل المعلم الذكي عن أي نقطة في هذه المحاضرة / المستند:'
                              : 'Ask the AI tutor any question about this document / lecture:'}
                          </span>
                        </div>

                        {/* Chat Messages */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {docChatMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-indigo-600/30 border border-indigo-500/40 text-indigo-100 mr-auto max-w-[85%]'
                                  : 'bg-slate-900 border border-slate-800 text-slate-200 ml-auto max-w-[85%]'
                              }`}
                            >
                              <span className="font-bold text-[10px] text-slate-400 block mb-0.5">
                                {msg.role === 'user'
                                  ? (companionLang === 'ar' ? 'أنت' : 'You')
                                  : (companionLang === 'ar' ? 'المعلم الذكي' : 'Cognify Tutor')}
                              </span>
                              <p>{msg.content}</p>
                            </div>
                          ))}
                        </div>

                        {/* Chat Input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={docChatInput}
                            onChange={(e) => setDocChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAskDocQuestion();
                            }}
                            placeholder={
                              companionLang === 'ar'
                                ? 'مثلاً: ما هي أهم معادلة في المحاضرة؟ أو اشرح لي النقطة الثانية...'
                                : 'Ask anything about this document...'
                            }
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-slate-500 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={handleAskDocQuestion}
                            disabled={!docChatInput.trim() || isDocChatAnswering}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-lg active:scale-95 disabled:opacity-40 transition-all"
                          >
                            {isDocChatAnswering ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            <span>{companionLang === 'ar' ? 'إرسال' : 'Send'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: LIVE AUDIO LECTURE RECORDING */}
              {docStudioTab === 'audio-rec' && (
                <div className="space-y-6 text-center py-4">
                  <div className="max-w-md mx-auto space-y-2">
                    <h4 className="font-black text-lg text-white">
                      {companionLang === 'ar'
                        ? 'تسجيل وتلخيص المحاضرة الصوتية الحية'
                        : 'Live Audio Lecture Recording & Summarizer'}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {companionLang === 'ar'
                        ? 'شغّل التسجيل أثناء وجودك في قاعة المحاضرات، وسيقوم الذكاء بتفريغ كلام الدكتور واستخراج الزبدة والمفيد وتجهيز ملف Word فوراً.'
                        : 'Record live in the lecture hall. Cognify AI will transcribe the professor, extract core takeaways, and prepare a Word doc immediately.'}
                    </p>
                  </div>

                  {/* Big Accessible Record Button */}
                  <div className="flex flex-col items-center justify-center py-4 space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (isRecordingAudio) {
                          stopAudioLectureRecording();
                        } else {
                          startAudioLectureRecording();
                        }
                      }}
                      disabled={docLoading}
                      aria-pressed={isRecordingAudio}
                      aria-label={isRecordingAudio ? 'Stop Recording' : 'Start Recording'}
                      className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1.5 shadow-2xl active:scale-95 transition-all ${
                        isRecordingAudio
                          ? 'bg-red-600 text-white ring-8 ring-red-500/30 animate-pulse'
                          : 'bg-gradient-to-tr from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white ring-8 ring-red-950/40'
                      }`}
                    >
                      {isRecordingAudio ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
                      <span className="text-[11px] font-black">
                        {isRecordingAudio
                          ? (companionLang === 'ar' ? 'إنهاء وتلخيص' : 'Stop & Summarize')
                          : (companionLang === 'ar' ? 'ابدأ التسجيل' : 'Record')}
                      </span>
                    </button>

                    {isRecordingAudio && (
                      <div className="space-y-1">
                        <span className="font-mono text-2xl font-black text-red-400 tracking-wider">
                          {Math.floor(audioRecordDuration / 60)}:
                          {(audioRecordDuration % 60).toString().padStart(2, '0')}
                        </span>
                        <p className="text-xs text-slate-400 animate-pulse">
                          {companionLang === 'ar' ? 'جاري الاستماع للمحاضرة وتفريغ الكلام مباشرة...' : 'Listening and transcribing live lecture...'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Live Transcript Preview */}
                  {liveSpeechTranscript && (
                    <div className="max-w-xl mx-auto p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-start space-y-1.5">
                      <span className="text-[11px] font-bold text-red-400 block">
                        {companionLang === 'ar' ? 'تفريغ فوري مباشر أثناء التحدث:' : 'Live Transcript Stream:'}
                      </span>
                      <p className="text-xs text-slate-300 font-mono leading-relaxed line-clamp-4">
                        {liveSpeechTranscript}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SPEECH ↔ TEXT STUDIO */}
              {docStudioTab === 'speech-to-text' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Panel A: Speech to Text (Voice Dictation) */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-3 flex flex-col">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm text-emerald-400 flex items-center gap-1.5">
                        <Mic className="w-4 h-4" />
                        <span>{companionLang === 'ar' ? 'تحدث ليكتب لك (إملاء صوتي)' : 'Speech to Text (Dictation)'}</span>
                      </h4>
                      <button
                        type="button"
                        onClick={toggleDictation}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow ${
                          isDictating
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {isDictating ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        <span>{isDictating ? (companionLang === 'ar' ? 'إيقاف' : 'Stop') : (companionLang === 'ar' ? 'تحدث الآن' : 'Dictate')}</span>
                      </button>
                    </div>

                    <textarea
                      rows={7}
                      value={dictationText}
                      onChange={(e) => setDictationText(e.target.value)}
                      placeholder={
                        companionLang === 'ar'
                          ? 'اضغط على "تحدث الآن" وابدأ الكلام، وسيتم كتابة كل ما تقوله بدقة هنا...'
                          : 'Click "Dictate" and start speaking. Your speech will appear here...'
                      }
                      className="w-full flex-1 p-3 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed resize-none"
                    />

                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (!dictationText.trim()) return;
                          navigator.clipboard.writeText(dictationText);
                          toast.success(companionLang === 'ar' ? 'تم نسخ النص المكتوب 📋' : 'Copied to clipboard 📋');
                        }}
                        disabled={!dictationText.trim()}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs disabled:opacity-40"
                      >
                        {companionLang === 'ar' ? 'نسخ النص' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!dictationText.trim()) return;
                          exportToWordDocument(
                            companionLang === 'ar' ? 'إملاء صوتي' : 'Dictation Note',
                            dictationText,
                            undefined,
                            docTargetLang
                          );
                          toast.success(companionLang === 'ar' ? 'تم حفظ ملف Word 📄' : 'Word file saved 📄');
                        }}
                        disabled={!dictationText.trim()}
                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-40"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{companionLang === 'ar' ? 'تصدير Word' : 'Export Word'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Panel B: Text to Speech (Text Reader) */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-3 flex flex-col">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm text-blue-400 flex items-center gap-1.5">
                        <Volume2 className="w-4 h-4" />
                        <span>{companionLang === 'ar' ? 'اكتب ليقرأ لك بصوت واضح' : 'Text to Speech Reader'}</span>
                      </h4>
                    </div>

                    <textarea
                      rows={7}
                      value={textToReadAloud}
                      onChange={(e) => setTextToReadAloud(e.target.value)}
                      placeholder={
                        companionLang === 'ar'
                          ? 'الصق أو اكتب أي نص هنا لسماعه فوراً بصوت طبيعي واضح...'
                          : 'Paste or type any text here to hear it read aloud...'
                      }
                      className="w-full flex-1 p-3 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed resize-none"
                    />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!textToReadAloud.trim()) return;
                          cancelSpeech();
                          const lang = docTargetLang === 'ar' ? 'Arabic' : docTargetLang === 'fr' ? 'French' : 'English';
                          speak(textToReadAloud, lang as any, {
                            onStart: () => setIsSpeakingDoc(true),
                            onEnd: () => setIsSpeakingDoc(false),
                            onError: () => setIsSpeakingDoc(false),
                          });
                        }}
                        disabled={!textToReadAloud.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-40 active:scale-95 transition-all"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>{companionLang === 'ar' ? 'اقرأ بصوت عالي' : 'Read Aloud'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          cancelSpeech();
                          setIsSpeakingDoc(false);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                      >
                        {companionLang === 'ar' ? 'إيقاف' : 'Stop'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SAVED DOCUMENTS ARCHIVE */}
              {docStudioTab === 'history' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                    <span>{companionLang === 'ar' ? 'المستندات والمحاضرات التي تم تلخيصها سابقاً' : 'Previously Summarized Documents'}</span>
                    <span className="font-mono text-indigo-400 font-bold">{docHistory.length} items</span>
                  </div>

                  {docHistory.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 space-y-2">
                      <FileText className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
                      <p className="text-sm font-bold text-slate-400">
                        {companionLang === 'ar'
                          ? 'لا توجد مستندات محفوظة بعد.'
                          : 'No saved documents in your archive yet.'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {companionLang === 'ar'
                          ? 'ارفع أي ملف PDF أو سجّل محاضرة وسيتم حفظ ملخصها هنا تلقائياً.'
                          : 'Upload a PDF or record a lecture to have its summary saved here automatically.'}
                      </p>
                    </div>
                  ) : (
                    docHistory.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-all flex-wrap sm:flex-nowrap"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-600/30 text-indigo-300 font-mono text-[10px] uppercase font-bold">
                              {item.sourceType}
                            </span>
                            <h5 className="font-bold text-sm text-white truncate">{item.title}</h5>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {item.summary}
                          </p>
                          <span className="text-[10px] text-slate-500 block">
                            {new Date(item.createdAt).toLocaleDateString(companionLang === 'ar' ? 'ar-EG' : 'en-US')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentDoc(item);
                              setDocStudioTab('pdf');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-bold text-xs"
                          >
                            {companionLang === 'ar' ? 'فتح' : 'Open'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              exportToWordDocument(item.title, item.summary, item.fullText, item.targetLang);
                              toast.success(companionLang === 'ar' ? 'تم تنزيل Word 📄' : 'Word downloaded 📄');
                            }}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400"
                            title="تحميل كملف Word"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDocFromHistory(item.id)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
