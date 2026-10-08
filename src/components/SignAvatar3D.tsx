import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { lookupArslSign, hamnosysToThreePose } from "../lib/arslDictionary";
import {
  ASL_FINGERSPELLING_POSES,
  AVATAR_HAND_HOME,
  AVATAR_NEUTRAL,
  resolveAslAvatarSign,
  resolveAslFingerspellingCharacter,
  type AvatarHandPose,
} from "../lib/aslAvatarDictionary";

/**
 * SignAvatar3D — procedural 3D signing avatar for Cognify.
 *
 * - Builds a stylized avatar bust + a fully articulated right hand
 *   (15 finger joints + thumb, wrist, dynamic forearm) in pure Three.js.
 *   No external .glb files, no CDN, no CORS issues -> works in AI Studio.
 * - Fingerspells any word letter-by-letter (ASL alphabet approximations,
 *   A–Z + 0–9) and plays full-arm gestures for common words
 *   (hello / thanks / yes / no / me / you / love / help + Arabic equivalents).
 * - Arabic input is transliterated to the closest fingerspelling pose.
 *
 * Usage:
 *   <SignAvatar3D
 *     words={["hello", "world"]}
 *     playing={isPlaying}
 *     onProgress={(i) => setPlaybackProgress(i)}
 *     onDone={() => setIsPlaying(false)}
 *   />
 *
 * The curated ASL Core vocabulary and fingerspelling poses live in
 * `lib/aslAvatarDictionary.ts`; the older compatibility signs below remain
 * available while they are migrated and reviewed.
 */

