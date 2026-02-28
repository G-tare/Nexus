/**
 * AES-256-GCM encryption for sensitive data (API keys, tokens, etc.)
 *
 * Uses a key derived from JWT_SECRET via PBKDF2.
 * Each encrypted value gets a unique IV and auth tag — no two encryptions
 * of the same plaintext produce the same ciphertext.
 *
 * Format: base64(iv:authTag:ciphertext)
 */

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = 'nexus-bot-encryption-v1'; // Static salt — key is already high-entropy

let _derivedKey: Buffer | null = null;

/**
 * Derive the encryption key from JWT_SECRET using PBKDF2.
 * Cached after first call.
 */
function getKey(): Buffer {
  if (_derivedKey) return _derivedKey;
  _derivedKey = crypto.pbkdf2Sync(config.api.jwtSecret, SALT, 100_000, 32, 'sha256');
  return _derivedKey;
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string containing IV + auth tag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: iv + authTag + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypt a previously encrypted string.
 * Returns the original plaintext, or null if decryption fails.
 */
export function decrypt(encryptedBase64: string): string | null {
  if (!encryptedBase64) return null;

  try {
    const packed = Buffer.from(encryptedBase64, 'base64');

    if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      // Too short to be valid — might be a plain-text key from before encryption was added
      return null;
    }

    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    // Decryption failed — either tampered data or a plain-text key
    return null;
  }
}

/**
 * Check if a string looks like it was encrypted by us (base64-encoded, minimum length).
 * Used to handle migration from plain-text to encrypted keys.
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 44) return false; // Min base64 length for iv+tag+1byte
  try {
    const buf = Buffer.from(value, 'base64');
    // Re-encode and compare to check it's valid base64
    return buf.toString('base64') === value && buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Decrypt a value, with fallback for plain-text values (migration support).
 * If decryption fails and the value doesn't look encrypted, returns it as-is.
 */
export function decryptOrPassthrough(value: string): string {
  if (!value) return '';

  // Try decryption first
  const decrypted = decrypt(value);
  if (decrypted !== null) return decrypted;

  // If decryption failed, check if it looks like a plain API key
  // (not base64 encoded, or doesn't match our encrypted format)
  if (!isEncrypted(value)) {
    return value; // Return as-is (plain text — legacy/migration)
  }

  // Looks encrypted but failed to decrypt — corrupted or wrong key
  return '';
}

/**
 * Mask a sensitive string for display (e.g., "sk-abc...wxyz").
 * Shows first 3 and last 4 characters.
 */
export function maskKey(key: string): string {
  if (!key) return '(not set)';
  if (key.length <= 8) return '••••••••';
  return `${key.substring(0, 3)}${'•'.repeat(Math.min(key.length - 7, 20))}${key.substring(key.length - 4)}`;
}
