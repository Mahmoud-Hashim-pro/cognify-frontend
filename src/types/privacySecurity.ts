/**
 * Milestone 16: Privacy & Security Intelligence Types
 * Canonical schemas for Differential Privacy, GDPR/FERPA Cascade Erasure,
 * Self-Service Data Portability Packaging, and Tamper-Resistant Chained Audits.
 */

import type { StudentState } from './studentState';

export interface DifferentialPrivacyConfig {
  epsilon: number;        // Privacy parameter (e.g. 0.1 to 2.0). Smaller = more privacy, more noise.
  sensitivity: number;    // Global sensitivity (Delta f), default 1.0 or scale max
  minBounds: number;      // Bounded clamping lower limit
  maxBounds: number;      // Bounded clamping upper limit
}

export interface DPQueryAuditRecord {
  queryId: string;
  queryType: string;
  epsilonUsed: number;
  timestamp: number;
}

export interface DifferentialPrivacyBudget {
  totalBudget: number;       // e.g. 10.0 epsilon units
  consumedBudget: number;
  remainingBudget: number;
  lastResetTimestamp: number;
  queryLog: DPQueryAuditRecord[];
}

export interface StudentDataExportPackage {
  exportId: string;
  exportedAt: string;        // ISO 8601 string
  studentUid: string;
  formatVersion: string;     // e.g. "cognify-export-v2.0"
  data: {
    studentState: StudentState;
    learningEventsCount: number;
    retentionSchedulesCount: number;
    spatialMemoriesCount: number;
    presenceStatus: string;
    exportTimestamp: number;
  };
  integrityChecksum: string; // Cryptographic SHA-256 digest
  complianceStatement: string;
}

export interface CascadeErasureRequest {
  requestId: string;
  studentUid: string;
  requestedAt: number;
  confirmedByActor: string;
  reason: 'gdpr_article_17' | 'ferpa_request' | 'user_voluntary_deletion';
}

export interface CascadeErasureManifest {
  requestId: string;
  studentUid: string;
  completedAt: number;
  recordsWiped: {
    profileState: boolean;
    learningEventsRedacted: number;
    spatialMemoriesWiped: number;
    presenceCleaned: boolean;
    auditRecordsAnonymized: number;
  };
  receiptHash: string;
  status: 'completed' | 'failed' | 'partial';
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  actorUid: string;
  action: 'DATA_EXPORT' | 'CASCADE_ERASURE' | 'DP_QUERY' | 'PROFILE_UPDATE' | 'ROLE_CHANGE' | 'SECURITY_SCAN';
  targetUid: string;
  payloadDigest: string;
  prevHash: string;
  entryHash: string;
}

export interface AuditChainVerificationResult {
  isValid: boolean;
  totalEntries: number;
  tamperedIndex: number;
  brokenReason?: string;
}
