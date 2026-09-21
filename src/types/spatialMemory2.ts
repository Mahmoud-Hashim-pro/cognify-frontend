/**
 * Spatial Memory 2.0 Type Definitions for Cognify
 * Object Identity, Disambiguation, Movement Trajectory, and User Correction
 */

export interface SpatialLocationObservation {
  timestamp: number;
  roomEn: string;
  roomAr: string;
  roomFr: string;
  surfaceEn: string;
  surfaceAr: string;
  surfaceFr: string;
  direction?: string;
  confidence: number;
  visualNote?: string;
}

export interface SpatialObjectIdentity {
  id: string;
  uid?: string;
  category: string;
  labelEn: string;
  labelAr: string;
  labelFr: string;
  roomEn: string;
  roomAr: string;
  roomFr: string;
  surfaceEn: string;
  surfaceAr: string;
  surfaceFr: string;
  distinguishingFeatures: {
    color?: string;
    roomAffiliation?: string;
    nickname?: string;
    subType?: string;
  };
  confidence: number; // 0.0 to 1.0
  lastSeen: number;
  movementHistory: SpatialLocationObservation[];
  correctionsCount: number;
}

export interface SpatialDisambiguationResult {
  isAmbiguous: boolean;
  candidateMatches: SpatialObjectIdentity[];
  primaryMatch?: SpatialObjectIdentity;
  clarificationPromptEn?: string;
  clarificationPromptAr?: string;
  clarificationPromptFr?: string;
  confidence?: number;
  lastSeen?: number;
}

export interface SpatialCorrection {
  userId: string;
  targetObjectId?: string;
  category: string;
  correctedRoomEn: string;
  correctedRoomAr: string;
  correctedSurfaceEn: string;
  correctedSurfaceAr: string;
  distinguishingLabel?: string;
  correctedRoomFr?: string;
  correctedSurfaceFr?: string;
}
