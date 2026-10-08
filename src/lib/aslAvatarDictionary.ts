/**
 * Curated ASL avatar vocabulary.
 *
 * This file deliberately separates linguistic lookup from the Three.js rig.
 * The poses below are an implementation draft, not a linguistic certification:
 * every entry carries review metadata so it can be approved by a fluent ASL
 * signer before it is presented as a production sign.
 */

export type AvatarMotion = "wave" | "nod" | "tap" | "j" | "z" | "circle" | null;

export interface AvatarHandPose {
  f: [number, number, number, number, number];
  out?: number;
  spread?: number;
  wrist?: [number, number, number];
  pos?: [number, number, number];
  motion?: AvatarMotion;
  hold?: number;
}

export interface AslAvatarSign {
  id: string;
  gloss: string;
  triggers: string[];
  hands: "right" | "both";
  type: "fingerspelling" | "lexical" | "phrase";
  review: "draft" | "reviewed" | "approved";
  referenceNote: string;
  steps: AvatarHandPose[];
}

export const AVATAR_HAND_HOME: [number, number, number] = [0.2, 1.17, 0.42];

export const AVATAR_NEUTRAL: AvatarHandPose = {
  f: [0.18, 0.22, 0.22, 0.22, 0.25], out: 0.15, spread: 0.1,
  wrist: [0, 0, 0], pos: AVATAR_HAND_HOME, motion: null,
};

/** ASL manual alphabet and digits. J/Z are temporal, not static poses. */
export const ASL_FINGERSPELLING_POSES: Record<string, AvatarHandPose> = {
  A: { f: [0.15, 1, 1, 1, 1], out: 0.25 }, B: { f: [0.95, 0, 0, 0, 0], spread: 0.05 },
  C: { f: [0.45, 0.5, 0.5, 0.5, 0.5], out: 0.3 }, D: { f: [0.55, 0, 0.85, 0.9, 0.9] },
  E: { f: [0.85, 0.8, 0.8, 0.8, 0.8] }, F: { f: [0.5, 0.55, 0, 0, 0], spread: 0.4 },
  G: { f: [0.25, 0, 1, 1, 1], out: 0.6, wrist: [0, 0, -1.4] }, H: { f: [0.6, 0, 0, 1, 1], wrist: [0, 0, -1.4] },
  I: { f: [0.8, 1, 1, 1, 0] }, J: { f: [0.8, 1, 1, 1, 0], motion: "j" },
  K: { f: [0.45, 0, 0, 1, 1], spread: 0.55 }, L: { f: [0, 0, 1, 1, 1], out: 1 },
  M: { f: [1, 0.78, 0.78, 0.78, 1] }, N: { f: [1, 0.78, 0.78, 1, 1] },
  O: { f: [0.55, 0.6, 0.6, 0.6, 0.6] }, P: { f: [0.45, 0, 0.35, 1, 1], spread: 0.4, wrist: [1.7, 0, 0] },
  Q: { f: [0.3, 0, 1, 1, 1], out: 0.5, wrist: [1.7, 0, 0] }, R: { f: [0.85, 0.05, 0.14, 1, 1] },
  S: { f: [0.7, 1, 1, 1, 1] }, T: { f: [0.75, 0.9, 1, 1, 1] },
  U: { f: [0.85, 0, 0, 1, 1] }, V: { f: [0.85, 0, 0, 1, 1], spread: 0.8 },
  W: { f: [0.85, 0, 0, 0, 1], spread: 0.6 }, X: { f: [0.8, 0.5, 1, 1, 1] },
  Y: { f: [0, 1, 1, 1, 0], out: 1 }, Z: { f: [0.8, 0, 1, 1, 1], motion: "z" },
  "0": { f: [0.55, 0.6, 0.6, 0.6, 0.6] }, "1": { f: [0.8, 0, 1, 1, 1] },
  "2": { f: [0.85, 0, 0, 1, 1], spread: 0.8 }, "3": { f: [0, 0, 0, 1, 1], out: 1, spread: 0.6 },
  "4": { f: [0.9, 0, 0, 0, 0], spread: 0.7 }, "5": { f: [0, 0, 0, 0, 0], out: 1, spread: 0.8 },
  "6": { f: [0.5, 0, 0, 0, 0.6] }, "7": { f: [0.5, 0, 0, 0.6, 0] },
  "8": { f: [0.5, 0, 0.6, 0, 0] }, "9": { f: [0.5, 0.6, 0, 0, 0] },
};

const draft = "Draft motion reference — requires review by a fluent ASL signer before approval.";

