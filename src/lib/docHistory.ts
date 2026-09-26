/**
 * Local, per-device archive of Document Reader results.
 *
 * Deliberately does NOT store the original file (PDF/image) — only the
 * text Gemini already produced (summary/full-read/translation), plus
 * enough metadata to redisplay, replay aloud, or re-export it as .docx
 * without re-uploading or re-processing anything. This keeps entries tiny
 * (a few KB of text each) so a generous history fits comfortably under
 * localStorage's ~5MB per-origin limit.
 *
 * Scoped to `profile.uid` so different people signed in on the same
 * device/browser never see each other's document history.
 */

export interface DocHistoryEntry {
  id: string;
  fileName: string;
  action: 'summarize' | 'read' | 'translate';
  lang: 'ar' | 'en' | 'fr';
  resultText: string;
  createdAt: number;
}

const MAX_ENTRIES = 20;

const storageKey = (uid: string) => `cognify_doc_history_${uid}`;

export function loadDocHistory(uid: string): DocHistoryEntry[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDocHistoryEntry(
  uid: string,
  entry: Omit<DocHistoryEntry, 'id' | 'createdAt'>
): DocHistoryEntry[] {
  if (!uid) return [];
  const existing = loadDocHistory(uid);
  const next: DocHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  // Newest first, capped so the archive can't grow unbounded.
  const updated = [next, ...existing].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(updated));
  } catch {
    // localStorage full/unavailable — the entry just won't persist; the
    // rest of the feature (reading/translating) still works fine without it.
  }
  return updated;
}

export function deleteDocHistoryEntry(uid: string, id: string): DocHistoryEntry[] {
  if (!uid) return [];
  const updated = loadDocHistory(uid).filter((e) => e.id !== id);
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}
