/**
 * Spatial Memory Engine for Cognify 2.0
 * Provides persistent, multi-user isolated physical object tracking,
 * spatial extraction from vision descriptions, location history,
 * and epistemically honest spatial queries across English, Arabic, and French.
 */

import { SpatialObjectRecord } from '../types';
import {
  SpatialObjectIdentity,
  SpatialLocationObservation,
  SpatialDisambiguationResult,
  SpatialCorrection,
} from '../types/spatialMemory2';
import { db, cleanDataForFirestore } from './firebase';
import { doc, setDoc, getDoc, collection, getDocs, deleteField } from 'firebase/firestore';
import { encryptSpatialRecord, decryptSpatialRecord, encryptData, decryptData } from './userCryptoEngine';

export type {
  SpatialObjectIdentity,
  SpatialLocationObservation,
  SpatialDisambiguationResult,
  SpatialCorrection,
};

const STORAGE_PREFIX = 'cognify_spatial_memory_';

// In-memory per-user cache for rapid query responses
const userSpatialCache: Map<string, SpatialObjectRecord[]> = new Map();

/**
 * Object definitions and keyword dictionaries across EN, AR, and FR
 */
const OBJECT_DICTIONARY: {
  category: SpatialObjectRecord['category'];
  nameEn: string;
  nameAr: string;
  nameFr: string;
  keywords: string[];
}[] = [
  {
    category: 'remote',
    nameEn: 'TV Remote',
    nameAr: 'ريموت التلفزيون',
    nameFr: 'Télécommande',
    keywords: [
      'remote', 'tv remote', 'television remote', 'controller',
      'ريموت', 'ريموت التلفزيون', 'جهاز التحكم', 'الريموت',
      'télécommande', 'telecommande', 'manette'
    ],
  },
  {
    category: 'keys',
    nameEn: 'Keys',
    nameAr: 'المفاتيح',
    nameFr: 'Clés',
    keywords: [
      'keys', 'key', 'keychain', 'car keys', 'house keys',
      'مفاتيح', 'مفتاح', 'المفاتيح', 'سلسلة المفاتيح',
      'clés', 'cles', 'clefs', 'porte-clés', 'porte-cles'
    ],
  },
  {
    category: 'glasses',
    nameEn: 'Glasses',
    nameAr: 'النظارة',
    nameFr: 'Lunettes',
    keywords: [
      'glasses', 'eyeglasses', 'spectacles', 'sunglasses',
      'نظارة', 'النظارة', 'نظارات', 'النظارات',
      'lunettes', 'lunettes de vue', 'lunettes de soleil'
    ],
  },
  {
    category: 'medication',
    nameEn: 'Medication',
    nameAr: 'الدواء / الأقراص',
    nameFr: 'Médicament',
    keywords: [
      'medication', 'medicine', 'pills', 'pill bottle', 'capsules',
      'دواء', 'الدواء', 'علاج', 'أقراص', 'علبة دواء',
      'médicament', 'medicament', 'médicaments', 'pilules', 'comprimés', 'boîte de médicament'
    ],
  },
  {
    category: 'phone',
    nameEn: 'Smartphone',
    nameAr: 'الهاتف المحمول',
    nameFr: 'Téléphone',
    keywords: [
      'phone', 'smartphone', 'cellphone', 'mobile',
      'هاتف', 'الهاتف', 'موبايل', 'الموبايل', 'تليفون',
      'téléphone', 'telephone', 'smartphone', 'portable'
    ],
  },
  {
    category: 'cup',
    nameEn: 'Cup / Mug',
    nameAr: 'كوب / فنجان',
    nameFr: 'Tasse / Verre',
    keywords: [
      'cup', 'mug', 'glass', 'water bottle', 'bottle',
      'كوب', 'كوباية', 'مج', 'فنجان', 'زجاجة مياه',
      'tasse', 'verre', 'bouteille', 'gobelet'
    ],
  },
  {
    category: 'bag',
    nameEn: 'Bag / Wallet',
    nameAr: 'حقيبة / محفظة',
    nameFr: 'Sac / Portefeuille',
    keywords: [
      'bag', 'backpack', 'handbag', 'wallet', 'purse',
      'حقيبة', 'شنطة', 'محفظة', 'كيس',
      'sac', 'sac à dos', 'portefeuille', 'sacoche'
    ],
  },
  {
    category: 'document',
    nameEn: 'Document / Paper',
    nameAr: 'مستند / ورقة',
    nameFr: 'Document / Papier',
    keywords: [
      'document', 'paper', 'notebook', 'id card', 'passport',
      'مستند', 'ورقة', 'كشكول', 'دفتر', 'بطاقة', 'جواز سفر',
      'document', 'papier', 'cahier', 'carte', 'passeport'
    ],
  },
];

const SURFACE_DICTIONARY = [
  { surfaceEn: 'Coffee Table', surfaceAr: 'ترابيزة الصالة', surfaceFr: 'Table basse', keywords: ['coffee table', 'ترابيزة صالة', 'ترابيزة الصالة', 'table basse'] },
  { surfaceEn: 'Table', surfaceAr: 'الترابيزة / الطاولة', surfaceFr: 'Table', keywords: ['table', 'dining table', 'ترابيزة', 'طاولة', 'منضدة', 'table à manger', 'table'] },
  { surfaceEn: 'Desk', surfaceAr: 'المكتب', surfaceFr: 'Bureau', keywords: ['desk', 'workstation', 'مكتب', 'ترابيزة مكتب', 'bureau'] },
  { surfaceEn: 'Sofa', surfaceAr: 'الكنبة', surfaceFr: 'Canapé', keywords: ['sofa', 'couch', 'armchair', 'كنبة', 'أنتريه', 'صوفا', 'canapé', 'fauteuil'] },
  { surfaceEn: 'Kitchen Counter', surfaceAr: 'رخامة المطبخ', surfaceFr: 'Plan de travail', keywords: ['counter', 'countertop', 'kitchen counter', 'رخامة المطبخ', 'طاولة المطبخ', 'plan de travail', 'comptoir'] },
  { surfaceEn: 'Nightstand', surfaceAr: 'الكومودينو', surfaceFr: 'Table de chevet', keywords: ['nightstand', 'bedside table', 'كومودينو', 'table de chevet', 'chevet'] },
  { surfaceEn: 'Bed', surfaceAr: 'السرير', surfaceFr: 'Lit', keywords: ['bed', 'mattress', 'سرير', 'السرير', 'lit'] },
  { surfaceEn: 'Shelf', surfaceAr: 'الرف', surfaceFr: 'Étagère', keywords: ['shelf', 'bookshelf', 'رف', 'الرف', 'مكتبة حائط', 'étagère', 'etagere'] },
  { surfaceEn: 'Floor', surfaceAr: 'الأرضية', surfaceFr: 'Sol', keywords: ['floor', 'ground', 'carpet', 'أرض', 'أرضية', 'سجادة', 'sol', 'tapis'] },
];

