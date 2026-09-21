/**
 * Milestone 16: Privacy & Security Intelligence Engine
 * Differential Privacy Noise Mechanism, GDPR/FERPA Cascade Erasure Orchestration,
 * Self-Service Data Portability Packaging, and Cryptographic Tamper-Resistant Chained Audits.
 */

import type {
  DifferentialPrivacyConfig,
  DifferentialPrivacyBudget,
  StudentDataExportPackage,
  CascadeErasureRequest,
  CascadeErasureManifest,
  AuditLogEntry,
  AuditChainVerificationResult
} from '../types/privacySecurity';
import type { StudentState } from '../types/studentState';

// ============================================================================
// 1. Standalone Pure TypeScript SHA-256 (Cross-Platform Synchronous)
// ============================================================================

export function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  hash = hash.slice(0, 8);

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return ''; // ASCII check
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 =
        hash[7] +
        (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
        ch +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] + s0 + w[i - 7] + s1) | 0);
      const temp2 =
        (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) +
        maj;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// ============================================================================
// 2. Differential Privacy Laplace Noise Mechanism
// ============================================================================

export const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Samples a random value from a Laplace distribution Laplace(mu, b)
 * using inverse cumulative distribution function.
 */
export function sampleLaplace(mu = 0, b = 1, rng: () => number = Math.random): number {
  if (b <= 0) return mu;
  // Uniform in (-0.5, 0.5) avoiding exact 0
  const u = rng() - 0.5;
  const sgn = u < 0 ? -1 : 1;
  const noise = -b * sgn * Math.log(1 - 2 * Math.abs(u));
  return mu + noise;
}

export function createDefaultDPBudget(totalBudget = 10.0): DifferentialPrivacyBudget {
  return {
    totalBudget,
    consumedBudget: 0,
    remainingBudget: totalBudget,
    lastResetTimestamp: Date.now(),
    queryLog: []
  };
}

/**
 * Applies epsilon-differential privacy to an aggregate metric.
 * Deducts consumed epsilon from the privacy budget if supplied.
 */
export function applyDifferentialPrivacy(
  value: number,
  config: DifferentialPrivacyConfig,
  budget?: DifferentialPrivacyBudget,
  rng?: () => number
): { perturbedValue: number; noiseAdded: number; remainingBudget?: number } {
  if (config.epsilon <= 0) {
    throw new Error('Differential privacy epsilon must be strictly positive (> 0)');
  }

  if (budget) {
    if (budget.remainingBudget < config.epsilon) {
      throw new Error(`Differential privacy budget exhausted. Requested: ${config.epsilon}, Remaining: ${budget.remainingBudget.toFixed(2)}`);
    }
    budget.consumedBudget = parseFloat((budget.consumedBudget + config.epsilon).toFixed(4));
    budget.remainingBudget = parseFloat((budget.totalBudget - budget.consumedBudget).toFixed(4));
    budget.queryLog.push({
      queryId: 'dp_' + Math.random().toString(36).substring(2, 9),
      queryType: 'AGGREGATE_METRIC',
      epsilonUsed: config.epsilon,
      timestamp: Date.now()
    });
  }

  const b = config.sensitivity / config.epsilon;
  const noise = sampleLaplace(0, b, rng);
  const rawPerturbed = value + noise;
  const boundedPerturbed = Math.max(config.minBounds, Math.min(config.maxBounds, rawPerturbed));

  return {
    perturbedValue: parseFloat(boundedPerturbed.toFixed(4)),
    noiseAdded: parseFloat(noise.toFixed(4)),
    remainingBudget: budget ? budget.remainingBudget : undefined
  };
}

// ============================================================================
// 3. Self-Service Data Portability Packaging (FERPA / GDPR)
// ============================================================================

export function packageStudentExport(
  studentState: StudentState,
  meta: {
    learningEventsCount?: number;
    retentionSchedulesCount?: number;
    spatialMemoriesCount?: number;
    presenceStatus?: string;
  } = {}
): StudentDataExportPackage {
  const exportTimestamp = Date.now();
  const exportPayload = {
    studentState,
    learningEventsCount: meta.learningEventsCount ?? 0,
    retentionSchedulesCount: meta.retentionSchedulesCount ?? Object.keys(studentState.retentionSchedules || {}).length,
    spatialMemoriesCount: meta.spatialMemoriesCount ?? 0,
    presenceStatus: meta.presenceStatus ?? 'offline',
    exportTimestamp
  };

  const serializedData = JSON.stringify(exportPayload);
  const integrityChecksum = sha256(serializedData);

  return {
    exportId: 'export_' + exportTimestamp + '_' + studentState.uid.slice(0, 8),
    exportedAt: new Date(exportTimestamp).toISOString(),
    studentUid: studentState.uid,
    formatVersion: 'cognify-export-v2.0',
    data: exportPayload,
    integrityChecksum,
    complianceStatement: 'Generated in strict compliance with GDPR Article 20 (Right to Data Portability) and FERPA regulations.'
  };
}

// ============================================================================
// 4. Cascade Erasure Orchestrator (Right to be Forgotten)
// ============================================================================

