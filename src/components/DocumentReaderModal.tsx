/**
 * Document Reader + Speech⇄Text tools for the Visual Companion.
 *
 * Two tabs:
 * 1. Document Reader — upload a PDF or a photo of a document, then either
 *    have it summarized aloud (lecture-style), read verbatim aloud, or
 *    converted into a downloadable .docx file. Reuses the exact same
 *    generateAdaptiveResponse() attachment pipeline the live camera already
 *    uses (see VisionCompanionView's captureFrame flow) — a PDF is just
 *    another `{ name, type, data }` attachment to Gemini, no separate OCR
 *    library needed.
 * 2. Speech ⇄ Text — a simple two-way text-to-speech / speech-to-text pair,
 *    independent of any document.
 *
 * The `docx` package (~400KB) is dynamically imported only when the person
 * actually presses "Convert to Word", so people who only use summarize/read
 * aloud never pay for it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  FileText,
  Upload,
  Loader2,
  Volume2,
  VolumeX,
  Download,
  Copy,
  Check,
  Mic,
  MicOff,
  Type,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { UserProfile } from '../types';
import { generateAdaptiveResponse } from '../services/gemini';
import { speak, cancelSpeech } from '../lib/tts';
import { isArabicLocale } from '../lib/translations';
import { toast } from './Toast';

interface DocumentReaderModalProps {
  profile: UserProfile;
  companionLang: 'ar' | 'en' | 'fr';
  onClose: () => void;
}

type DocTool = 'document' | 'speech';
type DocAction = 'summarize' | 'read';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — same cap ChatInterface.tsx already uses for PDFs

const ttsLangName = (lang: 'ar' | 'en' | 'fr') =>
  lang === 'ar' ? 'Arabic' : lang === 'fr' ? 'French' : 'English';

const geminiLangName = (lang: 'ar' | 'en' | 'fr') =>
  lang === 'ar' ? 'Arabic' : lang === 'fr' ? 'French' : 'English';

const sttLangTag = (lang: 'ar' | 'en' | 'fr') =>
  lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-US';

export default function DocumentReaderModal({ profile, companionLang, onClose }: DocumentReaderModalProps) {
  const t = (en: string, ar: string, fr?: string) =>
    companionLang === 'ar' ? ar : companionLang === 'fr' ? (fr || en) : en;

  const [tool, setTool] = useState<DocTool>('document');

  // --- Document Reader state ---
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string>('');
  const [fileData, setFileData] = useState<string>(''); // base64, no data: prefix
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<DocAction | null>(null);
  const [resultText, setResultText] = useState('');
  const [isSpeakingResult, setIsSpeakingResult] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Speech <-> Text state ---
  const [ttsInput, setTtsInput] = useState('');
  const [isSpeakingTts, setIsSpeakingTts] = useState(false);
  const [sttTranscript, setSttTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      cancelSpeech();
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    };
  }, []);

  const resetDocument = () => {
    setFileName(null);
    setFileMime('');
    setFileData('');
    setResultText('');
    cancelSpeech();
    setIsSpeakingResult(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    const isAr = isArabicLocale(profile.language);

    const lowerName = file.name.toLowerCase();
    let mime = (file.type || '').trim().toLowerCase();
    if (!mime || mime === 'application/octet-stream') {
      if (lowerName.endsWith('.pdf')) mime = 'application/pdf';
      else if (/\.(jpe?g)$/.test(lowerName)) mime = 'image/jpeg';
      else if (lowerName.endsWith('.png')) mime = 'image/png';
      else if (lowerName.endsWith('.webp')) mime = 'image/webp';
    }
    const isSupported = mime === 'application/pdf' || mime.startsWith('image/');
    if (!isSupported) {
      toast.warning(
        isAr ? 'من فضلك ارفع ملف PDF أو صورة للمستند.' : 'Please upload a PDF file or a photo of the document.',
        isAr ? 'صيغة غير مدعومة' : 'Unsupported file',
      );
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.warning(
        isAr ? `الملف "${file.name}" كبير جداً، الحد الأقصى 10 ميجا.` : `"${file.name}" is too large — the max is 10 MB.`,
        isAr ? 'ملف كبير' : 'File too large',
      );
      return;
    }

    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
    const dataStr = base64.split(',')[1];
    if (!dataStr) {
      toast.warning(isAr ? `تعذّر قراءة الملف "${file.name}".` : `Couldn't read "${file.name}".`, isAr ? 'خطأ' : 'Error');
      return;
    }

    setFileName(file.name);
    setFileMime(mime);
    setFileData(dataStr);
    setResultText('');
  };

  const runDocumentAction = async (action: DocAction) => {
    if (!fileData) return;
    setIsProcessing(true);
    setProcessingAction(action);
    setResultText('');
    cancelSpeech();
    setIsSpeakingResult(false);

    let prompt: string;
    if (action === 'summarize') {
      prompt = companionLang === 'ar'
        ? 'الملف ده محاضرة أو مستند دراسي. لخّصلي أهم النقاط والأفكار الرئيسية بشكل واضح ومرتب، بصوت طبيعي كأنك بتشرحلي، من غير عناوين أو ماركداون أو نجوم. ركّز على المعلومات المهمة اللي هتفيدني في المذاكرة.'
        : companionLang === 'fr'
        ? "Ce fichier est un cours ou un document d'étude. Résumez les points et idées principaux clairement, dans un style parlé naturel, sans titres ni markdown."
        : 'This file is a lecture or study document. Summarize the key points and main ideas clearly, in a natural spoken style as if explaining it to me, with no headings or markdown asterisks. Focus on what matters for studying it.';
    } else {
      prompt = companionLang === 'ar'
        ? 'اقرأ كل النص المكتوب في هذا المستند بالكامل وبالترتيب، كلمة بكلمة، من غير أي تلخيص أو حذف أو تعليق، ومن غير عناوين أو ماركداون.'
        : companionLang === 'fr'
        ? "Lisez tout le texte de ce document dans l'ordre, mot pour mot, sans résumer, sans titres ni markdown."
        : 'Read out all the text in this document in order, word for word, with no summarizing, no omissions, and no headings or markdown.';
    }

    try {
      const result = await generateAdaptiveResponse(
        prompt,
        { ...profile, language: geminiLangName(companionLang) as any },
        [],
        [{ name: fileName || 'document', type: fileMime, data: fileData }],
      );
      setResultText(result || '');
      if (result) {
        setIsSpeakingResult(true);
        speak(result, ttsLangName(companionLang), {
          onEnd: () => setIsSpeakingResult(false),
          onError: () => setIsSpeakingResult(false),
        });
      }
    } catch {
      const isAr = isArabicLocale(profile.language);
      toast.error(
        isAr ? 'تعذّرت قراءة المستند. حاول تاني.' : 'Could not process the document. Please try again.',
        isAr ? 'خطأ' : 'Error',
      );
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  const toggleSpeakResult = () => {
    if (isSpeakingResult) {
      cancelSpeech();
      setIsSpeakingResult(false);
      return;
    }
    if (!resultText) return;
    setIsSpeakingResult(true);
    speak(resultText, ttsLangName(companionLang), {
      onEnd: () => setIsSpeakingResult(false),
      onError: () => setIsSpeakingResult(false),
    });
  };

  const handleConvertToWord = async () => {
    if (!resultText) return;
    setIsConverting(true);
    try {
      // Lazy-loaded: the ~400KB docx package is only fetched once someone
      // actually presses this button, so it never slows down the rest of
      // the Visual Companion feature.
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
      const isAr = companionLang === 'ar';
      const paragraphs = resultText
        .split(/\n+/)
        .filter((line) => line.trim().length > 0)
        .map(
          (line) =>
            new Paragraph({
              alignment: isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
              bidirectional: isAr,
              children: [new TextRun({ text: line.trim(), rightToLeft: isAr })],
            }),
        );

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                heading: HeadingLevel.HEADING_1,
                alignment: isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
                bidirectional: isAr,
                children: [new TextRun({ text: fileName || (isAr ? 'مستند' : 'Document'), bold: true })],
              }),
              ...paragraphs,
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = (fileName || 'document').replace(/\.[^./]+$/, '');
      a.download = `${baseName}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      const isAr = isArabicLocale(profile.language);
      toast.error(
        isAr ? 'تعذّر إنشاء ملف الوورد. حاول تاني.' : 'Could not create the Word file. Please try again.',
        isAr ? 'خطأ' : 'Error',
      );
    } finally {
      setIsConverting(false);
    }
  };

  const handleSpeakTts = () => {
    if (isSpeakingTts) {
      cancelSpeech();
      setIsSpeakingTts(false);
      return;
    }
    if (!ttsInput.trim()) return;
    setIsSpeakingTts(true);
    speak(ttsInput, ttsLangName(companionLang), {
      onEnd: () => setIsSpeakingTts(false),
      onError: () => setIsSpeakingTts(false),
    });
  };

  const toggleListening = () => {
    const isAr = isArabicLocale(profile.language);
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.warning(
        isAr ? 'المتصفح ده مش بيدعم تحويل الصوت لنص.' : "This browser doesn't support speech-to-text.",
        isAr ? 'غير مدعوم' : 'Not supported',
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = sttLangTag(companionLang);
    recognitionRef.current = recognition;

    let base = sttTranscript ? sttTranscript + ' ' : '';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      const err = event?.error;
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        toast.error(
          isAr ? 'مفيش إذن للمايك. اسمح للموقع باستخدام الميكروفون.' : 'Microphone permission is blocked.',
          isAr ? 'الميكروفون مقفول' : 'Mic blocked',
        );
      }
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (finalText) base = base + finalText + ' ';
      setSttTranscript((base + interim).trim());
    };

    try {
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleCopyTranscript = async () => {
    if (!sttTranscript) return;
    try {
      await navigator.clipboard.writeText(sttTranscript);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-reader-dialog-title"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-slate-900 rounded-3xl p-5 sm:p-6 space-y-4 border border-slate-800 shadow-2xl text-white max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-400" />
            <h3 id="doc-reader-dialog-title" className="font-bold text-base text-white">
              {t('Documents', 'المستندات', 'Documents')}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t('Close', 'إغلاق', 'Fermer')}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tool switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl shrink-0">
          <button
            onClick={() => setTool('document')}
            aria-pressed={tool === 'document'}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              tool === 'document' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            {t('Document Reader', 'قارئ المستندات', 'Lecteur de documents')}
          </button>
          <button
            onClick={() => setTool('speech')}
            aria-pressed={tool === 'speech'}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              tool === 'speech' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            {t('Speech ⇄ Text', 'نص ⇄ صوت', 'Texte ⇄ Voix')}
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 pr-0.5">
          {tool === 'document' ? (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />

              {!fileName ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-2xl border-2 border-dashed border-slate-700 hover:border-teal-500 hover:bg-slate-800/50 transition-all"
                >
                  <Upload className="w-7 h-7 text-teal-400" />
                  <span className="text-sm font-bold text-slate-200">
                    {t('Upload a PDF or a photo of the document', 'ارفع ملف PDF أو صورة للمستند', 'Téléversez un PDF ou une photo')}
                  </span>
                  <span className="text-[11px] text-slate-500">{t('Max 10MB', 'الحد الأقصى 10 ميجا', 'Max 10 Mo')}</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-teal-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-200 truncate">{fileName}</span>
                    </div>
                    <button
                      onClick={resetDocument}
                      aria-label={t('Remove file', 'إزالة الملف', 'Retirer le fichier')}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => runDocumentAction('summarize')}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isProcessing && processingAction === 'summarize' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {t('Summarize Lecture', 'تلخيص المحاضرة', 'Résumer le cours')}
                    </button>
                    <button
                      onClick={() => runDocumentAction('read')}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isProcessing && processingAction === 'read' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                      {t('Read Full Text', 'قراءة كاملة', 'Lecture complète')}
                    </button>
                  </div>

                  {resultText && (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 max-h-40 overflow-y-auto">
                        <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">{resultText}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={toggleSpeakResult}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                            isSpeakingResult
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white'
                          }`}
                        >
                          {isSpeakingResult ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          {isSpeakingResult ? t('Stop', 'إيقاف', 'Arrêter') : t('Repeat Aloud', 'إعادة القراءة', 'Répéter')}
                        </button>
                        <button
                          onClick={handleConvertToWord}
                          disabled={isConverting}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs disabled:opacity-50 transition-all active:scale-95"
                        >
                          {isConverting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          {t('Convert to Word', 'تحويل لوورد', 'Convertir en Word')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Text -> Speech */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400">
                  {t('Type text to hear it aloud', 'اكتب نص عشان يتقال بصوت عالي', 'Tapez un texte à écouter')}
                </label>
                <textarea
                  value={ttsInput}
                  onChange={(e) => setTtsInput(e.target.value)}
                  rows={3}
                  placeholder={t('Type here…', 'اكتب هنا...', 'Écrivez ici…')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-slate-500 text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
                <button
                  onClick={handleSpeakTts}
                  disabled={!ttsInput.trim() && !isSpeakingTts}
                  className={`w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs disabled:opacity-40 transition-all active:scale-95 ${
                    isSpeakingTts
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-teal-500 hover:bg-teal-400 text-slate-950'
                  }`}
                >
                  {isSpeakingTts ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  {isSpeakingTts ? t('Stop', 'إيقاف', 'Arrêter') : t('Speak', 'اقرأ بصوت عالي', 'Lire à voix haute')}
                </button>
              </div>

              <div className="h-px bg-slate-800" />

              {/* Speech -> Text */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400">
                  {t('Speak and get the text', 'اتكلم واحصل على النص', 'Parlez pour obtenir le texte')}
                </label>
                <button
                  onClick={toggleListening}
                  className={`w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isListening ? t('Stop Listening', 'إيقاف الاستماع', "Arrêter l'écoute") : t('Start Speaking', 'ابدأ الكلام', 'Commencer à parler')}
                </button>
                {sttTranscript && (
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 max-h-32 overflow-y-auto">
                      <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">{sttTranscript}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleCopyTranscript}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs transition-all active:scale-95"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copied ? t('Copied', 'تم النسخ', 'Copié') : t('Copy', 'نسخ', 'Copier')}
                      </button>
                      <button
                        onClick={() => setSttTranscript('')}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs transition-all active:scale-95"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t('Clear', 'مسح', 'Effacer')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