export interface SignAvatar3DProps {
  /** The sentence, already split into words. */
  words: string[];
  /** Starts / stops the signing timeline. */
  playing: boolean;
  /** Fired when the avatar starts signing word index `i`. */
  onProgress?: (wordIndex: number) => void;
  /** Fired after the last word finishes. */
  onDone?: () => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Pose data                                                           */
/* ------------------------------------------------------------------ */

interface HandPose extends AvatarHandPose {
  /** Finger curls 0..1 in order: [thumb, index, middle, ring, pinky] */
  f: [number, number, number, number, number];
  /** Thumb sticking out sideways (L / Y / open hand). 0..1 */
  out?: number;
  /** Finger fan/spread. 0..1 */
  spread?: number;
  /** Wrist euler offset [x, y, z] in radians. */
  wrist?: [number, number, number];
  /** Hand root position override [x, y, z] (world). */
  pos?: [number, number, number];
  /** Procedural micro-motion layered on top of the pose. */
  motion?: "wave" | "nod" | "tap" | "j" | "z" | "circle" | null;
  /** How long to hold this pose (ms) when used inside a word gesture. */
  hold?: number;
}

const HAND_HOME = AVATAR_HAND_HOME;

const NEUTRAL: HandPose = AVATAR_NEUTRAL;

// Kept as a local alias only because the rig's Arabic fallback uses it too.
const LETTER_POSES: Record<string, HandPose> = ASL_FINGERSPELLING_POSES;

/** Arabic letters -> nearest fingerspelling pose key. */
const AR_MAP: Record<string, string> = {
  "ا": "A", "أ": "A", "إ": "A", "آ": "A", "ء": "A",
  "ب": "B", "ت": "T", "ث": "T", "ج": "J", "ح": "H", "خ": "K",
  "د": "D", "ذ": "D", "ر": "R", "ز": "Z", "س": "S", "ش": "S",
  "ص": "S", "ض": "D", "ط": "T", "ظ": "Z", "ع": "E", "غ": "G",
  "ف": "F", "ق": "Q", "ك": "K", "ل": "L", "م": "M", "ن": "N",
  "ه": "H", "ة": "H", "و": "W", "ؤ": "W", "ي": "Y", "ى": "Y", "ئ": "Y",
};

/** Full-arm gestures for common words. Each step is held, then the next plays. */
const WORD_SIGNS: Record<string, { steps: HandPose[] }> = {
  HELLO: {
    steps: [
      { f: [0, 0, 0, 0, 0], out: 1, spread: 0.4, pos: [0.13, 1.5, 0.3], wrist: [0.25, 0, 0.35], hold: 380 },
      { f: [0, 0, 0, 0, 0], out: 1, spread: 0.4, pos: [0.36, 1.46, 0.44], wrist: [0.25, 0, -0.45], hold: 420 },
    ],
  },
  THANK: {
    steps: [
      { f: [0.1, 0, 0, 0, 0], pos: [0.06, 1.41, 0.34], wrist: [0.55, 0, 0], hold: 340 },
      { f: [0.1, 0, 0, 0, 0], pos: [0.12, 1.28, 0.56], wrist: [1.05, 0, 0], hold: 440 },
    ],
  },
  YES: { steps: [{ f: [0.7, 1, 1, 1, 1], motion: "nod", hold: 850 }] },
  NO: { steps: [{ f: [0.35, 0, 0, 1, 1], motion: "tap", hold: 850 }] },
  ME: { steps: [{ f: [0.8, 0, 1, 1, 1], pos: [0.1, 1.24, 0.3], wrist: [2.4, 0, 0], hold: 750 }] },
  YOU: { steps: [{ f: [0.8, 0, 1, 1, 1], wrist: [1.5, 0, 0], hold: 750 }] },
  LOVE: { steps: [{ f: [0.7, 1, 1, 1, 1], pos: [0.02, 1.22, 0.3], wrist: [0.4, 0, 0], hold: 850 }] },
  HELP: { steps: [{ f: [0, 0, 0, 0, 0], out: 1, spread: 0.4, motion: "circle", pos: [0.08, 1.24, 0.34], hold: 950 }] },
  GOODBYE: { steps: [{ f: [0, 0, 0, 0, 0], out: 1, spread: 0.4, pos: [0.3, 1.5, 0.42], motion: "wave", hold: 950 }] },
  GOOD: { steps: [
    { f: [0, 0, 0, 0, 0], pos: [0.05, 1.44, 0.36], wrist: [0.5, 0, 0], hold: 360 },
    { f: [0, 0, 0, 0, 0], pos: [0.08, 1.18, 0.4], wrist: [0, 0, 0], hold: 440 },
  ] },
  BAD: { steps: [
    { f: [0, 0, 0, 0, 0], pos: [0.05, 1.44, 0.36], wrist: [0.5, 0, 0], hold: 360 },
    { f: [0, 0, 0, 0, 0], pos: [0.1, 1.16, 0.4], wrist: [0, 0, 3.1], hold: 440 },
  ] },
  PAIN: { steps: [{ f: [1, 0, 1, 1, 1], pos: [0.06, 1.2, 0.34], motion: "tap", hold: 900 }] },
  DOCTOR: { steps: [{ f: [0, 0, 0.4, 1, 1], pos: [0.1, 1.14, 0.34], motion: "tap", hold: 900 }] },
  WATER: { steps: [{ f: [1, 0, 0, 0, 1], spread: 0.5, pos: [0.05, 1.42, 0.34], motion: "tap", hold: 900 }] },
  EAT: { steps: [{ f: [0.3, 0.3, 0.3, 0.3, 0.3], pos: [0.03, 1.46, 0.32], motion: "tap", hold: 900 }] },
  DRINK: { steps: [{ f: [0.4, 0.5, 0.5, 0.5, 0.5], pos: [0.04, 1.44, 0.34], wrist: [0.6, 0, 0], hold: 800 }] },
  NAME: { steps: [{ f: [1, 0, 0, 1, 1], pos: [0.06, 1.25, 0.33], motion: "tap", hold: 900 }] },
  HOW: { steps: [{ f: [0.5, 0.5, 0.5, 0.5, 0.5], spread: 0.3, pos: [0.06, 1.2, 0.42], wrist: [0.3, 0, 0], motion: "nod", hold: 900 }] },
  WHAT: { steps: [{ f: [0, 0, 0, 0, 0], out: 1, spread: 0.5, pos: [0.1, 1.15, 0.42], motion: "tap", hold: 900 }] },
  WHERE: { steps: [{ f: [1, 0, 1, 1, 1], pos: [0.16, 1.35, 0.42], motion: "tap", hold: 900 }] },
  SORRY: { steps: [{ f: [1, 1, 1, 1, 1], pos: [0.05, 1.18, 0.34], motion: "circle", hold: 950 }] },
  WAIT: { steps: [{ f: [0, 0, 0, 0, 0], spread: 0.5, pos: [0.1, 1.15, 0.42], wrist: [0.5, 0, 0], motion: "tap", hold: 900 }] },
  STOP: { steps: [
    { f: [0, 0, 0, 0, 0], spread: 0, pos: [0.05, 1.32, 0.42], wrist: [0, 0, 0], hold: 320 },
    { f: [0, 0, 0, 0, 0], spread: 0, pos: [0.05, 1.2, 0.4], wrist: [0, 0, 0], hold: 420 },
  ] },
  COME: { steps: [{ f: [1, 0, 1, 1, 1], pos: [0.1, 1.32, 0.46], motion: "nod", hold: 900 }] },
  GO: { steps: [{ f: [1, 0, 1, 1, 1], pos: [0.26, 1.32, 0.5], wrist: [0, -0.5, 0], hold: 800 }] },
  MORE: { steps: [{ f: [0.4, 0.4, 0.4, 0.4, 0.4], pos: [0.05, 1.25, 0.42], motion: "tap", hold: 900 }] },
  FINISH: { steps: [
    { f: [0, 0, 0, 0, 0], out: 1, spread: 0.4, pos: [0.08, 1.22, 0.4], wrist: [0.4, 0, 0], hold: 340 },
    { f: [0, 0, 0, 0, 0], out: 1, spread: 0.4, pos: [0.12, 1.2, 0.42], wrist: [0, 0, 0.7], hold: 440 },
  ] },
  WANT: { steps: [
    { f: [0.5, 0.5, 0.5, 0.5, 0.5], spread: 0.4, pos: [0.1, 1.2, 0.48], wrist: [0.4, 0, 0], hold: 360 },
    { f: [0.5, 0.5, 0.5, 0.5, 0.5], spread: 0.3, pos: [0.06, 1.18, 0.34], wrist: [0.4, 0, 0], hold: 440 },
  ] },
  HAPPY: { steps: [
    { f: [0, 0, 0, 0, 0], pos: [0.05, 1.14, 0.36], hold: 320 },
    { f: [0, 0, 0, 0, 0], pos: [0.05, 1.34, 0.4], hold: 420 },
  ] },
  SICK: { steps: [{ f: [1, 1, 0, 1, 1], pos: [0.05, 1.48, 0.33], motion: "tap", hold: 900 }] },
  MEDICINE: { steps: [{ f: [0, 1, 1, 1, 1], pos: [0.06, 1.2, 0.36], motion: "circle", hold: 950 }] },
  BATHROOM: { steps: [{ f: [0.5, 1, 1, 1, 1], out: 1, pos: [0.12, 1.35, 0.42], motion: "tap", hold: 900 }] },
  MOTHER: { steps: [{ f: [0, 1, 1, 1, 1], out: 1, pos: [0.05, 1.44, 0.34], hold: 800 }] },
  FATHER: { steps: [{ f: [0, 1, 1, 1, 1], out: 1, pos: [0.05, 1.5, 0.34], hold: 800 }] },
};

const WORD_ALIASES: Record<string, string> = {
  hello: "HELLO", hi: "HELLO", hey: "HELLO",
  "مرحبا": "HELLO", "اهلا": "HELLO", "أهلا": "HELLO", "سلام": "HELLO", "ازيك": "HELLO",
  thanks: "THANK", thank: "THANK", "شكرا": "THANK", "شكرًا": "THANK", "متشكر": "THANK",
  yes: "YES", ok: "YES", okay: "YES", "نعم": "YES", "ايوه": "YES", "أيوه": "YES", "تمام": "YES",
  no: "NO", not: "NO", "لا": "NO", "كلا": "NO",
  me: "ME", i: "ME", "انا": "ME", "أنا": "ME",
  you: "YOU", "انت": "YOU", "أنت": "YOU", "انتي": "YOU",
  love: "LOVE", "حب": "LOVE", "بحبك": "LOVE",
  help: "HELP", please: "HELP", "مساعدة": "HELP", "ساعدني": "HELP", "لو سمحت": "HELP",
  goodbye: "GOODBYE", bye: "GOODBYE", "مع السلامة": "GOODBYE", "باي": "GOODBYE", "وداعا": "GOODBYE",
  good: "GOOD", fine: "GOOD", great: "GOOD", "كويس": "GOOD", "جيد": "GOOD", "حلو": "GOOD",
  bad: "BAD", "وحش": "BAD", "سيء": "BAD", "مش كويس": "BAD",
  pain: "PAIN", hurt: "PAIN", ache: "PAIN", "ألم": "PAIN", "وجع": "PAIN", "بيوجعني": "PAIN",
  doctor: "DOCTOR", nurse: "DOCTOR", "دكتور": "DOCTOR", "طبيب": "DOCTOR", "ممرضة": "DOCTOR",
  water: "WATER", "ماء": "WATER", "مياه": "WATER", "ميه": "WATER",
  eat: "EAT", food: "EAT", hungry: "EAT", "اكل": "EAT", "أكل": "EAT", "جعان": "EAT", "جوعان": "EAT",
  drink: "DRINK", thirsty: "DRINK", "اشرب": "DRINK", "عطشان": "DRINK",
  name: "NAME", "اسم": "NAME", "اسمي": "NAME",
  how: "HOW", "ازاي": "HOW", "كيف": "HOW",
  what: "WHAT", "ايه": "WHAT", "ماذا": "WHAT", "إيه": "WHAT",
  where: "WHERE", "فين": "WHERE", "اين": "WHERE", "وين": "WHERE",
  sorry: "SORRY", "اسف": "SORRY", "آسف": "SORRY", "معذرة": "SORRY",
  wait: "WAIT", "استنى": "WAIT", "انتظر": "WAIT", "لحظة": "WAIT",
  stop: "STOP", "قف": "STOP", "بس": "STOP", "كفاية": "STOP",
  come: "COME", "تعالى": "COME", "تعال": "COME",
  go: "GO", "روح": "GO", "اذهب": "GO", "امشي": "GO",
  more: "MORE", "كمان": "MORE", "اكثر": "MORE", "زيادة": "MORE",
  finish: "FINISH", done: "FINISH", "خلص": "FINISH", "انتهى": "FINISH", "خلاص": "FINISH",
  want: "WANT", need: "WANT", "عايز": "WANT", "اريد": "WANT", "محتاج": "WANT", "عاوز": "WANT",
  happy: "HAPPY", "سعيد": "HAPPY", "مبسوط": "HAPPY", "فرحان": "HAPPY",
  sick: "SICK", ill: "SICK", "مريض": "SICK", "تعبان": "SICK",
  medicine: "MEDICINE", medication: "MEDICINE", pill: "MEDICINE", "دواء": "MEDICINE", "علاج": "MEDICINE",
  bathroom: "BATHROOM", toilet: "BATHROOM", restroom: "BATHROOM", "حمام": "BATHROOM", "تواليت": "BATHROOM", "دورة المياه": "BATHROOM",
  mother: "MOTHER", mom: "MOTHER", mum: "MOTHER", "ام": "MOTHER", "أم": "MOTHER", "ماما": "MOTHER",
  father: "FATHER", dad: "FATHER", "اب": "FATHER", "أب": "FATHER", "بابا": "FATHER",
  "شيل": "FINISH", "يشيل": "FINISH", "بيشيل": "FINISH", "شيلها": "FINISH", "احذف": "FINISH", "حذف": "FINISH", "امسح": "FINISH",
  "امسك": "WANT", "هات": "WANT", "خد": "WANT",
};

/* ------------------------------------------------------------------ */
/* Rig                                                                 */
/* ------------------------------------------------------------------ */

const ACCENT = 0x2563eb; // Cognify primary
const ACCENT_SOFT = 0x60a5fa;

interface FingerRig {
  joints: THREE.Group[]; // [proximal, middle, distal]
  spreadDir: number;
}

interface Rig {
  root: THREE.Group; // whole avatar
  handRoot: THREE.Group; // moves in world space
  wrist: THREE.Group; // pose-driven rotations
  fingers: FingerRig[]; // [thumb, index, middle, ring, pinky]
  thumbBase: THREE.Group;
  head: THREE.Group;
  forearm: THREE.Mesh; // dynamic, follows the hand
  elbow: THREE.Vector3;
  rings: THREE.Mesh[];
  chestCore: THREE.Mesh;
  // Left hand — fully articulated and driven as a MIRROR of the right, so the
  // avatar signs with BOTH hands (real sign language is two-handed).
  leftHandRoot: THREE.Group;
  leftWrist: THREE.Group;
  leftFingers: FingerRig[];
  leftThumbBase: THREE.Group;
  leftForearm: THREE.Mesh;
  leftElbow: THREE.Vector3;
  eyeL: THREE.Mesh;
  eyeR: THREE.Mesh;
  browL: THREE.Mesh;
  browR: THREE.Mesh;
  mouth: THREE.Mesh;
}

const CURL_MAX = [1.45, 1.55, 1.05]; // per joint
const SEG_LEN = [0.072, 0.052, 0.038];
const FINGER_SCALE = [0.78, 0.96, 1.0, 0.94, 0.74]; // thumb handled separately

function fingerSegment(len: number, rad: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 4, 10), mat);
  mesh.position.y = len / 2;
  g.add(mesh);
  return g;
}

