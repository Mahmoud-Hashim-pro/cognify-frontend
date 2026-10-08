import { localize } from '../lib/translations';
import React, { useState } from 'react';
import { UserProfile, EducationLevel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, Shield, Award, Languages, Globe, BookOpen, GraduationCap, Briefcase, MapPin, Calendar, Clock, MessageSquare, Edit3, Save, X, Camera, Eye, Brain as BrainIcon, Menu, Sprout, Heart, ThumbsUp, ThumbsDown, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanDataForFirestore } from '../lib/firebase';
import { getTranslation } from '../lib/translations';
import ParentalConsentModal from './ParentalConsentModal';

interface ProfilePageProps {
  profile: UserProfile;
  onMenuClick?: () => void;
  setProfile?: (profile: UserProfile) => void;
  onNavigateBack?: () => void;
  onNavigate?: (view: any) => void;
}

const SUSTAINABILITY_GOALS = [
  { id: 'climate', label: 'Climate Action', icon: Globe },
  { id: 'health', label: 'Good Health & Well-being', icon: Heart },
  { id: 'quality-edu', label: 'Quality Education', icon: GraduationCap },
  { id: 'zero-hunger', label: 'Zero Hunger / Sustainable Food', icon: Sprout }
];

export default function ProfilePage({ profile, onMenuClick, setProfile, onNavigateBack, onNavigate }: ProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const [feedbackStats, setFeedbackStats] = useState<{
    upvotes: number;
    downvotes: number;
    helpfulSnippets: string[];
    improvementSnippets: string[];
    loading: boolean;
  }>({
    upvotes: 0,
    downvotes: 0,
    helpfulSnippets: [],
    improvementSnippets: [],
    loading: true
  });

  React.useEffect(() => {
    if (!profile.uid) return;
    let isActive = true;

    const fetchFeedback = async () => {
      try {
        let up = 0;
        let down = 0;
        const helpful: string[] = [];
        const improvement: string[] = [];

        // 1. Fetch from Chat Threads
        const threadsRef = collection(db, `users/${profile.uid}/threads`);
        const threadsSnap = await getDocs(threadsRef);
        threadsSnap.forEach(docSnap => {
          const messagesData = docSnap.data().messages || [];
          messagesData.forEach((m: any) => {
            if (m.role === 'assistant') {
              if (m.reaction === 'up') {
                up++;
                if (helpful.length < 5 && m.content) {
                  helpful.push(m.content);
                }
              } else if (m.reaction === 'down') {
                down++;
                if (improvement.length < 5 && m.content) {
                  improvement.push(m.content);
                }
              }
            }
          });
        });

        // 2. Fetch from Sandbox Modules
        const sandboxRef = collection(db, `users/${profile.uid}/sandbox`);
        const sandboxSnap = await getDocs(sandboxRef);
        sandboxSnap.forEach(docSnap => {
          const messagesData = docSnap.data().messages || [];
          messagesData.forEach((m: any) => {
            if (m.role === 'assistant') {
              if (m.reaction === 'up') {
                up++;
                if (helpful.length < 5 && m.content) {
                  helpful.push(m.content);
                }
              } else if (m.reaction === 'down') {
                down++;
                if (improvement.length < 5 && m.content) {
                  improvement.push(m.content);
                }
              }
            }
          });
        });

        if (isActive) {
          setFeedbackStats({
            upvotes: up,
            downvotes: down,
            helpfulSnippets: helpful,
            improvementSnippets: improvement,
            loading: false
          });
        }
      } catch (err) {
        console.error("Error fetching feedback on profile: ", err);
        if (isActive) {
          setFeedbackStats(prev => ({ ...prev, loading: false }));
        }
      }
    };

    fetchFeedback();

    return () => {
      isActive = false;
    };
  }, [profile.uid]);

  const stats = [
    { label: 'Cognitive Level', value: profile.level, icon: BrainIcon },
    { label: 'Uplink Integrity', value: `${profile.iqScore || 0}%`, icon: Award },
    { label: 'Merit Index', value: profile.points, icon: Shield },
    { label: 'Sessions', value: profile.chatThreads?.length || 0, icon: Clock },
  ];

  const handleSave = async () => {
    setSaving(true);
    const path = `users/${profile.uid}`;
    try {
      const cleaned = cleanDataForFirestore(editedProfile);
      if (setProfile) setProfile(cleaned);
      await setDoc(doc(db, path), cleaned, { merge: true });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof UserProfile, value: any) => {
    setEditedProfile(prev => ({ ...prev, [key]: value }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resize image to prevent Firestore 1MB limit errors
    const resizeImage = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 256;
            const MAX_HEIGHT = 256;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          };
        };
      });
    };

    const base64 = await resizeImage(file);
    setEditedProfile(prev => ({ ...prev, photoURL: base64 }));
  };

  const currentGoal = SUSTAINABILITY_GOALS.find(g => g.id === (isEditing ? editedProfile.sustainabilityGoal : profile.sustainabilityGoal)) || SUSTAINABILITY_GOALS[1];

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#080409] text-slate-100 p-6 md:p-10 flex flex-col gap-6 md:gap-10 custom-scrollbar relative selection:bg-[#4A1224]/30 selection:text-white overflow-x-hidden font-sans">
      {/* Ambient Lighting Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[#4A1224]/20 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-[#4A1224]/20 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-[#4A1224]/20 rounded-full blur-[140px]" />
      </div>

      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-start gap-4">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="p-2.5 mt-1 text-slate-300 hover:text-white bg-[#0E0610]/90 shadow-md border border-[#4A1224]/50 hover:border-[#4A1224]/80 hover:bg-[#1A0C1D] rounded-2xl active:scale-95 transition-all flex items-center gap-2 shrink-0"
              title={localize(profile.language, 'Back to Assistant', 'العودة للمساعد')}
            >
              <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
              <span className="text-xs font-bold hidden sm:inline">{localize(profile.language, 'Back', 'رجوع')}</span>
            </button>
          )}
          {onMenuClick && (
            <button 
              onClick={onMenuClick}
              className="p-2.5 mt-1 text-slate-300 hover:text-white bg-[#0E0610]/90 shadow-md border border-[#4A1224]/50 hover:border-[#4A1224]/80 hover:bg-[#1A0C1D] rounded-2xl active:scale-95 shrink-0 transition-all"
              aria-label={localize(profile.language, 'Toggle menu', 'القائمة')}
              title={localize(profile.language, 'Open Menu', 'فتح القائمة')}
            >
              <Menu className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase">{getTranslation(profile.language, 'myProfile')}</h1>
            <p className="text-xs md:text-sm text-slate-400 font-medium mt-1">Manage your academic and account details.</p>
          </div>
        </div>
        {!isEditing ? (
          <button 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#0E0610]/90 border border-[#4A1224]/50 hover:border-[#E5A93C]/40 hover:bg-[#1A0C1D] rounded-2xl text-slate-200 hover:text-[#E5A93C] font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-[#E5A93C]/5 active:scale-95"
          >
            <Edit3 className="w-4 h-4 text-[#E5A93C]" /> {getTranslation(profile.language, 'edit')}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setIsEditing(false); setEditedProfile(profile); }}
              className="flex items-center gap-2 px-6 py-3 bg-[#0E0610]/90 border border-[#4A1224]/50 hover:border-[#4A1224]/80 rounded-2xl text-slate-400 hover:text-slate-200 font-black text-xs uppercase tracking-widest transition-all active:scale-95"
            >
              <X className="w-4 h-4" /> {getTranslation(profile.language, 'back')}
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#E5A93C] to-[#831843] hover:from-[#E5A93C]/90 hover:to-[#831843]/90 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-[#E5A93C]/10 active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? (localize(profile.language, 'Saving...', 'جاري الحفظ...')) : getTranslation(profile.language, 'saveChanges')}
            </button>
          </div>
        )}
      </header>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} className="bg-[#150917] border border-[#4A1224]/50 rounded-3xl p-5 backdrop-blur-xl shadow-xl flex items-center gap-4 hover:border-[#4A1224]/80 transition-all">
              <div className="p-3 rounded-2xl bg-[#4A1224]/20 border border-[#E5A93C]/20 text-[#E5A93C] shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{s.label}</p>
                <h4 className="text-xl font-black text-white mt-0.5 tracking-tight">{s.value}</h4>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-20">
        {/* Left Side: Avatar & Basic Info */}
        <div className="xl:col-span-1 space-y-8">
          <div className="bg-[#0E0610]/95 p-8 rounded-[36px] border border-[#4A1224]/60 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center ring-1 ring-[#E5A93C]/10">
            <div className="w-32 h-32 rounded-[36px] bg-[#080409] flex items-center justify-center mb-6 shadow-2xl border-2 border-[#4A1224]/80 relative group overflow-hidden">
              {editedProfile.photoURL || profile.photoURL ? (
                <img 
                  src={isEditing ? editedProfile.photoURL : profile.photoURL} 
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-12 h-12 text-[#E5A93C]" />
              )}
              
              {isEditing && (
                <label className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                  <Camera className="w-8 h-8 text-[#E5A93C]" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              )}

              {!isEditing && (
                <div className="absolute -bottom-2 -end-2 bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600 text-slate-950 p-2 rounded-2xl shadow-lg border-2 border-[#0E0610] z-10">
                  <Shield className="w-4 h-4 text-slate-950" />
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="w-full space-y-4 mb-6">
                <input 
                  className="w-full bg-[#150917] border border-[#4A1224]/60 text-white rounded-2xl px-4 py-2.5 text-center text-xl font-black outline-none focus:border-[#E5A93C] transition-all placeholder-slate-600"
                  value={editedProfile.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Full Name"
                />
                <select 
                   className="w-full bg-[#150917] border border-[#4A1224]/60 text-slate-300 rounded-2xl px-4 py-2.5 text-center text-xs font-bold outline-none focus:border-[#E5A93C] uppercase tracking-widest cursor-pointer transition-all"
                   value={editedProfile.educationLevel || 'University'}
                   onChange={(e) => handleChange('educationLevel', e.target.value)}
                >
                  <option value="Primary">Primary Education</option>
                  <option value="Professional">Professional Workspace</option>
                  <option value="Secondary">Secondary Education</option>
                  <option value="University">University Level</option>
                </select>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black text-white mb-1 tracking-tight">{profile.name}</h2>
                <p className="text-[#E5A93C] text-xs font-black mb-1 uppercase tracking-widest">{profile.educationLevel || profile.role}</p>
                <p className="text-[10px] text-slate-400 font-black mb-6 uppercase tracking-[0.2em]">{profile.religion || "Unspecified Path"}</p>
              </>
            )}
            
            <div className="w-full space-y-4 pt-6 border-t border-[#4A1224]/50">
              <div className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                <Mail className="w-4 h-4 text-[#E5A93C] shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
              <DataField 
                label={getTranslation(profile.language, 'language')} 
                value={profile.language} 
                icon={Languages} 
                isEditing={isEditing} 
                onChange={(v) => handleChange('language', v)} 
                type="select"
                options={['English', 'Arabic', 'Egyptian Ammiya', 'French', 'Spanish', 'German', 'Italian', 'Portuguese', 'Russian', 'Chinese', 'Japanese']}
              />
              <DataField 
                label={getTranslation(profile.language, 'accessibilityMode')} 
                value={profile.accessibilityMode} 
                icon={Eye} 
                isEditing={isEditing} 
                onChange={(v) => handleChange('accessibilityMode', v)} 
                type="select"
                options={['None', 'Sign-Only', 'Speech', 'Visual', 'Vocal-Deaf']}
              />
            </div>
          </div>

          <div className="bg-[#0E0610]/95 p-8 rounded-[36px] border border-[#4A1224]/60 backdrop-blur-xl shadow-2xl ring-1 ring-[#E5A93C]/10">
             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white mb-4 flex items-center gap-2">
                <currentGoal.icon className="w-4 h-4 text-[#E5A93C]" /> Sustainability Goal
             </h3>
             {isEditing ? (
                <div className="space-y-3">
                  {SUSTAINABILITY_GOALS.map(goal => (
                    <button
                      key={goal.id}
                      onClick={() => handleChange('sustainabilityGoal', goal.id)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-xs font-bold ${
                        editedProfile.sustainabilityGoal === goal.id ? 'bg-[#4A1224]/50 border-[#E5A93C]/60 text-[#E5A93C] shadow-md' : 'bg-[#150917] border-[#4A1224]/50 text-slate-400 hover:border-[#E5A93C]/40'
                      }`}
                    >
                      <goal.icon className="w-4 h-4" /> {goal.label}
                    </button>
                  ))}
                </div>
             ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-[#E5A93C]">{currentGoal.label}</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                    Committed to fostering positive change through educational excellence and sustainable practices.
                  </p>
                </div>
             )}
          </div>
        </div>

        {/* Right Side: Detailed Institutional Data */}
        <div className="xl:col-span-2 space-y-8">
          <div className="bg-[#0E0610]/95 p-8 md:p-10 rounded-[36px] border border-[#4A1224]/60 backdrop-blur-xl shadow-2xl ring-1 ring-[#E5A93C]/10">
            <h3 className="text-lg font-black text-white mb-8 flex items-center gap-3">
              <span className="p-2 rounded-xl bg-[#4A1224]/40 border border-[#E5A93C]/30 text-[#E5A93C]">
                <GraduationCap className="w-5 h-5" />
              </span>
              Institution Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              <DataField 
                label={profile.educationLevel === 'Professional' ? "Company Name" : (profile.educationLevel === 'University' ? "University Name" : "School Name")} 
                value={isEditing ? (editedProfile.role === 'Student' ? editedProfile.university : editedProfile.work) : (profile.role === 'Student' ? profile.university : profile.work)} 
                icon={Briefcase} 
                isEditing={isEditing}
                onChange={(v) => handleChange(profile.role === 'Student' ? 'university' : 'work', v)}
              />
              <DataField 
                label={profile.role === 'Student' ? (profile.educationLevel === 'University' ? "Academic Faculty" : "Current Grade") : "Operational Role"} 
                value={isEditing ? (editedProfile.role === 'Student' ? editedProfile.faculty : editedProfile.jobTitle) : (profile.role === 'Student' ? profile.faculty : profile.jobTitle)} 
                icon={BookOpen} 
                isEditing={isEditing}
                onChange={(v) => handleChange(profile.role === 'Student' ? 'faculty' : 'jobTitle', v)}
              />
              <DataField label="Location" value="Cairo_Hub" icon={MapPin} />
              <DataField label="Member Since" value={formatDate(profile.lastQuizDate || new Date())} icon={Calendar} />
              <DataField label="Points" value={`${profile.points ?? 0}`} icon={Award} />
            </div>
          </div>

          <div className="bg-[#0E0610]/95 p-8 md:p-10 rounded-[36px] border border-[#4A1224]/60 backdrop-blur-xl shadow-2xl flex-1 ring-1 ring-[#E5A93C]/10">
            <h3 className="text-lg font-black text-white mb-6 flex items-center gap-3">
              <span className="p-2 rounded-xl bg-[#4A1224]/40 border border-[#E5A93C]/30 text-[#E5A93C]">
                <MessageSquare className="w-5 h-5" />
              </span>
              Recent Chat History
            </h3>
            <div className="space-y-3">
              {!profile.chatThreads || profile.chatThreads.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-medium italic border-2 border-dashed border-[#4A1224]/50 rounded-3xl">
                  No previous chat history recorded.
                </div>
              ) : (
                profile.chatThreads.slice(-4).reverse().map((t, i) => (
                  <div key={t.id || i} className="flex items-start gap-4 p-4 rounded-2xl bg-[#150917]/80 hover:bg-[#1C0B1E] transition-all border border-[#4A1224]/50 hover:border-[#E5A93C]/40">
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-[#4A1224]/30 border border-[#E5A93C]/20 text-[#E5A93C]">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white flex items-center gap-2">
                        {t.title}
                        {t.updatedAt && (
                          <span className="text-[10px] font-normal text-[#E5A93C]/70 uppercase tracking-wider">• {formatDate(t.updatedAt)}</span>
                        )}
                      </p>
                      <p className="text-sm text-slate-400 line-clamp-1 leading-relaxed font-medium">{t.lastMessageSnippet || 'No messages yet'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Guidance Feedback Hub */}
          <div className="bg-[#0E0610]/95 p-8 md:p-10 rounded-[36px] border border-[#4A1224]/60 backdrop-blur-xl shadow-2xl ring-1 ring-[#E5A93C]/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-[#4A1224]/40 border border-[#E5A93C]/30 text-[#E5A93C]">
                    <BrainIcon className="w-5 h-5" />
                  </span>
                  {localize(profile.language, 'AI Guidance Feedback Hub', 'مؤشر تقييم الذكاء الاصطناعي')}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  {localize(profile.language, 'Analysis of helpful and flagged responses across your intellectual sessions.', 'تحليل الملاحظات والتقييمات التي قدمتها لإجابات المساعد الذكي.')}
                </p>
              </div>
              
              {!feedbackStats.loading && (feedbackStats.upvotes > 0 || feedbackStats.downvotes > 0) && (
                <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-2xl border border-emerald-500/20">
                  <span className="text-lg font-black">
                    {Math.round((feedbackStats.upvotes / (feedbackStats.upvotes + feedbackStats.downvotes)) * 100)}%
                  </span>
                  <span className="text-[10px] uppercase font-black tracking-wider">
                    {localize(profile.language, 'Positive Rating', 'تقييم إيجابي')}
                  </span>
                </div>
              )}
            </div>

            {feedbackStats.loading ? (
              <div className="flex items-center justify-center py-10 gap-3 text-slate-500 font-bold text-xs uppercase tracking-widest">
                <Loader2 className="w-5 h-5 animate-spin text-[#E5A93C]" />
                <span>{localize(profile.language, 'Compiling intelligence feedback...', 'جاري تحميل التقييمات...')}</span>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Metrics row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 bg-emerald-950/20 border border-emerald-800/40 rounded-3xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                        {localize(profile.language, 'Helpful Responses', 'الإجابات المفيدة')}
                      </p>
                      <h4 className="text-3xl font-black text-white mt-1">{feedbackStats.upvotes}</h4>
                    </div>
                    <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 border border-emerald-500/30">
                      <ThumbsUp className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="p-6 bg-rose-950/20 border border-rose-800/40 rounded-3xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-rose-400 tracking-wider">
                        {localize(profile.language, 'Needs Improvement', 'تحتاج إلى تحسين')}
                      </p>
                      <h4 className="text-3xl font-black text-white mt-1">{feedbackStats.downvotes}</h4>
                    </div>
                    <div className="p-3 bg-rose-500/20 rounded-2xl text-rose-400 border border-rose-500/30">
                      <ThumbsDown className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* Helpful list */}
                {feedbackStats.helpfulSnippets.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black tracking-wider uppercase text-slate-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
                      {localize(profile.language, 'Sample Commended Guidance', 'نماذج الإجابات المفيدة والمدعومة')}
                    </h4>
                    <div className="space-y-3">
                      {feedbackStats.helpfulSnippets.map((snippet, idx) => (
                        <div key={idx} className="p-4 bg-[#150917] border border-[#4A1224]/60 rounded-2xl text-xs font-medium text-slate-300 leading-relaxed italic line-clamp-2 hover:line-clamp-none transition-all cursor-pointer border-s-4 border-s-emerald-500">
                          "{snippet}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Improvements list */}
                {feedbackStats.improvementSnippets.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black tracking-wider uppercase text-slate-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400 shadow-sm shadow-rose-400"></span>
                      {localize(profile.language, 'Identified Alignment Gaps', 'نقاط للتطوير والتحسين')}
                    </h4>
                    <div className="space-y-3">
                      {feedbackStats.improvementSnippets.map((snippet, idx) => (
                        <div key={idx} className="p-4 bg-[#150917] border border-[#4A1224]/60 rounded-2xl text-xs font-medium text-slate-300 leading-relaxed italic line-clamp-2 hover:line-clamp-none transition-all cursor-pointer border-s-4 border-s-rose-500">
                          "{snippet}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {feedbackStats.upvotes === 0 && feedbackStats.downvotes === 0 && (
                  <div className="text-center py-10 text-slate-500 font-medium italic border-2 border-dashed border-[#4A1224]/50 rounded-3xl">
                    {localize(profile.language, 'No message ratings submitted yet. Commend or flag responses in the chat view to populate this analytics terminal.', 'لا توجد تقييمات لإجابات الذكاء الاصطناعي حتى الآن. يمكنك تقييم الإجابات داخل المحادثة بوضع علامة مفيد أو غير مفيد.')}
                  </div>
                )}
              </div>
            )}
            {/* Guardian & Privacy Protection Section */}
            <div className="bg-[#080409]/90 border border-[#4A1224]/60 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 border border-amber-500/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">
                      {localize(profile.language, 'Guardian & Data Privacy Settings', 'إعدادات ولي الأمر والخصوصية')}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {localize(profile.language, 'Manage parental consent, camera permissions, and GDPR data rights', 'إدارة موافقة ولي الأمر وصلاحيات الكاميرا وحقوق حماية البيانات')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-[#150917] border border-[#4A1224]/50 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                        {localize(profile.language, 'Parental Consent Status', 'حالة موافقة ولي الأمر')}
                      </span>
                      {profile.parentalConsent?.verified ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {localize(profile.language, 'Verified', 'موثّق وموافق')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          {localize(profile.language, 'Not Configured', 'غير مسجل')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300">
                      {profile.parentalConsent?.parentName
                        ? `${localize(profile.language, 'Guardian', 'ولي الأمر')}: ${profile.parentalConsent.parentName} (${profile.parentEmail || profile.parentalConsent.parentEmail})`
                        : localize(profile.language, 'Grant camera and microphone authorization for minors.', 'تفويض استخدام الكاميرا والميكروفون للطلاب القاصرين.')}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowConsentModal(true)}
                    className="mt-4 w-full py-2.5 px-4 bg-[#1F0D22] hover:bg-[#2A122E] border border-[#4A1224] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    {profile.parentalConsent?.verified
                      ? localize(profile.language, 'Update Consent Terms', 'تحديث شروط الموافقة')
                      : localize(profile.language, 'Open Consent Form', 'فتح نموذج موافقة ولي الأمر')}
                  </button>
                </div>

                <div className="p-4 bg-[#150917] border border-[#4A1224]/50 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#E5A93C]">
                        {localize(profile.language, 'GDPR & Privacy Center', 'مركز الخصوصية والـ GDPR')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E5A93C]/15 text-[#E5A93C] border border-[#E5A93C]/30">
                        {localize(profile.language, 'Zero-Knowledge', 'معالجة محلية')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      {localize(
                        profile.language,
                        'Download your full data package, inspect differential privacy noise, or exercise GDPR Article 17 erasure.',
                        'تحميل حزمة بياناتك الكاملة، فحص معايير الخصوصية التفاضلية، أو طلب مسح البيانات (حق النسيان).'
                      )}
                    </p>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('privacy_security')}
                      className="mt-4 w-full py-2.5 px-4 bg-[#1F0D22] hover:bg-[#2A122E] border border-[#4A1224] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Globe className="w-4 h-4 text-[#E5A93C]" />
                      {localize(profile.language, 'Open Privacy & Security Terminal', 'فتح مركز الأمان والخصوصية')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Parental Consent Modal */}
      <ParentalConsentModal
        isOpen={showConsentModal}
        profile={profile}
        requiredScope="all"
        onConsentGranted={(consent) => {
          setShowConsentModal(false);
          if (setProfile) {
            setProfile({
              ...profile,
              parentalConsent: consent,
              parentEmail: consent.parentEmail,
            });
          }
        }}
        onCancel={() => setShowConsentModal(false)}
      />
    </div>
  );
}

function DataField({ 
  label, 
  value, 
  icon: Icon, 
  isEditing, 
  onChange, 
  type = 'text', 
  options 
}: { 
  label: string, 
  value: string | undefined, 
  icon: any, 
  isEditing?: boolean, 
  onChange?: (v: string) => void,
  type?: 'text' | 'select',
  options?: string[]
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-[#E5A93C] tracking-widest">
        <Icon className="w-3.5 h-3.5 text-[#E5A93C]" /> {label}
      </div>
      {isEditing && onChange ? (
        type === 'select' ? (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[#150917] border border-[#4A1224]/60 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-[#E5A93C] cursor-pointer transition-all"
          >
            {options?.map(opt => (
              <option key={opt} value={opt} className="bg-[#150917] text-white">{opt}</option>
            ))}
          </select>
        ) : (
          <input 
            className="w-full bg-[#150917] border border-[#4A1224]/60 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-[#E5A93C] transition-all placeholder-slate-600"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      ) : (
        <div className="text-lg font-black text-white border-b border-[#4A1224]/50 pb-2">{value || 'N/A'}</div>
      )}
    </div>
  );
}

function BrainIconWrapper(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 8.105 4 4 0 0 0 5.327 2.72 2.5 2.5 0 0 0 4.676 0 4 4 0 0 0 5.327-2.72 4 4 0 0 0 .52-8.105 4 4 0 0 0-2.526-5.77A3 3 0 1 0 12 5z" />
      <path d="M9 13a4.5 4.5 0 0 0 3-4" />
      <path d="M12 13a4.5 4.5 0 0 1 3-4" />
      <path d="M12 13v4" />
      <path d="M12 13a4.5 4.5 0 0 1-3 4" />
      <path d="M12 13a4.5 4.5 0 0 0 3 4" />
    </svg>
  );
}
