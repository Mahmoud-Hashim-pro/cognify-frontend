/**
 * Neurodiversity, Autism & AAC Communication Engine.
 * 
 * Provides:
 * 1. Persistent Personalized PECS (Picture Exchange Communication System) cards.
 * 2. Predictability-Centric Daily Visual Routine with persistent task completion.
 * 3. Sensory Regulation, Emotion Logging, and Server-Side Meltdown Dispatch.
 * 4. Clinical ABA & OT Pattern Analytics (Peak times, triggers, routine correlations).
 * 5. Dyslexia & Universal Visual Comfort persistence.
 */

import { doc, getDoc, setDoc, collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, cleanDataForFirestore } from './firebase';
import { PECSCard, SensoryEmotionLog } from '../types';
import { loadContacts, isValidContactPhone } from './contacts';
import { triggerHapticAlert } from './hapticNavEngine';
import { dispatchServerEmergencySOS, EmergencyDispatchResult } from './emergencyDispatcher';
import { speak } from './tts';

export interface VisualScheduleItem {
  id: string;
  time: string;
  titleAr: string;
  titleEn: string;
  titleFr: string;
  icon: string;
  done: boolean;
  category?: 'routine' | 'learning' | 'meals' | 'therapy' | 'play' | 'hygiene';
}

export interface VisualComfortSettings {
  isDyslexiaFont: boolean;
  showReadingRuler: boolean;
  tintColor: 'none' | 'cream' | 'mint' | 'rose';
}

export interface SensoryPatternAnalysis {
  totalLogs: number;
  totalMeltdowns: number; // intensity >= 4
  timeOfDayDistribution: {
    morning: number; // 06:00 - 12:00
    afternoon: number; // 12:00 - 17:00
    evening: number; // 17:00 - 22:00
    night: number; // 22:00 - 06:00
  };
  peakTimeWindow: string;
  peakTimeWindowEn: string;
  topTriggers: { trigger: string; count: number; percentage: number }[];
  scheduleCorrelation: {
    correlatedTaskTitle: string;
    correlationCount: number;
    percentage: number;
    clinicalRecommendation: string;
    clinicalRecommendationEn: string;
  } | null;
}

const STORAGE_KEYS = {
  PECS: 'cognify_neurodiversity_pecs_cards',
  SCHEDULE: 'cognify_neurodiversity_daily_schedule',
  SENSORY_LOGS: 'cognify_sensory_emotion_logs',
  VISUAL_COMFORT: 'cognify_visual_comfort_settings',
};

// In-memory fallback stores for SSR, Node testing, and offline resiliency
const memoryPecsStore = new Map<string, PECSCard[]>();
const memoryScheduleStore = new Map<string, VisualScheduleItem[]>();
const memorySensoryStore = new Map<string, SensoryEmotionLog[]>();
let memoryComfortStore: VisualComfortSettings | null = null;