const ROOM_DICTIONARY = [
  { roomEn: 'Living Room', roomAr: 'الصالة / غرفة المعيشة', roomFr: 'Salon', keywords: ['living room', 'lounge', 'sitting room', 'صالة', 'الصالة', 'غرفة المعيشة', 'صالون', 'salon', 'salle de séjour'] },
  { roomEn: 'Bedroom', roomAr: 'غرفة النوم', roomFr: 'Chambre', keywords: ['bedroom', 'غرفة النوم', 'أوضة النوم', 'chambre', 'chambre à coucher'] },
  { roomEn: 'Kitchen', roomAr: 'المطبخ', roomFr: 'Cuisine', keywords: ['kitchen', 'مطبخ', 'المطبخ', 'cuisine'] },
  { roomEn: 'Office', roomAr: 'غرفة المكتب', roomFr: 'Bureau', keywords: ['office', 'study room', 'غرفة المكتب', 'مكتب عمل', 'bureau'] },
  { roomEn: 'Hallway', roomAr: 'المدخل / الممر', roomFr: 'Couloir / Entrée', keywords: ['hallway', 'corridor', 'entrance', 'ممر', 'مدخل', 'طرقة', 'couloir', 'entrée', 'entree'] },
];

/**
 * Parses relative direction from text description
 */
function extractDirection(text: string): SpatialObjectRecord['relativePosition'] | undefined {
  const lower = text.toLowerCase();
  let direction: 'left' | 'right' | 'center' | 'top' | 'bottom' | undefined;
  let clockPosition: string | undefined;

  // Check clock positions e.g., "at 2 o'clock", "الساعة 2", "à 2 heures"
  const clockMatch = lower.match(/(?:at|clock position|الساعة|à)\s*(\d{1,2})\s*(?:o'?clock|heures)?/i);
  if (clockMatch && clockMatch[1]) {
    const hr = parseInt(clockMatch[1], 10);
    if (hr >= 1 && hr <= 12) {
      clockPosition = `at ${hr} o'clock`;
    }
  }

  if (lower.includes('left') || lower.includes('شمال') || lower.includes('يسار') || lower.includes('à gauche')) {
    direction = 'left';
  } else if (lower.includes('right') || lower.includes('يمين') || lower.includes('à droite')) {
    direction = 'right';
  } else if (lower.includes('center') || lower.includes('middle') || lower.includes('وسط') || lower.includes('في النص') || lower.includes('au centre') || lower.includes('milieu')) {
    direction = 'center';
  }

  let distance: 'near' | 'medium' | 'far' | undefined;
  if (lower.includes('close') || lower.includes('near') || lower.includes('قريب') || lower.includes('près') || lower.includes('proche')) {
    distance = 'near';
  } else if (lower.includes('far') || lower.includes('distant') || lower.includes('بعيد') || lower.includes('loin')) {
    distance = 'far';
  }

  if (direction || clockPosition || distance) {
    return { direction, clockPosition, distance };
  }
  return undefined;
}

/**
 * Extracts spatial objects, surfaces, and rooms from a vision AI scene description.
 */
export function extractSpatialObjectsFromVision(
  description: string,
  uid: string,
  lang: 'en' | 'ar' | 'fr' = 'en'
): SpatialObjectRecord[] {
  if (!description || !uid) return [];
  const lower = description.toLowerCase();
  const detected: SpatialObjectRecord[] = [];
  const now = Date.now();

  // Detect surfaces in the description
  let detectedSurface: (typeof SURFACE_DICTIONARY)[0] | undefined;
  for (const s of SURFACE_DICTIONARY) {
    if (s.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      detectedSurface = s;
      break;
    }
  }

  // Detect rooms in the description
  let detectedRoom: (typeof ROOM_DICTIONARY)[0] | undefined;
  for (const r of ROOM_DICTIONARY) {
    if (r.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      detectedRoom = r;
      break;
    }
  }

  const relativePos = extractDirection(description);

  // Match recognized objects
  for (const objDef of OBJECT_DICTIONARY) {
    const matchedKw = objDef.keywords.find((kw) => lower.includes(kw.toLowerCase()));
    if (matchedKw) {
      const surfaceName =
        lang === 'ar'
          ? detectedSurface?.surfaceAr
          : lang === 'fr'
          ? detectedSurface?.surfaceFr
          : detectedSurface?.surfaceEn;

      const roomName =
        lang === 'ar'
          ? detectedRoom?.roomAr
          : lang === 'fr'
          ? detectedRoom?.roomFr
          : detectedRoom?.roomEn;

      const objName =
        lang === 'ar' ? objDef.nameAr : lang === 'fr' ? objDef.nameFr : objDef.nameEn;

      detected.push({
        id: `sp_${objDef.category}_${uid.substring(0, 6)}`,
        uid,
        objectName: objName,
        category: objDef.category,
        surface: surfaceName || (lang === 'ar' ? 'الترابيزة' : lang === 'fr' ? 'Table' : 'Table'),
        room: roomName,
        relativePosition: relativePos,
        lastSeenTimestamp: now,
        lastSeenIso: new Date(now).toISOString(),
        confidence: 0.9,
        source: 'camera_auto',
        descriptionSnippet: description.slice(0, 160),
        history: [],
      });
    }
  }

  return detected;
}

/**
 * Retrieves all spatial objects stored for a specific user ID.
 * Strictly enforces user isolation.
 */
export function getSpatialObjects(uid: string): SpatialObjectRecord[] {
  if (!uid) return [];

  // Check in-memory cache
  if (userSpatialCache.has(uid)) {
    return userSpatialCache.get(uid)!;
  }

  // Check localStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${uid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Double-check UID match to prevent cross-account leak
          const isolated = parsed.filter((rec: SpatialObjectRecord) => rec.uid === uid);
          userSpatialCache.set(uid, isolated);
          return isolated;
        }
      }
    } catch {
      // ignore
    }
  }

  return [];
}

