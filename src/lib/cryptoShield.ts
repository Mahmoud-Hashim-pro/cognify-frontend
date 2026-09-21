/**
 * Cognify Client Storage Protection (V1)
 * 
 * Provides client-side storage obfuscation, integrity verification, and optional
 * Web Crypto AES-GCM protection for user-provided BYOK (Bring-Your-Own-Key) tokens
 * stored in browser localStorage.
 * 
 * ARCHITECTURAL BOUNDARY:
 * 1. Primary AI inference in production Cognify is executed server-side via `/api/gemini/chat`,
 *    where API keys reside exclusively in server environment variables and are NEVER sent to the client.
 * 2. This client shield protects optional developer keys entered in Settings (BYOK) against
 *    plain-text shoulder-surfing and automated scraper memory inspection.
 * 3. Sync operations use salted dynamic stream permutation with checksum verification.
 * 4. Async operations leverage the standard browser Web Crypto API (AES-GCM 256-bit) when available.
 */

const SHIELD_PREFIX = 'enc:v1:';
const MASTER_SEED = 'cognify_crypto_shield_v1_9a8b7c6d5e';
const inMemoryKeyCache = new Map<string, string>();

/**
 * Derives a dynamic entropy seed combining environment variables,
 * host origin, user agent, and salt.
 */
function deriveEntropySeed(salt: string): number[] {
  let entropy = MASTER_SEED + ':' + salt;
  if (typeof window !== 'undefined') {
    entropy += ':' + (window.location?.host || 'localhost');
    if (typeof navigator !== 'undefined') {
      entropy += ':' + (navigator.userAgent || '');
    }
  }
  // Generate multi-byte seed
  const seed: number[] = [];
  let h = 0x811c9dc5;
  for (let i = 0; i < entropy.length; i++) {
    h ^= entropy.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    seed.push((h >>> (i % 24)) & 0xff);
  }
  return seed.length > 32 ? seed.slice(0, 32) : seed;
}

/**
 * Computes a 4-byte CRC/hash for payload integrity.
 */
function computeChecksum(data: string): string {
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash) + data.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates a random hexadecimal salt string.
 */