function buildFinger(scale: number, rad: number, mat: THREE.Material, spreadDir: number): FingerRig {
  const joints: THREE.Group[] = [];
  let parent: THREE.Group | null = null;
  for (let i = 0; i < 3; i++) {
    const len = SEG_LEN[i] * scale;
    const j = fingerSegment(len, rad * (1 - i * 0.12), mat);
    if (parent) {
      j.position.y = SEG_LEN[i - 1] * scale;
      parent.add(j);
    }
    joints.push(j);
    parent = j;
  }
  return { joints, spreadDir };
}

/** Build one fully-articulated hand (palm + cuff + thumb + 4 fingers). Used for
 *  BOTH hands; the left is mirrored via scale.x = -1 by the caller. */
function buildHand(skinMat: THREE.Material, bodyMat: THREE.Material): {
  handRoot: THREE.Group; wrist: THREE.Group; fingers: FingerRig[]; thumbBase: THREE.Group;
} {
  const handRoot = new THREE.Group();
  const wrist = new THREE.Group();
  wrist.rotation.set(-0.12, 0, 0.06);
  handRoot.add(wrist);

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.185, 0.055), skinMat);
  palm.position.y = 0.05;
  wrist.add(palm);
  const wristCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.06, 14), bodyMat);
  wristCuff.position.y = -0.06;
  wrist.add(wristCuff);

  const baseX = [0.058, 0.02, -0.02, -0.058]; // index..pinky
  const spreadDirs = [-1, -0.3, 0.35, 1];
  const fingers: FingerRig[] = [];

  const thumbBase = new THREE.Group();
  thumbBase.position.set(0.082, -0.01, 0.012);
  thumbBase.rotation.set(0.35, 0.2, -0.9);
  wrist.add(thumbBase);
  const tJoints: THREE.Group[] = [];
  let tParent: THREE.Group = thumbBase;
  const tLens = [0.06, 0.045];
  for (let i = 0; i < 2; i++) {
    const j = fingerSegment(tLens[i], 0.021 - i * 0.002, skinMat);
    if (i > 0) j.position.y = tLens[i - 1];
    tParent.add(j);
    tJoints.push(j);
    tParent = j;
  }
  fingers.push({ joints: [tJoints[0], tJoints[1], tJoints[1]], spreadDir: 0 });

  for (let fi = 0; fi < 4; fi++) {
    const base = new THREE.Group();
    base.position.set(baseX[fi], 0.142, 0);
    wrist.add(base);
    const f = buildFinger(FINGER_SCALE[fi + 1], 0.018, skinMat, spreadDirs[fi]);
    base.add(f.joints[0]);
    fingers.push(f);
  }
  return { handRoot, wrist, fingers, thumbBase };
}