/**
 * Asynchronously hydrates spatial memory from owner-only Firestore subcollection,
 * transparently decrypting with user-derived AES-256-GCM keys.
 */
export async function loadSpatialObjectsFromFirestore(uid: string): Promise<SpatialObjectRecord[]> {
  if (!uid || typeof window === 'undefined' || !db) return getSpatialObjects(uid);
  try {
    const colRef = collection(db, `users/${uid}/spatialObjects`);
    const snap = await getDocs(colRef);
    if (snap.empty) return getSpatialObjects(uid);

    const decryptedList: SpatialObjectRecord[] = [];
    for (const docSnap of snap.docs) {
      const raw = docSnap.data();
      const rec = await decryptSpatialRecord(raw, uid);
      if (rec) {
        rec.uid = uid;
        decryptedList.push(rec);
      }
    }

    if (decryptedList.length > 0) {
      userSpatialCache.set(uid, decryptedList);
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${uid}`, JSON.stringify(decryptedList));
      } catch {}
      return decryptedList;
    }
  } catch (err) {
    console.warn('[spatialMemoryEngine] Error loading remote spatial objects:', err);
  }
  return getSpatialObjects(uid);
}

/**
 * Saves or updates a spatial object record for a specific user.
 * Automatically records location history when an object moves.
 */
export async function saveSpatialObject(uid: string, record: SpatialObjectRecord): Promise<void> {
  if (!uid || !record) return;
  record.uid = uid; // guarantee user ownership
  record.objectName = record.objectName || (record as any).name || record.category || 'object';

  const current = getSpatialObjects(uid);

  // 1. Match by explicit unique instance ID first
  let existingIdx = record.id ? current.findIndex((item) => item.id === record.id) : -1;

  // 2. If no explicit ID match, match by category/name AND matching room
  if (existingIdx === -1) {
    existingIdx = current.findIndex((item) => {
      const curName = (item.objectName || (item as any).name || item.category || '').toLowerCase();
      const newName = (record.objectName || (record as any).name || record.category || '').toLowerCase();
      const isSameCategory =
        item.category === record.category ||
        (curName && newName && curName === newName);
      if (!isSameCategory) return false;

      // If both items specify a room, only consider them the same instance if rooms match
      if (item.room && record.room) {
        return item.room.toLowerCase().trim() === record.room.toLowerCase().trim();
      }

      // If one or neither specifies a room, treat as the same instance
      return true;
    });
  }

  let updated: SpatialObjectRecord[];

  if (existingIdx >= 0) {
    const prev = current[existingIdx];
    const locationChanged =
      (record.surface && record.surface !== prev.surface) ||
      (record.room && record.room !== prev.room) ||
      (record.relativePosition?.direction && record.relativePosition.direction !== prev.relativePosition?.direction);

    const history = [...(prev.history || [])];
    if (locationChanged && prev.surface) {
      history.push({
        timestamp: prev.lastSeenTimestamp,
        room: prev.room,
        surface: prev.surface,
        direction: prev.relativePosition?.direction,
      });
      // Cap history to last 10 observations
      if (history.length > 10) history.shift();
    }

    const merged: SpatialObjectRecord = {
      ...prev,
      ...record,
      id: prev.id,
      history,
    };
    updated = [...current];
    updated[existingIdx] = merged;
  } else {
    // Generate distinct instance ID if not provided
    if (!record.id) {
      const roomSlug = record.room ? record.room.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'inst';
      record.id = `sp_${record.category}_${roomSlug}_${Date.now().toString(36)}`;
    }
    updated = [record, ...current];
  }

  // Update memory cache
  userSpatialCache.set(uid, updated);

  // Persist locally
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${uid}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  // Persist to Firestore under owner-only subcollection with Zero-Knowledge encryption
  try {
    if (typeof window !== 'undefined' && db && record.id) {
      const objRef = doc(db, `users/${uid}/spatialObjects/${record.id}`);
      const encryptedDoc = await encryptSpatialRecord(record, uid);
      await setDoc(objRef, cleanDataForFirestore(encryptedDoc), { merge: true });

      // Clean up legacy arrays on root doc if they ever existed
      const userRef = doc(db, `users/${uid}`);
      setDoc(userRef, { spatialMemories: deleteField(), spatialMemoriesV2: deleteField() }, { merge: true }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking offline support
  }
}

/**
 * Batch processes newly extracted spatial objects from camera observation.
 */
export async function recordObservedSpatialObjects(uid: string, records: SpatialObjectRecord[]): Promise<void> {
  if (!uid || !Array.isArray(records) || records.length === 0) return;
  for (const rec of records) {
    await saveSpatialObject(uid, rec);
  }
}

/**
 * Formats time elapsed into human readable string in EN, AR, or FR
 */
function formatTimeElapsed(timestamp: number, lang: 'en' | 'ar' | 'fr' = 'en'): string {
  const diffMs = Math.max(0, Date.now() - timestamp);
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);

  if (lang === 'ar') {
    if (mins < 2) return 'منذ لحظات قليلة';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    if (hours === 1) return 'منذ ساعة واحدة';
    if (hours === 2) return 'منذ ساعتين';
    if (hours <= 10) return `منذ ${hours} ساعات`;
    return `منذ ${hours} ساعة`;
  }

  if (lang === 'fr') {
    if (mins < 2) return "à l'instant";
    if (mins < 60) return `il y a ${mins} minute${mins > 1 ? 's' : ''}`;
    if (hours === 1) return 'il y a 1 heure';
    return `il y a ${hours} heures`;
  }

  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

/**
 * Epistemically honest spatial query resolver.
 * Answers "Where is my [item]?", "فين الـ [...]؟", "Où est [l'objet] ?"
 */
export function querySpatialMemory(
  uid: string,
  queryText: string,
  lang: 'en' | 'ar' | 'fr' = 'en'
): { found: boolean; message: string; record?: SpatialObjectRecord; records?: SpatialObjectRecord[] } {
  if (!uid || !queryText) {
    return {
      found: false,
      message:
        lang === 'ar'
          ? 'يرجى تحديد الشيء الذي تبحث عنه.'
          : lang === 'fr'
          ? "Veuillez préciser l'objet que vous recherchez."
          : 'Please specify the object you are searching for.',
    };
  }

  const lower = queryText.toLowerCase().trim();
  const objects = getSpatialObjects(uid);

  // 1. Detect if a specific room was mentioned in the query
  const targetRoom = ROOM_DICTIONARY.find((r) =>
    r.keywords.some((kw) => lower.includes(kw.toLowerCase()))
  );

  // 2. Find all matching records for the query object
  let matchingRecords: SpatialObjectRecord[] = [];

  for (const rec of objects) {
    const objName = (rec.objectName || (rec as any).name || rec.category || '').toLowerCase();
    if (objName && lower.includes(objName)) {
      matchingRecords.push(rec);
    }
  }

  if (matchingRecords.length === 0) {
    for (const objDef of OBJECT_DICTIONARY) {
      if (objDef.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        const found = objects.filter((o) => o.category === objDef.category);
        if (found.length > 0) {
          matchingRecords = found;
          break;
        }
      }
    }
  }

  // 3. If a room was specified, narrow down to records in that room
  if (targetRoom && matchingRecords.length > 1) {
    const roomMatches = matchingRecords.filter((rec) =>
      rec.room && targetRoom.keywords.some((kw) => rec.room!.toLowerCase().includes(kw.toLowerCase()))
    );
    if (roomMatches.length > 0) {
      matchingRecords = roomMatches;
    }
  }

  if (matchingRecords.length === 0) {
    return {
      found: false,
      message:
        lang === 'ar'
          ? 'لم يتم رصد هذا الشيء بالكاميرا مؤخراً في ذاكرتك المكانية.'
          : lang === 'fr'
          ? "Cet objet n'a pas été observé récemment par la caméra dans votre mémoire spatiale."
          : "I haven't observed this object recently through the camera in your spatial memory.",
    };
  }

  // 4. If multiple instances exist across different rooms, report all of them
  if (matchingRecords.length > 1) {
    let multiMessage = '';
    if (lang === 'ar') {
      multiMessage = `تم رصد ${matchingRecords.length} من "${matchingRecords[0].objectName}" في مواقع مختلفة:\n` +
        matchingRecords
          .map((r, i) => `${i + 1}. على ${r.surface || 'الترابيزة'}${r.room ? ` في ${r.room}` : ''} (${formatTimeElapsed(r.lastSeenTimestamp, 'ar')})`)
          .join('\n');
    } else if (lang === 'fr') {
      multiMessage = `J'ai repéré ${matchingRecords.length} "${matchingRecords[0].objectName}" dans différents endroits :\n` +
        matchingRecords
          .map((r, i) => `${i + 1}. Sur ${r.surface || 'la table'}${r.room ? ` dans ${r.room}` : ''} (${formatTimeElapsed(r.lastSeenTimestamp, 'fr')})`)
          .join('\n');
    } else {
      multiMessage = `Found ${matchingRecords.length} instances of "${matchingRecords[0].objectName}" across different locations:\n` +
        matchingRecords
          .map((r, i) => `${i + 1}. On the ${r.surface || 'table'}${r.room ? ` in the ${r.room}` : ''} (${formatTimeElapsed(r.lastSeenTimestamp, 'en')})`)
          .join('\n');
    }
    return {
      found: true,
      message: multiMessage,
      record: matchingRecords[0],
      records: matchingRecords,
    };
  }

  const matchedRecord = matchingRecords[0];

  const elapsed = formatTimeElapsed(matchedRecord.lastSeenTimestamp, lang);
  const pos = matchedRecord.relativePosition;
  let locDesc = '';

  if (lang === 'ar') {
    locDesc = `آخر مرة رأيت فيها "${matchedRecord.objectName}" كانت على ${matchedRecord.surface || 'الترابيزة'}`;
    if (matchedRecord.room) locDesc += ` في ${matchedRecord.room}`;
    if (pos?.direction === 'left') locDesc += ' (ناحية اليسار)';
    if (pos?.direction === 'right') locDesc += ' (ناحية اليمين)';
    if (pos?.clockPosition) locDesc += ` (${pos.clockPosition})`;
    locDesc += `، وذلك ${elapsed}.`;

    // Epistemic honesty qualifier if seen more than 20 minutes ago
    if (Date.now() - matchedRecord.lastSeenTimestamp > 20 * 60 * 1000) {
      locDesc += ' ملاحظة: نظراً لمرور بعض الوقت، قد يكون أحد قام بتحريكه.';
    }
  } else if (lang === 'fr') {
    locDesc = `La dernière fois que j'ai vu "${matchedRecord.objectName}", c'était sur ${matchedRecord.surface || 'la table'}`;
    if (matchedRecord.room) locDesc += ` dans ${matchedRecord.room}`;
    if (pos?.direction === 'left') locDesc += ' (sur la gauche)';
    if (pos?.direction === 'right') locDesc += ' (sur la droite)';
    locDesc += `, ${elapsed}.`;

    if (Date.now() - matchedRecord.lastSeenTimestamp > 20 * 60 * 1000) {
      locDesc += " Remarque : Du temps s'étant écoulé, il est possible qu'il ait été déplacé.";
    }
  } else {
    locDesc = `The last time I saw the "${matchedRecord.objectName}" was on the ${matchedRecord.surface || 'table'}`;
    if (matchedRecord.room) locDesc += ` in the ${matchedRecord.room}`;
    if (pos?.direction === 'left') locDesc += ' (on the left side)';
    if (pos?.direction === 'right') locDesc += ' (on the right side)';
    locDesc += `, ${elapsed}.`;

    if (Date.now() - matchedRecord.lastSeenTimestamp > 20 * 60 * 1000) {
      locDesc += ' Note: Since some time has passed, it might have been moved.';
    }
  }

  return {
    found: true,
    message: locDesc,
    record: matchedRecord,
  };
}