export const INITIAL_PECS_CARDS: PECSCard[] = [
  // Food & Drink
  { id: 'pecs-1', labelAr: 'مية', labelEn: 'Water', labelFr: 'Eau', phraseAr: 'أنا عايز أشرب مية لو سمحت.', phraseEn: 'I want some water please.', phraseFr: "Je veux de l'eau s'il vous plaît.", category: 'food', icon: '💧', color: 'bg-blue-500/20 border-blue-500/40 text-blue-300' },
  { id: 'pecs-2', labelAr: 'أكل / جوعان', labelEn: 'Food / Hungry', labelFr: 'Nourriture', phraseAr: 'أنا جوعان وعايز آكل وجبة خفيفة.', phraseEn: 'I am hungry and want to eat.', phraseFr: "J'ai faim et je veux manger.", category: 'food', icon: '🍎', color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
  { id: 'pecs-3', labelAr: 'حمام', labelEn: 'Bathroom', labelFr: 'Toilettes', phraseAr: 'عايز أروح الحمام لو سمحت.', phraseEn: 'I need to use the bathroom please.', phraseFr: "J'ai besoin d'aller aux toilettes.", category: 'routine', icon: '🚻', color: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' },
  
  // Feelings & Sensory
  { id: 'pecs-4', labelAr: 'فرحان / مبسوط', labelEn: 'Happy', labelFr: 'Heureux', phraseAr: 'أنا حاسس بفرح ومبسوط.', phraseEn: 'I am feeling happy.', phraseFr: 'Je me sens heureux.', category: 'feelings', icon: '😊', color: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
  { id: 'pecs-5', labelAr: 'زعلان / مضايق', labelEn: 'Sad / Upset', labelFr: 'Triste', phraseAr: 'أنا زعلان وحاسس بضيق.', phraseEn: 'I am feeling sad and upset.', phraseFr: 'Je me sens triste.', category: 'feelings', icon: '😢', color: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' },
  { id: 'pecs-6', labelAr: 'صوت عالي / إزعاج', labelEn: 'Too Loud', labelFr: 'Trop fort', phraseAr: 'الصوت عالي ومزعج، محتاج هدوء.', phraseEn: 'It is too loud here, I need quiet.', phraseFr: "C'est trop bruyant, j'ai besoin de calme.", category: 'feelings', icon: '🎧', color: 'bg-rose-500/20 border-rose-500/40 text-rose-300' },
  { id: 'pecs-7', labelAr: 'تعبان / عايز أنام', labelEn: 'Tired / Rest', labelFr: 'Fatigué', phraseAr: 'أنا تعبان ومحتاج أرتاح شوية.', phraseEn: 'I am tired and need to rest.', phraseFr: "Je suis fatigué et j'ai besoin de me reposer.", category: 'routine', icon: '🛏️', color: 'bg-purple-500/20 border-purple-500/40 text-purple-300' },
  
  // Play & Social
  { id: 'pecs-8', labelAr: 'عايز ألعب', labelEn: 'Play Game', labelFr: 'Jouer', phraseAr: 'عايز ألعب بلعبتي المفضلة.', phraseEn: 'I want to play a game.', phraseFr: 'Je veux jouer.', category: 'play', icon: '🧩', color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' },
  { id: 'pecs-9', labelAr: 'أنا محتاج حضن', labelEn: 'Need a Hug', labelFr: 'Câlin', phraseAr: 'محتاج حضن عشان أهدى.', phraseEn: 'I need a gentle hug.', phraseFr: "J'ai besoin d'un câlin.", category: 'feelings', icon: '🫂', color: 'bg-pink-500/20 border-pink-500/40 text-pink-300' },
  { id: 'pecs-10', labelAr: 'عايز مساعدة', labelEn: 'Help Me', labelFr: 'Aide-moi', phraseAr: 'ممكن تساعدني في دي لو سمحت؟', phraseEn: 'Can you please help me with this?', phraseFr: "Pouvez-vous m'aider s'il vous plaît ?", category: 'medical', icon: '🤝', color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
  { id: 'pecs-11', labelAr: 'ألم / في حاجة بتوجعني', labelEn: 'In Pain', labelFr: 'Douleur', phraseAr: 'عندي ألم وفي حاجة بتوجعني.', phraseEn: 'I feel pain somewhere in my body.', phraseFr: "J'ai mal quelque part.", category: 'medical', icon: '🩹', color: 'bg-red-500/20 border-red-500/40 text-red-300' },
  { id: 'pecs-12', labelAr: 'عايز أتمشى', labelEn: 'Walk Outside', labelFr: 'Marcher', phraseAr: 'عايز أخرج أتمشى في الهواء.', phraseEn: 'I want to go for a short walk outside.', phraseFr: 'Je veux faire une promenade.', category: 'play', icon: '🌳', color: 'bg-teal-500/20 border-teal-500/40 text-teal-300' },
];

export const INITIAL_SCHEDULE: VisualScheduleItem[] = [
  { id: 'sch-1', time: '08:00 AM', titleAr: 'الاستيقاظ وغسل الوجه والأسنان', titleEn: 'Wake up & brush teeth', titleFr: 'Réveil et brossage des dents', icon: '🪥', done: true, category: 'hygiene' },
  { id: 'sch-2', time: '08:30 AM', titleAr: 'وجبة الإفطار الصحية', titleEn: 'Healthy breakfast', titleFr: 'Petit-déjeuner', icon: '🥣', done: true, category: 'meals' },
  { id: 'sch-3', time: '10:00 AM', titleAr: 'جلسة التعلم والقراءة الممتعة', titleEn: 'Learning & reading session', titleFr: 'Session de lecture et étude', icon: '📚', done: false, category: 'learning' },
  { id: 'sch-4', time: '01:00 PM', titleAr: 'وقت الغداء والراحة', titleEn: 'Lunch time & break', titleFr: 'Déjeuner et pause', icon: '🍲', done: false, category: 'meals' },
  { id: 'sch-5', time: '04:00 PM', titleAr: 'تمارين التنفس واللعب الحركي', titleEn: 'Breathing exercise & sensory play', titleFr: 'Exercices de respiration et jeu', icon: '🎨', done: false, category: 'therapy' },
  { id: 'sch-6', time: '08:00 PM', titleAr: 'العشاء والاستعداد للنوم الهادئ', titleEn: 'Dinner & wind down for sleep', titleFr: 'Dîner et coucher calme', icon: '🌙', done: false, category: 'routine' },
];

export const INITIAL_VISUAL_COMFORT: VisualComfortSettings = {
  isDyslexiaFont: false,
  showReadingRuler: false,
  tintColor: 'none',
};

// ─────────────────────────────────────────────────────────────
// 1. PERSISTENT PECS CARDS ENGINE
// ─────────────────────────────────────────────────────────────

export async function loadPecsCards(uid?: string): Promise<PECSCard[]> {
  const storeKey = uid || 'default';
  if (memoryPecsStore.has(storeKey)) {
    return memoryPecsStore.get(storeKey)!;
  }

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(STORAGE_KEYS.PECS);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryPecsStore.set(storeKey, parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse local PECS cards', e);
      }
    }
  }

  if (uid && db) {
    try {
      const docRef = doc(db, 'users', uid, 'neurodiversity', 'pecs');
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().cards) {
        const cloudCards = snap.data().cards as PECSCard[];
        memoryPecsStore.set(storeKey, cloudCards);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.PECS, JSON.stringify(cloudCards));
        }
        return cloudCards;
      }
    } catch (e) {
      // Fall through to initial
    }
  }

  const initial = [...INITIAL_PECS_CARDS];
  memoryPecsStore.set(storeKey, initial);
  return initial;
}

export async function savePecsCards(uid: string | undefined, cards: PECSCard[]): Promise<void> {
  const storeKey = uid || 'default';
  memoryPecsStore.set(storeKey, cards);

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.PECS, JSON.stringify(cards));
  }

  if (uid && db) {
    try {
      const docRef = doc(db, 'users', uid, 'neurodiversity', 'pecs');
      await setDoc(docRef, cleanDataForFirestore({ cards, updatedAt: new Date().toISOString() }), { merge: true });
    } catch (e) {
      // Handled silently
    }
  }
}

