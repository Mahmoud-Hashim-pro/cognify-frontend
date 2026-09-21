/**
 * Client-Side AES-256-GCM Encryption at Rest with Device-Bound Key Storage for Cognify 2.0
 * 
 * Provides robust client-side confidentiality for sensitive student data:
 *  - Chat Threads (/users/{uid}/threads/{threadId})
 *  - Spatial Memory Objects (/users/{uid}/spatialObjects/{objectId})
 *  - Vision Memories and Sensitive Notes
 * 
 * Architecture & Key Derivation (Device-Bound Random Vault + KEK/DEK):
 *  1. Native Web Crypto API (crypto.subtle) - Zero npm dependencies, hardware-accelerated.
 *  2. Device-Bound Random Vault Secret:
 *     Instead of predictable key derivation from UID alone, each device generates
 *     a cryptographically secure 256-bit random vault secret (`crypto.getRandomValues`)
 *     persisted in device storage (`cognify_device_vault_${userId}`).
 *  3. Key Derivation:
 *     PBKDF2-HMAC-SHA256 with 100,000 iterations combines the device-bound secret with
 *     the user UID, or an optional user-held passphrase (KEK -> DEK pattern).
 *     Without access to the client device vault or the user's secret passphrase, an attacker
 *     who only knows the user's UID and the open-source code cannot derive the encryption key.
 *  4. Cipher: AES-256-GCM with unique 96-bit (12-byte) initialization vector per encryption
 *     and built-in 128-bit authentication tag verification.
 *  5. Storage at rest in Firestore:
 *     {
 *       "encrypted": true,
 *       "version": 1,
 *       "iv": "<base64>",
 *       "ciphertext": "<base64>",
 *       "updatedAt": "<iso>"
 *     }
 *  6. Backward Compatibility: Transparently detects and parses legacy unencrypted
 *     records, automatically re-encrypting them on next persistence.
 */

import type { Message, SpatialObjectRecord } from '../types';

export interface EncryptedPayload {
  encrypted: true;
  version: number;
  iv: string;
  ciphertext: string;
  updatedAt?: string;
}

export interface EncryptedThreadDoc extends EncryptedPayload {
  threadId?: string;
  messageCount?: number;
}

export interface EncryptedSpatialDoc extends EncryptedPayload {
  id: string;
  category?: string;
}

// In-memory key cache to prevent redundant PBKDF2 executions during a session
const userKeyCache = new Map<string, CryptoKey>();

// User-held custom passphrases (optional KEK)
const userPassphraseCache = new Map<string, string>();

/**
 * Sets an optional user-held passphrase for client-side encryption.
 * When set, the encryption key is derived from the user's passphrase (KEK -> DEK),
 * providing end-to-end user-sovereign protection across devices.
 */
export function setUserCustomPassphrase(userId: string, passphrase: string): void {
  if (!userId) return;
  userPassphraseCache.set(userId, passphrase);
  for (const key of userKeyCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      userKeyCache.delete(key);
    }
  }
}

/**
 * Clears the user's custom passphrase from memory.
 */
export function clearUserCustomPassphrase(userId?: string): void {
  if (userId) {
    userPassphraseCache.delete(userId);
    for (const key of userKeyCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        userKeyCache.delete(key);
      }
    }
  } else {
    userPassphraseCache.clear();
    userKeyCache.clear();
  }
}

/**
 * Checks whether an active custom passphrase is set for this user.
 */
export function hasUserCustomPassphrase(userId: string): boolean {
  return !!userPassphraseCache.get(userId);
}

/**
 * Gets the active custom passphrase for this user, if set.
 */
export function getUserCustomPassphrase(userId: string): string | undefined {
  return userPassphraseCache.get(userId);
}

// In-memory fallback for environments without localStorage (e.g., Node test runner)
const nodeVaultStore = new Map<string, string>();

/**
 * Helper to get the active SubtleCrypto interface safely across
 * browser and Node test environments.
 */
function getSubtle(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('[userCryptoEngine] Web Crypto API (crypto.subtle) is not supported in this environment.');
}

/**
 * Converts ArrayBuffer to Base64 string
 */
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 string to Uint8Array
 */