/**
 * Formats a clean context block of remembered object locations for the AI persona.
 */
export function formatSpatialMemoryForAI(uid: string, lang: 'en' | 'ar' | 'fr' = 'en'): string {
  const records = getSpatialObjects(uid);
  if (!records || records.length === 0) return '';

  let block = '\n## COGNIFY SPATIAL MEMORY (PHYSICAL OBJECT LOCATIONS REMEMBERED BY VISION COMPANION)\n';
  block += '- The following physical items have been observed for this student:\n';

  for (const r of records.slice(0, 10)) {
    const elapsed = formatTimeElapsed(r.lastSeenTimestamp, lang);
    const pos = r.relativePosition?.direction ? ` (${r.relativePosition.direction})` : '';
    block += `  * ${r.objectName}: on ${r.surface || 'surface'}${pos}${r.room ? ` in ${r.room}` : ''} [Seen ${elapsed}]\n`;
  }

  block += '- INSTRUCTION: If the user asks where an object is located, reference these last-known positions accurately and state when it was observed.\n';
  return block;
}

// ══════════════════════════════════════════════════════════════════════════════
// SPATIAL MEMORY 2.0 ENGINE
// Multi-instance Object Identity, Disambiguation, Movement Trajectory & Correction
// ══════════════════════════════════════════════════════════════════════════════