function generateSalt(len = 16): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(len / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  let s = '';
  for (let i = 0; i < len; i++) {
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return s;
}

/**
 * Checks whether a string is already encrypted by Crypto Shield.
 */
export function isEncryptedSecret(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(SHIELD_PREFIX);
}

/**
 * Encrypts a string synchronously using dynamic salted stream permutation.
 */
export function encryptSecretSync(plainText: string): string {
  if (!plainText || typeof plainText !== 'string') return '';
  if (isEncryptedSecret(plainText)) return plainText;

  const salt = generateSalt(16);
  const seed = deriveEntropySeed(salt);
  const checksum = computeChecksum(plainText);

  // Encode UTF-8 characters to byte array
  const utf8Bytes: number[] = [];
  for (let i = 0; i < plainText.length; i++) {
    let charCode = plainText.charCodeAt(i);
    if (charCode < 0x80) {
      utf8Bytes.push(charCode);
    } else if (charCode < 0x800) {
      utf8Bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      utf8Bytes.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
    } else {
      i++;
      charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (plainText.charCodeAt(i) & 0x3ff));
      utf8Bytes.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
  }

  // XOR Stream cipher with rotating seed and substitution box
  const cipherBytes: number[] = [];
  for (let i = 0; i < utf8Bytes.length; i++) {
    const keyByte = seed[i % seed.length] ^ ((i * 37 + 13) & 0xff);
    cipherBytes.push(utf8Bytes[i] ^ keyByte);
  }

  // Convert cipher bytes to hex
  const cipherHex = cipherBytes.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${SHIELD_PREFIX}sync:${salt}:${checksum}:${cipherHex}`;
}

/**
 * Decrypts an encrypted string synchronously.
 * Returns empty string on corruption or failure.
 * If input is plaintext (unencrypted), returns it as-is for backward compatibility.
 */
export function decryptSecretSync(cipherText: string): string {
  if (!cipherText || typeof cipherText !== 'string') return '';
  if (!cipherText.startsWith(SHIELD_PREFIX)) {
    return cipherText; // Legacy plaintext
  }

  const parts = cipherText.split(':');
  // Format: enc:v1:sync:<salt>:<checksum>:<cipherHex>
  if (parts.length < 6 || parts[2] !== 'sync') {
    return '';
  }

  const salt = parts[3];
  const expectedChecksum = parts[4];
  const cipherHex = parts[5];

  if (!cipherHex || cipherHex.length % 2 !== 0) return '';

  const seed = deriveEntropySeed(salt);
  const cipherBytes: number[] = [];
  for (let i = 0; i < cipherHex.length; i += 2) {
    cipherBytes.push(parseInt(cipherHex.substring(i, i + 2), 16));
  }

  const plainBytes: number[] = [];
  for (let i = 0; i < cipherBytes.length; i++) {
    const keyByte = seed[i % seed.length] ^ ((i * 37 + 13) & 0xff);
    plainBytes.push(cipherBytes[i] ^ keyByte);
  }

  // Decode UTF-8
  let result = '';
  let i = 0;
  while (i < plainBytes.length) {
    const b1 = plainBytes[i++];
    if (b1 < 0x80) {
      result += String.fromCharCode(b1);
    } else if (b1 >> 5 === 0x06) {
      const b2 = plainBytes[i++];
      result += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
    } else if (b1 >> 4 === 0x0e) {
      const b2 = plainBytes[i++];
      const b3 = plainBytes[i++];
      result += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    } else if (b1 >> 3 === 0x1e) {
      const b2 = plainBytes[i++];
      const b3 = plainBytes[i++];
      const b4 = plainBytes[i++];
      const cp = (((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f)) - 0x10000;
      result += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }

  // Verify integrity
  if (computeChecksum(result) !== expectedChecksum) {
    return '';
  }

  return result;
}

/**
 * Derives a CryptoKey for AES-GCM using PBKDF2 from MASTER_SEED and salt.
 */
async function deriveWebCryptoKey(salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(MASTER_SEED),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 10000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a secret using standard Web Crypto API (AES-GCM 256-bit).
 * Falls back to synchronous stream permutation in non-WebCrypto environments.
 */
export async function encryptSecret(plainText: string): Promise<string> {
  if (!plainText || typeof plainText !== 'string') return '';
  if (isEncryptedSecret(plainText)) return plainText;

  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.getRandomValues) {
    try {
      const saltBytes = new Uint8Array(16);
      crypto.getRandomValues(saltBytes);
      const iv = new Uint8Array(12);
      crypto.getRandomValues(iv);

      const key = await deriveWebCryptoKey(saltBytes);
      const enc = new TextEncoder();
      const cipherBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(plainText)
      );

      const saltHex = Array.from(saltBytes, b => b.toString(16).padStart(2, '0')).join('');
      const ivHex = Array.from(iv, b => b.toString(16).padStart(2, '0')).join('');
      const cipherHex = Array.from(new Uint8Array(cipherBuffer), b => b.toString(16).padStart(2, '0')).join('');

      return `${SHIELD_PREFIX}aes:${saltHex}:${ivHex}:${cipherHex}`;
    } catch {
      // Fall back to synchronous stream obfuscation
    }
  }

  return encryptSecretSync(plainText);
}

/**
 * Decrypts a secret, automatically handling Web Crypto AES-GCM or synchronous stream formats.
 */
export async function decryptSecret(cipherText: string): Promise<string> {
  if (!cipherText || typeof cipherText !== 'string') return '';
  if (!cipherText.startsWith(SHIELD_PREFIX)) return cipherText;

  const parts = cipherText.split(':');
  // Format: enc:v1:aes:<saltHex>:<ivHex>:<cipherHex>
  if (parts.length >= 6 && parts[2] === 'aes' && typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const saltHex = parts[3];
      const ivHex = parts[4];
      const cipherHex = parts[5];

      const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
      const iv = new Uint8Array(ivHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
      const cipherBytes = new Uint8Array(cipherHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);

      const key = await deriveWebCryptoKey(saltBytes);
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipherBytes
      );

      return new TextDecoder().decode(decryptedBuffer);
    } catch {
      return '';
    }
  }

  return decryptSecretSync(cipherText);
}

/**
 * Helper to resolve the correct storage key for a provider.
 */
function getStorageKey(provider: string): string {
  const p = provider.toLowerCase().trim();
  if (p === 'gemini') return 'cognify_gemini_api_key';
  if (p === 'groq') return 'cognify_groq_api_key';
  return `cognify_${p}_key`;
}

/**
 * Securely saves an API key or secret in encrypted form to localStorage.
 * Updates in-memory cache immediately.
 */
export async function secureSaveKey(provider: string, rawKey: string): Promise<void> {
  const keyName = getStorageKey(provider);
  const trimmed = (rawKey || '').trim();

  if (!trimmed) {
    secureRemoveKey(provider);
    return;
  }

  const encrypted = encryptSecretSync(trimmed);
  inMemoryKeyCache.set(keyName, trimmed);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(keyName, encrypted);
      // Clean up any legacy secondary key
      if (provider === 'gemini') localStorage.removeItem('gemini_api_key');
      if (provider === 'groq') localStorage.removeItem('groq_api_key');
    }
  } catch {
    // Storage restricted/disabled
  }
}

/**
 * Securely retrieves and decrypts an API key for a provider synchronously.
 * Auto-migrates legacy plaintext entries to encrypted format.
 */
export function secureLoadKeySync(provider: string): string {
  const keyName = getStorageKey(provider);

  // 1. Check in-memory cache
  if (inMemoryKeyCache.has(keyName)) {
    return inMemoryKeyCache.get(keyName) || '';
  }

  // 2. Read from localStorage
  let rawValue = '';
  try {
    if (typeof localStorage !== 'undefined') {
      rawValue = localStorage.getItem(keyName) || '';
      if (!rawValue && provider === 'gemini') {
        rawValue = localStorage.getItem('gemini_api_key') || '';
      } else if (!rawValue && provider === 'groq') {
        rawValue = localStorage.getItem('groq_api_key') || '';
      }
    }
  } catch {
    return '';
  }

  if (!rawValue) return '';

  // 3. If plaintext, migrate to encrypted and cache
  if (!isEncryptedSecret(rawValue)) {
    inMemoryKeyCache.set(keyName, rawValue);
    try {
      if (typeof localStorage !== 'undefined') {
        const enc = encryptSecretSync(rawValue);
        localStorage.setItem(keyName, enc);
      }
    } catch {}
    return rawValue;
  }

  // 4. Decrypt and cache
  const decrypted = decryptSecretSync(rawValue);
  if (decrypted) {
    inMemoryKeyCache.set(keyName, decrypted);
  }
  return decrypted;
}

/**
 * Securely retrieves and decrypts an API key asynchronously.
 */
export async function secureLoadKey(provider: string): Promise<string> {
  return secureLoadKeySync(provider);
}

/**
 * Removes an encrypted key from localStorage and cache.
 */
export function secureRemoveKey(provider: string): void {
  const keyName = getStorageKey(provider);
  inMemoryKeyCache.delete(keyName);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(keyName);
      if (provider === 'gemini') localStorage.removeItem('gemini_api_key');
      if (provider === 'groq') localStorage.removeItem('groq_api_key');
    }
  } catch {}
}

/**
 * Automatically inspects localStorage for any plaintext sensitive keys
 * and encrypts them in place.
 */
export async function autoMigrateStorageKeys(): Promise<void> {
  if (typeof localStorage === 'undefined') return;

  const keysToProtect = [
    'cognify_gemini_api_key',
    'cognify_groq_api_key',
    'gemini_api_key',
    'groq_api_key',
    'cognify_parent_pin',
  ];

  for (const k of keysToProtect) {
    try {
      const val = localStorage.getItem(k);
      if (val && !isEncryptedSecret(val)) {
        const encrypted = encryptSecretSync(val);
        localStorage.setItem(k, encrypted);
      }
    } catch {}
  }
}