export interface CascadeStoreTargets {
  profileStore?: Map<string, StudentState>;
  eventStore?: Array<{ studentUid?: string; type: string; timestamp: number; [key: string]: any }>;
  spatialMemoryStore?: Array<{ userId?: string; objectName: string; [key: string]: any }>;
  presenceStore?: Map<string, any>;
  auditStore?: AuditLogEntry[];
}

export function executeCascadeErasure(
  request: CascadeErasureRequest,
  stores: CascadeStoreTargets = {}
): CascadeErasureManifest {
  const uid = request.studentUid;
  let profileWiped = false;
  let eventsRedacted = 0;
  let spatialWiped = 0;
  let presenceCleaned = false;
  let auditAnonymized = 0;

  // 1. Wipe profile store
  if (stores.profileStore && stores.profileStore.has(uid)) {
    stores.profileStore.delete(uid);
    profileWiped = true;
  }

  // 2. Cascade redact event store (anonymize studentUid with tombstone hash, scrub personal inputs)
  if (stores.eventStore && Array.isArray(stores.eventStore)) {
    for (let i = 0; i < stores.eventStore.length; i++) {
      if (stores.eventStore[i].studentUid === uid) {
        stores.eventStore[i].studentUid = 'ANONYMIZED_TOMBSTONE_' + sha256(uid + '_tombstone').slice(0, 12);
        if (stores.eventStore[i].payload) {
          stores.eventStore[i].payload = '[REDACTED_UNDER_GDPR_ARTICLE_17]';
        }
        eventsRedacted++;
      }
    }
  }

  // 3. Cascade wipe spatial memories
  if (stores.spatialMemoryStore && Array.isArray(stores.spatialMemoryStore)) {
    const originalLen = stores.spatialMemoryStore.length;
    const filtered = stores.spatialMemoryStore.filter(mem => mem.userId !== uid);
    spatialWiped = originalLen - filtered.length;
    stores.spatialMemoryStore.length = 0;
    stores.spatialMemoryStore.push(...filtered);
  }

  // 4. Clean presence records
  if (stores.presenceStore && stores.presenceStore.has(uid)) {
    stores.presenceStore.delete(uid);
    presenceCleaned = true;
  }

  // 5. Anonymize audit targets
  if (stores.auditStore && Array.isArray(stores.auditStore)) {
    for (let i = 0; i < stores.auditStore.length; i++) {
      if (stores.auditStore[i].targetUid === uid) {
        stores.auditStore[i].targetUid = 'ANONYMIZED_USER_' + sha256(uid).slice(0, 10);
        auditAnonymized++;
      }
    }
  }

  const completedAt = Date.now();
  const receiptHash = sha256(`${request.requestId}|${uid}|${completedAt}|${eventsRedacted}|${spatialWiped}`);

  return {
    requestId: request.requestId,
    studentUid: uid,
    completedAt,
    recordsWiped: {
      profileState: profileWiped,
      learningEventsRedacted: eventsRedacted,
      spatialMemoriesWiped: spatialWiped,
      presenceCleaned: presenceCleaned,
      auditRecordsAnonymized: auditAnonymized
    },
    receiptHash,
    status: 'completed'
  };
}

// ============================================================================
// 5. Tamper-Resistant Chained Audit Logging
// ============================================================================

export function createAuditEntry(
  actorUid: string,
  action: AuditLogEntry['action'],
  targetUid: string,
  payload: any,
  prevHash: string = GENESIS_PREV_HASH,
  timestamp: number = Date.now()
): AuditLogEntry {
  const payloadDigest = sha256(JSON.stringify(payload ?? {}));
  const id = 'audit_' + timestamp + '_' + Math.random().toString(36).substring(2, 7);
  const entryHash = sha256(`${prevHash}:${timestamp}:${action}:${actorUid}:${targetUid}:${payloadDigest}`);

  return {
    id,
    timestamp,
    actorUid,
    action,
    targetUid,
    payloadDigest,
    prevHash,
    entryHash
  };
}

export function verifyAuditChain(entries: AuditLogEntry[]): AuditChainVerificationResult {
  if (!entries || entries.length === 0) {
    return { isValid: true, totalEntries: 0, tamperedIndex: -1 };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Verify linkage to previous block
    if (i === 0) {
      if (entry.prevHash !== GENESIS_PREV_HASH) {
        return {
          isValid: false,
          totalEntries: entries.length,
          tamperedIndex: 0,
          brokenReason: `Genesis block prevHash mismatch: expected ${GENESIS_PREV_HASH}, found ${entry.prevHash}`
        };
      }
    } else {
      const prevEntry = entries[i - 1];
      if (entry.prevHash !== prevEntry.entryHash) {
        return {
          isValid: false,
          totalEntries: entries.length,
          tamperedIndex: i,
          brokenReason: `Broken chain link at index ${i}: prevHash does not match entry ${i - 1} hash`
        };
      }
    }

    // Verify entry hash integrity
    const expectedHash = sha256(`${entry.prevHash}:${entry.timestamp}:${entry.action}:${entry.actorUid}:${entry.targetUid}:${entry.payloadDigest}`);
    if (entry.entryHash !== expectedHash) {
      return {
        isValid: false,
        totalEntries: entries.length,
        tamperedIndex: i,
        brokenReason: `Payload or signature tampering detected at entry index ${i} (${entry.id})`
      };
    }
  }

  return {
    isValid: true,
    totalEntries: entries.length,
    tamperedIndex: -1
  };
}