const STORAGE_PREFIX_V2 = 'cognify_spatial_memory_v2_';

// In-memory user-isolated cache for Spatial Memory 2.0
const userSpatialV2Cache: Map<string, SpatialObjectIdentity[]> = new Map();

const CATEGORY_PROMPT_NAMES: Record<string, { en: string; ar: string; fr: string }> = {
  remote: { en: 'remote', ar: 'جهاز تحكم', fr: 'télécommande' },
  keys: { en: 'keys', ar: 'مفاتيح', fr: 'clés' },
  glasses: { en: 'glasses', ar: 'نظارة', fr: 'lunettes' },
  medication: { en: 'medication', ar: 'دواء', fr: 'médicament' },
  phone: { en: 'phone', ar: 'هاتف', fr: 'téléphone' },
  cup: { en: 'cup', ar: 'كوب', fr: 'tasse' },
  bag: { en: 'bag', ar: 'حقيبة', fr: 'sac' },
  document: { en: 'document', ar: 'مستند', fr: 'document' },
};

function inferSubType(category: string, label?: string): string | undefined {
  if (!label) return undefined;
  const l = label.toLowerCase();
  if (l.includes('tv') || l.includes('television') || label.includes('تلفزيون')) return 'tv';
  if (l.includes('ac') || l.includes('air conditioner') || label.includes('تكييف')) return 'ac';
  if (l.includes('car') || label.includes('سيارة') || label.includes('عربية')) return 'car';
  if (l.includes('house') || l.includes('home') || label.includes('منزل') || label.includes('بيت')) return 'house';
  return undefined;
}

function deriveLabels(
  category: string,
  identityLabel?: string
): { labelEn: string; labelAr: string; labelFr: string } {
  if (!identityLabel || !identityLabel.trim()) {
    const dict = OBJECT_DICTIONARY.find((d) => d.category === category);
    return {
      labelEn: dict?.nameEn || category,
      labelAr: dict?.nameAr || category,
      labelFr: dict?.nameFr || category,
    };
  }

  const raw = identityLabel.trim();
  const lower = raw.toLowerCase();

  if (category === 'remote' || lower.includes('remote') || lower.includes('ريموت') || lower.includes('télécommande')) {
    if (lower.includes('tv') || lower.includes('television') || raw.includes('تلفزيون') || lower.includes('télé')) {
      return {
        labelEn: 'TV Remote',
        labelAr: 'ريموت التلفزيون',
        labelFr: 'Télécommande TV',
      };
    }
    if (lower.includes('ac') || lower.includes('air conditioner') || lower.includes('climat') || raw.includes('تكييف')) {
      return {
        labelEn: 'AC Remote',
        labelAr: 'ريموت التكييف',
        labelFr: 'Télécommande Climatiseur',
      };
    }
    return {
      labelEn: raw,
      labelAr: raw.includes('ريموت') ? raw : `ريموت (${raw})`,
      labelFr: `Télécommande (${raw})`,
    };
  }

  if (category === 'keys' || lower.includes('key') || lower.includes('مفتاح') || lower.includes('مفاتيح') || lower.includes('clé')) {
    if (lower.includes('car') || raw.includes('سيارة') || raw.includes('عربية') || lower.includes('voiture')) {
      return {
        labelEn: 'Car Keys',
        labelAr: 'مفاتيح السيارة',
        labelFr: 'Clés de voiture',
      };
    }
    if (lower.includes('house') || lower.includes('home') || raw.includes('منزل') || raw.includes('بيت') || lower.includes('maison')) {
      return {
        labelEn: 'House Keys',
        labelAr: 'مفاتيح المنزل',
        labelFr: 'Clés de maison',
      };
    }
    return {
      labelEn: raw,
      labelAr: raw.includes('مفاتيح') ? raw : `مفاتيح (${raw})`,
      labelFr: `Clés (${raw})`,
    };
  }

  const isArabicText = /[\u0600-\u06FF]/.test(raw);
  const dict = OBJECT_DICTIONARY.find((d) => d.category === category);
  return {
    labelEn: isArabicText ? (dict?.nameEn || raw) : raw,
    labelAr: isArabicText ? raw : (dict?.nameAr || raw),
    labelFr: dict?.nameFr || raw,
  };
}

/**
 * Retrieves all Spatial Memory 2.0 object identities for a specific user ID.
 * Strictly enforces user isolation.
 */
