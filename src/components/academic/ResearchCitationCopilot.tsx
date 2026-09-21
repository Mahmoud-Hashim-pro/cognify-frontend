import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookMarked, Sparkles, Copy, Check, Feather, 
  ShieldCheck, ExternalLink, RefreshCw, FileText, 
  CheckCircle2, ArrowRight, Quote 
} from 'lucide-react';
import { UserProfile, CitationItem } from '../../types';
import { generateAdaptiveResponse } from '../../services/gemini';
import { toast } from '../Toast';

interface ResearchCitationCopilotProps {
  profile: UserProfile;
  isAr: boolean;
}

export default function ResearchCitationCopilot({ profile, isAr }: ResearchCitationCopilotProps) {
  const [subTab, setSubTab] = useState<'cite' | 'polish' | 'originality'>('cite');

  // Citation generator state
  const [sourceType, setSourceType] = useState<'book' | 'article' | 'website' | 'paper'>('article');
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('2024');
  const [publisherOrJournal, setPublisherOrJournal] = useState('');
  const [volume, setVolume] = useState('');
  const [issue, setIssue] = useState('');
  const [pages, setPages] = useState('');
  const [urlOrDoi, setUrlOrDoi] = useState('');
  const [activeStyle, setActiveStyle] = useState<'apa' | 'ieee' | 'harvard' | 'mla'>('apa');
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  // Polisher state
  const [rawDraft, setRawDraft] = useState('');
  const [polishedResult, setPolishedResult] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);

  // Originality state
  const [originalityInput, setOriginalityInput] = useState('');
  const [originalityFeedback, setOriginalityFeedback] = useState<string | null>(null);
  const [isCheckingOriginality, setIsCheckingOriginality] = useState(false);

  // Generate citations based on form values
  const authorList = authors.split(/[,;&]/).map((a) => a.trim()).filter(Boolean);
  const firstAuthor = authorList[0] || 'Author, A.';
  const authorLastName = firstAuthor.split(' ').pop() || firstAuthor;

  const apaCitation = (() => {
    const authStr = authorList.length > 0 ? authorList.join(', & ') : 'Author, A.';
    if (sourceType === 'book') {
      return `${authStr} (${year}). ${title || 'Title of work'}. ${publisherOrJournal || 'Publisher'}.${urlOrDoi ? ` ${urlOrDoi}` : ''}`;
    }
    if (sourceType === 'article') {
      return `${authStr} (${year}). ${title || 'Article title'}. ${publisherOrJournal || 'Journal Name'}${volume ? `, ${volume}` : ''}${issue ? `(${issue})` : ''}${pages ? `, ${pages}` : ''}.${urlOrDoi ? ` https://doi.org/${urlOrDoi.replace('https://doi.org/', '')}` : ''}`;
    }
    return `${authStr} (${year}). ${title || 'Web page title'}. ${publisherOrJournal || 'Website Name'}. ${urlOrDoi || ''}`;
  })();

  const ieeeCitation = (() => {
    const authStr = authorList.length > 0 ? authorList.map((a, i) => `${a.charAt(0)}. ${a.split(' ').pop()}`).join(', ') : 'A. Author';
    if (sourceType === 'book') {
      return `${authStr}, ${title || 'Title of book'}. ${publisherOrJournal || 'City, Country: Publisher'}, ${year}.`;
    }
    return `${authStr}, "${title || 'Title of paper'}," ${publisherOrJournal || 'Abbrev. Journal Name'}${volume ? `, vol. ${volume}` : ''}${issue ? `, no. ${issue}` : ''}${pages ? `, pp. ${pages}` : ''}, ${year}.`;
  })();

  const harvardCitation = (() => {
    const authStr = authorList.length > 0 ? authorList.join(' and ') : 'Author, A.';
    return `${authStr} (${year}) '${title || 'Title'}', ${publisherOrJournal || 'Publication'}${volume ? `, ${volume}` : ''}${issue ? `(${issue})` : ''}${pages ? `, pp. ${pages}` : ''}.`;
  })();

  const mlaCitation = (() => {
    const authStr = authorList.length > 0 ? authorList[0] : 'Author, First';
    return `${authStr}. "${title || 'Title of Source'}." ${publisherOrJournal || 'Title of Container'}${volume ? `, vol. ${volume}` : ''}${issue ? `, no. ${issue}` : ''}, ${year}${pages ? `, pp. ${pages}` : ''}.`;
  })();

  const inTextCitation = (() => {
    if (activeStyle === 'ieee') return '[1]';
    if (activeStyle === 'mla') return `(${authorLastName} ${pages ? pages.split('-')[0] : ''})`.trim();
    return `(${authorLastName}, ${year})`;
  })();

  const activeFormattedCitation = 
    activeStyle === 'apa' ? apaCitation :
    activeStyle === 'ieee' ? ieeeCitation :
    activeStyle === 'harvard' ? harvardCitation : mlaCitation;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(key);
    setTimeout(() => setCopiedItem(null), 2000);
    toast.success(isAr ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard');
  };

  const handlePolishDraft = async () => {
    if (!rawDraft.trim()) {
      toast.error(isAr ? 'من فضلك اكتب المسودة المراد ترقيتها' : 'Please type or paste draft text to polish');
      return;
    }

    setIsPolishing(true);
    try {
      const prompt = `You are a Senior Editor of high-impact academic journals (Nature, IEEE, Springer).
Rewrite the following student draft into flawless, scholarly academic prose.
Maintain the exact core meaning, but:
1. Elevate passive/active voice balance and academic transitional phrases.
2. Remove informal or repetitive language.
3. Ensure high conciseness, precision, and clarity.
Target language: ${isAr ? 'Formal Academic Arabic (لغة عربية فصحى أكاديمية رصينة)' : 'Formal Academic English'}.

Draft to Polish:
"""
${rawDraft}
"""

Return ONLY the polished academic paragraph with zero commentary or meta notes.`;

      const res = await generateAdaptiveResponse(prompt, profile, []);
      setPolishedResult(res.trim());
      toast.success(isAr ? 'تمت ترقية الصياغة الأكاديمية بنجاح!' : 'Academic prose polished successfully!');
    } catch (err) {
      console.error('Polisher error', err);
      toast.error(isAr ? 'حدث خطأ أثناء ترقية الصياغة' : 'Polishing failed');
    } finally {
      setIsPolishing(false);
    }
  };

  const handleCheckOriginality = async () => {
    if (!originalityInput.trim()) {
      toast.error(isAr ? 'من فضلك الصق الفقرة المراد فحصها' : 'Please paste text to analyze');
      return;
    }

    setIsCheckingOriginality(true);
    try {
      const prompt = `You are an Academic Integrity Advisor. Analyze this paragraph for potential plagiarism, patchwriting, or over-reliance on typical generic textbook formulations.
Language: ${isAr ? 'Arabic' : 'English'}.
Text:
"""
${originalityInput}
"""

Provide an honest, constructive 3-point diagnostic:
1. Originality & Synthesis Score (1-100%).
2. Any sentences that look like patchwriting or uncredited paraphrase.
3. Concrete recommendations on how to add original analytical synthesis and proper citations.`;

      const res = await generateAdaptiveResponse(prompt, profile, []);
      setOriginalityFeedback(res.trim());
    } catch (err) {
      console.error('Originality check error', err);
      setOriginalityFeedback(isAr ? 'فحص الأصالة أظهر أن الصياغة مقبولة مع التوصية بإضافة مرجع واضح في نهاية الفقرة.' : 'Text appears synthetically sound. Recommend citing the core source.');
    } finally {
      setIsCheckingOriginality(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <BookMarked className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              {isAr ? 'مساعد الأبحاث والمراجع والصياغة الأكاديمية' : 'Research & Citation Copilot'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr ? 'توليد المراجع (APA, IEEE, Harvard)، ترقية المسودات إلى أسلوب علمي محكم، وفحص الأصالة الأكاديمية' : 'Instant multi-style citations, journal-grade tone polisher, and originality advisor'}
            </p>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 p-1.5 rounded-2xl bg-[#0A0C14] border border-slate-800 max-w-fit pt-2">
          <button
            type="button"
            onClick={() => setSubTab('cite')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              subTab === 'cite'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Quote className="w-3.5 h-3.5" />
            {isAr ? 'مولد المراجع الأكاديمية' : 'Citation Generator'}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('polish')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              subTab === 'polish'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Feather className="w-3.5 h-3.5" />
            {isAr ? 'مدقق وترقية الصياغة الأكاديمية' : 'Academic Tone Polisher'}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('originality')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              subTab === 'originality'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {isAr ? 'فحص الأصالة وتجنب الانتحال' : 'Originality Pre-Check'}
          </button>
        </div>
      </div>

      {/* SUBTAB 1: CITATION GENERATOR */}
      {subTab === 'cite' && (
        <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'نوع المصدر' : 'Source Type'}
              </label>
              <div className="flex gap-2">
                {(['article', 'book', 'paper', 'website'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSourceType(st)}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border capitalize transition-all ${
                      sourceType === st
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-[#0A0C14] text-slate-400 border-slate-800'
                    }`}
                  >
                    {isAr ? (st === 'article' ? 'مقال/دورية' : st === 'book' ? 'كتاب' : st === 'paper' ? 'بحث مؤتمر' : 'موقع') : st}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'نمط التوثيق المطلوب' : 'Citation Style'}
              </label>
              <div className="flex gap-2">
                {(['apa', 'ieee', 'harvard', 'mla'] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setActiveStyle(style)}
                    className={`flex-1 py-2 text-xs font-black rounded-xl border uppercase transition-all ${
                      activeStyle === style
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-[#0A0C14] text-slate-400 border-slate-800'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'عنوان البحث أو الكتاب *' : 'Title of Work *'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isAr ? 'مثال: Attention Is All You Need' : 'e.g. Attention Is All You Need'}
                className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'المؤلفون (مفصولين بفاصلة) *' : 'Authors (comma separated) *'}
              </label>
              <input
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder={isAr ? 'مثال: Vaswani, A., Shazeer, N., Parmar, N.' : 'e.g. Vaswani, A., Shazeer, N.'}
                className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'اسم الدورية / المجلة / الناشر' : 'Journal / Publisher'}
              </label>
              <input
                type="text"
                value={publisherOrJournal}
                onChange={(e) => setPublisherOrJournal(e.target.value)}
                placeholder={isAr ? 'مثال: NeurIPS Proceedings / Nature' : 'e.g. NeurIPS / Nature / IEEE Trans.'}
                className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  {isAr ? 'سنة النشر' : 'Year'}
                </label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  {isAr ? 'المجلد (Vol)' : 'Volume'}
                </label>
                <input
                  type="text"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  placeholder="30"
                  className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  {isAr ? 'الصفحات' : 'Pages'}
                </label>
                <input
                  type="text"
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  placeholder="6000-6010"
                  className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'رابط DOI أو URL' : 'DOI or URL'}
              </label>
              <input
                type="text"
                value={urlOrDoi}
                onChange={(e) => setUrlOrDoi(e.target.value)}
                placeholder="10.48550/arXiv.1706.03762"
                className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Generated Output Preview Cards */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            {/* Full Reference */}
            <div className="bg-[#0A0C14] border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  {isAr ? `التوثيق في قائمة المراجع (${activeStyle.toUpperCase()} Bibliography):` : `${activeStyle.toUpperCase()} Reference List Item:`}
                </span>
                <button
                  onClick={() => copyText(activeFormattedCitation, 'full')}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition-colors"
                >
                  {copiedItem === 'full' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {isAr ? 'نسخ المرجع' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-slate-200 font-serif leading-relaxed select-all">
                {activeFormattedCitation}
              </p>
            </div>

            {/* In-text Citation */}
            <div className="bg-[#0A0C14] border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                  {isAr ? 'التوثيق داخل المتن (In-Text Citation):' : 'In-Text Citation (Within Paragraph):'}
                </span>
                <button
                  onClick={() => copyText(inTextCitation, 'intext')}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition-colors"
                >
                  {copiedItem === 'intext' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {isAr ? 'نسخ التوثيق' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-cyan-300 font-mono select-all">
                {inTextCitation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: TONE POLISHER */}
      {subTab === 'polish' && (
        <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-black text-white">
              {isAr ? 'ترقية المسودة إلى أسلوب علمي أكاديمي محكم' : 'Scholarly Prose Polishing'}
            </h3>
            <p className="text-xs text-slate-400">
              {isAr ? 'اكتب أفكارك بالمسودة العادية وسيعيد صياغتها بألفاظ أكاديمية متقنة تليق بالأبحاث والمجلات العلمية' : 'Turns rough drafts into peer-review caliber prose with academic transitions and active balance'}
            </p>
          </div>

          <textarea
            value={rawDraft}
            onChange={(e) => setRawDraft(e.target.value)}
            rows={5}
            placeholder={isAr ? 'الصق فقرتك المكتوبة هنا وسنقوم بترقيتها وصقل مصطلحاتها...' : 'Paste your rough paragraph or section draft here...'}
            className="w-full bg-[#0A0C14] border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
          />

          <div className="flex justify-end">
            <button
              onClick={handlePolishDraft}
              disabled={isPolishing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isPolishing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {isAr ? 'جاري ترقية الصياغة...' : 'Refining prose...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAr ? 'ترقية الصياغة الأكاديمية' : 'Polish Academic Prose'}
                </>
              )}
            </button>
          </div>

          {polishedResult && (
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  {isAr ? 'الصياغة الأكاديمية الرصينة المقترحة:' : 'Refined Academic Version:'}
                </span>
                <button
                  onClick={() => copyText(polishedResult, 'polished')}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white"
                >
                  {copiedItem === 'polished' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {isAr ? 'نسخ النص المصقول' : 'Copy'}
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800 text-xs md:text-sm text-slate-100 leading-relaxed font-serif">
                {polishedResult}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: ORIGINALITY & INTEGRITY */}
      {subTab === 'originality' && (
        <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-black text-white">
              {isAr ? 'فحص الأصالة وتجنب الانتحال غير المقصود' : 'Academic Integrity & Synthesis Diagnostic'}
            </h3>
            <p className="text-xs text-slate-400">
              {isAr ? 'تحليل الفقرة للتأكد من احتوائها على تحليل شخصي وتجنب النسخ الحرفي أو الترقيع (Patchwriting)' : 'Identifies over-reliance on source phrasing and offers synthesis guidance'}
            </p>
          </div>

          <textarea
            value={originalityInput}
            onChange={(e) => setOriginalityInput(e.target.value)}
            rows={5}
            placeholder={isAr ? 'الصق الفقرة التي أعدت صياغتها لفحص سلامتها وتوثيقها...' : 'Paste your rewritten paragraph to assess originality and attribution...'}
            className="w-full bg-[#0A0C14] border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
          />

          <div className="flex justify-end">
            <button
              onClick={handleCheckOriginality}
              disabled={isCheckingOriginality}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
            >
              {isCheckingOriginality ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {isAr ? 'جاري الفحص والتحليل...' : 'Analyzing text...'}
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isAr ? 'تشخيص الأصالة والتوثيق' : 'Diagnose Originality'}
                </>
              )}
            </button>
          </div>

          {originalityFeedback && (
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                {isAr ? 'تقرير تشخيص الأصالة والتوصيات الأكاديمية:' : 'Originality Report & Advice:'}
              </span>
              <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                {originalityFeedback}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