/** The first production vocabulary: ASL Core 14. */
export const ASL_CORE_SIGN_DICTIONARY: AslAvatarSign[] = [
  { id: "HELLO", gloss: "HELLO", triggers: ["hello", "hi", "hey"], hands: "right", type: "lexical", review: "draft", referenceNote: draft, steps: [
    { f: [0, 0, 0, 0, 0], out: 1, spread: 0.4, pos: [0.13, 1.5, 0.3], wrist: [0.25, 0, 0.35], hold: 380 },
    { f: [0, 0, 0, 0, 0], out: 1, spread: 0.4, pos: [0.36, 1.46, 0.44], wrist: [0.25, 0, -0.45], hold: 420 },
  ] },
  { id: "THANK-YOU", gloss: "THANK-YOU", triggers: ["thank you", "thanks", "thank"], hands: "right", type: "phrase", review: "draft", referenceNote: draft, steps: [
    { f: [0.1, 0, 0, 0, 0], pos: [0.06, 1.41, 0.34], wrist: [0.55, 0, 0], hold: 340 },
    { f: [0.1, 0, 0, 0, 0], pos: [0.12, 1.28, 0.56], wrist: [1.05, 0, 0], hold: 440 },
  ] },
  { id: "PLEASE", gloss: "PLEASE", triggers: ["please"], hands: "right", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [1, 1, 1, 1, 1], pos: [0.05, 1.2, 0.34], motion: "circle", hold: 900 }] },
  { id: "SORRY", gloss: "SORRY", triggers: ["sorry"], hands: "right", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [1, 1, 1, 1, 1], pos: [0.05, 1.18, 0.34], motion: "circle", hold: 950 }] },
  { id: "YES", gloss: "YES", triggers: ["yes", "ok", "okay"], hands: "right", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [0.7, 1, 1, 1, 1], motion: "nod", hold: 850 }] },
  { id: "NO", gloss: "NO", triggers: ["no", "not"], hands: "right", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [0.35, 0, 0, 1, 1], motion: "tap", hold: 850 }] },
  { id: "HELP", gloss: "HELP", triggers: ["help"], hands: "both", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [0, 0, 0, 0, 0], out: 1, spread: 0.4, motion: "circle", pos: [0.08, 1.24, 0.34], hold: 950 }] },
  { id: "EMERGENCY", gloss: "EMERGENCY", triggers: ["emergency"], hands: "both", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [0.7, 1, 1, 1, 1], pos: [0.08, 1.34, 0.42], motion: "wave", hold: 900 }] },
  { id: "I", gloss: "I", triggers: ["i", "me"], hands: "right", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [0.8, 0, 1, 1, 1], pos: [0.1, 1.24, 0.3], wrist: [2.4, 0, 0], hold: 750 }] },
  { id: "YOU", gloss: "YOU", triggers: ["you"], hands: "right", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [0.8, 0, 1, 1, 1], wrist: [1.5, 0, 0], hold: 750 }] },
  { id: "UNDERSTAND", gloss: "UNDERSTAND", triggers: ["understand", "understood"], hands: "right", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [0.8, 0, 1, 1, 1], pos: [0.08, 1.5, 0.34], motion: "tap", hold: 820 }] },
  { id: "REPEAT", gloss: "REPEAT", triggers: ["repeat", "again"], hands: "right", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [0.3, 0.3, 0.3, 0.3, 0.3], pos: [0.06, 1.28, 0.42], motion: "circle", hold: 900 }] },
  { id: "QUESTION", gloss: "QUESTION", triggers: ["question", "what", "where", "how"], hands: "right", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [0.8, 0, 1, 1, 1], pos: [0.16, 1.35, 0.42], motion: "tap", hold: 880 }] },
  { id: "GOODBYE", gloss: "GOODBYE", triggers: ["goodbye", "bye"], hands: "right", type: "lexical", review: "draft", referenceNote: draft, steps: [{ f: [0, 0, 0, 0, 0], out: 1, spread: 0.4, pos: [0.3, 1.5, 0.42], motion: "wave", hold: 950 }] },
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim();

/** Resolves the longest ASL phrase first, then a single word or canonical ID. */
export function resolveAslAvatarSign(tokens: string[], index: number): { sign: AslAvatarSign; consumed: number } | null {
  const candidates = [2, 1];
  for (const count of candidates) {
    if (index + count > tokens.length) continue;
    const phrase = normalize(tokens.slice(index, index + count).join(" "));
    const found = ASL_CORE_SIGN_DICTIONARY.find((sign) =>
      normalize(sign.id) === phrase || sign.triggers.some((trigger) => normalize(trigger) === phrase),
    );
    if (found) return { sign: found, consumed: count };
  }
  return null;
}

export function resolveAslFingerspellingCharacter(character: string): string {
  const upper = character.toUpperCase();
  return ASL_FINGERSPELLING_POSES[upper] ? upper : "";
}
