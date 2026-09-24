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
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, cleanDataForFirestore } from './firebase';
import type { UserProfile } from '../types';

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
 * real access — it writes to the student's OWN profile, which Firestore
 * rules require to come from the student themself.
 *
 * A student can have MORE THAN ONE approved caregiver/specialist (e.g. a
 * parent AND a therapist) — approving a second request must ADD to the
 * existing access list, never overwrite it. authorizedParentUids is what
 * verifyParentChildRelationship() actually checks for every uid beyond the
 * first; linkedParentUid is kept as the first ("primary") one purely for
 * back-compat with older code that still reads only that single field.
 */
export async function approveCaregiverLinkRequest(
  childUid: string,
  parentUid: string,
  parentName: string,
  parentEmail: string
): Promise<void> {
  const id = requestId(childUid, parentUid);
  await updateDoc(doc(db, 'caregiverLinkRequests', id), { status: 'approved' });

  const entry: NonNullable<UserProfile['linkedCaregivers']>[number] = {
    uid: parentUid,
    name: parentName || 'A caregiver',
    email: parentEmail || '',
    linkedAt: Date.now(),
  };

  // updateDoc (not setDoc merge) so arrayUnion actually unions against the
  // existing array instead of the write racing a merge on a doc that may not
  // have the field yet; the student's profile doc always exists by this point.
  await updateDoc(doc(db, `users/${childUid}`), cleanDataForFirestore({
    authorizedParentUids: arrayUnion(parentUid),
    linkedCaregivers: arrayUnion(entry),
  }));
}

/** Student side: reject a request. Grants nothing, just closes it out. */
export async function rejectCaregiverLinkRequest(childUid: string, parentUid: string): Promise<void> {
  const id = requestId(childUid, parentUid);
  await updateDoc(doc(db, 'caregiverLinkRequests', id), { status: 'rejected' });
}

/**
 * Student side: revoke ONE previously-approved caregiver's access, without
 * touching any other caregiver still linked. Also clears linkedParentUid if
 * it was this same uid, so no back-compat reader keeps treating them as
 * primary after they've been removed.
 */
export async function revokeSpecificCaregiverAccess(
  childUid: string,
  parentUid: string,
  currentLinkedCaregivers: NonNullable<UserProfile['linkedCaregivers']>
): Promise<void> {
  const remaining = currentLinkedCaregivers.filter((c) => c.uid !== parentUid);
  const removedEntries = currentLinkedCaregivers.filter((c) => c.uid === parentUid);
  await updateDoc(doc(db, `users/${childUid}`), cleanDataForFirestore({
    authorizedParentUids: arrayRemove(parentUid),
    // arrayRemove needs the exact stored object(s) — remove every matching
    // entry for this uid rather than assuming there's only ever one.
    ...(removedEntries.length ? { linkedCaregivers: arrayRemove(...removedEntries) } : {}),
  }));
  await setDoc(doc(db, `users/${childUid}`), { linkedParentUid: remaining[0]?.uid || '' }, { merge: true });
}

/** Student side: revoke ALL previously-approved carevigers' access at once. */
export async function revokeParentAccess(childUid: string): Promise<void> {
  await setDoc(
    doc(db, `users/${childUid}`),
    cleanDataForFirestore({ linkedParentUid: '', authorizedParentUids: [], linkedCaregivers: [] }),
    { merge: true }
  );
}