export function getSpatialObjectIdentities(uid: string): SpatialObjectIdentity[] {
  if (!uid) return [];

  // Check in-memory cache
  if (userSpatialV2Cache.has(uid)) {
    return userSpatialV2Cache.get(uid)!;
  }

  // Check localStorage
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX_V2}${uid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const isolated = parsed.filter((rec: SpatialObjectIdentity) => !rec.uid || rec.uid === uid);
          isolated.forEach((rec) => {
            rec.uid = uid;
          });
          userSpatialV2Cache.set(uid, isolated);
          return isolated;
        }
      }
    } catch {
      // ignore
    }
  }

  return [];
}

/**
 * Persists the user's Spatial Memory 2.0 objects to memory cache and storage.
 */
function persistSpatialObjectIdentities(uid: string, records: SpatialObjectIdentity[]): void {
  if (!uid) return;
  records.forEach((r) => {
    r.uid = uid;
  });
  userSpatialV2Cache.set(uid, records);

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`${STORAGE_PREFIX_V2}${uid}`, JSON.stringify(records));
    } catch {
      // ignore
    }
  }

  try {
    if (typeof window !== 'undefined' && db) {
      records.forEach(async (ident) => {
        const objRef = doc(db, `users/${uid}/spatialObjects/${ident.id}`);
        const enc = await encryptData(ident, uid);
        setDoc(objRef, cleanDataForFirestore({ id: ident.id, category: ident.category, ...enc }), { merge: true }).catch(() => {});
      });
      // Purge legacy field from root doc
      const userRef = doc(db, `users/${uid}`);
      setDoc(userRef, { spatialMemoriesV2: deleteField(), spatialMemories: deleteField() }, { merge: true }).catch(() => {});
    }
  } catch {
    // Non-blocking offline support
  }
}

/**
 * Resets/clears Spatial Memory 2.0 for a user (useful for tests and cleanup).
 */
export function clearSpatialMemoryV2ForUser(uid: string): void {
  userSpatialV2Cache.delete(uid);
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX_V2}${uid}`);
    } catch {
      // ignore
    }
  }
}

/**
 * Records a spatial observation under Spatial Memory 2.0:
 * - Distinguishes between multiple distinct objects of the same category (e.g. TV Remote vs AC Remote).
 * - Appends an immutable location observation to movementHistory tracking previous locations over time.
 * - Enforces strict user isolation.
 */
export function recordSpatialObservationV2(
  uid: string,
  object: {
    category: string;
    identityLabel?: string;
    roomEn: string;
    roomAr: string;
    roomFr?: string;
    surfaceEn: string;
    surfaceAr: string;
    surfaceFr?: string;
    features?: {
      color?: string;
      roomAffiliation?: string;
      nickname?: string;
      subType?: string;
    } | any;
    confidence?: number;
    visualNote?: string;
    id?: string;
    direction?: string;
  }
): SpatialObjectIdentity {
  if (!uid || !object) {
    throw new Error('User ID and object details are required for spatial memory observation.');
  }

  const existingObjects = getSpatialObjectIdentities(uid);
  const now = Date.now();

  // 1. Check if matching existing instance
  let targetIndex = -1;

  if (object.id) {
    targetIndex = existingObjects.findIndex((o) => o.id === object.id);
  }

  if (targetIndex === -1 && object.identityLabel) {
    const norm = object.identityLabel.toLowerCase().trim();
    targetIndex = existingObjects.findIndex((o) => {
      if (o.category !== object.category) return false;
      if (o.labelEn.toLowerCase() === norm) return true;
      if (o.labelAr === object.identityLabel) return true;
      if (o.distinguishingFeatures?.nickname?.toLowerCase() === norm) return true;
      if (o.distinguishingFeatures?.subType && norm.includes(o.distinguishingFeatures.subType.toLowerCase())) return true;
      return false;
    });
  }

  if (targetIndex === -1 && object.features) {
    if (object.features.nickname) {
      const nick = object.features.nickname.toLowerCase().trim();
      targetIndex = existingObjects.findIndex(
        (o) => o.category === object.category && o.distinguishingFeatures?.nickname?.toLowerCase() === nick
      );
    } else if (object.features.subType) {
      const sub = object.features.subType.toLowerCase().trim();
      targetIndex = existingObjects.findIndex(
        (o) => o.category === object.category && o.distinguishingFeatures?.subType?.toLowerCase() === sub
      );
    }
  }

  const observation: SpatialLocationObservation = {
    timestamp: now,
    roomEn: object.roomEn,
    roomAr: object.roomAr,
    roomFr: object.roomFr || object.roomEn,
    surfaceEn: object.surfaceEn,
    surfaceAr: object.surfaceAr,
    surfaceFr: object.surfaceFr || object.surfaceEn,
    direction: object.direction,
    confidence: object.confidence !== undefined ? object.confidence : 0.9,
    visualNote: object.visualNote,
  };

  let target: SpatialObjectIdentity;

  if (targetIndex >= 0) {
    // Existing object: update location & append movement observation
    target = { ...existingObjects[targetIndex] };
    target.roomEn = object.roomEn;
    target.roomAr = object.roomAr;
    if (object.roomFr) target.roomFr = object.roomFr;
    target.surfaceEn = object.surfaceEn;
    target.surfaceAr = object.surfaceAr;
    if (object.surfaceFr) target.surfaceFr = object.surfaceFr;
    target.lastSeen = now;
    if (object.confidence !== undefined) target.confidence = object.confidence;

    if (object.features) {
      target.distinguishingFeatures = {
        ...target.distinguishingFeatures,
        ...object.features,
      };
    }

    target.movementHistory = [...(target.movementHistory || []), observation];
    existingObjects[targetIndex] = target;
  } else {
    // New object instance
    const labels = deriveLabels(object.category, object.identityLabel);
    const subType = object.features?.subType || inferSubType(object.category, object.identityLabel);
    const id =
      object.id ||
      `sp2_${object.category}_${subType || 'obj'}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    target = {
      id,
      uid,
      category: object.category,
      labelEn: labels.labelEn,
      labelAr: labels.labelAr,
      labelFr: labels.labelFr,
      roomEn: object.roomEn,
      roomAr: object.roomAr,
      roomFr: object.roomFr || object.roomEn,
      surfaceEn: object.surfaceEn,
      surfaceAr: object.surfaceAr,
      surfaceFr: object.surfaceFr || object.surfaceEn,
      distinguishingFeatures: {
        color: object.features?.color,
        roomAffiliation: object.features?.roomAffiliation || object.roomEn,
        nickname: object.features?.nickname || object.identityLabel || labels.labelEn,
        subType,
      },
      confidence: object.confidence !== undefined ? object.confidence : 0.9,
      lastSeen: now,
      movementHistory: [observation],
      correctionsCount: 0,
    };

    existingObjects.push(target);
  }

  persistSpatialObjectIdentities(uid, existingObjects);
  return target;
}