function base64ToBuffer(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Retrieves or initializes a 256-bit cryptographically secure device-bound vault secret.
 * Stored locally in device storage (`cognify_device_vault_${userId}`).
 */
export function getDeviceVaultSecret(userId: string): Uint8Array {
  const storageKey = `cognify_device_vault_${userId}`;
  let storedBase64: string | null = null;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      storedBase64 = window.localStorage.getItem(storageKey);
    } catch {}
  } else {
    storedBase64 = nodeVaultStore.get(storageKey) || null;
  }

  if (storedBase64) {
    try {
      return base64ToBuffer(storedBase64);
    } catch {
      // Regenerate if corrupted
    }
  }

  // Generate 256-bit (32-byte) cryptographically secure random secret
  const secretBytes = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(secretBytes);
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(secretBytes);
  } else {
    throw new Error('[userCryptoEngine] Secure random source unavailable.');
  }

  const encoded = bufferToBase64(secretBytes);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(storageKey, encoded);
    } catch {}
  } else {
    nodeVaultStore.set(storageKey, encoded);
  }

  return secretBytes;
}

/**
 * Generates a stable salt for key derivation.
 * - In passphrase mode (KEK), generates a deterministic salt derived from userId and domain seed,
 *   enabling identical key derivation across different devices (Device A and Device B).
 * - In device-bound mode (no passphrase), binds salt to the device random secret and userId.
 */
async function getUserSalt(userId: string, isPassphraseMode: boolean = false): Promise<Uint8Array> {
  const subtle = getSubtle();
  const encoder = new TextEncoder();

  if (isPassphraseMode) {
    const seed = encoder.encode(`cognify_kek_salt_v11_${userId}_portable`);
    const hashBuffer = await subtle.digest('SHA-256', seed);
    return new Uint8Array(hashBuffer).slice(0, 16);
  }

  const deviceSecret = getDeviceVaultSecret(userId);
  const uidBytes = encoder.encode(`cognify_device_salt_v11_${userId}`);
  const combined = new Uint8Array(deviceSecret.length + uidBytes.length);
  combined.set(deviceSecret, 0);
  combined.set(uidBytes, deviceSecret.length);

  const hashBuffer = await subtle.digest('SHA-256', combined);
  return new Uint8Array(hashBuffer).slice(0, 16);
}

/**
 * Exports the device-bound vault secret as a portable recovery string (Base64).
 * Allows a user to back up their device key or sync it to a secondary device.
 */
export function exportDeviceVaultRecoveryKey(userId: string): string {
  if (!userId) {
    throw new Error('[userCryptoEngine] Cannot export vault key without userId');
  }
  const secret = getDeviceVaultSecret(userId);
  return bufferToBase64(secret);
}

/**
 * Imports a portable recovery key into the local device vault.
 * Overwrites the local device secret for this user and invalidates any cached keys.
 */
export function importDeviceVaultRecoveryKey(userId: string, recoveryKey: string): void {
  if (!userId || !recoveryKey) {
    throw new Error('[userCryptoEngine] Invalid userId or recoveryKey');
  }
  const trimmed = recoveryKey.trim();
  const secretBytes = base64ToBuffer(trimmed);
  if (secretBytes.length !== 32) {
    throw new Error('[userCryptoEngine] Invalid recovery key length. Expected 32 bytes (256-bit).');
  }

  const storageKey = `cognify_device_vault_${userId}`;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(storageKey, trimmed);
    } catch {}
  } else {
    nodeVaultStore.set(storageKey, trimmed);
  }

  // Invalidate any cached CryptoKeys for this user
  for (const key of userKeyCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      userKeyCache.delete(key);
    }
  }
}

/**
 * Derives a 256-bit AES-GCM CryptoKey using PBKDF2 with 100,000 iterations.
 * Combines UID with device-bound random secret or optional user-held passphrase.
 */
