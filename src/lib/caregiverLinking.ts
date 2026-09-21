/**
 * Consent-based Caregiver/Parent Linking.
 *
 * A parent can NEVER read a student's data just by knowing their UID — the
 * Firestore security rules (isVerifiedParent in firestore.rules) only grant
 * access once the STUDENT's own profile carries linkedParentUid /
 * authorizedParentUids / parentEmail, and only the student can write their
 * own profile. This module is the request/approval flow that lets a parent
 * ask, and a student explicitly grant, that access — never automatic.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, cleanDataForFirestore } from './firebase';

export interface CaregiverLinkRequest {
  parentUid: string;
  parentName: string;
  parentEmail: string;
  childUid: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

function requestId(childUid: string, parentUid: string): string {
  return `${childUid}_${parentUid}`;
}

/** Parent side: send a link request. Does NOT grant any access by itself. */
export async function sendCaregiverLinkRequest(
  parentUid: string,
  parentName: string,
  parentEmail: string,
  childUid: string
): Promise<void> {
  if (!parentUid || !childUid || parentUid === childUid) {
    throw new Error('Invalid link request.');
  }
  const id = requestId(childUid, parentUid);
  await setDoc(
    doc(db, 'caregiverLinkRequests', id),
    cleanDataForFirestore({
      parentUid,
      parentName: parentName || 'A caregiver',
      parentEmail: parentEmail || '',
      childUid,
      status: 'pending',
      timestamp: Date.now(),
      createdAt: serverTimestamp(),
    })
  );
}

/** Student side: live list of requests addressed to them, newest first. */
export function listenPendingCaregiverRequests(
  childUid: string,
  onChange: (requests: CaregiverLinkRequest[]) => void
): () => void {
  if (!childUid) return () => {};
  const q = collection(db, 'caregiverLinkRequests');
  // Filtered client-side after fetch would need a composite index for a
  // where() + orderBy(); keeping this simple, onSnapshot on the collection
  // is fine at this app's scale and avoids an index deploy step.
  return onSnapshot(q, (snap) => {
    const all = snap.docs
      .map((d) => d.data() as CaregiverLinkRequest)
      .filter((r) => r.childUid === childUid && r.status === 'pending')
      .sort((a, b) => b.timestamp - a.timestamp);
    onChange(all);
  });
}

/**
 * Student side: approve a request. This is the ONLY function that grants
 * real access — it writes linkedParentUid on the student's OWN profile,
 * which Firestore rules require to come from the student themself.
 */
export async function approveCaregiverLinkRequest(childUid: string, parentUid: string): Promise<void> {
  const id = requestId(childUid, parentUid);
  await updateDoc(doc(db, 'caregiverLinkRequests', id), { status: 'approved' });
  await setDoc(doc(db, `users/${childUid}`), cleanDataForFirestore({ linkedParentUid: parentUid }), { merge: true });
}

/** Student side: reject a request. Grants nothing, just closes it out. */
export async function rejectCaregiverLinkRequest(childUid: string, parentUid: string): Promise<void> {
  const id = requestId(childUid, parentUid);
  await updateDoc(doc(db, 'caregiverLinkRequests', id), { status: 'rejected' });
}

/** Student side: revoke a previously-approved parent's access at any time. */
export async function revokeParentAccess(childUid: string): Promise<void> {
  await setDoc(doc(db, `users/${childUid}`), cleanDataForFirestore({ linkedParentUid: '' }), { merge: true });
}