function buildRig(scene: THREE.Scene): Rig {
  const root = new THREE.Group();
  scene.add(root);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.25 });
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.4 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, metalness: 0.08 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.4, roughness: 0.3,
  });

  /* ---- bust ---- */
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 6, 18), bodyMat);
  torso.position.set(0, 0.92, 0);
  torso.scale.set(1, 1, 0.72);
  root.add(torso);

  const chestCore = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 24), glowMat);
  chestCore.rotation.x = Math.PI / 2;
  chestCore.position.set(0, 1.16, 0.185);
  root.add(chestCore);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 16), bodyMat);
  neck.position.set(0, 1.32, 0);
  root.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 1.5, 0);
  root.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 24, 20), bodyMat);
  skull.scale.set(0.92, 1.05, 0.95);
  head.add(skull);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 18, 0, Math.PI), faceMat);
  visor.rotation.y = 0; // facing +Z (camera)
  visor.position.z = 0.045;
  visor.scale.set(0.95, 0.85, 0.6);
  head.add(visor);
  const eyeGeo = new THREE.CapsuleGeometry(0.014, 0.02, 3, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: ACCENT_SOFT, emissive: ACCENT_SOFT, emissiveIntensity: 2.2 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.05, 0.02, 0.155);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.05;
  head.add(eyeL, eyeR);

  /* ---- Non-manual facial markers: eyebrows & articulated mouth ---- */
  const browMat = new THREE.MeshStandardMaterial({
    color: ACCENT,
    emissive: ACCENT,
    emissiveIntensity: 1.8,
  });
  const browGeo = new THREE.BoxGeometry(0.038, 0.007, 0.01);
  const browL = new THREE.Mesh(browGeo, browMat);
  browL.position.set(-0.05, 0.055, 0.152);
  const browR = new THREE.Mesh(browGeo, browMat);
  browR.position.set(0.05, 0.055, 0.152);
  head.add(browL, browR);

  const mouthMat = new THREE.MeshStandardMaterial({
    color: ACCENT_SOFT,
    emissive: ACCENT_SOFT,
    emissiveIntensity: 1.6,
  });
  const mouthGeo = new THREE.CapsuleGeometry(0.008, 0.034, 4, 10);
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, -0.055, 0.152);
  head.add(mouth);

  /* ---- shoulders + idle left arm ---- */
  const shoulderGeo = new THREE.SphereGeometry(0.085, 16, 14);
  const shoulderR = new THREE.Mesh(shoulderGeo, bodyMat);
  shoulderR.position.set(0.3, 1.22, 0);
  const shoulderL = shoulderR.clone();
  shoulderL.position.x = -0.3;
  root.add(shoulderR, shoulderL);

  /* ---- arms: symmetric dynamic forearms that follow each hand ---- */
  const elbow = new THREE.Vector3(0.36, 1.0, 0.12);
  const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.24, 4, 12), bodyMat);
  upperArm.position.copy(new THREE.Vector3().addVectors(new THREE.Vector3(0.3, 1.22, 0), elbow).multiplyScalar(0.5));
  upperArm.lookAt(elbow);
  upperArm.rotateX(Math.PI / 2);
  root.add(upperArm);
  const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), bodyMat);
  elbowBall.position.copy(elbow);
  root.add(elbowBall);
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1, 12), bodyMat);
  root.add(forearm);

  // left arm (mirror of the right)
  const leftElbow = new THREE.Vector3(-0.36, 1.0, 0.12);
  const upperArmL = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.24, 4, 12), bodyMat);
  upperArmL.position.copy(new THREE.Vector3().addVectors(new THREE.Vector3(-0.3, 1.22, 0), leftElbow).multiplyScalar(0.5));
  upperArmL.lookAt(leftElbow);
  upperArmL.rotateX(Math.PI / 2);
  root.add(upperArmL);
  const elbowBallL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), bodyMat);
  elbowBallL.position.copy(leftElbow);
  root.add(elbowBallL);
  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1, 12), bodyMat);
  root.add(leftForearm);

  /* ---- right hand (articulated) ---- */
  const right = buildHand(skinMat, bodyMat);
  const { handRoot, wrist, fingers, thumbBase } = right;
  handRoot.position.set(...HAND_HOME);
  root.add(handRoot);

  /* ---- left hand (same rig, mirrored so it reads as a real left hand) ---- */
  const left = buildHand(skinMat, bodyMat);
  left.handRoot.position.set(-HAND_HOME[0], HAND_HOME[1], HAND_HOME[2]);
  left.handRoot.scale.x = -1; // mirror geometry → left hand
  root.add(left.handRoot);

  /* ---- pedestal rings ---- */
  const ringMat = new THREE.MeshStandardMaterial({
    color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.1, transparent: true, opacity: 0.85,
  });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.008, 10, 80), ringMat);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = 0.58;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.004, 8, 80), ringMat.clone());
  (ring2.material as THREE.MeshStandardMaterial).opacity = 0.3;
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = 0.55;
  root.add(ring1, ring2);

  return {
    root, handRoot, wrist, fingers, thumbBase, head, forearm, elbow,
    rings: [ring1, ring2], chestCore,
    leftHandRoot: left.handRoot, leftWrist: left.wrist, leftFingers: left.fingers,
    leftThumbBase: left.thumbBase, leftForearm, leftElbow,
    eyeL, eyeR, browL, browR, mouth,
  };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function normalizeChar(ch: string): string {
  const up = ch.toUpperCase();
  if (LETTER_POSES[up]) return up;
  if (AR_MAP[ch]) return AR_MAP[ch];
  return "";
}