export async function addCustomPecsCard(uid: string | undefined, newCard: PECSCard): Promise<PECSCard[]> {
  const current = await loadPecsCards(uid);
  const updated = [newCard, ...current.filter((c) => c.id !== newCard.id)];
  await savePecsCards(uid, updated);
  return updated;
}

export async function deletePecsCard(uid: string | undefined, cardId: string): Promise<PECSCard[]> {
  const current = await loadPecsCards(uid);
  const updated = current.filter((c) => c.id !== cardId);
  await savePecsCards(uid, updated);
  return updated;
}

// ─────────────────────────────────────────────────────────────
// 2. PERSISTENT VISUAL DAILY SCHEDULE ENGINE
// ─────────────────────────────────────────────────────────────

export async function loadVisualSchedule(uid?: string): Promise<VisualScheduleItem[]> {
  const storeKey = uid || 'default';
  if (memoryScheduleStore.has(storeKey)) {
    return memoryScheduleStore.get(storeKey)!;
  }

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryScheduleStore.set(storeKey, parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse local schedule', e);
      }
    }
  }

  if (uid && db) {
    try {
      const docRef = doc(db, 'users', uid, 'neurodiversity', 'schedule');
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().items) {
        const cloudItems = snap.data().items as VisualScheduleItem[];
        memoryScheduleStore.set(storeKey, cloudItems);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(cloudItems));
        }
        return cloudItems;
      }
    } catch (e) {
      // Fall through to initial
    }
  }

  const initial = [...INITIAL_SCHEDULE];
  memoryScheduleStore.set(storeKey, initial);
  return initial;
}