/**
 * Resolves spatial queries under Spatial Memory 2.0:
 * - If multiple candidates match a generic query, returns isAmbiguous: true with candidate list and localized clarification prompts.
 * - If exactly 1 match (or query is specific), returns isAmbiguous: false, primaryMatch, confidence, and lastSeen.
 * - Strictly enforces user isolation.
 */
export function resolveSpatialQueryV2(
  query: string,
  uid: string,
  lang: 'en' | 'ar' | 'fr' = 'en'
): SpatialDisambiguationResult {
  if (!uid || !query || !query.trim()) {
    return {
      isAmbiguous: false,
      candidateMatches: [],
    };
  }

  const objects = getSpatialObjectIdentities(uid);
  if (objects.length === 0) {
    return {
      isAmbiguous: false,
      candidateMatches: [],
    };
  }

  const lower = query.toLowerCase().trim();

  // 1. Initial matching across categories, labels, and distinguishing features
  const initialMatches: SpatialObjectIdentity[] = [];

  for (const obj of objects) {
    let matched = false;

    // Label match
    if (
      lower.includes(obj.labelEn.toLowerCase()) ||
      lower.includes(obj.labelAr.toLowerCase()) ||
      lower.includes(obj.labelFr.toLowerCase())
    ) {
      matched = true;
    }

    // Category match
    if (!matched) {
      if (lower.includes(obj.category.toLowerCase())) {
        matched = true;
      } else {
        const dict = OBJECT_DICTIONARY.find((d) => d.category === obj.category);
        if (dict && dict.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
          matched = true;
        }
      }
    }

    // Features match
    if (!matched && obj.distinguishingFeatures) {
      const { nickname, subType, color } = obj.distinguishingFeatures;
      if (nickname && lower.includes(nickname.toLowerCase())) {
        matched = true;
      } else if (subType && lower.includes(subType.toLowerCase())) {
        matched = true;
      } else if (color && lower.includes(color.toLowerCase())) {
        matched = true;
      }
    }

    if (matched) {
      initialMatches.push(obj);
    }
  }

  if (initialMatches.length === 0) {
    return {
      isAmbiguous: false,
      candidateMatches: [],
    };
  }

  // 2. Specificity Disambiguation:
  // If multiple candidates match, check if query contains distinguishing qualifiers
  let candidateMatches = initialMatches;

  if (initialMatches.length > 1) {
    // Check room qualifier
    const roomMatches = initialMatches.filter((obj) => {
      return (
        (obj.roomEn && lower.includes(obj.roomEn.toLowerCase())) ||
        (obj.roomAr && lower.includes(obj.roomAr.toLowerCase())) ||
        (obj.roomFr && lower.includes(obj.roomFr.toLowerCase()))
      );
    });

    if (roomMatches.length > 0 && roomMatches.length < initialMatches.length) {
      candidateMatches = roomMatches;
    }

    // Check specific subType or distinctive tokens (e.g. TV vs AC, Car vs House)
    if (candidateMatches.length > 1) {
      const specificMatches = candidateMatches.filter((obj) => {
        const sub = obj.distinguishingFeatures?.subType?.toLowerCase();
        const nick = obj.distinguishingFeatures?.nickname?.toLowerCase();
        const enLabel = obj.labelEn.toLowerCase();
        const arLabel = obj.labelAr;

        const isTv = sub === 'tv' || enLabel.includes('tv') || arLabel.includes('تلفزيون');
        const isAc = sub === 'ac' || enLabel.includes('ac') || arLabel.includes('تكييف');
        const isCar = sub === 'car' || enLabel.includes('car') || arLabel.includes('سيارة') || arLabel.includes('عربية');
        const isHouse = sub === 'house' || enLabel.includes('house') || arLabel.includes('منزل') || arLabel.includes('بيت');

        if (isTv && (lower.includes('tv') || lower.includes('television') || lower.includes('تلفزيون') || lower.includes('télé'))) {
          return true;
        }
        if (isAc && (lower.includes('ac') || lower.includes('air conditioner') || lower.includes('تكييف') || lower.includes('climatiseur'))) {
          return true;
        }
        if (isCar && (lower.includes('car') || lower.includes('سيارة') || lower.includes('عربية') || lower.includes('voiture'))) {
          return true;
        }
        if (isHouse && (lower.includes('house') || lower.includes('home') || lower.includes('منزل') || lower.includes('بيت') || lower.includes('maison'))) {
          return true;
        }

        if (sub && lower.includes(sub)) return true;
        if (nick && lower.includes(nick) && nick !== obj.category.toLowerCase()) return true;

        return false;
      });

      if (specificMatches.length > 0 && specificMatches.length < candidateMatches.length) {
        candidateMatches = specificMatches;
      }
    }
  }

  // Exactly 1 match
  if (candidateMatches.length === 1) {
    const primary = candidateMatches[0];
    return {
      isAmbiguous: false,
      candidateMatches,
      primaryMatch: primary,
      confidence: primary.confidence,
      lastSeen: primary.lastSeen,
    };
  }

  // Multiple ambiguous matches
  const categoryKey = candidateMatches[0]?.category || 'object';
  const catNames = CATEGORY_PROMPT_NAMES[categoryKey] || {
    en: categoryKey,
    ar: categoryKey,
    fr: categoryKey,
  };

  const enList = candidateMatches.map((c, i) => `${i + 1}) ${c.labelEn} in ${c.roomEn}`).join(', ');
  const clarificationPromptEn = `You have more than one ${catNames.en} tracked: ${enList}. Which one are you looking for?`;

  const arList = candidateMatches.map((c, i) => `${i + 1}) ${c.labelAr} في ${c.roomAr}`).join(' ');
  const clarificationPromptAr = `يوجد أكثر من ${catNames.ar} مسجل لديك: ${arList}. أيهما تبحث عنه؟`;

  const frList = candidateMatches.map((c, i) => `${i + 1}) ${c.labelFr} dans ${c.roomFr}`).join(', ');
  const clarificationPromptFr = `Vous avez plus d'une ${catNames.fr} enregistrée : ${frList}. Laquelle recherchez-vous ?`;

  return {
    isAmbiguous: true,
    candidateMatches,
    primaryMatch: undefined,
    clarificationPromptEn,
    clarificationPromptAr,
    clarificationPromptFr,
  };
}

