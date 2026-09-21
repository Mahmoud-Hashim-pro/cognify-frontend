/**
 * Milestone 21: Open Developer API & Webhooks Ecosystem Engine
 * API Key Generation & Verification (SHA-256 Hashed Storage),
 * RFC 2104 HMAC-SHA256 Webhook Signatures, Replay Attack Prevention,
 * and OpenAPI 3.1 Specification Generator.
 */

import { sha256 } from './privacySecurityEngine';
import type {
  ApiKeyRecord,
  ApiKeyScope,
  WebhookSubscription,
  WebhookDispatchEvent,
  ApiAuthenticationResult
} from '../types/developerApi';

// ============================================================================
// 1. Standard RFC 2104 HMAC-SHA256 (Pure TypeScript)
// ============================================================================

export function hmacSha256(key: string, message: string): string {
  const BLOCK_SIZE = 64; // 512 bits / 8 bytes

  let keyBytes: number[] = [];
  for (let i = 0; i < key.length; i++) {
    keyBytes.push(key.charCodeAt(i) & 0xff);
  }

  // If key longer than block size, hash it
  if (keyBytes.length > BLOCK_SIZE) {
    const hashedKeyHex = sha256(key);
    keyBytes = [];
    for (let i = 0; i < hashedKeyHex.length; i += 2) {
      keyBytes.push(parseInt(hashedKeyHex.substr(i, 2), 16));
    }
  }

  // Pad key to BLOCK_SIZE with zeros
  while (keyBytes.length < BLOCK_SIZE) {
    keyBytes.push(0x00);
  }

  // Inner and outer padded keys
  const oPad: number[] = [];
  const iPad: number[] = [];
  for (let i = 0; i < BLOCK_SIZE; i++) {
    oPad.push(keyBytes[i] ^ 0x5c);
    iPad.push(keyBytes[i] ^ 0x36);
  }

  // Convert iPad to raw character string
  const iPadStr = String.fromCharCode(...iPad);
  const innerHashHex = sha256(iPadStr + message);

  // Convert innerHashHex to byte string
  let innerHashBytes = '';
  for (let i = 0; i < innerHashHex.length; i += 2) {
    innerHashBytes += String.fromCharCode(parseInt(innerHashHex.substr(i, 2), 16));
  }

  const oPadStr = String.fromCharCode(...oPad);
  return sha256(oPadStr + innerHashBytes);
}

// ============================================================================
// 2. API Key Management (Zero Plaintext Storage)
// ============================================================================

export function generateApiKey(
  tenantId: string,
  name: string,
  scopes: ApiKeyScope[]
): { rawKey: string; record: ApiKeyRecord } {
  // Generate random 32 character hex string
  let randomHex = '';
  for (let i = 0; i < 4; i++) {
    randomHex += Math.random().toString(16).substring(2, 10);
  }
  randomHex = randomHex.slice(0, 32);

  const rawKey = `cog_live_${randomHex}`;
  const keyHash = sha256(rawKey);
  const keyId = 'key_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const keyPrefix = rawKey.slice(0, 16) + '...';

  const record: ApiKeyRecord = {
    keyId,
    name,
    keyHash,
    keyPrefix,
    tenantId,
    scopes,
    createdAt: Date.now(),
    status: 'active'
  };

  return { rawKey, record };
}

export function verifyApiKey(
  rawKey: string,
  requiredScope?: ApiKeyScope,
  records: ApiKeyRecord[] = []
): ApiAuthenticationResult {
  if (!rawKey || !rawKey.startsWith('cog_live_')) {
    return { authenticated: false, error: 'Malformed API key. Must begin with cog_live_' };
  }

  const hash = sha256(rawKey);
  const record = records.find(r => r.keyHash === hash);

  if (!record) {
    return { authenticated: false, error: 'Invalid API key or key does not exist' };
  }

  if (record.status !== 'active') {
    return { authenticated: false, error: 'API key has been revoked' };
  }

  if (requiredScope && !record.scopes.includes(requiredScope)) {
    return {
      authenticated: false,
      error: `API key lacks required scope '${requiredScope}'. Granted: [${record.scopes.join(', ')}]`
    };
  }

  record.lastUsedAt = Date.now();
  return { authenticated: true, keyRecord: record };
}

export function revokeApiKey(keyId: string, records: ApiKeyRecord[]): boolean {
  const record = records.find(r => r.keyId === keyId);
  if (record) {
    record.status = 'revoked';
    return true;
  }
  return false;
}

// ============================================================================
// 3. Webhooks Dispatch & HMAC Signature Verification
// ============================================================================

export function signWebhookPayload(
  payload: string,
  secret: string,
  timestamp: number = Date.now()
): { signatureHeader: string; timestamp: number } {
  const signedData = `${timestamp}.${payload}`;
  const v1Signature = hmacSha256(secret, signedData);
  return {
    signatureHeader: `t=${timestamp},v1=${v1Signature}`,
    timestamp
  };
}

export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  maxAgeMs = 300000 // 5 minutes tolerance against replay attacks
): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(',');
  let timestampStr: string | null = null;
  let signature: string | null = null;

  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't') timestampStr = v;
    if (k === 'v1') signature = v;
  }

  if (!timestampStr || !signature) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Check replay attack window
  const now = Date.now();
  if (Math.abs(now - timestamp) > maxAgeMs) {
    return false;
  }

  const expectedSignature = hmacSha256(secret, `${timestamp}.${payload}`);
  return signature === expectedSignature;
}

// ============================================================================
// 4. OpenAPI 3.1 Specification Generator
// ============================================================================

export function generateOpenApiSpec(): Record<string, any> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Cognify 2.0 Adaptive Learning Platform API',
      version: '2.0.0',
      description: 'Programmatic REST API for LMS integration, pedagogical evaluations, differential privacy analytics, and real-time webhook subscriptions.'
    },
    servers: [
      { url: 'https://cognify.app/api/v1', description: 'Production Gateway' }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key (cog_live_*)',
          description: 'Provide your Cognify API Key with the Bearer prefix.'
        }
      }
    },
    paths: {
      '/student/state': {
        get: {
          summary: 'Get Student Adaptive State',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Student state with cognitive stage and concept mastery' },
            '401': { description: 'Unauthorized or missing scope read:analytics' }
          }
        }
      },
      '/events/emit': {
        post: {
          summary: 'Emit Learning Event (Exercise/Quiz/Feedback)',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Event processed and projected to state' },
            '401': { description: 'Missing scope write:events' }
          }
        }
      },
      '/ai/guard': {
        post: {
          summary: 'Run AI Output Quality Guard 2.0',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Sanitized and self-healed AI output' }
          }
        }
      },
      '/privacy/export': {
        post: {
          summary: 'Self-Service Data Portability Export',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Complete GDPR/FERPA JSON export package' }
          }
        }
      }
    }
  };
}