export async function saveVisualSchedule(uid: string | undefined, items: VisualScheduleItem[]): Promise<void> {
  const storeKey = uid || 'default';
  memoryScheduleStore.set(storeKey, items);

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(items));
  }

  if (uid && db) {
    try {
      const docRef = doc(db, 'users', uid, 'neurodiversity', 'schedule');
      await setDoc(docRef, cleanDataForFirestore({ items, updatedAt: new Date().toISOString() }), { merge: true });
    } catch (e) {
      // Handled silently
    }
  }
}

export async function toggleScheduleItemDone(uid: string | undefined, itemId: string): Promise<VisualScheduleItem[]> {
  const current = await loadVisualSchedule(uid);
  const updated = current.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
  await saveVisualSchedule(uid, updated);
  return updated;
}

export async function addScheduleItem(uid: string | undefined, newItem: VisualScheduleItem): Promise<VisualScheduleItem[]> {
  const current = await loadVisualSchedule(uid);
  const updated = [...current.filter((it) => it.id !== newItem.id), newItem];
  await saveVisualSchedule(uid, updated);
  return updated;
}

export async function deleteScheduleItem(uid: string | undefined, itemId: string): Promise<VisualScheduleItem[]> {
  const current = await loadVisualSchedule(uid);
  const updated = current.filter((it) => it.id !== itemId);
  await saveVisualSchedule(uid, updated);
  return updated;
}

// ─────────────────────────────────────────────────────────────
// 3. SENSORY & EMOTIONAL REGULATION WITH SERVER-SIDE MELTDOWN DISPATCH
// ─────────────────────────────────────────────────────────────