/**
 * Applies a user correction to a spatial memory object:
 * - Updates location to user ground-truth.
 * - Increments correctionsCount.
 * - Sets confidence to 1.0 (human verified).
 * - Appends correction observation to movementHistory.
 * - Enforces strict user isolation.
 */
export function applySpatialCorrection(uid: string, correction: SpatialCorrection): SpatialObjectIdentity {
  if (!uid || !correction) {
    throw new Error('User ID and correction details are required.');
  }
  if (correction.userId && correction.userId !== uid) {
    throw new Error('Multi-tenant isolation violation: cannot apply correction across users.');
  }

  const objects = getSpatialObjectIdentities(uid);
  let targetIndex = -1;

  if (correction.targetObjectId) {
    targetIndex = objects.findIndex((o) => o.id === correction.targetObjectId);
  }

  if (targetIndex === -1 && correction.distinguishingLabel) {
    const norm = correction.distinguishingLabel.toLowerCase().trim();
    targetIndex = objects.findIndex(
      (o) =>
        o.category === correction.category &&
        (o.labelEn.toLowerCase().includes(norm) ||
          o.distinguishingFeatures?.nickname?.toLowerCase().includes(norm))
    );
  }

  if (targetIndex === -1) {
    const sameCat = objects.filter((o) => o.category === correction.category);
    if (sameCat.length === 1) {
      targetIndex = objects.findIndex((o) => o.id === sameCat[0].id);
    }
  }

  const now = Date.now();
  let target: SpatialObjectIdentity;

  if (targetIndex >= 0) {
    target = { ...objects[targetIndex] };
    target.roomEn = correction.correctedRoomEn;
    target.roomAr = correction.correctedRoomAr;
    if (correction.correctedRoomFr) target.roomFr = correction.correctedRoomFr;
    target.surfaceEn = correction.correctedSurfaceEn;
    target.surfaceAr = correction.correctedSurfaceAr;
    if (correction.correctedSurfaceFr) target.surfaceFr = correction.correctedSurfaceFr;

    if (correction.distinguishingLabel) {
      target.labelEn = correction.distinguishingLabel;
      target.distinguishingFeatures = {
        ...target.distinguishingFeatures,
        nickname: correction.distinguishingLabel,
      };
      if (/[\u0600-\u06FF]/.test(correction.distinguishingLabel)) {
        target.labelAr = correction.distinguishingLabel;
      }
    }

    target.correctionsCount = (target.correctionsCount || 0) + 1;
    target.confidence = 1.0;
    target.lastSeen = now;

    const observation: SpatialLocationObservation = {
      timestamp: now,
      roomEn: target.roomEn,
      roomAr: target.roomAr,
      roomFr: target.roomFr,
      surfaceEn: target.surfaceEn,
      surfaceAr: target.surfaceAr,
      surfaceFr: target.surfaceFr,
      confidence: 1.0,
      visualNote: `User manual correction #${target.correctionsCount}`,
    };

    target.movementHistory = [...(target.movementHistory || []), observation];
    objects[targetIndex] = target;
  } else {
    const id = correction.targetObjectId || `sp2_${correction.category}_corr_${Date.now().toString(36)}`;
    const labels = deriveLabels(correction.category, correction.distinguishingLabel);
    const observation: SpatialLocationObservation = {
      timestamp: now,
      roomEn: correction.correctedRoomEn,
      roomAr: correction.correctedRoomAr,
      roomFr: correction.correctedRoomFr || correction.correctedRoomEn,
      surfaceEn: correction.correctedSurfaceEn,
      surfaceAr: correction.correctedSurfaceAr,
      surfaceFr: correction.correctedSurfaceFr || correction.correctedSurfaceEn,
      confidence: 1.0,
      visualNote: 'User manual creation/correction',
    };

    target = {
      id,
      uid,
      category: correction.category,
      labelEn: correction.distinguishingLabel || labels.labelEn,
      labelAr: labels.labelAr,
      labelFr: labels.labelFr,
      roomEn: correction.correctedRoomEn,
      roomAr: correction.correctedRoomAr,
      roomFr: correction.correctedRoomFr || correction.correctedRoomEn,
      surfaceEn: correction.correctedSurfaceEn,
      surfaceAr: correction.correctedSurfaceAr,
      surfaceFr: correction.correctedSurfaceFr || correction.correctedSurfaceEn,
      distinguishingFeatures: {
        nickname: correction.distinguishingLabel,
        roomAffiliation: correction.correctedRoomEn,
      },
      confidence: 1.0,
      lastSeen: now,
      movementHistory: [observation],
      correctionsCount: 1,
    };
    objects.push(target);
  }

  persistSpatialObjectIdentities(uid, objects);
  return target;
}

/**
 * Returns the chronological trajectory of an object's movements.
 * Strictly enforces user isolation: returns empty if objectId does not belong to user.
 */
export function getObjectMovementHistory(uid: string, objectId: string): SpatialLocationObservation[] {
  if (!uid || !objectId) return [];
  const objects = getSpatialObjectIdentities(uid);
  const target = objects.find((o) => o.id === objectId);
  if (!target) return [];
  return [...(target.movementHistory || [])].sort((a, b) => a.timestamp - b.timestamp);
}