export async function deriveUserEncryptionKey(
  userId: string,
  customPassphrase?: string
): Promise<CryptoKey> {
  if (!userId) {
    throw new Error('[userCryptoEngine] Cannot derive encryption key without userId');
  }

  const effectivePassphrase = customPassphrase || getUserCustomPassphrase(userId);
  const isPassphraseMode = Boolean(effectivePassphrase);
  const cacheKey = `${userId}:${effectivePassphrase || 'device_bound'}`;
  const cachedKey = userKeyCache.get(cacheKey);
  if (cachedKey) return cachedKey;

  const subtle = getSubtle();
  const salt = await getUserSalt(userId, isPassphraseMode);
  const encoder = new TextEncoder();

  let rawKeyMaterial: Uint8Array;
  if (effectivePassphrase) {
    rawKeyMaterial = encoder.encode(`${userId}:${effectivePassphrase}:cognify_kek_v11`);
  } else {
    const deviceSecret = getDeviceVaultSecret(userId);
    const prefix = encoder.encode(`cognify_device_bound_key:${userId}:`);
    rawKeyMaterial = new Uint8Array(prefix.length + deviceSecret.length);
    rawKeyMaterial.set(prefix, 0);
    rawKeyMaterial.set(deviceSecret, prefix.length);
  }

  const baseKey = await subtle.importKey(
    'raw',
    rawKeyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  userKeyCache.set(cacheKey, derivedKey);
  return derivedKey;
}

/**
 * Clears the user key cache (e.g. on logout)
 */
export function clearUserEncryptionCache(): void {
  userKeyCache.clear();
}

/**
 * Encrypts any JSON-serializable data with AES-256-GCM.
 */
export async function encryptData<T>(
  data: T,
  userId: string,
  customPassphrase?: string
): Promise<EncryptedPayload> {
  const subtle = getSubtle();
  const key = await deriveUserEncryptionKey(userId, customPassphrase);

  const iv = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(iv);
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(iv);
  } else {
    throw new Error('No secure random source available');
  }

  const encoder = new TextEncoder();
  const serialized = JSON.stringify(data);
  const plaintext = encoder.encode(serialized);

  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return {
    encrypted: true,
    version: 1,
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertextBuffer),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Decrypts AES-256-GCM ciphertext payload back into typed object.
 * Returns payload as-is if it is not encrypted (backward compatibility).
 */
export async function decryptData<T>(
  payload: any,
  userId: string,
  customPassphrase?: string
): Promise<T> {
  if (!payload || typeof payload !== 'object') {
    return payload as T;
  }

  // If not encrypted, return as-is (legacy plaintext)
  if (!isEncryptedPayload(payload)) {
    return payload as T;
  }

  const subtle = getSubtle();
  const key = await deriveUserEncryptionKey(userId, customPassphrase);

  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decryptedBuffer);
  return JSON.parse(jsonString) as T;
}

/**
 * Checks whether an incoming payload is encrypted with Cognify AES-256-GCM.
 */
export function isEncryptedPayload(obj: any): boolean {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    obj.encrypted === true &&
    typeof obj.iv === 'string' &&
    typeof obj.ciphertext === 'string'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT THREADS ENCRYPTION ADAPTERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encrypts an array of chat messages into an encrypted thread document for Firestore.
 */
export async function encryptThreadMessages(
  messages: Message[],
  userId: string
): Promise<EncryptedThreadDoc> {
  const enc = await encryptData(messages, userId);
  return {
    ...enc,
    messageCount: messages.length,
  };
}

/**
 * Decrypts an incoming Firestore thread document into Message[] array.
 * Handles both legacy plaintext `{ messages: [...] }` and `{ encrypted: true, ... }`.
 */
export async function decryptThreadMessages(
  rawDocData: any,
  userId: string
): Promise<Message[]> {
  if (!rawDocData) return [];

  // If already encrypted doc
  if (isEncryptedPayload(rawDocData)) {
    try {
      const decrypted = await decryptData<Message[]>(rawDocData, userId);
      return Array.isArray(decrypted) ? decrypted : [];
    } catch (err) {
      console.error('[userCryptoEngine] Failed to decrypt thread document:', err);
      return [
        {
          id: 'decrypt_error',
          role: 'assistant',
          content: '🔒 Message content encrypted with a different key or corrupted.',
          timestamp: new Date().toISOString(),
        },
      ];
    }
  }

  // Legacy plaintext fallback: doc has `{ messages: [...] }`
  if (Array.isArray(rawDocData.messages)) {
    return rawDocData.messages as Message[];
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// SPATIAL MEMORY ENCRYPTION ADAPTERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encrypts a physical spatial object record for storage in
 * /users/{uid}/spatialObjects/{objectId}
 */
export async function encryptSpatialRecord(
  record: SpatialObjectRecord,
  userId: string
): Promise<EncryptedSpatialDoc> {
  const enc = await encryptData(record, userId);
  return {
    id: record.id,
    category: record.category,
    ...enc,
  };
}

/**
 * Decrypts an incoming spatial object document from Firestore.
 * Handles both encrypted records and legacy plaintext records.
 */
export async function decryptSpatialRecord(
  rawDocData: any,
  userId: string
): Promise<SpatialObjectRecord | null> {
  if (!rawDocData) return null;

  if (isEncryptedPayload(rawDocData)) {
    try {
      const decrypted = await decryptData<SpatialObjectRecord>(rawDocData, userId);
      return decrypted;
    } catch (err) {
      console.error('[userCryptoEngine] Failed to decrypt spatial object:', err);
      return null;
    }
  }

  // Legacy plaintext fallback
  if (rawDocData.id && (rawDocData.objectName || rawDocData.category)) {
    return rawDocData as SpatialObjectRecord;
  }

  return null;
}