export async function recordSensoryLog(
  uid: string | undefined,
  logData: Omit<SensoryEmotionLog, 'id' | 'timestamp'>,
  userName?: string
): Promise<SensoryEmotionLog> {
  const newLog: SensoryEmotionLog = {
    id: `sensory-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...logData,
  };

  const storeKey = uid || 'default';
  const memList = memorySensoryStore.get(storeKey) || [];
  memList.unshift(newLog);
  memorySensoryStore.set(storeKey, memList.slice(0, 100));

  // 1. Local Storage persistence
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SENSORY_LOGS);
      const list: SensoryEmotionLog[] = raw ? JSON.parse(raw) : [];
      list.unshift(newLog);
      localStorage.setItem(STORAGE_KEYS.SENSORY_LOGS, JSON.stringify(list.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to save sensory log to localStorage', e);
    }
  }

  // 2. Cloud Firestore persistence
  if (uid && db) {
    try {
      const colRef = collection(db, 'users', uid, 'sensoryLogs');
      await addDoc(colRef, cleanDataForFirestore({ ...newLog, recordedByUid: uid }));
    } catch (e) {
      // Handled silently
    }
  }

  // 3. Automated Caregiver Early Alerting on Meltdown or Severe Overload
  // Uses hardened server-side dispatch instead of requiring the distressed child to click WhatsApp!
  if (newLog.intensity >= 4 || newLog.level === 'overwhelmed' || newLog.level === 'anxious') {
    triggerHapticAlert('warning');
    if (newLog.intensity === 5) {
      newLog.dispatchResult = await dispatchMeltdownCaregiverAlert(userName || 'الطالب', newLog.sensoryTrigger, uid);
    }
  }

  return newLog;
}

export async function getRecentSensoryLogs(uid?: string, limitCount: number = 20): Promise<SensoryEmotionLog[]> {
  const storeKey = uid || 'default';

  if (uid && db) {
    try {
      const colRef = collection(db, 'users', uid, 'sensoryLogs');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(limitCount));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const cloudLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SensoryEmotionLog));
        memorySensoryStore.set(storeKey, cloudLogs);
        return cloudLogs;
      }
    } catch (e) {
      // Fall through to memory or local
    }
  }

  if (memorySensoryStore.has(storeKey) && memorySensoryStore.get(storeKey)!.length > 0) {
    return memorySensoryStore.get(storeKey)!.slice(0, limitCount);
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.SENSORY_LOGS);
    if (raw) {
      try {
        const list: SensoryEmotionLog[] = JSON.parse(raw);
        memorySensoryStore.set(storeKey, list);
        return list.slice(0, limitCount);
      } catch (e) {
        console.warn('Failed to parse local sensory logs', e);
      }
    }
  }

  return memorySensoryStore.get(storeKey) || [];
}

/**
 * Dispatches an automated early alert to the primary caregiver when a Meltdown / Severe Overload occurs.
 * Uses the hardened server-side emergency dispatch pipeline with rate limiting,
 * authentication verification, audit logging, and automated SMS / Telegram / Webhook dispatch.
 */
export async function dispatchMeltdownCaregiverAlert(
  studentName: string,
  trigger?: string,
  uid?: string
): Promise<EmergencyDispatchResult> {
  const contacts = loadContacts();
  const primary = contacts.find((c) => c.isPrimaryEmergency && isValidContactPhone(c.phone)) ||
                  contacts.find((c) => isValidContactPhone(c.phone));

  const caregiverPhone = primary?.phone || '';
  const caregiverName = primary?.nameAr || primary?.nameEn || 'Primary Caregiver';

  const textMsg = `الطالب ${studentName} سجل الآن حالة إجهاد / انفجار حسي (Meltdown)${
    trigger ? ` بسبب: ${trigger}` : ''
  }. يُرجى التدخل وتقديم الدعم الحسي وتهدئة المكان.`;

  return await dispatchServerEmergencySOS({
    uid,
    studentName,
    caregiverPhone,
    caregiverName,
    source: 'sensory_meltdown',
    incidentType: 'sensory_meltdown',
    severity: 'moderate',
    trigger,
    text: textMsg,
  });
}

// ─────────────────────────────────────────────────────────────
// 4. CLINICAL ABA & OT PATTERN ANALYTICS
// ─────────────────────────────────────────────────────────────

export function analyzeSensoryPatterns(
  logs: SensoryEmotionLog[],
  schedule: VisualScheduleItem[] = []
): SensoryPatternAnalysis {
  const meltdowns = logs.filter((l) => l.intensity >= 4 || l.level === 'overwhelmed' || l.level === 'anxious');
  const totalMeltdowns = meltdowns.length;

  const timeDist = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };

  const triggerMap: Record<string, number> = {};
  const scheduleCorrelationMap: Record<string, number> = {};

  for (const m of meltdowns) {
    let hour = 12;
    const timeStrMatch = (m.timestamp || '').match(/T(\d{2}):/);
    if (timeStrMatch) {
      hour = parseInt(timeStrMatch[1], 10);
    } else {
      const d = new Date(m.timestamp);
      hour = isNaN(d.getHours()) ? 12 : d.getHours();
    }

    if (hour >= 6 && hour < 12) timeDist.morning++;
    else if (hour >= 12 && hour < 17) timeDist.afternoon++;
    else if (hour >= 17 && hour < 22) timeDist.evening++;
    else timeDist.night++;

    const tr = m.sensoryTrigger || 'غير محدد';
    triggerMap[tr] = (triggerMap[tr] || 0) + 1;

    // Check correlation with daily schedule
    if (schedule.length > 0) {
      let bestItem: VisualScheduleItem | null = null;
      let minDiff = Infinity;
      for (const item of schedule) {
        const timeMatch = item.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeMatch) {
          let itemHour = parseInt(timeMatch[1], 10);
          const isPm = timeMatch[3].toUpperCase() === 'PM';
          if (isPm && itemHour < 12) itemHour += 12;
          if (!isPm && itemHour === 12) itemHour = 0;

          const diff = hour - itemHour;
          if (diff >= 0 && diff <= 3 && diff < minDiff) {
            minDiff = diff;
            bestItem = item;
          }
        }
      }
      if (bestItem) {
        const title = bestItem.titleAr || bestItem.titleEn;
        scheduleCorrelationMap[title] = (scheduleCorrelationMap[title] || 0) + 1;
      }
    }
  }

  // Peak Window
  let peakTimeWindow = 'غير محدد بعد';
  let peakTimeWindowEn = 'Unspecified yet';
  const maxVal = Math.max(timeDist.morning, timeDist.afternoon, timeDist.evening, timeDist.night);
  if (totalMeltdowns > 0) {
    if (maxVal === timeDist.morning) {
      peakTimeWindow = 'الصباح (06:00 ص - 12:00 م)';
      peakTimeWindowEn = 'Morning (06:00 AM - 12:00 PM)';
    } else if (maxVal === timeDist.afternoon) {
      peakTimeWindow = 'بعد الظهر (12:00 م - 05:00 م)';
      peakTimeWindowEn = 'Afternoon (12:00 PM - 05:00 PM)';
    } else if (maxVal === timeDist.evening) {
      peakTimeWindow = 'المساء (05:00 م - 10:00 م)';
      peakTimeWindowEn = 'Evening (05:00 PM - 10:00 PM)';
    } else {
      peakTimeWindow = 'الليل (10:00 م - 06:00 ص)';
      peakTimeWindowEn = 'Night (10:00 PM - 06:00 AM)';
    }
  }

  // Top Triggers
  const topTriggers = Object.entries(triggerMap)
    .map(([trigger, count]) => ({
      trigger,
      count,
      percentage: totalMeltdowns > 0 ? Math.round((count / totalMeltdowns) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  // Schedule Correlation & Clinical Recommendation for ABA Therapists
  let scheduleCorrelation: SensoryPatternAnalysis['scheduleCorrelation'] = null;
  const topCorrelated = Object.entries(scheduleCorrelationMap).sort((a, b) => b[1] - a[1])[0];
  if (topCorrelated && totalMeltdowns > 0) {
    const pct = Math.round((topCorrelated[1] / totalMeltdowns) * 100);
    scheduleCorrelation = {
      correlatedTaskTitle: topCorrelated[0],
      correlationCount: topCorrelated[1],
      percentage: pct,
      clinicalRecommendation: `${pct}% من نوبات الإجهاد الحسي تزامنت بعد: "${topCorrelated[0]}". توصية سريرية لمحلل السلوك (ABA) وأخصائي العلاج الوظيفي (OT): يُنصح بجدولة استراحة حسية هادئة (Sensory Break) مدتها 10 دقائق وتخفيف الإضاءة فور الانتهاء من هذا النشاط.`,
      clinicalRecommendationEn: `${pct}% of sensory overload episodes occurred after: "${topCorrelated[0]}". ABA & OT Clinical Recommendation: Schedule a 10-minute quiet sensory break and reduce ambient stimulation immediately following this activity.`,
    };
  }

  return {
    totalLogs: logs.length,
    totalMeltdowns,
    timeOfDayDistribution: timeDist,
    peakTimeWindow,
    peakTimeWindowEn,
    topTriggers,
    scheduleCorrelation,
  };
}

// ─────────────────────────────────────────────────────────────
// 5. UNIVERSAL DYSLEXIA & VISUAL COMFORT ENGINE
// ─────────────────────────────────────────────────────────────

export function loadVisualComfortSettings(): VisualComfortSettings {
  if (memoryComfortStore) {
    return memoryComfortStore;
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.VISUAL_COMFORT);
    if (raw) {
      try {
        const parsed = { ...INITIAL_VISUAL_COMFORT, ...JSON.parse(raw) };
        memoryComfortStore = parsed;
        return parsed;
      } catch (e) {
        console.warn('Failed to parse visual comfort settings', e);
      }
    }
  }
  return memoryComfortStore || INITIAL_VISUAL_COMFORT;
}

export function saveVisualComfortSettings(settings: VisualComfortSettings): void {
  memoryComfortStore = settings;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.VISUAL_COMFORT, JSON.stringify(settings));
  }
}
