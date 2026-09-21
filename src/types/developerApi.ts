/**
 * Milestone 21: Open Developer API & Webhooks Ecosystem Types
 * Cryptographic API Key Lifecycle, Webhook Subscription & HMAC Signatures,
 * and OpenAPI 3.1 Integration Specification.
 */

export type ApiKeyScope = 'read:analytics' | 'write:events' | 'admin:sync' | 'ai:query';

export interface ApiKeyRecord {
  keyId: string;
  name: string;
  keyHash: string; // SHA-256 of the plaintext secret
  keyPrefix: string; // e.g. "cog_live_7a8b..."
  tenantId: string;
  scopes: ApiKeyScope[];
  createdAt: number;
  lastUsedAt?: number;
  status: 'active' | 'revoked';
}

export type WebhookEventType =
  | 'student.mastery_achieved'
  | 'intervention.triggered'
  | 'struggle.detected'
  | 'retention.scheduled'
  | 'privacy.export_ready';

export interface WebhookSubscription {
  webhookId: string;
  tenantId: string;
  targetUrl: string;
  secret: string; // Shared secret for HMAC-SHA256
  subscribedEvents: WebhookEventType[];
  createdAt: number;
  status: 'active' | 'disabled';
}

export interface WebhookDispatchEvent<T = any> {
  eventId: string;
  type: WebhookEventType;
  timestamp: number;
  tenantId: string;
  data: T;
}

export interface WebhookDeliveryAttempt {
  attemptId: string;
  webhookId: string;
  eventId: string;
  timestamp: number;
  statusCode: number;
  success: boolean;
  signature: string;
}

export interface ApiAuthenticationResult {
  authenticated: boolean;
  keyRecord?: ApiKeyRecord;
  error?: string;
}