export default function SignAvatar3D({ words, playing, onProgress, onDone, className }: SignAvatar3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [glyph, setGlyph] = useState("");
  const [ready, setReady] = useState(false);
  const [webglError, setWebglError] = useState(false);

  // mutable target the animation loop chases
  const target = useRef({
    curls: [...NEUTRAL.f] as number[],
    out: NEUTRAL.out ?? 0,
    spread: NEUTRAL.spread ?? 0,
    wrist: [0, 0, 0] as number[],
    pos: [...HAND_HOME] as number[],
    motion: null as HandPose["motion"],
    motionStart: 0,
    leftActive: true,
  });

  const onProgressRef = useRef(onProgress);
  const onDoneRef = useRef(onDone);
  onProgressRef.current = onProgress;
  onDoneRef.current = onDone;

  const isPlayingRef = useRef(playing);
  isPlayingRef.current = playing;

  const currentNonManualRef = useRef<
    'question_eyebrows' | 'happy_smile' | 'concern_furrow' | 'head_nod' | 'head_shake' | 'neutral'
  >('neutral');

  const applyPose = (p: HandPose, hands: "right" | "both" = "both") => {
    const t = target.current;
    t.curls = [...p.f];
    t.out = p.out ?? 0;
    t.spread = p.spread ?? 0;
    t.wrist = p.wrist ? [...p.wrist] : [0, 0, 0];
    t.pos = p.pos ? [...p.pos] : [...HAND_HOME];
    t.motion = p.motion ?? null;
    t.motionStart = performance.now();
    t.leftActive = hands === "both";
  };

  /* ---- three.js scene ---- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
    // Pulled further back and centred lower so the whole avatar (bust + raised
    // hand) fits inside the panel instead of overflowing/cropping.
    camera.position.set(0, 1.05, 3.35);
    camera.lookAt(0, 0.9, 0);

    // Some hospital/locked-down devices have no GPU or blocked WebGL. Fail
    // gracefully to a visible message instead of a permanent black "loading" box.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      console.error("WebGL unavailable — 3D avatar disabled", e);
      setWebglError(true);
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // CRITICAL for mobile: setSize(..., false) only sizes the drawing BUFFER, not
    // the element's CSS box. With devicePixelRatio 2–3 (phones) the canvas would
    // otherwise display at 2–3× its container and overflow — showing only part of
    // the avatar ("half avatar on phone"). Pin the CSS box to fill the container
    // so the canvas always matches its parent regardless of DPR.
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x0b1120, 0.9);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(-1.4, 2.2, 2.4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(ACCENT_SOFT, 1.6);
    rim.position.set(1.8, 1.4, -1.6);
    scene.add(rim);

    const rig = buildRig(scene);
    setReady(true);

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Responsive framing. The FOV is VERTICAL, so on narrow/portrait
      // containers (phones) the horizontal view shrinks and the raised hand/arm
      // (world x ≈ ±1.6) gets cropped — "half the avatar" on mobile. Compute the
      // camera distance needed to always show that horizontal extent, and never
      // zoom in closer than the desktop baseline (so wide screens are unchanged).
      const HALF_W = 1.75;                         // world half-width to keep visible
      const HALF_FOV = (36 * Math.PI) / 180 / 2;   // vertical fov is 36°
      const tan = Math.tan(HALF_FOV);
      const zForWidth = HALF_W / (tan * Math.max(camera.aspect, 0.42));
      camera.position.z = Math.min(Math.max(3.35, zForWidth), 8.5);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Delta is derived from performance.now() below — avoids the deprecated THREE.Clock.
    let lastTime = performance.now();
    const fromV = new THREE.Vector3();
    const dirV = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      // Don't burn GPU/battery when the tab is backgrounded (hospital tablets).
      if (document.hidden) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const t = target.current;
      const kFinger = 1 - Math.exp(-13 * dt);
      const kBody = 1 - Math.exp(-8 * dt);
      const elapsed = (now - t.motionStart) / 1000;

      // motion layers
      let wristAdd = [0, 0, 0];
      let posAdd = [0, 0, 0];
      let curlAdd = [0, 0, 0, 0, 0];
      switch (t.motion) {
        case "wave": wristAdd = [0, 0, Math.sin(elapsed * 9) * 0.28]; break;
        case "nod": wristAdd = [Math.sin(elapsed * 8) * 0.3, 0, 0]; break;
        case "tap": { const c = (Math.sin(elapsed * 11) + 1) / 2; curlAdd = [0.25 * c, 0.4 * c, 0.4 * c, 0, 0]; break; }
        case "j": wristAdd = [Math.sin(elapsed * 4) * 0.25, 0, -Math.min(elapsed * 2.2, 1.4)]; break;
        case "z": posAdd = [Math.sin(elapsed * 6) * 0.1, -Math.min(elapsed * 0.18, 0.13), 0]; break;
        case "circle": posAdd = [Math.cos(elapsed * 5) * 0.045, Math.sin(elapsed * 5) * 0.045, 0]; break;
      }

      const idle = t.motion ? 0 : Math.sin(now / 900) * 0.008;

      // Drive BOTH hands from the same target. The left hand's group is
      // scale.x = -1, so identical finger/thumb/wrist values render as a true
      // mirror; only the hand's world X position is negated (mirrorX = -1).
      const hands = [
        { fingers: rig.fingers, thumbBase: rig.thumbBase, wrist: rig.wrist, pos: rig.handRoot.position, forearm: rig.forearm, elbow: rig.elbow, mirrorX: 1, isLeft: false },
        { fingers: rig.leftFingers, thumbBase: rig.leftThumbBase, wrist: rig.leftWrist, pos: rig.leftHandRoot.position, forearm: rig.leftForearm, elbow: rig.leftElbow, mirrorX: -1, isLeft: true },
      ];
      for (const H of hands) {
        const idleLeftHand = H.isLeft && !t.leftActive;
        const handCurls = idleLeftHand ? NEUTRAL.f : t.curls;
        const handOut = idleLeftHand ? (NEUTRAL.out ?? 0) : t.out;
        const handSpread = idleLeftHand ? (NEUTRAL.spread ?? 0) : t.spread;
        const handWrist = idleLeftHand ? (NEUTRAL.wrist ?? [0, 0, 0]) : t.wrist;
        const handPosition = idleLeftHand ? (NEUTRAL.pos ?? HAND_HOME) : t.pos;
        // fingers
        for (let fi = 0; fi < 5; fi++) {
          const curl = THREE.MathUtils.clamp(handCurls[fi] + (idleLeftHand ? 0 : curlAdd[fi]), 0, 1.15);
          const rigF = H.fingers[fi];
          for (let ji = 0; ji < 3; ji++) {
            const j = rigF.joints[ji];
            if (fi === 0 && ji === 2) continue; // thumb alias
            const goal = curl * CURL_MAX[ji] * (fi === 0 ? 0.8 : 1);
            j.rotation.x += (goal - j.rotation.x) * kFinger;
            if (ji === 0 && fi > 0) {
              const spreadGoal = handSpread * 0.32 * rigF.spreadDir;
              j.rotation.z += (spreadGoal - j.rotation.z) * kFinger;
            }
          }
        }
        // thumb base: out + wrap across palm as it curls
        const tb = H.thumbBase.rotation;
        const outGoal = -0.9 - handOut * 0.55 + handCurls[0] * 0.7;
        const wrapGoal = 0.2 + handCurls[0] * 0.9;
        tb.z += (outGoal - tb.z) * kFinger;
        tb.y += (wrapGoal - tb.y) * kFinger;

        // wrist
        const w = H.wrist.rotation;
        w.x += (-0.12 + handWrist[0] + (idleLeftHand ? 0 : wristAdd[0]) - w.x) * kBody;
        w.y += (handWrist[1] + (idleLeftHand ? 0 : wristAdd[1]) - w.y) * kBody;
        w.z += (0.06 + handWrist[2] + (idleLeftHand ? 0 : wristAdd[2]) - w.z) * kBody;

        // hand position (X mirrored for the left hand)
        const p = H.pos;
        p.x += ((handPosition[0] + (idleLeftHand ? 0 : posAdd[0])) * H.mirrorX - p.x) * kBody;
        p.y += (handPosition[1] + (idleLeftHand ? 0 : posAdd[1]) + idle - p.y) * kBody;
        p.z += (handPosition[2] + (idleLeftHand ? 0 : posAdd[2]) - p.z) * kBody;

        // forearm follows this hand
        fromV.copy(H.elbow);
        dirV.copy(p).sub(fromV);
        const len = Math.max(dirV.length(), 0.001);
        H.forearm.position.copy(fromV).addScaledVector(dirV, 0.5);
        H.forearm.scale.set(1, len, 1);
        H.forearm.quaternion.setFromUnitVectors(up, dirV.clone().normalize());
      }

      // life: breathing, head, rings, chest pulse, eye blinking, eyebrows, mouth mouthing
      rig.root.position.y = Math.sin(now / 1600) * 0.006;
      rig.rings[0].rotation.z += dt * 0.4;
      rig.rings[1].rotation.z -= dt * 0.25;
      const pulse = 1.1 + Math.sin(now / 500) * 0.35;
      (rig.chestCore.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;

      // 1. Natural Autonomic Blinking (Every ~3.6 seconds)
      const blinkCycle = now % 3600;
      let eyeScaleY = 1.0;
      if (blinkCycle < 140) {
        eyeScaleY = Math.max(0.08, Math.sin((blinkCycle / 140) * Math.PI) * 0.1);
      }

      // 2. Non-Manual Facial & Head Expression Targets
      let targetBrowLY = 0.055;
      let targetBrowRY = 0.055;
      let targetBrowRotZ_L = 0;
      let targetBrowRotZ_R = 0;
      let targetMouthScaleX = 1.0;
      let targetMouthScaleY = 1.0;
      let targetMouthY = -0.055;
      let headNod = Math.sin(now / 2900) * 0.04;
      let headYaw = Math.sin(now / 2300) * 0.08;
      let headRoll = 0;

      const nm = currentNonManualRef.current;
      if (nm === 'question_eyebrows') {
        // Raised eyebrows + curious head tilt (Standard ArSL Question Marker)
        targetBrowLY = 0.075;
        targetBrowRY = 0.075;
        targetBrowRotZ_L = 0.16;
        targetBrowRotZ_R = -0.16;
        headRoll = 0.10;
        headNod = -0.06;
        targetMouthScaleX = 0.85;
        targetMouthScaleY = 1.35;
      } else if (nm === 'happy_smile') {
        // Welcoming smile: lifted brows, soft eye squint, friendly head nod
        targetBrowLY = 0.064;
        targetBrowRY = 0.064;
        targetMouthScaleX = 1.45;
        targetMouthScaleY = 0.75;
        targetMouthY = -0.048;
        eyeScaleY *= 0.85;
        headNod = Math.sin(now / 220) * 0.09;
      } else if (nm === 'head_nod') {
        // Affirmative head nod (Yes / agreement)
        headNod = Math.sin(now / 160) * 0.18;
        targetBrowLY = 0.06;
        targetBrowRY = 0.06;
      } else if (nm === 'head_shake') {
        // Negative head shake (No / negation)
        headYaw = Math.sin(now / 150) * 0.22;
        targetBrowRotZ_L = -0.12;
        targetBrowRotZ_R = 0.12;
      } else if (nm === 'concern_furrow') {
        // Furrowed brow for intense thought or concern
        targetBrowLY = 0.044;
        targetBrowRY = 0.044;
        targetBrowRotZ_L = -0.20;
        targetBrowRotZ_R = 0.20;
      }

      // 3. Dynamic Syllabic Mouthing during active signing
      if (isPlayingRef.current) {
        const mouthOpen = 0.8 + Math.sin(now / 110) * 0.5 + Math.cos(now / 75) * 0.25;
        targetMouthScaleY = Math.max(0.65, mouthOpen);
        targetMouthScaleX = 1.0 + Math.sin(now / 190) * 0.2;
      }

      // Lerp Eyes, Eyebrows & Mouth
      rig.eyeL.scale.y = THREE.MathUtils.lerp(rig.eyeL.scale.y, eyeScaleY, 0.25);
      rig.eyeR.scale.y = THREE.MathUtils.lerp(rig.eyeR.scale.y, eyeScaleY, 0.25);

      rig.browL.position.y = THREE.MathUtils.lerp(rig.browL.position.y, targetBrowLY, 0.15);
      rig.browR.position.y = THREE.MathUtils.lerp(rig.browR.position.y, targetBrowRY, 0.15);
      rig.browL.rotation.z = THREE.MathUtils.lerp(rig.browL.rotation.z, targetBrowRotZ_L, 0.15);
      rig.browR.rotation.z = THREE.MathUtils.lerp(rig.browR.rotation.z, targetBrowRotZ_R, 0.15);

      rig.mouth.scale.x = THREE.MathUtils.lerp(rig.mouth.scale.x, targetMouthScaleX, 0.2);
      rig.mouth.scale.y = THREE.MathUtils.lerp(rig.mouth.scale.y, targetMouthScaleY, 0.2);
      rig.mouth.position.y = THREE.MathUtils.lerp(rig.mouth.position.y, targetMouthY, 0.15);

      rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, headNod, 0.15);
      rig.head.rotation.y = THREE.MathUtils.lerp(rig.head.rotation.y, headYaw, 0.15);
      rig.head.rotation.z = THREE.MathUtils.lerp(rig.head.rotation.z, headRoll, 0.15);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      // Browsers cap live WebGL contexts (~16). dispose() alone doesn't release
      // the GPU context, so toggling the avatar on/off repeatedly eventually
      // blacks it out ("too many active contexts"). Force the loss explicitly.
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    };
  }, []);

  /* ---- signing timeline ---- */
  const wordsKey = useMemo(() => words.join("\u0001"), [words]);

  useEffect(() => {
    if (!playing || words.length === 0) {
      applyPose(NEUTRAL);
      setGlyph("");
      return;
    }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((res) => timers.push(setTimeout(res, ms)));

    (async () => {
      let i = 0;
      while (i < words.length) {
        if (cancelled) return;
        onProgressRef.current?.(i);
        // Strip punctuation AND markdown noise (**, #, numbered-list "1)")
        // that the caller's text might still carry — a word arriving as
        // "**تطوير**" or "5." never matched WORD_ALIASES even when the
        // plain word would have, so it silently fell back to fingerspelling.
        const clean = (w: string) =>
          w
            .replace(/[.,!?؛،:"'()\[\]{}]/g, "")
            .replace(/\*\*/g, "")
            .replace(/[*_#~`]/g, "")
            .trim();
        const raw = clean(words[i]);
        // English ASL vocabulary is intentionally resolved before the Arabic
        // dictionary.  These are separate signed languages: an English token
        // must never be silently replaced by an Arabic-sign approximation.
        const aslMatch = resolveAslAvatarSign(words.map(clean), i);

        // Try a 2-word phrase first (e.g. "لو سمحت", "مع السلامة") — several
        // WORD_ALIASES entries are multi-word, but `words` has already been
        // split on whitespace by the caller, so a single-token lookup could
        // NEVER match them: "لو سمحت" would look up "لو" alone (not found),
        // fall through to fingerspelling, then do the same for "سمحت" —
        // the phrase gesture was unreachable in every case.
        let consumed = 1;
        let arslEntry = null;

        // 1. Check if two words form an authenticated ArSL dictionary sign
        if (!aslMatch && i + 1 < words.length) {
          const twoWord = `${raw} ${clean(words[i + 1])}`;
          arslEntry = lookupArslSign(twoWord);
          if (arslEntry) {
            consumed = 2;
          }
        }
        // 2. Check if single word is an authenticated ArSL dictionary sign
        if (!aslMatch && !arslEntry) {
          arslEntry = lookupArslSign(raw);
        }

        // Set non-manual facial and head expression for current sign
        let nonManual: 'question_eyebrows' | 'happy_smile' | 'concern_furrow' | 'head_nod' | 'head_shake' | 'neutral' = 'neutral';
        if (aslMatch?.sign.id === "QUESTION") {
          nonManual = 'question_eyebrows';
        } else if (aslMatch?.sign.id === "YES") {
          nonManual = 'head_nod';
        } else if (aslMatch?.sign.id === "NO") {
          nonManual = 'head_shake';
        } else if (aslMatch?.sign.id === "EMERGENCY") {
          nonManual = 'concern_furrow';
        } else if (aslMatch?.sign.id === "HELLO" || aslMatch?.sign.id === "THANK-YOU") {
          nonManual = 'happy_smile';
        } else if (arslEntry?.hamnosys?.nonManual) {
          nonManual = arslEntry.hamnosys.nonManual;
        } else {
          const w = raw.toLowerCase();
          if (/[?؟]/.test(words[i]) || /^(هل|ما|ماذا|اين|أين|كيف|كم|لماذا|ليه|مين|what|where|how|why|who)\b/i.test(w)) {
            nonManual = 'question_eyebrows';
          } else if (/^(اهل|أهل|اهلا|أهلاً|مرحب|شكرا|شكراً|نعم|تمام|موافق|حب|سعيد|فرح|hello|thanks|yes|love)\b/i.test(w)) {
            nonManual = 'happy_smile';
          } else if (/^(لا|كلا|مش|غير|مافيش|مفيش|no|not|stop)\b/i.test(w)) {
            nonManual = 'head_shake';
          } else if (/^(الم|ألم|وجع|تعب|طبيب|دكتور|اسعاف|إسعاف|خطر|pain|hurt|sick)\b/i.test(w)) {
            nonManual = 'concern_furrow';
          } else if (/^(نعم|حاضر|صح|ايوة|أيوة|yes|ok|sure)\b/i.test(w)) {
            nonManual = 'head_nod';
          }
        }
        currentNonManualRef.current = nonManual;

        if (aslMatch) {
          consumed = aslMatch.consumed;
          setGlyph("");
          for (const step of aslMatch.sign.steps) {
            if (cancelled) return;
            applyPose(step, aslMatch.sign.hands);
            await wait(step.hold ?? 500);
          }
        } else if (arslEntry) {
          setGlyph("");
          const threePose = hamnosysToThreePose(arslEntry.hamnosys);
          applyPose({
            f: threePose.f,
            out: threePose.out,
            spread: threePose.spread,
            pos: threePose.pos,
            wrist: threePose.wrist,
            motion: (arslEntry.hamnosys.movement === 'shake' ? 'wave' : arslEntry.hamnosys.movement === 'nod' ? 'nod' : arslEntry.hamnosys.movement === 'tap' ? 'tap' : null),
            hold: arslEntry.hamnosys.holdMs || 650,
          });
          await wait(arslEntry.hamnosys.holdMs || 650);
        } else {
          // Fall back to legacy aliases or letter fingerspelling
          let alias: string | undefined;
          if (i + 1 < words.length) {
            const twoWord = `${raw} ${clean(words[i + 1])}`.toLowerCase();
            if (WORD_ALIASES[twoWord]) {
              alias = WORD_ALIASES[twoWord];
              consumed = 2;
            }
          }
          if (!alias) {
            alias = WORD_ALIASES[raw.toLowerCase()];
          }
          const gesture = alias ? WORD_SIGNS[alias] : undefined;

          if (gesture) {
            setGlyph("");
            for (const step of gesture.steps) {
              if (cancelled) return;
              applyPose(step);
              await wait(step.hold ?? 500);
            }
          } else {
            for (const ch of Array.from(raw)) {
              if (cancelled) return;
              const key = resolveAslFingerspellingCharacter(ch) || normalizeChar(ch);
              if (!key) continue;
              applyPose({ ...NEUTRAL, ...LETTER_POSES[key], pos: HAND_HOME });
              // Display ONLY the genuine Arabic character — never display internal Latin keys (e.g. 'S' for 'ش')
              const isArabicChar = /[\u0600-\u06FF]/.test(ch);
              setGlyph(isArabicChar ? ch : "");
              await wait(360);
            }
          }
        }
        applyPose(NEUTRAL);
        setGlyph("");
        if (cancelled) return;
        await wait(280);
        i += consumed;
      }
      if (!cancelled) {
        applyPose(NEUTRAL);
        currentNonManualRef.current = 'neutral';
        onDoneRef.current?.();
      }
    })();

    return () => {
      cancelled = true;
      currentNonManualRef.current = 'neutral';
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, wordsKey]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className || ""}`}>
      {/* Current fingerspelled letter — strictly Arabic only, zero English letters */}
      {glyph && /[\u0600-\u06FF]/.test(glyph) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1 bg-black/75 backdrop-blur-md rounded-xl border border-amber-500/30 shadow-xl pointer-events-none flex items-center gap-1.5 animate-fadeIn">
          <span className="text-[11px] text-amber-400 font-bold">هجاء إشاري:</span>
          <span className="text-2xl font-black text-white tracking-wide font-sans">{glyph}</span>
        </div>
      )}
      {webglError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
          <span className="text-3xl">🤟</span>
          <span className="text-text-muted text-xs font-bold">المجسم ثلاثي الأبعاد غير مدعوم على هذا الجهاز.</span>
          <span className="text-faint text-[11px]">النص المترجم للغة الإشارة يظهر بالأسفل.</span>
        </div>
      ) : !ready && (
        <div className="absolute inset-0 flex items-center justify-center text-text-muted text-xs font-bold tracking-wider">
          جاري تحميل مجسم الإشارة 3D...
        </div>
      )}
      {/*
        HONEST DISCLAIMER — Arabic-first transparent disclosure for ArSL / Deaf community.
      */}
      <div className="absolute top-2 left-2 z-40 px-2.5 py-1 bg-black/60 backdrop-blur-sm border border-amber-500/30 rounded-lg pointer-events-none">
        <span className="text-[10px] text-amber-300 font-bold leading-tight block text-center">
          ⚠️ إشارات تجريبية — تحت المراجعة اللغوية مع الجمعية المصرية للصم
        </span>
      </div>
    </div>
  );
}
